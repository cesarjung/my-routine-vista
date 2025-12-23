-- Tabela de comentários em subtarefas
CREATE TABLE public.subtask_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subtask_id UUID NOT NULL REFERENCES public.subtasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de anexos em subtarefas
CREATE TABLE public.subtask_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subtask_id UUID NOT NULL REFERENCES public.subtasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.subtask_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subtask_attachments ENABLE ROW LEVEL SECURITY;

-- Políticas para comentários
CREATE POLICY "Admin pode gerenciar todos comentários" 
ON public.subtask_comments 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Gestor pode gerenciar comentários da sua unidade" 
ON public.subtask_comments 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM subtasks s
    JOIN tasks t ON t.id = s.task_id
    WHERE s.id = subtask_comments.subtask_id 
    AND is_unit_manager(auth.uid(), t.unit_id)
  )
);

CREATE POLICY "Usuario pode ver comentários de subtarefas da sua unidade" 
ON public.subtask_comments 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM subtasks s
    JOIN tasks t ON t.id = s.task_id
    WHERE s.id = subtask_comments.subtask_id 
    AND t.unit_id = get_user_unit_id(auth.uid())
  )
);

CREATE POLICY "Usuario pode criar comentários em subtarefas atribuídas a ele" 
ON public.subtask_comments 
FOR INSERT 
WITH CHECK (
  user_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM subtasks s
    WHERE s.id = subtask_comments.subtask_id 
    AND s.assigned_to = auth.uid()
  )
);

-- Políticas para anexos
CREATE POLICY "Admin pode gerenciar todos anexos" 
ON public.subtask_attachments 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Gestor pode gerenciar anexos da sua unidade" 
ON public.subtask_attachments 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM subtasks s
    JOIN tasks t ON t.id = s.task_id
    WHERE s.id = subtask_attachments.subtask_id 
    AND is_unit_manager(auth.uid(), t.unit_id)
  )
);

CREATE POLICY "Usuario pode ver anexos de subtarefas da sua unidade" 
ON public.subtask_attachments 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM subtasks s
    JOIN tasks t ON t.id = s.task_id
    WHERE s.id = subtask_attachments.subtask_id 
    AND t.unit_id = get_user_unit_id(auth.uid())
  )
);

CREATE POLICY "Usuario pode criar anexos em subtarefas atribuídas a ele" 
ON public.subtask_attachments 
FOR INSERT 
WITH CHECK (
  user_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM subtasks s
    WHERE s.id = subtask_attachments.subtask_id 
    AND s.assigned_to = auth.uid()
  )
);

-- Criar bucket para anexos
INSERT INTO storage.buckets (id, name, public) VALUES ('subtask-attachments', 'subtask-attachments', false);

-- Políticas de storage
CREATE POLICY "Usuários podem ver anexos da sua unidade" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'subtask-attachments' AND
  auth.role() = 'authenticated'
);

CREATE POLICY "Usuários podem fazer upload de anexos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'subtask-attachments' AND
  auth.role() = 'authenticated'
);