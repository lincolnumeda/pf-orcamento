CREATE TABLE orcamento.prazos_producao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qtd_min integer NOT NULL,
  qtd_max integer,
  dias_uteis integer,
  texto_customizado text
);

ALTER TABLE orcamento.prazos_producao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura pública" ON orcamento.prazos_producao
  FOR SELECT USING (true);

CREATE POLICY "Escrita só autenticado" ON orcamento.prazos_producao
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

GRANT SELECT ON orcamento.prazos_producao TO anon, authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON orcamento.prazos_producao TO authenticated, service_role;
