-- Tabela para atividades por ponto (ATIVIDADES_POR_PONTO_BASE)
-- Fonte: planilha centralizada 1Ipp454Clq0lKik8G5LjMMmV-8eA0R6if4FGG555K1j8

CREATE TABLE IF NOT EXISTS public.atividades_por_ponto (
    id bigserial PRIMARY KEY,
    projeto text NOT NULL,
    ponto_obra text NOT NULL,
    etapa text NOT NULL DEFAULT '',
    codigo_atividade text NOT NULL DEFAULT '',
    descricao text NOT NULL DEFAULT '',
    unidade_medida text DEFAULT 'UND',
    quantidade numeric(10,3) DEFAULT 1,
    orcamentista text DEFAULT '',
    com_mascara text NOT NULL,
    unidade_obra text DEFAULT '',
    com_ponto_mascara text DEFAULT '',
    updated_at timestamptz DEFAULT now()
);

-- Índices para performance nas queries do PCP
CREATE INDEX IF NOT EXISTS idx_atividades_por_ponto_com_mascara ON public.atividades_por_ponto(com_mascara);
CREATE INDEX IF NOT EXISTS idx_atividades_por_ponto_ponto_obra ON public.atividades_por_ponto(ponto_obra);
CREATE INDEX IF NOT EXISTS idx_atividades_por_ponto_com_ponto_mascara ON public.atividades_por_ponto(com_ponto_mascara);

-- RLS: acesso público de leitura para anon (igual a materiais_por_ponto)
ALTER TABLE public.atividades_por_ponto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon read atividades_por_ponto"
    ON public.atividades_por_ponto
    FOR SELECT
    TO anon, authenticated
    USING (true);

CREATE POLICY "Allow service write atividades_por_ponto"
    ON public.atividades_por_ponto
    FOR ALL
    TO service_role
    USING (true);
