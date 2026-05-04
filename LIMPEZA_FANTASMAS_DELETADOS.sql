-- LIMPAR_TAREFAS_ROTINAS_DELETADAS.sql
-- Este script limpa permanentemente todas as tarefas, períodos e check-ins associados
-- a rotinas que foram excluídas (is_active = false) pelo usuário, para remover os 
-- "fantasmas" que aparecem no Dashboard.

BEGIN;

-- 1. Identificar as rotinas deletadas
WITH deleted_routines AS (
    SELECT id FROM routines WHERE is_active = false
)
-- 2. Deletar as tarefas pendentes dessas rotinas
DELETE FROM tasks 
WHERE routine_id IN (SELECT id FROM deleted_routines)
AND status = 'pendente';

-- Garantir que as periods futuras e checkins também sejam deletados
WITH deleted_routines AS (
    SELECT id FROM routines WHERE is_active = false
)
DELETE FROM routine_periods
WHERE routine_id IN (SELECT id FROM deleted_routines)
AND period_start >= CURRENT_DATE;

COMMIT;

-- Mostra quantas tarefas sobraram (para verificação)
SELECT count(*) as total_ghosts_remaining
FROM tasks t
JOIN routines r ON t.routine_id = r.id
WHERE r.is_active = false AND t.status = 'pendente';
