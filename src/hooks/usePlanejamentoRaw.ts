import { useQuery } from '@tanstack/react-query';

const API_URL = 'https://script.google.com/macros/s/AKfycbxn-YpuZZsNsdGT_FxQdhUwLE5KUIuXvo7Ffad03x80LByig3qneNe7-hy9PUZYS8-bDg/exec';
const SECRET_TOKEN = 'sirtec_vista_2026_seguro';

export interface RawUnidadeData {
  unidadeId: string;
  carteira: string[][];
  principal: string[][];
}

export const usePlanejamentoRaw = (selectedUnidadesIds: string[]) => {
  return useQuery({
    queryKey: ['planejamento_raw', selectedUnidadesIds],
    queryFn: async () => {
      if (!selectedUnidadesIds || selectedUnidadesIds.length === 0) return [];

      const promises = selectedUnidadesIds.map(async (unidadeId) => {
        // Agora buscamos as DUAS abas numa requisição só (reduz 50% do tráfego)
        const url = `${API_URL}?token=${SECRET_TOKEN}&id=${unidadeId}&sheets=Carteira_Planejador,Plan_Principal`;
        const res = await fetch(url);
        const data = await res.json();
        
        if (!data.success) {
          console.error(`Falha ao baixar abas da unidade ${unidadeId}`, data.error);
          return null;
        }

        return {
          unidadeId,
          carteira: data.data.Carteira_Planejador || [],
          principal: data.data.Plan_Principal || []
        } as RawUnidadeData;
      });

      const results = await Promise.all(promises);
      return results.filter(r => r !== null) as RawUnidadeData[];
    },
    // Cache dura 5 minutos. Se trocar de aba (Carteira -> Equipes), não refaz download.
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2
  });
};
