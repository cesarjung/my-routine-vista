-- SIMULAÇÃO DE PERMISSÃO DO AUTH (DIAGNÓSTICO FINAL)
-- Vamos "fingir" ser o robô de autenticação para ver o erro exato que ele recebe.

-- 1. Arrumar o usuário teste.2 (para garantir que a senha é 123456 e está confirmado)
UPDATE auth.users 
SET encrypted_password = crypt('123456', gen_salt('bf')), 
    email_confirmed_at = now() 
WHERE email = 'teste.2@sirtec.com.br';

-- 2. TENTATIVA DE SIMULAÇÃO
-- ATENÇÃO: Se der erro "permission denied to set role", pule esta parte e me avise.
DO $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Mudar para o papel do Auth (se permitido)
    -- NOTA: No editor SQL do Supabase, você roda como 'postgres' (superuser), então deve permitir.
    SET ROLE supabase_auth_admin; 
    
    RAISE NOTICE 'Sou o Auth Admin agora. Testando leitura...';
    
    -- Teste de Leitura
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'teste.2@sirtec.com.br';
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Auth Admin não consegue LER a tabela users!';
    END IF;
    
    RAISE NOTICE 'Leitura OK. Testando escrita (Login)...';
    
    -- Teste de Escrita (Simulando Login)
    UPDATE auth.users SET last_sign_in_at = now() WHERE id = v_user_id;
    
    RAISE NOTICE 'Escrita OK! O problema não deve ser permissão básica na users.';

    -- Teste de criação de sessão (Simulando Login completo)
    -- Apenas um insert fake que vai falhar por FK, mas queremos ver se falha por PERMISSÃO
    BEGIN
        INSERT INTO auth.sessions (id, user_id, created_at, updated_at) 
        VALUES (gen_random_uuid(), v_user_id, now(), now());
    EXCEPTION 
        WHEN foreign_key_violation THEN
             RAISE NOTICE 'Teste de Sessão: Passou da permissão (deu FK, normal).';
        WHEN OTHERS THEN
             -- Se der erro de permissão, vai cair aqui com a mensagem real
             RAISE NOTICE 'Teste de Sessão FALHOU: %', SQLERRM;
    END;

    -- Voltar ao normal
    RESET ROLE;
EXCEPTION
    WHEN OTHERS THEN
        RESET ROLE; -- Garantir que volta
        RAISE EXCEPTION 'A SIMULAÇÃO FALHOU: %', SQLERRM;
END $$;

SELECT 'Se você viu "A SIMULAÇÃO FALHOU", me mande o erro vermelho.' as status;
