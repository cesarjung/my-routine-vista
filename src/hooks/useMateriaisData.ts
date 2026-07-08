import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePlanejamentoRaw } from './usePlanejamentoRaw';
import { parse, isValid, addDays, isSunday, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const parseCurrency = (val: any) => {
  if (!val) return 0;
  const cleaned = String(val)
    .replace('R$', '')
    .replace(/\./g, '')
    .replace(',', '.')
    .trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
};

export interface MaterialItem {
  id: string;
  projeto: string;
  pontoObra: string;
  codigo: string;
  descricao: string;
  quantidade: number;
  qtdJaFornecida?: number;
  qtdASeparar?: number;
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
  equipe: string;
  estoque: number;
  saldo: number;
}

export interface ProgramacaoMateriais {
  id: string;
  unidadeId: string;
  dataString: string;
  dataParsed: Date | null;
  equipe: string;
  supervisor: string;
  municipio: string;
  obra: string;
  pontosRaw: string;
  pontosList: string[];
  descricaoAtividades: string;
  byGrupos: string[];
  byVazio: boolean;
  materiais: MaterialItem[];
  valorPlanejado: number;
}

export interface ConsolidatedMaterial {
  codigo: string;
  descricao: string;
  unidade: string;
  quantidadeTotal: number;
  qtdJaFornecidaTotal?: number;
  qtdASepararTotal?: number;
  pontosOrigem: { ponto: string; obra: string; qtd: number }[];
  grupoTraduzido: string;
  equipes: string[];
  estoque: number;
  saldo: number;
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
}

export const useMateriaisData = (
  selectedUnidadesIds: string[],
  filters: { 
    filterStart: string; 
    filterEnd: string; 
    selectedMonths: string[];
  }
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

  // 2b. Busca o estoque físico no Supabase
  const estoqueQuery = useQuery({
    queryKey: ['materiais_estoque', selectedUnidadesIds],
    enabled: selectedUnidadesIds.length > 0,
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('materiais_estoque')
          .select('*')
          .in('unidade_id', selectedUnidadesIds);
        if (error) {
          console.warn("Tabela materiais_estoque não criada ou erro ao buscar:", error);
          return [];
        }
        return data || [];
      } catch (err) {
        console.warn("Erro ao carregar estoque físico:", err);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000,
  });

  // 2c. Busca as reservas/formulários no Supabase
  const reservasQuery = useQuery({
    queryKey: ['materiais_reservas', selectedUnidadesIds],
    enabled: selectedUnidadesIds.length > 0,
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('materiais_reservas')
          .select('*')
          .in('unidade_id', selectedUnidadesIds);
        if (error) {
          console.warn("Tabela materiais_reservas não criada ou erro ao buscar:", error);
          return [];
        }
        return data || [];
      } catch (err) {
        console.warn("Erro ao carregar reservas:", err);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000,
  });

  // 3. Processa e filtra programações por período e mês
  const programacoes = useQuery({
    queryKey: ['materiais_programacoes', selectedUnidadesIds, filters.filterStart, filters.filterEnd, filters.selectedMonths, rawQuery.data],
    enabled: !!rawQuery.data,
    queryFn: () => {
      const list: Omit<ProgramacaoMateriais, 'materiais'>[] = [];
      const allEquipesSet = new Set<string>();
      const allSupervisoresSet = new Set<string>();
      const allMunicipiosSet = new Set<string>();
      const allObrasSet = new Set<string>();
      const allMonthsSet = new Set<string>();

      let filterStartDate: Date | null = null;
      let filterEndDate: Date | null = null;
      if (filters.filterStart) {
        const parsed = parse(filters.filterStart, 'yyyy-MM-dd', new Date());
        if (isValid(parsed)) filterStartDate = parsed;
      }
      if (filters.filterEnd) {
        const parsed = parse(filters.filterEnd, 'yyyy-MM-dd', new Date());
        if (isValid(parsed)) filterEndDate = parsed;
      }

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
          let dataParsed: Date | null = null;
          const parsed = parse(dataApenas, 'dd/MM/yyyy', new Date());
          if (isValid(parsed)) dataParsed = parsed;

          // Mapeia chaves para filtros globais
          const equipe = row[6] ? String(row[6]).trim() : '';
          if (equipe) allEquipesSet.add(equipe);

          const supervisor = row[4] ? String(row[4]).trim() : '';
          if (supervisor) allSupervisoresSet.add(supervisor);

          const municipio = row[28] ? String(row[28]).trim() : '';
          if (municipio) allMunicipiosSet.add(municipio);

          let mesAnoLabel = '';
          if (dataParsed) {
            const mesAnoCurto = format(dataParsed, 'MMM yyyy', { locale: ptBR });
            mesAnoLabel = mesAnoCurto.charAt(0).toUpperCase() + mesAnoCurto.slice(1);
            allMonthsSet.add(mesAnoLabel);
          }

          // Filtro por Data (Período)
          if (dataParsed) {
            if (filterStartDate && dataParsed < filterStartDate) continue;
            if (filterEndDate && dataParsed > filterEndDate) continue;
          }

          // Filtro por Mês
          if (filters.selectedMonths && filters.selectedMonths.length > 0) {
            if (!mesAnoLabel || !filters.selectedMonths.includes(mesAnoLabel)) {
              continue;
            }
          }

          const obra = row[7] ? String(row[7]).trim() : '';
          if (!obra) continue;
          allObrasSet.add(obra);

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

          const valorPlanejadoStr = row[37] ? String(row[37]).trim() : '';
          const valorPlanejado = parseCurrency(valorPlanejadoStr);

          list.push({
            id: `${obra}-${unidadeData.unidadeId}-${i}`,
            unidadeId: unidadeData.unidadeId,
            dataString: dataStringFull,
            dataParsed,
            equipe,
            supervisor,
            municipio,
            obra,
            pontosRaw,
            pontosList,
            descricaoAtividades,
            byGrupos,
            byVazio,
            valorPlanejado
          });
        }
      });

      return {
        list,
        allEquipes: Array.from(allEquipesSet).sort(),
        allSupervisores: Array.from(allSupervisoresSet).sort(),
        allMunicipios: Array.from(allMunicipiosSet).sort(),
        allObras: Array.from(allObrasSet).sort(),
        allMonths: Array.from(allMonthsSet).sort((a, b) => {
          try {
            const parsedA = parse(a, 'MMM yyyy', new Date(), { locale: ptBR });
            const parsedB = parse(b, 'MMM yyyy', new Date(), { locale: ptBR });
            return parsedA.getTime() - parsedB.getTime();
          } catch {
            return a.localeCompare(b);
          }
        })
      };
    }
  });

  // 4. Coleta chaves MASCARA_E_PONTO para buscar no banco
  const mascaraEPontoKeys = (() => {
    if (!programacoes.data?.list || programacoes.data.list.length === 0) return [];
    const keysSet = new Set<string>();
    programacoes.data.list.forEach(prog => {
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
    queryKey: ['materiais_processados', programacoes.data, materiaisQuery.data, rulesQuery.data, estoqueQuery.data, reservasQuery.data],
    enabled: !!programacoes.data && !!rulesQuery.data,
    queryFn: () => {
      const progsList = programacoes.data?.list || [];
      const rawMats = materiaisQuery.data || [];
      const rawRules = rulesQuery.data || [];
      const rawEstoque = estoqueQuery.data || [];
      const rawReservas = reservasQuery.data || [];

      // Mapeia estoque físico por key: `${unidade_id}_${codigo}`
      const estoqueFisicoMap = new Map<string, number>();
      rawEstoque.forEach((e: any) => {
        if (e.codigo && e.unidade_id) {
          const key = `${String(e.unidade_id).trim()}_${String(e.codigo).trim()}`;
          estoqueFisicoMap.set(key, (estoqueFisicoMap.get(key) || 0) + Number(e.quantidade || 0));
        }
      });

      // Mapeia reservas por status SEPARADO por key: `${unidade_id}_${codigo}`
      const totalReservasSeparadasMap = new Map<string, number>();
      rawReservas.forEach((r: any) => {
        const statusUpper = String(r.status).trim().toUpperCase();
        if (statusUpper === 'SEPARADO') {
          const key = `${String(r.unidade_id).trim()}_${String(r.codigo).trim()}`;
          totalReservasSeparadasMap.set(key, (totalReservasSeparadasMap.get(key) || 0) + Number(r.quantidade || 0));
        }
      });

      // Estoque disponível = estoque físico - total reservado geral (SEPARADO)
      const estoqueDisponivelMap = new Map<string, number>();
      estoqueFisicoMap.forEach((qty, key) => {
        const sep = totalReservasSeparadasMap.get(key) || 0;
        estoqueDisponivelMap.set(key, Math.max(0, qty - sep));
      });

      // Mapeia saldo de fornecido por obra por key: `${unidade_id}_${obra}_${codigo}`
      const suppliedRemainingMap = new Map<string, number>();
      rawReservas.forEach((r: any) => {
        const statusUpper = String(r.status).trim().toUpperCase();
        if (['SEPARADO', 'BAIXADO', 'ENTREGUE', 'SEM RESERVA'].includes(statusUpper)) {
          const key = `${String(r.unidade_id).trim()}_${String(r.obra).trim()}_${String(r.codigo).trim()}`;
          suppliedRemainingMap.set(key, (suppliedRemainingMap.get(key) || 0) + Number(r.quantidade || 0));
        }
      });

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

      // Ordenação estável das programações para consistência no FIFO
      const sortedProgsList = [...progsList].sort((a, b) => {
        const timeA = a.dataParsed?.getTime() || 0;
        const timeB = b.dataParsed?.getTime() || 0;
        if (timeA !== timeB) return timeA - timeB;
        return a.id.localeCompare(b.id);
      });

      // Monta as programações finais com seus materiais classificados
      const finalProgramacoes: ProgramacaoMateriais[] = sortedProgsList.map(prog => {
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

            const stockKey = `${prog.unidadeId}_${codigo}`;
            const estoque = estoqueDisponivelMap.has(stockKey)
              ? (estoqueDisponivelMap.get(stockKey) || 0)
              : 0;

            // Qtd planejada
            const quantidadePlanejada = Number(m.quantidade || 0);

            // Alocação FIFO de fornecido para esta obra + codigo
            const suppliedKey = `${prog.unidadeId}_${prog.obra}_${codigo}`;
            const suppliedRemaining = suppliedRemainingMap.get(suppliedKey) || 0;

            let qtdJaFornecida = 0;
            let qtdASeparar = quantidadePlanejada;

            if (suppliedRemaining >= quantidadePlanejada) {
              qtdJaFornecida = quantidadePlanejada;
              qtdASeparar = 0;
              suppliedRemainingMap.set(suppliedKey, suppliedRemaining - quantidadePlanejada);
            } else {
              qtdJaFornecida = suppliedRemaining;
              qtdASeparar = quantidadePlanejada - suppliedRemaining;
              suppliedRemainingMap.set(suppliedKey, 0);
            }

            // O saldo deste ponto é baseado no estoque disponível menos o que falta separar
            const saldo = estoque - qtdASeparar;

            progMateriais.push({
              id: String(m.id || `${pontoKey}-${codigo}`),
              projeto: String(m.projeto || prog.obra),
              pontoObra: String(m.ponto_obra || ponto),
              codigo,
              descricao,
              quantidade: quantidadePlanejada,
              qtdJaFornecida,
              qtdASeparar,
              unidade: String(m.unidade || ''),
              mascaraEPonto: pontoKey,
              orcamentista: String(m.orçamentista || ''),
              comMascara: String(m.com_mascara || ''),
              grupoOriginal,
              grupoTraduzido,
              liberado,
              semRegra,
              motivoNaoLiberado,
              equipe: prog.equipe,
              estoque,
              saldo
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
            // Calcula o estoque disponível consolidado somando para todas as unidades selecionadas
            let estoque = 0;
            selectedUnidadesIds.forEach(uid => {
              estoque += estoqueDisponivelMap.get(`${uid}_${key}`) || 0;
            });

            consolidatedMap.set(key, {
              codigo: m.codigo,
              descricao: m.descricao,
              unidade: m.unidade,
              quantidadeTotal: 0,
              qtdJaFornecidaTotal: 0,
              qtdASepararTotal: 0,
              pontosOrigem: [],
              grupoTraduzido: m.grupoTraduzido,
              equipes: [],
              estoque,
              saldo: estoque
            });
          }

          const cons = consolidatedMap.get(key)!;
          cons.quantidadeTotal += m.quantidade;
          cons.qtdJaFornecidaTotal = (cons.qtdJaFornecidaTotal || 0) + (m.qtdJaFornecida || 0);
          cons.qtdASepararTotal = (cons.qtdASepararTotal || 0) + (m.qtdASeparar || 0);
          
          // Rastreia equipe
          if (prog.equipe && !cons.equipes.includes(prog.equipe)) {
            cons.equipes.push(prog.equipe);
          }
          
          // Rastreia a origem (obra + ponto) mostrando o saldo pendente de separação
          const origExistente = cons.pontosOrigem.find(p => p.ponto === m.pontoObra && p.obra === prog.obra);
          if (origExistente) {
            origExistente.qtd += m.qtdASeparar || 0;
          } else {
            cons.pontosOrigem.push({
              ponto: m.pontoObra,
              obra: prog.obra,
              qtd: m.qtdASeparar || 0
            });
          }
        });
      });

      // Atualiza o saldo consolidado deduzindo o total a separar
      consolidatedMap.forEach(cons => {
        cons.saldo = cons.estoque - (cons.qtdASepararTotal || 0);
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

      const faltasDashboard = computeFaltasDashboard(
        finalProgramacoes,
        selectedUnidadesIds,
        estoqueDisponivelMap,
        regrasMaterialMap
      );

      return {
        programacoes: finalProgramacoes,
        consolidado: consolidatedList,
        pontosSemOrcamento,
        lastUpdated: rawQuery.data?.[0]?.lastUpdated || null,
        allEquipes: programacoes.data?.allEquipes || [],
        allSupervisores: programacoes.data?.allSupervisores || [],
        allMunicipios: programacoes.data?.allMunicipios || [],
        allMonths: programacoes.data?.allMonths || [],
        allObras: programacoes.data?.allObras || [],
        faltasDashboard
      };
    }
  });

  return {
    isLoading: rawQuery.isLoading || rulesQuery.isLoading || materiaisQuery.isLoading || programacoes.isLoading || processedData.isLoading || estoqueQuery.isLoading || reservasQuery.isLoading,
    isError: rawQuery.isError || rulesQuery.isError || materiaisQuery.isError || programacoes.isError || processedData.isError || estoqueQuery.isError || reservasQuery.isError,
    data: processedData.data,
    filtersDateDefault: format(getProximoDiaUtil(), 'yyyy-MM-dd')
  };
};

function computeFaltasDashboard(
  programacoes: ProgramacaoMateriais[],
  selectedUnidadesIds: string[],
  estoqueMap: Map<string, number>,
  regrasMaterialMap: Map<string, any>
) {
  // 1. Agrupar programações por unidade
  const progsByUnit = new Map<string, ProgramacaoMateriais[]>();
  programacoes.forEach(p => {
    const uid = p.unidadeId;
    if (!progsByUnit.has(uid)) progsByUnit.set(uid, []);
    progsByUnit.get(uid)!.push(p);
  });

  const faltaAlocadaMap = new Map<string, number>();
  const estoqueAntesMap = new Map<string, number>();
  const estoqueDepoisMap = new Map<string, number>();

  const isCritico = (codigo: string, grupo: string) => {
    const g = String(grupo).toUpperCase();
    if (g === 'EQUIPAMENTO' || g === 'LANÇAMENTO DE CABO') return true;
    const regra = regrasMaterialMap.get(codigo);
    if (regra && String(regra.dispositivo).toUpperCase() === 'SIM') return true;
    return false;
  };

  // 2. Alocação cronológica por unidade e código
  progsByUnit.forEach((progs, uid) => {
    const codes = new Set<string>();
    progs.forEach(p => {
      p.materiais.forEach(m => {
        if (m.liberado) codes.add(m.codigo);
      });
    });

    codes.forEach(code => {
      const sorted = progs
        .filter(p => p.materiais.some(m => m.codigo === code && m.liberado))
        .map((p, idx) => ({ prog: p, globalIdx: idx }))
        .sort((a, b) => {
          const timeA = a.prog.dataParsed?.getTime() || 0;
          const timeB = b.prog.dataParsed?.getTime() || 0;
          if (timeA !== timeB) return timeA - timeB;
          return a.globalIdx - b.globalIdx;
        });

      const stockKey = `${uid}_${code}`;
      const hasStock = estoqueMap.has(stockKey);
      let stockRemaining = hasStock ? (estoqueMap.get(stockKey) || 0) : null;

      if (stockRemaining !== null) {
        sorted.forEach(item => {
          const m = item.prog.materiais.find(mat => mat.codigo === code && mat.liberado)!;
          const req = m.qtdASeparar ?? m.quantidade;
          
          estoqueAntesMap.set(`${item.prog.id}_${code}`, stockRemaining!);
          
          if (stockRemaining! >= req) {
            faltaAlocadaMap.set(`${item.prog.id}_${code}`, 0);
            stockRemaining! -= req;
          } else {
            const falta = req - stockRemaining!;
            faltaAlocadaMap.set(`${item.prog.id}_${code}`, falta);
            stockRemaining! = 0;
          }
          
          estoqueDepoisMap.set(`${item.prog.id}_${code}`, stockRemaining!);
        });
      } else {
        sorted.forEach(item => {
          faltaAlocadaMap.set(`${item.prog.id}_${code}`, 0);
        });
      }
    });
  });

  // 3. Monta o status final das programações e coleta os dados das faltas
  const programacoesAfetadas: any[] = [];
  const faltasPorCodigo = new Map<string, any>();
  const progStatusPorDia = new Map<string, { total: number; atendidos: number }>();

  programacoes.forEach(prog => {
    let status: 'BLOQUEADO' | 'PARCIAL' | 'ATENDIDO' = 'ATENDIDO';
    const progFaltas: any[] = [];

    const dateKey = prog.dataString;
    if (!progStatusPorDia.has(dateKey)) {
      progStatusPorDia.set(dateKey, { total: 0, atendidos: 0 });
    }
    progStatusPorDia.get(dateKey)!.total++;

    prog.materiais.forEach(m => {
      if (!m.liberado) return;

      const code = m.codigo;
      const lack = faltaAlocadaMap.get(`${prog.id}_${code}`) || 0;
      const stockKey = `${prog.unidadeId}_${code}`;
      const isKnown = estoqueMap.has(stockKey);

      if (isKnown && lack > 0) {
        const crit = isCritico(code, m.grupoTraduzido);
        progFaltas.push({
          codigo: code,
          descricao: m.descricao,
          faltaAlocada: lack,
          quantidade: m.qtdASeparar ?? m.quantidade,
          critico: crit
        });

        if (crit && lack === (m.qtdASeparar ?? m.quantidade)) {
          status = 'BLOQUEADO';
        } else if (status !== 'BLOQUEADO') {
          status = 'PARCIAL';
        }
      }
    });

    if (status === 'ATENDIDO') {
      progStatusPorDia.get(dateKey)!.atendidos++;
    } else {
      programacoesAfetadas.push({
        id: prog.id,
        dataString: prog.dataString,
        dataParsed: prog.dataParsed,
        equipe: prog.equipe,
        obra: prog.obra,
        status: status as 'BLOQUEADO' | 'PARCIAL',
        faltas: progFaltas,
        valorPlanejado: prog.valorPlanejado || 0
      });
    }
  });

  // 4. Montar a tabela de faltas consolidadas
  programacoes.forEach(prog => {
    prog.materiais.forEach(m => {
      if (!m.liberado) return;

      const code = m.codigo;
      const stockKey = `${prog.unidadeId}_${code}`;
      const hasStock = estoqueMap.has(stockKey);
      const lack = faltaAlocadaMap.get(`${prog.id}_${code}`) || 0;

      if (lack > 0 || !hasStock) {
        if (!faltasPorCodigo.has(code)) {
          const crit = isCritico(code, m.grupoTraduzido);
          const estoqueVal = hasStock ? (estoqueMap.get(stockKey) || 0) : null;
          
          faltasPorCodigo.set(code, {
            codigo: code,
            descricao: m.descricao,
            grupoTraduzido: m.grupoTraduzido,
            critico: crit,
            necessario: 0,
            estoque: estoqueVal,
            falta: 0,
            primeiroDiaComprometido: null,
            programacoesCount: 0,
            equipes: [],
            tracking: [],
            estoqueDesconhecido: !hasStock
          });
        }

        const fItem = faltasPorCodigo.get(code)!;
        fItem.necessario += (m.qtdASeparar ?? m.quantidade);
        fItem.falta += lack;
        
        if (prog.equipe && !fItem.equipes.includes(prog.equipe)) {
          fItem.equipes.push(prog.equipe);
        }

        fItem.programacoesCount++;

        const estAntes = estoqueAntesMap.get(`${prog.id}_${code}`) ?? (hasStock ? 0 : null);
        const estDepois = estoqueDepoisMap.get(`${prog.id}_${code}`) ?? (hasStock ? 0 : null);

        fItem.tracking.push({
          dataString: prog.dataString,
          dataParsed: prog.dataParsed,
          equipe: prog.equipe,
          obra: prog.obra,
          quantidade: m.qtdASeparar ?? m.quantidade,
          estoqueAntes: estAntes,
          estoqueDepois: estDepois,
          faltaAlocada: lack
        });

        if (prog.dataParsed) {
          if (!fItem.primeiroDiaComprometido || prog.dataParsed < fItem.primeiroDiaComprometido) {
            fItem.primeiroDiaComprometido = prog.dataParsed;
          }
        }
      }
    });
  });

  faltasPorCodigo.forEach(f => {
    f.tracking.sort((a: any, b: any) => {
      const timeA = a.dataParsed?.getTime() || 0;
      const timeB = b.dataParsed?.getTime() || 0;
      return timeA - timeB;
    });
  });

  const listFaltas = Array.from(faltasPorCodigo.values()).sort((a: any, b: any) => {
    if (a.estoqueDesconhecido && !b.estoqueDesconhecido) return 1;
    if (!a.estoqueDesconhecido && b.estoqueDesconhecido) return -1;
    const timeA = a.primeiroDiaComprometido?.getTime() || 0;
    const timeB = b.primeiroDiaComprometido?.getTime() || 0;
    return timeA - timeB;
  });

  const coberturaDias: any[] = [];
  progStatusPorDia.forEach((val, dateKey) => {
    let parsed: Date | null = null;
    try {
      const dateApenas = dateKey.split(' - ')[0].trim();
      const p = parse(dateApenas, 'dd/MM/yyyy', new Date());
      if (isValid(p)) {
        parsed = p;
      } else {
        const p2 = parse(dateApenas, 'yyyy-MM-dd', new Date());
        if (isValid(p2)) parsed = p2;
      }
    } catch {}
    const percent = val.total > 0 ? Math.round((val.atendidos / val.total) * 100) : 100;
    coberturaDias.push({
      dateString: dateKey,
      dateParsed: parsed,
      percent
    });
  });

  coberturaDias.sort((a, b) => {
    const timeA = a.dateParsed?.getTime() || 0;
    const timeB = b.dateParsed?.getTime() || 0;
    return timeA - timeB;
  });

  const valorPlanejadoAfetado = programacoesAfetadas.reduce((acc, curr) => acc + (curr.valorPlanejado || 0), 0);

  return {
    faltas: listFaltas,
    afetados: programacoesAfetadas,
    cobertura: coberturaDias,
    totalFaltasQty: listFaltas.reduce((acc: number, curr: any) => acc + (curr.falta || 0), 0),
    totalProgramacoes: programacoes.length,
    afetadosCount: programacoesAfetadas.length,
    valorPlanejadoAfetado
  };
}
