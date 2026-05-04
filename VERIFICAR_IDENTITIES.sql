-- VERIFICAR IDENTIDADES (O ULTIMO SUSPEITO)
-- O Supabase Auth (GoTrue) exige que todo usuário tenha uma linha na tabela `auth.identities`.
-- Usuários criados via SQL incompleto muitas vezes não tem essa linha.

SELECT 
    u.email, 
    count(i.id) as identities_count
FROM auth.users u
LEFT JOIN auth.identities i ON u.id = i.user_id
WHERE u.email IN ('teste.2@sirtec.com.br', 'felipe.moura@sirtec.com.br')
GROUP BY u.email;
