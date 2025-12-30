-- VERIFICAR PERFIL DO USUÁRIO 🕵️‍♂️
-- Vamos ver como o banco está enxergando seu usuário (profiles).

SELECT id, email, role, full_name, unit_id
FROM public.profiles
WHERE email = 'cesar.jung@sirtec.com.br';
