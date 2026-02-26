-- Função para permitir que Admins atualizem o e-mail de usuários
CREATE OR REPLACE FUNCTION public.update_user_email_rpc(target_user_id uuid, new_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    is_admin boolean;
BEGIN
    -- Verifica se o usuário atual é admin
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role = 'admin'
    ) INTO is_admin;

    IF NOT is_admin THEN
        RAISE EXCEPTION 'Apenas administradores podem alterar o e-mail de outros usuários.';
    END IF;

    -- Atualiza o e-mail na tabela auth.users do Supabase
    -- Necessário privileges do SECURITY DEFINER (bypass RLS)
    UPDATE auth.users
    SET email = new_email,
        email_confirmed_at = now(),
        updated_at = now()
    WHERE id = target_user_id;
END;
$$;
