-- LIMPEZA_DUPLICATAS.sql
-- Este script identifica e apaga tarefas filhas duplicadas exatas para a unidade Barreiras.

BEGIN;

-- Identifica tarefas que possuem exatamente o mesmo title, mesmo unit_id, e mesma due_date, 
-- mantendo apenas a tarefa com o ID mínimo (a mais antiga/original).
WITH duplicates AS (
    SELECT id, 
           ROW_NUMBER() OVER (
               PARTITION BY title, unit_id, due_date::date 
               ORDER BY created_at ASC
           ) as rn
    FROM tasks
    WHERE status = 'pendente'
      AND due_date >= CURRENT_DATE
      AND title ILIKE '%Check de Disponibilidade%'
)
DELETE FROM tasks 
WHERE id IN (
    SELECT id FROM duplicates WHERE rn > 1
);

COMMIT;
