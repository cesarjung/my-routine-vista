-- Correção: Permitir que a chave anon escreva na tabela atividades_por_ponto
-- (mesmo padrão usado em materiais_por_ponto)

-- Opção A: Desabilitar RLS completamente (igual a materiais_por_ponto se for o caso)
ALTER TABLE public.atividades_por_ponto DISABLE ROW LEVEL SECURITY;

-- OU Opção B: Adicionar policy de escrita para anon (mais seguro)
-- DROP POLICY IF EXISTS "Allow anon write atividades_por_ponto" ON public.atividades_por_ponto;
-- CREATE POLICY "Allow anon write atividades_por_ponto"
--     ON public.atividades_por_ponto
--     FOR ALL
--     TO anon, authenticated
--     USING (true)
--     WITH CHECK (true);
