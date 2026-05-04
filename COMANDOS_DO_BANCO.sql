-- PASSO 1: Copie TUDO abaixo e cole no SQL Editor do Supabase, depois clique em RUN.

-- 1. Criar a tabela de seções
CREATE TABLE IF NOT EXISTS public.sector_sections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sector_id UUID NOT NULL REFERENCES public.sectors(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    type TEXT NOT NULL,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID REFERENCES auth.users(id)
);

-- 2. Habilitar segurança
ALTER TABLE public.sector_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for all users" ON public.sector_sections FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users" ON public.sector_sections FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Enable update for authenticated users" ON public.sector_sections FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "Enable delete for authenticated users" ON public.sector_sections FOR DELETE USING (auth.role() = 'authenticated');

-- 3. Preencher Setores EXISTENTES com as abas padrão
DO $$
DECLARE
    sector_record RECORD;
BEGIN
    FOR sector_record IN SELECT id FROM public.sectors LOOP
        -- Verificar e inserir Dashboard se não existir (evita duplicatas se rodar 2x)
        IF NOT EXISTS (SELECT 1 FROM public.sector_sections WHERE sector_id = sector_record.id AND type = 'dashboard') THEN
            INSERT INTO public.sector_sections (sector_id, title, type, order_index) VALUES (sector_record.id, 'Dashboard', 'dashboard', 0);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM public.sector_sections WHERE sector_id = sector_record.id AND type = 'tasks') THEN
            INSERT INTO public.sector_sections (sector_id, title, type, order_index) VALUES (sector_record.id, 'Tarefas', 'tasks', 1);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM public.sector_sections WHERE sector_id = sector_record.id AND type = 'routines') THEN
            INSERT INTO public.sector_sections (sector_id, title, type, order_index) VALUES (sector_record.id, 'Rotinas', 'routines', 2);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM public.sector_sections WHERE sector_id = sector_record.id AND type = 'units') THEN
            INSERT INTO public.sector_sections (sector_id, title, type, order_index) VALUES (sector_record.id, 'Unidades', 'units', 3);
        END IF;
    END LOOP;
END $$;

-- 4. Criar gatilho para FUTUROS setores
CREATE OR REPLACE FUNCTION public.handle_new_sector_sections()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.sector_sections (sector_id, title, type, order_index)
    VALUES 
    (NEW.id, 'Dashboard', 'dashboard', 0),
    (NEW.id, 'Tarefas', 'tasks', 1),
    (NEW.id, 'Rotinas', 'routines', 2),
    (NEW.id, 'Unidades', 'units', 3);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_sector_created ON public.sectors;
CREATE TRIGGER on_sector_created
    AFTER INSERT ON public.sectors
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_sector_sections();

-- 5. Atualizar tabela de tarefas (pode dar erro se já existir, mas não tem problema)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'section_id') THEN
        ALTER TABLE public.tasks ADD COLUMN section_id UUID REFERENCES public.sector_sections(id) ON DELETE SET NULL;
        CREATE INDEX idx_tasks_section_id ON public.tasks(section_id);
    END IF;
END $$;
