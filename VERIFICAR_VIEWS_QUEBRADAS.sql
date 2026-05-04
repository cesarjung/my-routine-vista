-- DIAGNÓSTICO DE VIEWS QUEBRADAS E PERMISSÕES DE SEQUÊNCIA
-- Se houver uma "View" quebrada no banco, o sistema de login pode falhar ao tentar ler o schema.

-- 1. Funçao para testar views
DO $$
DECLARE
    r RECORD;
    v_count INT;
BEGIN
    RAISE NOTICE 'Iniciando verificação de VIEWS no schema public...';
    FOR r IN (SELECT table_name FROM information_schema.views WHERE table_schema = 'public') LOOP
        BEGIN
            EXECUTE 'SELECT 1 FROM public."' || r.table_name || '" LIMIT 1';
        EXCEPTION WHEN OTHERS THEN
            RAISE EXCEPTION 'ERRO GRAVE: A View "%" está QUEBRADA! Isso impede o login. Detalhe: %', r.table_name, SQLERRM;
        END;
    END LOOP;
    RAISE NOTICE 'Todas as Views parecem saudáveis.';
END $$;

-- 2. Correção Preventiva: Permissões em Sequências (IDs automáticos)
-- Às vezes o user consegue ler a tabela, mas não consegue gerar o próximo ID.
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA auth TO supabase_auth_admin;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO supabase_auth_admin;

-- 3. Correção Preventiva: Garantir acesso à tabela schema_migrations (se existir)
DO $$
BEGIN
    GRANT SELECT ON TABLE supabase_migrations.schema_migrations TO supabase_auth_admin;
EXCEPTION WHEN OTHERS THEN
    NULL; -- Ignora se não existir
END $$;

-- 4. Recarregar config
NOTIFY pgrst, 'reload config';

SELECT 'Diagnóstico concluído. Se não houve erro vermelho, as views estão OK.' as status;
