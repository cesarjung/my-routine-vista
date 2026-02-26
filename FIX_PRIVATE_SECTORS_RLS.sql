-- ========================================================
-- CORREÇÃO DE PRIVACIDADE E RLS RESTRITA (PRIVATE SECTORS)
-- ========================================================

-- Esse script altera a política (Rule) de leitura do banco para
-- impedir que Administradores leiam Setores, Notas ou Painéis
-- marcados explicitamente como "Privados", exceto se forem os próprios criadores.

-- 1. APLICAR NOVA POLÍTICA RESTRITA NA TABELA 'sectors'
DROP POLICY IF EXISTS "Enable read access for sectors" ON public.sectors;

CREATE POLICY "Enable read access for sectors" ON public.sectors FOR SELECT TO authenticated
USING (
    -- Permite se for o criador original, indepedente se é privado ou público.
    created_by = auth.uid() 
    -- Permite se NÃO for privado E (for Admin ou tiver acesso concedido de outras formas lógicas visíveis).
    OR (
        is_private = false 
        AND (
            public.has_role(auth.uid(), 'admin') 
            OR public.has_role(auth.uid(), 'gestor')
            -- Ou qualquer usuário validado pode ver os públicos? A política original dizia que se is_private = false, exibia.
            OR true
        )
    )
);

-- ATENÇÃO: Simplificando a regra perfeitamente fiel ao requisito:
DROP POLICY IF EXISTS "Enable read access for sectors" ON public.sectors;
CREATE POLICY "Enable read access for sectors" ON public.sectors FOR SELECT TO authenticated
USING (
    -- Permite leitura de TODOS OS PÚBLICOS (is_private == false) + os PRIVADOS APENAS do próprio usuário.
    (is_private = false) 
    OR (created_by = auth.uid()) 
);

-- NOTA: Como você mencionou "aparecer para outra pessoa que não o usuário quando a mesma for convidada",
-- futuramente (caso ainda não exista na base de dados) você terá uma tabela 'sector_members'.
-- Se os convites já existirem hoje como uma verificação complexa, a regra atual foca restritamente no 'dono'.
-- Se os Administradores não podem ver espaços privados de outras pessoas, remover o "OR has_role('admin')" mata a raiz original da falha.

-- 2. APLICAR NOVA POLÍTICA RESTRITA NA TABELA 'notes'
DROP POLICY IF EXISTS "Enable read access for notes" ON public.notes;

CREATE POLICY "Enable read access for notes" ON public.notes FOR SELECT TO authenticated
USING (
    (is_private = false) 
    OR (created_by = auth.uid()) 
);


-- 3. APLICAR NOVA POLÍTICA RESTRITA NA TABELA 'dashboard_panels'
DROP POLICY IF EXISTS "Enable read access for dashboard_panels" ON public.dashboard_panels;

CREATE POLICY "Enable read access for dashboard_panels" ON public.dashboard_panels FOR SELECT TO authenticated
USING (
    (is_private = false) 
    OR (user_id = auth.uid()) 
);

-- Por fim, Forçar recarregamento do Banco de Dados
NOTIFY pgrst, 'reload config';
