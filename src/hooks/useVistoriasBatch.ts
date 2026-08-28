import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { parseVistoriaData, RiskResult } from '@/hooks/usePcpAiPlanner';

/**
 * Busca e parseia vistorias de múltiplas obras de uma só vez.
 * Retorna um mapa obra_id → RiskResult.
 */
export function useVistoriasBatch(obraIds: string[]) {
  return useQuery({
    queryKey: ['vistorias_batch', obraIds.sort().join(',')],
    queryFn: async (): Promise<Record<string, RiskResult>> => {
      if (!obraIds.length) return {};

      const results: Record<string, RiskResult> = {};
      const cleanIds = obraIds.map(id => String(id).trim());
      const numIds = cleanIds.map(id => id.replace(/\D/g, ''));
      const allSearchIds = [...new Set([...cleanIds, ...numIds, ...numIds.map(n => `B-${n}`)])];

      // 1. Tenta vistorias_formulario (batch)
      try {
        const orClause = allSearchIds.map(id => `obra_id.eq.${id}`).join(',');
        const { data: formRows } = await supabase
          .from('vistorias_formulario' as any)
          .select('*')
          .or(orClause);

        if (formRows && formRows.length > 0) {
          for (const row of formRows) {
            const obraKey = cleanIds.find(id => {
              const num = id.replace(/\D/g, '');
              return row.obra_id === id || row.obra_id === num || row.obra_id === `B-${num}`;
            }) || row.obra_id;
            if (!results[obraKey]) {
              results[obraKey] = parseVistoriaData(row, row.obs_planejamento, []);
            }
          }
        }
      } catch {
        // Tabela pode não existir ainda
      }

      // 2. Fallback para realizadas_vistoria (obras que não tinham formulário)
      const missing = cleanIds.filter(id => !results[id]);
      if (missing.length > 0) {
        const missingNums = missing.map(id => id.replace(/\D/g, ''));
        const missingSearch = [...new Set([...missing, ...missingNums, ...missingNums.map(n => `B-${n}`)])];
        const orClause2 = missingSearch.map(id => `obra_id.eq.${id}`).join(',');

        try {
          const { data: realRows } = await supabase
            .from('realizadas_vistoria' as any)
            .select('obra_id, observacoes_vistoria, risk_tags')
            .or(orClause2);

          if (realRows && realRows.length > 0) {
            for (const row of realRows) {
              const obraKey = missing.find(id => {
                const num = id.replace(/\D/g, '');
                return row.obra_id === id || row.obra_id === num || row.obra_id === `B-${num}`;
              }) || row.obra_id;
              if (!results[obraKey]) {
                results[obraKey] = parseVistoriaData(null, row.observacoes_vistoria, row.risk_tags || []);
              }
            }
          }
        } catch {
          // Tabela pode não existir
        }
      }

      return results;
    },
    enabled: obraIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}
