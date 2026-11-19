-- Funil de conversão do formulário público (/).
-- Roda tudo isso no SQL Editor do Supabase (Dashboard → SQL Editor). Pode
-- rodar de uma vez só.
--
-- O schema `orcamento` já está em "Exposed schemas" (Data API) — não precisa
-- mexer nisso de novo.
--
-- O que este arquivo cria:
--   1) orcamento.eh_equipe()        — "o usuário logado é da equipe?"
--   2) orcamento.eventos            — 1 linha por etapa alcançada (sem dado pessoal)
--   3) RLS + GRANTs                 — qualquer um insere; só a equipe lê
--   4) orcamento.funil_diario       — view por dia × origem (pra consultar no SQL Editor)
--   5) orcamento.funil_periodo()    — contagens prontas dos últimos N dias (usada pela Central)
--   6) orcamento.funil_origens()    — origens vistas nos últimos N dias (filtro da Central)

-- 1) Quem é da equipe.
--    Mesmo critério da Central (src/lib/auth.ts → buscarUsuarioAutorizado):
--    usuário existe em public.usuarios, está ativo e tem permissão no módulo
--    'orcamento'. SECURITY DEFINER porque precisa ler usuarios/permissoes
--    independentemente das regras de acesso dessas tabelas; search_path vazio
--    (tudo qualificado com schema) pra ninguém "sequestrar" a função criando
--    uma tabela de mesmo nome em outro schema.
CREATE OR REPLACE FUNCTION orcamento.eh_equipe()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios u
    JOIN public.permissoes p ON p.usuario_id = u.id
    JOIN public.modulos m ON m.id = p.modulo_id
    WHERE lower(u.email) = lower(auth.jwt() ->> 'email')
      AND u.ativo
      AND m.slug = 'orcamento'
  );
$$;

REVOKE ALL ON FUNCTION orcamento.eh_equipe() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION orcamento.eh_equipe() TO authenticated;

-- 2) Tabela de eventos.
--    ⚠️ NÃO guardar nome, e-mail, telefone, CEP nem nada pessoal aqui.
--    visitante_id é um código aleatório gerado no navegador.
--    Os nomes dos eventos estão espelhados em src/lib/funil.ts (EVENTOS_FUNIL).
CREATE TABLE orcamento.eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  criado_em timestamptz NOT NULL DEFAULT now(),
  visitante_id text NOT NULL CHECK (char_length(visitante_id) BETWEEN 1 AND 64),
  evento text NOT NULL CHECK (evento IN (
    'pagina_aberta', 'livro_adicionado', 'frete_calculado', 'contato_iniciado', 'orcamento_enviado'
  )),
  origem text CHECK (origem IS NULL OR char_length(origem) <= 100),
  dispositivo text NOT NULL CHECK (dispositivo IN ('mobile', 'desktop')),
  equipe boolean NOT NULL DEFAULT false
);

CREATE INDEX eventos_criado_em_idx ON orcamento.eventos (criado_em);
CREATE INDEX eventos_evento_criado_em_idx ON orcamento.eventos (evento, criado_em);

-- 3) Regras de acesso.
ALTER TABLE orcamento.eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Registro público" ON orcamento.eventos
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Leitura só equipe" ON orcamento.eventos
  FOR SELECT TO authenticated USING (orcamento.eh_equipe());

-- Sem UPDATE/DELETE de propósito (log).
-- INSERT liberado só nestas colunas: id e criado_em ficam sempre com o
-- default do banco (ninguém consegue "inventar" a data de um evento).
-- Consequência: o navegador NUNCA pode pedir a linha de volta (.select()
-- depois do insert) — anon não tem SELECT. src/lib/funil.ts usa insert simples.
GRANT INSERT (visitante_id, evento, origem, dispositivo, equipe) ON orcamento.eventos TO anon, authenticated;
GRANT SELECT ON orcamento.eventos TO authenticated;
GRANT ALL ON orcamento.eventos TO service_role;

-- 4) View diária. Dia no fuso de Brasília. Exclui os testes da equipe.
--    security_invoker = true faz a view respeitar a RLS de eventos (sem isso
--    a view rodaria com os direitos do dono e qualquer um leria tudo por ela).
--    Somar a mesma coluna de vários dias pode contar 2x quem voltou em dias
--    diferentes — pra período, use orcamento.funil_periodo().
CREATE OR REPLACE VIEW orcamento.funil_diario
WITH (security_invoker = true)
AS
SELECT
  (criado_em AT TIME ZONE 'America/Sao_Paulo')::date AS dia,
  coalesce(origem, 'direto') AS origem,
  count(DISTINCT visitante_id) FILTER (WHERE evento = 'pagina_aberta')     AS pagina_aberta,
  count(DISTINCT visitante_id) FILTER (WHERE evento = 'livro_adicionado')  AS livro_adicionado,
  count(DISTINCT visitante_id) FILTER (WHERE evento = 'frete_calculado')   AS frete_calculado,
  count(DISTINCT visitante_id) FILTER (WHERE evento = 'contato_iniciado')  AS contato_iniciado,
  count(DISTINCT visitante_id) FILTER (WHERE evento = 'orcamento_enviado') AS orcamento_enviado
FROM orcamento.eventos
WHERE NOT equipe
GROUP BY 1, 2;

REVOKE ALL ON orcamento.funil_diario FROM anon;
GRANT SELECT ON orcamento.funil_diario TO authenticated;

-- 5) Contagens do período, já prontas (a Central só mostra o resultado —
--    nada de baixar eventos e contar no navegador, que esbarraria no limite
--    de 1.000 linhas por consulta da API).
--    Visitantes únicos por etapa nos últimos `dias` dias, sem a equipe.
--    p_origem NULL = todas as origens.
--    SECURITY DEFINER + checagem explícita de eh_equipe(): quem não é da
--    equipe recebe erro, em vez de zeros silenciosos.
CREATE OR REPLACE FUNCTION orcamento.funil_periodo(dias integer, p_origem text DEFAULT NULL)
RETURNS TABLE (ordem integer, evento text, visitantes bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT orcamento.eh_equipe() THEN
    RAISE EXCEPTION 'acesso negado' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT e.ordem, e.evento, count(DISTINCT ev.visitante_id)
  FROM (VALUES
    (1, 'pagina_aberta'),
    (2, 'livro_adicionado'),
    (3, 'frete_calculado'),
    (4, 'contato_iniciado'),
    (5, 'orcamento_enviado')
  ) AS e(ordem, evento)
  LEFT JOIN orcamento.eventos ev
    ON ev.evento = e.evento
   AND NOT ev.equipe
   AND ev.criado_em >= now() - make_interval(days => greatest(1, least(coalesce(dias, 30), 365)))
   AND (p_origem IS NULL OR coalesce(ev.origem, 'direto') = p_origem)
  GROUP BY e.ordem, e.evento
  ORDER BY e.ordem;
END;
$$;

REVOKE ALL ON FUNCTION orcamento.funil_periodo(integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION orcamento.funil_periodo(integer, text) TO authenticated;

-- 6) Origens vistas no período (pro filtro da Central), mais frequentes primeiro.
CREATE OR REPLACE FUNCTION orcamento.funil_origens(dias integer)
RETURNS TABLE (origem text, visitantes bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT orcamento.eh_equipe() THEN
    RAISE EXCEPTION 'acesso negado' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT coalesce(ev.origem, 'direto'), count(DISTINCT ev.visitante_id)
  FROM orcamento.eventos ev
  WHERE NOT ev.equipe
    AND ev.criado_em >= now() - make_interval(days => greatest(1, least(coalesce(dias, 30), 365)))
  GROUP BY 1
  ORDER BY 2 DESC, 1;
END;
$$;

REVOKE ALL ON FUNCTION orcamento.funil_origens(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION orcamento.funil_origens(integer) TO authenticated;

-- Consultas úteis (SQL Editor roda como dono, então aqui não passa pela RLS).
-- funil_periodo()/funil_origens() NÃO funcionam no SQL Editor (lá não há
-- usuário logado, então eh_equipe() dá false → "acesso negado"); use a view.
--
--   -- Últimos eventos (inclui equipe), pra conferir o teste:
--   SELECT criado_em, visitante_id, evento, origem, dispositivo, equipe
--   FROM orcamento.eventos ORDER BY criado_em DESC LIMIT 20;
--
--   -- Funil por dia, todas as origens somadas:
--   SELECT dia, sum(pagina_aberta) AS abertas, sum(livro_adicionado) AS livro,
--          sum(frete_calculado) AS frete, sum(contato_iniciado) AS contato,
--          sum(orcamento_enviado) AS enviados
--   FROM orcamento.funil_diario GROUP BY dia ORDER BY dia DESC;
--
--   -- Funil por dia só do ManyChat:
--   SELECT * FROM orcamento.funil_diario WHERE origem = 'manychat' ORDER BY dia DESC;
