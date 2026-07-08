-- Execute este comando no SQL Editor do Supabase (https://supabase.com/dashboard)
-- para criar a tabela de reservas e formulários de materiais.

CREATE TABLE IF NOT EXISTS materiais_reservas (
  id BIGSERIAL PRIMARY KEY,
  unidade_id TEXT NOT NULL,
  obra TEXT NOT NULL,
  codigo TEXT NOT NULL,
  quantidade NUMERIC DEFAULT 0,
  status TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Criação de índices para consultas eficientes por obra e código
CREATE INDEX IF NOT EXISTS idx_materiais_reservas_busca ON materiais_reservas (unidade_id, obra, codigo);

-- Habilitar segurança a nível de linha (RLS) e permissão de escrita/leitura pública
ALTER TABLE materiais_reservas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read materiais_reservas" ON materiais_reservas;
CREATE POLICY "Allow public read materiais_reservas" ON materiais_reservas FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow service write materiais_reservas" ON materiais_reservas;
CREATE POLICY "Allow service write materiais_reservas" ON materiais_reservas FOR ALL USING (true) WITH CHECK (true);
