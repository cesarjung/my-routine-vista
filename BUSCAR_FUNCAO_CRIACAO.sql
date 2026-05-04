-- PROCURANDO A FÁBRICA DEFEITUOSA 🏭
-- Vamos listar todas as funções do banco que têm "user" ou "create" no nome.

SELECT 
    routine_name, 
    external_language,
    -- Pegar o início da definição para ver o que faz
    left(routine_definition, 200) as definition_preview
FROM information_schema.routines 
WHERE routine_schema NOT IN ('pg_catalog', 'information_schema')
  AND (routine_name ILIKE '%user%' OR routine_name ILIKE '%create%')
ORDER BY routine_name;
