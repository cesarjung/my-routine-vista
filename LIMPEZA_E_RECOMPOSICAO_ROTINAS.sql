-- ============================================================================
-- SCRIPT DE LIMPEZA E PADRONIZAÇÃO DO SISTEMA DE ROTINAS (MY ROUTINE VISTA)
-- Execute este script no SQL Editor do seu painel do Supabase (https://supabase.com/dashboard)
-- ============================================================================

-- 1. Limpar registros de testes antigos mantendo integridade referencial
DELETE FROM public.routine_checkins;
DELETE FROM public.routine_periods;
DELETE FROM public.routine_assignees;

-- 2. Limpar tarefas de rotina antigas
DELETE FROM public.task_assignees WHERE task_id IN (SELECT id FROM public.tasks WHERE routine_id IS NOT NULL);
DELETE FROM public.subtasks WHERE task_id IN (SELECT id FROM public.tasks WHERE routine_id IS NOT NULL);
DELETE FROM public.tasks WHERE routine_id IS NOT NULL;

-- 3. Limpar tabela principal de rotinas
DELETE FROM public.routines;

-- 4. Garantir que a coluna is_active possua o valor padronizado DEFAULT true
ALTER TABLE public.routines ALTER COLUMN is_active SET DEFAULT true;

-- 5. Atualizar qualquer registro residual garantindo is_active = true
UPDATE public.routines SET is_active = true WHERE is_active IS NULL;

-- FIM DO SCRIPT DE LIMPEZA
