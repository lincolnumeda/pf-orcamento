CREATE TABLE orcamento.faixas_embalagem (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qtd_min integer NOT NULL,
  qtd_max integer NOT NULL,
  altura_cm numeric NOT NULL,
  largura_cm numeric NOT NULL,
  comprimento_cm numeric NOT NULL,
  peso_embalagem_kg numeric NOT NULL DEFAULT 0
);

ALTER TABLE orcamento.faixas_embalagem ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura pública" ON orcamento.faixas_embalagem
  FOR SELECT USING (true);

CREATE POLICY "Escrita só autenticado" ON orcamento.faixas_embalagem
  FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

GRANT SELECT ON orcamento.faixas_embalagem TO anon, authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON orcamento.faixas_embalagem TO authenticated, service_role;
