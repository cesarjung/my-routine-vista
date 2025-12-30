-- RPC PARA CONFIRMAR EMAIL (SUPPORT PARA O frontend) 📧✅
-- Como vamos criar usuários via API (signUp), precisamos de uma função 
-- para o Admin confirmar o email deles automaticamente pelo painel.

CREATE OR REPLACE FUNCTION public.confirm_user_email(target_email text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_user_id uuid;
BEGIN
  -- Busca o ID do usuário
  SELECT id INTO v_user_id FROM auth.users WHERE email = target_email;
  
  IF v_user_id IS NULL THEN
    RETURN json_build_object('error', 'Usuário não encontrado');
  END IF;

  -- Atualiza confirmação
  UPDATE auth.users 
  SET email_confirmed_at = now(),
      confirmed_at = now()
  WHERE id = v_user_id;

  RETURN json_build_object('success', true, 'id', v_user_id);
END;
$function$;
