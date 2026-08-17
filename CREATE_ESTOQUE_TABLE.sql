-- Execute este comando no SQL Editor do Supabase (https://supabase.com/dashboard)
-- para criar a tabela de estoque físico dos materiais.

CREATE TABLE IF NOT EXISTS materiais_estoque (
  id BIGSERIAL PRIMARY KEY,
  unidade_id TEXT NOT NULL,
  codigo TEXT NOT NULL,
  descricao TEXT,
  quantidade NUMERIC DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_unidade_codigo UNIQUE (unidade_id, codigo)
);

-- Índice para busca rápida de estoque por código
CREATE INDEX IF NOT EXISTS idx_materiais_estoque_busca ON materiais_estoque (unidade_id, codigo);

-- RLS: habilitar e permitir leitura pública e escrita irrestrita para o sync
ALTER TABLE materiais_estoque ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read materiais_estoque" ON materiais_estoque;
CREATE POLICY "Allow public read materiais_estoque" ON materiais_estoque
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow service write materiais_estoque" ON materiais_estoque;
CREATE POLICY "Allow service write materiais_estoque" ON materiais_estoque
  FOR ALL USING (true) WITH CHECK (true);
