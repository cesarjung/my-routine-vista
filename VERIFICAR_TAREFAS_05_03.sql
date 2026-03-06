-- SCRIPT DE DIAGNÓSTICO PARA VER AS TAREFAS QUE SOBRARAM
-- Por favor, rode este script e me mande um print do resultado.
-- Ele vai nos mostrar exatamente quais tarefas sobraram no dia 05/03 que estão causando o visual "despadronizado"

SELECT 
    t.start_date::date as date,
    t.title,
    t.status,
    u.name as unit_name
FROM public.tasks t
LEFT JOIN public.units u ON t.unit_id = u.id
WHERE t.start_date >= '2026-03-05 00:00:00+00'
AND t.title LIKE '%Rotina%'
ORDER BY t.created_at DESC
LIMIT 30;
