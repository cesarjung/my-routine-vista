
-- Create indexes for materiais_por_ponto table to fix timeout issues
-- The table has 1M+ rows and needs indexes for query performance

CREATE INDEX IF NOT EXISTS idx_materiais_por_ponto_com_mascara 
  ON materiais_por_ponto (com_mascara);

CREATE INDEX IF NOT EXISTS idx_materiais_por_ponto_mascara_e_ponto 
  ON materiais_por_ponto (mascara_e_ponto);

CREATE INDEX IF NOT EXISTS idx_materiais_por_ponto_unidade_id 
  ON materiais_por_ponto (unidade_id);
