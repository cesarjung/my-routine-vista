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

      const promises = selectedUnidadesIds.map(async (unidadeId) => {
        const url = `${API_URL}?token=${SECRET_TOKEN}&id=${unidadeId}&sheets=Carteira_Planejador,Plan_Principal,BD_Metas,Reprogramadas,Base_Curva,BD_Config`;
        const res = await fetch(url);
        const data = await res.json();
        
        if (!data.success) {
          console.error(`Falha ao baixar abas da unidade ${unidadeId}`, data.error);
          return null;
        }

        const payload = {
          unidade_id: unidadeId,
          carteira: data.data.Carteira_Planejador || [],
          principal: data.data.Plan_Principal || [],
          bd_metas: {
            bd_metas: data.data.BD_Metas || [],
            base_curva: data.data.Base_Curva || [],
            bd_config: data.data.BD_Config || []
          },
          reprogramadas: data.data.Reprogramadas || [],
          updated_at: new Date().toISOString()
        };

        const { error } = await supabase
          .from('planejamento_cache')
          .upsert(payload);

        if (error) {
          console.error(`Falha ao gravar no Supabase para ${unidadeId}`, error);
          throw error;
        }
        
        return payload;
      });

      await Promise.all(promises);
      return selectedUnidadesIds;
    },
    onSuccess: () => {
      toast.success('Dados sincronizados com o Google Sheets!');
      queryClient.invalidateQueries({ queryKey: ['planejamento_raw_v3'] });
    },
    onError: (error) => {
      toast.error('Erro ao sincronizar dados com o Google Sheets.');
      console.error(error);
    }
  });
};
