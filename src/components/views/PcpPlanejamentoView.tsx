import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
import { useSessionState } from '@/hooks/useSessionState';
import {
  usePcpPlanejamentoData,
  UNIDADES_DISPONIVEIS,
  ALL_STATUSES,
  DEFAULT_SELECTED_STATUSES,
  PcpObra,
  PcpPontoItem,
  ServicoBase,
  ParsedPlanejamentoExistente,
  MaterialPontoBudget
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
  // Filtros da Carteira
  const [selectedObraId, setSelectedObraId] = useState<string>('');
  const [searchObra, setSearchObra] = useSessionState<string>('pcp_shared_search', '');
  const [selectedStatuses, setSelectedStatuses] = useSessionState<string[]>('pcp_shared_statuses', DEFAULT_SELECTED_STATUSES);
  const [isStatusPopoverOpen, setIsStatusPopoverOpen] = useState<boolean>(false);
  const [selectedSituacao, setSelectedSituacao] = useSessionState<string>('pcp_shared_situacao', 'APTA');
  const [selectedMesFilter, setSelectedMesFilter] = useSessionState<string>('pcp_shared_mes', 'TODOS');
  const [selectedMunicipioFilter, setSelectedMunicipioFilter] = useSessionState<string>('pcp_shared_municipio', 'TODOS');
  const [selectedPrioridadeFilter, setSelectedPrioridadeFilter] = useSessionState<string>('pcp_shared_prioridade', 'TODAS');
  const [selectedDonoFilter, setSelectedDonoFilter] = useSessionState<string>('pcp_shared_dono', 'TODOS');
  const [selectedSupervisorFilter, setSelectedSupervisorFilter] = useSessionState<string>('pcp_shared_supervisor', 'TODOS');
  const [selectedUnidadeId, setSelectedUnidadeId] = useSessionState<string>('pcp_shared_unidade', '');

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
    orcamentoPontosQuery,
    orcamentoPorPontoMap,
    pontosDisponiveisDoProjeto,
    salvarProgramacao,
    servicosBase
  } = usePcpPlanejamentoData(selectedUnidadeId, selectedObraId);

  const selectedObra = useMemo(() => {
    if (!selectedObraId || selectedObraId.trim() === '') return null;
    return obras.find(o => o.projeto === selectedObraId) || null;
  }, [obras, selectedObraId]);

  // Período
  const [dataInicio, setDataInicio] = useSessionState<string>('pcp_shared_data_inicio', format(new Date(), 'yyyy-MM-dd'));
  const [dataFim, setDataFim] = useSessionState<string>('pcp_shared_data_fim', format(addDays(new Date(), 2), 'yyyy-MM-dd'));
  const [isDataRangeOpen, setIsDataRangeOpen] = useState<boolean>(false);

  // Parâmetros Gerais
  const [supervisor, setSupervisor] = useState<string>('BARTOLOMEU');
  const [selectedEquipes, setSelectedEquipes] = useSessionState<string[]>('pcp_shared_selected_equipes_v3', ['EH156']);
  const [tempoSaidaBasePadrao, setTempoSaidaBasePadrao] = useSessionState<number>('pcp_tempo_saida_base_padrao_v1', 15);
  const [tempoSegurancaPadrao, setTempoSegurancaPadrao] = useSessionState<number>('pcp_tempo_seguranca_padrao_v1', 15);
  const [metaEquipeInput, setMetaEquipeInput] = useState<number>(4442);

  // Visão Ativa: Jornada vs Alojamentos
  const [viewMode, setViewMode] = useSessionState<'jornada' | 'alojamentos'>('pcp_view_mode_v2', 'jornada');
  // Dias Expandidos
  const [expandedDayIds, setExpandedDayIds] = useSessionState<string[]>('pcp_expanded_day_ids_v2', []);

  // Mapas por Dia
  const [diasPontosMap, setDiasPontosMap] = useSessionState<Record<string, string[]>>('pcp_shared_dias_pontos_map', {});
  const [diasTemposCompMap, setDiasTemposCompMap] = useSessionState<Record<string, { tempoSaidaBaseMin?: number, tempoSegurancaMin?: number }>>('pcp_dias_tempos_comp_map_v1', {});
  const [diasPesMap, setDiasPesMap] = useSessionState<Record<string, boolean>>('pcp_dias_pes_map_v2', {});
  const [diasReprogramarMap, setDiasReprogramarMap] = useSessionState<Record<string, boolean>>('pcp_dias_reprogramar_map_v1', {});
  const [diasMotivoReprogramarMap, setDiasMotivoReprogramarMap] = useSessionState<Record<string, string>>('pcp_dias_motivo_reprog_map_v1', {});
  const [diasCustomAlojMap, setDiasCustomAlojMap] = useSessionState<Record<string, { origem?: string, destino?: string, tempoIdaMin?: number, tempoVoltaMin?: number, manualIda?: boolean, manualVolta?: boolean }>>('pcp_dias_custom_aloj_v3', {});
  const [diasPontosGroupedMap, setDiasPontosGroupedMap] = useSessionState<Record<string, Record<string, PcpPontoItem[]>>>('pcp_dias_pontos_grouped_v3', {});
  const [diasEtapasMap, setDiasEtapasMap] = useSessionState<Record<string, string[]>>('pcp_dias_etapas_map_v1', {});
  const [diasFiltroLvMap, setDiasFiltroLvMap] = useSessionState<Record<string, 'COMPLETO' | 'SOMENTE_LV' | 'SEM_LV'>>('pcp_dias_filtro_lv_map_v1', {});
  const [diasExtrasList, setDiasExtrasList] = useSessionState<string[]>('pcp_dias_extras_v1', []);

  // Modal Carregar Planejamento
  const [isCarregarPlanModalOpen, setIsCarregarPlanModalOpen] = useState(false);
  const [selectedExistingPlanKeys, setSelectedExistingPlanKeys] = useState<string[]>([]);
  const [filterEquipeExistingPlan, setFilterEquipeExistingPlan] = useState<string>('TODAS');
  const [filterOnlyCurrentPeriod, setFilterOnlyCurrentPeriod] = useState<boolean>(false);
  const [filterOnlyCurrentObra, setFilterOnlyCurrentObra] = useState<boolean>(false);
  const [searchExistingPlan, setSearchExistingPlan] = useState<string>('');

  // Zoom
  const [zoomLevel, setZoomLevel] = useSessionState<number>('pcp_zoom_level', 1.0);
  const handleZoomIn = () => setZoomLevel(prev => Math.min(1.4, Math.round((prev + 0.1) * 10) / 10));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(0.7, Math.round((prev - 0.1) * 10) / 10));
  const handleResetZoom = () => setZoomLevel(1.0);

  // Análise de Risco da Vistoria
  const vistoriaRisk = useVistoriaRisk(selectedObra?.projeto);

  // Alojamento Padrão Nome
  const alojamentoPadrao = useMemo(() => {
    if (!selectedAlojamentoId || selectedAlojamentoId === 'nenhum') return 'Base Bom Jesus da Lapa';
    const found = alojamentos.find(a => a.id === selectedAlojamentoId);
    return found ? found.nome : 'Base Bom Jesus da Lapa';
  }, [alojamentos, selectedAlojamentoId]);

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
    return obras.filter(obra => {
      if (searchObra.trim()) {
        const q = searchObra.toLowerCase();
        const matchesProj = obra.projeto.toLowerCase().includes(q);
        const matchesDesc = obra.descricao.toLowerCase().includes(q);
        const matchesMun = obra.municipio.toLowerCase().includes(q);
        const matchesDono = (obra.donoObra || '').toLowerCase().includes(q);
        if (!matchesProj && !matchesDesc && !matchesMun && !matchesDono) return false;
      }
      if (selectedSituacao !== 'TODAS') {
        const sit = obra.situacao ? obra.situacao.toUpperCase() : 'APTA';
        if (sit !== selectedSituacao.toUpperCase()) return false;
      }
      if (selectedStatuses.length > 0 && selectedStatuses.length < ALL_STATUSES.length) {
        const statusUpper = (obra.status || 'SEM PROGR.').toUpperCase();
        if (!selectedStatuses.includes(statusUpper)) return false;
      }
      if (selectedMesFilter !== 'TODOS') {
        if ((obra.mesCarteira || '').toUpperCase() !== selectedMesFilter.toUpperCase()) return false;
      }
      if (selectedMunicipioFilter !== 'TODOS') {
        if ((obra.municipio || '').toUpperCase() !== selectedMunicipioFilter.toUpperCase()) return false;
      }
      if (selectedPrioridadeFilter !== 'TODAS') {
        if ((obra.prioridade || '').toUpperCase() !== selectedPrioridadeFilter.toUpperCase()) return false;
      }
      if (selectedDonoFilter !== 'TODOS') {
        if ((obra.donoObra || '').toUpperCase() !== selectedDonoFilter.toUpperCase()) return false;
      }
      if (selectedSupervisorFilter !== 'TODOS') {
        if ((obra.supervisor || '').toUpperCase() !== selectedSupervisorFilter.toUpperCase()) return false;
      }
      return true;
    });
  }, [
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
        etapaPrevista: bItem.etapaPrevista || inferEtapaFromServico(bItem.servicoPrevisto || ''),
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
    // Transfere mapeamento de pontos se mudou o ID
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

  // Envio de Programação
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
      toast.loading(`Enviando programação de ${diaTarget.dataStr}...`, { id: 'save-day' });
      await salvarProgramacao({
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
      });
      toast.success(`Programação de ${diaTarget.dataStr} enviada com sucesso!`, { id: 'save-day' });
    } catch (err: any) {
      toast.error(`Erro ao enviar dia: ${err.message || 'Erro inesperado'}`, { id: 'save-day' });
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
      toast.loading(`Enviando ${diasComAtividades.length} dia(s) programado(s)...`, { id: 'save-all' });
      for (const d of diasComAtividades) {
        const pts = diasPontosMap[d.id] || [];
        const allActs: PcpPontoItem[] = [];
        pts.forEach(p => {
          allActs.push(...getItemsDoPontoNoDia(d.id, p).filter(i => i.selected));
        });
        await salvarProgramacao({
          unidadeId: selectedUnidadeId,
          dataProgramacao: d.dataCompleta,
          dateObj: d.dateObj,
          supervisor,
          equipe: selectedEquipes[0] || 'EH156',
          etapa: (diasEtapasMap[d.id] || ['IMPLANTAÇÃO'])[0] || 'IMPLANTAÇÃO',
          obra: selectedObra,
          pontos: allActs,
          isPes: diasPesMap[d.id] || false,
          reprogramar: diasReprogramarMap[d.id] || false,
          motivoReprogramacao: diasMotivoReprogramarMap[d.id] || '',
        });
      }
      toast.success('Todos os dias programados foram enviados com sucesso!', { id: 'save-all' });
    } catch (err: any) {
      toast.error(`Erro ao enviar dias: ${err.message || 'Erro inesperado'}`, { id: 'save-all' });
    }
  };

  // Limpeza de Tela
  const handleLimparTudoEmTela = () => {
    if (!window.confirm('Deseja realmente limpar todos os pontos, atividades e planejamentos montados na tela?')) {
      return;
    }
    setDiasPontosMap({});
    setDiasPontosGroupedMap({});
    setDiasReprogramarMap({});
    setDiasMotivoReprogramarMap({});
    setDiasPesMap({});
    setDiasEtapasMap({});
    setDiasCustomAlojMap({});
    toast.success('Planejamento e pontos em tela limpos com sucesso.');
  };

  // Sincronizar Google Sheets
  const handleSyncFromGoogleSheets = async () => {
    try {
      toast.loading('Sincronizando planilha do Google Sheets...', { id: 'sync-sheets' });
      await rawCacheQuery.refetch();
      await orcamentoPontosQuery.refetch();
      toast.success('Dados sincronizados com o Google Sheets.', { id: 'sync-sheets' });
    } catch (e: any) {
      toast.error('Erro ao sincronizar: ' + e.message, { id: 'sync-sheets' });
    }
  };

  // Carregar Planejamentos Selecionados no Fluxo Inverso
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
      className="flex flex-col gap-3 p-3 sm:p-4 w-full max-w-[1780px] mx-auto min-h-screen bg-[#F7F6F3] text-[#23211E] font-sans antialiased"
      style={{ zoom: zoomLevel } as React.CSSProperties}
    >
      {/* 3.1 HEADER FIXO */}
      <header className="sticky top-0 z-30 bg-[#F7F6F3]/95 backdrop-blur border border-[#E6E3DD] rounded-xl p-3 shadow-xs space-y-2.5">
        {/* Linha 1: Título e Ações */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-3">
            <div className="w-[3px] h-7 bg-gradient-to-b from-[#E07A1F] to-[#E07A1F]/30 rounded-full shrink-0" />
            <div>
              <span className="text-[9.5px] uppercase tracking-[0.11em] font-mono text-[#A39E96] block leading-none">
                MÓDULO PCP · PLANEJAMENTO
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                <h1 className="text-[16px] font-bold text-[#23211E] leading-tight">
                  {selectedObra ? `${selectedObra.projeto} · ${selectedObra.municipio}` : 'Selecione uma obra'}
                </h1>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-[#F2F0EC] text-[#5C574F] border border-[#DEDAD3]">
                  Ambiente local
                </span>
              </div>
            </div>
          </div>

          {/* Botões de Ação do Header (27px de altura) */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCarregarPlanModalOpen(true)}
              className="h-[27px] px-2.5 text-[11px] font-medium bg-white border-[#DEDAD3] text-[#23211E] hover:bg-[#FBF5EC] hover:border-[#E8C9A0]"
            >
              <FileSpreadsheet className="w-3 h-3 mr-1 text-[#E07A1F]" /> Carregar planejamento
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncFromGoogleSheets}
              className="h-[27px] px-2.5 text-[11px] font-medium bg-white border-[#DEDAD3] text-[#23211E] hover:bg-[#FBF5EC]"
            >
              <RefreshCw className="w-3 h-3 mr-1 text-[#5C574F]" /> Sincronizar Sheets
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleLimparTudoEmTela}
              className="h-[27px] px-2.5 text-[11px] font-medium bg-white border-[#DEDAD3] text-[#A39E96] hover:text-[#C0392E] hover:bg-[#F9E4E1]/50"
            >
              <Eraser className="w-3 h-3 mr-1" /> Limpar tela
            </Button>

            {/* Controle de Zoom */}
            <div className="inline-flex items-center rounded-md border border-[#DEDAD3] bg-white h-[27px] px-1 text-[11px] font-mono">
              <button
                type="button"
                onClick={handleZoomOut}
                className="px-1.5 text-[#6B6660] hover:text-[#23211E] font-bold"
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
                className="px-1.5 text-[#6B6660] hover:text-[#23211E] font-bold"
                title="Aumentar zoom"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Linha 2: Pílulas de Etapas do Fluxo (22px de altura) */}
        <div className="flex items-center gap-2 overflow-x-auto text-[10.5px] font-medium pt-1 border-t border-[#E6E3DD]/70">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white border border-[#E6E3DD] whitespace-nowrap shadow-2xs">
            <span className={`w-1.5 h-1.5 rounded-full ${selectedObra ? 'bg-[#17794C]' : 'bg-[#C9A227]'}`} />
            <span className="text-[#5C574F]">Obra:</span>
            <strong className="text-[#23211E] font-mono">{selectedObra ? `${selectedObra.projeto} selecionada` : 'nenhuma'}</strong>
          </div>

          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white border border-[#E6E3DD] whitespace-nowrap shadow-2xs">
            <span className="w-1.5 h-1.5 rounded-full bg-[#17794C]" />
            <span className="text-[#5C574F]">Equipe e período:</span>
            <strong className="text-[#23211E]">
              {selectedEquipes.join(', ')} · {diasProgramados.length} {diasProgramados.length === 1 ? 'dia' : 'dias'} · {alojamentoPadrao}
            </strong>
          </div>

          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white border border-[#E6E3DD] whitespace-nowrap shadow-2xs">
            <span className={`w-1.5 h-1.5 rounded-full ${diasSemPontosCount === 0 ? 'bg-[#17794C]' : 'bg-[#C9A227]'}`} />
            <span className="text-[#5C574F]">Distribuição:</span>
            <strong className="text-[#23211E]">
              {diasSemPontosCount === 0
                ? 'todos os dias com pontos'
                : diasSemPontosCount === 1
                  ? '1 dia ainda sem pontos'
                  : `${diasSemPontosCount} dias ainda sem pontos`}
            </strong>
          </div>

          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white border border-[#E6E3DD] whitespace-nowrap shadow-2xs">
            <span className={`w-1.5 h-1.5 rounded-full ${diasAcima10hCount > 0 ? 'bg-[#C0392E]' : 'bg-[#17794C]'}`} />
            <span className="text-[#5C574F]">Envio:</span>
            <strong className={diasAcima10hCount > 0 ? 'text-[#B03028]' : 'text-[#17794C]'}>
              {diasAcima10hCount > 0
                ? `${diasAcima10hCount} ${diasAcima10hCount === 1 ? 'dia acima de 10h' : 'dias acima de 10h'}`
                : 'pronto para enviar'}
            </strong>
          </div>
        </div>
      </header>

      {/* 3.2 BARRA DE FILTROS (Chips de 28px) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        {/* Unidade */}
        <Select value={selectedUnidadeId} onValueChange={setSelectedUnidadeId}>
          <SelectTrigger className={`h-7 text-xs border ${selectedUnidadeId ? 'bg-[#FBF5EC] border-[#E8C9A0] text-[#A06A16] font-semibold' : 'bg-white border-[#DEDAD3] text-[#5C574F]'}`}>
            <span className="text-[10px] uppercase text-[#A39E96] mr-1">Unidade</span>
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            {UNIDADES_DISPONIVEIS.map(u => (
              <SelectItem key={u.id} value={u.id} className="text-xs">
                {u.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Situação */}
        <Select value={selectedSituacao} onValueChange={setSelectedSituacao}>
          <SelectTrigger className={`h-7 text-xs border ${selectedSituacao !== 'TODAS' ? 'bg-[#FBF5EC] border-[#E8C9A0] text-[#A06A16] font-semibold' : 'bg-white border-[#DEDAD3] text-[#5C574F]'}`}>
            <span className="text-[10px] uppercase text-[#A39E96] mr-1">Situação</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="APTA" className="text-xs">Apta</SelectItem>
            <SelectItem value="INAPTA" className="text-xs">Inapta</SelectItem>
            <SelectItem value="TODAS" className="text-xs">Todas</SelectItem>
          </SelectContent>
        </Select>

        {/* Status (Popover Multiselect) */}
        <Popover open={isStatusPopoverOpen} onOpenChange={setIsStatusPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={`h-7 text-xs border ${selectedStatuses.length < ALL_STATUSES.length ? 'bg-[#FBF5EC] border-[#E8C9A0] text-[#A06A16] font-semibold' : 'bg-white border-[#DEDAD3] text-[#5C574F]'}`}
            >
              <span className="text-[10px] uppercase text-[#A39E96] mr-1">Status</span>
              <span>({selectedStatuses.length})</span>
              <ChevronDown className="w-3 h-3 ml-1 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[200px] p-2 bg-white" align="start">
            <div className="space-y-1 text-xs">
              <div className="flex items-center justify-between pb-1 border-b border-[#E6E3DD] text-[10px] font-semibold text-[#5C574F]">
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
                  <label key={st} className="flex items-center gap-2 p-1 rounded hover:bg-[#FBF5EC] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {
                        setSelectedStatuses(prev =>
                          prev.includes(st) ? prev.filter(x => x !== st) : [...prev, st]
                        );
                      }}
                      className="rounded border-[#DEDAD3] text-[#E07A1F] focus:ring-[#E07A1F] h-3.5 w-3.5"
                    />
                    <span>{st}</span>
                  </label>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>

        {/* Mês */}
        <Select value={selectedMesFilter} onValueChange={setSelectedMesFilter}>
          <SelectTrigger className={`h-7 text-xs border ${selectedMesFilter !== 'TODOS' ? 'bg-[#FBF5EC] border-[#E8C9A0] text-[#A06A16] font-semibold' : 'bg-white border-[#DEDAD3] text-[#5C574F]'}`}>
            <span className="text-[10px] uppercase text-[#A39E96] mr-1">Mês</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS" className="text-xs">Todos os meses</SelectItem>
            {mesesCarteira.map(m => (
              <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Município */}
        <Select value={selectedMunicipioFilter} onValueChange={setSelectedMunicipioFilter}>
          <SelectTrigger className={`h-7 text-xs border ${selectedMunicipioFilter !== 'TODOS' ? 'bg-[#FBF5EC] border-[#E8C9A0] text-[#A06A16] font-semibold' : 'bg-white border-[#DEDAD3] text-[#5C574F]'}`}>
            <span className="text-[10px] uppercase text-[#A39E96] mr-1">Município</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS" className="text-xs">Todos os municípios</SelectItem>
            {municipiosCarteira.map(mun => (
              <SelectItem key={mun} value={mun} className="text-xs">{mun}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Prioridade */}
        <Select value={selectedPrioridadeFilter} onValueChange={setSelectedPrioridadeFilter}>
          <SelectTrigger className={`h-7 text-xs border ${selectedPrioridadeFilter !== 'TODAS' ? 'bg-[#FBF5EC] border-[#E8C9A0] text-[#A06A16] font-semibold' : 'bg-white border-[#DEDAD3] text-[#5C574F]'}`}>
            <span className="text-[10px] uppercase text-[#A39E96] mr-1">Prioridade</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODAS" className="text-xs">Todas</SelectItem>
            {prioridadesCarteira.map(p => (
              <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Dono */}
        <Select value={selectedDonoFilter} onValueChange={setSelectedDonoFilter}>
          <SelectTrigger className={`h-7 text-xs border ${selectedDonoFilter !== 'TODOS' ? 'bg-[#FBF5EC] border-[#E8C9A0] text-[#A06A16] font-semibold' : 'bg-white border-[#DEDAD3] text-[#5C574F]'}`}>
            <span className="text-[10px] uppercase text-[#A39E96] mr-1">Dono</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS" className="text-xs">Todos os donos</SelectItem>
            {donosCarteira.map(d => (
              <SelectItem key={d} value={d} className="text-xs">{d}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Supervisor */}
        <Select value={selectedSupervisorFilter} onValueChange={setSelectedSupervisorFilter}>
          <SelectTrigger className={`h-7 text-xs border ${selectedSupervisorFilter !== 'TODOS' ? 'bg-[#FBF5EC] border-[#E8C9A0] text-[#A06A16] font-semibold' : 'bg-white border-[#DEDAD3] text-[#5C574F]'}`}>
            <span className="text-[10px] uppercase text-[#A39E96] mr-1">Supervisor</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS" className="text-xs">Todos os supervisores</SelectItem>
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
          className="h-7 px-2 text-xs text-[#A39E96] hover:text-[#23211E] whitespace-nowrap"
        >
          Limpar filtros
        </Button>
      </div>

      {/* 3.3 GRID PRINCIPAL: 2 COLUNAS (280px | 1fr) */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-3.5 items-start">
        {/* COLUNA ESQUERDA (FIXA / STICKY) */}
        <aside className="space-y-3 lg:sticky lg:top-[120px]">
          {/* Card 1: Carteira de Obras */}
          <div className="bg-white rounded-xl border border-[#E6E3DD] p-3 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#23211E] flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-[#E07A1F]" /> Carteira de obras
              </span>
              <span className="text-[10.5px] font-mono text-[#5C574F]">({filteredObras.length})</span>
            </div>

            {/* Busca de Obra */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-[#A39E96]" />
              <input
                placeholder="Buscar código, município..."
                value={searchObra}
                onChange={e => setSearchObra(e.target.value)}
                className="w-full h-7 pl-8 pr-2 text-xs rounded-md border border-[#DEDAD3] bg-[#F7F6F3] focus:outline-none focus:ring-1 focus:ring-[#E07A1F] font-mono"
              />
            </div>

            {/* Lista Rolável de Obras (392px) */}
            <div className="h-[392px] overflow-y-auto space-y-1.5 pr-0.5 custom-scrollbar">
              {filteredObras.length === 0 ? (
                <div className="text-center py-8 text-xs text-[#A39E96]">
                  Nenhuma obra encontrada.
                </div>
              ) : (
                filteredObras.map(obra => {
                  const isSelected = obra.projeto === selectedObraId;
                  const isApta = (obra.situacao || 'APTA').toUpperCase() === 'APTA';

                  return (
                    <div
                      key={obra.projeto}
                      onClick={() => handleSelectObra(obra.projeto)}
                      className={`p-2 rounded-lg border text-xs cursor-pointer transition-all ${isSelected ? 'bg-[#FBF5EC] border-[#E8C9A0] shadow-2xs' : 'bg-white border-[#E6E3DD] hover:border-[#DEDAD3]'}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-[#23211E]">{obra.projeto}</span>
                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${isApta ? 'bg-[#E6F2EA] text-[#17794C]' : 'bg-[#F9E4E1] text-[#B03028]'}`}>
                          {obra.situacao || 'APTA'}
                        </span>
                      </div>

                      <p className="text-[11px] text-[#5C574F] truncate mt-0.5">{obra.descricao}</p>

                      <div className="flex items-center justify-between text-[10px] text-[#A39E96] mt-1 pt-1 border-t border-[#E6E3DD]/60">
                        <span className="truncate">{obra.municipio}</span>
                        <div className="flex items-center gap-2 font-mono shrink-0">
                          <span className="text-[#5B7C99] font-medium">{obra.qtdPostesDisponiveis || 0} post.</span>
                          <span className="text-[#7E6BA8] font-medium">{obra.qtdCabosDisponiveis || 0} m</span>
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
            <div className="bg-white rounded-xl border border-[#E6E3DD] p-3 shadow-2xs space-y-3">
              <span className="text-xs font-bold text-[#23211E] block">Saldo da obra e riscos</span>

              {/* Postes e Cabos */}
              <div className="space-y-2 text-xs">
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-[#5C574F]">Postes (carteira: {selectedObra.qtdPostesDisponiveis || 0})</span>
                    <span className="font-mono font-bold text-[#5B7C99]">
                      Saldo: {Math.max(0, (selectedObra.qtdPostesDisponiveis || 0) - totalPontosPeriodo)}
                    </span>
                  </div>
                  <div className="w-full bg-[#F2F0EC] h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-[#5B7C99] h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, selectedObra.qtdPostesDisponiveis ? (totalPontosPeriodo / selectedObra.qtdPostesDisponiveis) * 100 : 0)}%`
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-[#5C574F]">Cabos (carteira: {selectedObra.qtdCabosDisponiveis || 0} m)</span>
                    <span className="font-mono font-bold text-[#7E6BA8]">
                      Saldo: {selectedObra.qtdCabosDisponiveis || 0} m
                    </span>
                  </div>
                  <div className="w-full bg-[#F2F0EC] h-2 rounded-full overflow-hidden">
                    <div className="bg-[#7E6BA8] h-full rounded-full" style={{ width: '0%' }} />
                  </div>
                </div>
              </div>

              {/* Resumo da Análise de Risco da Vistoria */}
              <div className="pt-2 border-t border-[#E6E3DD] space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-[#5C574F]">Vistoria</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#FBF2DA] text-[#A06A16]">
                    {vistoriaRisk.nivelRisco || 'Risco Laranja'}
                  </span>
                </div>
                <div className="space-y-1 text-[#6B6660]">
                  <div className="flex items-start gap-1">
                    <span className="text-[#E07A1F]">●</span>
                    <span className="truncate">{vistoriaRisk.itensRelevantes[0]?.texto || 'Obra de médio/grande porte'}</span>
                  </div>
                  <div className="flex items-start gap-1">
                    <span className="text-[#17794C]">●</span>
                    <span className="truncate">{vistoriaRisk.itensRelevantes[1]?.texto || 'Solo arenoso com apoio'}</span>
                  </div>
                  <div className="flex items-start gap-1">
                    <span className="text-[#C0392E]">●</span>
                    <span className="truncate">{vistoriaRisk.itensRelevantes[2]?.texto || 'Necessidade de podas em ramal'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </aside>

        {/* COLUNA DIREITA (CONTEÚDO PRINCIPAL) */}
        <main className="space-y-3">
          {/* 1. Faixa da Obra Selecionada */}
          {selectedObra && (
            <div className="bg-white rounded-xl border border-[#E6E3DD] p-3 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm text-[#E07A1F]">{selectedObra.projeto}</span>
                  <span className="text-xs font-semibold text-[#23211E]">— {selectedObra.descricao}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-[#6B6660] mt-0.5">
                  <span>Município: <strong className="text-[#23211E]">{selectedObra.municipio}</strong></span>
                  <span>Dono: <strong className="text-[#23211E]">{selectedObra.donoObra || 'Não informado'}</strong></span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono font-semibold bg-[#F7F6F3] px-3 py-1.5 rounded-lg border border-[#E6E3DD] shrink-0">
                <span className="text-[#6B6660]">Meta diária da equipe:</span>
                <span className="text-[#17794C] text-sm">
                  R$ {metaEquipeInput.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          )}

          {/* 2. Parâmetros (Chips de 26px numa linha) */}
          <div className="bg-white rounded-xl border border-[#E6E3DD] p-2.5 shadow-2xs flex flex-wrap items-center gap-2 text-xs">
            {/* Equipe */}
            <Select value={selectedEquipes[0] || 'EH156'} onValueChange={val => setSelectedEquipes([val])}>
              <SelectTrigger className="h-[26px] text-xs bg-[#F7F6F3] border-[#DEDAD3] text-[#23211E]">
                <span className="text-[10px] uppercase text-[#A39E96] mr-1">Equipe</span>
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
              <SelectTrigger className="h-[26px] text-xs bg-[#F7F6F3] border-[#DEDAD3] text-[#23211E]">
                <span className="text-[10px] uppercase text-[#A39E96] mr-1">Alojamento</span>
                <SelectValue placeholder="Base Bom Jesus da Lapa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhum" className="text-xs">Base Bom Jesus da Lapa</SelectItem>
                {alojamentos.map(a => (
                  <SelectItem key={a.id} value={a.id} className="text-xs">{a.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Período com Popover */}
            <Popover open={isDataRangeOpen} onOpenChange={setIsDataRangeOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-[26px] px-2.5 text-xs bg-[#F7F6F3] border-[#DEDAD3] text-[#23211E] gap-1">
                  <CalendarIcon className="w-3 h-3 text-[#5C574F]" />
                  <span className="text-[10px] uppercase text-[#A39E96]">Período:</span>
                  <span className="font-mono">{format(safeParseDate(dataInicio), 'dd/MM')} a {format(safeParseDate(dataFim), 'dd/MM')}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-3 bg-white" align="start">
                <div className="space-y-2 text-xs">
                  <span className="font-semibold text-[#23211E] block">Definir período do planejamento</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-[#A39E96] block">Data início</span>
                      <input
                        type="date"
                        value={dataInicio}
                        onChange={e => setDataInicio(e.target.value)}
                        className="w-full h-7 text-xs border border-[#DEDAD3] rounded px-1.5 font-mono"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-[#A39E96] block">Data fim</span>
                      <input
                        type="date"
                        value={dataFim}
                        onChange={e => setDataFim(e.target.value)}
                        className="w-full h-7 text-xs border border-[#DEDAD3] rounded px-1.5 font-mono"
                      />
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {/* Saída Base Padrão */}
            <div className="inline-flex items-center gap-1 bg-[#F7F6F3] border border-[#DEDAD3] rounded px-2 h-[26px]">
              <span className="text-[10px] uppercase text-[#A39E96]">Saída base:</span>
              <input
                type="number"
                min="0"
                step="5"
                value={tempoSaidaBasePadrao}
                onChange={e => setTempoSaidaBasePadrao(parseInt(e.target.value, 10) || 0)}
                className="w-8 text-center text-xs font-mono font-bold bg-transparent focus:outline-none"
              />
              <span className="text-[#A39E96] text-[10px]">min</span>
            </div>

            {/* Segurança Padrão */}
            <div className="inline-flex items-center gap-1 bg-[#F7F6F3] border border-[#DEDAD3] rounded px-2 h-[26px]">
              <span className="text-[10px] uppercase text-[#A39E96]">Segurança:</span>
              <input
                type="number"
                min="0"
                step="5"
                value={tempoSegurancaPadrao}
                onChange={e => setTempoSegurancaPadrao(parseInt(e.target.value, 10) || 0)}
                className="w-8 text-center text-xs font-mono font-bold bg-transparent focus:outline-none"
              />
              <span className="text-[#A39E96] text-[10px]">min</span>
            </div>
          </div>

          {/* 3. CARD CENTRAL "DIAS PROGRAMADOS" */}
          <div className="bg-white rounded-xl border border-[#E6E3DD] shadow-2xs overflow-hidden">
            {/* Cabeçalho do Card (Máximo 45px) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 px-3 bg-[#FBFAF7] border-b border-[#E6E3DD] min-h-[45px]">
              <div className="flex items-center gap-3">
                <h2 className="text-xs font-bold text-[#23211E]">
                  Dias programados ({diasProgramados.length})
                </h2>

                {/* Legenda das 5 Etapas da Barra (Somente na Visão Jornada) */}
                {viewMode === 'jornada' && (
                  <div className="hidden md:flex items-center gap-2.5 text-[10px] font-mono text-[#5C574F]">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#23211E' }} /> Saída
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#E07A1F' }} /> Ida
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#A39E96' }} /> Segurança
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#C0392E' }} /> Serviço
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#F5BE84' }} /> Volta
                    </span>
                  </div>
                )}
              </div>

              {/* Alternador de Visão: Jornada | Alojamentos */}
              <div className="inline-flex rounded-md border border-[#DEDAD3] bg-[#F2F0EC] p-0.5 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setViewMode('jornada')}
                  className={`px-3 py-1 rounded transition-all ${viewMode === 'jornada' ? 'bg-white text-[#23211E] shadow-2xs font-bold' : 'text-[#6B6660] hover:text-[#23211E]'}`}
                >
                  Jornada
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('alojamentos')}
                  className={`px-3 py-1 rounded transition-all ${viewMode === 'alojamentos' ? 'bg-white text-[#23211E] shadow-2xs font-bold' : 'text-[#6B6660] hover:text-[#23211E]'}`}
                >
                  Alojamentos
                </button>
              </div>
            </div>

            {/* GRADE DA TABELA DE DIAS (Wrapper Único com Overflow Horizontal) */}
            <div className="overflow-x-auto">
              {/* CABEÇALHO DA GRADE: VISÃO JORNADA */}
              {viewMode === 'jornada' && (
                <div style={{ minWidth: '984px' }}>
                  {/* Linha 1 de Cabeçalho: Rótulos */}
                  <div
                    className="flex items-center py-2 px-1 text-[9.5px] uppercase tracking-wider font-semibold text-[#5C574F] bg-[#F2F0EC] border-b border-[#E6E3DD]"
                    style={{ borderLeft: '3px solid transparent' }}
                  >
                    <div className="w-[26px]" />
                    <div className="w-[108px]">Dia</div>
                    <div className="w-[76px]">Pontos</div>
                    <div className="flex-1 min-w-[268px] px-2">Ocupação da jornada</div>
                    <div className="w-[62px] text-right pr-2">Total</div>
                    <div className="w-[96px] text-right pr-2">Planejado</div>
                    <div className="w-[62px] text-right pr-2">% Meta</div>
                    <div className="w-[78px] text-center">Situação</div>
                    <div className="w-[96px] text-center">Marcações</div>
                  </div>

                  {/* Linha 2 de Cabeçalho: Régua de Horas */}
                  <div
                    className="flex items-center py-1 px-1 text-[9px] font-mono text-[#A39E96] bg-[#FBFAF7] border-b border-[#E6E3DD]"
                    style={{ borderLeft: '3px solid transparent' }}
                  >
                    <div className="w-[210px] shrink-0" />
                    <div className="flex-1 min-w-[268px] px-2 relative h-3">
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
                    <div className="w-[394px] shrink-0" />
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
                    className="flex items-center py-2 px-1 text-xs font-mono font-bold bg-[#F2F0EC] border-t-2 border-[#DEDAD3]"
                    style={{ borderLeft: '3px solid transparent' }}
                  >
                    <div className="w-[26px]" />
                    <div className="w-[108px] text-[#23211E]">Total do período</div>
                    <div className="w-[76px] text-[#5C574F]">
                      {totalPontosPeriodo} {totalPontosPeriodo === 1 ? 'ponto' : 'pontos'}
                    </div>
                    <div className="flex-1 min-w-[268px] px-2 text-[#6B6660] text-[11px]">
                      {diasProgramados.length} {diasProgramados.length === 1 ? 'dia programado' : 'dias programados'}
                    </div>
                    <div className="w-[62px] text-right pr-2 text-[#23211E]">
                      {formatMinToHours(totalHorasPeriodoMin)}
                    </div>
                    <div className="w-[96px] text-right pr-2 text-[#17794C]">
                      R$ {totalValorPeriodo.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="w-[62px] text-right pr-2 text-[#17794C]">
                      {pctMetaTotal}%
                    </div>
                    <div className="w-[78px]" />
                    <div className="w-[96px]" />
                  </div>
                </div>
              )}

              {/* CABEÇALHO DA GRADE: VISÃO ALOJAMENTOS */}
              {viewMode === 'alojamentos' && (
                <div style={{ minWidth: '1000px' }}>
                  <div
                    className="flex items-center py-2 px-2 text-[9.5px] uppercase tracking-wider font-semibold text-[#5C574F] bg-[#F2F0EC] border-b border-[#E6E3DD]"
                    style={{ borderLeft: '3px solid transparent' }}
                  >
                    <div className="w-[120px]">Dia</div>
                    <div className="w-[200px] px-1">Saída (ida)</div>
                    <div className="w-[70px] px-1 text-center">Ida</div>
                    <div className="w-[200px] px-1">Retorno (volta)</div>
                    <div className="w-[70px] px-1 text-center">Volta</div>
                    <div className="w-[100px] px-1 text-center">Desloc.</div>
                    <div className="w-[80px] px-1 text-center">Saída base</div>
                    <div className="w-[80px] px-1 text-center">Segurança</div>
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
                    className="flex items-center py-2 px-2 text-xs font-mono font-bold bg-[#F2F0EC] border-t-2 border-[#DEDAD3]"
                    style={{ borderLeft: '3px solid transparent' }}
                  >
                    <div className="w-[120px] text-[#23211E]">Total acumulado</div>
                    <div className="w-[540px] px-1 text-[#6B6660]">
                      {diasProgramados.length} {diasProgramados.length === 1 ? 'dia' : 'dias'} analisados
                    </div>
                    <div className="w-[100px] px-1 text-center text-[#23211E]">
                      {formatMinToHours(totalDeslocamentoPeriodoMin)}
                    </div>
                    <div className="w-[160px] px-1" />
                    <div className="flex-1 text-right pr-2 text-[#23211E]">
                      {formatMinToHours(totalCompPeriodoMin)}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* RODAPÉ DO CARD "DIAS PROGRAMADOS" */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-[#FBFAF7] border-t border-[#E6E3DD]">
              <div className="flex items-center gap-2 flex-wrap">
                {viewMode === 'jornada' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={expandedDayIds.length === diasProgramados.length ? handleCollapseAll : handleExpandAll}
                    className="h-7 px-2.5 text-xs bg-white border-[#DEDAD3] text-[#23211E]"
                  >
                    {expandedDayIds.length === diasProgramados.length ? 'Recolher todos' : 'Expandir todos'}
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddDiaExtra}
                  className="h-7 px-2.5 text-xs bg-white border-[#DEDAD3] text-[#23211E] gap-1"
                >
                  <Plus className="w-3.5 h-3.5 text-[#E07A1F]" /> Adicionar dia extra
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDistribuirPontosAuto}
                  className="h-7 px-2.5 text-xs bg-white border-[#DEDAD3] text-[#23211E] gap-1"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#E07A1F]" /> Distribuir pontos
                </Button>
              </div>

              <Button
                size="sm"
                onClick={handleEnviarTodosOsDias}
                className="h-8 px-4 text-xs font-bold bg-[#E07A1F] text-white hover:bg-[#E07A1F]/90 gap-2 shadow-2xs"
              >
                <Send className="w-3.5 h-3.5" /> Enviar todos os dias ({diasProgramados.length})
              </Button>
            </div>
          </div>
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
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-[#A39E96]" />
              <input
                placeholder="Buscar projeto, equipe, data..."
                value={searchExistingPlan}
                onChange={e => setSearchExistingPlan(e.target.value)}
                className="w-full h-7 pl-8 pr-2 text-xs rounded border border-[#DEDAD3] bg-white font-mono"
              />
            </div>

            <Select value={filterEquipeExistingPlan} onValueChange={setFilterEquipeExistingPlan}>
              <SelectTrigger className="h-7 text-xs bg-white border-[#DEDAD3]">
                <SelectValue placeholder="Todas as equipes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODAS" className="text-xs">Todas as equipes</SelectItem>
                {equipesDisponiveis.map(eq => (
                  <SelectItem key={eq} value={eq} className="text-xs">{eq}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <label className="flex items-center gap-1.5 cursor-pointer text-xs text-[#5C574F]">
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
              <div className="text-center py-10 text-xs text-[#A39E96]">
                Nenhum planejamento existente encontrado com os filtros aplicados.
              </div>
            ) : (
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-[#F2F0EC] text-[#5C574F] text-[10px] uppercase border-b border-[#E6E3DD]">
                    <th className="p-2 w-[32px]"></th>
                    <th className="p-2">Data</th>
                    <th className="p-2">Equipe</th>
                    <th className="p-2">Projeto</th>
                    <th className="p-2">Pontos</th>
                    <th className="p-2 text-right">Valor</th>
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
                        <td className="p-2 text-center">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="rounded border-[#DEDAD3] text-[#E07A1F]"
                          />
                        </td>
                        <td className="p-2 font-mono font-medium text-[#23211E]">{plan.dataCompleta}</td>
                        <td className="p-2 font-mono">{plan.equipe}</td>
                        <td className="p-2 font-mono font-bold text-[#E07A1F]">{plan.projeto}</td>
                        <td className="p-2 font-mono text-[#5C574F]">{plan.pontosStr || `${plan.pontos.length} pontos`}</td>
                        <td className="p-2 text-right font-mono font-semibold text-[#17794C]">
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
          <div className="p-3 border-t border-[#E6E3DD] bg-[#FBFAF7] flex items-center justify-between">
            <span className="text-xs text-[#6B6660]">
              {selectedExistingPlanKeys.length} {selectedExistingPlanKeys.length === 1 ? 'selecionado' : 'selecionados'}
            </span>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCarregarPlanModalOpen(false)}
                className="h-7 text-xs"
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
                className="h-7 text-xs bg-[#E07A1F] text-white hover:bg-[#E07A1F]/90 font-semibold"
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
