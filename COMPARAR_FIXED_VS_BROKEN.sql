-- COMPARAÇÃO FINAL: O QUE O "TESTE.2" TEM QUE O "FELIPE" NÃO TEM?
-- O teste.2 foi recriado pelo painel e funciona. O Felipe foi criado via SQL e não funciona.
-- Se acharmos a diferença, podemos salvar o Felipe sem deletar (e sem perder as tarefas dele).

SELECT 
    email,
    -- Comparar metadados
    raw_app_meta_data,
    raw_user_meta_data,
    -- Comparar status
    is_sso_user,
    email_confirmed_at IS NOT NULL as email_ok,
    invited_at IS NOT NULL as invited,
    -- Comparar tokens (já sabemos que estão vazios, mas conferindo)
    confirmation_token,
    recovery_token,
    -- Comparar criptografia (só o inicio)
    left(encrypted_password, 10) as pass_prefix
FROM auth.users 
WHERE email IN ('teste.2@sirtec.com.br', 'felipe.moura@sirtec.com.br');
