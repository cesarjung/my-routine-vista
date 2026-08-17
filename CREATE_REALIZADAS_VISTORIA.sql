-- Tabela para armazenar observações de vistoria da planilha Realizadas
-- Fonte: planilha 1NU3JY3fON8qiX8zOcQint07XybKNBrGBleBLyRLr2ag
-- Coluna H = obra_id, Coluna Z = observacoes_vistoria

CREATE TABLE IF NOT EXISTS public.realizadas_vistoria (
    id BIGSERIAL PRIMARY KEY,
    obra_id TEXT NOT NULL,                  -- Col H da aba Realizadas
    observacoes_vistoria TEXT,              -- Col Z da aba Realizadas
    risk_tags TEXT[] DEFAULT '{}',          -- Tags geradas por IA (cache)
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(obra_id)
);

-- Índice para busca rápida por obra
CREATE INDEX IF NOT EXISTS idx_realizadas_vistoria_obra_id
    ON public.realizadas_vistoria(obra_id);

-- Desabilitar RLS para o sync bot (anon key)
ALTER TABLE public.realizadas_vistoria DISABLE ROW LEVEL SECURITY;

-- Grant de leitura para o frontend (anon)
GRANT SELECT ON public.realizadas_vistoria TO anon;
GRANT SELECT, INSERT, UPDATE ON public.realizadas_vistoria TO service_role;
