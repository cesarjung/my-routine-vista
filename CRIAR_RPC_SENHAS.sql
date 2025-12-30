-- FUNÇÃO RPC PARA ADMIN ALTERAR SENHA
-- Cria uma função segura no banco que permite admins trocarem senhas de outros usuários.
-- Substitui a necessidade de Edge Functions complexas.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

create or replace function admin_update_password(
  target_user_id uuid,
  new_password text
)
returns void
language plpgsql
security definer -- Roda com poderes de superusuário (cuidado!)
as $$
declare
  caller_role text;
begin
  -- 1. Verificar se quem está chamando é admin ou gestor
  select role into caller_role
  from public.profiles
  where id = auth.uid();

  if caller_role not in ('admin', 'gestor') then
     raise exception 'Apenas administradores podem alterar senhas de outros usuários.';
  end if;

  -- 2. Atualizar a senha direto na tabela auth (usando pgcrypto)
  update auth.users
  set encrypted_password = crypt(new_password, gen_salt('bf')),
      updated_at = now()
  where id = target_user_id;

  -- 3. Trigger opcional de log ou auditoria poderia vir aqui
end;
$$;
