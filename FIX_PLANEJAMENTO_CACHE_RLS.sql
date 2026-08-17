-- Execute este comando no SQL Editor do Supabase (https://supabase.com/dashboard)
-- para corrigir as permissões de RLS da tabela planejamento_cache e permitir
-- que o bot de sincronização local atualize os dados corretamente.

-- Habilita RLS na tabela planejamento_cache
ALTER TABLE planejamento_cache ENABLE ROW LEVEL SECURITY;

-- Remove políticas antigas se existirem para evitar conflitos
DROP POLICY IF EXISTS "Allow public read planejamento_cache" ON planejamento_cache;
DROP POLICY IF EXISTS "Allow public write planejamento_cache" ON planejamento_cache;
DROP POLICY IF EXISTS "Allow public insert planejamento_cache" ON planejamento_cache;
DROP POLICY IF EXISTS "Allow public delete planejamento_cache" ON planejamento_cache;
DROP POLICY IF EXISTS "Enable read access for all users" ON planejamento_cache;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON planejamento_cache;

-- Cria uma política permissiva para leitura pública (SELECT)
CREATE POLICY "Allow public read planejamento_cache" ON public.planejamento_cache
  FOR SELECT USING (true);

-- Cria uma política permissiva para escrita pública total (INSERT, UPDATE, DELETE)
-- de forma que o sync_bot.py (usando a chave anon) consiga atualizar o cache.
CREATE POLICY "Allow public write planejamento_cache" ON public.planejamento_cache
  FOR ALL USING (true) WITH CHECK (true);
