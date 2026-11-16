-- Programa "Indique uma escola": tabela de indicações + histórico.
-- Roda tudo isso no SQL Editor do Supabase (Dashboard → SQL Editor), na
-- ordem em que aparece no arquivo. Pode rodar de uma vez só.
--
-- Depois deste, rode scripts/sql/agendar-whatsapp-indicacao.sql (WhatsApp
-- automático de "indicação recebida").
--
-- O schema `orcamento` já está em "Exposed schemas" (Data API) — não precisa
-- mexer nisso de novo.

-- 1) Normalização do nome/cidade da escola.
--    ⚠️ ESPELHADA em src/lib/indicacaoChave.ts (normalizarTextoEscola) — a
--    Central usa a versão TS pra comparar com orçamentos. Os dois lados TÊM
--    que dar o mesmo resultado: mesma lista de acentos, mesmas palavras
--    ignoradas (escola, colegio, ltda), mesmo separador "|".
CREATE OR REPLACE FUNCTION orcamento.normalizar_texto_escola(texto text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT btrim(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          lower(translate(
            coalesce(texto, ''),
            'áàâãäåéèêëíìîïóòôõöúùûüçñýÿÁÀÂÃÄÅÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑÝ',
            'aaaaaaeeeeiiiiooooouuuucnyyaaaaaaeeeeiiiiooooouuuucny'
          )),
          '[^a-z0-9]+', ' ', 'g'),
        '\m(escola|colegio|ltda)\M', ' ', 'g'),
      ' +', ' ', 'g')
  );
$$;

CREATE OR REPLACE FUNCTION orcamento.gerar_escola_chave(nome text, cidade text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT orcamento.normalizar_texto_escola(nome) || '|' || orcamento.normalizar_texto_escola(cidade);
$$;

-- 2) Tabela principal.
CREATE TABLE orcamento.indicacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Escola indicada
  escola_nome text NOT NULL CHECK (char_length(escola_nome) BETWEEN 2 AND 200),
  escola_cidade text NOT NULL CHECK (char_length(escola_cidade) BETWEEN 2 AND 120),
  escola_uf char(2) NOT NULL CHECK (escola_uf ~ '^[A-Z]{2}$'),
  escola_responsavel text NOT NULL CHECK (char_length(escola_responsavel) BETWEEN 2 AND 200),
  escola_cargo text CHECK (escola_cargo IS NULL OR char_length(escola_cargo) <= 120),
  escola_whatsapp text NOT NULL CHECK (char_length(escola_whatsapp) BETWEEN 10 AND 20),
  escola_email text CHECK (escola_email IS NULL OR char_length(escola_email) <= 200),

  -- Quem indicou
  indicador_nome text NOT NULL CHECK (char_length(indicador_nome) BETWEEN 2 AND 200),
  indicador_whatsapp text NOT NULL CHECK (char_length(indicador_whatsapp) BETWEEN 10 AND 20),
  indicador_email text NOT NULL CHECK (char_length(indicador_email) BETWEEN 3 AND 200),
  indicador_cpf text NOT NULL CHECK (indicador_cpf ~ '^\d{11}$'),
  indicador_relacao text NOT NULL CHECK (char_length(indicador_relacao) <= 120),
  origem text NOT NULL DEFAULT 'direto' CHECK (char_length(origem) <= 120),

  -- Controle (preenchido pelo trigger no insert — ver item 3)
  escola_chave text NOT NULL DEFAULT '',
  possivel_duplicada boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'recebida' CHECK (status IN (
    'recebida', 'aceita', 'recusada_cliente', 'recusada_duplicada',
    'em_negociacao', 'fechou', 'nao_fechou', 'paga'
  )),
  valida_ate timestamptz,

  -- Fechamento e pagamento. Valores copiados do snapshot do orçamento
  -- (itens congelados), nunca do preço atual de orcamento.produtos.
  orcamento_id uuid REFERENCES orcamento.orcamentos(id) ON DELETE SET NULL,
  qtd_livros integer CHECK (qtd_livros IS NULL OR qtd_livros >= 0),
  valor_livros numeric(10,2) CHECK (valor_livros IS NULL OR valor_livros >= 0),
  comissao numeric(10,2) CHECK (comissao IS NULL OR comissao >= 0),
  fechado_em timestamptz,
  pago_em date,
  notas_internas text,

  -- Envios de WhatsApp: cada mensagem sai no máximo uma vez. A Edge Function
  -- enviar-whatsapp-indicacao marca a coluna de forma atômica antes de enviar.
  whatsapp_recebida_disparado_em timestamptz, -- o cron já chamou a function (não tenta de novo)
  whatsapp_recebida_enviado_em timestamptz,
  whatsapp_aceita_enviado_em timestamptz,
  whatsapp_recusada_cliente_enviado_em timestamptz,
  whatsapp_recusada_duplicada_enviado_em timestamptz,
  whatsapp_fechou_enviado_em timestamptz,
  whatsapp_paga_enviado_em timestamptz,

  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX indicacoes_escola_chave_idx ON orcamento.indicacoes (escola_chave);
CREATE INDEX indicacoes_status_idx ON orcamento.indicacoes (status, criado_em);
CREATE INDEX indicacoes_orcamento_id_idx ON orcamento.indicacoes (orcamento_id);

-- 3) Trigger de insert.
--    - Calcula escola_chave e valida_ate (criado_em + 30 dias).
--      ⚠️ 30 dias também está em src/lib/indicacaoConfig.ts (VALIDADE_DIAS).
--    - Marca possivel_duplicada se já existe outra indicação com a mesma
--      chave (vale a primeira registrada — a anterior não é alterada).
--    - Força os campos de controle: o INSERT é público (anon), então ninguém
--      consegue já criar uma indicação "aceita" ou com comissão preenchida.
--    SECURITY DEFINER porque o anon não tem SELECT na tabela e precisa
--    enxergar as outras indicações pra checar duplicidade.
CREATE OR REPLACE FUNCTION orcamento.indicacoes_antes_de_inserir()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = orcamento, public
AS $$
BEGIN
  NEW.criado_em := now();
  NEW.atualizado_em := now();
  NEW.valida_ate := NEW.criado_em + interval '30 days';
  NEW.status := 'recebida';
  NEW.escola_chave := orcamento.gerar_escola_chave(NEW.escola_nome, NEW.escola_cidade);
  NEW.indicador_cpf := regexp_replace(NEW.indicador_cpf, '\D', '', 'g');
  NEW.escola_uf := upper(NEW.escola_uf);
  NEW.origem := coalesce(nullif(btrim(NEW.origem), ''), 'direto');

  NEW.orcamento_id := NULL;
  NEW.qtd_livros := NULL;
  NEW.valor_livros := NULL;
  NEW.comissao := NULL;
  NEW.fechado_em := NULL;
  NEW.pago_em := NULL;
  NEW.notas_internas := NULL;
  NEW.whatsapp_recebida_disparado_em := NULL;
  NEW.whatsapp_recebida_enviado_em := NULL;
  NEW.whatsapp_aceita_enviado_em := NULL;
  NEW.whatsapp_recusada_cliente_enviado_em := NULL;
  NEW.whatsapp_recusada_duplicada_enviado_em := NULL;
  NEW.whatsapp_fechou_enviado_em := NULL;
  NEW.whatsapp_paga_enviado_em := NULL;

  NEW.possivel_duplicada := EXISTS (
    SELECT 1 FROM orcamento.indicacoes i WHERE i.escola_chave = NEW.escola_chave
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER indicacoes_antes_de_inserir
  BEFORE INSERT ON orcamento.indicacoes
  FOR EACH ROW EXECUTE FUNCTION orcamento.indicacoes_antes_de_inserir();

-- Mantém atualizado_em em qualquer edição.
CREATE OR REPLACE FUNCTION orcamento.indicacoes_antes_de_atualizar()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.atualizado_em := now();
  -- Se a Central corrigir nome/cidade, a chave acompanha.
  IF NEW.escola_nome IS DISTINCT FROM OLD.escola_nome OR NEW.escola_cidade IS DISTINCT FROM OLD.escola_cidade THEN
    NEW.escola_chave := orcamento.gerar_escola_chave(NEW.escola_nome, NEW.escola_cidade);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER indicacoes_antes_de_atualizar
  BEFORE UPDATE ON orcamento.indicacoes
  FOR EACH ROW EXECUTE FUNCTION orcamento.indicacoes_antes_de_atualizar();

-- 4) RLS igual a orcamentos: criação pública, leitura/edição só autenticado.
ALTER TABLE orcamento.indicacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Criação pública" ON orcamento.indicacoes
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Leitura só autenticado" ON orcamento.indicacoes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Edição só autenticado" ON orcamento.indicacoes
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Sem DELETE de propósito (histórico do programa / pagamento de comissão).
GRANT INSERT ON orcamento.indicacoes TO anon;
GRANT SELECT, INSERT, UPDATE ON orcamento.indicacoes TO authenticated;
GRANT ALL ON orcamento.indicacoes TO service_role;

-- 5) Histórico da indicação (mesmo modelo de orcamento.interacoes): toda
--    mensagem de WhatsApp enviada, mudança de status e nota interna.
CREATE TABLE orcamento.indicacoes_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  indicacao_id uuid NOT NULL REFERENCES orcamento.indicacoes(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('nota', 'whatsapp_enviado', 'status_alterado')),
  conteudo text NOT NULL,
  autor text,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX indicacoes_historico_indicacao_id_idx ON orcamento.indicacoes_historico (indicacao_id, criado_em);

ALTER TABLE orcamento.indicacoes_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura só autenticado" ON orcamento.indicacoes_historico
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Escrita só autenticado" ON orcamento.indicacoes_historico
  FOR INSERT TO authenticated WITH CHECK (true);

-- Log imutável: sem UPDATE/DELETE.
GRANT SELECT, INSERT ON orcamento.indicacoes_historico TO authenticated;
GRANT ALL ON orcamento.indicacoes_historico TO service_role;

-- Conferência rápida (opcional):
-- SELECT orcamento.gerar_escola_chave('Colégio Pequeno Príncipe Ltda.', 'São Paulo');
--   → pequeno principe|sao paulo
