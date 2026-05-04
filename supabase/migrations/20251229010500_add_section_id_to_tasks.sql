ALTER TABLE public.tasks
ADD COLUMN section_id UUID REFERENCES public.sector_sections(id) ON DELETE SET NULL;

CREATE INDEX idx_tasks_section_id ON public.tasks(section_id);
