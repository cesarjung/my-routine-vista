import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const API_URL = 'https://script.google.com/macros/s/AKfycbxn-YpuZZsNsdGT_FxQdhUwLE5KUIuXvo7Ffad03x80LByig3qneNe7-hy9PUZYS8-bDg/exec';
const SECRET_TOKEN = 'sirtec_vista_2026_seguro';

export interface RawUnidadeData {
  unidadeId: string;
  carteira: string[][];
  principal: string[][];
  bdMetas: string[][] | { bd_metas: string[][]; base_curva: string[][]; bd_config: string[][] };
  reprogramadas: string[][];
  lastUpdated?: string | null;
}

export const usePlanejamentoRaw = (selectedUnidadesIds: string[]) => {
  return useQuery({
    queryKey: ['planejamento_raw_v3', selectedUnidadesIds],
    queryFn: async () => {
      if (!selectedUnidadesIds || selectedUnidadesIds.length === 0) return [];

      const { data, error } = await supabase
        .from('planejamento_cache')
        .select('*')
        .in('unidade_id', selectedUnidadesIds);

      if (error) {
        console.error('Erro ao ler cache do Supabase:', error);
        throw error;
      }

      return selectedUnidadesIds.map(unidadeId => {
        const row = data?.find(d => d.unidade_id === unidadeId);
        if (!row) {
          // Retorna vazio caso a unidade ainda não tenha sido sincronizada
          return {
            unidadeId,
            carteira: [],
            principal: [],
            bdMetas: [],
            reprogramadas: [],
            lastUpdated: null,
          } as RawUnidadeData;
        }

        return {
          unidadeId: row.unidade_id,
          carteira: (row.carteira as unknown as string[][]) || [],
          principal: (row.principal as unknown as string[][]) || [],
          bdMetas: (row.bd_metas as unknown as any) || [],
          reprogramadas: (row.reprogramadas as unknown as string[][]) || [],
          lastUpdated: row.updated_at
        } as RawUnidadeData;
      });
    },
    // Cache de 5 minutos ainda é útil para evitar chamadas seguidas ao Supabase
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

export const useSyncPlanejamento = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (selectedUnidadesIds: string[]) => {
      if (!selectedUnidadesIds || selectedUnidadesIds.length === 0) return [];

      const results = [];
      const BATCH_SIZE = 3;

      for (let i = 0; i < selectedUnidadesIds.length; i += BATCH_SIZE) {
        const batch = selectedUnidadesIds.slice(i, i + BATCH_SIZE);
        
        const batchPromises = batch.map(async (unidadeId) => {
          try {
            const url = `${API_URL}?token=${SECRET_TOKEN}&id=${unidadeId}&sheets=Carteira_Planejador,Plan_Principal,BD_Metas,Reprogramadas,Base_Curva,BD_Config`;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout per req
            
            let res;
            try {
              res = await fetch(url, { signal: controller.signal });
            } catch (fetchErr) {
               clearTimeout(timeoutId);
               console.error(`Fetch timeout ou falha na unidade ${unidadeId}:`, fetchErr);
               return null;
            }
            clearTimeout(timeoutId);

            let data;
            try {
              data = await res.json();
            } catch (e) {
              console.error(`Falha JSON da unidade ${unidadeId}.`, e);
              return null;
            }
            
            if (!data || !data.success) {
              console.error(`Falha ao baixar abas da unidade ${unidadeId}`, data?.error);
              return null;
            }

            return { unidadeId, data };
          } catch (err) {
            console.error(`Erro ao processar unidade ${unidadeId}`, err);
            return null;
          }
        });

        // Espera o lote atual terminar antes de puxar o próximo
        const batchResults = await Promise.all(batchPromises);
          
        for (const item of batchResults) {
          if (!item) continue;
          
          const payload = {
            unidade_id: item.unidadeId,
            carteira: item.data.data.Carteira_Planejador || [],
            principal: item.data.data.Plan_Principal || [],
            bd_metas: {
              bd_metas: item.data.data.BD_Metas || [],
              base_curva: item.data.data.Base_Curva || [],
              bd_config: item.data.data.BD_Config || []
            },
            reprogramadas: item.data.data.Reprogramadas || [],
            updated_at: new Date().toISOString()
          };

          const { error } = await supabase
            .from('planejamento_cache')
            .upsert(payload);

          if (error) {
            console.error(`Falha ao gravar no Supabase para ${item.unidadeId}`, error);
          } else {
            results.push(payload);
          }
        }
      }

      if (results.length === 0) {
        throw new Error('Falha na comunicação com o Google Sheets. Demorou muito para responder.');
      }

      return results;
    },
    onSuccess: (data) => {
      toast.success(`Dados sincronizados com sucesso (${data.length} unidade(s))!`);
      queryClient.invalidateQueries({ queryKey: ['planejamento_raw_v3'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao sincronizar dados com o Google Sheets.');
      console.error(error);
    }
  });
};
