import { useMemo } from 'react';
import { parse, isValid, startOfDay } from 'date-fns';
import { usePlanejamentoRaw } from './usePlanejamentoRaw';

export interface AtividadeProjeto {
  projeto: string;
  etapa: string;
  valorPlanejado: number;
  valorMeta: number;
  realizadoPlanejado: number;
  totalProduzido: number;
}

export interface EquipeAtividade {
  dataParsed: Date;
  atividades: AtividadeProjeto[];
}

export interface PlanejamentoEquipeRow {
  equipe: string;
  supervisor: string;
  atividadesDiarias: EquipeAtividade[];
  minDate: Date | null;
  maxDate: Date | null;
}

export const usePlanejamentoEquipesData = (selectedUnidadesIds: string[]) => {
  const rawQuery = usePlanejamentoRaw(selectedUnidadesIds);

  const parsedData = useMemo(() => {
    if (!rawQuery.data || !Array.isArray(rawQuery.data)) return [];
    
    try {
      const equipesMap: Record<string, {
        supervisor: string;
        atividades: Map<number, Set<string>>;
      }> = {};

      const parseCurrency = (val: string) => {
        if (!val) return 0;
        // Remove R$, espaços e pontos. Troca vírgula por ponto.
        const clean = val.replace(/[R$\s\.]/g, '').replace(',', '.');
        const num = Number(clean);
        return isNaN(num) ? 0 : num;
      };

      rawQuery.data.forEach(unidadeData => {
        const rows = unidadeData.principal;

        for (let i = 7; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length < 44) continue; // Precisa ir até a coluna AR

          const dataStringFull = row[1]; // Coluna B
          const supervisor = row[4];     // Coluna E
          const equipe = row[6];         // Coluna G
          const projeto = row[7];        // Coluna H
          const etapa = row[12];         // Coluna M

          // Valores financeiros
          const valorPlanejado = parseCurrency(row[37]); // AL
          const valorMeta = parseCurrency(row[38]);      // AM
          const realizadoPlanejado = parseCurrency(row[40]); // AO
          const totalProduzido = parseCurrency(row[42]); // AQ

          if (!equipe || !equipe.trim()) continue;

          const dataApenas = dataStringFull ? dataStringFull.split(' - ')[0].trim() : '';
          let dataParsed: Date | null = null;
          if (dataApenas) {
            const parsed = parse(dataApenas, 'dd/MM/yyyy', new Date());
            if (isValid(parsed)) {
              dataParsed = startOfDay(parsed);
            }
          }

          if (!equipesMap[equipe]) {
            equipesMap[equipe] = {
              supervisor: supervisor?.trim() || '',
              atividades: new Map()
            };
          }

          if (dataParsed) {
            const projetoNome = projeto?.trim() || 'Sem Projeto';
            const timeKey = dataParsed.getTime();
            if (!equipesMap[equipe].atividades.has(timeKey)) {
              equipesMap[equipe].atividades.set(timeKey, new Set());
            }
            equipesMap[equipe].atividades.get(timeKey)!.add(JSON.stringify({ 
              projeto: projetoNome, 
              etapa: (etapa || '').trim(),
              valorPlanejado,
              valorMeta,
              realizadoPlanejado,
              totalProduzido
            }));
          }
        }
      });

      const finalData: PlanejamentoEquipeRow[] = [];

      Object.entries(equipesMap).forEach(([nomeEquipe, dados]) => {
        const atividadesDiarias: EquipeAtividade[] = [];
        let minDate: Date | null = null;
        let maxDate: Date | null = null;

        dados.atividades.forEach((jsonSet, timeKey) => {
          const date = new Date(timeKey);
          
          if (!minDate || date < minDate) minDate = date;
          if (!maxDate || date > maxDate) maxDate = date;

          const atividadesFormatadas = Array.from(jsonSet).map(str => JSON.parse(str) as AtividadeProjeto);

          atividadesDiarias.push({
            dataParsed: date,
            atividades: atividadesFormatadas
          });
        });

        // Sort atividades by date
        atividadesDiarias.sort((a, b) => a.dataParsed.getTime() - b.dataParsed.getTime());

        finalData.push({
          equipe: nomeEquipe,
          supervisor: dados.supervisor,
          atividadesDiarias,
          minDate,
          maxDate
        });
      });

      return finalData;

    } catch (err) {
      console.error('Erro ao processar as planilhas das equipes:', err);
      return [];
    }
  }, [rawQuery.data]);

  return {
    ...rawQuery,
    data: parsedData,
  };
};
