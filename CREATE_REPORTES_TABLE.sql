-- ============================================================
-- TABELA DE REPORTES DE ERROS DO APLICATIVO
-- ============================================================

CREATE TABLE IF NOT EXISTS public.app_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo TEXT NOT NULL,
    descricao TEXT NOT NULL,
    categoria TEXT DEFAULT 'Geral',
    prioridade TEXT DEFAULT 'media',
    status TEXT NOT NULL DEFAULT 'pendente', -- 'pendente', 'em_andamento', 'resolvido'
    anexo_url TEXT,
    anexo_nome TEXT,
    anexo_tipo TEXT,
    usuario_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    usuario_nome TEXT NOT NULL,
    usuario_email TEXT,
    resposta TEXT,
    respondido_por_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    respondido_por_nome TEXT,
    respondido_em TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS
ALTER TABLE public.app_reports ENABLE ROW LEVEL SECURITY;

-- Qualquer usuário autenticado pode ver os reportes
DROP POLICY IF EXISTS "Todos os usuários autenticados podem ver reportes" ON public.app_reports;
CREATE POLICY "Todos os usuários autenticados podem ver reportes"
    ON public.app_reports FOR SELECT
    TO authenticated
    USING (true);

-- Qualquer usuário autenticado pode criar um reporte
DROP POLICY IF EXISTS "Usuários autenticados podem criar reportes" ON public.app_reports;
CREATE POLICY "Usuários autenticados podem criar reportes"
    ON public.app_reports FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = usuario_id OR usuario_id IS NULL);

-- Gestores e administradores podem atualizar status e resposta
DROP POLICY IF EXISTS "Gestores e administradores podem atualizar reportes" ON public.app_reports;
CREATE POLICY "Gestores e administradores podem atualizar reportes"
    ON public.app_reports FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role IN ('admin', 'gestor')
        )
        OR auth.uid() = usuario_id
    )
    WITH CHECK (true);

-- Administradores podem deletar
DROP POLICY IF EXISTS "Apenas admins podem deletar reportes" ON public.app_reports;
CREATE POLICY "Apenas admins podem deletar reportes"
    ON public.app_reports FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = 'admin'
        )
    );
