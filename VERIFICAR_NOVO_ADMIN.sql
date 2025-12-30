-- DIAGNÓSTICO DO ADMIN RECUPERADO 🩺
-- Você recriou o Cesar, mas ele não loga. Vamos ver os dados dele.

SELECT 
    id, 
    email, 
    raw_app_meta_data, 
    instance_id, 
    aud, 
    role,
    confirmation_token,
    email_confirmed_at
FROM auth.users 
WHERE email = 'cesar.jung@sirtec.com.br';

-- Verificar Identidades
SELECT * FROM auth.identities WHERE email = 'cesar.jung@sirtec.com.br';

-- Verificar Instância Correta (Se houver)
SELECT * FROM auth.instances;
