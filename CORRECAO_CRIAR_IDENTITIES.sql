-- CORREÇÃO FINAL: CRIAR IDENTIDADES FALTANTES
-- Se a correção de metadata não funcionou, é porque falta a linha na tabela `auth.identities`.
-- Este script cria a identidade de 'email' para quem não tem.

INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
)
SELECT 
    id, -- Usamos o próprio ID do usuário como ID da identidade (padrão Supabase para email)
    id,
    email, -- provider_id para email é o email
    jsonb_build_object('sub', id, 'email', email, 'email_verified', true),
    'email',
    now(),
    now(),
    now()
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM auth.identities i WHERE i.user_id = u.id);

SELECT count(*) as identidades_criadas FROM auth.identities WHERE created_at > now() - interval '1 minute';
