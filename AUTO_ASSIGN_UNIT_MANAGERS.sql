-- Automatização de Responsáveis por Unidade (Tasks Futuras)
-- Objetivo: Sincronizar inserções e remoções na tabela `unit_managers` com as `tasks` futuras correspondentes daquela unidade.

-- 1. Função e Trigger para quando um Responsável é ADICIONADO (INSERT)
CREATE OR REPLACE FUNCTION handle_unit_manager_insert()
RETURNS TRIGGER AS $$
BEGIN
    -- 1.1 Inserir o novo usuário na tabela task_assignees para todas as tarefas futuras daquela unidade
    INSERT INTO task_assignees (task_id, user_id)
    SELECT id, NEW.user_id
    FROM tasks
    WHERE unit_id = NEW.unit_id
      AND due_date >= CURRENT_DATE
    ON CONFLICT (task_id, user_id) DO NOTHING;

    -- 1.2 Atualizar também a coluna `assigned_to` legada (para garantir retrocompatibilidade com hooks antigos)
    UPDATE tasks
    SET assigned_to = NEW.user_id
    WHERE unit_id = NEW.unit_id
      AND due_date >= CURRENT_DATE;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_unit_manager_insert ON unit_managers;
CREATE TRIGGER trigger_unit_manager_insert
AFTER INSERT ON unit_managers
FOR EACH ROW
EXECUTE FUNCTION handle_unit_manager_insert();


-- 2. Função e Trigger para quando um Responsável é REMOVIDO (DELETE)
CREATE OR REPLACE FUNCTION handle_unit_manager_delete()
RETURNS TRIGGER AS $$
DECLARE
    next_manager_id UUID;
BEGIN
    -- 2.1 Remover o usuário deletado da tabela task_assignees em todas as tarefas futuras daquela unidade
    DELETE FROM task_assignees
    WHERE user_id = OLD.user_id
      AND task_id IN (
          SELECT id FROM tasks 
          WHERE unit_id = OLD.unit_id 
            AND due_date >= CURRENT_DATE
      );

    -- 2.2 Tentar encontrar SE existe algum outro gerente restante para a mesma unidade (caso a unidade tivesse 2 gerentes)
    SELECT user_id INTO next_manager_id
    FROM unit_managers
    WHERE unit_id = OLD.unit_id
    LIMIT 1;

    -- 2.3 Atualizar a coluna `assigned_to` na tabela tasks das tarefas futuras. 
    -- Se havia outro gerente, passa a bola para ele. Se era o único, fica NULL.
    UPDATE tasks
    SET assigned_to = next_manager_id
    WHERE unit_id = OLD.unit_id
      AND assigned_to = OLD.user_id
      AND due_date >= CURRENT_DATE;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_unit_manager_delete ON unit_managers;
CREATE TRIGGER trigger_unit_manager_delete
AFTER DELETE ON unit_managers
FOR EACH ROW
EXECUTE FUNCTION handle_unit_manager_delete();
