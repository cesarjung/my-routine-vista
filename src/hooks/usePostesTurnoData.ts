import { useMemo } from 'react';
import { usePlanejamentoRaw } from './usePlanejamentoRaw';
import { parse, isValid, startOfDay, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { UNIDADES_PLANEJAMENTO } from '@/constants/unidades';

export interface PosteTurnoRow {
  id: string;
  unidadeId: string;
  unidadeNome: string;
  dataParsed: Date;
  mesAno: string; // ex: 'Jan 2026'
  mesCurto: string; // ex: 'Jan'
  supervisor: string;
  equipe: string;
  projeto: string;
  valPlanTurno: number; // Coluna U (index 20)
  valProdTurno: number; // Coluna AM (index 38)
  valProgTurno: number; // Coluna AQ (index 42)
}

export const usePostesTurnoData = (selectedUnidadesIds: string[]) => {
  const rawQuery = usePlanejamentoRaw(selectedUnidadesIds);

  const parsedData = useMemo(() => {
    if (!rawQuery.data || !Array.isArray(rawQuery.data)) return [];
    
    try {
      const data: PosteTurnoRow[] = [];

      const parseNumber = (val: string) => {
        if (!val) return 0;
        const clean = String(val).replace(/[R$\s\.]/g, '').replace(',', '.');
        const num = Number(clean);
        return isNaN(num) ? 0 : num;
      };

      rawQuery.data.forEach(unidadeData => {
        const rows = unidadeData.principal;
        const unidadeInfo = UNIDADES_PLANEJAMENTO.find(u => u.id === unidadeData.unidadeId);
        const unidadeNome = unidadeInfo?.nome || unidadeData.unidadeId;

        for (let i = 7; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length < 43) continue; // Precisa ir até AQ (42)

          const dataStringFull = row[1]; // Coluna B
          const supervisor = row[4];     // Coluna E
          const equipe = row[6];         // Coluna G
          const projeto = row[7];        // Coluna H

          const valPlanTurno = parseNumber(row[20]); // Coluna U
          const valProdTurno = parseNumber(row[38]); // Coluna AM
          const valProgTurno = parseNumber(row[42]); // Coluna AQ

          const dataApenas = dataStringFull ? String(dataStringFull).split(' - ')[0].trim() : '';
          let dataParsed: Date | null = null;
          
          if (dataApenas) {
            const parsed = parse(dataApenas, 'dd/MM/yyyy', new Date());
            if (isValid(parsed)) {
              dataParsed = startOfDay(parsed);
            }
          }

          if (dataParsed) {
            const mesCurtoRaw = format(dataParsed, 'MMM', { locale: ptBR });
            const mesCurto = mesCurtoRaw.charAt(0).toUpperCase() + mesCurtoRaw.slice(1);
            const mesAno = format(dataParsed, 'MMM yyyy', { locale: ptBR });

            data.push({
              id: `${unidadeData.unidadeId}-${i}-${dataParsed.getTime()}`,
              unidadeId: unidadeData.unidadeId,
              unidadeNome,
              dataParsed,
              mesAno,
              mesCurto,
              supervisor: supervisor?.trim() || '',
              equipe: equipe?.trim() || '',
              projeto: projeto?.trim() || 'Sem Projeto',
              valPlanTurno,
              valProdTurno,
              valProgTurno
            });
          }
        }
      });

      // Ordenar por data crescente
      data.sort((a, b) => a.dataParsed.getTime() - b.dataParsed.getTime());
      
      return data;
    } catch (err) {
      console.error('Erro ao processar dados de poste_turno:', err);
      return [];
    }
  }, [rawQuery.data]);

  return {
    ...rawQuery,
    data: parsedData,
  };
};
