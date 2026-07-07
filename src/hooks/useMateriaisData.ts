import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePlanejamentoRaw } from './usePlanejamentoRaw';
import { parse, isValid, addDays, isSunday, format } from 'date-fns';

export interface MaterialItem {
  id: string;
  projeto: string;
  pontoObra: string;
  codigo: string;
  descricao: string;
  quantidade: number;
  unidade: string;
  mascaraEPonto: string;
  orcamentista: string;
  comMascara: string;
  // Propriedades calculadas
  grupoOriginal: string;
  grupoTraduzido: string;
  liberado: boolean;
  semRegra: boolean;
  motivoNaoLiberado?: string;
}

export interface ProgramacaoMateriais {
  id: string;
  dataString: string;
  dataParsed: Date | null;
  equipe: string;
  obra: string;
  pontosRaw: string;
  pontosList: string[];
  descricaoAtividades: string;
  byGrupos: string[];
  byVazio: boolean;
  materiais: MaterialItem[];
}

export interface ConsolidatedMaterial {
  codigo: string;
  descricao: string;
  unidade: string;
  quantidadeTotal: number;
  pontosOrigem: { ponto: string; obra: string; qtd: number }[];
  grupoTraduzido: string;
}

// Helper para obter o próximo dia útil (Segunda a Sábado)
export function getProximoDiaUtil(date: Date = new Date()): Date {
  let next = addDays(date, 1);
  while (isSunday(next)) {
    next = addDays(next, 1);
  }
  return next;
}

function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export const useMateriaisData = (
  selectedUnidadesIds: string[],
  filters: { data: string; equipe: string; obra: string }
) => {
  // 1. Carrega programações brutas do cache
  const rawQuery = usePlanejamentoRaw(selectedUnidadesIds);

  // 2. Busca as regras no Supabase
  const rulesQuery = useQuery({
    queryKey: ['materiais_regras'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('materiais_regras')
        .select('*');
      if (error) throw error;
      return data || [];
    },
    staleTime: 10 * 60 * 1000,
  });

  // 3. Processa e filtra programações
  const programacoes = useQuery({
    queryKey: ['materiais_programacoes', selectedUnidadesIds, filters.data, filters.equipe, filters.obra, rawQuery.data],
    enabled: !!rawQuery.data,
    queryFn: () => {
      const filterDateStr = filters.data || format(getProximoDiaUtil(), 'yyyy-MM-dd');
      let targetDateFormatted = '';
      const parsedFilterDate = parse(filterDateStr, 'yyyy-MM-dd', new Date());
      if (isValid(parsedFilterDate)) {
        targetDateFormatted = format(parsedFilterDate, 'dd/MM/yyyy');
      }

      const list: Omit<ProgramacaoMateriais, 'materiais'>[] = [];

      rawQuery.data?.forEach(unidadeData => {
        const principalRows = unidadeData.principal;
        if (!principalRows || !Array.isArray(principalRows)) return;

        // Plan_Principal começa em 7 (0-based)
        for (let i = 7; i < principalRows.length; i++) {
          const row = principalRows[i];
          if (!row || !Array.isArray(row)) continue;

          const dataStringFull = row[1] ? String(row[1]).trim() : '';
          if (!dataStringFull) continue;

          const dataApenas = dataStringFull.split(' - ')[0].trim();
          
          // Filtro por Data
          if (targetDateFormatted && dataApenas !== targetDateFormatted) continue;

          const equipe = row[6] ? String(row[6]).trim() : '';
          // Filtro por Equipe
          if (filters.equipe && filters.equipe !== 'TODAS' && equipe !== filters.equipe) continue;

          const obra = row[7] ? String(row[7]).trim() : '';
          if (!obra) continue;
          // Filtro por Obra
          if (filters.obra && filters.obra !== 'TODAS' && !obra.toLowerCase().includes(filters.obra.toLowerCase())) continue;

          const pontosRaw = row[8] ? String(row[8]).trim() : '';
          const pontosList = pontosRaw
            ? pontosRaw.split(',').map(p => p.trim()).filter(Boolean)
            : [];

          const descricaoAtividades = row[14] ? String(row[14]).trim() : '';

          // BY col (index 76)
          const byRaw = row.length > 76 ? String(row[76]).trim() : '';
          const byGrupos = byRaw
            ? byRaw.split('|').map(g => g.trim().toUpperCase()).filter(Boolean)
            : [];
          const byVazio = byGrupos.length === 0;

          let dataParsed: Date | null = null;
          const parsed = parse(dataApenas, 'dd/MM/yyyy', new Date());
          if (isValid(parsed)) dataParsed = parsed;

          list.push({
            id: `${obra}-${unidadeData.unidadeId}-${i}`,
            dataString: dataStringFull,
            dataParsed,
            equipe,
            obra,
            pontosRaw,
            pontosList,
            descricaoAtividades,
            byGrupos,
            byVazio
          });
        }
      });

      return list;
    }
  });

  // 4. Coleta chaves MASCARA_E_PONTO para buscar no banco
  const mascaraEPontoKeys = (() => {
    if (!programacoes.data || programacoes.data.length === 0) return [];
    const keysSet = new Set<string>();
    programacoes.data.forEach(prog => {
      prog.pontosList.forEach(ponto => {
        keysSet.add(`${prog.obra}_${ponto}`);
      });
    });
    return Array.from(keysSet);
  })();

  // 5. Query Supabase de materiais por ponto usando chaves (com limite/WHERE IN)
  const materiaisQuery = useQuery({
    queryKey: ['materiais_por_ponto_recorte', mascaraEPontoKeys],
    enabled: mascaraEPontoKeys.length > 0,
    queryFn: async () => {
      // Chunking para evitar erro de limites de parâmetros em queries gigantes
      const chunkSize = 200;
      let allData: any[] = [];
      
      for (let i = 0; i < mascaraEPontoKeys.length; i += chunkSize) {
        const chunk = mascaraEPontoKeys.slice(i, i + chunkSize);
        const { data, error } = await supabase
          .from('materiais_por_ponto')
          .select('*')
          .in('mascara_e_ponto', chunk);
          
        if (error) throw error;
        if (data) allData = [...allData, ...data];
      }
      
      return allData;
    }
  });

  // 6. Processamento dos materiais e aplicação das regras
  const processedData = useQuery({
    queryKey: ['materiais_processados', programacoes.data, materiaisQuery.data, rulesQuery.data],
    enabled: !!programacoes.data && !!rulesQuery.data,
    queryFn: () => {
      const progsList = programacoes.data || [];
      const rawMats = materiaisQuery.data || [];
      const rawRules = rulesQuery.data || [];

      // Mapeia regras
      const regrasMaterialList = rawRules.find(r => r.tipo === 'REGRAS_MATERIAL')?.dados || [];
      const mapaLiberacaoList = rawRules.find(r => r.tipo === 'MAPA_LIBERACAO')?.dados || [];

      const regrasMaterialMap = new Map<string, any>();
      regrasMaterialList.forEach((r: any) => {
        if (r.codigo) regrasMaterialMap.set(String(r.codigo).trim(), r);
      });

      const mapaLiberacaoMap = new Map<string, string>();
      mapaLiberacaoList.forEach((r: any) => {
        if (r.grupo_material) {
          mapaLiberacaoMap.set(String(r.grupo_material).trim().toUpperCase(), String(r.liberado_por_grupo_by).trim().toUpperCase());
        }
      });

      // Agrupa materiais brutos por ponto para facilitar busca
      const matsByPontoKey = new Map<string, any[]>();
      rawMats.forEach((m: any) => {
        const key = String(m.mascara_e_ponto).trim();
        if (!matsByPontoKey.has(key)) matsByPontoKey.set(key, []);
        matsByPontoKey.get(key)!.push(m);
      });

      // Identifica pontos com equipamento (se contiver dispositivo = 'SIM')
      const pontosComEquipamento = new Set<string>();
      matsByPontoKey.forEach((mats, key) => {
        const temEquipamento = mats.some(m => {
          const regra = regrasMaterialMap.get(String(m.codigo).trim());
          return regra && String(regra.dispositivo).toUpperCase() === 'SIM';
        });
        if (temEquipamento) {
          pontosComEquipamento.add(key);
        }
      });

      // Regex de fallbacks
      const regexCabo = /(^CABO COBERTO|MULTIPLEX|MPLX|CORDOALHA| CAA|CABO NU ALUM|CABO AL |ESPACADOR|LOSANG|ANEL |LACO)/i;
      const regexEquip = /(RELIGADOR|REGULADOR| RT | RL |TRAFO|BANCO CAP|CONJ MEDICAO|PROTETOR| XLPE|LINHA VIVA|CARTUCHO|BARRA TERMINAL|TERMINAL COMP|ESTRB| COBERTURA|COBERTO)/i;

      // Monta as programações finais com seus materiais classificados
      const finalProgramacoes: ProgramacaoMateriais[] = progsList.map(prog => {
        const progMateriais: MaterialItem[] = [];

        prog.pontosList.forEach(ponto => {
          const pontoKey = `${prog.obra}_${ponto}`;
          const pontoMaterialsRaw = matsByPontoKey.get(pontoKey) || [];

          pontoMaterialsRaw.forEach(m => {
            const codigo = String(m.codigo).trim();
            const descricao = String(m.descricao).trim();
            const regra = regrasMaterialMap.get(codigo);

            let grupoOriginal = '';
            let semRegra = false;

            if (regra) {
              const hasEquip = pontosComEquipamento.has(pontoKey);
              grupoOriginal = hasEquip
                ? (regra.grupo_ponto_equipamento || regra.grupo_padrao)
                : regra.grupo_padrao;
            } else {
              // Fallback
              semRegra = true;
              const descNorm = normalizeText(descricao);
              if (regexCabo.test(descNorm)) {
                grupoOriginal = 'LANÇAMENTO DE CABO';
              } else if (regexEquip.test(descNorm)) {
                grupoOriginal = 'EQUIPAMENTO';
              } else {
                grupoOriginal = 'ESTRUTURA';
              }
            }

            const grupoTraduzido = mapaLiberacaoMap.get(grupoOriginal.toUpperCase()) || grupoOriginal.toUpperCase();

            // Lógica de Liberação
            let liberado = false;
            let motivoNaoLiberado = '';

            if (prog.byVazio) {
              // BY vazio (anterior à implantação): não filtra, mas exibe com flag
              liberado = true;
              motivoNaoLiberado = 'Programação sem BY (anterior)';
            } else {
              liberado = prog.byGrupos.includes(grupoTraduzido.toUpperCase());
              if (!liberado) {
                motivoNaoLiberado = `Grupo ${grupoTraduzido} não liberado por esta programação (BY possui: ${prog.byGrupos.join(', ')})`;
              }
            }

            progMateriais.push({
              id: String(m.id || `${pontoKey}-${codigo}`),
              projeto: String(m.projeto || prog.obra),
              pontoObra: String(m.ponto_obra || ponto),
              codigo,
              descricao,
              quantidade: Number(m.quantidade || 0),
              unidade: String(m.unidade || ''),
              mascaraEPonto: pontoKey,
              orcamentista: String(m.orçamentista || ''),
              comMascara: String(m.com_mascara || ''),
              grupoOriginal,
              grupoTraduzido,
              liberado,
              semRegra,
              motivoNaoLiberado
            });
          });
        });

        return {
          ...prog,
          materiais: progMateriais
        };
      });

      // Consolida materiais para os filtros selecionados
      const consolidatedMap = new Map<string, ConsolidatedMaterial>();
      
      finalProgramacoes.forEach(prog => {
        prog.materiais.forEach(m => {
          if (!m.liberado) return; // Só consolida o que está liberado

          const key = m.codigo;
          if (!consolidatedMap.has(key)) {
            consolidatedMap.set(key, {
              codigo: m.codigo,
              descricao: m.descricao,
              unidade: m.unidade,
              quantidadeTotal: 0,
              pontosOrigem: [],
              grupoTraduzido: m.grupoTraduzido
            });
          }

          const cons = consolidatedMap.get(key)!;
          cons.quantidadeTotal += m.quantidade;
          
          // Rastreia a origem (obra + ponto)
          const origExistente = cons.pontosOrigem.find(p => p.ponto === m.pontoObra && p.obra === prog.obra);
          if (origExistente) {
            origExistente.qtd += m.quantidade;
          } else {
            cons.pontosOrigem.push({
              ponto: m.pontoObra,
              obra: prog.obra,
              qtd: m.quantidade
            });
          }
        });
      });

      const consolidatedList = Array.from(consolidatedMap.values()).sort((a, b) => a.descricao.localeCompare(b.descricao));

      // Pontos sem orçamento
      const pontosSemOrcamento: string[] = [];
      progsList.forEach(prog => {
        prog.pontosList.forEach(ponto => {
          const pontoKey = `${prog.obra}_${ponto}`;
          if (!matsByPontoKey.has(pontoKey) || matsByPontoKey.get(pontoKey)!.length === 0) {
            pontosSemOrcamento.push(pontoKey);
          }
        });
      });

      return {
        programacoes: finalProgramacoes,
        consolidado: consolidatedList,
        pontosSemOrcamento,
        lastUpdated: rawQuery.data?.[0]?.lastUpdated || null
      };
    }
  });

  return {
    isLoading: rawQuery.isLoading || rulesQuery.isLoading || materiaisQuery.isLoading || programacoes.isLoading || processedData.isLoading,
    isError: rawQuery.isError || rulesQuery.isError || materiaisQuery.isError || programacoes.isError || processedData.isError,
    data: processedData.data,
    filtersDateDefault: format(getProximoDiaUtil(), 'yyyy-MM-dd')
  };
};
