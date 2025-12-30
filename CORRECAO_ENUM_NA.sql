-- CORREÇÃO: ADICIONAR OPÇÃO 'nao_aplicavel' AO STATUS
-- O erro 'invalid input value for enum task_status' indica que o banco não aceita "nao_aplicavel".

-- Adicionar o valor ao tipo ENUM de forma segura
DO $$
BEGIN
    ALTER TYPE task_status ADD VALUE 'nao_aplicavel';
EXCEPTION
    WHEN duplicate_object THEN null; -- Ignora se já existir
END $$;

-- Recarregar cache
NOTIFY pgrst, 'reload config';
