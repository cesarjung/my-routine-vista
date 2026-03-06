-- Quais setores essas rotinas realmente pertencem no banco?
SELECT r.title, s.name as sector_name 
FROM public.routines r 
LEFT JOIN public.sectors s ON r.sector_id = s.id 
WHERE r.title IN ('Checkpoint Diário', 'Boletim de Produtividade', 'Check de Disponibilidade');

-- Por que Livramento ficou de fora de Check de Disponibilidade?
-- A rotina Check de Disponibilidade (title) tem alguém de Livramento (nome da unit com '%Livramento%') 
-- dentre seus assignees?
SELECT p.full_name, u.name as unit_name
FROM public.routine_assignees ra
JOIN public.routines r ON ra.routine_id = r.id
JOIN public.profiles p ON ra.user_id = p.id
JOIN public.units u ON p.unit_id = u.id
WHERE r.title = 'Check de Disponibilidade'
AND u.name ILIKE '%Livramento%';
