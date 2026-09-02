import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfWeek, endOfWeek, addDays, format, parse, isSameDay, differenceInCalendarDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { UNIDADES_PLANEJAMENTO } from '@/constants/unidades';

export function parseMoedaPtBr(val: any): number {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;

  let str = String(val).trim().replace(/^R\$\s*/i, '').replace(/\s+/g, '');
  if (!str) return 0;

  const hasComma = str.includes(',');
  const hasDot = str.includes('.');

  if (hasComma && hasDot) {
    const lastComma = str.lastIndexOf(',');
    const lastDot = str.lastIndexOf('.');
    if (lastComma > lastDot) {
      // 1.234,56 ou 1.042.938,50 -> ponto é milhar, vírgula é decimal
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // 1,234.56 ou 1,042,938.50 -> vírgula é milhar, ponto é decimal
      str = str.replace(/,/g, '');
    }
  } else if (hasComma) {
    const parts = str.split(',');
    if (parts.length > 2) {
      str = str.replace(/,/g, '');
    } else {
      str = str.replace(',', '.');
    }
  } else if (hasDot) {
    const parts = str.split('.');
    if (parts.length > 2) {
      str = str.replace(/\./g, '');
    } else {
      const decPart = parts[1];
      if (decPart.length !== 3 || parts[0].length > 3) {
        // Decimal (ex: 10429.38 ou 10429.380) -> mantém o ponto
      } else {
        str = str.replace(/\./g, '');
      }
    }
  }

  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

export interface ObraConclusaoItem {
  data: string;             // "22/07/2026"
  dataObj: Date;
  supervisorEquipe: string; // "ALEX XAVIER"
  equipe: string;           // "EH156"
  projeto: string;          // "B-1213860"
  tipo: string;             // "DESLIGAMENTO/CONCLUSÃO" | "CONCLUSÃO"
  valorObra: number;        // 47724.20
}

export function getNumPessoasPorTipo(tipo: string): number {
  if (!tipo) return 3;
  const t = String(tipo).trim().toUpperCase();
  if (t === 'H3' || t.includes('H3')) return 3;
  if (t === 'H5' || t.includes('H5') || t.includes('L5')) return 5;
  if (t === 'LV' || t.includes('LV')) return 3;
  if (t.includes('5')) return 5;
  if (t.includes('3')) return 3;
  if (t.includes('2')) return 2;
  return 3;
}

export interface EquipeSemanalItem {
  codigo: string;
  supervisor: string;
  tipoEquipe: string; // H3, H5, LV, CONSTRUÇÃO, etc.
  numPessoas: number; // 3, 5, etc.
  metaSemanal: number;
  metaDiaria: number;
  temProgramacao: boolean;
  totalPlanejado: number;
  totalJornadaMin: number;
  totalDeslocamentoMin: number;
  mediaJornadaMin: number;
  mediaDeslocamentoH: number;
  pctMeta: number;
  dias: Record<string, DiaProgramacaoItem | null>; // key: YYYY-MM-DD
}

export interface OcupacaoAlojamentoEquipeInfo {
  codigo: string;
  supervisor: string;
  tipoEquipe: string;
  numPessoas: number;
  municipio: string;
  obra: string;
}

export interface OcupacaoAlojamentoDia {
  dataIso: string;
  dataStr: string;
  diaSemanaStr: string;
  totalPessoas: number;
  totalEquipes: number;
  equipes: OcupacaoAlojamentoEquipeInfo[];
  capacidade: number;
  pctOcupacao: number;
  isSobrecarregado: boolean;
}

export interface AlojamentoResumoSemanal {
  id: string;
  nome: string;
  municipio?: string;
  capacidade: number;
  picoPessoas: number;
  picoEquipes: number;
  picoPct: number;
  temSobrecarga: boolean;
  ocupacaoDias: OcupacaoAlojamentoDia[];
}

export interface SubItemProgramacao {
  obra: string;
  municipio: string;
  etapa: string;
  pontos: string[];
  valorPlanejado: number;
  tempoServicoMin?: number;
}

export interface DiaProgramacaoItem {
  data: string; // YYYY-MM-DD
  dataStr: string; // dd/MM
  diaSemanaStr: string; // seg, ter, qua...
  equipe: string;
  supervisor: string;
  obra: string;
  municipio: string;
  etapa: string;
  pontos: string[];
  valorPlanejado: number;
  pctMetaDia: number;
  tempoTotalMin: number;
  tempoDeslocamentoMin: number;
  tempoServicoMin: number;
  isFolga?: boolean;
  isFeriado?: boolean;
  isDomingo?: boolean;
  isIndisponivel?: boolean;
  alojamento?: string;
  alojamentoIda?: string;
  alojamentoVolta?: string;
  obras?: SubItemProgramacao[];
}

export interface MetricasSemana {
  totalPlanejado: number;
  totalMeta: number;
  aderenciaPeriodo: number;
  metaEquipesProgramadas: number;
  aderenciaEquipesProgramadas: number;
  totalEquipesGeral: number;
  totalEquipesProgramadas: number;
  totalEquipesSemProgramacao: number;
  equipesAcimaMeta: number;
  equipesAbaixoMeta: number;
  totalTurnos: number;
  jornadaMediaMin: number;
  turnosAbaixo8: number;
  turnosAcima10: number;
  deslocamentoMedioH: number;
  turnosAcima2h: number;
  turnosDentroMetaDesloc: number;
}

export interface UsePlanejamentoSemanalOptions {
  unidadeId: string;
  dataBase?: Date;
  dataInicio?: Date | string;
  dataFim?: Date | string;
}

export const COR_REGUA = {
  otimo: { texto: '#17794C', fundo: '#E6F2EA', borda: '#A0D4B2', rotulo: 'Ótimo' },
  bom: { texto: '#4E9E63', fundo: '#EDF4E7', borda: '#CCE3B8', rotulo: 'Bom' },
  atencao: { texto: '#C9A227', fundo: '#FBF2DA', borda: '#E8C9A0', rotulo: 'Atenção' },
  ruim: { texto: '#D9782E', fundo: '#FBEBDC', borda: '#F5D3B3', rotulo: 'Ruim' },
  critico: { texto: '#C0392E', fundo: '#F9E4E1', borda: '#F2C0B8', rotulo: 'Crítico' },
  vazio: { texto: '#BFB9B0', fundo: '#F0EDE8', borda: '#E6E3DD', rotulo: 'Vazio' },
};

export function getCorPctPlanejado(pct: number) {
  if (pct >= 150) return COR_REGUA.otimo;
  if (pct >= 100) return COR_REGUA.bom;
  if (pct >= 70) return COR_REGUA.atencao;
  if (pct >= 50) return COR_REGUA.ruim;
  return COR_REGUA.critico;
}

export function getCorJornada(minutos: number) {
  if (minutos <= 0) return COR_REGUA.vazio;
  if (minutos > 600) return COR_REGUA.critico; // acima de 10:00
  if (minutos >= 540 && minutos <= 600) return COR_REGUA.ruim; // 09:00 - 10:00
  if (minutos >= 450 && minutos < 540) return COR_REGUA.otimo; // 07:30 - 09:00
  if (minutos >= 390 && minutos < 450) return COR_REGUA.bom; // 06:30 - 07:30
  return COR_REGUA.atencao; // abaixo de 06:30
}

export function getCorDeslocamento(horas: number) {
  if (horas <= 0) return COR_REGUA.vazio;
  if (horas <= 1.2) return COR_REGUA.otimo;
  if (horas <= 2.0) return COR_REGUA.bom;
  if (horas <= 2.5) return COR_REGUA.atencao;
  return COR_REGUA.ruim;
}

export function cleanPontosList(pontos: string[]): string[] {
  if (!pontos || !Array.isArray(pontos)) return [];
  const result: string[] = [];
  pontos.forEach(p => {
    if (!p) return;
    const str = String(p).trim();
    const matches = str.match(/([PV]\d+(?:-\d+)?)/gi);
    if (matches && matches.length > 0) {
      matches.forEach(m => {
        const cleanM = m.toUpperCase();
        if (!result.includes(cleanM)) result.push(cleanM);
      });
    } else {
      const firstPart = str.split('-')[0].trim();
      if (firstPart && !result.includes(firstPart)) result.push(firstPart);
    }
  });
  return result;
}

export function formatMinToHours(minutes: number): string {
  if (!minutes || minutes <= 0) return '00:00';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function usePlanejamentoSemanal({
  unidadeId,
  dataBase,
  dataInicio,
  dataFim,
}: UsePlanejamentoSemanalOptions) {
  const queryClient = useQueryClient();
  const [dataSelecionadaInterna, setDataSelecionadaInterna] = useState<Date>(dataBase || new Date());

  // Sincroniza se a dataBase for passada/alterada pelo componente pai
  useEffect(() => {
    if (dataBase) {
      setDataSelecionadaInterna(dataBase);
    }
  }, [dataBase]);

  const dataEfetiva = dataBase || dataSelecionadaInterna;

  const toDateObj = (d: Date | string): Date => {
    if (typeof d === 'string') {
      const parts = d.split('-');
      if (parts.length === 3) {
        return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      }
      return new Date(d);
    }
    return d;
  };

  // Início e fim do período
  const inicioSemana = useMemo(() => {
    if (dataInicio) return toDateObj(dataInicio);
    return startOfWeek(dataEfetiva, { weekStartsOn: 1 });
  }, [dataInicio, dataEfetiva]);

  const fimSemana = useMemo(() => {
    if (dataFim) return toDateObj(dataFim);
    return endOfWeek(dataEfetiva, { weekStartsOn: 1 });
  }, [dataFim, dataEfetiva]);

  const diasDaSemana = useMemo(() => {
    const diff = Math.max(1, Math.min(60, differenceInCalendarDays(fimSemana, inicioSemana) + 1));
    return Array.from({ length: diff }, (_, i) => addDays(inicioSemana, i));
  }, [inicioSemana, fimSemana]);

  // Carregamento do Cache
  const cacheQuery = useQuery({
    queryKey: ['pcp-planejamento-cache', unidadeId],
    queryFn: async () => {
      if (!unidadeId) return null;
      const { data, error } = await supabase
        .from('planejamento_cache')
        .select('*')
        .eq('unidade_id', unidadeId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: Boolean(unidadeId),
    staleTime: 1000 * 60 * 5,
  });

  // Carregamento dos Alojamentos Globais cadastrados no app
  const alojamentosQuery = useQuery({
    queryKey: ['global-alojamentos-cache'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('planejamento_cache')
        .select('principal')
        .eq('unidade_id', 'GLOBAL_ALOJAMENTOS')
        .maybeSingle();

      if (error || !data || !data.principal) return [];
      let parsed: any[] = [];
      if (typeof data.principal === 'string') {
        parsed = JSON.parse(data.principal);
      } else {
        parsed = data.principal as any;
      }
      return parsed || [];
    },
    staleTime: 1000 * 60 * 5,
  });

  // Sincronização direta com o Google Sheets
  const syncFromSheets = useCallback(async () => {
    if (!unidadeId) {
      toast.error('Selecione uma unidade antes de carregar.');
      return;
    }
    try {
      toast.loading('Carregando dados diretamente do Google Sheets...', { id: 'sync-sheets-semanal' });
      const res = await fetch('/api/sync-pcp-cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unidadeId }),
      });
      const json = await res.json();
      if (json.success) {
        await queryClient.invalidateQueries({ queryKey: ['pcp-planejamento-cache', unidadeId] });
        await cacheQuery.refetch();
        toast.success('Dados do Google Sheets atualizados com sucesso!', { id: 'sync-sheets-semanal' });
      } else {
        toast.error('Erro ao carregar Sheets: ' + (json.error || 'Erro desconhecido'), { id: 'sync-sheets-semanal' });
      }
    } catch (e: any) {
      toast.error('Falha de conexão com o servidor: ' + e.message, { id: 'sync-sheets-semanal' });
    }
  }, [unidadeId, queryClient, cacheQuery]);

  // Processamento e Cruzamento de Dados (Plan_Principal + BD_Config + BD_Metas)
  const processamento = useMemo(() => {
    const rawData = cacheQuery.data;
    if (!rawData) {
      return {
        equipes: [] as EquipeSemanalItem[],
        metricas: {
          totalPlanejado: 0,
          totalMeta: 0,
          aderenciaPeriodo: 0,
          metaEquipesProgramadas: 0,
          aderenciaEquipesProgramadas: 0,
          totalEquipesGeral: 0,
          totalEquipesProgramadas: 0,
          totalEquipesSemProgramacao: 0,
          equipesAcimaMeta: 0,
          equipesAbaixoMeta: 0,
          totalTurnos: 0,
          jornadaMediaMin: 0,
          turnosAbaixo8: 0,
          turnosAcima10: 0,
          deslocamentoMedioH: 0,
          turnosAcima2h: 0,
          turnosDentroMetaDesloc: 0,
        },
        alojamentos: [] as Array<{ equipe: string; municipio: string; alojamento: string }>,
        alojamentosOcupacao: [] as AlojamentoResumoSemanal[],
        temAlertaSobrecarga: false,
        avisoBdConfig: false,
        ultimaAtualizacao: null as string | null,
      };
    }

    // 1. Extrair Metas e Tipo de Equipe por Equipe×Data de BD_Metas
    const metasMap = new Map<string, number>(); // Equipe → maior meta (fallback)
    // Mapa: Equipe → Data(ISO) → TIPO (CONSTRUÇÃO, MANUTENÇÃO, KIT, PODA, LINHA VIVA, LINHA VIVA MANUT.)
    const tipoEquipeDataMap = new Map<string, Map<string, string>>();
    // Mapa: Equipe → Data(ISO) → Meta do dia (valor real da BD_Metas)
    const metaDiariaDataMap = new Map<string, Map<string, number>>();
    const TIPOS_MANUTENCAO = ['KIT', 'PODA', 'MANUTENÇÃO', 'MANUTENCAO', 'LINHA VIVA MANUT.', 'LINHA VIVA MANUT'];
    try {
      const metasParsed = typeof rawData.bd_metas === 'string' ? JSON.parse(rawData.bd_metas) : rawData.bd_metas;
      const rowsMetas = metasParsed?.bd_metas || [];
      for (let i = 1; i < rowsMetas.length; i++) {
        const row = rowsMetas[i];
        if (!row || row.length < 4) continue;
        const eq = String(row[1] || '').trim().toUpperCase();
        const num = parseMoedaPtBr(row[3]);
        if (eq && num > 0) {
          metasMap.set(eq, num);
        }
        // Extrair tipo (coluna E, idx 4) e data (coluna C, idx 2)
        const tipo = String(row[4] || '').trim().toUpperCase();
        const dataStr = String(row[2] || '').trim();
        if (eq && tipo && dataStr) {
          if (!tipoEquipeDataMap.has(eq)) tipoEquipeDataMap.set(eq, new Map());
          if (!metaDiariaDataMap.has(eq)) metaDiariaDataMap.set(eq, new Map());
          // Converter data BR para ISO
          const matchBr = dataStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
          if (matchBr) {
            const d = new Date(parseInt(matchBr[3]), parseInt(matchBr[2]) - 1, parseInt(matchBr[1]));
            if (!isNaN(d.getTime())) {
              const dIso = format(d, 'yyyy-MM-dd');
              tipoEquipeDataMap.get(eq)!.set(dIso, tipo);
              metaDiariaDataMap.get(eq)!.set(dIso, num); // meta do dia (pode ser 0)
            }
          }
        }
      }
    } catch (e) {
      console.error('Erro ao ler bd_metas no semanal:', e);
    }

    // 2. Extrair Equipes, Supervisores e Tipo de Equipe (Coluna G) da BD_Config
    const equipesConfigMap = new Map<string, string>(); // Equipe -> Supervisor
    const equipesTipoMap = new Map<string, string>(); // Equipe -> Tipo (H3, H5, LV, etc.)
    const equipesEncarregadoMap = new Map<string, string>(); // Equipe -> Encarregado
    let avisoBdConfig = false;
    try {
      const metasParsed = typeof rawData.bd_metas === 'string' ? JSON.parse(rawData.bd_metas) : rawData.bd_metas;
      const bdConfigRows = metasParsed?.bd_config || [];
      
      for (let i = 1; i < bdConfigRows.length; i++) {
        const row = bdConfigRows[i];
        if (!row || !Array.isArray(row)) continue;
        const eq = String(row[3] || '').trim().toUpperCase(); // Coluna D
        const enc = String(row[4] || '').trim(); // Coluna E (Encarregado)
        const sup = String(row[5] || row[4] || row[2] || '').trim(); // Coluna F (Supervisor), fallback E/C
        const tipo = String(row[6] || '').trim().toUpperCase(); // Coluna G (Tipo: H3, H5, LV, etc.)
        if (eq && eq !== 'EQUIPE' && eq.length >= 2) {
          equipesConfigMap.set(eq, sup || 'SUPERVISOR');
          if (enc) equipesEncarregadoMap.set(eq, enc);
          if (tipo) equipesTipoMap.set(eq, tipo);
        }
      }
    } catch (e) {
      console.error('Erro ao ler BD_Config!D no semanal:', e);
    }

    // 3. Extrair Linhas da Plan_Principal e Carteira_Planejador
    const principalRows: any[][] = [];
    try {
      if (rawData.principal) {
        const parsed = typeof rawData.principal === 'string' ? JSON.parse(rawData.principal) : rawData.principal;
        if (Array.isArray(parsed)) {
          principalRows.push(...parsed);
        }
      }
    } catch (e) {
      console.error('Erro ao ler Plan_Principal no semanal:', e);
    }

    // Mapa de Projetos da Carteira_Planejador para extrair Município real, Coordenadas e Valor Considerado
    const projetoInfoMap = new Map<string, { municipio: string; titulo: string; lat: number | null; lng: number | null; valorConsiderado: number; dono: string; statusExecucao: string }>();
    try {
      if (rawData.carteira) {
        const carteiraParsed = typeof rawData.carteira === 'string' ? JSON.parse(rawData.carteira) : rawData.carteira;
        if (Array.isArray(carteiraParsed)) {
          for (let i = 4; i < carteiraParsed.length; i++) {
            const row = carteiraParsed[i];
            if (!row || !Array.isArray(row)) continue;
            const proj = String(row[12] || '').trim().toUpperCase();
            const muni = String(row[14] || '').trim().toUpperCase();
            const tit = String(row[13] || '').trim();
            const latStr = String(row[46] || '').replace(',', '.').trim();
            const lngStr = String(row[47] || '').replace(',', '.').trim();
            const lat = parseFloat(latStr) || null;
            const lng = parseFloat(lngStr) || null;
            const valorConsiderado = parseMoedaPtBr(row[38]);
            const dono = String(row[58] || row[15] || 'COELBA').trim();
            const statusExecucao = String(row[11] || 'EM ANDAMENTO').trim();
            if (proj) {
              projetoInfoMap.set(proj, {
                municipio: muni || '',
                titulo: tit,
                lat,
                lng,
                valorConsiderado,
                dono,
                statusExecucao,
              });
            }
          }
        }
      }
    } catch (e) {
      console.error('Erro ao ler carteira no semanal:', e);
    }

    // SEMPRE extrair Supervisores da Plan_Principal (Coluna E=Supervisor, Coluna G=Equipe)
    // pois a BD_Config não possui coluna confiável de Supervisor (Coluna C contém Encarregado).
    // Se BD_Config!D estiver vazia, também extrai códigos de equipes daqui.
    if (equipesConfigMap.size === 0) {
      avisoBdConfig = true;
    }
    // Mapa Equipe→Supervisor da Plan_Principal (fonte confiável)
    const supervisorPrincipalMap = new Map<string, string>();
    for (let i = 5; i < principalRows.length; i++) {
      const row = principalRows[i];
      if (!row) continue;
      const eq = String(row[6] || '').trim().toUpperCase(); // Coluna G = Equipe
      const sup = String(row[4] || '').trim();               // Coluna E = Supervisor
      if (eq && eq.length >= 2 && sup) {
        supervisorPrincipalMap.set(eq, sup);
      }
      // Se BD_Config não tinha equipes, registra aqui
      if (avisoBdConfig && eq && eq.length >= 2 && !equipesConfigMap.has(eq)) {
        equipesConfigMap.set(eq, sup || 'SUPERVISOR');
      }
    }
    // Sobrescreve supervisor no equipesConfigMap com o valor correto da Plan_Principal
    supervisorPrincipalMap.forEach((sup, eq) => {
      if (equipesConfigMap.has(eq)) {
        equipesConfigMap.set(eq, sup);
      }
    });

    // Fallback padrão se nada for encontrado
    if (equipesConfigMap.size === 0) {
      equipesConfigMap.set('EH156', 'SUPERVISOR GERAL');
    }

    // Helper para converter string de horas/minutos ("01:45:00", "01:30" ou decimal) para minutos inteiros
    const parseTimeInMin = (val: any, fallbackMin: number): number => {
      if (val === null || val === undefined || val === '') return fallbackMin;
      const str = String(val).trim();
      if (str.includes(':')) {
        const parts = str.split(':');
        const h = parseInt(parts[0], 10) || 0;
        const m = parseInt(parts[1], 10) || 0;
        const total = h * 60 + m;
        return total > 0 ? total : fallbackMin;
      }
      const num = parseFloat(str.replace(',', '.'));
      if (!isNaN(num) && num > 0) {
        if (num <= 24) return Math.round(num * 60);
        return Math.round(num);
      }
      return fallbackMin;
    };

    // 4. Indexar Programações da Plan_Principal por [Equipe][Data]
    // Col B (idx 1): Data
    // Col E (idx 4): Supervisor
    // Col G (idx 6): Equipe
    // Col H (idx 7): Obra / Projeto
    // Col M (idx 12): Etapa
    // Col O (idx 14): Pontos / Descrição Atividades
    // Col AL (idx 37): Planejado R$
    // Col AM (idx 38): Meta R$
    // Col BM (idx 64): Tempo Deslocamento ("1:45:00")
    // Col BP (idx 67): Tempo Total ("9:02:24")
    const programacoesPorEquipeData = new Map<string, Map<string, DiaProgramacaoItem>>();

    const parseDataFormat = (rawDate: string): Date | null => {
      if (!rawDate) return null;
      const str = String(rawDate).trim();

      const matchBr = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (matchBr) {
        const dia = parseInt(matchBr[1], 10);
        const mes = parseInt(matchBr[2], 10) - 1;
        const ano = parseInt(matchBr[3], 10);
        const d = new Date(ano, mes, dia);
        return !isNaN(d.getTime()) ? d : null;
      }

      const matchIso = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
      if (matchIso) {
        const ano = parseInt(matchIso[1], 10);
        const mes = parseInt(matchIso[2], 10) - 1;
        const dia = parseInt(matchIso[3], 10);
        const d = new Date(ano, mes, dia);
        return !isNaN(d.getTime()) ? d : null;
      }

      const d = new Date(str);
      return !isNaN(d.getTime()) ? d : null;
    };

    for (let i = 5; i < principalRows.length; i++) {
      const row = principalRows[i];
      if (!row || !Array.isArray(row)) continue;

      const dataStrRaw = String(row[1] || '').trim();
      const eq = String(row[6] || '').trim().toUpperCase();
      if (!dataStrRaw || !eq) continue;

      const dateObj = parseDataFormat(dataStrRaw);
      if (!dateObj) continue;

      const dataIso = format(dateObj, 'yyyy-MM-dd');
      const supervisor = String(row[4] || '').trim();
      const obra = String(row[7] || '').trim().toUpperCase();
      
      const projInfo = projetoInfoMap.get(obra);
      const municipio = projInfo?.municipio || String(row[10] || '').trim().toUpperCase();
      const etapa = String(row[12] || '').trim();
      const pontosCol8 = String(row[8] || '').trim();
      const pontosRaw = String(row[14] || '').trim();
      const pontosList = cleanPontosList(
        pontosCol8 ? pontosCol8.split(',') : (pontosRaw ? pontosRaw.split('|') : [])
      );

      const isFolga = etapa.toUpperCase() === 'FOLGA' || obra.toUpperCase() === 'FOLGA';
      const isFeriado = etapa.toUpperCase() === 'FERIADO' || obra.toUpperCase() === 'FERIADO';
      const isIndisponivel = etapa.toUpperCase() === 'INDISPONÍVEL' || etapa.toUpperCase() === 'INDISPONIVEL';

      // Ignorar linhas sem dados reais (etapa vazia + obra vazia + sem pontos + sem valor)
      // Isso evita que linhas vazias da planilha apareçam como "IMPLANTAÇÃO" na grade
      if (!etapa && !obra && pontosList.length === 0) {
        const valCheck = parseMoedaPtBr(row[37] || row[50] || row[45]);
        if (!valCheck) continue;
      }

      // Valor planejado real da Coluna 37 (ou 50/45)
      const valorPlanejado = parseMoedaPtBr(row[37] || row[50] || row[45]) || (pontosList.length > 0 ? pontosList.length * 1500 : 0);

      // Deslocamento real da Coluna 64 ("1:45:00") e Jornada da Coluna 67 ("8:34:00")
      const tempoDeslocamentoMin = parseTimeInMin(row[64], municipio.includes('LAPA') ? 45 : 90);
      const tempoTotalMin = parseTimeInMin(row[67], tempoDeslocamentoMin + 450);
      const metaDiariaDoDay = metaDiariaDataMap.get(eq)?.get(dataIso) ?? (metasMap.get(eq) || 5500);
      const pctMetaDia = metaDiariaDoDay > 0 ? Math.round((valorPlanejado / metaDiariaDoDay) * 100) : 0;

      const subItem: SubItemProgramacao = {
        obra,
        municipio,
        etapa: etapa || (isFolga ? 'FOLGA' : isFeriado ? 'FERIADO' : isIndisponivel ? 'INDISPONÍVEL' : ''),
        pontos: pontosList,
        valorPlanejado: isIndisponivel ? 0 : valorPlanejado,
        tempoServicoMin: isIndisponivel ? 0 : Math.max(0, tempoTotalMin - tempoDeslocamentoMin),
      };

      if (!programacoesPorEquipeData.has(eq)) {
        programacoesPorEquipeData.set(eq, new Map());
      }

      const existing = programacoesPorEquipeData.get(eq)!.get(dataIso);
      if (existing) {
        // Já existe programação para esta equipe nesta data (múltiplas obras no mesmo dia)
        if (!existing.obras) {
          existing.obras = [{
            obra: existing.obra,
            municipio: existing.municipio,
            etapa: existing.etapa,
            pontos: existing.pontos,
            valorPlanejado: existing.valorPlanejado,
            tempoServicoMin: existing.tempoServicoMin,
          }];
        }
        existing.obras.push(subItem);

        // Acumula o valor planejado total do dia
        existing.valorPlanejado += isIndisponivel ? 0 : valorPlanejado;
        existing.pctMetaDia = metaDiariaDoDay > 0 ? Math.round((existing.valorPlanejado / metaDiariaDoDay) * 100) : 0;

        // Unir pontos sem repetições
        pontosList.forEach(p => {
          if (!existing.pontos.includes(p)) existing.pontos.push(p);
        });

        // Concatena no texto legado para compatibilidade
        if (obra && !existing.obra.includes(obra)) {
          existing.obra = `${existing.obra} / ${obra}`;
        }
        if (etapa && !existing.etapa.includes(etapa)) {
          existing.etapa = `${existing.etapa} / ${etapa}`;
        }
        if (municipio && !existing.municipio.includes(municipio)) {
          existing.municipio = `${existing.municipio} / ${municipio}`;
        }

        if (!isFolga) existing.isFolga = false;
        if (!isFeriado) existing.isFeriado = false;
        if (!isIndisponivel) existing.isIndisponivel = false;

        // Tempos de jornada e deslocamento: mantém o maior registro da jornada
        existing.tempoTotalMin = Math.max(existing.tempoTotalMin, isIndisponivel ? 0 : tempoTotalMin);
        existing.tempoDeslocamentoMin = Math.max(existing.tempoDeslocamentoMin, isIndisponivel ? 0 : tempoDeslocamentoMin);
        existing.tempoServicoMin = Math.max(0, existing.tempoTotalMin - existing.tempoDeslocamentoMin);
      } else {
        programacoesPorEquipeData.get(eq)!.set(dataIso, {
          data: dataIso,
          dataStr: format(dateObj, 'dd/MM'),
          diaSemanaStr: format(dateObj, 'EEE', { locale: ptBR }),
          equipe: eq,
          supervisor: supervisor || equipesConfigMap.get(eq) || 'SUPERVISOR',
          obra: obra,
          municipio,
          etapa: etapa || (isFolga ? 'FOLGA' : isFeriado ? 'FERIADO' : isIndisponivel ? 'INDISPONÍVEL' : ''),
          pontos: pontosList,
          valorPlanejado: isIndisponivel ? 0 : valorPlanejado,
          pctMetaDia: isIndisponivel ? 0 : pctMetaDia,
          tempoTotalMin: isIndisponivel ? 0 : tempoTotalMin,
          tempoDeslocamentoMin: isIndisponivel ? 0 : tempoDeslocamentoMin,
          tempoServicoMin: isIndisponivel ? 0 : Math.max(0, tempoTotalMin - tempoDeslocamentoMin),
          isFolga,
          isFeriado,
          isIndisponivel,
          alojamentoIda: String(row[77] || '').trim(),
          alojamentoVolta: String(row[78] || '').trim(),
          alojamento: String(row[77] || '').trim() === String(row[78] || '').trim()
            ? String(row[77] || '').trim()
            : (String(row[77] || '').trim() && String(row[78] || '').trim() ? `${String(row[77] || '').trim()} / ${String(row[78] || '').trim()}` : (String(row[77] || '').trim() || String(row[78] || '').trim())),
          obras: [subItem],
        });
      }
    }

    // 5. Montar o Universo Completo de Equipes para a Semana
    const equipesResultado: EquipeSemanalItem[] = [];

    let totalGeralPlanejado = 0;
    let totalGeralMeta = 0;
    let totalTurnos = 0;
    let totalJornadaMinutos = 0;
    let totalDeslocamentoMinutos = 0;
    let turnosAbaixo8 = 0;
    let turnosAcima10 = 0;
    let turnosAcima2h = 0;
    let turnosDentroMetaDesloc = 0;
    let equipesAcimaMeta = 0;
    let equipesAbaixoMeta = 0;

    // Conjunto unificado de todas as equipes (cadastradas na BD_Config ou com programação na Plan_Principal)
    const allEquipesSet = new Set<string>();
    for (const eq of equipesConfigMap.keys()) allEquipesSet.add(eq);
    for (const eq of programacoesPorEquipeData.keys()) allEquipesSet.add(eq);

    const listaEquipesOrdenadas = Array.from(allEquipesSet).sort();

    listaEquipesOrdenadas.forEach(eq => {
      let sup = equipesConfigMap.get(eq);
      if (!sup || sup === 'SUPERVISOR') {
        const progDays = programacoesPorEquipeData.get(eq);
        if (progDays) {
          const found = Array.from(progDays.values()).find(d => d && d.supervisor && d.supervisor !== 'SUPERVISOR');
          if (found) sup = found.supervisor;
        }
      }
      sup = sup || 'SUPERVISOR';
      const metaDiariaFallback = metasMap.get(eq) || 5500; // fallback se BD_Metas não tiver data específica
      const metasDaEquipe = metaDiariaDataMap.get(eq);

      const tiposDaEquipe = tipoEquipeDataMap.get(eq);

      let equipePlanejado = 0;
      let equipeJornadaMin = 0;
      let equipeDeslocMin = 0;
      let diasComProgCount = 0;
      let metaSemanal = 0;
      let diasManutNoPeriodo = 0;
      let diasObrasNoPeriodo = 0;
      let diasComTipoNoPeriodo = 0;

      const diasMap: Record<string, DiaProgramacaoItem | null> = {};

      diasDaSemana.forEach((diaData, idx) => {
        const diaIso = format(diaData, 'yyyy-MM-dd');
        const prog = programacoesPorEquipeData.get(eq)?.get(diaIso) || null;
        const isDom = diaData.getDay() === 0;

        // Tipo do DIA ESPECÍFICO direto da BD_Metas (fonte de verdade)
        const tipoDia = tiposDaEquipe?.get(diaIso) || '';
        const temMetaNoDia = !!tipoDia; // só conta meta se BD_Metas tiver linha pra esse dia
        const isManutDia = TIPOS_MANUTENCAO.includes(tipoDia);

        if (temMetaNoDia) {
          diasComTipoNoPeriodo++;
          if (isManutDia) diasManutNoPeriodo++;
          else diasObrasNoPeriodo++;
        }

        // Calcular meta condicional por dia
        // Usa o valor REAL da meta daquele dia na BD_Metas (pode ser 0 em sábados/folgas)
        const metaDoDia = metasDaEquipe?.get(diaIso) ?? (temMetaNoDia ? metaDiariaFallback : 0);
        if (!isDom && temMetaNoDia && metaDoDia > 0) {
          if (isManutDia) {
            // Manutenção: só conta meta nos dias com obra programada (não folga, não feriado, não indisponível)
            if (prog && !prog.isFolga && !prog.isFeriado && !prog.isIndisponivel) {
              metaSemanal += metaDoDia;
            }
          } else {
            // Obras (CONSTRUÇÃO, LINHA VIVA): meta conta todos os dias que BD_Metas registra com valor > 0
            metaSemanal += metaDoDia;
          }
        }

        if (prog) {
          diasMap[diaIso] = prog;
          if (!prog.isIndisponivel) {
            equipePlanejado += prog.valorPlanejado;
            equipeJornadaMin += prog.tempoTotalMin;
            equipeDeslocMin += prog.tempoDeslocamentoMin;
            diasComProgCount += 1;

            // Métricas agregadas por turno (não conta indisponível)
            totalTurnos += 1;
            totalJornadaMinutos += prog.tempoTotalMin;
            totalDeslocamentoMinutos += prog.tempoDeslocamentoMin;

            if (prog.tempoTotalMin < 480) turnosAbaixo8 += 1;
            if (prog.tempoTotalMin > 600) turnosAcima10 += 1;
            if (prog.tempoDeslocamentoMin > 120) turnosAcima2h += 1;
            if (prog.tempoDeslocamentoMin <= 120) turnosDentroMetaDesloc += 1;
          }
        } else {
          diasMap[diaIso] = null;
        }
      });

      const temProgramacao = diasComProgCount > 0;
      // Tipo para exibição: preferencialmente da BD_Config (Coluna G: H3, H5, LV, etc.)
      const tipoConfig = equipesTipoMap.get(eq);
      const tipoEquipe = tipoConfig || (
        diasManutNoPeriodo >= diasObrasNoPeriodo && diasComTipoNoPeriodo > 0
          ? (tiposDaEquipe ? Array.from(tiposDaEquipe.entries())
              .filter(([d]) => diasDaSemana.some(dia => format(dia, 'yyyy-MM-dd') === d) && TIPOS_MANUTENCAO.includes(tiposDaEquipe.get(d) || ''))
              .map(([, t]) => t)[0] || 'MANUTENÇÃO' : 'MANUTENÇÃO')
          : 'CONSTRUÇÃO'
      );
      const numPessoas = getNumPessoasPorTipo(tipoEquipe);
      const isManutencao = !tipoConfig && diasComTipoNoPeriodo > 0 && diasManutNoPeriodo >= diasObrasNoPeriodo;

      const mediaJornadaMin = diasComProgCount > 0 ? Math.round(equipeJornadaMin / diasComProgCount) : 0;
      const mediaDeslocamentoH = diasComProgCount > 0 ? Math.round((equipeDeslocMin / diasComProgCount / 60) * 10) / 10 : 0;
      const pctMeta = metaSemanal > 0 ? Math.round((equipePlanejado / metaSemanal) * 100) : 0;

      // Equipes de manutenção sem nenhum dia programado na semana: não exibir na grade
      if (isManutencao && !temProgramacao) {
        return; // pula esta equipe
      }

      if (pctMeta >= 100) {
        equipesAcimaMeta += 1;
      } else {
        equipesAbaixoMeta += 1;
      }

      totalGeralPlanejado += equipePlanejado;
      totalGeralMeta += metaSemanal;

      equipesResultado.push({
        codigo: eq,
        supervisor: sup,
        tipoEquipe,
        numPessoas,
        metaSemanal,
        metaDiaria: metaDiariaFallback,
        temProgramacao,
        totalPlanejado: equipePlanejado,
        totalJornadaMin: equipeJornadaMin,
        totalDeslocamentoMin: equipeDeslocMin,
        mediaJornadaMin,
        mediaDeslocamentoH,
        pctMeta,
        dias: diasMap,
      });
    });

    const equipesProgramadas = equipesResultado.filter(e => e.temProgramacao);
    const totalMetaEquipesProgramadas = equipesProgramadas.reduce((acc, eq) => acc + eq.metaSemanal, 0);
    const aderenciaPeriodo = totalGeralMeta > 0 ? Math.round((totalGeralPlanejado / totalGeralMeta) * 100) : 0;
    const aderenciaEquipesProgramadas = totalMetaEquipesProgramadas > 0 ? Math.round((totalGeralPlanejado / totalMetaEquipesProgramadas) * 100) : 0;
    const jornadaMediaMin = totalTurnos > 0 ? Math.round(totalJornadaMinutos / totalTurnos) : 0;
    const deslocamentoMedioH = totalTurnos > 0 ? Math.round((totalDeslocamentoMinutos / totalTurnos / 60) * 10) / 10 : 0;

    // 5.5 Consolidação de Ocupação Diária por Alojamento na Semana
    const todosAlojamentos = (alojamentosQuery.data || []) as Array<{ id: string; nome: string; municipio?: string; capacidade: number; unidadeId?: string; unidadeNome?: string }>;
    
    // Obter o objeto da unidade atual para comparar tanto id quanto nome
    const unidadeObj = UNIDADES_PLANEJAMENTO.find(u => u.id === unidadeId || u.nome === unidadeId);
    const targetUnidadeId = unidadeObj?.id || unidadeId;
    const targetUnidadeNome = (unidadeObj?.nome || '').trim().toUpperCase();

    // Filtra alojamentos cadastrados que pertencem a esta unidade
    const alojamentosCadastrados = todosAlojamentos.filter(aloj => {
      const matchId = !!(targetUnidadeId && aloj.unidadeId === targetUnidadeId);
      const matchNome = !!(targetUnidadeNome && aloj.unidadeNome && aloj.unidadeNome.trim().toUpperCase() === targetUnidadeNome);
      return matchId || matchNome;
    });

    // Mapa para acumular ocupação por Alojamento
    const ocupacaoPorAlojamentoMap = new Map<string, {
      id: string;
      nome: string;
      municipio: string;
      capacidade: number;
      diasMap: Map<string, {
        totalPessoas: number;
        equipes: Array<{ codigo: string; supervisor: string; tipoEquipe: string; numPessoas: number; municipio: string; obra: string }>;
      }>;
    }>();

    // Inicializa com os alojamentos cadastrados no banco da unidade selecionada
    alojamentosCadastrados.forEach(aloj => {
      if (!aloj.nome) return;
      const key = aloj.nome.trim().toUpperCase();
      ocupacaoPorAlojamentoMap.set(key, {
        id: aloj.id || key,
        nome: aloj.nome.trim(),
        municipio: aloj.municipio || '',
        capacidade: Number(aloj.capacidade) > 0 ? Number(aloj.capacidade) : 10,
        diasMap: new Map(),
      });
    });

    // Itera sobre todas as equipes e dias programados desta unidade
    equipesResultado.forEach(eq => {
      if (!eq.temProgramacao) return;
      Object.entries(eq.dias).forEach(([dataIso, d]) => {
        if (!d || d.isFolga || d.isFeriado || d.isIndisponivel) return;

        const alojNomesDia = new Set<string>();
        const ida = (d as any).alojamentoIda ? String((d as any).alojamentoIda).trim() : '';
        const volta = (d as any).alojamentoVolta ? String((d as any).alojamentoVolta).trim() : '';
        const alojGeral = (d as any).alojamento ? String((d as any).alojamento).trim() : '';

        if (ida && ida !== '-' && !ida.toUpperCase().includes('FOLGA')) alojNomesDia.add(ida);
        if (volta && volta !== '-' && !volta.toUpperCase().includes('FOLGA')) alojNomesDia.add(volta);
        if (alojGeral && alojGeral !== '-' && !ida && !volta && !alojGeral.toUpperCase().includes('FOLGA')) {
          alojNomesDia.add(alojGeral);
        }

        if (alojNomesDia.size === 0 && d.municipio && !d.municipio.toUpperCase().includes('BASE') && !d.municipio.toUpperCase().includes('FOLGA')) {
          alojNomesDia.add(`Alojamento ${d.municipio}`);
        }

        alojNomesDia.forEach(nomeAloj => {
          if (!nomeAloj || nomeAloj === '-' || nomeAloj.toUpperCase() === 'BASE CENTRAL') return;
          const key = nomeAloj.trim().toUpperCase();

          let registro = ocupacaoPorAlojamentoMap.get(key);
          if (!registro) {
            const matchCadastrado = alojamentosCadastrados.find(
              c => key.includes(c.nome.toUpperCase()) || c.nome.toUpperCase().includes(key)
            ) || todosAlojamentos.find(
              c => key.includes(c.nome.toUpperCase()) || c.nome.toUpperCase().includes(key)
            );
            if (matchCadastrado) {
              const matchKey = matchCadastrado.nome.trim().toUpperCase();
              registro = ocupacaoPorAlojamentoMap.get(matchKey);
              if (!registro) {
                registro = {
                  id: matchCadastrado.id || matchKey,
                  nome: matchCadastrado.nome.trim(),
                  municipio: matchCadastrado.municipio || d.municipio || '',
                  capacidade: Number(matchCadastrado.capacidade) > 0 ? Number(matchCadastrado.capacidade) : 10,
                  diasMap: new Map(),
                };
                ocupacaoPorAlojamentoMap.set(matchKey, registro);
              }
            } else {
              registro = {
                id: `dinamico-${key}`,
                nome: nomeAloj.trim(),
                municipio: d.municipio || '',
                capacidade: 10, // capacidade padrão
                diasMap: new Map(),
              };
              ocupacaoPorAlojamentoMap.set(key, registro);
            }
          }

          if (!registro.diasMap.has(dataIso)) {
            registro.diasMap.set(dataIso, { totalPessoas: 0, equipes: [] });
          }

          const diaEntry = registro.diasMap.get(dataIso)!;
          if (!diaEntry.equipes.some(e => e.codigo === eq.codigo)) {
            diaEntry.equipes.push({
              codigo: eq.codigo,
              supervisor: eq.supervisor,
              tipoEquipe: eq.tipoEquipe,
              numPessoas: eq.numPessoas,
              municipio: d.municipio,
              obra: d.obra,
            });
            diaEntry.totalPessoas += eq.numPessoas;
          }
        });
      });
    });

    // Monta a lista AlojamentoResumoSemanal[]
    const alojamentosOcupacao: AlojamentoResumoSemanal[] = [];

    ocupacaoPorAlojamentoMap.forEach((registro) => {
      const ocupacaoDias: OcupacaoAlojamentoDia[] = diasDaSemana.map(diaData => {
        const dataIso = format(diaData, 'yyyy-MM-dd');
        const diaEntry = registro.diasMap.get(dataIso) || { totalPessoas: 0, equipes: [] };
        const totalPessoas = diaEntry.totalPessoas;
        const totalEquipes = diaEntry.equipes.length;
        const cap = registro.capacidade || 1;
        const pctOcupacao = Math.round((totalPessoas / cap) * 100);
        const isSobrecarregado = totalPessoas > cap;

        return {
          dataIso,
          dataStr: format(diaData, 'dd/MM'),
          diaSemanaStr: format(diaData, 'EEE', { locale: ptBR }),
          totalPessoas,
          totalEquipes,
          equipes: diaEntry.equipes,
          capacidade: registro.capacidade,
          pctOcupacao,
          isSobrecarregado,
        };
      });

      const picoPessoas = Math.max(0, ...ocupacaoDias.map(d => d.totalPessoas));
      const picoEquipes = Math.max(0, ...ocupacaoDias.map(d => d.totalEquipes));
      const picoPct = registro.capacidade > 0 ? Math.round((picoPessoas / registro.capacidade) * 100) : 0;
      const temSobrecarga = ocupacaoDias.some(d => d.isSobrecarregado);

      // Inclui apenas alojamentos que possuem ocupação prevista no período (picoPessoas > 0)
      if (picoPessoas > 0) {
        alojamentosOcupacao.push({
          id: registro.id,
          nome: registro.nome,
          municipio: registro.municipio,
          capacidade: registro.capacidade,
          picoPessoas,
          picoEquipes,
          picoPct,
          temSobrecarga,
          ocupacaoDias,
        });
      }
    });

    alojamentosOcupacao.sort((a, b) => {
      if (a.temSobrecarga && !b.temSobrecarga) return -1;
      if (!a.temSobrecarga && b.temSobrecarga) return 1;
      return b.picoPessoas - a.picoPessoas;
    });

    const temAlertaSobrecarga = alojamentosOcupacao.some(a => a.temSobrecarga);

    // Agrupa alojamentos por Equipe (uma linha por equipe)
    const alojamentosPorEquipe: Array<{ equipe: string; supervisor: string; municipio: string; alojamento: string }> = [];

    equipesResultado.forEach(eq => {
      if (!eq.temProgramacao) return;
      const mSet = new Set<string>();
      const aSet = new Set<string>();

      Object.values(eq.dias).forEach(d => {
        if (d && d.municipio && !d.isFolga && !d.isFeriado && d.municipio !== 'FOLGA') {
          mSet.add(d.municipio);
          const ida = (d as any).alojamentoIda;
          const volta = (d as any).alojamentoVolta;
          if (ida && ida.trim()) aSet.add(ida.trim());
          if (volta && volta.trim()) aSet.add(volta.trim());
          if (!ida && !volta) {
            const alojNome = (d as any).alojamento && (d as any).alojamento.trim()
              ? (d as any).alojamento.trim()
              : (d.municipio.includes('LAPA') ? 'Base Central (Bom Jesus da Lapa)' : `Alojamento ${d.municipio}`);
            aSet.add(alojNome);
          }
        }
      });

      if (mSet.size > 0) {
        alojamentosPorEquipe.push({
          equipe: eq.codigo,
          supervisor: eq.supervisor,
          municipio: Array.from(mSet).join(', '),
          alojamento: Array.from(aSet).join(', '),
        });
      }
    });

    // 6. Quadro de Planejado Conclusão de Obras (Padrão exato da tabela)
    const obrasConclusoes: ObraConclusaoItem[] = [];
    const seenKeys = new Set<string>();

    equipesResultado.forEach(eq => {
      Object.entries(eq.dias).forEach(([dataKey, dia]) => {
        if (dia && dia.obra && !dia.isFolga && !dia.isFeriado) {
          const etUpper = (dia.etapa || '').toUpperCase();
          let tipoEtapa = '';
          if (etUpper.includes('DESLIG') && (etUpper.includes('CONCLU') || etUpper.includes('CONCL'))) {
            tipoEtapa = 'DESLIGAMENTO/CONCLUSÃO';
          } else if (etUpper.includes('CONCLU') || etUpper.includes('CONCL')) {
            tipoEtapa = 'CONCLUSÃO';
          } else {
            return;
          }

          const subObrasList = dia.obras && dia.obras.length > 0
            ? dia.obras
            : [{ obra: dia.obra, etapa: dia.etapa, valorPlanejado: dia.valorPlanejado }];

          let cleanProjRaw = dia.obra.trim().toUpperCase();

          const projCodes = cleanProjRaw.split('/').map(s => {
            let code = s.trim().toUpperCase();
            if (!code.startsWith('B-') && !code.startsWith('P-')) {
              if (code.startsWith('B') && code.length > 3) {
                code = `B-${code.slice(1)}`;
              } else if (code.length > 0) {
                code = `B-${code}`;
              }
            }
            return code;
          }).filter(Boolean);

          const cleanProj = projCodes.join(' / ');

          let valorObraTotal = 0;
          projCodes.forEach(code => {
            const pInfo = projetoInfoMap.get(code)
              || projetoInfoMap.get(code.replace(/^B-/, ''))
              || projetoInfoMap.get(code.replace(/^P-/, ''));
            if (pInfo && pInfo.valorConsiderado > 0) {
              valorObraTotal += pInfo.valorConsiderado;
            }
          });

          if (valorObraTotal === 0) {
            valorObraTotal = subObrasList.reduce((acc, sub) => acc + (sub.valorPlanejado || 0), 0);
            if (valorObraTotal === 0) {
              valorObraTotal = dia.valorPlanejado || 0;
            }
          }

          let dataFormatada = dataKey;
          let dateObj = new Date();
          try {
            const parts = dataKey.split('-');
            if (parts.length === 3) {
              dateObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
              dataFormatada = format(dateObj, 'dd/MM/yyyy');
            }
          } catch {}

          const uniqueKey = `${dataFormatada}_${eq.supervisor}_${cleanProj}_${tipoEtapa}`;
          if (!seenKeys.has(uniqueKey)) {
            seenKeys.add(uniqueKey);
            obrasConclusoes.push({
              data: dataFormatada,
              dataObj: dateObj,
              supervisorEquipe: eq.supervisor || 'SUPERVISOR',
              equipe: eq.codigo,
              projeto: cleanProj,
              tipo: tipoEtapa,
              valorObra: valorObraTotal,
            });
          }
        }
      });
    });

    obrasConclusoes.sort((a, b) => {
      const timeDiff = a.dataObj.getTime() - b.dataObj.getTime();
      if (timeDiff !== 0) return timeDiff;
      const supDiff = a.supervisorEquipe.localeCompare(b.supervisorEquipe);
      if (supDiff !== 0) return supDiff;
      return a.projeto.localeCompare(b.projeto);
    });

    return {
      equipes: equipesResultado,
      metricas: {
        totalPlanejado: totalGeralPlanejado,
        totalMeta: totalGeralMeta,
        aderenciaPeriodo,
        metaEquipesProgramadas: totalMetaEquipesProgramadas,
        aderenciaEquipesProgramadas,
        totalEquipesGeral: equipesResultado.length,
        totalEquipesProgramadas: equipesProgramadas.length,
        totalEquipesSemProgramacao: equipesResultado.length - equipesProgramadas.length,
        equipesAcimaMeta,
        equipesAbaixoMeta,
        totalTurnos,
        jornadaMediaMin,
        turnosAbaixo8,
        turnosAcima10,
        deslocamentoMedioH,
        turnosAcima2h,
        turnosDentroMetaDesloc,
      },
      alojamentos: alojamentosPorEquipe,
      alojamentosOcupacao,
      temAlertaSobrecarga,
      obrasConclusoes,
      avisoBdConfig,
      ultimaAtualizacao: rawData.updated_at || null,
    };
  }, [cacheQuery.data, alojamentosQuery.data, diasDaSemana]);

  return {
    inicioSemana,
    fimSemana,
    diasDaSemana,
    dataSelecionada: dataEfetiva,
    setDataSelecionada: setDataSelecionadaInterna,
    isLoading: cacheQuery.isLoading,
    isRefetching: cacheQuery.isRefetching,
    error: cacheQuery.error,
    syncFromSheets,
    equipes: processamento.equipes,
    metricas: processamento.metricas,
    alojamentos: processamento.alojamentos,
    alojamentosOcupacao: processamento.alojamentosOcupacao,
    temAlertaSobrecarga: processamento.temAlertaSobrecarga,
    obrasConclusoes: processamento.obrasConclusoes,
    avisoBdConfig: processamento.avisoBdConfig,
    ultimaAtualizacao: processamento.ultimaAtualizacao,
  };
}
