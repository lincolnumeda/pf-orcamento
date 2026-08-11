CREATE TABLE orcamento.interacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id uuid NOT NULL REFERENCES orcamento.orcamentos(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('nota', 'whatsapp_enviado', 'status_alterado', 'email_enviado')),
  conteudo text NOT NULL,
  autor text,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX interacoes_orcamento_id_idx ON orcamento.interacoes (orcamento_id, criado_em);

ALTER TABLE orcamento.interacoes ENABLE ROW LEVEL SECURITY;

-- Só a Central (autenticado) e as Edge Functions (service_role) escrevem
-- aqui — sem escrita pública, diferente de orcamentos.
CREATE POLICY "Leitura só autenticado" ON orcamento.interacoes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Escrita só autenticado" ON orcamento.interacoes
  FOR INSERT TO authenticated WITH CHECK (true);

-- Sem política de UPDATE/DELETE de propósito: é um log de auditoria, não dá
-- pra editar ou apagar uma interação já registrada.

GRANT SELECT, INSERT ON orcamento.interacoes TO authenticated, service_role;
