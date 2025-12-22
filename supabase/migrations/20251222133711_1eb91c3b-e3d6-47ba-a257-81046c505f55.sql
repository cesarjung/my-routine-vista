-- Enum para roles
CREATE TYPE public.app_role AS ENUM ('admin', 'gestor', 'usuario');

-- Enum para frequência de rotinas
CREATE TYPE public.task_frequency AS ENUM ('diaria', 'semanal', 'quinzenal', 'mensal', 'anual', 'customizada');

-- Enum para status de tarefas
CREATE TYPE public.task_status AS ENUM ('pendente', 'em_andamento', 'concluida', 'atrasada', 'cancelada');

-- Tabela de unidades
CREATE TABLE public.units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de perfis de usuário
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de roles (separada para segurança)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'usuario',
  UNIQUE (user_id, role)
);

-- Tabela de gestores por unidade (um gestor pode gerenciar múltiplas unidades)
CREATE TABLE public.unit_managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, unit_id)
);

-- Tabela de rotinas
CREATE TABLE public.routines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  frequency task_frequency NOT NULL,
  custom_schedule JSONB, -- para rotinas customizadas
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de tarefas (instâncias de rotinas)
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id UUID REFERENCES public.routines(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status task_status NOT NULL DEFAULT 'pendente',
  priority INTEGER DEFAULT 1,
  due_date TIMESTAMPTZ,
  start_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  google_event_id TEXT, -- para integração com Google Calendar
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de subtarefas
CREATE TABLE public.subtasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela para tokens do Google Calendar
CREATE TABLE public.google_calendar_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_calendar_tokens ENABLE ROW LEVEL SECURITY;

-- Função para verificar role (security definer para evitar recursão)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Função para verificar se usuário é gestor de uma unidade
CREATE OR REPLACE FUNCTION public.is_unit_manager(_user_id UUID, _unit_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.unit_managers
    WHERE user_id = _user_id AND unit_id = _unit_id
  )
$$;

-- Função para obter unit_id do usuário
CREATE OR REPLACE FUNCTION public.get_user_unit_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT unit_id FROM public.profiles WHERE id = _user_id
$$;

-- RLS Policies

-- Units: Admin vê tudo, gestor vê suas unidades, usuário vê sua unidade
CREATE POLICY "Admin pode gerenciar todas unidades" ON public.units
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Gestor pode ver suas unidades" ON public.units
  FOR SELECT USING (public.is_unit_manager(auth.uid(), id));

CREATE POLICY "Usuario pode ver sua unidade" ON public.units
  FOR SELECT USING (id = public.get_user_unit_id(auth.uid()));

-- Profiles
CREATE POLICY "Usuario pode ver seu perfil" ON public.profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "Usuario pode atualizar seu perfil" ON public.profiles
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Admin pode ver todos perfis" ON public.profiles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin pode gerenciar todos perfis" ON public.profiles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Gestor pode ver perfis da sua unidade" ON public.profiles
  FOR SELECT USING (public.is_unit_manager(auth.uid(), unit_id));

-- User Roles
CREATE POLICY "Admin pode gerenciar roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Usuario pode ver sua role" ON public.user_roles
  FOR SELECT USING (user_id = auth.uid());

-- Unit Managers
CREATE POLICY "Admin pode gerenciar gestores" ON public.unit_managers
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Gestor pode ver gestores da unidade" ON public.unit_managers
  FOR SELECT USING (public.is_unit_manager(auth.uid(), unit_id));

-- Routines
CREATE POLICY "Admin pode gerenciar todas rotinas" ON public.routines
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Gestor pode gerenciar rotinas da sua unidade" ON public.routines
  FOR ALL USING (public.is_unit_manager(auth.uid(), unit_id));

CREATE POLICY "Usuario pode ver rotinas da sua unidade" ON public.routines
  FOR SELECT USING (unit_id = public.get_user_unit_id(auth.uid()));

-- Tasks
CREATE POLICY "Admin pode gerenciar todas tarefas" ON public.tasks
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Gestor pode gerenciar tarefas da sua unidade" ON public.tasks
  FOR ALL USING (public.is_unit_manager(auth.uid(), unit_id));

CREATE POLICY "Usuario pode ver tarefas da sua unidade" ON public.tasks
  FOR SELECT USING (unit_id = public.get_user_unit_id(auth.uid()));

CREATE POLICY "Usuario pode atualizar tarefas atribuidas a ele" ON public.tasks
  FOR UPDATE USING (assigned_to = auth.uid());

-- Subtasks
CREATE POLICY "Admin pode gerenciar todas subtarefas" ON public.subtasks
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Gestor pode gerenciar subtarefas da sua unidade" ON public.subtasks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.tasks t 
      WHERE t.id = task_id AND public.is_unit_manager(auth.uid(), t.unit_id)
    )
  );

CREATE POLICY "Usuario pode ver subtarefas da sua unidade" ON public.subtasks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tasks t 
      WHERE t.id = task_id AND t.unit_id = public.get_user_unit_id(auth.uid())
    )
  );

CREATE POLICY "Usuario pode atualizar subtarefas das suas tarefas" ON public.subtasks
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.tasks t 
      WHERE t.id = task_id AND t.assigned_to = auth.uid()
    )
  );

-- Google Calendar Tokens
CREATE POLICY "Usuario pode gerenciar seus tokens" ON public.google_calendar_tokens
  FOR ALL USING (user_id = auth.uid());

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_units_updated_at BEFORE UPDATE ON public.units
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_routines_updated_at BEFORE UPDATE ON public.routines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_google_calendar_tokens_updated_at BEFORE UPDATE ON public.google_calendar_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para criar perfil automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email)
  );
  
  -- Atribuir role padrão de usuario
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'usuario');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Índices para performance
CREATE INDEX idx_profiles_unit_id ON public.profiles(unit_id);
CREATE INDEX idx_routines_unit_id ON public.routines(unit_id);
CREATE INDEX idx_tasks_unit_id ON public.tasks(unit_id);
CREATE INDEX idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_tasks_due_date ON public.tasks(due_date);
CREATE INDEX idx_subtasks_task_id ON public.subtasks(task_id);
CREATE INDEX idx_unit_managers_user_id ON public.unit_managers(user_id);
CREATE INDEX idx_unit_managers_unit_id ON public.unit_managers(unit_id);