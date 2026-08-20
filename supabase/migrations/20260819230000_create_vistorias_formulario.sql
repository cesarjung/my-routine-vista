-- ==============================================================================
-- Migration: 20260819230000_create_vistorias_formulario.sql
-- Tabela: vistorias_formulario
-- Descrição: Base centralizada de formulários de vistoria de campo do Google Drive.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.vistorias_formulario (
    id BIGSERIAL PRIMARY KEY,
    obra_id TEXT NOT NULL,                             -- Identificador da obra/projeto
    data_vistoria TEXT,                                -- Carimbo de data/hora ou data da vistoria
    timestamp_vistoria TIMESTAMPTZ,                    -- Timestamp parseado para ordenação
    apta_inapta TEXT,                                  -- 0.2: Obra Apta ou Inapta
    obs_planejamento TEXT,                             -- 0.1: Observações importantes para planejamento
    desligamento_bt BOOLEAN DEFAULT FALSE,             -- 0.4: Necessário desligamento BT?
    desligamento_mt BOOLEAN DEFAULT FALSE,             -- 0.5: Necessário desligamento MT?
    equipe_lv BOOLEAN DEFAULT FALSE,                   -- 0.6: Necessário atuação de equipe LV?
    acesso_chuva BOOLEAN DEFAULT TRUE,                 -- 1.4: Em condições de chuva haverá acesso? (FALSE = sem acesso)
    autorizacao_passagem BOOLEAN DEFAULT FALSE,        -- 1.6: Necessário verificar autorização de passagem?
    alojamento_proximo TEXT,                           -- 1.7: Há local para alojamento próximo a obra?
    obs_acesso TEXT,                                   -- 1.10: Observações gerais a respeito do acesso
    equipamentos_manobra TEXT,                         -- 2.1: Número dos equipamentos de manobra
    conservacao_lv BOOLEAN DEFAULT TRUE,               -- 4.5: Estado permite trabalho com LV? (FALSE = risco)
    necessita_poda BOOLEAN DEFAULT FALSE,              -- 5.1: Há necessidade de manejo da vegetação (poda)?
    solo_rochoso BOOLEAN DEFAULT FALSE,                -- 6.2: Existe solo rochoso (Solo C)?
    condicoes_manobra_seguras BOOLEAN DEFAULT TRUE,    -- 6.4: Postes e estruturas em boas condições? (FALSE = 🔴 ALERTA VERMELHO)
    risco_queda_cabos BOOLEAN DEFAULT FALSE,           -- 6.5: Risco de queda de poste ou rompimento? (TRUE = 🔴 ALERTA VERMELHO)
    auxilio_lv BOOLEAN DEFAULT FALSE,                  -- 6.10: Será necessário auxílio de linha viva?
    dados_extras JSONB DEFAULT '{}',                   -- Demais campos mapeados do formulário
    arquivo_origem TEXT,                               -- Nome do arquivo no Google Drive de onde veio o registro
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(obra_id)
);

-- Índices de busca rápida
CREATE INDEX IF NOT EXISTS idx_vistorias_formulario_obra_id ON public.vistorias_formulario(obra_id);
CREATE INDEX IF NOT EXISTS idx_vistorias_formulario_timestamp ON public.vistorias_formulario(timestamp_vistoria DESC);

-- Permissões e RLS
ALTER TABLE public.vistorias_formulario DISABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.vistorias_formulario TO anon, authenticated;
GRANT ALL ON public.vistorias_formulario TO service_role;
