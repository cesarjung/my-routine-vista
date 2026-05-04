-- VERIFICAR BACKUPS E TABELAS 🕵️‍♂️
-- O erro diz que a tabela de backup sumiu. Vamos ver o que tem no banco.

SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public';
