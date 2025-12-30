-- VERIFICAR STATUS DO USUÁRIO
-- Script para checar se o email existe na tabela de perfis e na autenticação

SELECT 
    p.id as profile_id, 
    p.email as profile_email, 
    p.full_name, 
    au.id as auth_id, 
    au.email as auth_email,
    au.created_at as auth_created_at
FROM 
    public.profiles p
LEFT JOIN 
    auth.users au ON p.id = au.id
WHERE 
    p.email = 'felipe.moura@sirtec.com.br'
OR 
    au.email = 'felipe.moura@sirtec.com.br';
