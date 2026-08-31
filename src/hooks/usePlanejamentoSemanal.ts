import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfWeek, endOfWeek, addDays, format, parse, isSameDay, differenceInCalendarDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { UNIDADES_PLANEJAMENTO } from '@/constants/unidades';

export interface ObraConclusaoItem {
  obra: string;
  titulo: string;
  municipio: string;
  dono: string;
  supervisores: string[];
  equipes: string[];
  etapas: string[];
  pontos: string[];
  qtdPontos: number;
  valorConsiderado: number;
  valorPlanejadoSemana: number;
  statusExecucao: string;
}

export interface EquipeSemanalItem {
  codigo: string;
  supervisor: string;
  tipoEquipe: string; // CONSTRUÇÃO, LINHA VIVA, MANUTENÇÃO, KIT, PODA, LINHA VIVA MANUT.
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
        const valStr = String(row[3] || '').trim().replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
        const num = parseFloat(valStr) || 0;
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

    // 2. Extrair Equipes e Supervisores da BD_Config Coluna D (index 3)
    const equipesConfigMap = new Map<string, string>(); // Equipe -> Supervisor
    let avisoBdConfig = false;
    try {
      const metasParsed = typeof rawData.bd_metas === 'string' ? JSON.parse(rawData.bd_metas) : rawData.bd_metas;
      const bdConfigRows = metasParsed?.bd_config || [];
      
      for (let i = 1; i < bdConfigRows.length; i++) {
        const row = bdConfigRows[i];
        if (!row || !Array.isArray(row)) continue;
        const eq = String(row[3] || '').trim().toUpperCase(); // Coluna D
        const sup = String(row[4] || row[2] || '').trim(); // Coluna E (Supervisor), fallback Coluna C (Encarregado)
        if (eq && eq !== 'EQUIPE' && eq.length >= 2) {
          equipesConfigMap.set(eq, sup || 'SUPERVISOR');
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
            const valConsStr = String(row[38] || '').replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
            const valorConsiderado = parseFloat(valConsStr) || 0;
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
        const valCheck = String(row[37] || row[50] || row[45] || '').replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
        if (!parseFloat(valCheck)) continue;
      }

      // Valor planejado real da Coluna 37 (ou 50/45)
      const valStr = String(row[37] || row[50] || row[45] || '').replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
      const valorPlanejado = parseFloat(valStr) || (pontosList.length > 0 ? pontosList.length * 1500 : 0);

      // Deslocamento real da Coluna 64 ("1:45:00") e Jornada da Coluna 67 ("8:34:00")
      const tempoDeslocamentoMin = parseTimeInMin(row[64], municipio.includes('LAPA') ? 45 : 90);
      const tempoTotalMin = parseTimeInMin(row[67], tempoDeslocamentoMin + 450);
      const metaDiariaDoDay = metaDiariaDataMap.get(eq)?.get(dataIso) ?? (metasMap.get(eq) || 5500);
      const pctMetaDia = metaDiariaDoDay > 0 ? Math.round((valorPlanejado / metaDiariaDoDay) * 100) : 0;

      if (!programacoesPorEquipeData.has(eq)) {
        programacoesPorEquipeData.set(eq, new Map());
      }

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
      });
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

    const listaEquipesOrdenadas = Array.from(equipesConfigMap.keys()).sort();

    listaEquipesOrdenadas.forEach(eq => {
      const sup = equipesConfigMap.get(eq) || 'SUPERVISOR';
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
      // Tipo para exibição: usa o tipo mais frequente no período
      const tipoEquipe = diasManutNoPeriodo >= diasObrasNoPeriodo && diasComTipoNoPeriodo > 0
        ? (tiposDaEquipe ? Array.from(tiposDaEquipe.entries())
            .filter(([d]) => diasDaSemana.some(dia => format(dia, 'yyyy-MM-dd') === d) && TIPOS_MANUTENCAO.includes(tiposDaEquipe.get(d) || ''))
            .map(([, t]) => t)[0] || 'MANUTENÇÃO' : 'MANUTENÇÃO')
        : 'CONSTRUÇÃO';
      const isManutencao = diasComTipoNoPeriodo > 0 && diasManutNoPeriodo >= diasObrasNoPeriodo;

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

    // 6. Agrupamento de Conclusões de Obras
    const conclusoesMap = new Map<string, {
      obra: string;
      titulo: string;
      municipio: string;
      dono: string;
      supervisores: Set<string>;
      equipes: Set<string>;
      etapas: Set<string>;
      pontos: Set<string>;
      valorConsiderado: number;
      valorPlanejadoSemana: number;
      statusExecucao: string;
    }>();

    equipesResultado.forEach(eq => {
      Object.values(eq.dias).forEach(dia => {
        if (dia && dia.obra && !dia.isFolga && !dia.isFeriado) {
          const key = dia.obra.trim().toUpperCase();
          if (!conclusoesMap.has(key)) {
            const pInfo = projetoInfoMap.get(key);
            conclusoesMap.set(key, {
              obra: dia.obra.trim(),
              titulo: pInfo?.titulo || dia.obra,
              municipio: pInfo?.municipio || dia.municipio || 'BASE',
              dono: pInfo?.dono || 'COELBA',
              supervisores: new Set(),
              equipes: new Set(),
              etapas: new Set(),
              pontos: new Set(),
              valorConsiderado: pInfo?.valorConsiderado || 0,
              valorPlanejadoSemana: 0,
              statusExecucao: pInfo?.statusExecucao || 'EM ANDAMENTO',
            });
          }
          const c = conclusoesMap.get(key)!;
          if (eq.supervisor) c.supervisores.add(eq.supervisor);
          c.equipes.add(eq.codigo);
          if (dia.etapa) c.etapas.add(dia.etapa);
          if (Array.isArray(dia.pontos)) {
            cleanPontosList(dia.pontos).forEach(pt => c.pontos.add(pt));
          }
          c.valorPlanejadoSemana += dia.valorPlanejado || 0;
        }
      });
    });

    const obrasConclusoes: ObraConclusaoItem[] = Array.from(conclusoesMap.values()).map(c => ({
      obra: c.obra,
      titulo: c.titulo,
      municipio: c.municipio,
      dono: c.dono,
      supervisores: Array.from(c.supervisores),
      equipes: Array.from(c.equipes),
      etapas: Array.from(c.etapas),
      pontos: Array.from(c.pontos),
      qtdPontos: c.pontos.size,
      valorConsiderado: c.valorConsiderado,
      valorPlanejadoSemana: c.valorPlanejadoSemana,
      statusExecucao: c.statusExecucao,
    })).sort((a, b) => b.valorPlanejadoSemana - a.valorPlanejadoSemana);

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
      obrasConclusoes,
      avisoBdConfig,
      ultimaAtualizacao: rawData.updated_at || null,
    };
  }, [cacheQuery.data, diasDaSemana]);

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
    obrasConclusoes: processamento.obrasConclusoes,
    avisoBdConfig: processamento.avisoBdConfig,
    ultimaAtualizacao: processamento.ultimaAtualizacao,
  };
}
