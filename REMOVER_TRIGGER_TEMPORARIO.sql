-- REMOVER TRIGGER TEMPORARIAMENTE (VERSÃO CORRIGIDA)
-- Vamos desativar o mecanismo que cria perfil automático.
-- Se o login funcionar depois disso, sabemos que o problema ERA o trigger.

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Limpeza extra (garantir que não tem nada pendurado)
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- Mensagem de Confirmação (formato compatível)
SELECT 'Trigger de criação de perfil removido com sucesso. Pode testar o login.' as status;
