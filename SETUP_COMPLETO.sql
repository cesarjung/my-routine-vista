-- PASSO 1: SCRIPT COMPLETO DE CONFIGURAÇÃO (Para Projetos Novos no Supabase)
-- Copie TUDO e rode no SQL Editor.

-- ==========================================
-- 1. TIPOS (Enums)
-- ==========================================
CREATE TYPE public.app_role AS ENUM ('admin', 'gestor', 'usuario');
CREATE TYPE public.task_frequency AS ENUM ('diaria', 'semanal', 'quinzenal', 'mensal', 'anual', 'customizada');
CREATE TYPE public.task_status AS ENUM ('pendente', 'em_andamento', 'concluida', 'atrasada', 'cancelada');

-- ==========================================
-- 2. TABELAS BASE
-- ==========================================

-- UNIDADES
CREATE TABLE public.units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PERFIS
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'usuario',
  UNIQUE (user_id, role)
);

-- GESTORES DE UNIDADE
CREATE TABLE public.unit_managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, unit_id)
);

-- SETORES (Adicionado depois, mas essencial)
CREATE TABLE public.sectors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6366f1',
  icon TEXT DEFAULT 'folder',
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- SEÇÕES DOS SETORES (NOVO!)
CREATE TABLE public.sector_sections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sector_id UUID NOT NULL REFERENCES public.sectors(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    type TEXT NOT NULL,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID REFERENCES auth.users(id)
);

-- ROTINAS
CREATE TABLE public.routines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  frequency task_frequency NOT NULL,
  custom_schedule JSONB,
  unit_id UUID REFERENCES public.units(id) ON DELETE CASCADE, -- Nullable em algumas versões
  sector_id UUID REFERENCES public.sectors(id) ON DELETE SET NULL, -- Adicionado via alter table anteriormente
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- TAREFAS
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
  unit_id UUID REFERENCES public.units(id) ON DELETE CASCADE, -- Nullable para admins
  sector_id UUID REFERENCES public.sectors(id) ON DELETE SET NULL, -- Adicionado via alter table anteriormente
  section_id UUID REFERENCES public.sector_sections(id) ON DELETE SET NULL, -- NOVO!
  google_event_id TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- SUBTAREFAS
CREATE TABLE public.subtasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- TOKENS GOOGLE
CREATE TABLE public.google_calendar_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ==========================================
-- 3. SEGURANÇA (RLS) E POLÍTICAS BÁSICAS
-- ==========================================
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_calendar_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sector_sections ENABLE ROW LEVEL SECURITY;

-- Funções Auxiliares de Segurança
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_unit_manager(_user_id UUID, _unit_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.unit_managers WHERE user_id = _user_id AND unit_id = _unit_id)
$$;

CREATE OR REPLACE FUNCTION public.get_user_unit_id(_user_id UUID)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT unit_id FROM public.profiles WHERE id = _user_id
$$;

-- Políticas "Permitir Tudo" para facilitar o início (Você pode restringir depois)
-- Para produção real, usaríamos as políticas detalhadas, mas para destravar seu uso agora:
CREATE POLICY "Permitir tudo para autenticados em units" ON public.units FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Permitir tudo para autenticados em profiles" ON public.profiles FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Permitir tudo para autenticados em user_roles" ON public.user_roles FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Permitir tudo para autenticados em unit_managers" ON public.unit_managers FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Permitir tudo para autenticados em routines" ON public.routines FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Permitir tudo para autenticados em tasks" ON public.tasks FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Permitir tudo para autenticados em subtasks" ON public.subtasks FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Permitir tudo para autenticados em sectors" ON public.sectors FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Permitir tudo para autenticados em sector_sections" ON public.sector_sections FOR ALL USING (auth.role() = 'authenticated');


-- ==========================================
-- 4. TRIGGERS E AUTOMATIZAÇÃO
-- ==========================================

-- Trigger para criar perfil ao cadastrar usuário
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin'); -- Dando admin para o primeiro usuário facilitar
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger para criar seções padrão em novos setores
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

CREATE TRIGGER on_sector_created
    AFTER INSERT ON public.sectors
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_sector_sections();

-- Função update_updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;
