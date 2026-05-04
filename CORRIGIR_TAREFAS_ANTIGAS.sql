-- Script de correção manual para tarefas que foram replicadas com menos ou mais horas e caíram no dia anterior.
-- Utilize-o no SQL Editor do Supabase se desejar "empurrar" uma rotina ou dia inteiro de volta para o encaixe original.

-- EXEMPLO 1: Empurrar todas as tarefas (raiz e filhas) de uma rotina específica em 1 dia para a frente
-- Descomente as linhas abaixo e substitua 'SUA-ROUTINE-ID-AQUI'
/*
UPDATE public.tasks
SET 
  start_date = start_date + INTERVAL '1 day',
  due_date = due_date + INTERVAL '1 day'
WHERE routine_id = 'SUA-ROUTINE-ID-AQUI'
  AND (start_date AT TIME ZONE 'America/Sao_Paulo')::date = '2026-02-25'; -- Altere a data alvo se necessário
*/

-- EXEMPLO 2: Restaurar a HORA EXPERADA (08:00 as 09:00) se ela tiver se perdido
/*
UPDATE public.tasks
SET 
  start_date = (start_date::date + TIME '08:00:00') AT TIME ZONE 'America/Sao_Paulo',
  due_date = (due_date::date + TIME '09:00:00') AT TIME ZONE 'America/Sao_Paulo'
WHERE routine_id = 'SUA-ROUTINE-ID-AQUI'
  AND is_recurring = true;
*/
