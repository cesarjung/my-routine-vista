-- HABILITAR REALTIME (ATUALIZAÇÃO AUTOMÁTICA) 📡
-- O Supabase precisa que a gente autorize explicitamente quais tabelas enviam notificações.

BEGIN;

  -- 1. Adicionar tabelas à publicação 'supabase_realtime'
  alter publication supabase_realtime add table public.tasks;
  alter publication supabase_realtime add table public.routines;
  alter publication supabase_realtime add table public.routine_checkins;
  alter publication supabase_realtime add table public.subtasks; -- Faltou essa

COMMIT;

-- Verificar se deu certo (deve listar as tabelas)
select * from pg_publication_tables where pubname = 'supabase_realtime';
