-- INSTALAR RPC E CONFIRMAR USUÁRIO (CORRIGIDO) ✅
-- A coluna confirmed_at é gerada automaticamente, então só precisamos atualizar email_confirmed_at.

-- 1. Cria a função de confirmação (para os próximos usuários)
CREATE OR REPLACE FUNCTION public.confirm_user_email(target_email text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = target_email;
  
  IF v_user_id IS NULL THEN
    RETURN json_build_object('error', 'Usuário não encontrado');
  END IF;

  -- Apenas email_confirmed_at
  UPDATE auth.users 
  SET email_confirmed_at = now()
  WHERE id = v_user_id;

  RETURN json_build_object('success', true, 'id', v_user_id);
END;
$function$;

-- 2. Confirma manualmente o usuário que você acabou de criar (Teste Final)
UPDATE auth.users 
SET email_confirmed_at = now()
WHERE email = 'teste.final@sirtec.com.br';
