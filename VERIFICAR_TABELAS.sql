-- TESTE DE EXISTÊNCIA DE TABELAS
-- Por favor, copie e rode este código no seu banco de dados para listar todas as tabelas criadas no seu projeto atual.
-- Apenas copie o resultado que aparecer na tela e me envie.

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE '%routine%';
