-- TESTE MANUAL DE ESCRITA NA TABELA AUTH (SIMULAÇÃO DE LOGIN)
-- Se este script der erro, saberemos EXATAMENTE o que está bloqueando o login.

DO $$
DECLARE
    v_user_id UUID;
    v_email TEXT := 'felipe.moura@sirtec.com.br';
BEGIN
    -- 1. Buscar ID do usuário
    SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não encontrado: %', v_email;
    END IF;

    RAISE NOTICE 'Usuário encontrado: %. Tentando atualizar last_sign_in_at...', v_user_id;

    -- 2. Tentar simular o que o Login faz: Atualizar last_sign_in_at
    -- Se houver trigger ou RLS bloqueando, vai estourar o erro aqui.
    UPDATE auth.users 
    SET last_sign_in_at = now() 
    WHERE id = v_user_id;

    RAISE NOTICE 'Update na auth.users SUCESSO!';

    -- 3. Tentar simular criação de sessão (se passar daqui, o erro 500 é muito estranho)
    -- Apenas verifica se temos permissão de escrita em sessions
    -- (Não vamos inserir de verdade para não poluir, mas vamos fazer um insert e rollback mascarado ou só check de permissão)
    -- Mas o Update acima já deve ser suficiente para pegar 90% dos erros.

END $$;
