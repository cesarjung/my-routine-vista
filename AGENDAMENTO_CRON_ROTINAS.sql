-- =========================================================================================
-- SCRIPT DE AGENDAMENTO AUTOMÁTICO DE ROTINAS (CRON JOB) NO SUPABASE
-- =========================================================================================
-- Problema: "As tarefas não estão sendo geradas um dia antes sozinhas".
-- Motivo: A Edge Function 'process-recurring-tasks' que foi construída no projeto não estava
--         sendo ativada por nenhum "relógio" contínuo (Cron Job) no banco de dados. 
--
-- SOLUÇÃO: Rodar este SQL no painel "SQL Editor" do seu Supabase em Produção.
-- ATENÇÃO: Substitua as chaves abaixo com os dados REAIS do seu projeto.
-- =========================================================================================

-- 1. Certifique-se de que a extensão de CRON e Requests HTTP estão ativas
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2. Crie o Job de Agendamento. Por padrão, deixamos para rodar todo dia à meia noite ("0 0 * * *").
-- Substitua <SUA_URL_DO_PROJETO> pela URL base do seu Supabase (ex: https://abccomp.supabase.co)
-- Substitua <SUA_CHAVE_SERVICE_ROLE> pela chave 'service_role' (encontrada nas configurações de API do Supabase).

SELECT cron.schedule(
  'job-processador-de-rotinas',
  '0 0 * * *',  -- Todo dia à meia noite (Pode mudar para '0 * * * *' para rodar toda hora)
  $$
    SELECT net.http_post(
        url:='<SUA_URL_DO_PROJETO>/functions/v1/process-recurring-tasks',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer <SUA_CHAVE_SERVICE_ROLE>"}'::jsonb
    ) as request_id;
  $$
);

-- DICA: Se precisar DELETAR esse Cron no futuro, você pode rodar:
-- SELECT cron.unschedule('job-processador-de-rotinas');
