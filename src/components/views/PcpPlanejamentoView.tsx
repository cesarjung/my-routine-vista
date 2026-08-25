import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
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
  DollarSign
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
  MOTIVOS_REPROGRAMACAO_COL_AU
} from '@/hooks/usePcpPlanejamentoData';
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
import { toast } from 'sonner';
import { PcpDiaRow } from './PcpDiaRow';

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

  const selectedUnidadeObj = useMemo(() => {
    if (!selectedUnidadeId) return null;
    return UNIDADES_DISPONIVEIS.find(u => u.id === selectedUnidadeId) || null;
  }, [selectedUnidadeId]);

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

  // Modal Carregar Planejamento
  const [isCarregarPlanModalOpen, setIsCarregarPlanModalOpen] = useState(false);
  const [selectedExistingPlanKeys, setSelectedExistingPlanKeys] = useState<string[]>([]);
  const [filterEquipeExistingPlan, setFilterEquipeExistingPlan] = useState<string>('TODAS');
  const [filterOnlyCurrentPeriod, setFilterOnlyCurrentPeriod] = useState<boolean>(false);
  const [filterOnlyCurrentObra, setFilterOnlyCurrentObra] = useState<boolean>(false);
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

  // Alojamento Padrão Nome
  const alojamentoPadrao = useMemo(() => {
    if (!selectedAlojamentoId || selectedAlojamentoId === 'nenhum') {
      return selectedUnidadeObj?.name ? `Base ${selectedUnidadeObj.name}` : 'Base';
    }
    const found = alojamentos.find(a => a.id === selectedAlojamentoId);
    return found ? found.nome : (selectedUnidadeObj?.name ? `Base ${selectedUnidadeObj.name}` : 'Base');
  }, [alojamentos, selectedAlojamentoId, selectedUnidadeObj]);

  // Handler de troca de unidade com reset
  const handleUnidadeChange = (newUnitId: string) => {
    setSelectedUnidadeId(newUnitId);
    setSelectedObraId('');
    setSelectedSituacao('TODAS');
    setSelectedMesFilter('TODOS');
    setSelectedMunicipioFilter('TODOS');
    setSelectedPrioridadeFilter('TODAS');
    setSelectedDonoFilter('TODOS');
    setSelectedSupervisorFilter('TODOS');
    setSearchObra('');
    setDiasPontosMap({});
    setDiasPontosGroupedMap({});
    toast.success('Unidade alterada com sucesso.');
  };

  // Lista de Dias Programados
  const diasProgramados = useMemo(() => {
    try {
      const start = safeParseDate(dataInicio);
      const end = safeParseDate(dataFim);
      if (end < start) return [];

      const intervalDays = eachDayOfInterval({ start, end });
      const baseDays = intervalDays.map((dateObj, idx) => {
        const id = format(dateObj, 'yyyy-MM-dd');
        const nomeDia = format(dateObj, 'EEEE', { locale: ptBR });
        const dataStr = format(dateObj, 'dd/MM');
        const dataCompleta = format(dateObj, 'dd/MM/yyyy');
        return {
          id,
          index: idx + 1,
          nomeDia: nomeDia.charAt(0).toUpperCase() + nomeDia.slice(1),
          dataStr,
          dataCompleta,
          dateObj,
          isPes: diasPesMap[id] || false,
          reprogramar: diasReprogramarMap[id] || false,
          motivoReprogramar: diasMotivoReprogramarMap[id] || '',
        };
      });

      const extraDays = diasExtrasList.map((extraId, idx) => {
        const dateObj = safeParseDate(extraId);
        const nomeDia = format(dateObj, 'EEEE', { locale: ptBR });
        const dataStr = format(dateObj, 'dd/MM');
        const dataCompleta = format(dateObj, 'dd/MM/yyyy');
        return {
          id: extraId,
          index: baseDays.length + idx + 1,
          nomeDia: nomeDia.charAt(0).toUpperCase() + nomeDia.slice(1),
          dataStr,
          dataCompleta,
          dateObj,
          isPes: diasPesMap[extraId] || false,
          reprogramar: diasReprogramarMap[extraId] || false,
          motivoReprogramar: diasMotivoReprogramarMap[extraId] || '',
        };
      });

      return [...baseDays, ...extraDays];
    } catch {
      return [];
    }
  }, [dataInicio, dataFim, diasPesMap, diasReprogramarMap, diasMotivoReprogramarMap, diasExtrasList]);

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
    const budgetItems = orcamentoPorPontoMap.get(pUpper) || [];
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
  }, [diasPontosGroupedMap, orcamentoPorPontoMap]);

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
    setDiasExtrasList(prev => [...prev, newId]);
    toast.success(`Dia extra (${format(nextDate, 'dd/MM/yyyy')}) adicionado com sucesso.`);
  };

  const handleRemoveDia = (diaId: string) => {
    if (diasExtrasList.includes(diaId)) {
      setDiasExtrasList(prev => prev.filter(d => d !== diaId));
    }
    setDiasPontosMap(prev => {
      const next = { ...prev };
      delete next[diaId];
      return next;
    });
    setExpandedDayIds(prev => prev.filter(id => id !== diaId));
    toast.success('Dia removido do planejamento.');
  };

  const handleUpdateDiaDate = (diaId: string, newDate: Date) => {
    const newId = format(newDate, 'yyyy-MM-dd');
    if (diasExtrasList.includes(diaId)) {
      setDiasExtrasList(prev => prev.map(d => d === diaId ? newId : d));
    }
    if (newId !== diaId) {
      setDiasPontosMap(prev => {
        const next = { ...prev };
        if (next[diaId]) {
          next[newId] = next[diaId];
          delete next[diaId];
        }
        return next;
      });
      setDiasPontosGroupedMap(prev => {
        const next = { ...prev };
        if (next[diaId]) {
          next[newId] = next[diaId];
          delete next[diaId];
        }
        return next;
      });
    }
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
        setDiasMotivoReprogramarMap(m => ({ ...m, [diaId]: 'CHUVA' }));
      }
      return {
        ...prev,
        [diaId]: nextVal
      };
    });
  };

  // Handlers de Pontos
  const handleTogglePontoNoDia = (diaId: string, pontoLabel: string) => {
    setDiasPontosMap(prev => {
      const current = prev[diaId] || [];
      const next = current.includes(pontoLabel)
        ? current.filter(p => p !== pontoLabel)
        : [...current, pontoLabel];
      return { ...prev, [diaId]: next };
    });
  };

  const handleSelectAllPontosNoDia = (diaId: string) => {
    setDiasPontosMap(prev => ({
      ...prev,
      [diaId]: [...pontosDisponiveisDoProjeto]
    }));
  };

  const handleDeselectAllPontosNoDia = (diaId: string) => {
    setDiasPontosMap(prev => ({
      ...prev,
      [diaId]: []
    }));
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
  const handleAddAtividadeNoPonto = (diaId: string, pontoLabelTarget: string) => {
    const pUpper = (pontoLabelTarget || '').toUpperCase();
    const existing = getItemsDoPontoNoDia(diaId, pUpper);
    const existingServicos = new Set(existing.map(i => i.servico));
    const safeBase = Array.isArray(servicosBase) && servicosBase.length > 0 ? servicosBase : [];
    const fallback = safeBase.length > 0 ? safeBase[0] : { servico: 'INSTALAR ISOLADOR BASTAO/DISCO', tempoMinutosPorUnidade: 27, valorPorUnidade: 338.40 };
    const nextAvailable = safeBase.find(s => s && s.servico && !existingServicos.has(s.servico)) || fallback;

    const newActivity: PcpPontoItem = {
      id: `${diaId}-${pUpper}-manual-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      ponto: pUpper,
      servico: nextAvailable.servico,
      codigoMaterial: nextAvailable.codigo,
      qtdOrcadaPonto: 1,
      etapaPrevista: 'IMPLANTAÇÃO',
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

  // Envio de Programação (usando salvarProgramacao.mutateAsync)
  const handleEnviarPlanPrincipalDia = async (diaId: string) => {
    if (!selectedObra) {
      toast.error('Nenhuma obra selecionada para enviar.');
      return;
    }
    const diaTarget = diasProgramados.find(d => d.id === diaId);
    if (!diaTarget) return;

    const pontosDia = diasPontosMap[diaId] || [];
    const allActivitiesDia: PcpPontoItem[] = [];
    pontosDia.forEach(p => {
      const items = getItemsDoPontoNoDia(diaId, p);
      allActivitiesDia.push(...items.filter(i => i.selected));
    });

    if (allActivitiesDia.length === 0) {
      toast.error(`O dia ${diaTarget.dataStr} não possui nenhuma atividade marcada.`);
      return;
    }

    try {
      const formPayload: PcpProgramacaoForm = {
        unidadeId: selectedUnidadeId,
        dataProgramacao: diaTarget.dataCompleta,
        dateObj: diaTarget.dateObj,
        supervisor,
        equipe: selectedEquipes[0] || 'EH156',
        etapa: (diasEtapasMap[diaId] || ['IMPLANTAÇÃO'])[0] || 'IMPLANTAÇÃO',
        obra: selectedObra,
        pontos: allActivitiesDia,
        isPes: diasPesMap[diaId] || false,
        reprogramar: diasReprogramarMap[diaId] || false,
        motivoReprogramacao: diasMotivoReprogramarMap[diaId] || '',
        metaEquipeValor: metaEquipeInput,
      };

      await salvarProgramacao.mutateAsync([formPayload]);
      toast.success(`Programação de ${diaTarget.dataStr} enviada com sucesso para a Plan_Principal!`);
    } catch (err: any) {
      toast.error(`Erro ao enviar dia: ${err.message || 'Erro inesperado'}`);
    }
  };

  const handleEnviarTodosOsDias = async () => {
    if (!selectedObra) {
      toast.error('Selecione uma obra antes de enviar.');
      return;
    }
    const diasComAtividades = diasProgramados.filter(d => {
      const pts = diasPontosMap[d.id] || [];
      return pts.some(p => getItemsDoPontoNoDia(d.id, p).some(i => i.selected));
    });

    if (diasComAtividades.length === 0) {
      toast.error('Nenhum dia possui atividades marcadas para envio.');
      return;
    }

    try {
      const allForms: PcpProgramacaoForm[] = [];
      const equipesToSend = selectedEquipes.length > 0 ? selectedEquipes : ['EH156'];

      for (const d of diasComAtividades) {
        const pts = diasPontosMap[d.id] || [];
        const allActs: PcpPontoItem[] = [];
        pts.forEach(p => {
          allActs.push(...getItemsDoPontoNoDia(d.id, p).filter(i => i.selected));
        });

        for (const eq of equipesToSend) {
          allForms.push({
            unidadeId: selectedUnidadeId,
            dataProgramacao: d.dataCompleta,
            dateObj: d.dateObj,
            supervisor,
            equipe: eq,
            etapa: (diasEtapasMap[d.id] || ['IMPLANTAÇÃO'])[0] || 'IMPLANTAÇÃO',
            obra: selectedObra,
            pontos: allActs,
            isPes: diasPesMap[d.id] || false,
            reprogramar: diasReprogramarMap[d.id] || false,
            motivoReprogramacao: diasMotivoReprogramarMap[d.id] || '',
            metaEquipeValor: metaEquipeInput,
          });
        }
      }

      await salvarProgramacao.mutateAsync(allForms);
      toast.success(`Programação de todos os ${diasComAtividades.length} dias enviada com sucesso para a Plan_Principal!`);
    } catch (err: any) {
      toast.error(`Erro ao enviar dias: ${err.message || 'Erro inesperado'}`);
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
    toast.success('Planejamento e pontos em tela limpos com sucesso.');
  };

  // Sincronizar Google Sheets via API
  const handleSyncFromGoogleSheets = async () => {
    if (!selectedUnidadeId) {
      toast.error('Selecione uma unidade antes de sincronizar.');
      return;
    }
    try {
      toast.loading('Sincronizando planilha do Google Sheets no Supabase...', { id: 'sync-sheets' });
      const res = await fetch('/api/sync-pcp-cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unidadeId: selectedUnidadeId }),
      });
      const data = await res.json();
      if (data.success) {
        await rawCacheQuery.refetch();
        await orcamentoPontosQuery.refetch();
        toast.success('Planilha do Google Sheets sincronizada com sucesso!', { id: 'sync-sheets' });
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

    const nextDiasPontosMap = { ...diasPontosMap };
    const nextDiasPontosGroupedMap = { ...diasPontosGroupedMap };

    plansToLoad.forEach(plan => {
      let matchedDia = diasProgramados.find(d => d.dataCompleta === plan.dataStr || plan.dataCompleta.includes(d.dataCompleta));
      let dayId = matchedDia?.id;
      if (!dayId && plan.dataStr) {
        const parts = plan.dataStr.split('/');
        if (parts.length === 3) {
          dayId = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }
      if (dayId) {
        nextDiasPontosMap[dayId] = plan.pontos.length > 0 ? plan.pontos : [];
        if (!nextDiasPontosGroupedMap[dayId]) nextDiasPontosGroupedMap[dayId] = {};
      }

      plan.pontos.forEach(pLabel => {
        const pUpper = pLabel.toUpperCase();
        const ativsDoPonto = plan.parsedAtividades.filter(a => a.ponto === pUpper);
        const budgetItems = orcamentoPorPontoMap.get(pUpper) || [];
        const combinedItems: PcpPontoItem[] = [];

        ativsDoPonto.forEach((a, aIdx) => {
          const matchedBudget = budgetItems.find(b =>
            (b.servicoPrevisto || '').toUpperCase().includes((a.servico || '').toUpperCase())
          );
          const vUnit = matchedBudget?.valorUnitario || (a.quantidade > 0 ? (matchedBudget?.valorEstimado ? matchedBudget.valorEstimado / (matchedBudget.quantidade || 1) : 0) : 0);
          combinedItems.push({
            id: `loaded-${dayId || 'day'}-${pUpper}-${aIdx}`,
            ponto: pUpper,
            servico: a.servico,
            codigoMaterial: matchedBudget?.codigo || '',
            descricaoMaterial: matchedBudget?.descricao || a.servico,
            qtdOrcadaPonto: matchedBudget?.quantidade || a.quantidade,
            etapaPrevista: a.etapa || matchedBudget?.etapaPrevista || 'IMPLANTAÇÃO',
            quantidade: a.quantidade,
            valorUnitario: vUnit,
            tempoEstimadoMinutos: a.tempoMinutos || matchedBudget?.tempoMinutos || 15,
            tempoUnitarioMinutos: matchedBudget?.tempoUnitarioMinutos || 15,
            valorEstimado: vUnit > 0 ? vUnit * a.quantidade : (matchedBudget?.valorEstimado || 0),
            selected: true,
            isBudgeted: Boolean(matchedBudget),
            usaRetro: false,
            tempoRetroMinutos: 30,
          });
        });

        if (dayId) {
          if (!nextDiasPontosGroupedMap[dayId]) nextDiasPontosGroupedMap[dayId] = {};
          nextDiasPontosGroupedMap[dayId][pUpper] = combinedItems;
        }
      });
    });

    setDiasPontosMap(nextDiasPontosMap);
    setDiasPontosGroupedMap(nextDiasPontosGroupedMap);
    setIsCarregarPlanModalOpen(false);
    setSelectedExistingPlanKeys([]);
    toast.success(`${plansToLoad.length} ${plansToLoad.length === 1 ? 'planejamento carregado' : 'planejamentos carregados'} com sucesso.`);
  };

  // Resumo de Status do Fluxo para as Pílulas do Header
  const diasSemPontosCount = diasProgramados.filter(d => (diasPontosMap[d.id] || []).length === 0).length;
  const diasAcima10hCount = diasProgramados.filter(d => {
    const pts = diasPontosMap[d.id] || [];
    let totMin = tempoSaidaBasePadrao + tempoSegurancaPadrao + 80;
    pts.forEach(p => {
      totMin += getItemsDoPontoNoDia(d.id, p).filter(i => i.selected).reduce((acc, i) => acc + (i.tempoEstimadoMinutos || 0), 0);
    });
    return totMin / 60 > 10.0;
  }).length;

  // Totais do Período para o Totalizador da Grade
  let totalPontosPeriodo = 0;
  let totalHorasPeriodoMin = 0;
  let totalValorPeriodo = 0;
  let totalDeslocamentoPeriodoMin = 0;
  let totalCompPeriodoMin = 0;

  diasProgramados.forEach(d => {
    const pts = diasPontosMap[d.id] || [];
    totalPontosPeriodo += pts.length;

    const tComp = diasTemposCompMap[d.id];
    const sBase = tComp?.tempoSaidaBaseMin ?? tempoSaidaBasePadrao;
    const sSeg = tComp?.tempoSegurancaMin ?? tempoSegurancaPadrao;
    const customAl = diasCustomAlojMap[d.id];
    const ida = customAl?.tempoIdaMin ?? 40;
    const volta = customAl?.tempoVoltaMin ?? 40;

    let servMin = 0;
    pts.forEach(p => {
      getItemsDoPontoNoDia(d.id, p).forEach(i => {
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

  // Filtros Existentes Modal
  const filteredExistingPlans = useMemo(() => {
    const list = planejamentosExistentesList || [];
    return list.filter(p => {
      if (filterEquipeExistingPlan !== 'TODAS' && p.equipe.toUpperCase() !== filterEquipeExistingPlan.toUpperCase()) {
        return false;
      }
      if (filterOnlyCurrentObra && selectedObraId && p.projeto !== selectedObraId) {
        return false;
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
  }, [planejamentosExistentesList, filterEquipeExistingPlan, filterOnlyCurrentObra, selectedObraId, searchExistingPlan]);

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

      {/* 3.3 GRID PRINCIPAL: 2 COLUNAS (330px | 1fr) */}
      <div className="grid grid-cols-1 xl:grid-cols-[330px_1fr] gap-4 items-start">
        {/* COLUNA ESQUERDA (FIXA / STICKY) */}
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
                  <span className="text-[#5C574F] font-semibold">Vistoria</span>
                  <span className={`px-2 py-0.5 rounded text-[10.5px] font-bold ${
                    currentRisk?.classificacao === 'Vermelho'
                      ? 'bg-[#F9E4E1] text-[#B03028]'
                      : currentRisk?.classificacao === 'Laranja'
                        ? 'bg-[#FBF2DA] text-[#A06A16]'
                        : 'bg-[#E6F2EA] text-[#17794C]'
                  }`}>
                    {currentRisk ? `Risco ${currentRisk.classificacao}` : 'Sem impedimentos'}
                  </span>
                </div>
                <div className="space-y-1 text-[#6B6660] text-[11.5px]">
                  {currentRisk?.pontosDetalhados && currentRisk.pontosDetalhados.length > 0 ? (
                    currentRisk.pontosDetalhados.slice(0, 3).map((pt, pIdx) => (
                      <div key={pIdx} className="flex items-start gap-1.5">
                        <span className={pt.isCritico ? 'text-[#C0392E]' : 'text-[#E07A1F]'}>●</span>
                        <span className="truncate">{pt.texto}</span>
                      </div>
                    ))
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

        {/* COLUNA DIREITA (CONTEÚDO PRINCIPAL) */}
        <main className="space-y-3.5">
          {/* Mensagem se nenhuma obra foi selecionada */}
          {!selectedObra ? (
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
          ) : (
            <>
              {/* 1. Faixa da Obra Selecionada */}
              <div className="bg-white rounded-xl border border-[#E6E3DD] p-3.5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-base text-[#E07A1F]">{selectedObra.projeto}</span>
                    <span className="text-sm font-bold text-[#23211E]">— {selectedObra.nomeProjeto || (selectedObra as any).descricao}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-[#6B6660] mt-1 font-medium">
                    <span>Município: <strong className="text-[#23211E]">{selectedObra.municipio}</strong></span>
                    <span>Dono: <strong className="text-[#23211E]">{selectedObra.donoDaObra || (selectedObra as any).donoObra || 'Não informado'}</strong></span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs font-mono font-semibold bg-[#F7F6F3] px-3.5 py-2 rounded-lg border border-[#E6E3DD] shrink-0">
                  <span className="text-[#6B6660]">Meta diária da equipe:</span>
                  <span className="text-[#17794C] text-sm font-bold">
                    R$ {metaEquipeInput.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* 2. Parâmetros (Chips numa linha) */}
              <div className="bg-white rounded-xl border border-[#E6E3DD] p-3 shadow-2xs flex flex-wrap items-center gap-2.5 text-xs">
                {/* Equipe */}
                <Select value={selectedEquipes[0] || 'EH156'} onValueChange={val => setSelectedEquipes([val])}>
                  <SelectTrigger className="h-8 text-xs bg-[#F7F6F3] border-[#DEDAD3] text-[#23211E] font-medium">
                    <span className="text-[11px] uppercase text-[#A39E96] mr-1.5 font-semibold">Equipe</span>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {equipesDisponiveis.map(eq => (
                      <SelectItem key={eq} value={eq} className="text-xs">{eq}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Base / Alojamento Padrão */}
                <Select value={selectedAlojamentoId} onValueChange={setSelectedAlojamentoId}>
                  <SelectTrigger className="h-8 text-xs bg-[#F7F6F3] border-[#DEDAD3] text-[#23211E] font-medium">
                    <span className="text-[11px] uppercase text-[#A39E96] mr-1.5 font-semibold">Alojamento</span>
                    <SelectValue placeholder="Base" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nenhum" className="text-xs">{selectedUnidadeObj?.name ? `Base ${selectedUnidadeObj.name}` : 'Base'}</SelectItem>
                    {alojamentos.map(a => (
                      <SelectItem key={a.id} value={a.id} className="text-xs">{a.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Período com Popover */}
                <Popover open={isDataRangeOpen} onOpenChange={setIsDataRangeOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 px-3 text-xs bg-[#F7F6F3] border-[#DEDAD3] text-[#23211E] gap-1.5 font-semibold">
                      <CalendarIcon className="w-3.5 h-3.5 text-[#5C574F]" />
                      <span className="text-[11px] uppercase text-[#A39E96]">Período:</span>
                      <span className="font-mono">{format(safeParseDate(dataInicio), 'dd/MM')} a {format(safeParseDate(dataFim), 'dd/MM')}</span>
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
                            onChange={e => setDataInicio(e.target.value)}
                            className="w-full h-8 text-xs border border-[#DEDAD3] rounded px-2 font-mono"
                          />
                        </div>
                        <div>
                          <span className="text-[11px] text-[#A39E96] block mb-1">Data fim</span>
                          <input
                            type="date"
                            value={dataFim}
                            onChange={e => setDataFim(e.target.value)}
                            className="w-full h-8 text-xs border border-[#DEDAD3] rounded px-2 font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Saída Base Padrão */}
                <div className="inline-flex items-center gap-1.5 bg-[#F7F6F3] border border-[#DEDAD3] rounded px-2.5 h-8">
                  <span className="text-[11px] uppercase text-[#A39E96] font-semibold">Saída base:</span>
                  <input
                    type="number"
                    min="0"
                    step="5"
                    value={tempoSaidaBasePadrao}
                    onChange={e => setTempoSaidaBasePadrao(parseInt(e.target.value, 10) || 0)}
                    className="w-9 text-center text-xs font-mono font-bold bg-transparent focus:outline-none"
                  />
                  <span className="text-[#A39E96] text-[11px]">min</span>
                </div>

                {/* Segurança Padrão */}
                <div className="inline-flex items-center gap-1.5 bg-[#F7F6F3] border border-[#DEDAD3] rounded px-2.5 h-8">
                  <span className="text-[11px] uppercase text-[#A39E96] font-semibold">Segurança:</span>
                  <input
                    type="number"
                    min="0"
                    step="5"
                    value={tempoSegurancaPadrao}
                    onChange={e => setTempoSegurancaPadrao(parseInt(e.target.value, 10) || 0)}
                    className="w-9 text-center text-xs font-mono font-bold bg-transparent focus:outline-none"
                  />
                  <span className="text-[#A39E96] text-[11px]">min</span>
                </div>
              </div>

              {/* 3. CARD CENTRAL "DIAS PROGRAMADOS" */}
              <div className="bg-white rounded-xl border border-[#E6E3DD] shadow-2xs overflow-hidden">
                {/* Cabeçalho do Card */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 px-4 bg-[#FBFAF7] border-b border-[#E6E3DD] min-h-[50px]">
                  <div className="flex items-center gap-4">
                    <h2 className="text-sm font-bold text-[#23211E]">
                      Dias programados ({diasProgramados.length})
                    </h2>

                    {/* Legenda das 5 Etapas da Barra (Somente na Visão Jornada) */}
                    {viewMode === 'jornada' && (
                      <div className="hidden md:flex items-center gap-3 text-[11px] font-mono text-[#5C574F]">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#23211E' }} /> Saída
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#E07A1F' }} /> Ida
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#A39E96' }} /> Segurança
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#C0392E' }} /> Serviço
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#F5BE84' }} /> Volta
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Alternador de Visão: Jornada | Alojamentos */}
                  <div className="inline-flex rounded-md border border-[#DEDAD3] bg-[#F2F0EC] p-0.5 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setViewMode('jornada')}
                      className={`px-4 py-1.5 rounded transition-all ${viewMode === 'jornada' ? 'bg-white text-[#23211E] shadow-2xs font-bold' : 'text-[#6B6660] hover:text-[#23211E]'}`}
                    >
                      Jornada
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('alojamentos')}
                      className={`px-4 py-1.5 rounded transition-all ${viewMode === 'alojamentos' ? 'bg-white text-[#23211E] shadow-2xs font-bold' : 'text-[#6B6660] hover:text-[#23211E]'}`}
                    >
                      Alojamentos
                    </button>
                  </div>
                </div>

                {/* GRADE DA TABELA DE DIAS (Wrapper Único com Overflow Horizontal) */}
                <div className="overflow-x-auto">
                  {/* CABEÇALHO DA GRADE: VISÃO JORNADA */}
                  {viewMode === 'jornada' && (
                    <div style={{ minWidth: '1040px' }}>
                      {/* Linha 1 de Cabeçalho: Rótulos */}
                      <div
                        className="flex items-center py-2.5 px-2 text-[10.5px] uppercase tracking-wider font-bold text-[#5C574F] bg-[#F2F0EC] border-b border-[#E6E3DD]"
                        style={{ borderLeft: '4px solid transparent' }}
                      >
                        <div className="w-[30px]" />
                        <div className="w-[125px]">Dia</div>
                        <div className="w-[85px]">Pontos</div>
                        <div className="flex-1 min-w-[280px] px-3">Ocupação da jornada</div>
                        <div className="w-[70px] text-right pr-2">Total</div>
                        <div className="w-[110px] text-right pr-2">Planejado</div>
                        <div className="w-[70px] text-right pr-2">% Meta</div>
                        <div className="w-[90px] text-center">Situação</div>
                        <div className="w-[100px] text-center">Marcações</div>
                      </div>

                      {/* Linha 2 de Cabeçalho: Régua de Horas */}
                      <div
                        className="flex items-center py-1.5 px-2 text-[10px] font-mono text-[#A39E96] bg-[#FBFAF7] border-b border-[#E6E3DD]"
                        style={{ borderLeft: '4px solid transparent' }}
                      >
                        <div className="w-[240px] shrink-0" />
                        <div className="flex-1 min-w-[280px] px-3 relative h-3.5">
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
                        <div className="w-[440px] shrink-0" />
                      </div>

                      {/* LINHAS DOS DIAS */}
                      {diasProgramados.map(dia => {
                        const isExpanded = expandedDayIds.includes(dia.id);
                        const customAl = diasCustomAlojMap[dia.id];
                        const tComp = diasTemposCompMap[dia.id];
                        const sBase = tComp?.tempoSaidaBaseMin ?? tempoSaidaBasePadrao;
                        const sSeg = tComp?.tempoSegurancaMin ?? tempoSegurancaPadrao;
                        const ida = customAl?.tempoIdaMin ?? 40;
                        const volta = customAl?.tempoVoltaMin ?? 40;
                        const orig = customAl?.origem || alojamentoPadrao;
                        const dest = customAl?.destino || alojamentoPadrao;

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
                            alojamentosDisponiveis={alojamentos}
                            metaEquipeDia={metaEquipeInput}
                            etapaGeralDia={diasEtapasMap[dia.id] || ['IMPLANTAÇÃO']}
                            isPesDia={diasPesMap[dia.id] || false}
                            isReprogramarDia={diasReprogramarMap[dia.id] || false}
                            motivoReprogramarDia={diasMotivoReprogramarMap[dia.id] || ''}
                            filtroLvDoDia={diasFiltroLvMap[dia.id] || 'COMPLETO'}
                            tempoSaidaBaseMin={sBase}
                            tempoSegurancaMin={sSeg}
                            tempoIdaMin={ida}
                            tempoVoltaMin={volta}
                            isIdaManual={Boolean(customAl?.manualIda)}
                            isVoltaManual={Boolean(customAl?.manualVolta)}
                            origemAloj={orig}
                            destinoAloj={dest}
                            isTrocaAloj={orig !== dest}
                            filteredServicosBase={servicosBase}
                            handleUpdateDiaAlojamento={handleUpdateDiaAlojamento}
                            handleUpdateDiaTempo={handleUpdateDiaTempo}
                            handleUpdateDiaTempoComp={handleUpdateDiaTempoComp}
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
                            handleUpdateAtividade={handleUpdateAtividade}
                            handleRemoveAtividade={handleRemoveAtividade}
                            handleEnviarPlanPrincipalDia={handleEnviarPlanPrincipalDia}
                          />
                        );
                      })}

                      {/* TOTALIZADOR DO PERÍODO (VISÃO JORNADA) */}
                      <div
                        className="flex items-center py-3 px-2 text-sm font-mono font-bold bg-[#F2F0EC] border-t-2 border-[#DEDAD3]"
                        style={{ borderLeft: '4px solid transparent' }}
                      >
                        <div className="w-[30px]" />
                        <div className="w-[125px] text-[#23211E]">Total do período</div>
                        <div className="w-[85px] text-[#5C574F]">
                          {totalPontosPeriodo} {totalPontosPeriodo === 1 ? 'ponto' : 'pontos'}
                        </div>
                        <div className="flex-1 min-w-[280px] px-3 text-[#6B6660] text-xs">
                          {diasProgramados.length} {diasProgramados.length === 1 ? 'dia programado' : 'dias programados'}
                        </div>
                        <div className="w-[70px] text-right pr-2 text-[#23211E]">
                          {formatMinToHours(totalHorasPeriodoMin)}
                        </div>
                        <div className="w-[110px] text-right pr-2 text-[#17794C]">
                          R$ {totalValorPeriodo.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="w-[70px] text-right pr-2 text-[#17794C]">
                          {pctMetaTotal}%
                        </div>
                        <div className="w-[90px]" />
                        <div className="w-[100px]" />
                      </div>
                    </div>
                  )}

                  {/* CABEÇALHO DA GRADE: VISÃO ALOJAMENTOS */}
                  {viewMode === 'alojamentos' && (
                    <div style={{ minWidth: '1060px' }}>
                      <div
                        className="flex items-center py-2.5 px-3 text-[10.5px] uppercase tracking-wider font-bold text-[#5C574F] bg-[#F2F0EC] border-b border-[#E6E3DD]"
                        style={{ borderLeft: '4px solid transparent' }}
                      >
                        <div className="w-[130px]">Dia</div>
                        <div className="w-[220px] px-1">Saída (ida)</div>
                        <div className="w-[75px] px-1 text-center">Ida</div>
                        <div className="w-[220px] px-1">Retorno (volta)</div>
                        <div className="w-[75px] px-1 text-center">Volta</div>
                        <div className="w-[110px] px-1 text-center">Desloc.</div>
                        <div className="w-[85px] px-1 text-center">Saída base</div>
                        <div className="w-[85px] px-1 text-center">Segurança</div>
                        <div className="flex-1 text-right pr-2">Total comp.</div>
                      </div>

                      {/* LINHAS DOS DIAS NA VISÃO ALOJAMENTOS */}
                      {diasProgramados.map(dia => {
                        const customAl = diasCustomAlojMap[dia.id];
                        const tComp = diasTemposCompMap[dia.id];
                        const sBase = tComp?.tempoSaidaBaseMin ?? tempoSaidaBasePadrao;
                        const sSeg = tComp?.tempoSegurancaMin ?? tempoSegurancaPadrao;
                        const ida = customAl?.tempoIdaMin ?? 40;
                        const volta = customAl?.tempoVoltaMin ?? 40;
                        const orig = customAl?.origem || alojamentoPadrao;
                        const dest = customAl?.destino || alojamentoPadrao;

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
                            alojamentosDisponiveis={alojamentos}
                            metaEquipeDia={metaEquipeInput}
                            etapaGeralDia={diasEtapasMap[dia.id] || ['IMPLANTAÇÃO']}
                            isPesDia={diasPesMap[dia.id] || false}
                            isReprogramarDia={diasReprogramarMap[dia.id] || false}
                            motivoReprogramarDia={diasMotivoReprogramarMap[dia.id] || ''}
                            filtroLvDoDia={diasFiltroLvMap[dia.id] || 'COMPLETO'}
                            tempoSaidaBaseMin={sBase}
                            tempoSegurancaMin={sSeg}
                            tempoIdaMin={ida}
                            tempoVoltaMin={volta}
                            isIdaManual={Boolean(customAl?.manualIda)}
                            isVoltaManual={Boolean(customAl?.manualVolta)}
                            origemAloj={orig}
                            destinoAloj={dest}
                            isTrocaAloj={orig !== dest}
                            filteredServicosBase={servicosBase}
                            handleUpdateDiaAlojamento={handleUpdateDiaAlojamento}
                            handleUpdateDiaTempo={handleUpdateDiaTempo}
                            handleUpdateDiaTempoComp={handleUpdateDiaTempoComp}
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
                            handleUpdateAtividade={handleUpdateAtividade}
                            handleRemoveAtividade={handleRemoveAtividade}
                            handleEnviarPlanPrincipalDia={handleEnviarPlanPrincipalDia}
                          />
                        );
                      })}

                      {/* TOTALIZADOR DO PERÍODO (VISÃO ALOJAMENTOS) */}
                      <div
                        className="flex items-center py-3 px-3 text-sm font-mono font-bold bg-[#F2F0EC] border-t-2 border-[#DEDAD3]"
                        style={{ borderLeft: '4px solid transparent' }}
                      >
                        <div className="w-[130px] text-[#23211E]">Total acumulado</div>
                        <div className="w-[590px] px-1 text-[#6B6660] text-xs">
                          {diasProgramados.length} {diasProgramados.length === 1 ? 'dia' : 'dias'} analisados
                        </div>
                        <div className="w-[110px] px-1 text-center text-[#23211E]">
                          {formatMinToHours(totalDeslocamentoPeriodoMin)}
                        </div>
                        <div className="w-[170px] px-1" />
                        <div className="flex-1 text-right pr-2 text-[#23211E]">
                          {formatMinToHours(totalCompPeriodoMin)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* RODAPÉ DO CARD "DIAS PROGRAMADOS" */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 px-4 bg-[#FBFAF7] border-t border-[#E6E3DD]">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {viewMode === 'jornada' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={expandedDayIds.length === diasProgramados.length ? handleCollapseAll : handleExpandAll}
                        className="h-8 px-3 text-xs bg-white border-[#DEDAD3] text-[#23211E] font-semibold"
                      >
                        {expandedDayIds.length === diasProgramados.length ? 'Recolher todos' : 'Expandir todos'}
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

                  <Button
                    size="sm"
                    onClick={handleEnviarTodosOsDias}
                    className="h-9 px-5 text-xs font-bold bg-[#E07A1F] text-white hover:bg-[#E07A1F]/90 gap-2 shadow-2xs"
                  >
                    <Send className="w-4 h-4" /> Enviar todos os dias ({diasProgramados.length})
                  </Button>
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
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#A39E96]" />
              <input
                placeholder="Buscar projeto, equipe, data..."
                value={searchExistingPlan}
                onChange={e => setSearchExistingPlan(e.target.value)}
                className="w-full h-8 pl-8 pr-2 text-xs rounded border border-[#DEDAD3] bg-white font-mono"
              />
            </div>

            <Select value={filterEquipeExistingPlan} onValueChange={setFilterEquipeExistingPlan}>
              <SelectTrigger className="h-8 text-xs bg-white border-[#DEDAD3]">
                <SelectValue placeholder="Todas as equipes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODAS" className="text-xs">Todas as equipes</SelectItem>
                {equipesDisponiveis.map(eq => (
                  <SelectItem key={eq} value={eq} className="text-xs">{eq}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <label className="flex items-center gap-1.5 cursor-pointer text-xs text-[#5C574F] font-medium">
              <input
                type="checkbox"
                checked={filterOnlyCurrentObra}
                onChange={e => setFilterOnlyCurrentObra(e.target.checked)}
                className="rounded border-[#DEDAD3] text-[#E07A1F]"
              />
              <span>Somente obra atual</span>
            </label>
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
                        <td className="p-2.5 font-mono text-[#5C574F]">{plan.pontosStr || `${plan.pontos.length} pontos`}</td>
                        <td className="p-2.5 text-right font-mono font-semibold text-[#17794C]">
                          R$ {plan.valorPlanejadoTotal?.toFixed(2) || '0.00'}
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
