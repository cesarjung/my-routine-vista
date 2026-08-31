import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Plus,
  Trash2,
  CheckCircle2,
  RefreshCw,
  Layers,
  FileSpreadsheet,
  AlertCircle,
  Filter,
  Check,
  ChevronDown,
  Wrench,
  Navigation,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  SlidersHorizontal,
  RotateCcw,
  Eraser,
  Calendar as CalendarIcon,
  Users,
  Send,
  Loader2,
  Sparkles,
  Building2,
  MapPin,
  Clock,
  DollarSign,
  Info,
  Mail,
  UsersRound,
  Briefcase
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  usePcpPlanejamentoData,
  UNIDADES_DISPONIVEIS,
  ALL_STATUSES,
  DEFAULT_SELECTED_STATUSES,
  PcpObra,
  PcpPontoItem,
  PcpProgramacaoForm,
  ServicoBase,
  ParsedPlanejamentoExistente,
  MaterialPontoBudget,
  MOTIVOS_REPROGRAMACAO_COL_AU,
  isEtapaSemAtividades,
  sortPontosAndVaos
} from '@/hooks/usePcpPlanejamentoData';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format, addDays, eachDayOfInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAlojamentos } from '@/hooks/useAlojamentos';
import { useVistoriaRisk } from '@/hooks/usePcpAiPlanner';
import { usePlanejamentoSemanal } from '@/hooks/usePlanejamentoSemanal';
import { toast } from 'sonner';
import { PcpDiaRow, getMetaColorScale, getSituacaoDia } from './PcpDiaRow';
import { UNIDADES_PLANEJAMENTO } from '@/constants/unidades';

function calcDistanceKM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// In-memory session store (persiste entre trocas de rotas/seções no SPA, reseta no F5 / logout)
const inMemoryPcpStore: Record<string, any> = {};
const inMemoryPcpListeners: Record<string, Set<(value: any) => void>> = {};

function useInMemorySessionState<T>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    if (key in inMemoryPcpStore) {
      return inMemoryPcpStore[key];
    }
    inMemoryPcpStore[key] = initialValue;
    return initialValue;
  });

  useEffect(() => {
    if (!inMemoryPcpListeners[key]) {
      inMemoryPcpListeners[key] = new Set();
    }
    inMemoryPcpListeners[key].add(setState);

    return () => {
      inMemoryPcpListeners[key].delete(setState);
    };
  }, [key]);

  const setValue: React.Dispatch<React.SetStateAction<T>> = useCallback((value) => {
    setState((prevState) => {
      const valueToStore = value instanceof Function ? (value as (val: T) => T)(prevState) : value;
      inMemoryPcpStore[key] = valueToStore;

      if (inMemoryPcpListeners[key]) {
        inMemoryPcpListeners[key].forEach(listener => {
          if (listener !== setState) {
            listener(valueToStore);
          }
        });
      }

      return valueToStore;
    });
  }, [key]);

  return [state, setValue];
}

function safeParseDate(val?: any): Date {
  if (!val) return new Date();
  if (val instanceof Date && !isNaN(val.getTime())) return val;
  if (typeof val === 'string') {
    const parts = val.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      const dt = new Date(y, m, d, 12, 0, 0);
      if (!isNaN(dt.getTime())) return dt;
    }
    const dObj = new Date(val);
    if (!isNaN(dObj.getTime())) return dObj;
  }
  return new Date();
}

function formatMinToHours(minutes: number): string {
  if (!minutes || minutes <= 0) return '00:00';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export const PcpPlanejamentoView = () => {
  const queryClient = useQueryClient();

  // Modo de Planejamento: por Obra (padrão) ou por Equipe
  const [planningMode, setPlanningMode] = useInMemorySessionState<'obra' | 'equipe'>('pcp_mem_planning_mode', 'obra');

  // Estado do modo Equipe: mapa de obra selecionada por chave composta equipe_diaId
  const [diasObraEquipeMap, setDiasObraEquipeMap] = useInMemorySessionState<Record<string, string>>('pcp_mem_dias_obra_equipe', {});
  // Equipes expandidas no accordion do modo equipe
  const [expandedEquipeIds, setExpandedEquipeIds] = useInMemorySessionState<string[]>('pcp_mem_expanded_equipes', []);

  // Helper: gera chave composta baseada no modo
  const getDiaKey = useCallback((diaId: string, equipeId?: string): string => {
    if (planningMode === 'equipe' && equipeId) {
      return `${equipeId}_${diaId}`;
    }
    return diaId;
  }, [planningMode]);

  // Handler: trocar modo de planejamento
  const handleTogglePlanningMode = useCallback((mode: 'obra' | 'equipe') => {
    if (mode === planningMode) return;
    setPlanningMode(mode);
    // Reset estados de planejamento ao trocar
    setDiasPontosMap({});
    setDiasPontosGroupedMap({});
    setDiasDateOverrideMap({});
    setDiasCarregadosList([]);
    setDiasReprogramarMap({});
    setDiasMotivoReprogramarMap({});
    setDiasPesMap({});
    setDiasEtapasMap({});
    setDiasCustomAlojMap({});
    setDiasMotivoDescumprimentoMap({});
    setDiasPercentualCumprimentoMap({});
    setDiasObraEquipeMap({});
    setExpandedEquipeIds([]);
    if (mode === 'equipe') {
      setSelectedObraId('');
    }
  }, [planningMode]);

  // Cache de dados de orçamento por projeto (modo Equipe)
  // Armazena pontos e orcamento para cada obra selecionada nos slots equipe_dia
  interface ObraDataCacheEntry {
    pontos: string[];
    orcamento: Map<string, MaterialPontoBudget[]>;
  }
  const [obraDataCache, setObraDataCache] = useState<Record<string, ObraDataCacheEntry>>({});

  // Limpeza de session storage legado ao inicializar
  useEffect(() => {
    try {
      Object.keys(window.sessionStorage).forEach(k => {
        if (k.startsWith('pcp_')) {
          window.sessionStorage.removeItem(k);
        }
      });
    } catch {}
  }, []);

  // Filtros da Carteira - Inicia 100% Vazio no F5 / Logout
  const [selectedUnidadeId, setSelectedUnidadeId] = useInMemorySessionState<string>('pcp_mem_unidade', '');
  const [selectedObraId, setSelectedObraId] = useInMemorySessionState<string>('pcp_mem_obra', '');
  const [searchObra, setSearchObra] = useInMemorySessionState<string>('pcp_mem_search', '');
  const [selectedStatuses, setSelectedStatuses] = useInMemorySessionState<string[]>('pcp_mem_statuses', DEFAULT_SELECTED_STATUSES);
  const [isStatusPopoverOpen, setIsStatusPopoverOpen] = useState<boolean>(false);
  const [selectedSituacao, setSelectedSituacao] = useInMemorySessionState<string>('pcp_mem_situacao', 'TODAS');
  const [selectedMesFilter, setSelectedMesFilter] = useInMemorySessionState<string>('pcp_mem_mes', 'TODOS');
  const [selectedMunicipioFilter, setSelectedMunicipioFilter] = useInMemorySessionState<string>('pcp_mem_municipio', 'TODOS');
  const [selectedPrioridadeFilter, setSelectedPrioridadeFilter] = useInMemorySessionState<string>('pcp_mem_prioridade', 'TODAS');
  const [selectedDonoFilter, setSelectedDonoFilter] = useInMemorySessionState<string>('pcp_mem_dono', 'TODOS');
  const [selectedSupervisorFilter, setSelectedSupervisorFilter] = useInMemorySessionState<string>('pcp_mem_supervisor', 'TODOS');

  // Alojamentos
  const { alojamentos } = useAlojamentos();
  const [selectedAlojamentoId, setSelectedAlojamentoId] = useState<string>('nenhum');

  // Hook Principal de Dados
  const {
    rawCacheQuery,
    obras,
    programacoesAtivas,
    planejamentosExistentesList,
    supervisoresDisponiveis,
    equipesDisponiveis,
    mesesCarteira,
    municipiosCarteira,
    prioridadesCarteira,
    donosCarteira,
    supervisoresCarteira,
    statusesCarteira,
    metasPorEquipeMap,
    orcamentoPontosQuery,
    orcamentoPorPontoMap,
    pontosDisponiveisDoProjeto,
    salvarProgramacao,
    servicosBase
  } = usePcpPlanejamentoData(selectedUnidadeId, selectedObraId);

  // Fetch de orçamento para novas obras selecionadas no modo Equipe
  useEffect(() => {
    if (planningMode !== 'equipe') return;

    const uniqueObraCodes = Array.from(new Set(Object.values(diasObraEquipeMap).filter(Boolean)));
    const missingCodes = uniqueObraCodes.filter(code => !obraDataCache[code]);

    if (missingCodes.length === 0) return;

    const fetchObraData = async (projetoCode: string) => {
      try {
        let cleanCode = projetoCode.trim();
        const rawNum = cleanCode.replace(/^[A-Z]-/, '').trim();
        const codeVariants = Array.from(new Set([cleanCode, `B-${rawNum}`, `B-0${rawNum}`, rawNum, `0${rawNum}`]));

        // Buscar atividades_por_ponto
        let allAtivs: any[] = [];
        let from = 0;
        const batchSize = 1000;
        let hasMore = true;

        while (hasMore && from < 100000) {
          const { data: pageData, error } = await supabase
            .from('atividades_por_ponto')
            .select('ponto_obra, etapa, codigo_atividade, descricao, quantidade, com_mascara, com_ponto_mascara, unidade_medida')
            .in('com_mascara', codeVariants)
            .range(from, from + batchSize - 1);

          if (error || !pageData || pageData.length === 0) {
            hasMore = false;
          } else {
            allAtivs.push(...pageData);
            if (pageData.length < batchSize) hasMore = false;
            else from += batchSize;
          }
        }

        let rawData: any[] = [];
        if (allAtivs.length > 0) {
          rawData = allAtivs.map((r: any) => ({ ...r, _source: 'atividades' }));
        } else {
          const { data: dataComMascara } = await supabase
            .from('materiais_por_ponto')
            .select('*')
            .in('com_mascara', codeVariants)
            .limit(2000);

          if (dataComMascara && dataComMascara.length > 0) {
            rawData = dataComMascara.map((r: any) => ({ ...r, _source: 'materiais' }));
          } else {
            from = 0;
            hasMore = true;
            let dataProjetoAll: any[] = [];
            while (hasMore && from < 100000) {
              const { data: dataProjeto, error } = await supabase
                .from('atividades_por_ponto')
                .select('ponto_obra, etapa, codigo_atividade, descricao, quantidade, com_mascara, com_ponto_mascara')
                .in('projeto', codeVariants)
                .range(from, from + batchSize - 1);

              if (error || !dataProjeto || dataProjeto.length === 0) hasMore = false;
              else {
                dataProjetoAll.push(...dataProjeto);
                if (dataProjeto.length < batchSize) hasMore = false;
                else from += batchSize;
              }
            }
            rawData = (dataProjetoAll || []).map((r: any) => ({ ...r, _source: 'atividades' }));
          }
        }

        const map = new Map<string, MaterialPontoBudget[]>();
        if (rawData.length > 0) {
          const firstItem = rawData[0] as any;
          const isAtividadesSource = firstItem?._source === 'atividades';

          if (isAtividadesSource) {
            const pontoMap = new Map<string, Map<string, { qty: number; etapa: string; codigo: string; descricao: string }>>();
            rawData.forEach((item: any) => {
              let pontoRaw = String(item.ponto_obra || item.com_ponto_mascara || '').trim();
              if (pontoRaw.includes('_')) pontoRaw = pontoRaw.split('_').pop() || pontoRaw;
              if (!pontoRaw) pontoRaw = 'P1';
              const pontoKey = pontoRaw.toUpperCase();
              const descricao = String(item.descricao || '').trim().toUpperCase();
              if (!descricao) return;
              const etapa = String(item.etapa || '').trim();
              const codigo = String(item.codigo_atividade || '').trim();
              const qty = Math.max(1, Math.round(Number(item.quantidade) || 1));
              if (!pontoMap.has(pontoKey)) pontoMap.set(pontoKey, new Map());
              const atvsMap = pontoMap.get(pontoKey)!;
              const ativKey = `${codigo}___${descricao}___${etapa}`;
              if (!atvsMap.has(ativKey)) atvsMap.set(ativKey, { qty, etapa, codigo, descricao });
            });

            pontoMap.forEach((atvsMap, pontoKey) => {
              const list: MaterialPontoBudget[] = [];
              atvsMap.forEach((info) => {
                const cod = String(info.codigo || '').trim();
                let foundServ = cod ? servicosBase.find(s => s.codigo && s.codigo === cod) : undefined;
                if (!foundServ) foundServ = servicosBase.find(s => s.servico === info.descricao);
                if (!foundServ) foundServ = servicosBase.find(s => info.descricao.includes(s.servico) || s.servico.includes(info.descricao))
                  || (servicosBase.length > 0 ? servicosBase[0] : { codigo: cod, servico: info.descricao, tempoMinutosPorUnidade: 15, valorPorUnidade: 0 } as any);
                const totalQty = Math.max(1, Math.round(info.qty));
                list.push({
                  id: `${pontoKey}-${cod || 'NOCOD'}-${info.descricao.replace(/\s+/g, '_').slice(0, 30)}-${info.etapa.replace(/\s+/g, '_').slice(0, 15)}`,
                  ponto: pontoKey, codigo: info.codigo, descricao: info.descricao, quantidade: totalQty, unidade: 'UND',
                  servicoPrevisto: info.descricao, etapaPrevista: info.etapa,
                  tempoMinutos: Math.round(foundServ.tempoMinutosPorUnidade * totalQty),
                  valorEstimado: Math.round(foundServ.valorPorUnidade * totalQty * 100) / 100,
                  valorUnitario: foundServ.valorPorUnidade, tempoUnitarioMinutos: foundServ.tempoMinutosPorUnidade,
                });
              });
              if (list.length > 0) map.set(pontoKey, list);
            });
          } else {
            const pontoAtividadesMap = new Map<string, Map<string, number[]>>();
            rawData.forEach((item: any) => {
              let pontoRaw = String(item.ponto_obra || item.mascara_e_ponto || '').trim();
              if (pontoRaw.includes('_')) pontoRaw = pontoRaw.split('_').pop() || pontoRaw;
              if (!pontoRaw) pontoRaw = 'P1';
              const pontoKey = pontoRaw.toUpperCase();
              const desc = String(item.descricao || '').toUpperCase();
              const itemQty = Number(item.quantidade || 1);
              let servico = '';
              let isPrimaryItem = false;
              if (desc.includes('POSTE')) {
                servico = (desc.includes('14M') || desc.includes('14 METRO') || desc.includes('15/') || desc.includes('16/'))
                  ? 'INSTALAR POSTE 14 METROS OU SUPERIOR' : 'INSTALAR POSTE 9 A 14 METROS';
                isPrimaryItem = desc.includes('POSTE CONCRETO') || desc.includes('POSTE DE CONCRETO') || desc.includes('POSTE MADEIRA');
                if (!isPrimaryItem) servico = '';
              } else if (desc.includes('ESCAVA') || desc.includes('APILOA') || (desc.includes('CAVA') && !desc.includes('CABO'))) {
                servico = 'ESCAVAR SOLO NORMAL'; isPrimaryItem = true;
              } else if (desc.includes('ESTAI')) {
                servico = 'INSTALAR ESTAI EM SOLO'; isPrimaryItem = true;
              } else if (desc.includes('CABO') || desc.includes('MPLX') || desc.includes('MULTIPLEXADO')) {
                servico = 'LAN\u00c7AMENTO DE CABO MULTIPLEXADO'; isPrimaryItem = desc.includes('CABO') || desc.includes('FIO');
              } else if (desc.includes('TRAFO') || desc.includes('TRANSFORMADOR')) {
                servico = 'INSTALAR TRAFO MONOFASICO'; isPrimaryItem = true;
              } else if (desc.includes('CHAVE') && desc.includes('FUSIVEL')) {
                servico = 'INSTALAR CHAVE FUSIVEL'; isPrimaryItem = true;
              } else if (desc.includes('CHAVE') && desc.includes('FACA')) {
                servico = 'INSTALAR CHAVE FACA'; isPrimaryItem = true;
              } else if (desc.includes('CRUZ') || desc.includes('CRUZETA')) {
                servico = 'INSTALAR EST CRUZ DUPLA 1 ANCORAGEM'; isPrimaryItem = true;
              }
              if (!servico || !isPrimaryItem) return;
              if (!pontoAtividadesMap.has(pontoKey)) pontoAtividadesMap.set(pontoKey, new Map());
              const ativsMap = pontoAtividadesMap.get(pontoKey)!;
              if (!ativsMap.has(servico)) ativsMap.set(servico, [itemQty]);
              else ativsMap.get(servico)!.push(itemQty);
            });
            pontoAtividadesMap.forEach((ativsMap, pontoKey) => {
              const list: MaterialPontoBudget[] = [];
              ativsMap.forEach((quantities, servico) => {
                const foundServ = servicosBase.find(s => s.servico === servico) || (servicosBase.length > 0 ? servicosBase[0] : { servico, tempoMinutosPorUnidade: 15, valorPorUnidade: 0 } as any);
                const totalQty = Math.max(1, Math.round(quantities.reduce((a, b) => a + b, 0)));
                list.push({
                  id: `${pontoKey}-${servico.replace(/\s+/g, '_')}`, ponto: pontoKey, codigo: '', descricao: servico,
                  quantidade: totalQty, unidade: 'UNID', servicoPrevisto: servico,
                  tempoMinutos: foundServ.tempoMinutosPorUnidade * totalQty,
                  valorEstimado: foundServ.valorPorUnidade * totalQty,
                  valorUnitario: foundServ.valorPorUnidade, tempoUnitarioMinutos: foundServ.tempoMinutosPorUnidade,
                });
              });
              if (list.length > 0) map.set(pontoKey, list);
            });
          }
        }

        const setPontos = new Set<string>(map.keys());
        if (setPontos.size === 0) {
          const obraObj = obras.find(o => o.projeto === projetoCode);
          const qtdPostes = Math.max(1, obraObj?.qtdPostesDisponiveis || 1);
          for (let i = 1; i <= qtdPostes; i++) setPontos.add(`P${i}`);
        }
        const pontos = Array.from(setPontos).sort(sortPontosAndVaos);

        setObraDataCache(prev => ({
          ...prev,
          [projetoCode]: { pontos, orcamento: map }
        }));
      } catch (err) {
        console.error(`Erro ao carregar or\u00e7amento da obra ${projetoCode}:`, err);
      }
    };

    missingCodes.forEach(code => fetchObraData(code));
  }, [planningMode, diasObraEquipeMap, obraDataCache, servicosBase, obras]);

  const selectedUnidadeObj = useMemo(() => {
    if (!selectedUnidadeId) return null;
    return UNIDADES_DISPONIVEIS.find(u => u.id === selectedUnidadeId) || null;
  }, [selectedUnidadeId]);

  // Modal de Envio de Planejamento Semanal
  const [isEnvioModalOpen, setIsEnvioModalOpen] = useState(false);
  const semanalData = usePlanejamentoSemanal({
    unidadeId: selectedUnidadeId,
  });

  const selectedObra = useMemo(() => {
    if (!selectedObraId || selectedObraId.trim() === '') return null;
    return obras.find(o => o.projeto === selectedObraId) || null;
  }, [obras, selectedObraId]);

  // Período
  const [dataInicio, setDataInicio] = useInMemorySessionState<string>('pcp_mem_data_inicio', format(new Date(), 'yyyy-MM-dd'));
  const [dataFim, setDataFim] = useInMemorySessionState<string>('pcp_mem_data_fim', format(addDays(new Date(), 2), 'yyyy-MM-dd'));
  const [isDataRangeOpen, setIsDataRangeOpen] = useState<boolean>(false);

  // Parâmetros Gerais
  const [supervisor, setSupervisor] = useState<string>('BARTOLOMEU');
  const [selectedEquipes, setSelectedEquipes] = useInMemorySessionState<string[]>('pcp_mem_selected_equipes', ['EH156']);
  const [tempoSaidaBasePadrao, setTempoSaidaBasePadrao] = useInMemorySessionState<number>('pcp_mem_tempo_saida_base', 15);
  const [tempoSegurancaPadrao, setTempoSegurancaPadrao] = useInMemorySessionState<number>('pcp_mem_tempo_seguranca', 15);
  const [metaEquipeInput, setMetaEquipeInput] = useState<number>(4442);

  // Sincroniza meta com a equipe selecionada
  useEffect(() => {
    if (selectedEquipes.length > 0 && selectedEquipes[0] && metasPorEquipeMap) {
      const eqMeta = metasPorEquipeMap.get(selectedEquipes[0].toUpperCase());
      if (eqMeta && eqMeta > 0) {
        setMetaEquipeInput(eqMeta);
      }
    }
  }, [selectedEquipes, metasPorEquipeMap]);

  // Visão Ativa: Jornada vs Alojamentos
  const [viewMode, setViewMode] = useInMemorySessionState<'jornada' | 'alojamentos'>('pcp_mem_view_mode', 'jornada');
  // Dias Expandidos
  const [expandedDayIds, setExpandedDayIds] = useInMemorySessionState<string[]>('pcp_mem_expanded_day_ids', []);

  // Mapas por Dia
  const [diasPontosMap, setDiasPontosMap] = useInMemorySessionState<Record<string, string[]>>('pcp_mem_dias_pontos_map', {});
  const [diasTemposCompMap, setDiasTemposCompMap] = useInMemorySessionState<Record<string, { tempoSaidaBaseMin?: number, tempoSegurancaMin?: number }>>('pcp_mem_tempos_comp', {});
  const [diasPesMap, setDiasPesMap] = useInMemorySessionState<Record<string, boolean>>('pcp_mem_pes_map', {});
  const [diasReprogramarMap, setDiasReprogramarMap] = useInMemorySessionState<Record<string, boolean>>('pcp_mem_reprog_map', {});
  const [diasMotivoReprogramarMap, setDiasMotivoReprogramarMap] = useInMemorySessionState<Record<string, string>>('pcp_mem_motivo_reprog', {});
  const [diasCustomAlojMap, setDiasCustomAlojMap] = useInMemorySessionState<Record<string, { origem?: string, destino?: string, tempoIdaMin?: number, tempoVoltaMin?: number, manualIda?: boolean, manualVolta?: boolean }>>('pcp_mem_custom_aloj', {});
  const [diasPontosGroupedMap, setDiasPontosGroupedMap] = useInMemorySessionState<Record<string, Record<string, PcpPontoItem[]>>>('pcp_mem_pontos_grouped', {});
  const [diasEtapasMap, setDiasEtapasMap] = useInMemorySessionState<Record<string, string[]>>('pcp_mem_etapas_map', {});
  const [diasFiltroLvMap, setDiasFiltroLvMap] = useInMemorySessionState<Record<string, 'COMPLETO' | 'SOMENTE_LV' | 'SEM_LV'>>('pcp_mem_filtro_lv', {});
  const [diasExtrasList, setDiasExtrasList] = useInMemorySessionState<string[]>('pcp_mem_dias_extras', []);
  const [diasCarregadosList, setDiasCarregadosList] = useInMemorySessionState<string[]>('pcp_mem_dias_carregados', []);
  const [diasDateOverrideMap, setDiasDateOverrideMap] = useInMemorySessionState<Record<string, string>>('pcp_mem_dias_date_override', {});
  const [diasExcluidosList, setDiasExcluidosList] = useInMemorySessionState<Array<{ diaId: string, dataCompleta: string, equipe: string, projeto: string, chaveBk?: string }>>('pcp_mem_dias_excluidos', []);
  const [diasPercentualCumprimentoMap, setDiasPercentualCumprimentoMap] = useInMemorySessionState<Record<string, string>>('pcp_mem_perc_cump', {});
  const [diasMotivoDescumprimentoMap, setDiasMotivoDescumprimentoMap] = useInMemorySessionState<Record<string, string>>('pcp_mem_motivo_descump', {});

  // Modal Carregar Planejamento
  const [isCarregarPlanModalOpen, setIsCarregarPlanModalOpen] = useState(false);
  const [selectedExistingPlanKeys, setSelectedExistingPlanKeys] = useState<string[]>([]);
  const [filterEquipesExistingPlan, setFilterEquipesExistingPlan] = useState<string[]>([]);
  const [filterOnlyCurrentPeriod, setFilterOnlyCurrentPeriod] = useState<boolean>(false);
  const [filterOnlyCurrentObra, setFilterOnlyCurrentObra] = useState<boolean>(false);
  const [filterDataInicioExistingPlan, setFilterDataInicioExistingPlan] = useState<string>('');
  const [filterDataFimExistingPlan, setFilterDataFimExistingPlan] = useState<string>('');
  const [searchExistingPlan, setSearchExistingPlan] = useState<string>('');

  // Zoom
  const [zoomLevel, setZoomLevel] = useInMemorySessionState<number>('pcp_mem_zoom_level', 1.0);
  const handleZoomIn = () => setZoomLevel(prev => Math.min(1.5, Math.round((prev + 0.1) * 10) / 10));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(0.7, Math.round((prev - 0.1) * 10) / 10));
  const handleResetZoom = () => setZoomLevel(1.0);

  // Análise de Risco da Vistoria
  const { analyzeRisk, riskCache, loadingRisk } = useVistoriaRisk(selectedObra?.projeto || null);

  useEffect(() => {
    if (selectedObra?.projeto) {
      analyzeRisk(selectedObra.projeto);
    }
  }, [selectedObra?.projeto, analyzeRisk]);

  const currentRisk = (selectedObra?.projeto && riskCache[selectedObra.projeto])
    ? riskCache[selectedObra.projeto]
    : null;

  // No modo equipe, dispara analyzeRisk para cada obra distinta selecionada nos slots
  useEffect(() => {
    if (planningMode !== 'equipe') return;
    const distinctObras = Array.from(new Set(Object.values(diasObraEquipeMap).filter(Boolean)));
    distinctObras.forEach(obraCode => {
      if (!riskCache[obraCode]) {
        analyzeRisk(obraCode);
      }
    });
  }, [planningMode, diasObraEquipeMap, analyzeRisk, riskCache]);

  // Informações da Base e Alojamentos da Unidade Ativa
  const unidadeAtivaInfo = useMemo(() => {
    return UNIDADES_PLANEJAMENTO.find(u => u.id === selectedUnidadeId) || null;
  }, [selectedUnidadeId]);

  const alojamentosDaUnidade = useMemo(() => {
    if (!selectedUnidadeId) return [];
    return alojamentos.filter(a => a.unidadeId === selectedUnidadeId);
  }, [alojamentos, selectedUnidadeId]);

  // Alojamento Padrão Nome
  const alojamentoPadrao = useMemo(() => {
    if (!selectedAlojamentoId || selectedAlojamentoId === 'nenhum') {
      return unidadeAtivaInfo ? unidadeAtivaInfo.baseNome : (selectedUnidadeObj?.name ? `Base ${selectedUnidadeObj.name}` : 'Base');
    }
    const found = alojamentosDaUnidade.find(a => a.id === selectedAlojamentoId || a.nome === selectedAlojamentoId);
    return found ? found.nome : (unidadeAtivaInfo ? unidadeAtivaInfo.baseNome : 'Base');
  }, [alojamentosDaUnidade, selectedAlojamentoId, selectedUnidadeObj, unidadeAtivaInfo]);

  // Cálculo Automático de Deslocamento e Alojamentos por Dia
  const FATOR_ESTRADA = 1.25;
  const fatorCaminhaoMult = 1.30;

  const getDayDisplacement = useCallback((diaId: string, idx: number, totalDias: number, overrideObra?: any) => {
    let defaultOrigemId = 'BASE';
    let defaultDestinoId = 'BASE';

    if (selectedAlojamentoId && selectedAlojamentoId !== 'nenhum') {
      if (totalDias === 1) {
        defaultOrigemId = 'BASE';
        defaultDestinoId = 'BASE';
      } else if (idx === 0) {
        defaultOrigemId = 'BASE';
        defaultDestinoId = selectedAlojamentoId;
      } else if (idx === totalDias - 1) {
        defaultOrigemId = selectedAlojamentoId;
        defaultDestinoId = 'BASE';
      } else {
        defaultOrigemId = selectedAlojamentoId;
        defaultDestinoId = selectedAlojamentoId;
      }
    }

    const customAl = diasCustomAlojMap[diaId] || {};
    const finalOrigemId = customAl.origem || defaultOrigemId;
    const finalDestinoId = customAl.destino || defaultDestinoId;

    const baseInfo = unidadeAtivaInfo || UNIDADES_PLANEJAMENTO[1];
    const alojList = alojamentosDaUnidade;

    const targetObra = overrideObra !== undefined ? overrideObra : selectedObra;

    const origemObj = finalOrigemId === 'BASE' || finalOrigemId === baseInfo.baseNome
      ? { id: 'BASE', nome: baseInfo.baseNome, latitude: baseInfo.baseLatitude, longitude: baseInfo.baseLongitude }
      : (alojList.find(a => a.id === finalOrigemId || a.nome === finalOrigemId) || { id: finalOrigemId, nome: finalOrigemId, latitude: null, longitude: null });

    const destinoObj = finalDestinoId === 'BASE' || finalDestinoId === baseInfo.baseNome
      ? { id: 'BASE', nome: baseInfo.baseNome, latitude: baseInfo.baseLatitude, longitude: baseInfo.baseLongitude }
      : (alojList.find(a => a.id === finalDestinoId || a.nome === finalDestinoId) || { id: finalDestinoId, nome: finalDestinoId, latitude: null, longitude: null });

    let distIdaKm = 0;
    let calcTempoIdaMin = 15;
    if (origemObj.latitude && origemObj.longitude && targetObra?.latitude && targetObra?.longitude) {
      distIdaKm = Math.round(calcDistanceKM(origemObj.latitude, origemObj.longitude, targetObra.latitude, targetObra.longitude) * FATOR_ESTRADA * 10) / 10;
      calcTempoIdaMin = Math.max(5, Math.round(distIdaKm * 1.33 * fatorCaminhaoMult));
    }

    let distVoltaKm = 0;
    let calcTempoVoltaMin = 15;
    if (destinoObj.latitude && destinoObj.longitude && targetObra?.latitude && targetObra?.longitude) {
      distVoltaKm = Math.round(calcDistanceKM(targetObra.latitude, targetObra.longitude, destinoObj.latitude, destinoObj.longitude) * FATOR_ESTRADA * 10) / 10;
      calcTempoVoltaMin = Math.max(5, Math.round(distVoltaKm * 1.33 * fatorCaminhaoMult));
    }

    const tempoIdaMin = (customAl.tempoIdaMin !== undefined && customAl.manualIda) ? customAl.tempoIdaMin : calcTempoIdaMin;
    const tempoVoltaMin = (customAl.tempoVoltaMin !== undefined && customAl.manualVolta) ? customAl.tempoVoltaMin : calcTempoVoltaMin;

    return {
      origemNome: origemObj.nome,
      destinoNome: destinoObj.nome,
      distIdaKm,
      tempoIdaMin,
      distVoltaKm,
      tempoVoltaMin,
      tempoTotalDeslocamentoMin: tempoIdaMin + tempoVoltaMin,
      isManualIda: Boolean(customAl.manualIda),
      isManualVolta: Boolean(customAl.manualVolta),
    };
  }, [selectedAlojamentoId, diasCustomAlojMap, unidadeAtivaInfo, alojamentosDaUnidade, selectedObra]);

  // Handler de troca de unidade com reset
  const handleUnidadeChange = (newUnitId: string) => {
    setSelectedUnidadeId(newUnitId);
    setSelectedObraId('');
    setSelectedAlojamentoId('nenhum');
    setSelectedSituacao('TODAS');
    setSelectedMesFilter('TODOS');
    setSelectedMunicipioFilter('TODOS');
    setSelectedPrioridadeFilter('TODAS');
    setSelectedDonoFilter('TODOS');
    setSelectedSupervisorFilter('TODOS');
    setSearchObra('');
    setDiasPontosMap({});
    setDiasPontosGroupedMap({});
    setDiasDateOverrideMap({});
    setDiasCarregadosList([]);
    toast.success('Unidade alterada com sucesso.');
  };

  // Lista de Dias Programados
  const diasProgramados = useMemo(() => {
    try {
      // Se houver dias de planejamentos carregados explicitamente, exibe APENAS estes dias selecionados
      if (diasCarregadosList && diasCarregadosList.length > 0) {
        const sortedDays = Array.from(new Set(diasCarregadosList)).sort();
        return sortedDays.map((dayId, idx) => {
          const effectiveDayId = diasDateOverrideMap[dayId] || dayId;
          const dateObj = safeParseDate(effectiveDayId);
          const nomeDia = format(dateObj, 'EEEE', { locale: ptBR });
          const dataStr = format(dateObj, 'dd/MM');
          const dataCompleta = format(dateObj, 'dd/MM/yyyy');
          return {
            id: effectiveDayId,
            index: idx + 1,
            nomeDia: nomeDia.charAt(0).toUpperCase() + nomeDia.slice(1),
            dataStr,
            dataCompleta,
            dateObj,
            isPes: diasPesMap[effectiveDayId] || false,
            reprogramar: diasReprogramarMap[effectiveDayId] || false,
            motivoReprogramar: diasMotivoReprogramarMap[effectiveDayId] || '',
          };
        });
      }

      const start = safeParseDate(dataInicio);
      const end = safeParseDate(dataFim);
      if (end < start) return [];

      const intervalDays = eachDayOfInterval({ start, end });
      const baseDays = intervalDays.map((dateObj, idx) => {
        const id = format(dateObj, 'yyyy-MM-dd');
        const effectiveDayId = diasDateOverrideMap[id] || id;
        const effectiveDateObj = safeParseDate(effectiveDayId);
        const nomeDia = format(effectiveDateObj, 'EEEE', { locale: ptBR });
        const dataStr = format(effectiveDateObj, 'dd/MM');
        const dataCompleta = format(effectiveDateObj, 'dd/MM/yyyy');
        return {
          id: effectiveDayId,
          index: idx + 1,
          nomeDia: nomeDia.charAt(0).toUpperCase() + nomeDia.slice(1),
          dataStr,
          dataCompleta,
          dateObj: effectiveDateObj,
          isPes: diasPesMap[effectiveDayId] || false,
          reprogramar: diasReprogramarMap[effectiveDayId] || false,
          motivoReprogramar: diasMotivoReprogramarMap[effectiveDayId] || '',
        };
      });

      const extraDays = diasExtrasList.map((extraId, idx) => {
        const effectiveDayId = diasDateOverrideMap[extraId] || extraId;
        const dateObj = safeParseDate(effectiveDayId);
        const nomeDia = format(dateObj, 'EEEE', { locale: ptBR });
        const dataStr = format(dateObj, 'dd/MM');
        const dataCompleta = format(dateObj, 'dd/MM/yyyy');
        return {
          id: effectiveDayId,
          index: baseDays.length + idx + 1,
          nomeDia: nomeDia.charAt(0).toUpperCase() + nomeDia.slice(1),
          dataStr,
          dataCompleta,
          dateObj,
          isPes: diasPesMap[effectiveDayId] || false,
          reprogramar: diasReprogramarMap[effectiveDayId] || false,
          motivoReprogramar: diasMotivoReprogramarMap[effectiveDayId] || '',
        };
      });

      return [...baseDays, ...extraDays];
    } catch {
      return [];
    }
  }, [diasCarregadosList, dataInicio, dataFim, diasPesMap, diasReprogramarMap, diasMotivoReprogramarMap, diasExtrasList, diasDateOverrideMap]);

  // Obras Filtradas
  const filteredObras = useMemo(() => {
    if (!selectedUnidadeId) return [];
    const list = Array.isArray(obras) ? obras : [];
    const statuses = Array.isArray(selectedStatuses) ? selectedStatuses : [];

    return list.filter(o => {
      if (!o) return false;

      // 1. Situação
      if (selectedSituacao !== 'TODAS' && o.situacao !== selectedSituacao) {
        return false;
      }

      // 2. Status
      if (statuses.length > 0) {
        const stUpper = (o.statusExecucao || (o as any).status || '').trim().toUpperCase();
        const matches = statuses.some(s => stUpper === (s || '').toUpperCase());
        if (!matches) return false;
      }

      // 3. Mês / Carteira
      if (selectedMesFilter !== 'TODOS') {
        const targetM = (selectedMesFilter || '').trim().toLowerCase();
        const hasMonth = (o.meses || []).some(m => (m || '').trim().toLowerCase() === targetM) ||
                         (o.carteirasStr || '').trim().toLowerCase().includes(targetM);
        if (!hasMonth) return false;
      }

      // 4. Município
      if (selectedMunicipioFilter !== 'TODOS' && (o.municipio || '').toUpperCase() !== (selectedMunicipioFilter || '').toUpperCase()) {
        return false;
      }

      // 5. Prioridade
      if (selectedPrioridadeFilter !== 'TODAS' && (o.prioridade || '').toUpperCase() !== (selectedPrioridadeFilter || '').toUpperCase()) {
        return false;
      }

      // 6. Dono da Obra
      const dono = (o.donoDaObra || (o as any).donoObra || '');
      if (selectedDonoFilter !== 'TODOS' && dono.toUpperCase() !== (selectedDonoFilter || '').toUpperCase()) {
        return false;
      }

      // 7. Supervisor
      if (selectedSupervisorFilter !== 'TODOS' && (o.supervisor || '').toUpperCase() !== (selectedSupervisorFilter || '').toUpperCase()) {
        return false;
      }

      // 8. Busca Texto
      if (searchObra.trim()) {
        const q = searchObra.toLowerCase().trim();
        const matchesProj = (o.projeto || '').toLowerCase().includes(q);
        const matchesDesc = (o.nomeProjeto || (o as any).descricao || '').toLowerCase().includes(q);
        const matchesMun = (o.municipio || '').toLowerCase().includes(q);
        const matchesDono = dono.toLowerCase().includes(q);
        if (!matchesProj && !matchesDesc && !matchesMun && !matchesDono) return false;
      }

      return true;
    });
  }, [
    selectedUnidadeId,
    obras,
    searchObra,
    selectedSituacao,
    selectedStatuses,
    selectedMesFilter,
    selectedMunicipioFilter,
    selectedPrioridadeFilter,
    selectedDonoFilter,
    selectedSupervisorFilter,
  ]);

  // Recupera ou inicializa atividades de um ponto em um dia
  const getItemsDoPontoNoDia = useCallback((diaId: string, pontoLabel: string): PcpPontoItem[] => {
    const pUpper = (pontoLabel || '').toUpperCase();
    const existingDay = diasPontosGroupedMap[diaId];
    if (existingDay && existingDay[pUpper]) {
      return existingDay[pUpper];
    }
    // Resolver orcamento: no modo equipe, usar cache por obra do slot; no modo obra, usar global
    let resolvedMap = orcamentoPorPontoMap;
    if (planningMode === 'equipe') {
      const obraCode = diasObraEquipeMap[diaId] || '';
      if (obraCode && obraDataCache[obraCode]) {
        resolvedMap = obraDataCache[obraCode].orcamento;
      }
    }
    const budgetItems = resolvedMap.get(pUpper) || [];
    if (budgetItems.length > 0) {
      return budgetItems.map((bItem, idx) => ({
        id: `${diaId}-${pUpper}-${bItem.id || idx}`,
        ponto: pUpper,
        servico: bItem.servicoPrevisto || bItem.descricao,
        codigoMaterial: bItem.codigo,
        descricaoMaterial: bItem.descricao,
        qtdOrcadaPonto: bItem.quantidade || 1,
        etapaPrevista: bItem.etapaPrevista || 'IMPLANTAÇÃO',
        quantidade: bItem.quantidade || 1,
        valorUnitario: bItem.valorUnitario,
        tempoEstimadoMinutos: bItem.tempoMinutos || 15,
        tempoUnitarioMinutos: bItem.tempoUnitarioMinutos || 15,
        valorEstimado: bItem.valorEstimado || 0,
        selected: true,
        isBudgeted: true,
        usaRetro: false,
        tempoRetroMinutos: 30,
      }));
    }
    return [];
  }, [diasPontosGroupedMap, orcamentoPorPontoMap, planningMode, diasObraEquipeMap, obraDataCache]);

  // Handlers de Expansão
  const handleToggleExpandDay = (diaId: string) => {
    setExpandedDayIds(prev =>
      prev.includes(diaId) ? prev.filter(id => id !== diaId) : [...prev, diaId]
    );
  };

  const handleExpandAll = () => {
    setExpandedDayIds(diasProgramados.map(d => d.id));
  };

  const handleCollapseAll = () => {
    setExpandedDayIds([]);
  };

  // Handlers de Obra e Filtros
  const handleSelectObra = (projetoCode: string) => {
    setSelectedObraId(projetoCode);
    setDiasPontosMap({});
    setDiasPontosGroupedMap({});
    setDiasDateOverrideMap({});
    setDiasCarregadosList([]); // Retorna ao período normal do calendário para a nova obra
  };

  const handleClearFilters = () => {
    setSearchObra('');
    setSelectedStatuses(DEFAULT_SELECTED_STATUSES);
    setSelectedSituacao('TODAS');
    setSelectedMesFilter('TODOS');
    setSelectedMunicipioFilter('TODOS');
    setSelectedPrioridadeFilter('TODAS');
    setSelectedDonoFilter('TODOS');
    setSelectedSupervisorFilter('TODOS');
    toast.success('Filtros restaurados para o padrão.');
  };

  // Handlers de Dias
  const handleAddDiaExtra = () => {
    const lastDay = diasProgramados.length > 0 ? diasProgramados[diasProgramados.length - 1].dateObj : new Date();
    const nextDate = addDays(lastDay, 1);
    const newId = format(nextDate, 'yyyy-MM-dd');
    if (diasCarregadosList.length > 0) {
      setDiasCarregadosList(prev => [...prev, newId]);
    } else {
      setDiasExtrasList(prev => [...prev, newId]);
    }
    toast.success(`Dia extra (${format(nextDate, 'dd/MM/yyyy')}) adicionado com sucesso.`);
  };

  const handleRemoveDia = (diaId: string) => {
    const diaTarget = diasProgramados.find(d => d.id === diaId);
    if (diaTarget) {
      const cleanDateNum = diaTarget.dataCompleta.replace(/\//g, '');
      const eq = selectedEquipes[0] || 'EH156';
      const chaveBk = `${eq}_${cleanDateNum}`;
      setDiasExcluidosList(prev => [
        ...prev.filter(x => x.diaId !== diaId && x.chaveBk !== chaveBk),
        {
          diaId,
          dataCompleta: diaTarget.dataCompleta,
          equipe: eq,
          projeto: selectedObraId,
          chaveBk,
        }
      ]);
    }

    if (diasCarregadosList.includes(diaId)) {
      setDiasCarregadosList(prev => prev.filter(d => d !== diaId));
    }
    if (diasExtrasList.includes(diaId)) {
      setDiasExtrasList(prev => prev.filter(d => d !== diaId));
    }
    setDiasPontosMap(prev => {
      const next = { ...prev };
      delete next[diaId];
      return next;
    });
    setExpandedDayIds(prev => prev.filter(id => id !== diaId));
    toast.success('Dia removido. Ao salvar/enviar, a linha correspondente será excluída da Plan_Principal.');
  };

  const handleUpdateDiaDate = (diaId: string, newDate: Date) => {
    const newId = format(newDate, 'yyyy-MM-dd');
    if (newId === diaId) return;

    if (diasCarregadosList.includes(diaId)) {
      setDiasCarregadosList(prev => prev.map(d => (d === diaId ? newId : d)));
    }
    if (diasExtrasList.includes(diaId)) {
      setDiasExtrasList(prev => prev.map(d => (d === diaId ? newId : d)));
    }

    setDiasDateOverrideMap(prev => ({
      ...prev,
      [diaId]: newId,
      [newId]: newId,
    }));

    setDiasPontosMap(prev => {
      const next = { ...prev };
      if (next[diaId] !== undefined) {
        next[newId] = next[diaId];
        delete next[diaId];
      }
      return next;
    });

    setDiasPontosGroupedMap(prev => {
      const next = { ...prev };
      if (next[diaId] !== undefined) {
        next[newId] = next[diaId];
        delete next[diaId];
      }
      return next;
    });

    setDiasEtapasMap(prev => {
      const next = { ...prev };
      if (next[diaId] !== undefined) {
        next[newId] = next[diaId];
        delete next[diaId];
      }
      return next;
    });

    setDiasFiltroLvMap(prev => {
      const next = { ...prev };
      if (next[diaId] !== undefined) {
        next[newId] = next[diaId];
        delete next[diaId];
      }
      return next;
    });

    setDiasPesMap(prev => {
      const next = { ...prev };
      if (next[diaId] !== undefined) {
        next[newId] = next[diaId];
        delete next[diaId];
      }
      return next;
    });

    setDiasReprogramarMap(prev => {
      const next = { ...prev };
      if (next[diaId] !== undefined) {
        next[newId] = next[diaId];
        delete next[diaId];
      }
      return next;
    });

    setDiasMotivoReprogramarMap(prev => {
      const next = { ...prev };
      if (next[diaId] !== undefined) {
        next[newId] = next[diaId];
        delete next[diaId];
      }
      return next;
    });

    setDiasCustomAlojMap(prev => {
      const next = { ...prev };
      if (next[diaId] !== undefined) {
        next[newId] = next[diaId];
        delete next[diaId];
      }
      return next;
    });

    setDiasTemposCompMap(prev => {
      const next = { ...prev };
      if (next[diaId] !== undefined) {
        next[newId] = next[diaId];
        delete next[diaId];
      }
      return next;
    });

    setDiasPercentualCumprimentoMap(prev => {
      const next = { ...prev };
      if (next[diaId] !== undefined) {
        next[newId] = next[diaId];
        delete next[diaId];
      }
      return next;
    });

    setDiasMotivoDescumprimentoMap(prev => {
      const next = { ...prev };
      if (next[diaId] !== undefined) {
        next[newId] = next[diaId];
        delete next[diaId];
      }
      return next;
    });

    setExpandedDayIds(prev => prev.map(id => (id === diaId ? newId : id)));

    toast.success(`Data do dia atualizada para ${format(newDate, 'dd/MM/yyyy')}.`);
  };

  // Handlers de Alojamento e Deslocamento
  const handleUpdateDiaAlojamento = (diaId: string, tipo: 'origem' | 'destino', alojNome: string) => {
    setDiasCustomAlojMap(prev => {
      const current = prev[diaId] || {};
      const next = {
        ...current,
        [tipo === 'origem' ? 'origem' : 'destino']: alojNome,
        tempoIdaMin: current.tempoIdaMin !== undefined ? current.tempoIdaMin : 40,
        tempoVoltaMin: current.tempoVoltaMin !== undefined ? current.tempoVoltaMin : 40,
      };
      return { ...prev, [diaId]: next };
    });
  };

  const handleUpdateDiaTempo = (diaId: string, tipo: 'ida' | 'volta', minutos: number) => {
    setDiasCustomAlojMap(prev => {
      const current = prev[diaId] || {};
      return {
        ...prev,
        [diaId]: {
          ...current,
          [tipo === 'ida' ? 'tempoIdaMin' : 'tempoVoltaMin']: minutos,
          [tipo === 'ida' ? 'manualIda' : 'manualVolta']: true,
        }
      };
    });
  };

  const handleUpdateDiaTempoComp = (diaId: string, field: 'saidaBase' | 'seguranca', minutos: number) => {
    setDiasTemposCompMap(prev => {
      const current = prev[diaId] || {};
      return {
        ...prev,
        [diaId]: {
          ...current,
          [field === 'saidaBase' ? 'tempoSaidaBaseMin' : 'tempoSegurancaMin']: minutos,
        }
      };
    });
  };

  const handleTogglePesDia = (diaId: string) => {
    setDiasPesMap(prev => ({
      ...prev,
      [diaId]: !prev[diaId]
    }));
  };

  const handleToggleReprogramarDia = (diaId: string) => {
    setDiasReprogramarMap(prev => {
      const nextVal = !prev[diaId];
      if (nextVal && !diasMotivoReprogramarMap[diaId]) {
        setDiasMotivoReprogramarMap(m => ({ ...m, [diaId]: MOTIVOS_REPROGRAMACAO_COL_AU[0] }));
      }
      return {
        ...prev,
        [diaId]: nextVal
      };
    });
  };

  // Handlers de Pontos
  const handleTogglePontoNoDia = (diaId: string, pontoLabel: string) => {
    const pUpper = pontoLabel.toUpperCase();
    setDiasPontosMap(prev => {
      const current = prev[diaId] || [];
      const isRemoving = current.includes(pontoLabel);
      const next = isRemoving
        ? current.filter(p => p !== pontoLabel)
        : [...current, pontoLabel];
      return { ...prev, [diaId]: next };
    });

    // Se o usuário desmarcou o ponto, limpa o estado customizado para restaurar as atividades originais ao selecionar novamente
    setDiasPontosGroupedMap(prev => {
      if (!prev || !prev[diaId] || !prev[diaId][pUpper]) return prev;
      const nextDay = { ...prev[diaId] };
      delete nextDay[pUpper];
      return { ...prev, [diaId]: nextDay };
    });
  };

  const handleResetPontoAtividades = (diaId: string, pontoLabel: string) => {
    const pUpper = pontoLabel.toUpperCase();
    setDiasPontosGroupedMap(prev => {
      if (!prev || !prev[diaId]) return prev;
      const nextDay = { ...prev[diaId] };
      delete nextDay[pUpper];
      return { ...prev, [diaId]: nextDay };
    });
    toast.success(`Atividades do ponto ${pUpper} restauradas para o padrão do orçamento.`);
  };

  const handleSelectAllPontosNoDia = (diaId: string) => {
    let pontosToSelect = pontosDisponiveisDoProjeto;
    if (planningMode === 'equipe') {
      const obraCode = diasObraEquipeMap[diaId] || '';
      if (obraCode && obraDataCache[obraCode]) {
        pontosToSelect = obraDataCache[obraCode].pontos;
      }
    }
    setDiasPontosMap(prev => ({
      ...prev,
      [diaId]: [...pontosToSelect]
    }));
    setDiasPontosGroupedMap(prev => {
      if (!prev || !prev[diaId]) return prev;
      const next = { ...prev };
      delete next[diaId];
      return next;
    });
    toast.success('Todos os pontos restaurados com suas atividades originais.');
  };

  const handleDeselectAllPontosNoDia = (diaId: string) => {
    setDiasPontosMap(prev => ({
      ...prev,
      [diaId]: []
    }));
    setDiasPontosGroupedMap(prev => {
      if (!prev || !prev[diaId]) return prev;
      const next = { ...prev };
      delete next[diaId];
      return next;
    });
    toast.success('Pontos do dia limpos.');
  };

  const handleAddCustomPontoNoDia = (diaId: string, customPontoName: string) => {
    if (!customPontoName.trim()) return;
    const pUpper = customPontoName.trim().toUpperCase();
    setDiasPontosMap(prev => {
      const current = prev[diaId] || [];
      if (current.includes(pUpper)) return prev;
      return { ...prev, [diaId]: [...current, pUpper] };
    });
    toast.success(`Ponto ${pUpper} adicionado ao dia.`);
  };

  // Distribuição Automática de Pontos
  const handleDistribuirPontosAuto = () => {
    if (pontosDisponiveisDoProjeto.length === 0) {
      toast.error('Nenhum ponto disponível para distribuir.');
      return;
    }
    if (diasProgramados.length === 0) {
      toast.error('Nenhum dia programado no período.');
      return;
    }
    const numDias = diasProgramados.length;
    const nextMap: Record<string, string[]> = {};
    diasProgramados.forEach((d, i) => {
      nextMap[d.id] = [];
    });
    pontosDisponiveisDoProjeto.forEach((p, idx) => {
      const targetDia = diasProgramados[idx % numDias];
      if (targetDia) {
        nextMap[targetDia.id].push(p);
      }
    });
    setDiasPontosMap(nextMap);
    toast.success(`${pontosDisponiveisDoProjeto.length} pontos distribuídos automaticamente entre os ${numDias} dias.`);
  };

  // Handlers de Atividades
  const handleAddAtividadeNoPonto = (diaId: string, pontoLabelTarget: string, customServico?: Partial<PcpPontoItem> | ServicoBase) => {
    const pUpper = (pontoLabelTarget || '').toUpperCase();
    const existing = getItemsDoPontoNoDia(diaId, pUpper);
    const existingServicos = new Set(existing.map(i => i.servico));
    const safeBase = Array.isArray(servicosBase) && servicosBase.length > 0 ? servicosBase : [];
    const fallback = safeBase.length > 0 ? safeBase[0] : { servico: 'INSTALAR ISOLADOR BASTAO/DISCO', tempoMinutosPorUnidade: 27, valorPorUnidade: 338.40 };
    const nextAvailable = customServico?.servico ? customServico : (safeBase.find(s => s && s.servico && !existingServicos.has(s.servico)) || fallback);

    const etapaSugerida = (customServico as any)?.etapaPrevista || inferEtapaFromServico(nextAvailable.servico) || 'IMPLANTAÇÃO';

    const newActivity: PcpPontoItem = {
      id: `${diaId}-${pUpper}-manual-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      ponto: pUpper,
      servico: nextAvailable.servico || 'ATIVIDADE',
      codigoMaterial: nextAvailable.codigo || '',
      qtdOrcadaPonto: 1,
      etapaPrevista: etapaSugerida,
      quantidade: 1,
      tempoEstimadoMinutos: nextAvailable.tempoMinutosPorUnidade || 60,
      valorEstimado: nextAvailable.valorPorUnidade || 100,
      valorUnitario: nextAvailable.valorPorUnidade || 100,
      tempoUnitarioMinutos: nextAvailable.tempoMinutosPorUnidade || 60,
      selected: true,
      isBudgeted: false,
      usaRetro: false,
      tempoRetroMinutos: 30,
    };

    setDiasPontosGroupedMap(prev => {
      const prevAll = prev || {};
      const prevDayMap = prevAll[diaId] || {};
      const currentList = prevDayMap[pUpper] || getItemsDoPontoNoDia(diaId, pUpper);
      return {
        ...prevAll,
        [diaId]: {
          ...prevDayMap,
          [pUpper]: [...currentList, newActivity]
        }
      };
    });
  };

  const handleUpdateAtividade = (
    diaId: string,
    pontoLabelTarget: string,
    itemIdOrIndex: string | number,
    field: keyof PcpPontoItem,
    value: any
  ) => {
    const pUpper = (pontoLabelTarget || '').toUpperCase();
    setDiasPontosGroupedMap(prev => {
      const prevAll = prev || {};
      const prevDayMap = prevAll[diaId] || {};
      const currentList = prevDayMap[pUpper] || getItemsDoPontoNoDia(diaId, pUpper);
      const items = [...currentList];
      const itemIndex = typeof itemIdOrIndex === 'number'
        ? itemIdOrIndex
        : items.findIndex(i => i.id === itemIdOrIndex);

      if (itemIndex === -1 || !items[itemIndex]) return prevAll;

      const target = { ...items[itemIndex] };
      const safeBase = Array.isArray(servicosBase) ? servicosBase : [];

      if (field === 'servico') {
        const found = safeBase.find(s => s && s.servico === value);
        target.servico = value;
        if (found) {
          target.valorUnitario = found.valorPorUnidade;
          target.tempoUnitarioMinutos = found.tempoMinutosPorUnidade;
          const baseTempo = Math.round(found.tempoMinutosPorUnidade * target.quantidade);
          target.tempoEstimadoMinutos = baseTempo + (target.usaRetro ? (target.tempoRetroMinutos ?? 30) : 0);
          target.valorEstimado = Math.round(found.valorPorUnidade * target.quantidade * 100) / 100;
        }
      } else if (field === 'quantidade') {
        const fallback = safeBase.length > 0 ? safeBase[0] : { servico: target.servico, tempoMinutosPorUnidade: 60, valorPorUnidade: 100 };
        const found = safeBase.find(s => s && s.servico === target.servico) || fallback;
        const unitVal = target.valorUnitario !== undefined ? target.valorUnitario : (found?.valorPorUnidade || 100);
        const unitTempo = target.tempoUnitarioMinutos !== undefined ? target.tempoUnitarioMinutos : (found?.tempoMinutosPorUnidade || 60);
        const qty = Math.max(1, Math.round(Number(value) || 1));
        target.quantidade = qty;
        target.valorUnitario = unitVal;
        target.tempoUnitarioMinutos = unitTempo;
        const baseTempo = Math.round(unitTempo * qty);
        target.tempoEstimadoMinutos = baseTempo + (target.usaRetro ? (target.tempoRetroMinutos ?? 30) : 0);
        target.valorEstimado = Math.round(unitVal * qty * 100) / 100;
      } else if (field === 'usaRetro') {
        target.usaRetro = Boolean(value);
        if (target.tempoRetroMinutos === undefined) target.tempoRetroMinutos = 30;
        const unitTempo = target.tempoUnitarioMinutos !== undefined ? target.tempoUnitarioMinutos : 25;
        const baseTempo = Math.round(unitTempo * target.quantidade);
        target.tempoEstimadoMinutos = baseTempo + (target.usaRetro ? target.tempoRetroMinutos : 0);
      } else if (field === 'tempoRetroMinutos') {
        const retroMin = Math.max(0, parseInt(String(value), 10) || 0);
        target.tempoRetroMinutos = retroMin;
        const unitTempo = target.tempoUnitarioMinutos !== undefined ? target.tempoUnitarioMinutos : 25;
        const baseTempo = Math.round(unitTempo * target.quantidade);
        target.tempoEstimadoMinutos = baseTempo + (target.usaRetro ? retroMin : 0);
      } else if (field === 'qtdOrcadaPonto') {
        target.qtdOrcadaPonto = Math.max(0.1, Number(value) || 1);
      } else if (field === 'etapaPrevista') {
        target.etapaPrevista = String(value);
      } else if (field === 'selected') {
        target.selected = Boolean(value);
      }

      items[itemIndex] = target;
      return {
        ...prevAll,
        [diaId]: {
          ...prevDayMap,
          [pUpper]: items
        }
      };
    });
  };

  const handleRemoveAtividade = (diaId: string, pontoLabelTarget: string, itemIdOrIndex: string | number) => {
    const pUpper = (pontoLabelTarget || '').toUpperCase();
    setDiasPontosGroupedMap(prev => {
      const prevAll = prev || {};
      const prevDayMap = prevAll[diaId] || {};
      const currentList = prevDayMap[pUpper] || getItemsDoPontoNoDia(diaId, pUpper);
      const items = [...currentList];
      const itemIndex = typeof itemIdOrIndex === 'number'
        ? itemIdOrIndex
        : items.findIndex(i => i.id === itemIdOrIndex);

      if (itemIndex !== -1) {
        items.splice(itemIndex, 1);
      }
      return {
        ...prevAll,
        [diaId]: {
          ...prevDayMap,
          [pUpper]: items
        }
      };
    });
  };

  // Atualização de Motivo de Descumprimento (Coluna AU) - Exclusivo para Plan_Principal
  const handleUpdateDiaMotivoDescumprimento = (diaId: string, motivo: string) => {
    setDiasMotivoDescumprimentoMap(prev => ({
      ...prev,
      [diaId]: motivo,
    }));
  };

  // Envio de Programação (usando salvarProgramacao.mutateAsync)
  const handleEnviarPlanPrincipalDia = async (diaId: string, equipeIdOverride?: string) => {
    // Resolver equipe e obra baseado no modo
    const equipeAtiva = equipeIdOverride || (selectedEquipes[0] || 'EH156');
    const compositeKey = planningMode === 'equipe' ? `${equipeAtiva}_${diaId}` : diaId;

    // Resolver obra: no modo equipe, busca do diasObraEquipeMap
    let obraParaEnviar: PcpObra | null = null;
    if (planningMode === 'equipe') {
      const obraCode = diasObraEquipeMap[compositeKey];
      if (!obraCode) {
        toast.error(`Nenhuma obra selecionada para ${equipeAtiva} no dia ${diaId}.`);
        return;
      }
      obraParaEnviar = obras.find(o => o.projeto === obraCode) || null;
      if (!obraParaEnviar) {
        toast.error(`Obra ${obraCode} não encontrada na carteira.`);
        return;
      }
    } else {
      if (!selectedObra) {
        toast.error('Nenhuma obra selecionada para enviar.');
        return;
      }
      obraParaEnviar = selectedObra;
    }

    const diaTarget = diasProgramados.find(d => d.id === diaId);
    if (!diaTarget) return;

    const etapaGeral = (diasEtapasMap[compositeKey] || ['IMPLANTAÇÃO'])[0] || 'IMPLANTAÇÃO';
    const isSemAtividadesPermitido = isEtapaSemAtividades(etapaGeral);

    const pontosDia = diasPontosMap[compositeKey] || [];
    const filtroLv = diasFiltroLvMap[compositeKey] || 'COMPLETO';
    const allActivitiesDia: PcpPontoItem[] = [];
    pontosDia.forEach(p => {
      const items = getItemsDoPontoNoDia(compositeKey, p);
      const filtered = items.filter(item => {
        if (!item.selected) return false;
        const isLv = (item.servico || '').toUpperCase().includes(' LV') || (item.descricaoMaterial || '').toUpperCase().includes(' LV');
        if (filtroLv === 'SOMENTE_LV' && !isLv) return false;
        if (filtroLv === 'SEM_LV' && isLv) return false;
        return true;
      });
      allActivitiesDia.push(...filtered);
    });

    if (allActivitiesDia.length === 0 && !isSemAtividadesPermitido) {
      toast.error(`O dia ${diaTarget.dataStr} não possui nenhuma atividade marcada. Selecione atividades ou altere a etapa para uma etapa sem atividades (ex: ${etapaGeral}).`);
      return;
    }

    try {
      // Resolver alojamento do dia (Ida = Origem / Volta = Destino)
      const diaIdx = diasProgramados.indexOf(diaTarget);
      const disp = getDayDisplacement(diaId, diaIdx, diasProgramados.length);
      const alojIda = disp.origemNome || alojamentoPadrao;
      const alojVolta = disp.destinoNome || alojamentoPadrao;

      const formPayload: PcpProgramacaoForm = {
        unidadeId: selectedUnidadeId,
        dataProgramacao: diaTarget.dataCompleta,
        dateObj: diaTarget.dateObj,
        supervisor,
        equipe: equipeAtiva,
        etapaGeral: etapaGeral,
        obra: obraParaEnviar,
        pontos: allActivitiesDia,
        isPes: diasPesMap[compositeKey] || false,
        reprogramar: diasReprogramarMap[compositeKey] || false,
        motivoReprogramacao: diasMotivoReprogramarMap[compositeKey] || '',
        motivoDescumprimento: diasMotivoDescumprimentoMap[compositeKey] || '',
        metaEquipeValor: metaEquipeInput,
        alojamentoIda: alojIda,
        alojamentoVolta: alojVolta,
        alojamento: alojIda === alojVolta ? alojIda : `${alojIda} ➔ ${alojVolta}`,
      };

      await salvarProgramacao.mutateAsync({
        forms: [formPayload],
        deletedSchedules: diasExcluidosList,
      });
      setDiasExcluidosList([]);
      toast.success(`Programação de ${equipeAtiva} - ${diaTarget.dataStr} enviada com sucesso!`, { id: 'salvar-programacao' });
    } catch (err: any) {
      toast.error(`Erro ao enviar dia: ${err.message || 'Erro inesperado'}`, { id: 'salvar-programacao' });
    }
  };


  const handleEnviarTodosOsDias = async () => {
    if (planningMode === 'obra' && !selectedObra) {
      toast.error('Selecione uma obra antes de enviar.');
      return;
    }

    try {
      toast.loading(`Enviando programação para a Plan_Principal...`, { id: 'salvar-programacao' });
      const allForms: PcpProgramacaoForm[] = [];
      const equipesToSend = selectedEquipes.length > 0 ? selectedEquipes : ['EH156'];

      if (planningMode === 'equipe') {
        // Modo equipe: iterar equipes × dias
        for (const eq of equipesToSend) {
          for (const d of diasProgramados) {
            const compositeKey = `${eq}_${d.id}`;
            const obraCode = diasObraEquipeMap[compositeKey];
            if (!obraCode) continue; // Sem obra selecionada, pula

            const obraDoSlot = obras.find(o => o.projeto === obraCode);
            if (!obraDoSlot) continue;

            const etapaGeral = (diasEtapasMap[compositeKey] || ['IMPLANTAÇÃO'])[0] || 'IMPLANTAÇÃO';
            const isSemAtividadesPermitido = isEtapaSemAtividades(etapaGeral);
            const pts = diasPontosMap[compositeKey] || [];
            const filtroLv = diasFiltroLvMap[compositeKey] || 'COMPLETO';
            const allActs: PcpPontoItem[] = [];
            pts.forEach(p => {
              const items = getItemsDoPontoNoDia(compositeKey, p);
              const filtered = items.filter(item => {
                if (!item.selected) return false;
                const isLv = (item.servico || '').toUpperCase().includes(' LV') || (item.descricaoMaterial || '').toUpperCase().includes(' LV');
                if (filtroLv === 'SOMENTE_LV' && !isLv) return false;
                if (filtroLv === 'SEM_LV' && isLv) return false;
                return true;
              });
              allActs.push(...filtered);
            });

            if (allActs.length === 0 && !isSemAtividadesPermitido) continue;

            const diaIdx = diasProgramados.indexOf(d);
            const disp = getDayDisplacement(d.id, diaIdx, diasProgramados.length);
            const alojIda = disp.origemNome || alojamentoPadrao;
            const alojVolta = disp.destinoNome || alojamentoPadrao;

            allForms.push({
              unidadeId: selectedUnidadeId,
              dataProgramacao: d.dataCompleta,
              dateObj: d.dateObj,
              supervisor,
              equipe: eq,
              etapaGeral: etapaGeral,
              obra: obraDoSlot,
              pontos: allActs,
              isPes: diasPesMap[compositeKey] || false,
              reprogramar: diasReprogramarMap[compositeKey] || false,
              motivoReprogramacao: diasMotivoReprogramarMap[compositeKey] || '',
              motivoDescumprimento: diasMotivoDescumprimentoMap[compositeKey] || '',
              metaEquipeValor: metaEquipeInput,
              alojamentoIda: alojIda,
              alojamentoVolta: alojVolta,
              alojamento: alojIda === alojVolta ? alojIda : `${alojIda} ➔ ${alojVolta}`,
            });
          }
        }
      } else {
        // Modo obra: comportamento original
        const diasComAtividadesOuEtapaPermitida = diasProgramados.filter(d => {
          const etapaGeral = (diasEtapasMap[d.id] || ['IMPLANTAÇÃO'])[0] || 'IMPLANTAÇÃO';
          const isSemAtividadesPermitido = isEtapaSemAtividades(etapaGeral);
          const pts = diasPontosMap[d.id] || [];
          const filtroLv = diasFiltroLvMap[d.id] || 'COMPLETO';
          const hasActs = pts.some(p =>
            getItemsDoPontoNoDia(d.id, p).some(i => {
              if (!i.selected) return false;
              const isLv = (i.servico || '').toUpperCase().includes(' LV') || (i.descricaoMaterial || '').toUpperCase().includes(' LV');
              if (filtroLv === 'SOMENTE_LV' && !isLv) return false;
              if (filtroLv === 'SEM_LV' && isLv) return false;
              return true;
            })
          );
          return hasActs || isSemAtividadesPermitido;
        });

        for (const d of diasComAtividadesOuEtapaPermitida) {
          const etapaGeral = (diasEtapasMap[d.id] || ['IMPLANTAÇÃO'])[0] || 'IMPLANTAÇÃO';
          const pts = diasPontosMap[d.id] || [];
          const filtroLv = diasFiltroLvMap[d.id] || 'COMPLETO';
          const allActs: PcpPontoItem[] = [];
          pts.forEach(p => {
            const items = getItemsDoPontoNoDia(d.id, p);
            const filtered = items.filter(item => {
              if (!item.selected) return false;
              const isLv = (item.servico || '').toUpperCase().includes(' LV') || (item.descricaoMaterial || '').toUpperCase().includes(' LV');
              if (filtroLv === 'SOMENTE_LV' && !isLv) return false;
              if (filtroLv === 'SEM_LV' && isLv) return false;
              return true;
            });
            allActs.push(...filtered);
          });

          for (const eq of equipesToSend) {
            const diaIdx = diasComAtividadesOuEtapaPermitida.indexOf(d);
            const disp = getDayDisplacement(d.id, diaIdx, diasComAtividadesOuEtapaPermitida.length);
            const alojIda = disp.origemNome || alojamentoPadrao;
            const alojVolta = disp.destinoNome || alojamentoPadrao;

            allForms.push({
              unidadeId: selectedUnidadeId,
              dataProgramacao: d.dataCompleta,
              dateObj: d.dateObj,
              supervisor,
              equipe: eq,
              etapaGeral: etapaGeral,
              obra: selectedObra!,
              pontos: allActs,
              isPes: diasPesMap[d.id] || false,
              reprogramar: diasReprogramarMap[d.id] || false,
              motivoReprogramacao: diasMotivoReprogramarMap[d.id] || '',
              motivoDescumprimento: diasMotivoDescumprimentoMap[d.id] || '',
              metaEquipeValor: metaEquipeInput,
              alojamentoIda: alojIda,
              alojamentoVolta: alojVolta,
              alojamento: alojIda === alojVolta ? alojIda : `${alojIda} ➔ ${alojVolta}`,
            });
          }
        }
      }

      if (allForms.length === 0 && diasExcluidosList.length === 0) {
        toast.error('Nenhum dia possui atividades marcadas ou etapa permitida sem atividades para envio.');
        return;
      }


      await salvarProgramacao.mutateAsync({
        forms: allForms,
        deletedSchedules: diasExcluidosList,
      });
      setDiasExcluidosList([]);
      toast.success(`Programação atualizada com sucesso na Plan_Principal!`, { id: 'salvar-programacao' });
    } catch (err: any) {
      toast.error(`Erro ao enviar dias: ${err.message || 'Erro inesperado'}`, { id: 'salvar-programacao' });
    }
  };

  // Limpeza de Tela
  const handleLimparTudoEmTela = () => {
    if (!window.confirm('Deseja realmente limpar todos os pontos, atividades e planejamentos montados na tela?')) {
      return;
    }
    setSelectedObraId('');
    setDiasPontosMap({});
    setDiasPontosGroupedMap({});
    setDiasReprogramarMap({});
    setDiasMotivoReprogramarMap({});
    setDiasPesMap({});
    setDiasEtapasMap({});
    setDiasCustomAlojMap({});
    setDiasMotivoDescumprimentoMap({});
    setDiasPercentualCumprimentoMap({});
    setDiasCarregadosList([]);
    toast.success('Planejamento e pontos em tela limpos com sucesso.');
  };

  // Sincronizar Google Sheets via API em Tempo Real
  const handleSyncFromGoogleSheets = async () => {
    if (!selectedUnidadeId) {
      toast.error('Selecione uma unidade antes de sincronizar.');
      return;
    }
    try {
      toast.loading('Sincronizando planilha do Google Sheets em tempo real...', { id: 'sync-sheets' });
      const res = await fetch('/api/sync-pcp-cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unidadeId: selectedUnidadeId }),
      });
      const data = await res.json();
      if (data.success) {
        await queryClient.invalidateQueries({ queryKey: ['pcp-planejamento-cache'] });
        await queryClient.invalidateQueries({ queryKey: ['pcp-orcamento-pontos'] });
        await rawCacheQuery.refetch();
        await orcamentoPontosQuery.refetch();
        toast.success('Planilha do Google Sheets sincronizada em tempo real!', { id: 'sync-sheets' });
      } else {
        toast.error('Erro ao sincronizar: ' + (data.error || 'Erro desconhecido'), { id: 'sync-sheets' });
      }
    } catch (e: any) {
      toast.error('Falha na comunicação com o servidor: ' + e.message, { id: 'sync-sheets' });
    }
  };

  // Carregar Planejamentos Selecionados
  const handleCarregarPlanejamentosSelecionados = (plansToLoad: ParsedPlanejamentoExistente[]) => {
    if (!plansToLoad || plansToLoad.length === 0) {
      toast.error('Nenhum planejamento selecionado para carregar.');
      return;
    }

    const isEquipe = planningMode === 'equipe';

    if (isEquipe) {
      const distinctEquipes = Array.from(new Set(plansToLoad.map(p => p.equipe).filter(Boolean)));
      if (distinctEquipes.length > 0) {
        setSelectedEquipes(prev => Array.from(new Set([...prev, ...distinctEquipes])));
        setExpandedEquipeIds(prev => Array.from(new Set([...prev, ...distinctEquipes])));
      }
    } else {
      const firstPlan = plansToLoad[0];
      const obraEncontrada = obras.find(o => o.projeto === firstPlan.projeto);
      if (obraEncontrada) {
        setSelectedObraId(obraEncontrada.projeto);
      } else {
        setSelectedObraId(firstPlan.projeto);
      }
      if (firstPlan.supervisor) setSupervisor(firstPlan.supervisor);
      const distinctEquipes = Array.from(new Set(plansToLoad.map(p => p.equipe).filter(Boolean)));
      if (distinctEquipes.length > 0) setSelectedEquipes(distinctEquipes);
    }

    // 1. Extrair e ordenar todas as datas dos planejamentos selecionados via regex robusto
    const dateMap = new Map<string, Date>(); // key: 'yyyy-MM-dd', value: Date
    plansToLoad.forEach(plan => {
      const dStr = plan.dataCompleta || plan.dataStr || '';
      const match = dStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (match) {
        const day = Number(match[1]);
        const month = Number(match[2]);
        const year = Number(match[3]);
        const d = new Date(year, month - 1, day);
        const dayId = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        dateMap.set(dayId, d);
      }
    });

    const sortedDayKeys = Array.from(dateMap.keys()).sort();

    // 2. Carregar EXATAMENTE os dias dos planejamentos selecionados sem alterar o calendário de novos planejamentos
    setDiasDateOverrideMap({});
    if (sortedDayKeys.length > 0) {
      setDiasCarregadosList(sortedDayKeys);
      setExpandedDayIds(sortedDayKeys);
    }

    // 3. Montar mapas limpos apenas com os dados dos planejamentos carregados
    const nextDiasPontosMap: Record<string, string[]> = isEquipe ? { ...diasPontosMap } : {};
    const nextDiasPontosGroupedMap: Record<string, Record<string, PcpPontoItem[]>> = isEquipe ? { ...diasPontosGroupedMap } : {};
    const nextDiasEtapasMap: Record<string, string[]> = isEquipe ? { ...diasEtapasMap } : {};
    const nextDiasPesMap: Record<string, boolean> = isEquipe ? { ...diasPesMap } : {};
    const nextDiasPercentualCumprimentoMap: Record<string, string> = isEquipe ? { ...diasPercentualCumprimentoMap } : {};
    const nextDiasMotivoDescumprimentoMap: Record<string, string> = isEquipe ? { ...diasMotivoDescumprimentoMap } : {};
    const nextDiasCustomAlojMap: Record<string, any> = { ...diasCustomAlojMap };
    const nextDiasObraEquipeMap: Record<string, string> = { ...diasObraEquipeMap };

    plansToLoad.forEach(plan => {
      let dayId = '';
      const dStr = plan.dataCompleta || plan.dataStr || '';
      const match = dStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (match) {
        const day = Number(match[1]);
        const month = Number(match[2]);
        const year = Number(match[3]);
        dayId = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }

      const mapKey = (isEquipe && plan.equipe) ? `${plan.equipe}_${dayId}` : dayId;

      if (dayId) {
        if (isEquipe && plan.equipe) {
          nextDiasObraEquipeMap[mapKey] = plan.projeto;
        }

        if (plan.etapasGeral && plan.etapasGeral.length > 0) {
          nextDiasEtapasMap[mapKey] = plan.etapasGeral;
        }
        if (plan.isPes !== undefined) {
          nextDiasPesMap[mapKey] = plan.isPes;
        }
        if (plan.percentualCumprimento) {
          nextDiasPercentualCumprimentoMap[mapKey] = plan.percentualCumprimento;
        }
        if (plan.motivoDescumprimento) {
          nextDiasMotivoDescumprimentoMap[mapKey] = plan.motivoDescumprimento;
        }
        if (plan.alojamentoIda || plan.alojamentoVolta || plan.alojamento) {
          nextDiasCustomAlojMap[mapKey] = {
            ...nextDiasCustomAlojMap[mapKey],
            origem: plan.alojamentoIda || plan.alojamento || 'BASE',
            destino: plan.alojamentoVolta || plan.alojamento || 'BASE',
          };
        }
      }

      // Reúne todos os pontos do plano (da Coluna I e do compilado da Coluna O)
      const allPontosSet = new Set<string>();
      (plan.pontos || []).forEach(p => allPontosSet.add(p.toUpperCase()));
      (plan.parsedAtividades || []).forEach(a => {
        if (a.ponto) allPontosSet.add(a.ponto.toUpperCase());
      });

      const pontosLista = Array.from(allPontosSet);

      if (dayId) {
        nextDiasPontosMap[mapKey] = pontosLista;
        if (!nextDiasPontosGroupedMap[mapKey]) nextDiasPontosGroupedMap[mapKey] = {};
      }

      pontosLista.forEach(pUpper => {
        const ativsDoPonto = (plan.parsedAtividades || []).filter(a => (a.ponto || '').toUpperCase() === pUpper);
        const budgetItems = (isEquipe
          ? obraDataCache[plan.projeto]?.orcamento?.get(pUpper)
          : orcamentoPorPontoMap.get(pUpper)) || [];
        const combinedItems: PcpPontoItem[] = [];

        if (ativsDoPonto.length > 0) {
          ativsDoPonto.forEach((a, aIdx) => {
            const matchedBudget = budgetItems.find(b =>
              (b.servicoPrevisto || '').toUpperCase().includes((a.servico || '').toUpperCase())
            );
            const servBase = servicosBase.find(s =>
              (s.servico || '').toUpperCase() === (a.servico || '').toUpperCase() ||
              (a.servico || '').toUpperCase().includes((s.servico || '').toUpperCase()) ||
              (s.servico || '').toUpperCase().includes((a.servico || '').toUpperCase())
            );

            const vUnit = matchedBudget?.valorUnitario || servBase?.valorPorUnidade || (a.quantidade > 0 ? (matchedBudget?.valorEstimado ? matchedBudget.valorEstimado / (matchedBudget.quantidade || 1) : 0) : 0);
            const tUnit = matchedBudget?.tempoUnitarioMinutos || servBase?.tempoMinutosPorUnidade || 15;
            const tTotal = a.tempoMinutos || (tUnit * (a.quantidade || 1));
            const vTotal = vUnit > 0 ? vUnit * (a.quantidade || 1) : (matchedBudget?.valorEstimado || 0);

            combinedItems.push({
              id: `loaded-${mapKey || 'day'}-${pUpper}-${aIdx}`,
              ponto: pUpper,
              servico: a.servico,
              codigoMaterial: matchedBudget?.codigo || servBase?.codigo || '',
              descricaoMaterial: matchedBudget?.descricao || a.servico,
              qtdOrcadaPonto: matchedBudget?.quantidade || a.quantidade,
              etapaPrevista: a.etapa || matchedBudget?.etapaPrevista || (pUpper.startsWith('V') ? 'LANÇAMENTO DE CABO' : 'IMPLANTAÇÃO'),
              quantidade: a.quantidade,
              valorUnitario: vUnit,
              tempoEstimadoMinutos: tTotal,
              tempoUnitarioMinutos: tUnit,
              valorEstimado: vTotal,
              selected: true,
              isBudgeted: Boolean(matchedBudget),
              usaRetro: false,
              tempoRetroMinutos: 30,
            });
          });
        } else if (budgetItems.length > 0) {
          budgetItems.forEach((bItem, bIdx) => {
            combinedItems.push({
              id: `budget-${mapKey || 'day'}-${pUpper}-${bIdx}`,
              ponto: pUpper,
              servico: bItem.servicoPrevisto || bItem.descricao,
              codigoMaterial: bItem.codigo,
              descricaoMaterial: bItem.descricao,
              qtdOrcadaPonto: bItem.quantidade || 1,
              etapaPrevista: bItem.etapaPrevista || (pUpper.startsWith('V') ? 'LANÇAMENTO DE CABO' : 'IMPLANTAÇÃO'),
              quantidade: bItem.quantidade || 1,
              valorUnitario: bItem.valorUnitario,
              tempoEstimadoMinutos: bItem.tempoMinutos || 15,
              tempoUnitarioMinutos: bItem.tempoUnitarioMinutos || 15,
              valorEstimado: bItem.valorEstimado || 0,
              selected: true,
              isBudgeted: true,
              usaRetro: false,
              tempoRetroMinutos: 30,
            });
          });
        } else {
          const isVao = pUpper.startsWith('V');
          const defaultServico = isVao ? 'LANÇAMENTO DE CABO MULTIPLEXADO' : 'INSTALAR POSTE 9 A 14 METROS';
          const defaultEtapa = isVao ? 'LANÇAMENTO DE CABO' : 'IMPLANTAÇÃO';
          const servBase = servicosBase.find(s => s.servico.toUpperCase().includes(defaultServico)) || {
            codigo: isVao ? 'SIR0000002' : 'SIR0000001',
            servico: defaultServico,
            tempoMinutosPorUnidade: isVao ? 20 : 60,
            valorPorUnidade: isVao ? 50 : 100,
          };
          combinedItems.push({
            id: `default-${mapKey || 'day'}-${pUpper}-0`,
            ponto: pUpper,
            servico: defaultServico,
            codigoMaterial: servBase.codigo || '',
            descricaoMaterial: defaultServico,
            qtdOrcadaPonto: 1,
            etapaPrevista: defaultEtapa,
            quantidade: 1,
            valorUnitario: servBase.valorPorUnidade,
            tempoEstimadoMinutos: servBase.tempoMinutosPorUnidade,
            tempoUnitarioMinutos: servBase.tempoMinutosPorUnidade,
            valorEstimado: servBase.valorPorUnidade,
            selected: true,
            isBudgeted: false,
            usaRetro: false,
            tempoRetroMinutos: 30,
          });
        }

        if (dayId) {
          if (!nextDiasPontosGroupedMap[mapKey]) nextDiasPontosGroupedMap[mapKey] = {};
          nextDiasPontosGroupedMap[mapKey][pUpper] = combinedItems;
        }
      });
    });

    setDiasPontosMap(nextDiasPontosMap);
    setDiasPontosGroupedMap(nextDiasPontosGroupedMap);
    setDiasEtapasMap(nextDiasEtapasMap);
    setDiasPesMap(nextDiasPesMap);
    setDiasPercentualCumprimentoMap(nextDiasPercentualCumprimentoMap);
    setDiasMotivoDescumprimentoMap(nextDiasMotivoDescumprimentoMap);
    setDiasCustomAlojMap(nextDiasCustomAlojMap);
    if (isEquipe) {
      setDiasObraEquipeMap(nextDiasObraEquipeMap);
    }
    setIsCarregarPlanModalOpen(false);
    setSelectedExistingPlanKeys([]);
    toast.success(`${plansToLoad.length} ${plansToLoad.length === 1 ? 'planejamento carregado' : 'planejamentos carregados'} com sucesso.`);
  };

  // Resumo de Status do Fluxo para as Pílulas do Header
  const diasSemPontosCount = diasProgramados.filter(d => {
    const etapaGeral = (diasEtapasMap[d.id] || ['IMPLANTAÇÃO'])[0] || 'IMPLANTAÇÃO';
    if (isEtapaSemAtividades(etapaGeral)) return false;
    return (diasPontosMap[d.id] || []).length === 0;
  }).length;
  const diasAcima10hCount = diasProgramados.filter((d, idx) => {
    const pts = diasPontosMap[d.id] || [];
    const filtroLv = diasFiltroLvMap[d.id] || 'COMPLETO';
    const tComp = diasTemposCompMap[d.id];
    const sBase = tComp?.tempoSaidaBaseMin ?? tempoSaidaBasePadrao;
    const sSeg = tComp?.tempoSegurancaMin ?? tempoSegurancaPadrao;
    const disp = getDayDisplacement(d.id, idx, diasProgramados.length);
    let totMin = sBase + sSeg + disp.tempoIdaMin + disp.tempoVoltaMin;

    pts.forEach(p => {
      totMin += getItemsDoPontoNoDia(d.id, p).filter(i => {
        if (!i.selected) return false;
        const isLv = (i.servico || '').toUpperCase().includes(' LV') || (i.descricaoMaterial || '').toUpperCase().includes(' LV');
        if (filtroLv === 'SOMENTE_LV' && !isLv) return false;
        if (filtroLv === 'SEM_LV' && isLv) return false;
        return true;
      }).reduce((acc, i) => acc + (i.tempoEstimadoMinutos || 0), 0);
    });
    return totMin / 60 > 10.0;
  }).length;

  // Totais do Período para o Totalizador da Grade
  let totalPontosPeriodo = 0;
  let totalHorasPeriodoMin = 0;
  let totalValorPeriodo = 0;
  let totalDeslocamentoPeriodoMin = 0;
  let totalCompPeriodoMin = 0;

  diasProgramados.forEach((d, idx) => {
    const pts = diasPontosMap[d.id] || [];
    totalPontosPeriodo += pts.length;

    const tComp = diasTemposCompMap[d.id];
    const sBase = tComp?.tempoSaidaBaseMin ?? tempoSaidaBasePadrao;
    const sSeg = tComp?.tempoSegurancaMin ?? tempoSegurancaPadrao;
    const disp = getDayDisplacement(d.id, idx, diasProgramados.length);
    const ida = disp.tempoIdaMin;
    const volta = disp.tempoVoltaMin;
    const filtroLv = diasFiltroLvMap[d.id] || 'COMPLETO';

    let servMin = 0;
    pts.forEach(p => {
      getItemsDoPontoNoDia(d.id, p).forEach(i => {
        const isLv = (i.servico || '').toUpperCase().includes(' LV') || (i.descricaoMaterial || '').toUpperCase().includes(' LV');
        if (filtroLv === 'SOMENTE_LV' && !isLv) return;
        if (filtroLv === 'SEM_LV' && isLv) return;

        if (i.selected) {
          servMin += (i.tempoEstimadoMinutos || 0);
          totalValorPeriodo += (i.valorEstimado || 0);
        }
      });
    });

    const totDiaMin = sBase + ida + sSeg + servMin + volta;
    totalHorasPeriodoMin += totDiaMin;
    totalDeslocamentoPeriodoMin += (ida + volta);
    totalCompPeriodoMin += (sBase + sSeg + ida + volta);
  });

  const metaTotalPeriodo = metaEquipeInput * Math.max(1, diasProgramados.length);
  const pctMetaTotal = metaTotalPeriodo > 0 ? Math.round((totalValorPeriodo / metaTotalPeriodo) * 100) : 0;
  const metaColorPeriodo = getMetaColorScale(pctMetaTotal);

  // Filtros Existentes Modal
  const filteredExistingPlans = useMemo(() => {
    const list = planejamentosExistentesList || [];
    return list.filter(p => {
      if (filterEquipesExistingPlan.length > 0 && !filterEquipesExistingPlan.map(e => e.toUpperCase()).includes(p.equipe.toUpperCase())) {
        return false;
      }
      if (filterOnlyCurrentObra && selectedObraId && p.projeto !== selectedObraId) {
        return false;
      }
      if (filterDataInicioExistingPlan || filterDataFimExistingPlan) {
        const dStr = p.dataCompleta || p.dataStr || '';
        const match = dStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (match) {
          const iso = `${match[3]}-${String(match[2]).padStart(2, '0')}-${String(match[1]).padStart(2, '0')}`;
          if (filterDataInicioExistingPlan && iso < filterDataInicioExistingPlan) return false;
          if (filterDataFimExistingPlan && iso > filterDataFimExistingPlan) return false;
        }
      }
      if (searchExistingPlan.trim()) {
        const q = searchExistingPlan.toLowerCase();
        const matchesProj = (p.projeto || '').toLowerCase().includes(q);
        const matchesEq = (p.equipe || '').toLowerCase().includes(q);
        const matchesSup = (p.supervisor || '').toLowerCase().includes(q);
        const matchesData = (p.dataCompleta || '').toLowerCase().includes(q);
        if (!matchesProj && !matchesEq && !matchesSup && !matchesData) return false;
      }
      return true;
    });
  }, [
    planejamentosExistentesList,
    filterEquipesExistingPlan,
    filterOnlyCurrentObra,
    filterDataInicioExistingPlan,
    filterDataFimExistingPlan,
    selectedObraId,
    searchExistingPlan,
  ]);

  return (
    <div
      className="flex flex-col gap-3.5 p-3.5 sm:p-5 w-full min-h-screen bg-[#F7F6F3] text-[#23211E] font-sans antialiased"
      style={{ zoom: zoomLevel } as React.CSSProperties}
    >
      {/* 3.1 HEADER FIXO */}
      <header className="sticky top-0 z-30 bg-[#F7F6F3]/95 backdrop-blur border border-[#E6E3DD] rounded-xl p-3.5 shadow-xs space-y-3">
        {/* Linha 1: Título e Ações */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-[3.5px] h-8 bg-gradient-to-b from-[#E07A1F] to-[#E07A1F]/30 rounded-full shrink-0" />
            <div>
              <span className="text-[11px] uppercase tracking-[0.12em] font-mono text-[#A39E96] block leading-none font-semibold">
                MÓDULO PCP · PLANEJAMENTO
              </span>
              <div className="flex items-center gap-2.5 mt-1">
                <h1 className="text-[18px] font-bold text-[#23211E] leading-tight">
                  {selectedObra
                    ? `${selectedObra.projeto} · ${selectedObra.municipio}`
                    : selectedUnidadeObj
                      ? `Unidade: ${selectedUnidadeObj.name} (Selecione uma obra)`
                      : 'Selecione uma unidade'}
                </h1>
                <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-[#F2F0EC] text-[#5C574F] border border-[#DEDAD3]">
                  Ambiente local
                </span>
              </div>
            </div>
          </div>

          {/* Botões de Ação do Header */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEnvioModalOpen(true)}
              className="h-[32px] px-3.5 text-xs font-semibold bg-white border-[#DEDAD3] text-[#23211E] hover:bg-[#FBF5EC] hover:border-[#E8C9A0] shadow-2xs"
            >
              <Mail className="w-3.5 h-3.5 mr-1.5 text-[#E07A1F]" /> Envio Planejamento
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCarregarPlanModalOpen(true)}
              className="h-[32px] px-3.5 text-xs font-semibold bg-white border-[#DEDAD3] text-[#23211E] hover:bg-[#FBF5EC] hover:border-[#E8C9A0] shadow-2xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5 text-[#E07A1F]" /> Carregar planejamento
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncFromGoogleSheets}
              className="h-[32px] px-3.5 text-xs font-semibold bg-white border-[#DEDAD3] text-[#23211E] hover:bg-[#FBF5EC] shadow-2xs"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5 text-[#5C574F]" /> Sincronizar Sheets
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleLimparTudoEmTela}
              className="h-[32px] px-3.5 text-xs font-semibold bg-white border-[#DEDAD3] text-[#A39E96] hover:text-[#C0392E] hover:bg-[#F9E4E1]/50 shadow-2xs"
            >
              <Eraser className="w-3.5 h-3.5 mr-1.5" /> Limpar tela
            </Button>

            {/* Controle de Zoom */}
            <div className="inline-flex items-center rounded-md border border-[#DEDAD3] bg-white h-[32px] px-1 text-xs font-mono font-bold shadow-2xs">
              <button
                type="button"
                onClick={handleZoomOut}
                className="px-2 text-[#6B6660] hover:text-[#23211E] font-bold text-sm"
                title="Diminuir zoom"
              >
                −
              </button>
              <button
                type="button"
                onClick={handleResetZoom}
                className="px-1 text-[#5C574F] hover:text-[#23211E]"
                title="Redefinir zoom (100%)"
              >
                {Math.round(zoomLevel * 100)}%
              </button>
              <button
                type="button"
                onClick={handleZoomIn}
                className="px-2 text-[#6B6660] hover:text-[#23211E] font-bold text-sm"
                title="Aumentar zoom"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Linha 2: Pílulas de Etapas do Fluxo */}
        <div className="flex items-center gap-2.5 overflow-x-auto text-xs font-medium pt-1 border-t border-[#E6E3DD]/70">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[#E6E3DD] whitespace-nowrap shadow-2xs">
            <span className={`w-2 h-2 rounded-full ${selectedObra ? 'bg-[#17794C]' : 'bg-[#C9A227]'}`} />
            <span className="text-[#5C574F]">Obra:</span>
            <strong className="text-[#23211E] font-mono font-bold">{selectedObra ? `${selectedObra.projeto} selecionada` : 'nenhuma'}</strong>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[#E6E3DD] whitespace-nowrap shadow-2xs">
            <span className={`w-2 h-2 rounded-full ${selectedUnidadeObj ? 'bg-[#17794C]' : 'bg-[#C9A227]'}`} />
            <span className="text-[#5C574F]">Equipe e período:</span>
            <strong className="text-[#23211E]">
              {selectedUnidadeObj ? `${selectedEquipes.join(', ')} · ${diasProgramados.length} ${diasProgramados.length === 1 ? 'dia' : 'dias'} · ${alojamentoPadrao}` : 'selecione a unidade'}
            </strong>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[#E6E3DD] whitespace-nowrap shadow-2xs">
            <span className={`w-2 h-2 rounded-full ${selectedObra ? (diasSemPontosCount === 0 ? 'bg-[#17794C]' : 'bg-[#C9A227]') : 'bg-[#A39E96]'}`} />
            <span className="text-[#5C574F]">Distribuição:</span>
            <strong className="text-[#23211E]">
              {!selectedObra
                ? 'aguardando obra'
                : diasSemPontosCount === 0
                  ? 'todos os dias com pontos'
                  : diasSemPontosCount === 1
                    ? '1 dia ainda sem pontos'
                    : `${diasSemPontosCount} dias ainda sem pontos`}
            </strong>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[#E6E3DD] whitespace-nowrap shadow-2xs">
            <span className={`w-2 h-2 rounded-full ${selectedObra ? (diasAcima10hCount > 0 ? 'bg-[#C0392E]' : 'bg-[#17794C]') : 'bg-[#A39E96]'}`} />
            <span className="text-[#5C574F]">Envio:</span>
            <strong className={!selectedObra ? 'text-[#A39E96]' : (diasAcima10hCount > 0 ? 'text-[#B03028]' : 'text-[#17794C]')}>
              {!selectedObra
                ? 'aguardando obra'
                : diasAcima10hCount > 0
                  ? `${diasAcima10hCount} ${diasAcima10hCount === 1 ? 'dia acima de 10h' : 'dias acima de 10h'}`
                  : 'pronto para enviar'}
            </strong>
          </div>
        </div>
      </header>

      {/* 3.2 BARRA DE FILTROS */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        {/* Unidade */}
        <Select value={selectedUnidadeId || 'SELECIONE'} onValueChange={val => handleUnidadeChange(val === 'SELECIONE' ? '' : val)}>
          <SelectTrigger className={`h-8 text-xs border font-medium ${selectedUnidadeId ? 'bg-[#FBF5EC] border-[#E8C9A0] text-[#A06A16] font-bold' : 'bg-white border-[#DEDAD3] text-[#5C574F]'}`}>
            <span className="text-[11px] uppercase text-[#A39E96] mr-1.5 font-semibold">Unidade</span>
            <span className="truncate">{selectedUnidadeObj?.name || 'Selecione a Unidade...'}</span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="SELECIONE" className="text-xs text-[#A39E96] font-medium">
              — Limpar / Nenhuma —
            </SelectItem>
            {UNIDADES_DISPONIVEIS.map(u => (
              <SelectItem key={u.id} value={u.id} className="text-xs font-semibold">
                {u.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Toggle: Modo de Planejamento */}
        <div className="inline-flex items-center rounded-lg border border-[#DEDAD3] bg-[#F2F0EC] p-0.5 text-xs font-semibold shrink-0 shadow-2xs">
          <button
            type="button"
            onClick={() => handleTogglePlanningMode('obra')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
              planningMode === 'obra'
                ? 'bg-white text-[#23211E] shadow-2xs border border-[#DEDAD3]'
                : 'text-[#6B6660] hover:text-[#23211E] hover:bg-white/50'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5 text-[#E07A1F]" />
            <span>Por Obra</span>
          </button>
          <button
            type="button"
            onClick={() => handleTogglePlanningMode('equipe')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
              planningMode === 'equipe'
                ? 'bg-white text-[#23211E] shadow-2xs border border-[#DEDAD3]'
                : 'text-[#6B6660] hover:text-[#23211E] hover:bg-white/50'
            }`}
          >
            <UsersRound className="w-3.5 h-3.5 text-[#E07A1F]" />
            <span>Por Equipe</span>
          </button>
        </div>

        {/* Situação */}
        <Select value={selectedSituacao} onValueChange={setSelectedSituacao} disabled={!selectedUnidadeId}>
          <SelectTrigger className={`h-8 text-xs border font-medium ${selectedSituacao !== 'TODAS' ? 'bg-[#FBF5EC] border-[#E8C9A0] text-[#A06A16] font-bold' : 'bg-white border-[#DEDAD3] text-[#5C574F]'}`}>
            <span className="text-[11px] uppercase text-[#A39E96] mr-1.5 font-semibold">Situação</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="APTA" className="text-xs font-semibold text-emerald-600">Apta</SelectItem>
            <SelectItem value="INAPTA" className="text-xs font-semibold text-rose-600">Inapta</SelectItem>
            <SelectItem value="TODAS" className="text-xs font-semibold">Todas</SelectItem>
          </SelectContent>
        </Select>

        {/* Status */}
        <Popover open={isStatusPopoverOpen} onOpenChange={setIsStatusPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={!selectedUnidadeId}
              className={`h-8 text-xs border font-medium ${selectedStatuses.length < ALL_STATUSES.length ? 'bg-[#FBF5EC] border-[#E8C9A0] text-[#A06A16] font-bold' : 'bg-white border-[#DEDAD3] text-[#5C574F]'}`}
            >
              <span className="text-[11px] uppercase text-[#A39E96] mr-1.5 font-semibold">Status</span>
              <span>({selectedStatuses.length})</span>
              <ChevronDown className="w-3.5 h-3.5 ml-1.5 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[220px] p-2.5 bg-white" align="start">
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between pb-1.5 border-b border-[#E6E3DD] text-xs font-bold text-[#5C574F]">
                <span>Status da carteira</span>
                <button
                  type="button"
                  onClick={() => setSelectedStatuses(ALL_STATUSES)}
                  className="text-[#E07A1F] hover:underline"
                >
                  Todos
                </button>
              </div>
              {ALL_STATUSES.map(st => {
                const isChecked = selectedStatuses.includes(st);
                return (
                  <label key={st} className="flex items-center gap-2 p-1.5 rounded hover:bg-[#FBF5EC] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {
                        setSelectedStatuses(prev =>
                          prev.includes(st) ? prev.filter(x => x !== st) : [...prev, st]
                        );
                      }}
                      className="rounded border-[#DEDAD3] text-[#E07A1F] focus:ring-[#E07A1F] h-4 w-4"
                    />
                    <span>{st}</span>
                  </label>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>

        {/* Mês */}
        <Select value={selectedMesFilter} onValueChange={setSelectedMesFilter} disabled={!selectedUnidadeId}>
          <SelectTrigger className={`h-8 text-xs border font-medium ${selectedMesFilter !== 'TODOS' ? 'bg-[#FBF5EC] border-[#E8C9A0] text-[#A06A16] font-bold' : 'bg-white border-[#DEDAD3] text-[#5C574F]'}`}>
            <span className="text-[11px] uppercase text-[#A39E96] mr-1.5 font-semibold">Mês</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS" className="text-xs font-semibold">Todos os meses ({obras.length})</SelectItem>
            {mesesCarteira.map(m => (
              <SelectItem key={m} value={m} className="text-xs font-mono">{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Município */}
        <Select value={selectedMunicipioFilter} onValueChange={setSelectedMunicipioFilter} disabled={!selectedUnidadeId}>
          <SelectTrigger className={`h-8 text-xs border font-medium ${selectedMunicipioFilter !== 'TODOS' ? 'bg-[#FBF5EC] border-[#E8C9A0] text-[#A06A16] font-bold' : 'bg-white border-[#DEDAD3] text-[#5C574F]'}`}>
            <span className="text-[11px] uppercase text-[#A39E96] mr-1.5 font-semibold">Município</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS" className="text-xs font-semibold">Todos os municípios</SelectItem>
            {municipiosCarteira.map(mun => (
              <SelectItem key={mun} value={mun} className="text-xs">{mun}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Prioridade */}
        <Select value={selectedPrioridadeFilter} onValueChange={setSelectedPrioridadeFilter} disabled={!selectedUnidadeId}>
          <SelectTrigger className={`h-8 text-xs border font-medium ${selectedPrioridadeFilter !== 'TODAS' ? 'bg-[#FBF5EC] border-[#E8C9A0] text-[#A06A16] font-bold' : 'bg-white border-[#DEDAD3] text-[#5C574F]'}`}>
            <span className="text-[11px] uppercase text-[#A39E96] mr-1.5 font-semibold">Prioridade</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODAS" className="text-xs font-semibold">Todas as prioridades</SelectItem>
            {prioridadesCarteira.map(p => (
              <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Dono */}
        <Select value={selectedDonoFilter} onValueChange={setSelectedDonoFilter} disabled={!selectedUnidadeId}>
          <SelectTrigger className={`h-8 text-xs border font-medium ${selectedDonoFilter !== 'TODOS' ? 'bg-[#FBF5EC] border-[#E8C9A0] text-[#A06A16] font-bold' : 'bg-white border-[#DEDAD3] text-[#5C574F]'}`}>
            <span className="text-[11px] uppercase text-[#A39E96] mr-1.5 font-semibold">Dono</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS" className="text-xs font-semibold">Todos os donos</SelectItem>
            {donosCarteira.map(d => (
              <SelectItem key={d} value={d} className="text-xs">{d}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Supervisor */}
        <Select value={selectedSupervisorFilter} onValueChange={setSelectedSupervisorFilter} disabled={!selectedUnidadeId}>
          <SelectTrigger className={`h-8 text-xs border font-medium ${selectedSupervisorFilter !== 'TODOS' ? 'bg-[#FBF5EC] border-[#E8C9A0] text-[#A06A16] font-bold' : 'bg-white border-[#DEDAD3] text-[#5C574F]'}`}>
            <span className="text-[11px] uppercase text-[#A39E96] mr-1.5 font-semibold">Supervisor</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS" className="text-xs font-semibold">Todos os supervisores</SelectItem>
            {supervisoresCarteira.map(s => (
              <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Limpar Filtros */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClearFilters}
          className="h-8 px-3 text-xs font-semibold text-[#A39E96] hover:text-[#23211E] whitespace-nowrap"
        >
          Limpar filtros
        </Button>
      </div>

      {/* 3.3 GRID PRINCIPAL */}
      <div className={`grid gap-4 items-start ${planningMode === 'obra' ? 'grid-cols-1 xl:grid-cols-[330px_1fr]' : 'grid-cols-1'}`}>
        {/* COLUNA ESQUERDA (FIXA / STICKY) - Apenas no modo Obra */}
        {planningMode === 'obra' && (
        <aside className="space-y-3.5 xl:sticky xl:top-[125px]">
          {/* Card 1: Carteira de Obras */}
          <div className="bg-white rounded-xl border border-[#E6E3DD] p-3.5 shadow-2xs space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#23211E] flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-[#E07A1F]" /> Carteira de obras
              </span>
              <span className="text-xs font-mono font-bold text-[#5C574F]">({filteredObras.length})</span>
            </div>

            {/* Busca de Obra */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#A39E96]" />
              <input
                placeholder="Buscar código, município..."
                value={searchObra}
                disabled={!selectedUnidadeId}
                onChange={e => setSearchObra(e.target.value)}
                className="w-full h-8 pl-8 pr-2 text-xs rounded-md border border-[#DEDAD3] bg-[#F7F6F3] focus:outline-none focus:ring-1 focus:ring-[#E07A1F] font-mono disabled:opacity-50"
              />
            </div>

            {/* Lista Rolável de Obras (440px) */}
            <div className="h-[440px] overflow-y-auto space-y-2 pr-0.5 custom-scrollbar">
              {!selectedUnidadeId ? (
                <div className="flex flex-col items-center justify-center h-full py-16 text-center text-xs text-[#A39E96] space-y-2">
                  <Building2 className="w-8 h-8 text-[#DEDAD3] stroke-1" />
                  <p className="font-medium text-[#6B6660]">Nenhuma unidade selecionada</p>
                  <p className="text-[11px] text-[#A39E96]">Selecione uma unidade no filtro acima para carregar a carteira.</p>
                </div>
              ) : filteredObras.length === 0 ? (
                <div className="text-center py-12 text-xs text-[#A39E96]">
                  {obras.length === 0 ? (
                    <div className="space-y-2">
                      <p>Nenhuma obra carregada para esta unidade.</p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleSyncFromGoogleSheets}
                        className="text-xs font-semibold text-[#E07A1F] border-[#E8C9A0]"
                      >
                        <RefreshCw className="w-3 h-3 mr-1" /> Sincronizar Sheets
                      </Button>
                    </div>
                  ) : (
                    'Nenhuma obra corresponde aos filtros ativos.'
                  )}
                </div>
              ) : (
                filteredObras.map(obra => {
                  const isSelected = obra.projeto === selectedObraId;
                  const isApta = (obra.situacao || 'APTA').toUpperCase() === 'APTA';

                  return (
                    <div
                      key={obra.projeto}
                      onClick={() => handleSelectObra(obra.projeto)}
                      className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${isSelected ? 'bg-[#FBF5EC] border-[#E8C9A0] shadow-2xs' : 'bg-white border-[#E6E3DD] hover:border-[#DEDAD3]'}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-xs text-[#23211E]">{obra.projeto}</span>
                        <span className={`px-2 py-0.5 rounded text-[9.5px] font-bold ${isApta ? 'bg-[#E6F2EA] text-[#17794C]' : 'bg-[#F9E4E1] text-[#B03028]'}`}>
                          {obra.situacao || 'APTA'}
                        </span>
                      </div>

                      <p className="text-xs text-[#5C574F] truncate mt-1">{obra.nomeProjeto || (obra as any).descricao}</p>

                      <div className="flex items-center justify-between text-[11px] text-[#A39E96] mt-1.5 pt-1.5 border-t border-[#E6E3DD]/60">
                        <span className="truncate">{obra.municipio}</span>
                        <div className="flex items-center gap-2 font-mono shrink-0">
                          <span className="text-[#5B7C99] font-bold">{obra.qtdPostesDisponiveis || 0} post.</span>
                          <span className="text-[#7E6BA8] font-bold">{obra.qtdCabosDisponiveis || 0} m</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Card 2: Saldo da Obra e Análise de Risco */}
          {selectedObra && (
            <div className="bg-white rounded-xl border border-[#E6E3DD] p-3.5 shadow-2xs space-y-3.5">
              <span className="text-xs font-bold text-[#23211E] block">Saldo da obra e riscos</span>

              {/* Postes e Cabos */}
              <div className="space-y-2.5 text-xs">
                <div>
                  <div className="flex justify-between text-xs mb-1 font-medium">
                    <span className="text-[#5C574F]">Postes (carteira: {selectedObra.qtdPostesDisponiveis || 0})</span>
                    <span className="font-mono font-bold text-[#5B7C99]">
                      Saldo: {Math.max(0, (selectedObra.qtdPostesDisponiveis || 0) - totalPontosPeriodo)}
                    </span>
                  </div>
                  <div className="w-full bg-[#F2F0EC] h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-[#5B7C99] h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, selectedObra.qtdPostesDisponiveis ? (totalPontosPeriodo / selectedObra.qtdPostesDisponiveis) * 100 : 0)}%`
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1 font-medium">
                    <span className="text-[#5C574F]">Cabos (carteira: {selectedObra.qtdCabosDisponiveis || 0} m)</span>
                    <span className="font-mono font-bold text-[#7E6BA8]">
                      Saldo: {selectedObra.qtdCabosDisponiveis || 0} m
                    </span>
                  </div>
                  <div className="w-full bg-[#F2F0EC] h-2.5 rounded-full overflow-hidden">
                    <div className="bg-[#7E6BA8] h-full rounded-full" style={{ width: '0%' }} />
                  </div>
                </div>
              </div>

              {/* Resumo da Análise de Risco da Vistoria */}
              <div className="pt-2.5 border-t border-[#E6E3DD] space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[#5C574F] font-bold text-xs">Vistoria</span>
                  <span className={`px-2 py-0.5 rounded text-[10.5px] font-bold shadow-2xs ${
                    currentRisk?.classificacao === 'Vermelho'
                      ? 'bg-[#C0392E] text-white'
                      : currentRisk?.classificacao === 'Laranja'
                        ? 'bg-[#FBF2DA] text-[#A06A16] border border-[#E8C9A0]'
                        : 'bg-[#E6F2EA] text-[#17794C] border border-[#A0D4B2]'
                  }`}>
                    {currentRisk ? `Risco ${currentRisk.classificacao}` : 'Sem impedimentos'}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {currentRisk?.pontosDetalhados && currentRisk.pontosDetalhados.length > 0 ? (
                    currentRisk.pontosDetalhados.map((pt, pIdx) => {
                      const isCritico = Boolean(pt.isCritico);
                      return (
                        <div
                          key={pIdx}
                          className={`p-2 rounded-lg text-[11px] leading-snug break-words flex items-start gap-2 shadow-2xs transition-all ${
                            isCritico
                              ? 'bg-[#C0392E] text-white font-bold border border-[#A93226] ring-1 ring-[#C0392E]/40'
                              : 'bg-white border border-[#E6E3DD] text-[#23211E]'
                          }`}
                        >
                          <span className="text-xs shrink-0 mt-0.5">{pt.icone || (isCritico ? '🔴' : '📌')}</span>
                          <div className="flex-1 min-w-0">
                            {pt.categoria && (
                              <span className={`mr-1 text-[10px] uppercase tracking-wider ${
                                isCritico ? 'text-red-100 font-bold' : 'text-[#8A857D] font-semibold'
                              }`}>
                                [{pt.categoria}]
                              </span>
                            )}
                            <span className={`break-words whitespace-normal ${isCritico ? 'text-white' : 'text-[#23211E]'}`}>
                              {pt.texto}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-[11.5px] text-[#A39E96]">
                      {currentRisk?.alerta || 'Nenhum impeditivo crítico registrado na vistoria.'}
                    </div>
                  )}
                </div>

                {/* Observação Original Completa de Campo retrátil */}
                {currentRisk?.observacoesOriginais && (
                  <details className="mt-2 text-[11px] text-[#5C574F] border-t border-[#E6E3DD] pt-2 group">
                    <summary className="font-semibold text-[#E07A1F] hover:text-[#C0392E] cursor-pointer transition-colors list-none flex items-center justify-between">
                      <span>Ver anotação completa de campo</span>
                      <ChevronDown className="w-3.5 h-3.5 transition-transform group-open:rotate-180 opacity-70" />
                    </summary>
                    <div className="mt-2 p-2.5 rounded-lg bg-[#F7F6F3] border border-[#E6E3DD] text-[#23211E] font-mono text-[11px] leading-relaxed whitespace-pre-wrap select-text max-h-[200px] overflow-y-auto">
                      {currentRisk.observacoesOriginais}
                    </div>
                  </details>
                )}
              </div>
            </div>
          )}
        </aside>
        )}

        {/* COLUNA DIREITA (CONTEÚDO PRINCIPAL) */}
        <main className="space-y-3.5">
          {/* MODO OBRA: Mensagem se nenhuma obra foi selecionada */}
          {planningMode === 'obra' && !selectedObra ? (
            <div className="bg-white rounded-xl border border-[#E6E3DD] p-12 text-center shadow-2xs space-y-3">
              <div className="w-12 h-12 rounded-full bg-[#FBF5EC] border border-[#E8C9A0] flex items-center justify-center mx-auto text-[#E07A1F]">
                <Layers className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#23211E]">
                  {!selectedUnidadeId ? 'Selecione uma unidade no topo' : 'Selecione uma obra na carteira à esquerda'}
                </h3>
                <p className="text-xs text-[#6B6660] max-w-md mx-auto mt-1">
                  {!selectedUnidadeId
                    ? 'Escolha a sua unidade operacional acima para carregar a carteira de projetos disponíveis.'
                    : `Escolha uma das ${filteredObras.length} obras da carteira para visualizar a jornada, distribuir os pontos e montar o planejamento.`}
                </p>
              </div>
            </div>
          ) : planningMode === 'equipe' ? (
            /* ================================= */
            /* MODO EQUIPE: Accordion de Equipes */
            /* ================================= */
            <div className="space-y-4">
              {/* Header: Multi-seleção de Equipes + Período */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {/* Multi-seleção de Equipes */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!selectedUnidadeId}
                      className={`h-8 px-3 text-xs border font-medium gap-1.5 ${
                        selectedEquipes.length > 0
                          ? 'bg-[#FBF5EC] border-[#E8C9A0] text-[#A06A16] font-bold'
                          : 'bg-white border-[#DEDAD3] text-[#5C574F]'
                      }`}
                    >
                      <UsersRound className="w-3.5 h-3.5 text-[#E07A1F]" />
                      <span className="text-[10px] uppercase tracking-wider text-[#A39E96] font-semibold">EQUIPES</span>
                      <span className="font-mono font-bold">{selectedEquipes.length > 0 ? selectedEquipes.join(', ') : 'Selecione...'}</span>
                      <ChevronDown className="w-3.5 h-3.5 ml-1 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[260px] p-3 bg-white" align="start">
                    <div className="space-y-2">
                      <span className="text-xs font-bold text-[#23211E] block">Selecionar equipes</span>
                      <div className="max-h-[300px] overflow-y-auto space-y-1.5">
                        {equipesDisponiveis.map(eq => (
                          <label key={eq} className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-[#F7F6F3] cursor-pointer text-xs">
                            <Checkbox
                              checked={selectedEquipes.includes(eq)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedEquipes(prev => [...prev, eq]);
                                  if (!expandedEquipeIds.includes(eq)) {
                                    setExpandedEquipeIds(prev => [...prev, eq]);
                                  }
                                } else {
                                  setSelectedEquipes(prev => prev.filter(e => e !== eq));
                                }
                              }}
                              className="rounded border-[#DEDAD3] text-[#E07A1F] focus:ring-[#E07A1F] h-4 w-4"
                            />
                            <span className="font-mono font-bold text-[#23211E]">{eq}</span>
                            {metasPorEquipeMap.get(eq.toUpperCase()) && (
                              <span className="text-[10px] text-[#6B6660] ml-auto">
                                Meta: R$ {metasPorEquipeMap.get(eq.toUpperCase())?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                            )}
                          </label>
                        ))}
                      </div>
                      <div className="flex justify-between pt-1.5 border-t border-[#E6E3DD]">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setSelectedEquipes(equipesDisponiveis); setExpandedEquipeIds(equipesDisponiveis); }}
                          className="text-[10px] h-6 px-2 text-[#E07A1F] font-bold"
                        >
                          Selecionar todas
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedEquipes([])}
                          className="text-[10px] h-6 px-2 text-[#A39E96] font-bold"
                        >
                          Limpar
                        </Button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Período */}
                <Popover open={isDataRangeOpen} onOpenChange={setIsDataRangeOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 px-3 text-xs bg-white border border-[#DEDAD3] rounded-lg shadow-2xs text-[#23211E] font-semibold gap-1.5 w-auto">
                      <span className="text-[10px] uppercase tracking-wider text-[#A39E96] font-semibold">PERÍODO</span>
                      <span className="font-mono font-bold text-[#23211E]">
                        {format(safeParseDate(dataInicio), 'dd/MM')} a {format(safeParseDate(dataFim), 'dd/MM')}
                      </span>
                      <ChevronDown className="w-3.5 h-3.5 opacity-50 ml-0.5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-3.5 bg-white" align="start">
                    <div className="space-y-2.5 text-xs">
                      <span className="font-bold text-[#23211E] block">Definir período do planejamento</span>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <span className="text-[11px] text-[#A39E96] block mb-1">Data início</span>
                          <input
                            type="date"
                            value={dataInicio}
                            onChange={e => { setDataInicio(e.target.value); setDiasCarregadosList([]); }}
                            className="w-full h-8 text-xs border border-[#DEDAD3] rounded px-2 font-mono"
                          />
                        </div>
                        <div>
                          <span className="text-[11px] text-[#A39E96] block mb-1">Data fim</span>
                          <input
                            type="date"
                            value={dataFim}
                            onChange={e => { setDataFim(e.target.value); setDiasCarregadosList([]); }}
                            className="w-full h-8 text-xs border border-[#DEDAD3] rounded px-2 font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Supervisor */}
                <Select value={supervisor} onValueChange={setSupervisor}>
                  <SelectTrigger className="h-8 px-3 text-xs bg-white border border-[#DEDAD3] rounded-lg shadow-2xs text-[#23211E] font-semibold flex items-center gap-1.5 w-auto">
                    <span className="text-[10px] uppercase tracking-wider text-[#A39E96] font-semibold">SUPERVISOR</span>
                    <span className="font-semibold text-[#23211E]">{supervisor}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {supervisoresDisponiveis.map(s => (
                      <SelectItem key={s} value={s} className="text-xs font-semibold">{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Visualização: Jornada vs Alojamentos */}
                <div className="inline-flex items-center rounded-lg border border-[#DEDAD3] bg-[#F2F0EC] p-0.5 text-xs font-semibold shrink-0 shadow-2xs ml-auto">
                  <button
                    type="button"
                    onClick={() => setViewMode('jornada')}
                    className={`px-3 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
                      viewMode === 'jornada'
                        ? 'bg-white text-[#23211E] shadow-2xs border border-[#DEDAD3]'
                        : 'text-[#6B6660] hover:text-[#23211E] hover:bg-white/50'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5 text-[#E07A1F]" />
                    <span>Jornada</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('alojamentos')}
                    className={`px-3 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
                      viewMode === 'alojamentos'
                        ? 'bg-white text-[#23211E] shadow-2xs border border-[#DEDAD3]'
                        : 'text-[#6B6660] hover:text-[#23211E] hover:bg-white/50'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5 text-[#E07A1F]" />
                    <span>Alojamentos</span>
                  </button>
                </div>
              </div>

              {/* Chips das equipes selecionadas */}
              {selectedEquipes.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedEquipes.map(eq => (
                    <Badge
                      key={eq}
                      variant="outline"
                      className="bg-[#FBF5EC] border-[#E8C9A0] text-[#A06A16] font-mono font-bold text-xs px-2.5 py-1 cursor-pointer hover:bg-[#F5EAD9] transition-colors"
                      onClick={() => setExpandedEquipeIds(prev =>
                        prev.includes(eq) ? prev.filter(e => e !== eq) : [...prev, eq]
                      )}
                    >
                      <UsersRound className="w-3 h-3 mr-1" />
                      {eq}
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedEquipes(prev => prev.filter(e => e !== eq)); }}
                        className="ml-1.5 text-[#A06A16]/50 hover:text-[#C0392E] text-sm font-bold"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              {/* Equipes vazio */}
              {selectedEquipes.length === 0 && (
                <div className="bg-white rounded-xl border border-[#E6E3DD] p-12 text-center shadow-2xs space-y-3">
                  <div className="w-12 h-12 rounded-full bg-[#FBF5EC] border border-[#E8C9A0] flex items-center justify-center mx-auto text-[#E07A1F]">
                    <UsersRound className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#23211E]">
                      {!selectedUnidadeId ? 'Selecione uma unidade no topo' : 'Selecione equipes para planejar'}
                    </h3>
                    <p className="text-xs text-[#6B6660] max-w-md mx-auto mt-1">
                      Use o botão "Equipes" acima para selecionar as equipes que deseja programar.
                    </p>
                  </div>
                </div>
              )}

              {/* Accordion de Equipes */}
              {selectedEquipes.map(equipeId => {
                const isEquipeExpanded = expandedEquipeIds.includes(equipeId);
                const eqMeta = metasPorEquipeMap.get(equipeId.toUpperCase()) || metaEquipeInput;
                // Contar quantos dias desta equipe têm obra e pontos preenchidos
                const diasComConteudo = diasProgramados.filter(d => {
                  const ck = `${equipeId}_${d.id}`;
                  return diasObraEquipeMap[ck] && (diasPontosMap[ck] || []).length > 0;
                }).length;

                return (
                  <div key={equipeId} className="bg-white rounded-xl border border-[#E6E3DD] shadow-2xs overflow-hidden">
                    {/* Header da Equipe (clicável) */}
                    <button
                      type="button"
                      onClick={() => setExpandedEquipeIds(prev =>
                        prev.includes(equipeId) ? prev.filter(e => e !== equipeId) : [...prev, equipeId]
                      )}
                      className="w-full flex items-center justify-between p-3 px-4 bg-[#FAF8F5] hover:bg-[#F2F0EC] transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#E07A1F] text-white flex items-center justify-center text-[10px] font-bold">
                          <UsersRound className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="font-mono font-bold text-sm text-[#23211E]">{equipeId}</span>
                          <div className="flex items-center gap-2 text-[11px] text-[#6B6660]">
                            <span>Meta: R$ {eqMeta.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            <span className="text-[#DEDAD3]">·</span>
                            <span>{diasComConteudo}/{diasProgramados.length} dias preenchidos</span>
                          </div>
                        </div>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-[#6B6660] transition-transform ${isEquipeExpanded ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Corpo expandido: Dias com seletor de obra */}
                    {isEquipeExpanded && (
                      <div className="border-t border-[#E6E3DD]">
                        {viewMode === 'jornada' ? (
                          /* Visualização normal de Jornada */
                          diasProgramados.map((dia, idx) => {
                            const compositeKey = `${equipeId}_${dia.id}`;
                            const obraCodeDoDia = diasObraEquipeMap[compositeKey] || '';
                            const obraDoSlot = obraCodeDoDia ? obras.find(o => o.projeto === obraCodeDoDia) : null;
                            const isExpanded = expandedDayIds.includes(compositeKey);

                            return (
                              <div key={compositeKey} className="border-b border-[#E6E3DD] last:border-b-0">
                                {(() => {
                                  const tComp = diasTemposCompMap[compositeKey];
                                  const sBase = tComp?.tempoSaidaBaseMin ?? tempoSaidaBasePadrao;
                                  const sSeg = tComp?.tempoSegurancaMin ?? tempoSegurancaPadrao;
                                  const disp = getDayDisplacement(compositeKey, idx, diasProgramados.length, obraDoSlot);
                                  const cachedData = obraDataCache[obraCodeDoDia];
                                  const resolvedPontos = cachedData?.pontos || [];
                                  const resolvedOrcamento = cachedData?.orcamento || new Map<string, MaterialPontoBudget[]>();

                                  // Obra selector element para injetar no header do PcpDiaRow
                                  const obraSelector = (
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <button
                                          type="button"
                                          className={`h-6 text-[11px] border rounded-md font-semibold flex items-center gap-1 px-2 min-w-[160px] max-w-[280px] transition-all ${
                                            obraCodeDoDia
                                              ? 'bg-[#FBF5EC] border-[#E8C9A0] text-[#23211E]'
                                              : 'bg-white border-[#DEDAD3] text-[#A39E96] hover:border-[#C5C0B8]'
                                          }`}
                                        >
                                          <Building2 className="w-3 h-3 text-[#E07A1F] shrink-0" />
                                          <span className={`truncate ${obraCodeDoDia ? 'font-mono font-bold text-[#23211E]' : ''}`}>
                                            {obraDoSlot ? `${obraDoSlot.projeto} — ${(obraDoSlot.nomeProjeto || '').slice(0, 25)}` : 'Selecione a obra...'}
                                          </span>
                                          <ChevronDown className="w-2.5 h-2.5 opacity-40 shrink-0 ml-auto" />
                                        </button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-[340px] p-0 bg-white" align="start" side="bottom">
                                        <div className="p-2.5 border-b border-[#E6E3DD] bg-[#FAF8F5]">
                                          <div className="relative">
                                            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-[#A39E96]" />
                                            <input
                                              placeholder="Buscar código, município..."
                                              autoFocus
                                              onChange={e => {
                                                const target = e.target as HTMLInputElement;
                                                target.closest('[data-radix-popper-content-wrapper]')?.querySelectorAll('[data-obra-card]').forEach(card => {
                                                  const text = (card as HTMLElement).dataset.searchText || '';
                                                  (card as HTMLElement).style.display = text.toLowerCase().includes(target.value.toLowerCase()) ? '' : 'none';
                                                });
                                              }}
                                              className="w-full h-7 pl-8 pr-2 text-xs rounded-md border border-[#DEDAD3] bg-white focus:outline-none focus:ring-1 focus:ring-[#E07A1F] font-mono"
                                            />
                                          </div>
                                        </div>
                                        <div className="max-h-[320px] overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
                                          {obraCodeDoDia && (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setDiasObraEquipeMap(prev => ({ ...prev, [compositeKey]: '' }));
                                                setDiasPontosMap(prev => ({ ...prev, [compositeKey]: [] }));
                                                setDiasPontosGroupedMap(prev => { const next = { ...prev }; delete next[compositeKey]; return next; });
                                              }}
                                              className="w-full p-2 rounded-md text-xs text-[#A39E96] hover:bg-[#F7F6F3] text-left font-medium transition-colors"
                                              data-obra-card
                                              data-search-text="limpar nenhuma"
                                            >
                                              — Limpar seleção —
                                            </button>
                                          )}
                                          {filteredObras.map(o => {
                                            const isObraSelected = o.projeto === obraCodeDoDia;
                                            const isApta = (o.situacao || 'APTA').toUpperCase() === 'APTA';
                                            return (
                                              <button
                                                key={o.projeto}
                                                type="button"
                                                data-obra-card
                                                data-search-text={`${o.projeto} ${o.nomeProjeto} ${o.municipio} ${o.donoDaObra || ''}`}
                                                onClick={() => {
                                                  const newVal = o.projeto;
                                                  setDiasObraEquipeMap(prev => ({ ...prev, [compositeKey]: newVal }));
                                                  if (newVal !== obraCodeDoDia) {
                                                    setDiasPontosMap(prev => ({ ...prev, [compositeKey]: [] }));
                                                    setDiasPontosGroupedMap(prev => { const next = { ...prev }; delete next[compositeKey]; return next; });
                                                  }
                                                }}
                                                className={`w-full p-2.5 rounded-lg border text-xs text-left transition-all ${
                                                  isObraSelected
                                                    ? 'bg-[#FBF5EC] border-[#E8C9A0] shadow-2xs'
                                                    : 'bg-white border-[#E6E3DD] hover:border-[#DEDAD3] hover:bg-[#FBFAF7]'
                                                }`}
                                              >
                                                <div className="flex items-center justify-between">
                                                  <span className="font-mono font-bold text-xs text-[#23211E]">{o.projeto}</span>
                                                  <span className={`px-2 py-0.5 rounded text-[9.5px] font-bold ${isApta ? 'bg-[#E6F2EA] text-[#17794C]' : 'bg-[#F9E4E1] text-[#B03028]'}`}>
                                                    {o.situacao || 'APTA'}
                                                  </span>
                                                </div>
                                                <p className="text-xs text-[#5C574F] truncate mt-1">{o.nomeProjeto || (o as any).descricao}</p>
                                                <div className="flex items-center justify-between text-[11px] text-[#A39E96] mt-1.5 pt-1.5 border-t border-[#E6E3DD]/60">
                                                  <span className="truncate">{o.municipio}</span>
                                                  <div className="flex items-center gap-2 font-mono shrink-0">
                                                    <span className="text-[#5B7C99] font-bold">{o.qtdPostesDisponiveis || 0} post.</span>
                                                    <span className="text-[#7E6BA8] font-bold">{o.qtdCabosDisponiveis || 0} m</span>
                                                  </div>
                                                </div>
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </PopoverContent>
                                    </Popover>
                                  );

                                  return (
                                    <PcpDiaRow
                                      dia={dia}
                                      totalDias={diasProgramados.length}
                                      isExpanded={isExpanded}
                                      onToggleExpand={() => {
                                        setExpandedDayIds(prev =>
                                          prev.includes(compositeKey) ? prev.filter(id => id !== compositeKey) : [...prev, compositeKey]
                                        );
                                      }}
                                      viewMode="jornada"
                                      headerExtra={obraSelector}
                                      pontosDoDia={diasPontosMap[compositeKey] || []}
                                      pontosDisponiveis={resolvedPontos}
                                      orcamentoPorPontoMap={resolvedOrcamento}
                                      getItemsDoPontoNoDia={(dId, p) => getItemsDoPontoNoDia(compositeKey, p)}
                                      alojamentosDisponiveis={alojamentosDaUnidade}
                                      metaEquipeDia={eqMeta}
                                      etapaGeralDia={diasEtapasMap[compositeKey] || ['IMPLANTAÇÃO']}
                                      isPesDia={diasPesMap[compositeKey] || false}
                                      isReprogramarDia={diasReprogramarMap[compositeKey] || false}
                                      motivoReprogramarDia={diasMotivoReprogramarMap[compositeKey] || ''}
                                      filtroLvDoDia={diasFiltroLvMap[compositeKey] || 'COMPLETO'}
                                      tempoSaidaBaseMin={sBase}
                                      tempoSegurancaMin={sSeg}
                                      tempoIdaMin={disp.tempoIdaMin}
                                      tempoVoltaMin={disp.tempoVoltaMin}
                                      distIdaKm={disp.distIdaKm}
                                      distVoltaKm={disp.distVoltaKm}
                                      baseNome={unidadeAtivaInfo ? unidadeAtivaInfo.baseNome : (selectedUnidadeObj?.name ? `Base ${selectedUnidadeObj.name}` : 'Base')}
                                      isIdaManual={disp.isManualIda}
                                      isVoltaManual={disp.isManualVolta}
                                      origemAloj={disp.origemNome}
                                      destinoAloj={disp.destinoNome}
                                      isTrocaAloj={disp.origemNome !== disp.destinoNome}
                                      filteredServicosBase={servicosBase}
                                      percentualCumprimentoDia={diasPercentualCumprimentoMap[compositeKey] || ''}
                                      motivoDescumprimentoDia={diasMotivoDescumprimentoMap[compositeKey] || ''}
                                      handleUpdateDiaAlojamento={(dId, field, val) => handleUpdateDiaAlojamento(compositeKey, field, val)}
                                      handleUpdateDiaTempo={(dId, field, val) => handleUpdateDiaTempo(compositeKey, field, val)}
                                      handleUpdateDiaTempoComp={(dId, field, val) => handleUpdateDiaTempoComp(compositeKey, field, val)}
                                      handleUpdateDiaMotivoDescumprimento={(dId, mot) => handleUpdateDiaMotivoDescumprimento(compositeKey, mot)}
                                      handleUpdateDiaDate={handleUpdateDiaDate}
                                      handleRemoveDia={handleRemoveDia}
                                      handleToggleReprogramarDia={(dId) => handleToggleReprogramarDia(compositeKey)}
                                      handleSelectMotivoReprogramarDia={(dId, mot) => setDiasMotivoReprogramarMap(p => ({ ...p, [compositeKey]: mot }))}
                                      handleTogglePesDia={(dId) => handleTogglePesDia(compositeKey)}
                                      handleToggleEtapaNoDia={(dId, et) => setDiasEtapasMap(p => ({ ...p, [compositeKey]: [et] }))}
                                      handleSetFiltroLvNoDia={(dId, f) => setDiasFiltroLvMap(p => ({ ...p, [compositeKey]: f }))}
                                      handleTogglePontoNoDia={(dId, ponto) => handleTogglePontoNoDia(compositeKey, ponto)}
                                      handleSelectAllPontosNoDia={(dId) => handleSelectAllPontosNoDia(compositeKey)}
                                      handleDeselectAllPontosNoDia={(dId) => handleDeselectAllPontosNoDia(compositeKey)}
                                      handleAddCustomPontoNoDia={(dId, ponto) => handleAddCustomPontoNoDia(compositeKey, ponto)}
                                      handleAddAtividadeNoPonto={(dId, ponto) => handleAddAtividadeNoPonto(compositeKey, ponto)}
                                      handleResetPontoAtividades={(dId, ponto) => handleResetPontoAtividades(compositeKey, ponto)}
                                      handleUpdateAtividade={(dId, ponto, itemId, field, val) => handleUpdateAtividade(compositeKey, ponto, itemId, field, val)}
                                      handleRemoveAtividade={(dId, ponto, itemId) => handleRemoveAtividade(compositeKey, ponto, itemId)}
                                      handleEnviarPlanPrincipalDia={(dId) => handleEnviarPlanPrincipalDia(dia.id, equipeId)}
                                      isSubmitting={salvarProgramacao.isPending}
                                    />
                                  );
                                })()}
                              </div>
                            );
                          })
                        ) : (
                          /* Visualização de Alojamentos */
                          <div className="overflow-x-auto">
                            <div style={{ minWidth: '1180px' }}>
                              {/* CABEÇALHO DA GRADE: VISÃO ALOJAMENTOS */}
                              <div
                                className="flex items-center py-2 px-3 text-[10.5px] uppercase tracking-wider font-bold text-[#5C574F] bg-[#F2F0EC] border-b border-[#E6E3DD] gap-2"
                                style={{ borderLeft: '4px solid transparent' }}
                              >
                                <div className="w-[180px]">Dia / Obra</div>
                                <div className="w-[210px] px-1">Saída (ida)</div>
                                <div className="w-[100px] px-1 text-center">Ida (hh:mm / km)</div>
                                <div className="w-[210px] px-1">Retorno (volta)</div>
                                <div className="w-[100px] px-1 text-center">Volta (hh:mm / km)</div>
                                <div className="w-[110px] px-1 text-center">Desloc. (hh:mm / km)</div>
                                <div className="w-[90px] px-1 text-center">Saída base (hh:mm)</div>
                                <div className="w-[90px] px-1 text-center">Segurança (hh:mm)</div>
                                <div className="w-[100px] text-center">Total comp. (hh:mm)</div>
                                <div className="w-[36px] shrink-0" />
                              </div>

                              {/* LINHAS DOS DIAS */}
                              {diasProgramados.map((dia, idx) => {
                                const compositeKey = `${equipeId}_${dia.id}`;
                                const obraCodeDoDia = diasObraEquipeMap[compositeKey] || '';
                                const obraDoSlot = obraCodeDoDia ? obras.find(o => o.projeto === obraCodeDoDia) : null;
                                const isExpanded = expandedDayIds.includes(compositeKey);
                                const tComp = diasTemposCompMap[compositeKey];
                                const sBase = tComp?.tempoSaidaBaseMin ?? tempoSaidaBasePadrao;
                                const sSeg = tComp?.tempoSegurancaMin ?? tempoSegurancaPadrao;
                                const disp = getDayDisplacement(compositeKey, idx, diasProgramados.length, obraDoSlot);
                                const cachedData = obraDataCache[obraCodeDoDia];
                                const resolvedPontos = cachedData?.pontos || [];
                                const resolvedOrcamento = cachedData?.orcamento || new Map<string, MaterialPontoBudget[]>();

                                // Obra selector element para injetar no header do PcpDiaRow
                                const obraSelector = (
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <button
                                        type="button"
                                        className={`h-6 text-[10px] border rounded-md font-semibold flex items-center gap-1 px-1.5 w-full transition-all ${
                                          obraCodeDoDia
                                            ? 'bg-[#FBF5EC] border-[#E8C9A0] text-[#23211E]'
                                            : 'bg-white border-[#DEDAD3] text-[#A39E96] hover:border-[#C5C0B8]'
                                        }`}
                                      >
                                        <Building2 className="w-2.5 h-2.5 text-[#E07A1F] shrink-0 animate-pulse" />
                                        <span className={`truncate ${obraCodeDoDia ? 'font-mono font-bold text-[#23211E]' : ''}`}>
                                          {obraDoSlot ? `${obraDoSlot.projeto} — ${(obraDoSlot.nomeProjeto || '').slice(0, 15)}` : 'Selecione...'}
                                        </span>
                                        <ChevronDown className="w-2 h-2 opacity-40 shrink-0 ml-auto" />
                                      </button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[340px] p-0 bg-white" align="start" side="bottom">
                                      <div className="p-2.5 border-b border-[#E6E3DD] bg-[#FAF8F5]">
                                        <div className="relative">
                                          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-[#A39E96]" />
                                          <input
                                            placeholder="Buscar código, município..."
                                            autoFocus
                                            onChange={e => {
                                              const target = e.target as HTMLInputElement;
                                              target.closest('[data-radix-popper-content-wrapper]')?.querySelectorAll('[data-obra-card]').forEach(card => {
                                                const text = (card as HTMLElement).dataset.searchText || '';
                                                (card as HTMLElement).style.display = text.toLowerCase().includes(target.value.toLowerCase()) ? '' : 'none';
                                              });
                                            }}
                                            className="w-full h-7 pl-8 pr-2 text-xs rounded-md border border-[#DEDAD3] bg-white focus:outline-none focus:ring-1 focus:ring-[#E07A1F] font-mono"
                                          />
                                        </div>
                                      </div>
                                      <div className="max-h-[320px] overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
                                        {obraCodeDoDia && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setDiasObraEquipeMap(prev => ({ ...prev, [compositeKey]: '' }));
                                              setDiasPontosMap(prev => ({ ...prev, [compositeKey]: [] }));
                                              setDiasPontosGroupedMap(prev => { const next = { ...prev }; delete next[compositeKey]; return next; });
                                            }}
                                            className="w-full p-2 rounded-md text-xs text-[#A39E96] hover:bg-[#F7F6F3] text-left font-medium transition-colors"
                                            data-obra-card
                                            data-search-text="limpar nenhuma"
                                          >
                                            — Limpar seleção —
                                          </button>
                                        )}
                                        {filteredObras.map(o => {
                                          const isObraSelected = o.projeto === obraCodeDoDia;
                                          const isApta = (o.situacao || 'APTA').toUpperCase() === 'APTA';
                                          return (
                                            <button
                                              key={o.projeto}
                                              type="button"
                                              data-obra-card
                                              data-search-text={`${o.projeto} ${o.nomeProjeto} ${o.municipio} ${o.donoDaObra || ''}`}
                                              onClick={() => {
                                                const newVal = o.projeto;
                                                setDiasObraEquipeMap(prev => ({ ...prev, [compositeKey]: newVal }));
                                                if (newVal !== obraCodeDoDia) {
                                                  setDiasPontosMap(prev => ({ ...prev, [compositeKey]: [] }));
                                                  setDiasPontosGroupedMap(prev => { const next = { ...prev }; delete next[compositeKey]; return next; });
                                                }
                                              }}
                                              className={`w-full p-2.5 rounded-lg border text-xs text-left transition-all ${
                                                isObraSelected
                                                  ? 'bg-[#FBF5EC] border-[#E8C9A0] shadow-2xs'
                                                  : 'bg-white border-[#E6E3DD] hover:border-[#DEDAD3] hover:bg-[#FBFAF7]'
                                              }`}
                                            >
                                              <div className="flex items-center justify-between">
                                                <span className="font-mono font-bold text-xs text-[#23211E]">{o.projeto}</span>
                                                <span className={`px-2 py-0.5 rounded text-[9.5px] font-bold ${isApta ? 'bg-[#E6F2EA] text-[#17794C]' : 'bg-[#F9E4E1] text-[#B03028]'}`}>
                                                  {o.situacao || 'APTA'}
                                                </span>
                                              </div>
                                              <p className="text-xs text-[#5C574F] truncate mt-1">{o.nomeProjeto || (o as any).descricao}</p>
                                              <div className="flex items-center justify-between text-[11px] text-[#A39E96] mt-1.5 pt-1.5 border-t border-[#E6E3DD]/60">
                                                <span className="truncate">{o.municipio}</span>
                                                <div className="flex items-center gap-2 font-mono shrink-0">
                                                  <span className="text-[#5B7C99] font-bold">{o.qtdPostesDisponiveis || 0} post.</span>
                                                  <span className="text-[#7E6BA8] font-bold">{o.qtdCabosDisponiveis || 0} m</span>
                                                </div>
                                              </div>
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                );

                                return (
                                  <PcpDiaRow
                                    key={compositeKey}
                                    dia={dia}
                                    totalDias={diasProgramados.length}
                                    isExpanded={isExpanded}
                                    onToggleExpand={() => {
                                      setExpandedDayIds(prev =>
                                        prev.includes(compositeKey) ? prev.filter(id => id !== compositeKey) : [...prev, compositeKey]
                                      );
                                    }}
                                    viewMode="alojamentos"
                                    headerExtra={obraSelector}
                                    pontosDoDia={diasPontosMap[compositeKey] || []}
                                    pontosDisponiveis={resolvedPontos}
                                    orcamentoPorPontoMap={resolvedOrcamento}
                                    getItemsDoPontoNoDia={(dId, p) => getItemsDoPontoNoDia(compositeKey, p)}
                                    alojamentosDisponiveis={alojamentosDaUnidade}
                                    metaEquipeDia={eqMeta}
                                    etapaGeralDia={diasEtapasMap[compositeKey] || ['IMPLANTAÇÃO']}
                                    isPesDia={diasPesMap[compositeKey] || false}
                                    isReprogramarDia={diasReprogramarMap[compositeKey] || false}
                                    motivoReprogramarDia={diasMotivoReprogramarMap[compositeKey] || ''}
                                    filtroLvDoDia={diasFiltroLvMap[compositeKey] || 'COMPLETO'}
                                    tempoSaidaBaseMin={sBase}
                                    tempoSegurancaMin={sSeg}
                                    tempoIdaMin={disp.tempoIdaMin}
                                    tempoVoltaMin={disp.tempoVoltaMin}
                                    distIdaKm={disp.distIdaKm}
                                    distVoltaKm={disp.distVoltaKm}
                                    baseNome={unidadeAtivaInfo ? unidadeAtivaInfo.baseNome : (selectedUnidadeObj?.name ? `Base ${selectedUnidadeObj.name}` : 'Base')}
                                    isIdaManual={disp.isManualIda}
                                    isVoltaManual={disp.isManualVolta}
                                    origemAloj={disp.origemNome}
                                    destinoAloj={disp.destinoNome}
                                    isTrocaAloj={disp.origemNome !== disp.destinoNome}
                                    filteredServicosBase={servicosBase}
                                    percentualCumprimentoDia={diasPercentualCumprimentoMap[compositeKey] || ''}
                                    motivoDescumprimentoDia={diasMotivoDescumprimentoMap[compositeKey] || ''}
                                    handleUpdateDiaAlojamento={(dId, field, val) => handleUpdateDiaAlojamento(compositeKey, field, val)}
                                    handleUpdateDiaTempo={(dId, field, val) => handleUpdateDiaTempo(compositeKey, field, val)}
                                    handleUpdateDiaTempoComp={(dId, field, val) => handleUpdateDiaTempoComp(compositeKey, field, val)}
                                    handleUpdateDiaMotivoDescumprimento={(dId, mot) => handleUpdateDiaMotivoDescumprimento(compositeKey, mot)}
                                    handleUpdateDiaDate={handleUpdateDiaDate}
                                    handleRemoveDia={handleRemoveDia}
                                    handleToggleReprogramarDia={(dId) => handleToggleReprogramarDia(compositeKey)}
                                    handleSelectMotivoReprogramarDia={(dId, mot) => setDiasMotivoReprogramarMap(p => ({ ...p, [compositeKey]: mot }))}
                                    handleTogglePesDia={(dId) => handleTogglePesDia(compositeKey)}
                                    handleToggleEtapaNoDia={(dId, et) => setDiasEtapasMap(p => ({ ...p, [compositeKey]: [et] }))}
                                    handleSetFiltroLvNoDia={(dId, f) => setDiasFiltroLvMap(p => ({ ...p, [compositeKey]: f }))}
                                    handleTogglePontoNoDia={(dId, ponto) => handleTogglePontoNoDia(compositeKey, ponto)}
                                    handleSelectAllPontosNoDia={(dId) => handleSelectAllPontosNoDia(compositeKey)}
                                    handleDeselectAllPontosNoDia={(dId) => handleDeselectAllPontosNoDia(compositeKey)}
                                    handleAddCustomPontoNoDia={(dId, ponto) => handleAddCustomPontoNoDia(compositeKey, ponto)}
                                    handleAddAtividadeNoPonto={(dId, ponto) => handleAddAtividadeNoPonto(compositeKey, ponto)}
                                    handleResetPontoAtividades={(dId, ponto) => handleResetPontoAtividades(compositeKey, ponto)}
                                    handleUpdateAtividade={(dId, ponto, itemId, field, val) => handleUpdateAtividade(compositeKey, ponto, itemId, field, val)}
                                    handleRemoveAtividade={(dId, ponto, itemId) => handleRemoveAtividade(compositeKey, ponto, itemId)}
                                    handleEnviarPlanPrincipalDia={(dId) => handleEnviarPlanPrincipalDia(dia.id, equipeId)}
                                    isSubmitting={salvarProgramacao.isPending}
                                  />
                                );
                              })}

                              {/* TOTALIZADOR DA EQUIPE (VISÃO ALOJAMENTOS) */}
                              {(() => {
                                const totalKmIda = diasProgramados.reduce((acc, d, i) => {
                                  const ck = `${equipeId}_${d.id}`;
                                  const oCode = diasObraEquipeMap[ck] || '';
                                  const oSlot = oCode ? obras.find(o => o.projeto === oCode) : null;
                                  return acc + (getDayDisplacement(ck, i, diasProgramados.length, oSlot).distIdaKm || 0);
                                }, 0);
                                const totalKmVolta = diasProgramados.reduce((acc, d, i) => {
                                  const ck = `${equipeId}_${d.id}`;
                                  const oCode = diasObraEquipeMap[ck] || '';
                                  const oSlot = oCode ? obras.find(o => o.projeto === oCode) : null;
                                  return acc + (getDayDisplacement(ck, i, diasProgramados.length, oSlot).distVoltaKm || 0);
                                }, 0);
                                const totalKmGeral = Math.round((totalKmIda + totalKmVolta) * 10) / 10;
                                const totalDeslocamentoMin = diasProgramados.reduce((acc, d, i) => {
                                  const ck = `${equipeId}_${d.id}`;
                                  const oCode = diasObraEquipeMap[ck] || '';
                                  const oSlot = oCode ? obras.find(o => o.projeto === oCode) : null;
                                  return acc + (getDayDisplacement(ck, i, diasProgramados.length, oSlot).tempoTotalDeslocamentoMin || 0);
                                }, 0);
                                const totalSaidaBaseMin = diasProgramados.reduce((acc, d) => {
                                  const ck = `${equipeId}_${d.id}`;
                                  return acc + (diasTemposCompMap[ck]?.tempoSaidaBaseMin ?? tempoSaidaBasePadrao);
                                }, 0);
                                const totalSegurancaMin = diasProgramados.reduce((acc, d) => {
                                  const ck = `${equipeId}_${d.id}`;
                                  return acc + (diasTemposCompMap[ck]?.tempoSegurancaMin ?? tempoSegurancaPadrao);
                                }, 0);
                                const totalCompMin = totalSaidaBaseMin + totalSegurancaMin + totalDeslocamentoMin;

                                return (
                                  <div
                                    className="flex items-center py-2 px-3 text-xs font-mono font-bold bg-[#F2F0EC] border-t-2 border-[#DEDAD3] gap-2 animate-in fade-in duration-200"
                                    style={{ borderLeft: '4px solid transparent' }}
                                  >
                                    <div className="w-[180px] text-[#23211E]">Total acumulado</div>
                                    <div className="w-[210px] px-1 text-[#6B6660] text-[11px] font-sans font-medium">
                                      {diasProgramados.length} {diasProgramados.length === 1 ? 'dia analisado' : 'dias analisados'}
                                    </div>
                                    <div className="w-[100px] text-center shrink-0 flex items-center justify-center h-8 bg-white rounded border border-[#DEDAD3] font-mono font-bold text-xs text-[#23211E] shadow-2xs">
                                      {formatMinToHours(diasProgramados.reduce((acc, d, i) => {
                                        const ck = `${equipeId}_${d.id}`;
                                        const oCode = diasObraEquipeMap[ck] || '';
                                        const oSlot = oCode ? obras.find(o => o.projeto === oCode) : null;
                                        return acc + getDayDisplacement(ck, i, diasProgramados.length, oSlot).tempoIdaMin;
                                      }, 0))}
                                    </div>
                                    <div className="w-[210px] px-1" />
                                    <div className="w-[100px] text-center shrink-0 flex items-center justify-center h-8 bg-white rounded border border-[#DEDAD3] font-mono font-bold text-xs text-[#23211E] shadow-2xs">
                                      {formatMinToHours(diasProgramados.reduce((acc, d, i) => {
                                        const ck = `${equipeId}_${d.id}`;
                                        const oCode = diasObraEquipeMap[ck] || '';
                                        const oSlot = oCode ? obras.find(o => o.projeto === oCode) : null;
                                        return acc + getDayDisplacement(ck, i, diasProgramados.length, oSlot).tempoVoltaMin;
                                      }, 0))}
                                    </div>
                                    <div className="w-[110px] text-center shrink-0 flex items-center justify-center h-8 bg-white rounded border border-[#DEDAD3] font-mono font-bold text-xs text-[#23211E] shadow-2xs">
                                      {formatMinToHours(totalDeslocamentoMin)}
                                    </div>
                                    <div className="w-[90px] text-center shrink-0 flex items-center justify-center h-8 bg-white rounded border border-[#DEDAD3] font-mono font-bold text-xs text-[#23211E] shadow-2xs">
                                      {formatMinToHours(totalSaidaBaseMin)}
                                    </div>
                                    <div className="w-[90px] text-center shrink-0 flex items-center justify-center h-8 bg-white rounded border border-[#DEDAD3] font-mono font-bold text-xs text-[#23211E] shadow-2xs">
                                      {formatMinToHours(totalSegurancaMin)}
                                    </div>
                                    <div className="w-[100px] text-center shrink-0 flex items-center justify-center h-8 bg-[#F7F6F3] rounded border border-[#DEDAD3] font-mono font-bold text-xs text-[#23211E] shadow-2xs">
                                      {formatMinToHours(totalCompMin)}
                                    </div>
                                    <div className="w-[36px] shrink-0" />
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        )}

                        {/* Resumo do Deslocamento Previsto para a Equipe */}
                        {viewMode === 'alojamentos' && (() => {
                          const totalKmIda = diasProgramados.reduce((acc, d, i) => {
                            const ck = `${equipeId}_${d.id}`;
                            const oCode = diasObraEquipeMap[ck] || '';
                            const oSlot = oCode ? obras.find(o => o.projeto === oCode) : null;
                            return acc + (getDayDisplacement(ck, i, diasProgramados.length, oSlot).distIdaKm || 0);
                          }, 0);
                          const totalKmVolta = diasProgramados.reduce((acc, d, i) => {
                            const ck = `${equipeId}_${d.id}`;
                            const oCode = diasObraEquipeMap[ck] || '';
                            const oSlot = oCode ? obras.find(o => o.projeto === oCode) : null;
                            return acc + (getDayDisplacement(ck, i, diasProgramados.length, oSlot).distVoltaKm || 0);
                          }, 0);
                          const totalKmGeral = Math.round((totalKmIda + totalKmVolta) * 10) / 10;
                          const mediaKmDia = diasProgramados.length > 0 ? Math.round((totalKmGeral / diasProgramados.length) * 10) / 10 : 0;
                          const totalDeslocamentoMin = diasProgramados.reduce((acc, d, i) => {
                            const ck = `${equipeId}_${d.id}`;
                            const oCode = diasObraEquipeMap[ck] || '';
                            const oSlot = oCode ? obras.find(o => o.projeto === oCode) : null;
                            return acc + (getDayDisplacement(ck, i, diasProgramados.length, oSlot).tempoTotalDeslocamentoMin || 0);
                          }, 0);
                          const mediaMinDeslocDia = diasProgramados.length > 0 ? Math.round(totalDeslocamentoMin / diasProgramados.length) : 0;
                          const isMediaDeslocamentoAlto = mediaMinDeslocDia > 120;

                          const alojamentosUsadosSet = new Set<string>();
                          diasProgramados.forEach((d, i) => {
                            const ck = `${equipeId}_${d.id}`;
                            const oCode = diasObraEquipeMap[ck] || '';
                            const oSlot = oCode ? obras.find(o => o.projeto === oCode) : null;
                            const disp = getDayDisplacement(ck, i, diasProgramados.length, oSlot);
                            if (disp.origemNome) alojamentosUsadosSet.add(disp.origemNome);
                            if (disp.destinoNome) alojamentosUsadosSet.add(disp.destinoNome);
                          });
                          const alojamentosUsadosList = Array.from(alojamentosUsadosSet);

                          return (
                            <div className="border-t border-[#E6E3DD] p-3.5 bg-[#FAF8F5] space-y-2.5 animate-in fade-in duration-200">
                              <div className="flex items-center justify-between pb-1.5 border-b border-[#E6E3DD]">
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-md bg-[#E07A1F]/10 border border-[#E07A1F]/20 flex items-center justify-center text-[#E07A1F]">
                                    <Navigation className="w-3.5 h-3.5" />
                                  </div>
                                  <h4 className="text-xs font-bold text-[#23211E]">Resumo do Deslocamento Previsto — {equipeId}</h4>
                                </div>
                                <span className="text-[10px] text-[#6B6660] font-mono">
                                  {diasProgramados.length} {diasProgramados.length === 1 ? 'dia' : 'dias'}
                                </span>
                              </div>

                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                                <div className="bg-white rounded-lg p-2 border border-[#E6E3DD] shadow-2xs text-center">
                                  <span className="text-[10px] text-[#6B6660] font-medium block">Distância Total</span>
                                  <span className="font-mono font-bold text-xs text-[#23211E] block mt-0.5">
                                    {totalKmGeral > 0 ? `${totalKmGeral} km` : '—'}
                                  </span>
                                  <span className="text-[9px] font-mono text-[#A39E96]">
                                    {mediaKmDia > 0 ? `~${mediaKmDia}k/d` : ''}
                                  </span>
                                </div>

                                <div className="bg-white rounded-lg p-2 border border-[#E6E3DD] shadow-2xs text-center">
                                  <span className="text-[10px] text-[#6B6660] font-medium block">Tempo Desloc.</span>
                                  <span className="font-mono font-bold text-xs block mt-0.5" style={{ color: isMediaDeslocamentoAlto ? '#B03028' : '#23211E' }}>
                                    {formatMinToHours(totalDeslocamentoMin)}
                                  </span>
                                  <span className="text-[9px] font-mono text-[#A39E96]">
                                    {`~${formatMinToHours(mediaMinDeslocDia)}/d`}
                                  </span>
                                </div>

                                <div className="bg-white rounded-lg p-2 border border-[#E6E3DD] shadow-2xs text-center">
                                  <span className="text-[10px] text-[#6B6660] font-medium block">Ida Total</span>
                                  <span className="font-mono font-bold text-xs text-[#23211E] block mt-0.5">
                                    {formatMinToHours(diasProgramados.reduce((acc, d, i) => {
                                      const ck = `${equipeId}_${d.id}`;
                                      const oCode = diasObraEquipeMap[ck] || '';
                                      const oSlot = oCode ? obras.find(o => o.projeto === oCode) : null;
                                      return acc + getDayDisplacement(ck, i, diasProgramados.length, oSlot).tempoIdaMin;
                                    }, 0))}
                                  </span>
                                  <span className="text-[9px] font-mono text-[#6B6660]">
                                    {totalKmIda > 0 ? `${Math.round(totalKmIda * 10) / 10} km` : '—'}
                                  </span>
                                </div>

                                <div className="bg-white rounded-lg p-2 border border-[#E6E3DD] shadow-2xs text-center">
                                  <span className="text-[10px] text-[#6B6660] font-medium block">Volta Total</span>
                                  <span className="font-mono font-bold text-xs text-[#23211E] block mt-0.5">
                                    {formatMinToHours(diasProgramados.reduce((acc, d, i) => {
                                      const ck = `${equipeId}_${d.id}`;
                                      const oCode = diasObraEquipeMap[ck] || '';
                                      const oSlot = oCode ? obras.find(o => o.projeto === oCode) : null;
                                      return acc + getDayDisplacement(ck, i, diasProgramados.length, oSlot).tempoVoltaMin;
                                    }, 0))}
                                  </span>
                                  <span className="text-[9px] font-mono text-[#6B6660]">
                                    {totalKmVolta > 0 ? `${Math.round(totalKmVolta * 10) / 10} km` : '—'}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#E6E3DD] flex-wrap">
                                <div className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs border ${
                                  isMediaDeslocamentoAlto
                                    ? 'bg-[#FDF2F0] border-[#F2C0B8] text-[#B03028]'
                                    : 'bg-[#E6F2EA] border-[#A0D4B2] text-[#17794C]'
                                }`}>
                                  <Info className="w-3.5 h-3.5 shrink-0" />
                                  <span className="text-[10.5px] leading-tight">
                                    {isMediaDeslocamentoAlto
                                      ? <>Média <strong>{formatMinToHours(mediaMinDeslocDia)}/dia</strong> acima do teto de 02:00.</>
                                      : <>Média <strong>{formatMinToHours(mediaMinDeslocDia)}/dia</strong> dentro da janela ideal.</>
                                    }
                                  </span>
                                </div>

                                <div className="flex items-center gap-1 flex-wrap">
                                  {alojamentosUsadosList.map(aloj => (
                                    <span
                                      key={aloj}
                                      className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white border border-[#DEDAD3] text-[10.5px] font-medium text-[#23211E]"
                                    >
                                      <Building2 className="w-3 h-3 text-[#E07A1F] shrink-0" />
                                      <span className="truncate max-w-[130px]">{aloj}</span>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Vistorias das obras selecionadas nesta equipe */}
                        {(() => {
                          const distinctObrasEquipe = Array.from(
                            new Set(
                              diasProgramados
                                .map(d => diasObraEquipeMap[`${equipeId}_${d.id}`])
                                .filter(Boolean)
                            )
                          );
                          if (distinctObrasEquipe.length === 0) return null;
                          return (
                            <div className="border-t border-[#E6E3DD] p-3 space-y-2">
                              <span className="text-[11px] font-bold text-[#5C574F] flex items-center gap-1.5">
                                <ShieldAlert className="w-3 h-3 text-[#C0392E]" />
                                Vistorias
                              </span>
                              <div className="flex flex-wrap gap-2">
                                {distinctObrasEquipe.map(obraCode => {
                                  const obraRisk = riskCache[obraCode] || null;
                                  const obraInfo = obras.find(o => o.projeto === obraCode);
                                  const isVermelho = obraRisk?.classificacao === 'Vermelho';
                                  const isLaranja = obraRisk?.classificacao === 'Laranja';
                                  return (
                                    <details
                                      key={obraCode}
                                      className={`group rounded-lg border shadow-2xs min-w-[200px] max-w-[380px] flex-1 basis-[calc(50%-0.5rem)] transition-all ${
                                        isVermelho
                                          ? 'border-[#C0392E]/30 bg-[#FDF5F4]'
                                          : isLaranja
                                            ? 'border-[#E8C9A0] bg-[#FFFBF5]'
                                            : 'border-[#A0D4B2] bg-[#F5FBF7]'
                                      }`}
                                    >
                                      <summary className="flex items-center justify-between gap-2 px-2.5 py-2 cursor-pointer list-none select-none">
                                        <div className="flex items-center gap-2 min-w-0">
                                          <span className="font-mono font-bold text-[11px] text-[#23211E] truncate">
                                            {obraCode}
                                          </span>
                                          {obraInfo && (
                                            <span className="text-[10px] text-[#6B6660] truncate hidden sm:inline">
                                              {(obraInfo.nomeProjeto || '').slice(0, 20)}
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                            isVermelho
                                              ? 'bg-[#C0392E] text-white'
                                              : isLaranja
                                                ? 'bg-[#FBF2DA] text-[#A06A16] border border-[#E8C9A0]'
                                                : 'bg-[#E6F2EA] text-[#17794C] border border-[#A0D4B2]'
                                          }`}>
                                            {obraRisk ? obraRisk.classificacao : 'OK'}
                                          </span>
                                          <ChevronDown className="w-3 h-3 text-[#A39E96] transition-transform group-open:rotate-180" />
                                        </div>
                                      </summary>

                                      <div className="px-2.5 pb-2.5 space-y-1.5">
                                        {obraRisk?.pontosDetalhados && obraRisk.pontosDetalhados.length > 0 ? (
                                          <div className="flex flex-wrap gap-1">
                                            {obraRisk.pontosDetalhados.map((pt, pIdx) => {
                                              const isCritico = Boolean(pt.isCritico);
                                              return (
                                                <div
                                                  key={pIdx}
                                                  className={`inline-flex items-start gap-1 px-2 py-1 rounded-md text-[10px] leading-snug max-w-full ${
                                                    isCritico
                                                      ? 'bg-[#C0392E] text-white font-bold'
                                                      : 'bg-white border border-[#E6E3DD] text-[#23211E]'
                                                  }`}
                                                >
                                                  <span className="shrink-0">{pt.icone || (isCritico ? '🔴' : '📌')}</span>
                                                  <span className="break-words">
                                                    {pt.categoria && (
                                                      <span className={`mr-0.5 uppercase text-[9px] tracking-wider ${isCritico ? 'text-red-100' : 'text-[#8A857D]'}`}>
                                                        [{pt.categoria}]
                                                      </span>
                                                    )}
                                                    {pt.texto}
                                                  </span>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        ) : (
                                          <div className="text-[10px] text-[#A39E96] py-0.5">
                                            {obraRisk?.alerta || 'Sem impedimentos registrados.'}
                                          </div>
                                        )}
                                        {obraRisk?.observacoesOriginais && (
                                          <details className="text-[10px] text-[#5C574F] border-t border-[#E6E3DD]/60 pt-1 group/obs">
                                            <summary className="font-semibold text-[#E07A1F] hover:text-[#C0392E] cursor-pointer list-none flex items-center gap-1">
                                              <span>Campo</span>
                                              <ChevronDown className="w-2.5 h-2.5 transition-transform group-open/obs:rotate-180 opacity-60" />
                                            </summary>
                                            <div className="mt-1 p-2 rounded bg-[#F7F6F3] border border-[#E6E3DD] font-mono text-[10px] leading-relaxed whitespace-pre-wrap select-text max-h-[120px] overflow-y-auto">
                                              {obraRisk.observacoesOriginais}
                                            </div>
                                          </details>
                                        )}
                                      </div>
                                    </details>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Barra de Ações do modo Equipe */}
              {selectedEquipes.length > 0 && (
                <div className="bg-white rounded-xl border border-[#E6E3DD] p-3.5 shadow-2xs">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs text-[#6B6660]">
                      <span className="font-semibold">{selectedEquipes.length} equipes</span>
                      <span className="text-[#DEDAD3]">·</span>
                      <span className="font-semibold">{diasProgramados.length} dias</span>
                    </div>
                    <Button
                      size="sm"
                      disabled={salvarProgramacao.isPending}
                      onClick={handleEnviarTodosOsDias}
                      className="h-9 px-5 text-xs font-bold bg-[#E07A1F] text-white hover:bg-[#E07A1F]/90 gap-2 shadow-2xs transition-all disabled:opacity-70"
                    >
                      {salvarProgramacao.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Enviando...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          <span>Enviar todos ({selectedEquipes.length} equipes × {diasProgramados.length} dias)</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* 1. Faixa da Obra Selecionada */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-bold text-sm text-[#E07A1F]">{selectedObra.projeto}</span>
                  <span className="text-sm font-bold text-[#23211E]">{selectedObra.nomeProjeto || (selectedObra as any).descricao}</span>
                </div>

                <div className="text-xs text-[#6B6660] font-medium shrink-0">
                  <span>Dono {selectedObra.donoDaObra || (selectedObra as any).donoObra || 'Coelba'}</span>
                  <span className="mx-1.5">·</span>
                  <span>meta diária <strong className="text-[#23211E] font-mono">R$ {metaEquipeInput.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
                </div>
              </div>

              {/* 2. Parâmetros (Chips horizontais em linha única) */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {/* Equipe */}
                <Select value={selectedEquipes[0] || 'EH156'} onValueChange={val => setSelectedEquipes([val])}>
                  <SelectTrigger className="h-8 px-3 text-xs bg-white border border-[#DEDAD3] rounded-lg shadow-2xs text-[#23211E] font-semibold flex items-center gap-1.5 w-auto">
                    <span className="text-[10px] uppercase tracking-wider text-[#A39E96] font-semibold">EQUIPE</span>
                    <span className="font-mono font-bold text-[#23211E]">{selectedEquipes[0] || 'EH156'}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {equipesDisponiveis.map(eq => (
                      <SelectItem key={eq} value={eq} className="text-xs font-mono font-semibold">{eq}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Base / Alojamento Padrão */}
                <Select value={selectedAlojamentoId} onValueChange={setSelectedAlojamentoId}>
                  <SelectTrigger className="h-8 px-3 text-xs bg-white border border-[#DEDAD3] rounded-lg shadow-2xs text-[#23211E] font-semibold flex items-center gap-1.5 w-auto">
                    <span className="text-[10px] uppercase tracking-wider text-[#A39E96] font-semibold">BASE OU ALOJAMENTO PADRÃO</span>
                    <span className="font-semibold text-[#23211E]">{alojamentoPadrao}</span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhum" className="text-xs font-semibold">{unidadeAtivaInfo ? unidadeAtivaInfo.baseNome : (selectedUnidadeObj?.name ? `Base ${selectedUnidadeObj.name}` : 'Base')}</SelectItem>
                    {alojamentosDaUnidade.map(a => (
                      <SelectItem key={a.id} value={a.id} className="text-xs font-semibold">{a.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Período com Popover */}
                <Popover open={isDataRangeOpen} onOpenChange={setIsDataRangeOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 px-3 text-xs bg-white border border-[#DEDAD3] rounded-lg shadow-2xs text-[#23211E] font-semibold gap-1.5 w-auto">
                      <span className="text-[10px] uppercase tracking-wider text-[#A39E96] font-semibold">PERÍODO</span>
                      <span className="font-mono font-bold text-[#23211E]">
                        {format(safeParseDate(dataInicio), 'dd/MM')} a {format(safeParseDate(dataFim), 'dd/MM')}
                      </span>
                      <ChevronDown className="w-3.5 h-3.5 opacity-50 ml-0.5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-3.5 bg-white" align="start">
                    <div className="space-y-2.5 text-xs">
                      <span className="font-bold text-[#23211E] block">Definir período do planejamento</span>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <span className="text-[11px] text-[#A39E96] block mb-1">Data início</span>
                          <input
                            type="date"
                            value={dataInicio}
                            onChange={e => {
                              setDataInicio(e.target.value);
                              setDiasCarregadosList([]);
                            }}
                            className="w-full h-8 text-xs border border-[#DEDAD3] rounded px-2 font-mono"
                          />
                        </div>
                        <div>
                          <span className="text-[11px] text-[#A39E96] block mb-1">Data fim</span>
                          <input
                            type="date"
                            value={dataFim}
                            onChange={e => {
                              setDataFim(e.target.value);
                              setDiasCarregadosList([]);
                            }}
                            className="w-full h-8 text-xs border border-[#DEDAD3] rounded px-2 font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Saída Base Padrão */}
                <div className="inline-flex items-center gap-1.5 bg-white border border-[#DEDAD3] rounded-lg shadow-2xs px-3 h-8 text-xs">
                  <span className="text-[10px] uppercase tracking-wider text-[#A39E96] font-semibold">SAÍDA DA BASE PADRÃO</span>
                  <input
                    type="number"
                    min="0"
                    step="5"
                    value={tempoSaidaBasePadrao}
                    onChange={e => setTempoSaidaBasePadrao(parseInt(e.target.value, 10) || 0)}
                    className="w-7 text-center text-xs font-mono font-bold bg-transparent focus:outline-none text-[#23211E]"
                  />
                  <span className="text-[#23211E] text-xs font-semibold">min</span>
                </div>

                {/* Segurança Padrão */}
                <div className="inline-flex items-center gap-1.5 bg-white border border-[#DEDAD3] rounded-lg shadow-2xs px-3 h-8 text-xs">
                  <span className="text-[10px] uppercase tracking-wider text-[#A39E96] font-semibold">SEGURANÇA PADRÃO</span>
                  <input
                    type="number"
                    min="0"
                    step="5"
                    value={tempoSegurancaPadrao}
                    onChange={e => setTempoSegurancaPadrao(parseInt(e.target.value, 10) || 0)}
                    className="w-7 text-center text-xs font-mono font-bold bg-transparent focus:outline-none text-[#23211E]"
                  />
                  <span className="text-[#23211E] text-xs font-semibold">min</span>
                </div>
              </div>

              {/* 3. Grade Principal de Programação */}
              <div className="bg-white rounded-xl border border-[#E6E3DD] shadow-2xs overflow-hidden">
                {/* Linha Superior da Grade: Total do Período no Cabeçalho e Alternador de Visões */}
                <div className="p-2.5 px-3.5 border-b border-[#E6E3DD] flex items-center justify-between gap-3 bg-[#FAF8F5]">
                  <div className="flex items-center gap-3 flex-wrap min-w-0">
                    <span className="font-bold text-xs text-[#23211E] shrink-0">
                      Total do período
                    </span>
                    <span className="text-xs font-mono font-bold text-[#5C574F] bg-white px-2.5 py-1 rounded border border-[#DEDAD3] shadow-2xs">
                      {totalPontosPeriodo} {totalPontosPeriodo === 1 ? 'ponto' : 'pontos'}
                    </span>
                    <span className="text-xs font-mono font-bold text-[#6B6660] bg-white px-2.5 py-1 rounded border border-[#DEDAD3] shadow-2xs">
                      {diasProgramados.length} {diasProgramados.length === 1 ? 'dia programado' : 'dias programados'}
                    </span>
                    <span className="text-xs font-mono font-bold text-[#23211E] bg-white px-2.5 py-1 rounded border border-[#DEDAD3] shadow-2xs">
                      {formatMinToHours(totalHorasPeriodoMin)}
                    </span>
                    <span
                      className="text-xs font-mono font-bold px-2.5 py-1 rounded border shadow-2xs"
                      style={{ color: metaColorPeriodo.texto, backgroundColor: metaColorPeriodo.fundo, borderColor: metaColorPeriodo.borda }}
                    >
                      R$ {totalValorPeriodo.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span
                      className="text-xs font-mono font-bold px-2.5 py-1 rounded border shadow-2xs"
                      style={{ color: metaColorPeriodo.texto, backgroundColor: metaColorPeriodo.fundo, borderColor: metaColorPeriodo.borda }}
                    >
                      {pctMetaTotal}%
                    </span>
                  </div>

                  {/* Alternador de Visões: Jornada vs Alojamentos */}
                  <div className="inline-flex items-center rounded-lg border border-[#DEDAD3] bg-[#F2F0EC] p-0.5 text-xs font-semibold shrink-0 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setViewMode('jornada')}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
                        viewMode === 'jornada'
                          ? 'bg-white text-[#23211E] shadow-2xs border border-[#DEDAD3]'
                          : 'text-[#6B6660] hover:text-[#23211E] hover:bg-white/50'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5 text-[#E07A1F]" />
                      <span>Jornada</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('alojamentos')}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
                        viewMode === 'alojamentos'
                          ? 'bg-white text-[#23211E] shadow-2xs border border-[#DEDAD3]'
                          : 'text-[#6B6660] hover:text-[#23211E] hover:bg-white/50'
                      }`}
                    >
                      <Building2 className="w-3.5 h-3.5 text-[#E07A1F]" />
                      <span>Alojamentos</span>
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  {/* CABEÇALHO DA GRADE: VISÃO JORNADA */}
                  {viewMode === 'jornada' && (
                    <div style={{ minWidth: '1080px' }}>
                      {/* Linha 1 de Cabeçalho: Rótulos */}
                      <div
                        className="flex items-center py-2.5 px-2 text-[10.5px] uppercase tracking-wider font-bold text-[#5C574F] bg-[#F2F0EC] border-b border-[#E6E3DD]"
                        style={{ borderLeft: '4px solid transparent' }}
                      >
                        <div className="w-[30px]" />
                        <div className="w-[115px]">Dia</div>
                        <div className="w-[80px]">Pontos</div>
                        <div className="flex-1 min-w-[220px] px-2 flex items-center justify-between gap-2">
                          <span className="shrink-0">Ocupação da jornada</span>
                          {/* Legenda de cores no espaço vazio entre OCUPAÇÃO DA JORNADA e TOTAL */}
                          <div className="hidden sm:flex items-center gap-3 text-[10.5px] font-semibold text-[#6B6660] normal-case tracking-normal">
                            <span className="flex items-center gap-1">
                              <span className="w-2.5 h-2.5 rounded-full bg-[#23211E]" /> Saída
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="w-2.5 h-2.5 rounded-full bg-[#E07A1F]" /> Ida
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="w-2.5 h-2.5 rounded-full bg-[#A39E96]" /> Segurança
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="w-2.5 h-2.5 rounded-full bg-[#C0392E]" /> Serviço
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="w-2.5 h-2.5 rounded-full bg-[#F5BE84]" /> Volta
                            </span>
                          </div>
                        </div>
                        <div className="w-[65px] text-right pr-2">Total</div>
                        <div className="w-[95px] text-right pr-2">Planejado</div>
                        <div className="w-[65px] text-right pr-2">% Meta</div>
                        <div className="w-[80px] text-center">Situação</div>
                        <div className="w-[85px] text-center">Cumprimento</div>
                        <div className="w-[200px] text-left pl-2">Motivos Descumprimento</div>
                        <div className="w-[36px] shrink-0" />
                      </div>

                      {/* Linha 2 de Cabeçalho: Régua de Horas */}
                      <div
                        className="flex items-center py-1.5 px-2 text-[10px] font-mono text-[#A39E96] bg-[#FBFAF7] border-b border-[#E6E3DD]"
                        style={{ borderLeft: '4px solid transparent' }}
                      >
                        <div className="w-[225px] shrink-0" />
                        <div className="flex-1 min-w-[220px] px-2 relative h-3.5">
                          <span className="absolute left-0 top-0">0h</span>
                          <span
                            className="absolute top-0 font-bold text-[#17794C]"
                            style={{ left: `${(480 / 780) * 100}%` }}
                          >
                            8h
                          </span>
                          <span
                            className="absolute top-0 font-bold text-[#B03028]"
                            style={{ left: `${(600 / 780) * 100}%` }}
                          >
                            10h
                          </span>
                          <span className="absolute right-0 top-0">13h</span>
                        </div>
                        <div className="w-[541px] shrink-0" />
                      </div>

                      {/* LINHAS DOS DIAS */}
                      {diasProgramados.map((dia, idx) => {
                        const isExpanded = expandedDayIds.includes(dia.id);
                        const tComp = diasTemposCompMap[dia.id];
                        const sBase = tComp?.tempoSaidaBaseMin ?? tempoSaidaBasePadrao;
                        const sSeg = tComp?.tempoSegurancaMin ?? tempoSegurancaPadrao;
                        const disp = getDayDisplacement(dia.id, idx, diasProgramados.length);

                        return (
                          <PcpDiaRow
                            key={dia.id}
                            dia={dia}
                            totalDias={diasProgramados.length}
                            isExpanded={isExpanded}
                            onToggleExpand={() => handleToggleExpandDay(dia.id)}
                            viewMode="jornada"
                            pontosDoDia={diasPontosMap[dia.id] || []}
                            pontosDisponiveis={pontosDisponiveisDoProjeto}
                            orcamentoPorPontoMap={orcamentoPorPontoMap}
                            getItemsDoPontoNoDia={getItemsDoPontoNoDia}
                            alojamentosDisponiveis={alojamentosDaUnidade}
                            metaEquipeDia={metaEquipeInput}
                            etapaGeralDia={diasEtapasMap[dia.id] || ['IMPLANTAÇÃO']}
                            isPesDia={diasPesMap[dia.id] || false}
                            isReprogramarDia={diasReprogramarMap[dia.id] || false}
                            motivoReprogramarDia={diasMotivoReprogramarMap[dia.id] || ''}
                            filtroLvDoDia={diasFiltroLvMap[dia.id] || 'COMPLETO'}
                            tempoSaidaBaseMin={sBase}
                            tempoSegurancaMin={sSeg}
                            tempoIdaMin={disp.tempoIdaMin}
                            tempoVoltaMin={disp.tempoVoltaMin}
                            distIdaKm={disp.distIdaKm}
                            distVoltaKm={disp.distVoltaKm}
                            baseNome={unidadeAtivaInfo ? unidadeAtivaInfo.baseNome : (selectedUnidadeObj?.name ? `Base ${selectedUnidadeObj.name}` : 'Base')}
                            isIdaManual={disp.isManualIda}
                            isVoltaManual={disp.isManualVolta}
                            origemAloj={disp.origemNome}
                            destinoAloj={disp.destinoNome}
                            isTrocaAloj={disp.origemNome !== disp.destinoNome}
                            filteredServicosBase={servicosBase}
                            percentualCumprimentoDia={diasPercentualCumprimentoMap[dia.id] || ''}
                            motivoDescumprimentoDia={diasMotivoDescumprimentoMap[dia.id] || ''}
                            handleUpdateDiaAlojamento={handleUpdateDiaAlojamento}
                            handleUpdateDiaTempo={handleUpdateDiaTempo}
                            handleUpdateDiaTempoComp={handleUpdateDiaTempoComp}
                            handleUpdateDiaMotivoDescumprimento={handleUpdateDiaMotivoDescumprimento}
                            handleUpdateDiaDate={handleUpdateDiaDate}
                            handleRemoveDia={handleRemoveDia}
                            handleToggleReprogramarDia={handleToggleReprogramarDia}
                            handleSelectMotivoReprogramarDia={(dId, mot) => setDiasMotivoReprogramarMap(p => ({ ...p, [dId]: mot }))}
                            handleTogglePesDia={handleTogglePesDia}
                            handleToggleEtapaNoDia={(dId, et) => setDiasEtapasMap(p => ({ ...p, [dId]: [et] }))}
                            handleSetFiltroLvNoDia={(dId, f) => setDiasFiltroLvMap(p => ({ ...p, [dId]: f }))}
                            handleTogglePontoNoDia={handleTogglePontoNoDia}
                            handleSelectAllPontosNoDia={handleSelectAllPontosNoDia}
                            handleDeselectAllPontosNoDia={handleDeselectAllPontosNoDia}
                            handleAddCustomPontoNoDia={handleAddCustomPontoNoDia}
                            handleAddAtividadeNoPonto={handleAddAtividadeNoPonto}
                            handleResetPontoAtividades={handleResetPontoAtividades}
                            handleUpdateAtividade={handleUpdateAtividade}
                            handleRemoveAtividade={handleRemoveAtividade}
                            handleEnviarPlanPrincipalDia={handleEnviarPlanPrincipalDia}
                            isSubmitting={salvarProgramacao.isPending}
                          />
                        );
                      })}

                      {/* TOTALIZADOR DO PERÍODO (VISÃO JORNADA) */}
                      <div
                        className="flex items-center py-3 px-2 text-sm font-mono font-bold bg-[#F2F0EC] border-t-2 border-[#DEDAD3]"
                        style={{ borderLeft: '4px solid transparent' }}
                      >
                        <div className="w-[30px]" />
                        <div className="w-[115px] text-[#23211E]">Total do período</div>
                        <div className="w-[80px] text-[#5C574F]">
                          {totalPontosPeriodo} {totalPontosPeriodo === 1 ? 'ponto' : 'pontos'}
                        </div>
                        <div className="flex-1 min-w-[220px] px-2 text-[#6B6660] text-xs">
                          {diasProgramados.length} {diasProgramados.length === 1 ? 'dia programado' : 'dias programados'}
                        </div>
                        <div className="w-[65px] text-right pr-2 text-[#23211E]">
                          {formatMinToHours(totalHorasPeriodoMin)}
                        </div>
                        <div className="w-[95px] text-right pr-2 font-bold text-xs font-mono" style={{ color: metaColorPeriodo.texto }}>
                          R$ {totalValorPeriodo.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="w-[65px] text-right pr-2 font-bold text-xs font-mono" style={{ color: metaColorPeriodo.texto }}>
                          {pctMetaTotal}%
                        </div>
                        <div className="w-[80px]" />
                        <div className="w-[85px]" />
                        <div className="w-[200px]" />
                        <div className="w-[36px] shrink-0" />
                      </div>
                    </div>
                  )}

                  {/* VISÃO ALOJAMENTOS COM PAINEL LATERAL DE RESUMO */}
                  {viewMode === 'alojamentos' && (() => {
                    const totalKmIda = diasProgramados.reduce((acc, d, i) => acc + (getDayDisplacement(d.id, i, diasProgramados.length).distIdaKm || 0), 0);
                    const totalKmVolta = diasProgramados.reduce((acc, d, i) => acc + (getDayDisplacement(d.id, i, diasProgramados.length).distVoltaKm || 0), 0);
                    const totalKmGeral = Math.round((totalKmIda + totalKmVolta) * 10) / 10;
                    const mediaKmDia = diasProgramados.length > 0 ? Math.round((totalKmGeral / diasProgramados.length) * 10) / 10 : 0;
                    const mediaMinDeslocDia = diasProgramados.length > 0 ? Math.round(totalDeslocamentoPeriodoMin / diasProgramados.length) : 0;
                    const isMediaDeslocamentoAlto = mediaMinDeslocDia > 120;

                    const alojamentosUsadosSet = new Set<string>();
                    diasProgramados.forEach((d, i) => {
                      const disp = getDayDisplacement(d.id, i, diasProgramados.length);
                      if (disp.origemNome) alojamentosUsadosSet.add(disp.origemNome);
                      if (disp.destinoNome) alojamentosUsadosSet.add(disp.destinoNome);
                    });
                    const alojamentosUsadosList = Array.from(alojamentosUsadosSet);

                    return (
                      <div className="flex flex-col xl:flex-row items-stretch">
                        {/* TABELA DE ALOJAMENTOS */}
                        <div className="flex-1 overflow-x-auto">
                          <div style={{ minWidth: '1080px' }}>
                            <div
                              className="flex items-center py-2 px-3 text-[10.5px] uppercase tracking-wider font-bold text-[#5C574F] bg-[#F2F0EC] border-b border-[#E6E3DD] gap-2"
                              style={{ borderLeft: '4px solid transparent' }}
                            >
                              <div className="w-[110px]">Dia</div>
                              <div className="w-[210px] px-1">Saída (ida)</div>
                              <div className="w-[100px] px-1 text-center">Ida (hh:mm / km)</div>
                              <div className="w-[210px] px-1">Retorno (volta)</div>
                              <div className="w-[100px] px-1 text-center">Volta (hh:mm / km)</div>
                              <div className="w-[110px] px-1 text-center">Desloc. (hh:mm / km)</div>
                              <div className="w-[90px] px-1 text-center">Saída base (hh:mm)</div>
                              <div className="w-[90px] px-1 text-center">Segurança (hh:mm)</div>
                              <div className="w-[100px] text-center">Total comp. (hh:mm)</div>
                              <div className="w-[36px] shrink-0" />
                            </div>

                            {/* LINHAS DOS DIAS NA VISÃO ALOJAMENTOS */}
                            {diasProgramados.map((dia, idx) => {
                              const tComp = diasTemposCompMap[dia.id];
                              const sBase = tComp?.tempoSaidaBaseMin ?? tempoSaidaBasePadrao;
                              const sSeg = tComp?.tempoSegurancaMin ?? tempoSegurancaPadrao;
                              const disp = getDayDisplacement(dia.id, idx, diasProgramados.length);

                              return (
                                <PcpDiaRow
                                  key={dia.id}
                                  dia={dia}
                                  totalDias={diasProgramados.length}
                                  isExpanded={false}
                                  onToggleExpand={() => {}}
                                  viewMode="alojamentos"
                                  pontosDoDia={diasPontosMap[dia.id] || []}
                                  pontosDisponiveis={pontosDisponiveisDoProjeto}
                                  orcamentoPorPontoMap={orcamentoPorPontoMap}
                                  getItemsDoPontoNoDia={getItemsDoPontoNoDia}
                                  alojamentosDisponiveis={alojamentosDaUnidade}
                                  metaEquipeDia={metaEquipeInput}
                                  etapaGeralDia={diasEtapasMap[dia.id] || ['IMPLANTAÇÃO']}
                                  isPesDia={diasPesMap[dia.id] || false}
                                  isReprogramarDia={diasReprogramarMap[dia.id] || false}
                                  motivoReprogramarDia={diasMotivoReprogramarMap[dia.id] || ''}
                                  filtroLvDoDia={diasFiltroLvMap[dia.id] || 'COMPLETO'}
                                  tempoSaidaBaseMin={sBase}
                                  tempoSegurancaMin={sSeg}
                                  tempoIdaMin={disp.tempoIdaMin}
                                  tempoVoltaMin={disp.tempoVoltaMin}
                                  distIdaKm={disp.distIdaKm}
                                  distVoltaKm={disp.distVoltaKm}
                                  baseNome={unidadeAtivaInfo ? unidadeAtivaInfo.baseNome : (selectedUnidadeObj?.name ? `Base ${selectedUnidadeObj.name}` : 'Base')}
                                  isIdaManual={disp.isManualIda}
                                  isVoltaManual={disp.isManualVolta}
                                  origemAloj={disp.origemNome}
                                  destinoAloj={disp.destinoNome}
                                  isTrocaAloj={disp.origemNome !== disp.destinoNome}
                                  filteredServicosBase={servicosBase}
                                  percentualCumprimentoDia={diasPercentualCumprimentoMap[dia.id] || ''}
                                  motivoDescumprimentoDia={diasMotivoDescumprimentoMap[dia.id] || ''}
                                  handleUpdateDiaAlojamento={handleUpdateDiaAlojamento}
                                  handleUpdateDiaTempo={handleUpdateDiaTempo}
                                  handleUpdateDiaTempoComp={handleUpdateDiaTempoComp}
                                  handleUpdateDiaMotivoDescumprimento={handleUpdateDiaMotivoDescumprimento}
                                  handleUpdateDiaDate={handleUpdateDiaDate}
                                  handleRemoveDia={handleRemoveDia}
                                  handleToggleReprogramarDia={handleToggleReprogramarDia}
                                  handleSelectMotivoReprogramarDia={(dId, mot) => setDiasMotivoReprogramarMap(p => ({ ...p, [dId]: mot }))}
                                  handleTogglePesDia={handleTogglePesDia}
                                  handleToggleEtapaNoDia={(dId, et) => setDiasEtapasMap(p => ({ ...p, [dId]: [et] }))}
                                  handleSetFiltroLvNoDia={(dId, f) => setDiasFiltroLvMap(p => ({ ...p, [dId]: f }))}
                                  handleTogglePontoNoDia={handleTogglePontoNoDia}
                                  handleSelectAllPontosNoDia={handleSelectAllPontosNoDia}
                                  handleDeselectAllPontosNoDia={handleDeselectAllPontosNoDia}
                                  handleAddCustomPontoNoDia={handleAddCustomPontoNoDia}
                                  handleAddAtividadeNoPonto={handleAddAtividadeNoPonto}
                                  handleResetPontoAtividades={handleResetPontoAtividades}
                                  handleUpdateAtividade={handleUpdateAtividade}
                                  handleRemoveAtividade={handleRemoveAtividade}
                                  handleEnviarPlanPrincipalDia={handleEnviarPlanPrincipalDia}
                                  isSubmitting={salvarProgramacao.isPending}
                                />
                              );
                            })}

                            {/* TOTALIZADOR DO PERÍODO (VISÃO ALOJAMENTOS) */}
                            <div
                              className="flex items-center py-2 px-3 text-xs font-mono font-bold bg-[#F2F0EC] border-t-2 border-[#DEDAD3] gap-2"
                              style={{ borderLeft: '4px solid transparent' }}
                            >
                              <div className="w-[110px] text-[#23211E]">Total acumulado</div>
                              <div className="w-[210px] px-1 text-[#6B6660] text-[11px] font-sans font-medium">
                                {diasProgramados.length} {diasProgramados.length === 1 ? 'dia analisado' : 'dias analisados'}
                              </div>
                              <div className="w-[100px] text-center shrink-0 flex items-center justify-center h-8 bg-white rounded border border-[#DEDAD3] font-mono font-bold text-xs text-[#23211E] shadow-2xs">
                                {formatMinToHours(diasProgramados.reduce((acc, d, i) => acc + getDayDisplacement(d.id, i, diasProgramados.length).tempoIdaMin, 0))}
                              </div>
                              <div className="w-[210px] px-1" />
                              <div className="w-[100px] text-center shrink-0 flex items-center justify-center h-8 bg-white rounded border border-[#DEDAD3] font-mono font-bold text-xs text-[#23211E] shadow-2xs">
                                {formatMinToHours(diasProgramados.reduce((acc, d, i) => acc + getDayDisplacement(d.id, i, diasProgramados.length).tempoVoltaMin, 0))}
                              </div>
                              <div className="w-[110px] text-center shrink-0 flex items-center justify-center h-8 bg-white rounded border border-[#DEDAD3] font-mono font-bold text-xs text-[#23211E] shadow-2xs">
                                {formatMinToHours(totalDeslocamentoPeriodoMin)}
                              </div>
                              <div className="w-[90px] text-center shrink-0 flex items-center justify-center h-8 bg-white rounded border border-[#DEDAD3] font-mono font-bold text-xs text-[#23211E] shadow-2xs">
                                {formatMinToHours(diasProgramados.reduce((acc, d) => acc + (diasTemposCompMap[d.id]?.tempoSaidaBaseMin ?? tempoSaidaBasePadrao), 0))}
                              </div>
                              <div className="w-[90px] text-center shrink-0 flex items-center justify-center h-8 bg-white rounded border border-[#DEDAD3] font-mono font-bold text-xs text-[#23211E] shadow-2xs">
                                {formatMinToHours(diasProgramados.reduce((acc, d) => acc + (diasTemposCompMap[d.id]?.tempoSegurancaMin ?? tempoSegurancaPadrao), 0))}
                              </div>
                              <div className="w-[100px] text-center shrink-0 flex items-center justify-center h-8 bg-[#F7F6F3] rounded border border-[#DEDAD3] font-mono font-bold text-xs text-[#23211E] shadow-2xs">
                                {formatMinToHours(totalCompPeriodoMin)}
                              </div>
                              <div className="w-[36px] shrink-0" />
                            </div>
                          </div>
                        </div>

                        {/* PAINEL LATERAL: RESUMO DO DESLOCAMENTO PREVISTO (COMPACTO E MAIS LARGO) */}
                        <div className="w-full xl:w-[460px] shrink-0 border-t xl:border-t-0 xl:border-l border-[#E6E3DD] bg-[#FAF8F5] p-3.5 flex flex-col justify-between gap-2.5">
                          <div className="flex items-center justify-between pb-1.5 border-b border-[#E6E3DD]">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-md bg-[#E07A1F]/10 border border-[#E07A1F]/20 flex items-center justify-center text-[#E07A1F]">
                                <Navigation className="w-3.5 h-3.5" />
                              </div>
                              <div>
                                <h4 className="text-xs font-bold text-[#23211E]">Resumo do Deslocamento Previsto</h4>
                              </div>
                            </div>
                            <span className="text-[10px] text-[#6B6660] font-mono">
                              {diasProgramados.length} {diasProgramados.length === 1 ? 'dia' : 'dias'}
                            </span>
                          </div>

                          {/* 4 KPIs em linha única horizontal */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                            <div className="bg-white rounded-lg p-2 border border-[#E6E3DD] shadow-2xs text-center">
                              <span className="text-[10px] text-[#6B6660] font-medium block">Distância Total</span>
                              <span className="font-mono font-bold text-xs text-[#23211E] block mt-0.5">
                                {totalKmGeral > 0 ? `${totalKmGeral} km` : '—'}
                              </span>
                              <span className="text-[9px] font-mono text-[#A39E96]">
                                {mediaKmDia > 0 ? `~${mediaKmDia}k/d` : ''}
                              </span>
                            </div>

                            <div className="bg-white rounded-lg p-2 border border-[#E6E3DD] shadow-2xs text-center">
                              <span className="text-[10px] text-[#6B6660] font-medium block">Tempo Desloc.</span>
                              <span className="font-mono font-bold text-xs text-[#23211E] block mt-0.5" style={{ color: isMediaDeslocamentoAlto ? '#B03028' : '#23211E' }}>
                                {formatMinToHours(totalDeslocamentoPeriodoMin)}
                              </span>
                              <span className="text-[9px] font-mono text-[#A39E96]">
                                {`~${formatMinToHours(mediaMinDeslocDia)}/d`}
                              </span>
                            </div>

                            <div className="bg-white rounded-lg p-2 border border-[#E6E3DD] shadow-2xs text-center">
                              <span className="text-[10px] text-[#6B6660] font-medium block">Ida Total</span>
                              <span className="font-mono font-bold text-xs text-[#23211E] block mt-0.5">
                                {formatMinToHours(diasProgramados.reduce((acc, d, i) => acc + getDayDisplacement(d.id, i, diasProgramados.length).tempoIdaMin, 0))}
                              </span>
                              <span className="text-[9px] font-mono text-[#6B6660]">
                                {totalKmIda > 0 ? `${Math.round(totalKmIda * 10) / 10} km` : '—'}
                              </span>
                            </div>

                            <div className="bg-white rounded-lg p-2 border border-[#E6E3DD] shadow-2xs text-center">
                              <span className="text-[10px] text-[#6B6660] font-medium block">Volta Total</span>
                              <span className="font-mono font-bold text-xs text-[#23211E] block mt-0.5">
                                {formatMinToHours(diasProgramados.reduce((acc, d, i) => acc + getDayDisplacement(d.id, i, diasProgramados.length).tempoVoltaMin, 0))}
                              </span>
                              <span className="text-[9px] font-mono text-[#6B6660]">
                                {totalKmVolta > 0 ? `${Math.round(totalKmVolta * 10) / 10} km` : '—'}
                              </span>
                            </div>
                          </div>

                          {/* Banner de Conformidade e Alojamentos */}
                          <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#E6E3DD] flex-wrap">
                            {/* Badge de Alerta ou Sucesso */}
                            <div className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs border ${
                              isMediaDeslocamentoAlto
                                ? 'bg-[#FDF2F0] border-[#F2C0B8] text-[#B03028]'
                                : 'bg-[#E6F2EA] border-[#A0D4B2] text-[#17794C]'
                            }`}>
                              <Info className="w-3.5 h-3.5 shrink-0" />
                              <span className="text-[10.5px] leading-tight">
                                {isMediaDeslocamentoAlto
                                  ? <>Média <strong>{formatMinToHours(mediaMinDeslocDia)}/dia</strong> acima do teto de 02:00.</>
                                  : <>Média <strong>{formatMinToHours(mediaMinDeslocDia)}/dia</strong> dentro da janela ideal.</>
                                }
                              </span>
                            </div>

                            {/* Alojamentos */}
                            <div className="flex items-center gap-1 flex-wrap">
                              {alojamentosUsadosList.map(aloj => (
                                <span
                                  key={aloj}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white border border-[#DEDAD3] text-[10.5px] font-medium text-[#23211E]"
                                >
                                  <Building2 className="w-3 h-3 text-[#E07A1F] shrink-0" />
                                  <span className="truncate max-w-[130px]">{aloj}</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* RODAPÉ DO CARD "DIAS PROGRAMADOS" */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 px-4 bg-[#FBFAF7] border-t border-[#E6E3DD]">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {viewMode === 'jornada' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={expandedDayIds.length === diasProgramados.length ? handleCollapseAll : handleExpandAll}
                        className="h-8 px-3 text-xs bg-white border-[#DEDAD3] text-[#23211E] font-semibold"
                      >
                        {expandedDayIds.length === diasProgramados.length ? 'Recolher todos' : 'Expandir todos'}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setViewMode('jornada')}
                        className="h-8 px-3 text-xs bg-white border-[#E8C9A0] text-[#A06A16] hover:bg-[#FBF5EC] font-bold gap-1.5 shadow-2xs"
                      >
                        <Clock className="w-3.5 h-3.5 text-[#E07A1F]" /> Voltar para Jornada
                      </Button>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAddDiaExtra}
                      className="h-8 px-3 text-xs bg-white border-[#DEDAD3] text-[#23211E] gap-1.5 font-semibold"
                    >
                      <Plus className="w-3.5 h-3.5 text-[#E07A1F]" /> Adicionar dia extra
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDistribuirPontosAuto}
                      className="h-8 px-3 text-xs bg-white border-[#DEDAD3] text-[#23211E] gap-1.5 font-semibold"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[#E07A1F]" /> Distribuir pontos
                    </Button>
                  </div>

                  <div className="flex items-center gap-3">
                    {viewMode === 'jornada' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setViewMode('alojamentos')}
                        className="h-9 px-3.5 text-xs bg-white border-[#DEDAD3] text-[#5C574F] hover:text-[#23211E] font-semibold gap-1.5"
                      >
                        <Building2 className="w-3.5 h-3.5 text-[#E07A1F]" /> Ver Alojamentos
                      </Button>
                    )}

                    <Button
                      size="sm"
                      disabled={salvarProgramacao.isPending}
                      onClick={handleEnviarTodosOsDias}
                      className="h-9 px-5 text-xs font-bold bg-[#E07A1F] text-white hover:bg-[#E07A1F]/90 gap-2 shadow-2xs transition-all disabled:opacity-70"
                    >
                      {salvarProgramacao.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Enviando...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          <span>Enviar todos os dias ({diasProgramados.length})</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      {/* MODAL DE CARREGAR PLANEJAMENTO EXISTENTE */}
      <Dialog open={isCarregarPlanModalOpen} onOpenChange={setIsCarregarPlanModalOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0 gap-0 bg-white">
          <DialogHeader className="p-4 border-b border-[#E6E3DD]">
            <DialogTitle className="text-sm font-bold text-[#23211E] flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-[#E07A1F]" /> Carregar planejamento existente
            </DialogTitle>
            <DialogDescription className="text-xs text-[#6B6660]">
              Selecione um ou mais planejamentos da planilha para importar para a tela.
            </DialogDescription>
          </DialogHeader>

          {/* Filtros e Busca do Modal */}
          <div className="p-3 bg-[#F7F6F3] border-b border-[#E6E3DD] flex flex-wrap items-center gap-2 text-xs">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#A39E96]" />
              <input
                placeholder="Buscar projeto, equipe, data..."
                value={searchExistingPlan}
                onChange={e => setSearchExistingPlan(e.target.value)}
                className="w-full h-8 pl-8 pr-2 text-xs rounded border border-[#DEDAD3] bg-white font-mono"
              />
            </div>

            {/* Filtro de Período (De / Até) */}
            <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded border border-[#DEDAD3]">
              <span className="text-[10px] uppercase font-bold text-[#6B6660]">De:</span>
              <input
                type="date"
                value={filterDataInicioExistingPlan}
                onChange={e => setFilterDataInicioExistingPlan(e.target.value)}
                className="h-6 px-1 text-xs rounded border border-[#DEDAD3] font-mono text-[#23211E]"
              />
              <span className="text-[10px] uppercase font-bold text-[#6B6660]">Até:</span>
              <input
                type="date"
                value={filterDataFimExistingPlan}
                onChange={e => setFilterDataFimExistingPlan(e.target.value)}
                className="h-6 px-1 text-xs rounded border border-[#DEDAD3] font-mono text-[#23211E]"
              />
              {(filterDataInicioExistingPlan || filterDataFimExistingPlan) && (
                <button
                  type="button"
                  onClick={() => {
                    setFilterDataInicioExistingPlan('');
                    setFilterDataFimExistingPlan('');
                  }}
                  className="text-[10px] font-bold text-[#E07A1F] hover:underline ml-1"
                >
                  Limpar
                </button>
              )}
            </div>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={`h-8 px-3 text-xs border font-medium gap-1.5 ${
                    filterEquipesExistingPlan.length > 0
                      ? 'bg-[#FBF5EC] border-[#E8C9A0] text-[#A06A16] font-bold'
                      : 'bg-white border-[#DEDAD3] text-[#5C574F]'
                  }`}
                >
                  <UsersRound className="w-3.5 h-3.5 text-[#E07A1F]" />
                  <span className="text-[10px] uppercase tracking-wider text-[#A39E96] font-semibold">Equipes</span>
                  <span className="font-mono font-bold">
                    {filterEquipesExistingPlan.length > 0
                      ? (filterEquipesExistingPlan.length <= 2
                          ? filterEquipesExistingPlan.join(', ')
                          : `${filterEquipesExistingPlan.length} sel.`)
                      : 'Todas'}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 ml-1 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[240px] p-3 bg-white" align="start">
                <div className="space-y-2">
                  <span className="text-xs font-bold text-[#23211E] block">Filtrar por equipes</span>
                  <div className="max-h-[220px] overflow-y-auto space-y-1.5">
                    {equipesDisponiveis.map(eq => (
                      <label key={eq} className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-[#F7F6F3] cursor-pointer text-xs">
                        <Checkbox
                          checked={filterEquipesExistingPlan.includes(eq)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setFilterEquipesExistingPlan(prev => [...prev, eq]);
                            } else {
                              setFilterEquipesExistingPlan(prev => prev.filter(e => e !== eq));
                            }
                          }}
                          className="rounded border-[#DEDAD3] text-[#E07A1F] focus:ring-[#E07A1F] h-4 w-4"
                        />
                        <span className="font-mono font-bold text-[#23211E]">{eq}</span>
                      </label>
                    ))}
                  </div>
                  <div className="flex justify-between pt-1.5 border-t border-[#E6E3DD]">
                    <Button
                      variant="ghost"
                      type="button"
                      size="sm"
                      onClick={() => setFilterEquipesExistingPlan(equipesDisponiveis)}
                      className="text-[10px] h-6 px-2 text-[#E07A1F] font-bold"
                    >
                      Todas
                    </Button>
                    <Button
                      variant="ghost"
                      type="button"
                      size="sm"
                      onClick={() => setFilterEquipesExistingPlan([])}
                      className="text-[10px] h-6 px-2 text-[#A39E96] font-bold"
                    >
                      Limpar
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <label className="flex items-center gap-1.5 cursor-pointer text-xs text-[#5C574F] font-medium">
              <input
                type="checkbox"
                checked={filterOnlyCurrentObra}
                onChange={e => setFilterOnlyCurrentObra(e.target.checked)}
                className="rounded border-[#DEDAD3] text-[#E07A1F]"
              />
              <span>Somente obra atual</span>
            </label>

            {/* Ações Rápidas de Seleção */}
            <div className="flex items-center gap-1 ml-auto">
              <button
                type="button"
                onClick={() => {
                  const allKeys = filteredExistingPlans.map(p => `${p.chaveBk}-${p.rowIdx}`);
                  setSelectedExistingPlanKeys(allKeys);
                }}
                className="text-[11px] font-bold text-[#E07A1F] hover:underline px-1.5 py-0.5 rounded hover:bg-[#FBF5EC]"
              >
                Selecionar todos ({filteredExistingPlans.length})
              </button>
              <span className="text-[#DEDAD3]">|</span>
              <button
                type="button"
                onClick={() => setSelectedExistingPlanKeys([])}
                className="text-[11px] font-medium text-[#6B6660] hover:underline px-1.5 py-0.5 rounded hover:bg-[#F2F0EC]"
              >
                Desmarcar
              </button>
            </div>
          </div>

          {/* Lista de Planejamentos */}
          <div className="flex-1 overflow-y-auto p-3 max-h-[400px]">
            {filteredExistingPlans.length === 0 ? (
              <div className="text-center py-12 text-xs text-[#A39E96]">
                Nenhum planejamento existente encontrado com os filtros aplicados.
              </div>
            ) : (
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-[#F2F0EC] text-[#5C574F] text-[10px] uppercase border-b border-[#E6E3DD] font-semibold">
                    <th className="p-2.5 w-[36px]"></th>
                    <th className="p-2.5">Data</th>
                    <th className="p-2.5">Equipe</th>
                    <th className="p-2.5">Projeto</th>
                    <th className="p-2.5">Alojamento</th>
                    <th className="p-2.5">Pontos</th>
                    <th className="p-2.5 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6E3DD]">
                  {filteredExistingPlans.map(plan => {
                    const key = `${plan.chaveBk}-${plan.rowIdx}`;
                    const isChecked = selectedExistingPlanKeys.includes(key);

                    return (
                      <tr
                        key={key}
                        onClick={() => {
                          setSelectedExistingPlanKeys(prev =>
                            prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
                          );
                        }}
                        className={`hover:bg-[#FBF5EC] cursor-pointer ${isChecked ? 'bg-[#FBF5EC]' : ''}`}
                      >
                        <td className="p-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="rounded border-[#DEDAD3] text-[#E07A1F]"
                          />
                        </td>
                        <td className="p-2.5 font-mono font-bold text-[#23211E]">{plan.dataCompleta}</td>
                        <td className="p-2.5 font-mono">{plan.equipe}</td>
                        <td className="p-2.5 font-mono font-bold text-[#E07A1F]">{plan.projeto}</td>
                        <td className="p-2.5 font-mono text-[11px] text-[#6B6660]">{plan.alojamento || '-'}</td>
                        <td className="p-2.5 font-mono text-[#5C574F]">{plan.pontosStr || `${plan.pontos.length} pontos`}</td>
                        <td className="p-2.5 text-right font-mono font-semibold text-[#17794C]">
                          R$ {(
                            (plan.valorPlanejado && plan.valorPlanejado > 0)
                              ? plan.valorPlanejado
                              : (plan.parsedAtividades?.reduce((acc, a) => {
                                  const servBase = servicosBase.find(s =>
                                    (s.servico || '').toUpperCase() === (a.servico || '').toUpperCase() ||
                                    (a.servico || '').toUpperCase().includes((s.servico || '').toUpperCase()) ||
                                    (s.servico || '').toUpperCase().includes((a.servico || '').toUpperCase())
                                  );
                                  return acc + ((servBase?.valorPorUnidade || 0) * (a.quantidade || 1));
                                }, 0) || 0)
                          ).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Rodapé do Modal */}
          <div className="p-3.5 border-t border-[#E6E3DD] bg-[#FBFAF7] flex items-center justify-between">
            <span className="text-xs text-[#6B6660] font-medium">
              {selectedExistingPlanKeys.length} {selectedExistingPlanKeys.length === 1 ? 'selecionado' : 'selecionados'}
            </span>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCarregarPlanModalOpen(false)}
                className="h-8 text-xs"
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                disabled={selectedExistingPlanKeys.length === 0}
                onClick={() => {
                  const plansToLoad = filteredExistingPlans.filter(p =>
                    selectedExistingPlanKeys.includes(`${p.chaveBk}-${p.rowIdx}`)
                  );
                  handleCarregarPlanejamentosSelecionados(plansToLoad);
                }}
                className="h-8 px-3.5 text-xs bg-[#E07A1F] text-white hover:bg-[#E07A1F]/90 font-bold"
              >
                Carregar selecionados ({selectedExistingPlanKeys.length})
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
