import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Building2,
  Calendar as CalendarIcon,
  Users,
  Search,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  DollarSign,
  Truck,
  Send,
  Loader2,
  RefreshCw,
  Layers,
  FileSpreadsheet,
  AlertCircle,
  Filter,
  PackageCheck,
  Check,
  ChevronDown,
  Tag,
  CheckSquare,
  Square,
  Wrench,
  Target,
  Navigation,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  LogOut,
  TrendingUp,
  Percent,
  MapPin,
  UtilityPole,
  Zap,
  ZoomIn,
  ZoomOut,
  ChevronsUpDown,
  Home,
  SlidersHorizontal
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { UNIDADES_PLANEJAMENTO } from '@/constants/unidades';
import { useSessionState } from '@/hooks/useSessionState';
import {
  usePcpPlanejamentoData,
  UNIDADES_DISPONIVEIS,
  ETAPAS_PADRAO,
  ETAPAS_ATIVIDADES_PRE_FECHAMENTO,
  ALL_STATUSES,
  DEFAULT_SELECTED_STATUSES,
  PcpObra,
  PcpPontoItem,
  ServicoBase,
  inferEtapaFromServico
} from '@/hooks/usePcpPlanejamentoData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { format, startOfWeek, addDays, isSameDay, eachDayOfInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MaterialPontoBudget } from '@/hooks/usePcpPlanejamentoData';
import { useAlojamentos } from '@/hooks/useAlojamentos';
import { useVistoriaRisk } from '@/hooks/usePcpAiPlanner';
import { toast } from 'sonner';

function calcDistanceKM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
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

function safeFormatDate(val?: any, fmt = 'dd/MM/yyyy'): string {
  try {
    const d = safeParseDate(val);
    return format(d, fmt);
  } catch {
    return format(new Date(), fmt);
  }
}

function formatMinToHours(minutes: number): string {
  if (!minutes || minutes <= 0) return '00:00';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatHoursDecimal(minutes: number): string {
  if (!minutes || minutes <= 0) return '00:00';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// ─── PontosMultiSelect — Popover de seleção de pontos com exclusividade por dia ───
interface PontosMultiSelectProps {
  pontos: string[];
  selected: string[];
  orcamentoPorPontoMap: Map<string, MaterialPontoBudget[]>;
  onToggle: (p: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

const PontosMultiSelect = ({
  pontos,
  selected,
  orcamentoPorPontoMap,
  onToggle,
  onSelectAll,
  onDeselectAll,
}: PontosMultiSelectProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredPontos = useMemo(() => {
    if (!search.trim()) return pontos;
    return pontos.filter(p => p.toLowerCase().includes(search.toLowerCase().trim()));
  }, [pontos, search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-8 text-xs font-semibold px-3 bg-background min-w-[210px] justify-between shadow-2xs">
          <span className="flex items-center gap-1.5">
            <PackageCheck className="w-3.5 h-3.5 text-primary" />
            {selected.length === 0
              ? 'Selecionar Pontos do Dia...'
              : `${selected.length} ponto(s) neste dia`}
          </span>
          <ChevronDown className="w-3 h-3 opacity-50 ml-2 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[330px] p-0" align="start">
        {/* Header com busca */}
        <div className="p-2 border-b border-border">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
            <input
              placeholder="Buscar ponto (P1, P2...)..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full h-8 pl-8 pr-2 text-xs rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary font-mono"
              autoFocus
            />
          </div>
        </div>

        {/* Ações rápidas */}
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-border text-[10px] bg-muted/30">
          <button onClick={onSelectAll} className="text-primary hover:underline font-semibold">
            Selecionar todos ({pontos.length})
          </button>
          <button onClick={onDeselectAll} className="text-muted-foreground hover:underline">
            Limpar deste dia
          </button>
        </div>

        {/* Lista de pontos da obra com scroll */}
        <div className="overflow-y-auto max-h-[260px] p-1.5 space-y-1
          [&::-webkit-scrollbar]:w-1.5
          [&::-webkit-scrollbar-thumb]:bg-border
          [&::-webkit-scrollbar-thumb]:rounded-full">
          
          <div className="px-1.5 pt-1 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Pontos da Obra ({filteredPontos.length})
          </div>

          {filteredPontos.length === 0 ? (
            <p className="text-[11px] text-center text-muted-foreground py-3 italic">
              Nenhum ponto encontrado
            </p>
          ) : (
            filteredPontos.map(p => {
              const isChecked = selected.includes(p);
              const count = (orcamentoPorPontoMap.get(p) || []).length;
              return (
                <div
                  key={p}
                  onClick={() => onToggle(p)}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors text-xs ${
                    isChecked ? 'bg-primary/10 text-primary font-semibold' : 'hover:bg-accent text-foreground'
                  }`}
                >
                  <Checkbox checked={isChecked} onCheckedChange={() => onToggle(p)} className="h-3.5 w-3.5 shrink-0" />
                  <span className="font-mono font-bold">{p}</span>
                  <span className="text-[10px] text-muted-foreground ml-auto">{count} ativ. orçadas</span>
                </div>
              );
            })
          )}
        </div>

        {/* Footer com contador */}
        <div className="px-3 py-2 border-t border-border text-[10px] text-muted-foreground flex justify-between bg-muted/30">
          <span><strong>{selected.length}</strong> ponto(s) neste dia</span>
          <button onClick={() => setOpen(false)} className="text-primary hover:underline font-bold">Confirmar</button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

// Componente de Seleção de Atividades com Busca por Digitação
const SearchableServicoSelect = ({
  value,
  onValueChange,
  options
}: {
  value: string;
  onValueChange: (val: string) => void;
  options: ServicoBase[];
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const safeOptions = Array.isArray(options) ? options : [];
  const filtered = useMemo(() => {
    if (!search.trim()) return safeOptions;
    const sUpper = search.toUpperCase().trim();
    return safeOptions.filter(o => 
      (o.servico && o.servico.toUpperCase().includes(sUpper)) ||
      (o.codigo && o.codigo.toUpperCase().includes(sUpper))
    );
  }, [safeOptions, search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-8 w-full justify-between text-xs font-semibold bg-background border-border hover:bg-accent/50 px-2.5"
        >
          <span className="truncate text-left flex-1 font-semibold text-foreground">
            {value || "Selecione a Atividade..."}
          </span>
          <ChevronsUpDown className="ml-1.5 h-3.5 w-3.5 shrink-0 opacity-50 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[380px] p-0 shadow-lg border-border z-[9999]" align="start">
        <div className="p-2 border-b border-border flex items-center gap-2 bg-muted/20">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            type="text"
            placeholder="Pesquisar atividade por nome ou código..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full text-xs bg-transparent outline-none placeholder:text-muted-foreground text-foreground"
            autoFocus
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="text-[11px] text-muted-foreground hover:text-foreground font-bold px-1.5 py-0.5 rounded hover:bg-muted"
              title="Limpar pesquisa"
            >
              ✕
            </button>
          )}
        </div>
        <div className="max-h-[260px] overflow-y-auto p-1 space-y-0.5 custom-scrollbar">
          {filtered.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              Nenhuma atividade encontrada para "{search}".
            </div>
          ) : (
            filtered.map(s => {
              const isSelected = s.servico === value;
              return (
                <div
                  key={s.servico}
                  onClick={() => {
                    onValueChange(s.servico);
                    setOpen(false);
                    setSearch('');
                  }}
                  className={cn(
                    "flex items-center justify-between p-2 rounded-md text-xs cursor-pointer transition-colors",
                    isSelected 
                      ? "bg-primary text-primary-foreground font-bold" 
                      : "hover:bg-accent hover:text-accent-foreground text-foreground"
                  )}
                >
                  <div className="flex flex-col flex-1 pr-2 truncate">
                    <span className="truncate font-semibold">{s.servico}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      {s.codigo && (
                        <span className={cn("text-[10px] font-mono", isSelected ? "text-primary-foreground/80" : "text-muted-foreground")}>
                          Cód: {s.codigo}
                        </span>
                      )}
                      <span className={cn("text-[10px] font-mono", isSelected ? "text-primary-foreground/80" : "text-muted-foreground")}>
                        • {s.tempoMinutosPorUnidade} min
                      </span>
                    </div>
                  </div>
                  {isSelected && <Check className="h-4 h-4 shrink-0 ml-1 text-primary-foreground" />}
                </div>
              );
            })
          )}
        </div>
        <div className="p-1.5 border-t border-border bg-muted/30 text-[10px] text-muted-foreground text-center font-medium">
          {filtered.length} {filtered.length === 1 ? 'atividade disponível' : 'atividades disponíveis'}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export const PcpPlanejamentoView = () => {
  // State
  // Selected Obra & Filters (Filtros da Carteira)
  const [selectedObraId, setSelectedObraId] = useSessionState<string>('pcp_shared_obra', '');
  const [searchObra, setSearchObra] = useSessionState<string>('pcp_shared_search', '');
  const [selectedStatuses, setSelectedStatuses] = useSessionState<string[]>('pcp_shared_statuses', DEFAULT_SELECTED_STATUSES);
  const [isStatusPopoverOpen, setIsStatusPopoverOpen] = useState<boolean>(false);
  const [selectedSituacao, setSelectedSituacao] = useSessionState<string>('pcp_shared_situacao', 'APTA');
  const [selectedMesFilter, setSelectedMesFilter] = useSessionState<string>('pcp_shared_mes', 'TODOS');
  const [selectedMunicipioFilter, setSelectedMunicipioFilter] = useSessionState<string>('pcp_shared_municipio', 'TODOS');
  const [selectedPrioridadeFilter, setSelectedPrioridadeFilter] = useSessionState<string>('pcp_shared_prioridade', 'TODAS');
  const [selectedDonoFilter, setSelectedDonoFilter] = useSessionState<string>('pcp_shared_dono', 'TODOS');
  const [selectedSupervisorFilter, setSelectedSupervisorFilter] = useSessionState<string>('pcp_shared_supervisor', 'TODOS');
  const [selectedUnidadeId, setSelectedUnidadeId] = useSessionState<string>('pcp_shared_unidade', '1rj2V7CxbZwkan63eCeLkH9G00Gi041IZNC6vwEgq6yI'); // Bom Jesus da Lapa
  const [newCustomPontoInput, setNewCustomPontoInput] = useState<string>('');

  // Alojamentos
  const { alojamentos } = useAlojamentos();
  const [selectedAlojamentoId, setSelectedAlojamentoId] = useState<string>('nenhum');

  // Hook with data
  const {
    rawCacheQuery,
    obras,
    programacoesAtivas,
    supervisoresDisponiveis,
    equipesDisponiveis,
    etapasDisponiveis,
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

  const selectedObra = useMemo(() => obras.find(o => o.projeto === selectedObraId) || null, [obras, selectedObraId]);

  // Date Range state: Data Início e Data Fim da Programação
  const [dataInicio, setDataInicio] = useSessionState<string>('pcp_shared_data_inicio', format(new Date(), 'yyyy-MM-dd'));
  const [dataFim, setDataFim] = useSessionState<string>('pcp_shared_data_fim', format(addDays(new Date(), 2), 'yyyy-MM-dd'));
  const [isDataInicioOpen, setIsDataInicioOpen] = useState<boolean>(false);
  const [isDataFimOpen, setIsDataFimOpen] = useState<boolean>(false);

  // Map of points allocated by day: Record<dayId, string[]>
  const [diasPontosMap, setDiasPontosMap] = useSessionState<Record<string, string[]>>('pcp_shared_dias_pontos_map', {});
  const [activeDayId, setActiveDayId] = useSessionState<string>('pcp_shared_active_day_id', '');

  // Outros states fixos
  const [supervisor, setSupervisor] = useState<string>('BARTOLOMEU');
  const [selectedEquipes, setSelectedEquipes] = useSessionState<string[]>('pcp_shared_selected_equipes_v3', ['EH156']);
  const [metaDeslocamentoDiarioHoras, setMetaDeslocamentoDiarioHoras] = useSessionState<number>('pcp_meta_deslocamento_horas_v1', 2.0);
  const [tempoSaidaBasePadrao, setTempoSaidaBasePadrao] = useSessionState<number>('pcp_tempo_saida_base_padrao_v1', 15);
  const [tempoSegurancaPadrao, setTempoSegurancaPadrao] = useSessionState<number>('pcp_tempo_seguranca_padrao_v1', 15);
  const [metaEquipeInput, setMetaEquipeInput] = useState<number>(4442);

  // Map de customizações diárias de tempos complementares: Record<dayId, { tempoSaidaBaseMin?: number, tempoSegurancaMin?: number }>
  const [diasTemposCompMap, setDiasTemposCompMap] = useSessionState<Record<string, { tempoSaidaBaseMin?: number, tempoSegurancaMin?: number }>>('pcp_dias_tempos_comp_map_v1', {});

  const handleUpdateDiaTempoComp = (diaId: string, field: 'tempoSaidaBaseMin' | 'tempoSegurancaMin', val: number) => {
    setDiasTemposCompMap(prev => ({
      ...prev,
      [diaId]: {
        ...prev[diaId],
        [field]: Math.max(0, val)
      }
    }));
  };

  const handleChangeSaidaBasePadrao = (val: number) => {
    const v = Math.max(0, val);
    setTempoSaidaBasePadrao(v);
    setDiasTemposCompMap(prev => {
      const nextMap = { ...prev };
      diasProgramados.forEach(d => {
        nextMap[d.id] = {
          ...nextMap[d.id],
          tempoSaidaBaseMin: v
        };
      });
      return nextMap;
    });
  };

  const handleChangeSegurancaPadrao = (val: number) => {
    const v = Math.max(0, val);
    setTempoSegurancaPadrao(v);
    setDiasTemposCompMap(prev => {
      const nextMap = { ...prev };
      diasProgramados.forEach(d => {
        nextMap[d.id] = {
          ...nextMap[d.id],
          tempoSegurancaMin: v
        };
      });
      return nextMap;
    });
  };

  const handleToggleEquipe = (eqName: string) => {
    setSelectedEquipes(prev => {
      const list = Array.isArray(prev) ? prev : [];
      if (list.includes(eqName)) {
        return list.filter(e => e !== eqName);
      } else {
        return [...list, eqName];
      }
    });
  };
  // Per-day Etapas & LV Filters maps: Record<dayId, string[]> and Record<dayId, 'COMPLETO' | 'SOMENTE_LV' | 'SEM_LV'>
  const [filtroLvPadraoGlobal, setFiltroLvPadraoGlobal] = useSessionState<'COMPLETO' | 'SOMENTE_LV' | 'SEM_LV'>('pcp_shared_filtro_lv_padrao_global_v1', 'COMPLETO');
  const [diasEtapasMap, setDiasEtapasMap] = useSessionState<Record<string, string[]>>('pcp_shared_dias_etapas_map_v2', {});
  const [diasFiltroLvMap, setDiasFiltroLvMap] = useSessionState<Record<string, 'COMPLETO' | 'SOMENTE_LV' | 'SEM_LV'>>('pcp_shared_dias_filtro_lv_map_v2', {});

  const handleSetGlobalFiltroLv = (filtro: 'COMPLETO' | 'SOMENTE_LV' | 'SEM_LV') => {
    setFiltroLvPadraoGlobal(filtro);
    const newMap: Record<string, 'COMPLETO' | 'SOMENTE_LV' | 'SEM_LV'> = {};
    diasProgramados.forEach(d => {
      newMap[d.id] = filtro;
    });
    setDiasFiltroLvMap(newMap);
    toast.success(`Filtro pré-definido "${filtro === 'SOMENTE_LV' ? 'Somente LV' : filtro === 'SEM_LV' ? 'Sem LV' : 'Completo'}" aplicado a todos os dias!`);
  };

  const handleToggleEtapaNoDia = (diaId: string, etapa: string) => {
    setDiasEtapasMap(prev => {
      const cur = prev[diaId] || [];
      const updated = cur.includes(etapa) ? cur.filter(e => e !== etapa) : [...cur, etapa];
      return { ...prev, [diaId]: updated };
    });
  };

  const handleSetFiltroLvNoDia = (diaId: string, filtro: 'COMPLETO' | 'SOMENTE_LV' | 'SEM_LV') => {
    setDiasFiltroLvMap(prev => ({ ...prev, [diaId]: filtro }));
  };

  const filteredServicosBase = useMemo(() => {
    return Array.isArray(servicosBase) ? servicosBase : [];
  }, [servicosBase]);

  // ZOOM — igual padrão das outras seções do Módulo Planejamento
  const [zoomLevel, setZoomLevel] = useSessionState<number>('filter_zoom_pcpplanejamento', 1);

  // Risk AI
  const { analyzeRisk, riskCache, loadingRisk } = useVistoriaRisk(selectedObraId || null);

  useEffect(() => {
    if (selectedObraId) analyzeRisk(selectedObraId);
  }, [selectedObraId, analyzeRisk]);

  const riskForObra = selectedObraId ? riskCache[selectedObraId] : null;

  // RESIZE da lista de obras (drag-to-resize na borda inferior)
  const [obrasListHeight, setObrasListHeight] = useState<number>(260);
  const isDraggingRef = useRef<boolean>(false);
  const dragStartYRef = useRef<number>(0);
  const dragStartHeightRef = useRef<number>(260);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    dragStartYRef.current = e.clientY;
    dragStartHeightRef.current = obrasListHeight;
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (ev: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const delta = ev.clientY - dragStartYRef.current;
      const newH = Math.max(150, Math.min(700, dragStartHeightRef.current + delta));
      setObrasListHeight(newH);
    };

    const onMouseUp = () => {
      isDraggingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [obrasListHeight]);

  // Informações da Base e Alojamentos da Unidade Ativa
  const unidadeAtivaInfo = useMemo(() => {
    return UNIDADES_PLANEJAMENTO.find(u => u.id === selectedUnidadeId) || UNIDADES_PLANEJAMENTO[1];
  }, [selectedUnidadeId]);

  const alojamentosDaUnidade = useMemo(() => {
    return alojamentos.filter(a => a.unidadeId === selectedUnidadeId);
  }, [alojamentos, selectedUnidadeId]);

  // Alojamento Padrão da Semana (Filtro Geral: 'BASE' ou ID de Alojamento)
  const [selectedAlojamentoPadraoId, setSelectedAlojamentoPadraoId] = useSessionState<string>('pcp_shared_aloj_padrao_v2', 'BASE');
  const [acrescimoVeiculoPct, setAcrescimoVeiculoPct] = useSessionState<number>('pcp_shared_acrescimo_caminhao_pct_v2', 30);
  const [diasCustomAlojMap, setDiasCustomAlojMap] = useSessionState<Record<string, {
    origemId?: string;
    destinoId?: string;
    manualTempoIdaMin?: number;
    manualTempoVoltaMin?: number;
  }>>('pcp_shared_dias_custom_aloj_v2', {});

  // Atualizar quando o Alojamento Padrão mudar
  const handleAlojamentoPadraoChange = (alojId: string) => {
    setSelectedAlojamentoPadraoId(alojId);
    // Limpa overrides manuais para que todos os dias do período assumam as novas regras automáticas
    setDiasCustomAlojMap({});
  };

  // Atualizar origem ou destino de um dia específico (chaveada pela data yyyy-MM-dd)
  const handleUpdateDiaAlojamento = (diaId: string, field: 'origemId' | 'destinoId', val: string) => {
    setDiasCustomAlojMap(prev => {
      const existing = prev[diaId] || {};
      return {
        ...prev,
        [diaId]: {
          ...existing,
          [field]: val,
          // Se trocou de alojamento/base, reseta o tempo manual correspondente para recalcular pelas coordenadas
          ...(field === 'origemId' ? { manualTempoIdaMin: undefined } : { manualTempoVoltaMin: undefined })
        }
      };
    });
  };

  // Atualizar tempo de ida ou volta manualmente (em minutos)
  const handleUpdateDiaTempo = (diaId: string, field: 'manualTempoIdaMin' | 'manualTempoVoltaMin', minutes: number) => {
    setDiasCustomAlojMap(prev => {
      const existing = prev[diaId] || {};
      return {
        ...prev,
        [diaId]: {
          ...existing,
          [field]: Math.max(0, Math.round(minutes))
        }
      };
    });
  };

  // Lista direta de Datas Programadas
  const [datasProgramadas, setDatasProgramadas] = useState<string[]>(() => {
    let dStart = safeParseDate(dataInicio);
    let dEnd = safeParseDate(dataFim);
    if (dEnd < dStart) dEnd = dStart;
    try {
      return eachDayOfInterval({ start: dStart, end: dEnd }).map(d => safeFormatDate(d, 'yyyy-MM-dd'));
    } catch {
      return [safeFormatDate(dStart, 'yyyy-MM-dd')];
    }
  });

  // Atualizar data de um dia específico
  const handleUpdateDiaDate = (index: number, newDateStr: string) => {
    setDatasProgramadas(prev => {
      const copy = [...prev];
      const oldId = copy[index];
      copy[index] = newDateStr;

      // Migrar pontos, etapas e alojamentos caso a data tenha mudado
      if (oldId && oldId !== newDateStr) {
        if (diasPontosMap[oldId]) {
          setDiasPontosMap(pMap => {
            const nextMap = { ...pMap, [newDateStr]: pMap[oldId] };
            delete nextMap[oldId];
            return nextMap;
          });
        }
        if (diasEtapasMap[oldId]) {
          setDiasEtapasMap(eMap => {
            const nextMap = { ...eMap, [newDateStr]: eMap[oldId] };
            delete nextMap[oldId];
            return nextMap;
          });
        }
        if (diasCustomAlojMap[oldId]) {
          setDiasCustomAlojMap(aMap => {
            const nextMap = { ...aMap, [newDateStr]: aMap[oldId] };
            delete nextMap[oldId];
            return nextMap;
          });
        }
        if (activeDayId === oldId) {
          setActiveDayId(newDateStr);
        }
      }
      return copy;
    });
  };

  // Inserir dia extra na programação
  const handleAddDiaExtra = () => {
    setDatasProgramadas(prev => {
      const lastDateStr = prev[prev.length - 1] || dataFim || format(new Date(), 'yyyy-MM-dd');
      const nextDate = addDays(safeParseDate(lastDateStr), 1);
      const nextDateStr = safeFormatDate(nextDate, 'yyyy-MM-dd');
      setDiasFiltroLvMap(m => ({ ...m, [nextDateStr]: filtroLvPadraoGlobal }));
      return [...prev, nextDateStr];
    });
  };

  // Excluir dia da programação
  const handleRemoveDia = (index: number) => {
    setDatasProgramadas(prev => {
      if (prev.length <= 1) {
        alert('A programação deve ter pelo menos 1 dia.');
        return prev;
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  // Cálculo dos Dias Programados no Período (com suporte a datas editáveis e dias extras)
  const diasProgramados = useMemo(() => {
    const dates = (datasProgramadas && datasProgramadas.length > 0)
      ? datasProgramadas
      : [safeFormatDate(new Date(), 'yyyy-MM-dd')];
    const totalDias = dates.length;
    const nomesSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

    return dates.map((dateStrItem, idx) => {
      const dayDate = safeParseDate(dateStrItem);
      const id = dateStrItem;
      const diaSemanaIndex = dayDate.getDay();
      const nomeDia = nomesSemana[diaSemanaIndex] || 'Dia';
      const dataStr = safeFormatDate(dayDate, 'dd/MM');
      const dataCompleta = safeFormatDate(dayDate, 'dd/MM/yyyy');

      // Regras Oficiais de Deslocamento:
      // 1. Se filtro for BASE ou nenhum: todos os dias saem e voltam para a BASE
      // 2. Se filtro for Alojamento:
      //    - Dia Único (totalDias === 1): Sai da Base ➔ Obra ➔ Retorna à Base
      //    - Primeiro Dia (idx === 0): Sai da Base ➔ Obra ➔ Pernoita no Alojamento
      //    - Dias Intermediários: Sai do Alojamento ➔ Obra ➔ Pernoita no Alojamento
      //    - Último Dia (idx === totalDias - 1): Sai do Alojamento ➔ Obra ➔ Retorna à Base
      let defaultOrigemId = 'BASE';
      let defaultDestinoId = 'BASE';

      if (selectedAlojamentoPadraoId === 'BASE' || selectedAlojamentoPadraoId === 'nenhum') {
        defaultOrigemId = 'BASE';
        defaultDestinoId = 'BASE';
      } else {
        if (totalDias === 1) {
          defaultOrigemId = 'BASE';
          defaultDestinoId = 'BASE';
        } else if (idx === 0) {
          defaultOrigemId = 'BASE';
          defaultDestinoId = selectedAlojamentoPadraoId;
        } else if (idx === totalDias - 1) {
          defaultOrigemId = selectedAlojamentoPadraoId;
          defaultDestinoId = 'BASE';
        } else {
          defaultOrigemId = selectedAlojamentoPadraoId;
          defaultDestinoId = selectedAlojamentoPadraoId;
        }
      }

      const customAloj = diasCustomAlojMap[id] || {};
      const finalOrigemId = customAloj.origemId || defaultOrigemId;
      const finalDestinoId = customAloj.destinoId || defaultDestinoId;

      const baseInfo = unidadeAtivaInfo || UNIDADES_PLANEJAMENTO[1];
      const alojList = Array.isArray(alojamentosDaUnidade) ? alojamentosDaUnidade : [];

      const origemObj = finalOrigemId === 'BASE'
        ? { id: 'BASE', nome: baseInfo.baseNome, latitude: baseInfo.baseLatitude, longitude: baseInfo.baseLongitude }
        : (alojList.find(a => a.id === finalOrigemId) || { id: finalOrigemId, nome: 'Alojamento', latitude: null, longitude: null });

      const destinoObj = finalDestinoId === 'BASE'
        ? { id: 'BASE', nome: baseInfo.baseNome, latitude: baseInfo.baseLatitude, longitude: baseInfo.baseLongitude }
        : (alojList.find(a => a.id === finalDestinoId) || { id: finalDestinoId, nome: 'Alojamento', latitude: null, longitude: null });

      // Fator de estradas (1.25x sobre linha reta para representar percurso real em rodovias e estradas vicinais)
      const FATOR_ESTRADA = 1.25;
      // Fator de caminhão pesado: velocidade média de caminhão (~45 km/h -> 1.33 min/km) acrescido do percentual configurado
      const fatorCaminhaoMult = 1 + (Number(acrescimoVeiculoPct) || 0) / 100;

      let distIdaKm = 0;
      let calcTempoIdaMin = 15;
      if (origemObj.latitude && origemObj.longitude && selectedObra?.latitude && selectedObra?.longitude) {
        distIdaKm = Math.round(calcDistanceKM(origemObj.latitude, origemObj.longitude, selectedObra.latitude, selectedObra.longitude) * FATOR_ESTRADA * 10) / 10;
        calcTempoIdaMin = Math.max(5, Math.round(distIdaKm * 1.33 * fatorCaminhaoMult));
      }

      let distVoltaKm = 0;
      let calcTempoVoltaMin = 15;
      if (destinoObj.latitude && destinoObj.longitude && selectedObra?.latitude && selectedObra?.longitude) {
        distVoltaKm = Math.round(calcDistanceKM(selectedObra.latitude, selectedObra.longitude, destinoObj.latitude, destinoObj.longitude) * FATOR_ESTRADA * 10) / 10;
        calcTempoVoltaMin = Math.max(5, Math.round(distVoltaKm * 1.33 * fatorCaminhaoMult));
      }

      // Utiliza tempo manual se configurado pelo usuário, senão utiliza o cálculo estimado de estradas
      const tempoIdaMin = (customAloj.manualTempoIdaMin !== undefined && customAloj.manualTempoIdaMin > 0)
        ? customAloj.manualTempoIdaMin
        : calcTempoIdaMin;

      const tempoVoltaMin = (customAloj.manualTempoVoltaMin !== undefined && customAloj.manualTempoVoltaMin > 0)
        ? customAloj.manualTempoVoltaMin
        : calcTempoVoltaMin;

      const tempoTotalDeslocamentoMin = tempoIdaMin + tempoVoltaMin;
      const pontosDoDia = (diasPontosMap && Array.isArray(diasPontosMap[id])) ? diasPontosMap[id] : [];

      return {
        idx,
        id,
        dayDate,
        dataStr,
        dataCompleta,
        nomeDia,
        pontos: pontosDoDia,
        origemId: finalOrigemId,
        origemNome: origemObj.nome,
        destinoId: finalDestinoId,
        destinoNome: destinoObj.nome,
        distIdaKm,
        tempoIdaMin,
        distVoltaKm,
        tempoVoltaMin,
        tempoTotalDeslocamentoMin,
        isManualIda: customAloj.manualTempoIdaMin !== undefined && customAloj.manualTempoIdaMin > 0,
        isManualVolta: customAloj.manualTempoVoltaMin !== undefined && customAloj.manualTempoVoltaMin > 0
      };
    });
  }, [datasProgramadas, diasCustomAlojMap, selectedAlojamentoPadraoId, acrescimoVeiculoPct, unidadeAtivaInfo, alojamentosDaUnidade, selectedObra, diasPontosMap]);

  // Dia ativo selecionado para visualização/edição
  const activeDia = useMemo(() => {
    if (!diasProgramados || diasProgramados.length === 0) {
      const now = new Date();
      return {
        idx: 0,
        id: safeFormatDate(now, 'yyyy-MM-dd'),
        dayDate: now,
        dataStr: safeFormatDate(now, 'dd/MM'),
        dataCompleta: safeFormatDate(now, 'dd/MM/yyyy'),
        nomeDia: 'Hoje',
        pontos: [],
        origemId: 'BASE',
        origemNome: unidadeAtivaInfo?.baseNome || 'Base',
        destinoId: 'BASE',
        destinoNome: unidadeAtivaInfo?.baseNome || 'Base',
        distIdaKm: 0,
        tempoIdaMin: 15,
        distVoltaKm: 0,
        tempoVoltaMin: 15,
        tempoTotalDeslocamentoMin: 30
      };
    }
    return diasProgramados.find(d => d.id === activeDayId) || diasProgramados[0];
  }, [diasProgramados, activeDayId, unidadeAtivaInfo]);

  // Garantir que activeDayId aponta para um dia existente
  useEffect(() => {
    if (diasProgramados.length > 0 && (!activeDayId || !diasProgramados.some(d => d.id === activeDayId))) {
      setActiveDayId(diasProgramados[0].id);
    }
  }, [diasProgramados, activeDayId, setActiveDayId]);

  // Pontos alocados em outros dias (para badges no dropdown)
  const pontosAlocadosEmOutrosDiasMap = useMemo(() => {
    const map: Record<string, string> = {};
    diasProgramados.forEach(d => {
      if (d.id !== activeDia?.id) {
        d.pontos.forEach(p => {
          map[p] = `${d.nomeDia.slice(0, 3)} (${d.dataStr})`;
        });
      }
    });
    return map;
  }, [diasProgramados, activeDia?.id]);

  // Pontos selecionados no dia ativo
  const selectedPontosLabels = useMemo(() => {
    return (activeDia && Array.isArray(activeDia.pontos)) ? activeDia.pontos : [];
  }, [activeDia?.pontos]);

  // ── Auto-selecionar status dinâmicos (menos os concluídos) ────────────────
  useEffect(() => {
    if (statusesCarteira.length > 0) {
      const isStillDefault = selectedStatuses.length === DEFAULT_SELECTED_STATUSES.length &&
        selectedStatuses.every(s => DEFAULT_SELECTED_STATUSES.includes(s));
      if (isStillDefault) {
        setSelectedStatuses(statusesCarteira.filter(s => !s.toUpperCase().includes('CONCLU')));
      }
    }
  }, [statusesCarteira]);

  // Load equipe default and its meta based on list
  useEffect(() => {
    if (supervisoresDisponiveis.length > 0 && !supervisoresDisponiveis.includes(supervisor)) {
      setSupervisor(supervisoresDisponiveis[0]);
    }
    if (equipesDisponiveis.length > 0 && selectedEquipes.length === 0) {
      setSelectedEquipes([equipesDisponiveis[0]]);
    }
  }, [selectedUnidadeId, supervisoresDisponiveis, equipesDisponiveis]);

  // Auto-sync team goal (Meta da Equipe R$) whenever selectedEquipes change
  useEffect(() => {
    if (selectedEquipes.length > 0) {
      let totalMeta = 0;
      selectedEquipes.forEach(eq => {
        const metaVal = metasPorEquipeMap.get(eq.toUpperCase());
        if (metaVal && metaVal > 0) {
          totalMeta += metaVal;
        }
      });
      if (totalMeta > 0) {
        setMetaEquipeInput(totalMeta);
      }
    }
  }, [selectedEquipes, metasPorEquipeMap]);

  // Map of PcpPontoItem[] grouped by Ponto Label (e.g., 'P71' -> items[], 'P72' -> items[])
  const [pontosGroupedMap, setPontosGroupedMap] = useSessionState<Record<string, PcpPontoItem[]>>('pcp_shared_pontos_grouped_v4', {});

  // Helper for "Limpar Filtros"
  const handleClearFilters = () => {
    setSelectedSituacao('TODAS');
    setSelectedStatuses(statusesCarteira.filter(s => !s.toUpperCase().includes('CONCLU')));
    setSelectedMesFilter('TODOS');
    setSelectedMunicipioFilter('TODOS');
    setSelectedPrioridadeFilter('TODAS');
    setSelectedDonoFilter('TODOS');
    setSelectedSupervisorFilter('TODOS');
    setSearchObra('');
  };

  const handleSelectObra = (obra: PcpObra) => {
    setSelectedObraId(obra.projeto);
    if (activeDia) {
      setDiasPontosMap(prev => ({
        ...prev,
        [activeDia.id]: ['P1']
      }));
    }
    setPontosGroupedMap({});
  };

  // Sync items table grouped by Ponto whenever orcamentoPorPontoMap or pontosDisponiveisDoProjeto changes
  useEffect(() => {
    if (!selectedObra) return;

    setPontosGroupedMap(prevMap => {
      const currentPrevMap = prevMap || {};
      const nextMap: Record<string, PcpPontoItem[]> = { ...currentPrevMap };

      // Coletar todos os pontos possíveis: do projeto, dos dias programados, ou do mapa de orçamento
      const allLabels = new Set<string>();
      (pontosDisponiveisDoProjeto || []).forEach(p => allLabels.add(p.toUpperCase()));
      Object.values(diasPontosMap || {}).forEach(pts => (pts || []).forEach(p => allLabels.add(p.toUpperCase())));
      if (orcamentoPorPontoMap?.keys) {
        for (const k of orcamentoPorPontoMap.keys()) {
          allLabels.add(k.toUpperCase());
        }
      }
      if (allLabels.size === 0) allLabels.add('P1');

      allLabels.forEach(pLabelUpper => {
        if (!pLabelUpper) return;
        const budgetItems = orcamentoPorPontoMap?.get ? orcamentoPorPontoMap.get(pLabelUpper) : undefined;
        const existingItems = currentPrevMap[pLabelUpper] || [];
        const existingSelectedMap = new Map(existingItems.map(i => [i.servico || i.id, i.selected]));

        if (budgetItems && Array.isArray(budgetItems) && budgetItems.length > 0) {
          nextMap[pLabelUpper] = budgetItems.map((bItem, bIdx) => {
            const serv = bItem.servicoPrevisto || 'SERVIÇO';
            const wasSelected = existingSelectedMap.has(serv) ? existingSelectedMap.get(serv)! : false;
            return {
              id: `${pLabelUpper}-${serv.replace(/\s+/g, '_')}-${bIdx}`,
              ponto: pLabelUpper,
              servico: serv,
              codigoMaterial: bItem.codigo,
              descricaoMaterial: bItem.descricao,
              qtdOrcadaPonto: bItem.quantidade || 1,
              etapaPrevista: bItem.etapaPrevista || inferEtapaFromServico(serv),
              quantidade: bItem.quantidade || 1,
              tempoEstimadoMinutos: bItem.tempoMinutos || 15,
              valorEstimado: bItem.valorEstimado || 0,
              selected: wasSelected,
              isBudgeted: true,
            };
          });
        } else if (existingItems.length > 0) {
          nextMap[pLabelUpper] = existingItems;
        } else {
          // Sem orçamento — cria linha em branco com fallback
          const fallback = (Array.isArray(filteredServicosBase) && filteredServicosBase.length > 0)
            ? filteredServicosBase[0]
            : (Array.isArray(servicosBase) && servicosBase.length > 0
              ? servicosBase[0]
              : { codigo: 'SIR0000001', servico: 'SERVIÇO PADRÃO', tempoMinutosPorUnidade: 60, valorPorUnidade: 100 });
          nextMap[pLabelUpper] = [{
            id: `${pLabelUpper}-default-${Date.now()}`,
            ponto: pLabelUpper,
            servico: fallback.servico || 'SERVIÇO PADRÃO',
            codigoMaterial: fallback.codigo,
            qtdOrcadaPonto: 1,
            etapaPrevista: inferEtapaFromServico(fallback.servico || ''),
            quantidade: 1,
            tempoEstimadoMinutos: fallback.tempoMinutosPorUnidade || 60,
            valorEstimado: fallback.valorPorUnidade || 100,
            selected: false,
            isBudgeted: false,
          }];
        }
      });

      return nextMap;
    });
  }, [pontosDisponiveisDoProjeto, diasPontosMap, orcamentoPorPontoMap, selectedObra, servicosBase, filteredServicosBase]);

  // Toggle multi-select status filter
  const handleToggleStatus = (statusName: string) => {
    setSelectedStatuses(prev => {
      const arr = Array.isArray(prev) ? prev : [];
      if (arr.includes(statusName)) {
        return arr.filter(s => s !== statusName);
      } else {
        return [...arr, statusName];
      }
    });
  };

  // Toggle multi-select etapas filter
  const handleToggleEtapa = (etapaName: string) => {
    setSelectedEtapas(prev => {
      const arr = Array.isArray(prev) ? prev : [];
      if (arr.includes(etapaName)) {
        if (arr.length === 1) return arr;
        return arr.filter(e => e !== etapaName);
      } else {
        return [...arr, etapaName];
      }
    });
  };

  // Count of obras per month tag
  const obrasCountByMonth = useMemo(() => {
    const map = new Map<string, number>();
    (obras || []).forEach(o => {
      if (!o) return;
      (o.meses || []).forEach(m => {
        const k = (m || '').trim();
        if (k) map.set(k, (map.get(k) || 0) + 1);
      });
    });
    return map;
  }, [obras]);

  // Filtered Obras list matching selectedStatuses, selectedSituacao, selectedMesFilter, selectedMunicipioFilter, selectedPrioridadeFilter
  const filteredObras = useMemo(() => {
    const list = Array.isArray(obras) ? obras : [];
    const statuses = Array.isArray(selectedStatuses) ? selectedStatuses : [];
    return list.filter(o => {
      if (!o) return false;
      // 1. Situação filter (APTA / INAPTA)
      if (selectedSituacao !== 'TODAS' && o.situacao !== selectedSituacao) {
        return false;
      }

      // 2. Status Execução filter — correspondência exata (case-insensitive)
      if (statuses.length > 0) {
        const statusUpper = (o.statusExecucao || '').trim().toUpperCase();
        const matchesStatus = statuses.some(st => statusUpper === (st || '').toUpperCase());
        if (!matchesStatus) return false;
      }
      // Se selectedStatuses.length === 0 → sem filtro de status (mostra todas)

      // 3. Mês / Carteira filter (Coluna G)
      if (selectedMesFilter !== 'TODOS') {
        const targetM = (selectedMesFilter || '').trim().toLowerCase();
        const hasMonth = (o.meses || []).some(m => (m || '').trim().toLowerCase() === targetM) ||
                         (o.carteirasStr || '').trim().toLowerCase().includes(targetM);
        if (!hasMonth) return false;
      }

      // 4. Município filter
      if (selectedMunicipioFilter !== 'TODOS' && (o.municipio || '').toUpperCase() !== (selectedMunicipioFilter || '').toUpperCase()) {
        return false;
      }

      // 5. Prioridade filter
      if (selectedPrioridadeFilter !== 'TODAS' && (o.prioridade || '').toUpperCase() !== (selectedPrioridadeFilter || '').toUpperCase()) {
        return false;
      }

      // 6. Dono da Obra filter
      if (selectedDonoFilter !== 'TODOS' && (o.donoDaObra || '').toUpperCase() !== (selectedDonoFilter || '').toUpperCase()) {
        return false;
      }

      // 7. Supervisor filter
      if (selectedSupervisorFilter !== 'TODOS' && (o.supervisor || '').toUpperCase() !== (selectedSupervisorFilter || '').toUpperCase()) {
        return false;
      }

      // 8. Search Text filter
      if (!searchObra.trim()) return true;
      const q = searchObra.toLowerCase().trim();
      return (
        (o.projeto || '').toLowerCase().includes(q) ||
        (o.nomeProjeto || '').toLowerCase().includes(q) ||
        (o.municipio || '').toLowerCase().includes(q) ||
        (o.donoDaObra || '').toLowerCase().includes(q) ||
        (o.supervisor || '').toLowerCase().includes(q)
      );
    });
  }, [obras, searchObra, selectedStatuses, selectedSituacao, selectedMesFilter, selectedMunicipioFilter, selectedPrioridadeFilter, selectedDonoFilter, selectedSupervisorFilter]);

  // Custom Ponto input map per day
  const [customPontoInputMap, setCustomPontoInputMap] = useState<Record<string, string>>({});

  // Adicionar ou remover ponto em um dia específico (sem restrição entre dias)
  const handleTogglePontoNoDia = (diaId: string, pontoLabel: string) => {
    const upper = pontoLabel.toUpperCase().trim();
    if (!upper || !diaId) return;

    setDiasPontosMap(prev => {
      const cur = prev[diaId] || [];
      const updated = cur.includes(upper)
        ? cur.filter(p => p !== upper)
        : [...cur, upper];
      return {
        ...prev,
        [diaId]: updated
      };
    });
  };

  // Selecionar todos os pontos da obra para um dia específico
  const handleSelectAllPontosNoDia = (diaId: string) => {
    if (pontosDisponiveisDoProjeto.length > 0 && diaId) {
      setDiasPontosMap(prev => ({
        ...prev,
        [diaId]: [...pontosDisponiveisDoProjeto]
      }));
    }
  };

  // Limpar pontos de um dia específico
  const handleDeselectAllPontosNoDia = (diaId: string) => {
    if (diaId) {
      setDiasPontosMap(prev => ({
        ...prev,
        [diaId]: []
      }));
    }
  };

  // Distribuir pontos da obra automaticamente entre os dias programados de forma equilibrada
  const handleDistribuirPontosAuto = () => {
    if (diasProgramados.length === 0 || pontosDisponiveisDoProjeto.length === 0) return;
    const newMap: Record<string, string[]> = {};
    diasProgramados.forEach(d => {
      newMap[d.id] = [];
    });

    pontosDisponiveisDoProjeto.forEach((p, idx) => {
      const dayTarget = diasProgramados[idx % diasProgramados.length];
      if (dayTarget) {
        newMap[dayTarget.id].push(p.toUpperCase());
      }
    });

    setDiasPontosMap(newMap);
    toast.success(`Distribuídos ${pontosDisponiveisDoProjeto.length} pontos entre os ${diasProgramados.length} dias programados.`);
  };

  // Adicionar ponto customizado em um dia específico
  const handleAddCustomPontoNoDia = (diaId: string) => {
    const inputVal = (customPontoInputMap[diaId] || '').toUpperCase().trim();
    if (!inputVal || !diaId) return;

    setDiasPontosMap(prev => {
      const current = prev[diaId] || [];
      if (!current.includes(inputVal)) {
        return {
          ...prev,
          [diaId]: [...current, inputVal]
        };
      }
      return prev;
    });

    setCustomPontoInputMap(prev => ({ ...prev, [diaId]: '' }));
  };

  // Mapa de pontos alocados em outros dias para um dia específico
  const getPontosAlocadosEmOutrosDias = (currentDiaId: string) => {
    const map: Record<string, string> = {};
    diasProgramados.forEach(d => {
      if (d.id !== currentDiaId) {
        (diasPontosMap[d.id] || []).forEach(p => {
          map[p.toUpperCase()] = `${d.nomeDia.slice(0, 3)} (${d.dataStr})`;
        });
      }
    });
    return map;
  };

  // Handle adding a new activity line via button (isBudgeted: false -> full catalog dropdown)
  const handleAddAtividadeNoPonto = (pontoLabelTarget: string) => {
    const existing = (pontosGroupedMap && Array.isArray(pontosGroupedMap[pontoLabelTarget])) 
      ? pontosGroupedMap[pontoLabelTarget] 
      : [];
    const existingServicos = new Set(existing.map(i => i.servico));
    
    const safeFiltered = Array.isArray(filteredServicosBase) ? filteredServicosBase : [];
    const safeBase = Array.isArray(servicosBase) ? servicosBase : [];
    
    const fallback = safeFiltered.length > 0 
      ? safeFiltered[0] 
      : (safeBase.length > 0 
        ? safeBase[0] 
        : { servico: 'INSTALAR ISOLADOR BASTAO/DISCO', tempoMinutosPorUnidade: 27, valorPorUnidade: 338.40 });
        
    const nextAvailableServico = safeFiltered.find(s => s && s.servico && !existingServicos.has(s.servico)) || fallback;
    const servicoName = nextAvailableServico?.servico || 'SERVIÇO PADRÃO';

    const newActivity: PcpPontoItem = {
      id: `${pontoLabelTarget}-manual-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      ponto: pontoLabelTarget,
      servico: servicoName,
      codigoMaterial: nextAvailableServico?.codigo,
      qtdOrcadaPonto: 1, // Coluna F: Qtd Prevista
      etapaPrevista: inferEtapaFromServico(servicoName), // Coluna M: Etapa Prevista
      quantidade: 1,
      tempoEstimadoMinutos: nextAvailableServico?.tempoMinutosPorUnidade || 60,
      valorEstimado: nextAvailableServico?.valorPorUnidade || 100,
      selected: true, // Atividade inserida pelo botão vem marcada por padrão
      isBudgeted: false, // Inserida pelo botão -> dá acesso à lista completa
    };

    setPontosGroupedMap(prev => {
      const prevGroup = prev || {};
      const currentList = Array.isArray(prevGroup[pontoLabelTarget]) ? [...prevGroup[pontoLabelTarget]] : [];
      return {
        ...prevGroup,
        [pontoLabelTarget]: [...currentList, newActivity]
      };
    });
  };

  // Handle updating an activity row in a specific Ponto Card
  const handleUpdateAtividade = (pontoLabelTarget: string, itemIdOrIndex: string | number, field: keyof PcpPontoItem, value: any) => {
    setPontosGroupedMap(prev => {
      const prevGroup = prev || {};
      const items = Array.isArray(prevGroup[pontoLabelTarget]) ? [...prevGroup[pontoLabelTarget]] : [];
      const itemIndex = typeof itemIdOrIndex === 'number'
        ? itemIdOrIndex
        : items.findIndex(i => i.id === itemIdOrIndex);

      if (itemIndex === -1 || !items[itemIndex]) return prevGroup;

      const target = { ...items[itemIndex] };
      const safeBase = Array.isArray(servicosBase) ? servicosBase : [];

      if (field === 'servico') {
        const found = safeBase.find(s => s && s.servico === value);
        target.servico = value;
        target.etapaPrevista = inferEtapaFromServico(value);
        if (found) {
          target.tempoEstimadoMinutos = Math.round(found.tempoMinutosPorUnidade * target.quantidade);
          target.valorEstimado = Math.round(found.valorPorUnidade * target.quantidade * 100) / 100;
        }
      } else if (field === 'quantidade') {
        const fallback = safeBase.length > 0 ? safeBase[0] : { servico: target.servico, tempoMinutosPorUnidade: 60, valorPorUnidade: 100 };
        const found = safeBase.find(s => s && s.servico === target.servico) || fallback;
        const qty = Math.max(1, Math.round(Number(value) || 1));
        target.quantidade = qty;
        target.tempoEstimadoMinutos = Math.round(found.tempoMinutosPorUnidade * qty);
        target.valorEstimado = Math.round(found.valorPorUnidade * qty * 100) / 100;
      } else if (field === 'qtdOrcadaPonto') {
        target.qtdOrcadaPonto = Math.max(0.1, Number(value) || 1);
      } else if (field === 'etapaPrevista') {
        target.etapaPrevista = String(value);
      } else if (field === 'selected') {
        target.selected = Boolean(value);
      }

      items[itemIndex] = target;
      return {
        ...prevGroup,
        [pontoLabelTarget]: items
      };
    });
  };

  // Handle removing an activity row from a Ponto Card
  const handleRemoveAtividade = (pontoLabelTarget: string, itemIdOrIndex: string | number) => {
    setPontosGroupedMap(prev => {
      const items = prev[pontoLabelTarget] ? [...prev[pontoLabelTarget]] : [];
      const itemIndex = typeof itemIdOrIndex === 'number'
        ? itemIdOrIndex
        : items.findIndex(i => i.id === itemIdOrIndex);

      if (itemIndex === -1) return prev;
      items.splice(itemIndex, 1);
      return {
        ...prev,
        [pontoLabelTarget]: items
      };
    });
  };



  // Flattened list of ALL items across all selected point cards in the ACTIVE DAY
  const allPontosListFlat = useMemo(() => {
    const list: PcpPontoItem[] = [];
    const labels = Array.isArray(selectedPontosLabels) ? selectedPontosLabels : [];
    const grouped = pontosGroupedMap || {};
    labels.forEach(pLabel => {
      if (pLabel && Array.isArray(grouped[pLabel])) {
        list.push(...grouped[pLabel]);
      }
    });
    return list;
  }, [selectedPontosLabels, pontosGroupedMap]);

  // Selected items flat for totals calculation
  const selectedItemsFlat = useMemo(() => {
    return allPontosListFlat.filter(p => p.selected);
  }, [allPontosListFlat]);

  // 1. Tempo de Atividades em minutos
  const tempoAtividadesMinutos = useMemo(() => {
    return selectedItemsFlat.reduce((acc, p) => acc + (p.tempoEstimadoMinutos || 0), 0);
  }, [selectedItemsFlat]);

  // 2. Tempo TOTAL com Deslocamento + Saída Base + Segurança do dia ativo
  const tempoTotalGeralMinutos = useMemo(() => {
    const desloc = activeDia?.tempoTotalDeslocamentoMin || 0;
    const saida = (activeDia?.id && diasTemposCompMap[activeDia.id]?.tempoSaidaBaseMin !== undefined)
      ? diasTemposCompMap[activeDia.id].tempoSaidaBaseMin!
      : tempoSaidaBasePadrao;
    const seg = (activeDia?.id && diasTemposCompMap[activeDia.id]?.tempoSegurancaMin !== undefined)
      ? diasTemposCompMap[activeDia.id].tempoSegurancaMin!
      : tempoSegurancaPadrao;
    return tempoAtividadesMinutos + Number(desloc) + Number(saida) + Number(seg);
  }, [tempoAtividadesMinutos, activeDia, diasTemposCompMap, tempoSaidaBasePadrao, tempoSegurancaPadrao]);

  const tempoTotalFormatado = useMemo(() => {
    const h = Math.floor(tempoTotalGeralMinutos / 60);
    const m = tempoTotalGeralMinutos % 60;
    return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}min`;
  }, [tempoTotalGeralMinutos]);

  // Valor Total Previsto das Atividades Selecionadas
  const totalValor = useMemo(() => {
    return selectedItemsFlat.reduce((acc, p) => acc + (p.valorEstimado || 0), 0);
  }, [selectedItemsFlat]);

  // % Previsto da Meta da Equipe
  const percentualMeta = useMemo(() => {
    const metaVal = Number(metaEquipeInput) || 0;
    if (metaVal <= 0) return 0;
    return Math.round((totalValor / metaVal) * 1000) / 10;
  }, [totalValor, metaEquipeInput]);

  // Qtd de Postes Programados Hoje nas Atividades Selecionadas
  const postesProgramadosHoje = useMemo(() => {
    return selectedItemsFlat
      .filter(item => (item.servico || '').toUpperCase().includes('POSTE'))
      .reduce((acc, item) => acc + (item.quantidade || 0), 0);
  }, [selectedItemsFlat]);

  // Qtd de Cabos Programados Hoje nas Atividades Selecionadas (em metros)
  const cabosProgramadosHoje = useMemo(() => {
    return selectedItemsFlat
      .filter(item => {
        const s = (item.servico || '').toUpperCase();
        return s.includes('CABO') || s.includes('FIO') || s.includes('CONDUTOR') || s.includes('MULTIPLEX');
      })
      .reduce((acc, item) => acc + (item.quantidade || 0), 0);
  }, [selectedItemsFlat]);

  // Saldo Restante de Postes Disponíveis (Col Y na Carteira)
  const saldoPostesRestantes = useMemo(() => {
    if (!selectedObra) return 0;
    return selectedObra.qtdPostesDisponiveis - postesProgramadosHoje;
  }, [selectedObra, postesProgramadosHoje]);

  // Saldo Restante de Cabos Disponíveis (Col AE na Carteira em metros)
  const saldoCabosRestantes = useMemo(() => {
    if (!selectedObra) return 0;
    return selectedObra.qtdCabosDisponiveis - cabosProgramadosHoje;
  }, [selectedObra, cabosProgramadosHoje]);

  // Compiled string format preview matching Prog_TPM Apps Script macro:
  const compiledPreview = useMemo(() => {
    return selectedItemsFlat.map(p => {
      const h = Math.floor(p.tempoEstimadoMinutos / 60);
      const m = p.tempoEstimadoMinutos % 60;
      const hrStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      const qtdStr = Number.isInteger(p.quantidade) ? String(p.quantidade) : String(p.quantidade);
      return `${p.ponto} - [${p.etapaPrevista}] ${p.servico} - Qtd: ${qtdStr} - Hr. Prev: ${hrStr}`;
    }).join(' | ');
  }, [selectedItemsFlat]);

  // Handle submit single day to Plan_Principal
  const handleEnviarPlanPrincipalDia = async (dia: any) => {
    if (!selectedObra) {
      alert('Por favor, selecione uma Obra da carteira antes de enviar.');
      return;
    }

    const pontosDoDia = dia.pontos || [];
    if (pontosDoDia.length === 0) {
      alert(`Selecione pelo menos um ponto para o dia ${dia.nomeDia} (${dia.dataStr}).`);
      return;
    }

    const itensDoDia: PcpPontoItem[] = [];
    pontosDoDia.forEach((p: string) => {
      if (pontosGroupedMap[p]) {
        itensDoDia.push(...pontosGroupedMap[p]);
      }
    });

    const itensSelecionados = itensDoDia.filter(i => i.selected);
    if (itensSelecionados.length === 0) {
      alert(`Marque pelo menos uma atividade para execução no dia ${dia.nomeDia} (${dia.dataStr}).`);
      return;
    }

    const etapasDoDia = (diasEtapasMap[dia.id] && diasEtapasMap[dia.id].length > 0)
      ? diasEtapasMap[dia.id].join('/')
      : (selectedObra?.etapa || 'IMPLANTAÇÃO');

    const equipesToSend = selectedEquipes.length > 0 ? selectedEquipes : ['EH156'];
    const tempoSaidaBaseDia = diasTemposCompMap[dia.id]?.tempoSaidaBaseMin ?? tempoSaidaBasePadrao;
    const tempoSegurancaDia = diasTemposCompMap[dia.id]?.tempoSegurancaMin ?? tempoSegurancaPadrao;

    for (const eq of equipesToSend) {
      await salvarProgramacao.mutateAsync({
        unidadeId: selectedUnidadeId,
        dataProgramacao: dia.dataCompleta,
        dateObj: dia.dayDate,
        supervisor,
        equipe: eq,
        etapa: etapasDoDia,
        obra: selectedObra,
        pontos: itensDoDia,
        tempoDeslocamentoMinutos: dia.tempoTotalDeslocamentoMin,
        tempoSaidaBaseMinutos: tempoSaidaBaseDia,
        tempoSegurancaMinutos: tempoSegurancaDia,
        metaEquipeValor: metaEquipeInput,
      });
    }
    toast.success(`Programação de ${dia.nomeDia} enviada para ${equipesToSend.length} equipe(s)!`);
  };

  // Handle submit ALL programmed days to Plan_Principal (gera uma linha por equipe por dia)
  const [isSavingAll, setIsSavingAll] = useState(false);
  const handleEnviarTodosOsDias = async () => {
    if (!selectedObra) {
      alert('Por favor, selecione uma Obra da carteira antes de enviar.');
      return;
    }

    const diasComPontos = diasProgramados.filter(d => d.pontos.length > 0);
    if (diasComPontos.length === 0) {
      alert('Nenhum ponto alocado nos dias programados.');
      return;
    }

    const equipesToSend = selectedEquipes.length > 0 ? selectedEquipes : ['EH156'];

    try {
      setIsSavingAll(true);
      for (const d of diasComPontos) {
        const itensDoDia: PcpPontoItem[] = [];
        d.pontos.forEach(p => {
          if (pontosGroupedMap[p]) {
            itensDoDia.push(...pontosGroupedMap[p]);
          }
        });

        if (itensDoDia.length === 0) continue;

        const etapasDoDia = (diasEtapasMap[d.id] && diasEtapasMap[d.id].length > 0)
          ? diasEtapasMap[d.id].join('/')
          : (selectedObra?.etapa || 'IMPLANTAÇÃO');

        const tempoSaidaBaseDia = diasTemposCompMap[d.id]?.tempoSaidaBaseMin ?? tempoSaidaBasePadrao;
        const tempoSegurancaDia = diasTemposCompMap[d.id]?.tempoSegurancaMin ?? tempoSegurancaPadrao;

        for (const eq of equipesToSend) {
          await salvarProgramacao.mutateAsync({
            unidadeId: selectedUnidadeId,
            dataProgramacao: d.dataCompleta,
            dateObj: d.dayDate,
            supervisor,
            equipe: eq,
            etapa: etapasDoDia,
            obra: selectedObra,
            pontos: itensDoDia,
            tempoDeslocamentoMinutos: d.tempoTotalDeslocamentoMin,
            tempoSaidaBaseMinutos: tempoSaidaBaseDia,
            tempoSegurancaMinutos: tempoSegurancaDia,
            metaEquipeValor: metaEquipeInput,
          });
        }
      }
      alert(`Programação de todos os ${diasComPontos.length} dias enviada com sucesso para ${equipesToSend.length} equipe(s) na Plan_Principal!`);
    } catch (e) {
      console.error(e);
      alert('Ocorreu um erro ao salvar todos os dias.');
    } finally {
      setIsSavingAll(false);
    }
  };

  return (
    <div className="flex flex-col gap-3.5 p-3 sm:p-4 w-full max-w-[1750px] mx-auto min-h-screen bg-background" style={{ zoom: zoomLevel } as React.CSSProperties}>
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-xl bg-card border border-border shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-foreground">Módulo PCP — Seção Planejamento</h1>
              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 font-semibold text-[10px] px-1.5 py-0">
                Ambiente Local
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Réplica fiel da planilha <code className="bg-muted px-1 py-0.5 rounded text-foreground font-mono">Prog_TPM</code>: orçamento Ponto-a-Ponto e envio para a <code className="bg-muted px-1 py-0.5 rounded text-foreground font-mono">Plan_Principal</code>
            </p>
          </div>
        </div>

        {/* Controles: Zoom + Atualizar */}
        <div className="flex items-center gap-2.5">
          {/* Zoom Control */}
          <div className="flex items-center gap-1 border border-border rounded-lg px-2 py-0.5">
            <button onClick={() => setZoomLevel(z => Math.max(0.5, z - 0.1))} className="text-muted-foreground hover:text-foreground" title="Diminuir Zoom">
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-bold text-muted-foreground w-9 text-center tabular-nums font-mono">{(zoomLevel * 100).toFixed(0)}%</span>
            <button onClick={() => setZoomLevel(z => Math.min(2.0, z + 0.1))} className="text-muted-foreground hover:text-foreground" title="Aumentar Zoom">
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => rawCacheQuery.refetch()}
            disabled={rawCacheQuery.isFetching}
            title="Atualizar Dados"
            className="h-8 w-8"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${rawCacheQuery.isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* BARRA DE FILTROS SUPERIOR (100% Em uma única linha) */}
      <Card className="border border-border p-2 bg-card shadow-2xs rounded-xl overflow-x-auto">
        <div className="flex items-end gap-1.5 min-w-[1150px] w-full flex-nowrap text-xs">
          {/* Tag Filtros */}
          <div className="flex items-center gap-1 font-bold text-foreground pr-1.5 pb-1 border-r border-border shrink-0 text-[11px]">
            <Filter className="w-3.5 h-3.5 text-primary" />
            <span>Filtros</span>
          </div>

          {/* Unidade */}
          <div className="flex flex-col gap-0.5 w-[140px] shrink-0">
            <span className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider truncate">Unidade</span>
            <Select value={selectedUnidadeId} onValueChange={setSelectedUnidadeId}>
              <SelectTrigger className="h-7 text-[11px] font-semibold bg-background px-2">
                <Building2 className="w-3 h-3 mr-1 text-muted-foreground shrink-0" />
                <SelectValue placeholder="Unidade" />
              </SelectTrigger>
              <SelectContent>
                {UNIDADES_DISPONIVEIS.map(u => (
                  <SelectItem key={u.id} value={u.id} className="text-xs">
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Situação */}
          <div className="flex flex-col gap-0.5 w-[85px] shrink-0">
            <span className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider truncate">Situação</span>
            <Select value={selectedSituacao} onValueChange={setSelectedSituacao}>
              <SelectTrigger className="h-7 text-[11px] font-semibold bg-background px-2">
                <SelectValue placeholder="Situação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="APTA" className="text-xs font-medium text-emerald-600">Aptas</SelectItem>
                <SelectItem value="INAPTA" className="text-xs font-medium text-rose-600">Inaptas</SelectItem>
                <SelectItem value="TODAS" className="text-xs font-medium">Todas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Status da Obra */}
          <div className="flex flex-col gap-0.5 w-[105px] shrink-0">
            <span className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider truncate">Status ({selectedStatuses.length})</span>
            <Popover open={isStatusPopoverOpen} onOpenChange={setIsStatusPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-7 text-[11px] justify-between px-2 font-semibold bg-background">
                  <span className="truncate">
                    {selectedStatuses.length === statusesCarteira.length && statusesCarteira.length > 0
                      ? 'Todos Status'
                      : `${selectedStatuses.length} selec.`}
                  </span>
                  <ChevronDown className="w-3 h-3 opacity-50 shrink-0 ml-0.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[230px] p-3 text-xs" align="start">
                <div className="flex items-center justify-between pb-2 border-b border-border mb-2 font-bold text-xs">
                  <span>Status das Obras</span>
                  <button
                    onClick={() => setSelectedStatuses(statusesCarteira.filter(s => !s.toUpperCase().includes('CONCLU')))}
                    className="text-[10px] text-primary hover:underline"
                  >
                    Sem Concluídas
                  </button>
                </div>

                <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                  {(statusesCarteira.length > 0 ? statusesCarteira : ALL_STATUSES).map(st => {
                    const isChecked = selectedStatuses.includes(st);
                    const isConcluida = st.toUpperCase().includes('CONCLU');
                    return (
                      <div
                        key={st}
                        onClick={() => handleToggleStatus(st)}
                        className="flex items-center gap-2 cursor-pointer hover:bg-accent/40 p-1 rounded"
                      >
                        <Checkbox checked={isChecked} onCheckedChange={() => handleToggleStatus(st)} />
                        <span className={`text-xs ${isConcluida ? 'text-muted-foreground' : 'font-medium text-foreground'}`}>
                          {st}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border mt-2">
                  <button
                    onClick={() => setSelectedStatuses([...(statusesCarteira.length > 0 ? statusesCarteira : ALL_STATUSES)])}
                    className="text-[10px] text-muted-foreground hover:underline"
                  >
                    Marcar Todas
                  </button>
                  <span className="text-[10px] text-muted-foreground">
                    {selectedStatuses.length} de {statusesCarteira.length > 0 ? statusesCarteira.length : ALL_STATUSES.length}
                  </span>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Mês da Carteira */}
          <div className="flex flex-col gap-0.5 w-[125px] shrink-0">
            <span className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider truncate">Mês Carteira</span>
            <Select value={selectedMesFilter} onValueChange={v => {
              setSelectedMesFilter(v);
              setSelectedMunicipioFilter('TODOS');
              setSelectedPrioridadeFilter('TODAS');
              setSelectedDonoFilter('TODOS');
              setSelectedSupervisorFilter('TODOS');
            }}>
              <SelectTrigger className="h-7 text-[11px] font-semibold bg-background truncate font-mono px-2">
                <SelectValue placeholder="Mês" />
              </SelectTrigger>
              <SelectContent className="max-h-[240px]">
                <SelectItem value="TODOS" className="text-xs font-semibold">Todos os Meses ({obras.length})</SelectItem>
                {mesesCarteira.map(m => {
                  const count = obrasCountByMonth.get(m) || 0;
                  return (
                    <SelectItem key={m} value={m} className="text-xs font-mono">
                      {m} ({count})
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Município */}
          <div className="flex flex-col gap-0.5 w-[115px] shrink-0">
            <span className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider truncate">Município</span>
            <Select value={selectedMunicipioFilter} onValueChange={setSelectedMunicipioFilter}>
              <SelectTrigger className="h-7 text-[11px] font-semibold bg-background truncate px-2">
                <SelectValue placeholder="Município" />
              </SelectTrigger>
              <SelectContent className="max-h-[240px]">
                <SelectItem value="TODOS" className="text-xs font-semibold">Todos Municípios</SelectItem>
                {[...new Set(obras.filter(o =>
                  selectedMesFilter === 'TODOS' ||
                  o.meses.some(m => m.trim().toLowerCase() === selectedMesFilter.trim().toLowerCase())
                ).map(o => o.municipio).filter(Boolean))].sort().map(m => (
                  <SelectItem key={m} value={m} className="text-xs">
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Prioridade */}
          <div className="flex flex-col gap-0.5 w-[105px] shrink-0">
            <span className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider truncate">Prioridade</span>
            <Select value={selectedPrioridadeFilter} onValueChange={setSelectedPrioridadeFilter}>
              <SelectTrigger className="h-7 text-[11px] font-semibold bg-background truncate px-2">
                <SelectValue placeholder="Prioridade" />
              </SelectTrigger>
              <SelectContent className="max-h-[240px]">
                <SelectItem value="TODAS" className="text-xs font-semibold">Todas</SelectItem>
                {[...new Set(obras.filter(o => {
                  const matchMes = selectedMesFilter === 'TODOS' ||
                    o.meses.some(m => m.trim().toLowerCase() === selectedMesFilter.trim().toLowerCase());
                  const matchMun = selectedMunicipioFilter === 'TODOS' ||
                    o.municipio.toUpperCase() === selectedMunicipioFilter.toUpperCase();
                  return matchMes && matchMun;
                }).map(o => o.prioridade).filter(Boolean))].sort().map(p => (
                  <SelectItem key={p} value={p} className="text-xs">
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Dono da Obra */}
          <div className="flex flex-col gap-0.5 w-[110px] shrink-0">
            <span className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider truncate">Dono da Obra</span>
            <Select value={selectedDonoFilter} onValueChange={setSelectedDonoFilter}>
              <SelectTrigger className="h-7 text-[11px] font-semibold bg-background truncate px-2">
                <SelectValue placeholder="Dono" />
              </SelectTrigger>
              <SelectContent className="max-h-[240px]">
                <SelectItem value="TODOS" className="text-xs font-semibold">Todos Donos</SelectItem>
                {[...new Set(obras.filter(o => {
                  const matchMes = selectedMesFilter === 'TODOS' ||
                    o.meses.some(m => m.trim().toLowerCase() === selectedMesFilter.trim().toLowerCase());
                  const matchMun = selectedMunicipioFilter === 'TODOS' ||
                    o.municipio.toUpperCase() === selectedMunicipioFilter.toUpperCase();
                  return matchMes && matchMun;
                }).map(o => o.donoDaObra).filter(d => d && d !== 'NÃO INFORMADO'))].sort().map(d => (
                  <SelectItem key={d} value={d} className="text-xs">
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Supervisor */}
          <div className="flex flex-col gap-0.5 w-[110px] shrink-0">
            <span className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider truncate">Supervisor</span>
            <Select value={selectedSupervisorFilter} onValueChange={setSelectedSupervisorFilter}>
              <SelectTrigger className="h-7 text-[11px] font-semibold bg-background truncate px-2">
                <SelectValue placeholder="Supervisor" />
              </SelectTrigger>
              <SelectContent className="max-h-[240px]">
                <SelectItem value="TODOS" className="text-xs font-semibold">Todos Supervisores</SelectItem>
                {[...new Set(obras.filter(o => {
                  const matchMes = selectedMesFilter === 'TODOS' ||
                    o.meses.some(m => m.trim().toLowerCase() === selectedMesFilter.trim().toLowerCase());
                  const matchMun = selectedMunicipioFilter === 'TODOS' ||
                    o.municipio.toUpperCase() === selectedMunicipioFilter.toUpperCase();
                  return matchMes && matchMun;
                }).map(o => o.supervisor).filter(Boolean))].sort().map(s => (
                  <SelectItem key={s} value={s} className="text-xs">
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Busca por Obra */}
          <div className="flex flex-col gap-0.5 flex-1 min-w-[140px]">
            <span className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wider truncate">Pesquisar Obra</span>
            <div className="relative">
              <Search className="w-3 h-3 absolute left-2 top-2 text-muted-foreground" />
              <Input
                placeholder="B-XXXXX, título..."
                value={searchObra}
                onChange={e => setSearchObra(e.target.value)}
                className="pl-7 h-7 text-[11px] bg-background"
              />
            </div>
          </div>

          {/* Botão Limpar Filtros */}
          <div className="flex flex-col justify-end shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearFilters}
              className="h-7 text-[10px] px-2 font-semibold text-muted-foreground hover:text-foreground shrink-0"
              title="Limpar todos os filtros da carteira"
            >
              <Filter className="w-3 h-3 mr-1" /> Limpar
            </Button>
          </div>
        </div>
      </Card>

      {/* Main Grid: Parameters & Obra Selector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
        {/* Left Column: Carteira de Obras (NO TOPO), Parametros & Tempos (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col gap-3.5">
          {/* 1. Card Seletor de Obras da Carteira (AGORA NO TOPO DA COLUNA ESQUERDA) */}
          <Card className="border border-border flex flex-col">
            <CardHeader className="pb-3 space-y-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Layers className="w-4 h-4 text-primary" />
                  Carteira de Obras ({filteredObras.length})
                </CardTitle>
                {selectedObra && (
                  <Badge variant="secondary" className="font-mono text-xs">
                    {selectedObra.projeto}
                  </Badge>
                )}
              </div>

              {/* Input de Busca Integrado na Lista de Obras */}
              <div className="relative pt-1">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar obra na lista..."
                  value={searchObra}
                  onChange={e => setSearchObra(e.target.value)}
                  className="pl-8 h-8 text-xs bg-background"
                />
              </div>
            </CardHeader>

            {/* Lista com pega drag-to-resize — barra de scroll sempre visível */}
            <CardContent className="p-0">
              <div
                className="overflow-y-scroll space-y-2.5 px-4 pb-4 pt-1
                  [&::-webkit-scrollbar]:w-2
                  [&::-webkit-scrollbar-track]:bg-muted/30
                  [&::-webkit-scrollbar-track]:rounded-full
                  [&::-webkit-scrollbar-thumb]:bg-border
                  [&::-webkit-scrollbar-thumb]:rounded-full
                  [&::-webkit-scrollbar-thumb:hover]:bg-muted-foreground/40"
                style={{ height: obrasListHeight }}
              >
              {rawCacheQuery.isLoading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground text-xs gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Carregando Carteira_Planejador...
                </div>
              ) : filteredObras.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-xs">
                  Nenhuma obra encontrada para os filtros selecionados.
                </div>
              ) : (
                filteredObras.map(o => {
                  const isSelected = selectedObra?.projeto === o.projeto;
                  const isConcluida = (o.statusExecucao || '').toUpperCase().includes('CONCLUÍDA');

                  return (
                    <div
                      key={o.projeto}
                      onClick={() => handleSelectObra(o)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col gap-2 ${
                        isSelected
                          ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/40'
                          : 'border-border/60 bg-card hover:bg-accent/40'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-bold text-xs text-foreground flex items-center gap-1.5">
                          {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-primary" />}
                          {o.projeto}
                        </span>

                        <div className="flex items-center gap-1.5">
                          {o.qtdPostesDisponiveis > 0 && (
                            <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-600 border-blue-500/20 font-mono px-1.5 py-0 font-bold flex items-center gap-1">
                              <UtilityPole className="w-3 h-3 text-blue-600 shrink-0" />
                              <span>{o.qtdPostesDisponiveis} post.</span>
                            </Badge>
                          )}
                          {o.qtdCabosDisponiveis > 0 && (
                            <Badge variant="outline" className="text-[10px] bg-purple-500/10 text-purple-600 border-purple-500/20 font-mono px-1.5 py-0 font-bold">
                              🔌 {o.qtdCabosDisponiveis}m cab.
                            </Badge>
                          )}
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 h-4 font-medium ${
                              isConcluida
                                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                            }`}
                          >
                            {o.statusExecucao || 'EM ANDAMENTO'}
                          </Badge>
                        </div>
                      </div>

                      <p className="text-xs font-medium text-muted-foreground line-clamp-1">
                        {o.nomeProjeto || 'Sem descrição'}
                      </p>

                      <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1.5 border-t border-border/40">
                        <span className="font-semibold text-foreground/80">{o.municipio || 'N/I'}</span>
                        <span className="truncate max-w-[140px] text-primary font-medium">
                          {o.donoDaObra ? `Dono: ${o.donoDaObra}` : ''}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
              </div>

              {/* Handle de redimensionamento (drag) — borda inferior do card */}
              <div
                onMouseDown={handleResizeMouseDown}
                className="flex items-center justify-center h-3 w-full cursor-ns-resize group border-t border-border/60 hover:border-primary/40 transition-colors"
                title="Arraste para redimensionar a lista"
              >
                {/* Grip dots */}
                <div className="flex gap-0.5 items-center opacity-40 group-hover:opacity-80 transition-opacity">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="w-0.5 h-0.5 rounded-full bg-muted-foreground" />
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2. CARD ANÁLISE DE RISCO — VISTORIA */}
          {selectedObra && (
            <Card className="border border-border shadow-xs">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-primary" />
                    Análise de Risco — Vistoria
                  </CardTitle>
                  {loadingRisk && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <div className="flex items-start justify-between gap-2 border-b border-border/40 pb-2">
                  <div>
                    <p className="font-mono font-bold text-primary text-sm">{selectedObra.projeto}</p>
                    <p className="text-xs text-muted-foreground">{selectedObra.nomeProjeto}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3 text-muted-foreground" /> {selectedObra.municipio}
                    </p>
                  </div>

                  {/* Badge de Risco com Cores conforme orientação */}
                  {riskForObra && (
                    <Badge
                      variant="outline"
                      className={`text-xs px-2.5 py-1 font-bold font-mono shrink-0 flex items-center gap-1.5 ${
                        riskForObra.classificacao === 'Vermelho'
                          ? 'bg-rose-500/15 text-rose-600 border-rose-500/40 dark:text-rose-400'
                          : riskForObra.classificacao === 'Laranja'
                          ? 'bg-amber-500/15 text-amber-600 border-amber-500/40 dark:text-amber-400'
                          : 'bg-emerald-500/15 text-emerald-600 border-emerald-500/40 dark:text-emerald-400'
                      }`}
                    >
                      {riskForObra.classificacao === 'Vermelho' ? (
                        <AlertTriangle className="w-3.5 h-3.5" />
                      ) : riskForObra.classificacao === 'Laranja' ? (
                        <ShieldAlert className="w-3.5 h-3.5" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                      Risco {riskForObra.classificacao}
                    </Badge>
                  )}
                </div>

                {/* Resumo das Observações pela IA */}
                {!riskForObra && !loadingRisk ? (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground py-1">
                    Análise pendente ou sem dados de vistoria.
                  </div>
                ) : riskForObra?.classificacao === 'Verde' ? (
                  <div className="p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-xs flex flex-col gap-1.5">
                    <div className="flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>Sem alertas de risco ou impedimento</span>
                    </div>
                    <p className="text-muted-foreground text-[11px] leading-relaxed pl-5">
                      {riskForObra.alerta || 'Obra liberada e com fácil acesso para execução.'}
                    </p>
                  </div>
                ) : riskForObra ? (
                  <div className={`p-3 rounded-xl border text-xs flex flex-col gap-2.5 ${
                    riskForObra.classificacao === 'Vermelho'
                      ? 'bg-rose-500/5 border-rose-500/30'
                      : 'bg-amber-500/5 border-amber-500/30'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-xs">
                        {riskForObra.classificacao === 'Vermelho' ? (
                          <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1">
                            <AlertTriangle className="w-4 h-4" /> Alertas Críticos de Segurança
                          </span>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                            <ShieldAlert className="w-4 h-4" /> Pontos Específicos da Vistoria
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Resumo Específico em Tópicos Categorizados com Ícones */}
                    {riskForObra.pontosDetalhados && riskForObra.pontosDetalhados.length > 0 ? (
                      <div className="space-y-2 text-[11px]">
                        {riskForObra.pontosDetalhados.map((item, pIdx) => (
                          <div
                            key={pIdx}
                            className={`flex items-start gap-2 p-2 rounded-lg border leading-snug transition-all ${
                              item.isCritico
                                ? 'bg-red-800 dark:bg-red-950 border-red-950 text-white shadow-md ring-1 ring-red-600/50'
                                : 'bg-background/80 border-border/60 text-foreground'
                            }`}
                          >
                            <span className="text-sm shrink-0 mt-0.5">{item.icone}</span>
                            <div className="flex-1">
                              <span className={`mr-1.5 text-[10px] uppercase tracking-wider ${
                                item.isCritico ? 'font-black text-red-200' : 'font-semibold text-muted-foreground'
                              }`}>
                                [{item.categoria}]
                              </span>
                              <span className={item.isCritico ? 'text-white font-bold' : 'text-foreground/90 font-medium'}>
                                {item.texto}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : riskForObra.pontosEspecificos && riskForObra.pontosEspecificos.length > 0 ? (
                      <ul className="space-y-1.5 text-[11px] text-foreground/90 pl-1">
                        {riskForObra.pontosEspecificos.map((pt, pIdx) => (
                          <li key={pIdx} className="flex items-start gap-1.5 leading-snug">
                            <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 bg-primary" />
                            <span>{pt}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[11px] text-muted-foreground leading-snug">
                        {riskForObra.alerta}
                      </p>
                    )}

                    {/* Observação Original Completa retrátil */}
                    {riskForObra.observacoesOriginais && (
                      <details className="mt-1 text-[10px] text-muted-foreground border-t border-border/40 pt-1.5 cursor-pointer">
                        <summary className="font-semibold text-primary/80 hover:text-primary transition-colors">
                          Ver anotação completa de campo da vistoria
                        </summary>
                        <p className="mt-1 p-2 rounded bg-muted/40 text-foreground font-mono text-[10px] leading-relaxed select-text">
                          {riskForObra.observacoesOriginais}
                        </p>
                      </details>
                    )}
                  </div>
                ) : null}

                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div className="bg-muted/40 rounded-lg p-2 text-center">
                    <div className="font-bold text-foreground text-base">{allPontosListFlat.length || '—'}</div>
                    <div className="text-muted-foreground text-[10px]">Atividades Previstas</div>
                  </div>
                  <div className="bg-muted/40 rounded-lg p-2 text-center">
                    <div className="font-bold text-foreground text-base">
                      {selectedPontosLabels.length || '—'}
                    </div>
                    <div className="text-muted-foreground text-[10px]">Pontos Selecionados</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 3. Card Parâmetros Principais & Período de Programação */}
          <Card className="border border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-primary" />
                Período da Programação da Obra
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              {/* Calendários Date Range: Data Início e Data Fim */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-foreground">Intervalo de Datas Previsto</Label>
                  <Badge variant="outline" className="text-[10px] font-mono bg-primary/10 text-primary border-primary/30">
                    {diasProgramados.length} dia(s) programado(s)
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {/* Data Início */}
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-muted-foreground font-semibold">Data Início:</span>
                    <Popover open={isDataInicioOpen} onOpenChange={setIsDataInicioOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="h-8 text-xs font-mono font-semibold justify-start">
                          <CalendarIcon className="mr-1.5 h-3.5 w-3.5 text-primary" />
                          {safeFormatDate(dataInicio, 'dd/MM/yyyy')}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={safeParseDate(dataInicio)}
                          onSelect={d => {
                            if (d) {
                              const s = safeFormatDate(d, 'yyyy-MM-dd');
                              setDataInicio(s);
                              const end = s > dataFim ? s : dataFim;
                              if (s > dataFim) setDataFim(s);
                              try {
                                const days = eachDayOfInterval({ start: d, end: safeParseDate(end) });
                                setDatasProgramadas(days.map(item => safeFormatDate(item, 'yyyy-MM-dd')));
                              } catch {
                                setDatasProgramadas([s]);
                              }
                              setIsDataInicioOpen(false);
                            }
                          }}
                          locale={ptBR}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Data Fim */}
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-muted-foreground font-semibold">Data Fim:</span>
                    <Popover open={isDataFimOpen} onOpenChange={setIsDataFimOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="h-8 text-xs font-mono font-semibold justify-start">
                          <CalendarIcon className="mr-1.5 h-3.5 w-3.5 text-primary" />
                          {safeFormatDate(dataFim, 'dd/MM/yyyy')}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={safeParseDate(dataFim)}
                          onSelect={d => {
                            if (d) {
                              const s = safeFormatDate(d, 'yyyy-MM-dd');
                              setDataFim(s);
                              const start = s < dataInicio ? s : dataInicio;
                              if (s < dataInicio) setDataInicio(s);
                              try {
                                const days = eachDayOfInterval({ start: safeParseDate(start), end: d });
                                setDatasProgramadas(days.map(item => safeFormatDate(item, 'yyyy-MM-dd')));
                              } catch {
                                setDatasProgramadas([s]);
                              }
                              setIsDataFimOpen(false);
                            }
                          }}
                          locale={ptBR}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>

              {/* Dropdown de Supervisor e Equipes */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/60">
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Supervisor</Label>
                  <Select value={supervisor} onValueChange={setSupervisor}>
                    <SelectTrigger className="h-8 text-xs font-mono font-semibold">
                      <SelectValue placeholder="Supervisor" />
                    </SelectTrigger>
                    <SelectContent>
                      {supervisoresDisponiveis.map(sup => (
                        <SelectItem key={sup} value={sup} className="text-xs font-mono">
                          {sup}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1">
                  <Label className="text-xs flex items-center justify-between">
                    <span>Equipes</span>
                    <span className="text-[10px] text-muted-foreground">
                      {selectedEquipes.length > 0 ? `${selectedEquipes.length} sel.` : `(${equipesDisponiveis.length})`}
                    </span>
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="h-8 text-xs font-mono font-semibold justify-between px-2.5 bg-background truncate shadow-2xs"
                        title={selectedEquipes.join(', ')}
                      >
                        <span className="truncate">
                          {selectedEquipes.length === 0
                            ? 'Selecione a(s) equipe(s)...'
                            : selectedEquipes.length === 1
                            ? selectedEquipes[0]
                            : `${selectedEquipes[0]} +${selectedEquipes.length - 1} (${selectedEquipes.length})`}
                        </span>
                        <ChevronDown className="w-3 h-3 opacity-50 ml-1 shrink-0" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[220px] p-2" align="start">
                      <div className="flex items-center justify-between pb-1.5 border-b border-border mb-1.5 text-xs font-bold">
                        <span>Equipes</span>
                        <div className="flex items-center gap-2 text-[10px]">
                          <button
                            onClick={() => setSelectedEquipes([])}
                            className="text-muted-foreground hover:underline"
                          >
                            Limpar
                          </button>
                          <button
                            onClick={() => setSelectedEquipes([...equipesDisponiveis])}
                            className="text-primary hover:underline font-bold"
                          >
                            Todas
                          </button>
                        </div>
                      </div>
                      <div className="space-y-1 max-h-[220px] overflow-y-auto pr-1">
                        {equipesDisponiveis.map(eq => {
                          const isChecked = selectedEquipes.includes(eq);
                          return (
                            <div
                              key={eq}
                              onClick={() => handleToggleEquipe(eq)}
                              className="flex items-center gap-2 cursor-pointer hover:bg-accent/40 p-1.5 rounded text-xs"
                            >
                              <Checkbox checked={isChecked} onCheckedChange={() => handleToggleEquipe(eq)} />
                              <span className="font-mono font-medium">{eq}</span>
                            </div>
                          );
                        })}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 4. CARD DE TEMPOS COMPLEMENTARES E META DA EQUIPE */}
          <Card className="border border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  Tempos Complementares & Meta da Equipe
                </span>
                <Badge variant="secondary" className="font-mono text-[11px] bg-primary/10 text-primary">
                  {selectedEquipes.length > 0 ? selectedEquipes.join(', ') : 'EH156'}
                </Badge>
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-4 text-xs">
              {/* SELEÇÃO DE ALOJAMENTO / BASE DA UNIDADE & CRONOGRAMA SEMANAL */}
              <div className="p-3 rounded-xl bg-card border border-border flex flex-col gap-3 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-border/60">
                  <div>
                    <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Home className="w-4 h-4 text-primary" /> Alojamento / Base da Unidade
                    </Label>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Unidade: <strong className="text-foreground">{unidadeAtivaInfo.nome}</strong> • {alojamentosDaUnidade.length} alojamento(s) cadastrado(s)
                    </p>
                  </div>

                  <Select value={selectedAlojamentoPadraoId} onValueChange={handleAlojamentoPadraoChange}>
                    <SelectTrigger className="h-8 text-xs font-semibold bg-background min-w-[200px]">
                      <SelectValue placeholder="Selecione Base ou Alojamento" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BASE" className="text-xs font-semibold">
                        🏢 {unidadeAtivaInfo.baseNome} (Padrão)
                      </SelectItem>
                      {alojamentosDaUnidade.map(a => (
                        <SelectItem key={a.id} value={a.id} className="text-xs">
                          🏠 {a.nome} (Cap: {a.capacidade}p)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* FATOR DE ACRÉSCIMO */}
                <div className="p-2 rounded-lg bg-amber-500/5 border border-amber-500/20 flex flex-col gap-1.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold text-foreground flex items-center gap-1 whitespace-nowrap">
                        🚚 Fator Acréscimo:
                      </span>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        (+{acrescimoVeiculoPct}% sobre estradas)
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center gap-0.5">
                        <Input
                          type="number"
                          step="5"
                          min="0"
                          max="200"
                          value={acrescimoVeiculoPct}
                          onChange={e => setAcrescimoVeiculoPct(Math.max(0, parseInt(e.target.value) || 0))}
                          className="h-6 w-14 text-center font-mono font-bold text-xs bg-background py-0 px-1"
                        />
                        <span className="text-[11px] font-bold text-muted-foreground">%</span>
                      </div>

                      {/* Botões Rápidos */}
                      <div className="flex items-center gap-1">
                        {[0, 20, 30, 50].map(pct => (
                          <Button
                            key={pct}
                            size="sm"
                            type="button"
                            variant={acrescimoVeiculoPct === pct ? 'default' : 'outline'}
                            onClick={() => setAcrescimoVeiculoPct(pct)}
                            className="h-5 text-[9.5px] px-1 font-mono font-semibold"
                          >
                            +{pct}%
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <p className="text-[9.5px] text-muted-foreground italic leading-tight">
                    Calcula a distância por estradas (1.25x) com velocidade de caminhão (+{acrescimoVeiculoPct}%). Ajuste as horas exatas na tabela abaixo se desejar.
                  </p>
                </div>

                {/* Banner de Tempos do Dia Ativo da Programação (Ida + Volta) */}
                <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/20 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                      <Navigation className="w-3.5 h-3.5" /> Deslocamento Previsto ({activeDia?.nomeDia} - {activeDia?.dataStr}):
                    </span>
                    <Badge variant="outline" className="text-xs font-mono font-bold bg-background text-primary border-primary/30">
                      Total: {formatMinToHours(activeDia?.tempoTotalDeslocamentoMin || 30)}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="p-2 rounded bg-background/80 border border-border/50 flex flex-col">
                      <span className="text-muted-foreground text-[10px] uppercase font-bold flex items-center justify-between">
                        <span>🛫 Tempo de Ida (Partida ➔ Obra)</span>
                        {activeDia?.isManualIda && <Badge variant="secondary" className="text-[8px] h-3.5 px-1 py-0 bg-amber-500/10 text-amber-600 border border-amber-500/20">Manual</Badge>}
                      </span>
                      <span className="font-bold text-foreground mt-0.5 truncate" title={activeDia?.origemNome}>
                        {activeDia?.origemNome}
                      </span>
                      <span className="font-mono text-primary font-bold text-xs mt-0.5">
                        {formatMinToHours(activeDia?.tempoIdaMin || 15)} {activeDia && activeDia.distIdaKm > 0 ? `(${activeDia.distIdaKm} km)` : ''}
                      </span>
                    </div>

                    <div className="p-2 rounded bg-background/80 border border-border/50 flex flex-col">
                      <span className="text-muted-foreground text-[10px] uppercase font-bold flex items-center justify-between">
                        <span>🛬 Tempo de Volta (Obra ➔ Retorno)</span>
                        {activeDia?.isManualVolta && <Badge variant="secondary" className="text-[8px] h-3.5 px-1 py-0 bg-amber-500/10 text-amber-600 border border-amber-500/20">Manual</Badge>}
                      </span>
                      <span className="font-bold text-foreground mt-0.5 truncate" title={activeDia?.destinoNome}>
                        {activeDia?.destinoNome}
                      </span>
                      <span className="font-mono text-primary font-bold text-xs mt-0.5">
                        {formatMinToHours(activeDia?.tempoVoltaMin || 15)} {activeDia && activeDia.distVoltaKm > 0 ? `(${activeDia.distVoltaKm} km)` : ''}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Grade dos Dias Programados de Alojamento e Deslocamento */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      Cronograma dos Dias Programados ({diasProgramados.length} dias)
                    </span>
                    <span className="text-[10px] text-muted-foreground font-medium">
                      *1º dia sai da Base, último dia retorna à Base (tempos ajustáveis)
                    </span>
                  </div>

                  <div className="rounded-lg border border-border overflow-hidden bg-background">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40 text-[10px] font-bold">
                          <TableHead className="py-1 px-2 w-[95px]">Dia</TableHead>
                          <TableHead className="py-1 px-1.5">Saída (Ida)</TableHead>
                          <TableHead className="py-1 px-1.5">Retorno (Volta)</TableHead>
                          <TableHead className="py-1 px-1.5 text-center w-[85px]">Desloc. (h)</TableHead>
                          <TableHead className="py-1 px-1 text-center w-[75px]">Saída Base</TableHead>
                          <TableHead className="py-1 px-1 text-center w-[75px]">Segurança</TableHead>
                          <TableHead className="py-1 px-2 text-right w-[95px]">Total Comp.</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {diasProgramados.map(d => {
                          const tempoSaidaBaseDia = diasTemposCompMap[d.id]?.tempoSaidaBaseMin ?? tempoSaidaBasePadrao;
                          const tempoSegurancaDia = diasTemposCompMap[d.id]?.tempoSegurancaMin ?? tempoSegurancaPadrao;
                          const tempoCompTotalDia = d.tempoTotalDeslocamentoMin + tempoSaidaBaseDia + tempoSegurancaDia;
                          const deslocHoras = d.tempoTotalDeslocamentoMin / 60;
                          const excedeMetaDesloc = deslocHoras > metaDeslocamentoDiarioHoras;

                          return (
                            <TableRow
                              key={d.id}
                              onClick={() => setActiveDayId(d.id)}
                              className={cn(
                                "text-[11px] cursor-pointer transition-colors",
                                d.id === activeDia?.id
                                  ? "bg-primary/10 font-semibold border-l-2 border-l-primary" 
                                  : "hover:bg-accent/40"
                              )}
                            >
                              <TableCell className="py-1 px-2 font-mono">
                                <div className="flex items-center gap-1">
                                  <span>{d.nomeDia.slice(0, 3)} ({d.dataStr})</span>
                                  {d.id === activeDia?.id && (
                                    <Badge className="text-[8px] px-1 py-0 h-3.5 bg-primary text-primary-foreground font-bold">
                                      Ativo
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>

                              {/* Saída (Ida) com Select + Distância + Input Horas Editável */}
                              <TableCell className="py-1 px-1.5" onClick={e => e.stopPropagation()}>
                                <div className="flex flex-col gap-0.5">
                                  <select
                                    value={d.origemId}
                                    onChange={e => handleUpdateDiaAlojamento(d.id, 'origemId', e.target.value)}
                                    className="h-6 text-[10px] bg-background border border-border rounded px-1 w-full font-medium"
                                  >
                                    <option value="BASE">🏢 {unidadeAtivaInfo.baseNome}</option>
                                    {alojamentosDaUnidade.map(a => (
                                      <option key={a.id} value={a.id}>🏠 {a.nome}</option>
                                    ))}
                                  </select>
                                  <div className="flex items-center justify-between gap-1 text-[10px] text-muted-foreground font-mono">
                                    <span title="Distância estimada">{d.distIdaKm > 0 ? `${d.distIdaKm} km` : '0 km'}</span>
                                    <div className="flex items-center gap-0.5">
                                      <Input
                                        type="number"
                                        step="0.05"
                                        min="0"
                                        value={Math.round((d.tempoIdaMin / 60) * 100) / 100}
                                        onChange={e => {
                                          const h = parseFloat(e.target.value) || 0;
                                          handleUpdateDiaTempo(d.id, 'manualTempoIdaMin', Math.round(h * 60));
                                        }}
                                        className="h-5 w-12 text-[10px] text-right font-mono font-bold px-1 py-0 bg-background"
                                        title="Tempo de ida (h)"
                                      />
                                      <span className="text-[9px] font-bold">h</span>
                                    </div>
                                  </div>
                                </div>
                              </TableCell>

                              {/* Retorno (Volta) com Select + Distância + Input Horas Editável */}
                              <TableCell className="py-1 px-1.5" onClick={e => e.stopPropagation()}>
                                <div className="flex flex-col gap-0.5">
                                  <select
                                    value={d.destinoId}
                                    onChange={e => handleUpdateDiaAlojamento(d.id, 'destinoId', e.target.value)}
                                    className="h-6 text-[10px] bg-background border border-border rounded px-1 w-full font-medium"
                                  >
                                    <option value="BASE">🏢 {unidadeAtivaInfo.baseNome}</option>
                                    {alojamentosDaUnidade.map(a => (
                                      <option key={a.id} value={a.id}>🏠 {a.nome}</option>
                                    ))}
                                  </select>
                                  <div className="flex items-center justify-between gap-1 text-[10px] text-muted-foreground font-mono">
                                    <span title="Distância estimada">{d.distVoltaKm > 0 ? `${d.distVoltaKm} km` : '0 km'}</span>
                                    <div className="flex items-center gap-0.5">
                                      <Input
                                        type="number"
                                        step="0.05"
                                        min="0"
                                        value={Math.round((d.tempoVoltaMin / 60) * 100) / 100}
                                        onChange={e => {
                                          const h = parseFloat(e.target.value) || 0;
                                          handleUpdateDiaTempo(d.id, 'manualTempoVoltaMin', Math.round(h * 60));
                                        }}
                                        className="h-5 w-12 text-[10px] text-right font-mono font-bold px-1 py-0 bg-background"
                                        title="Tempo de volta (h)"
                                      />
                                      <span className="text-[9px] font-bold">h</span>
                                    </div>
                                  </div>
                                </div>
                              </TableCell>

                              {/* Deslocamento do Dia com Indicador de Meta */}
                              <TableCell className="py-1 px-1.5 text-center font-mono font-bold whitespace-nowrap text-[10px]">
                                <span className={excedeMetaDesloc ? "text-amber-600 dark:text-amber-400" : "text-foreground"}>
                                  {formatHoursDecimal(d.tempoTotalDeslocamentoMin)}
                                </span>
                                {excedeMetaDesloc && (
                                  <span className="block text-[8px] text-amber-600 font-semibold" title={`Excede meta de ${metaDeslocamentoDiarioHoras}h`}>
                                    &gt;{metaDeslocamentoDiarioHoras}h meta
                                  </span>
                                )}
                              </TableCell>

                              {/* Saída Base do Dia */}
                              <TableCell className="py-1 px-1 text-center" onClick={e => e.stopPropagation()}>
                                <div className="flex items-center justify-center gap-0.5">
                                  <Input
                                    type="number"
                                    min="0"
                                    value={tempoSaidaBaseDia}
                                    onChange={e => handleUpdateDiaTempoComp(d.id, 'tempoSaidaBaseMin', parseInt(e.target.value, 10) || 0)}
                                    className="h-5 w-11 text-[10px] text-right font-mono font-bold px-1 py-0 bg-background"
                                    title="Tempo de saída da base neste dia (minutos)"
                                  />
                                  <span className="text-[8px] text-muted-foreground">m</span>
                                </div>
                              </TableCell>

                              {/* Segurança do Dia */}
                              <TableCell className="py-1 px-1 text-center" onClick={e => e.stopPropagation()}>
                                <div className="flex items-center justify-center gap-0.5">
                                  <Input
                                    type="number"
                                    min="0"
                                    value={tempoSegurancaDia}
                                    onChange={e => handleUpdateDiaTempoComp(d.id, 'tempoSegurancaMin', parseInt(e.target.value, 10) || 0)}
                                    className="h-5 w-11 text-[10px] text-right font-mono font-bold px-1 py-0 bg-background"
                                    title="Tempo de segurança / DDS neste dia (minutos)"
                                  />
                                  <span className="text-[8px] text-muted-foreground">m</span>
                                </div>
                              </TableCell>

                              {/* Total Complementares */}
                              <TableCell className="py-1 px-2 text-right font-mono font-bold text-primary whitespace-nowrap text-[10px]">
                                {formatHoursDecimal(tempoCompTotalDia)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>

              {/* Grid Campos de Metas e Tempos Complementares Padrão */}
              <div className="grid grid-cols-3 gap-3">
                {/* Meta de Deslocamento Diário em HORAS */}
                <div className="flex flex-col gap-1">
                  <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Navigation className="w-3 h-3 text-blue-500" /> Meta Deslocamento / Dia
                  </Label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      value={metaDeslocamentoDiarioHoras}
                      onChange={e => setMetaDeslocamentoDiarioHoras(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="h-8 text-xs font-mono font-bold pr-7"
                    />
                    <span className="absolute right-2 top-2 text-[10px] text-muted-foreground font-mono">h</span>
                  </div>
                  <span className="text-[9px] text-muted-foreground font-mono">
                    Meta máxima p/ indicadores
                  </span>
                </div>

                {/* Padrão Saída da Base */}
                <div className="flex flex-col gap-1">
                  <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <LogOut className="w-3 h-3 text-amber-500" /> Saída Base (Padrão)
                  </Label>
                  <div className="relative">
                    <Input
                      type="number"
                      min="0"
                      value={tempoSaidaBasePadrao}
                      onChange={e => handleChangeSaidaBasePadrao(parseInt(e.target.value, 10) || 0)}
                      className="h-8 text-xs font-mono font-bold pr-8"
                    />
                    <span className="absolute right-2 top-2 text-[10px] text-muted-foreground font-mono">min</span>
                  </div>
                  <span className="text-[9px] text-muted-foreground font-mono">
                    {formatHoursDecimal(tempoSaidaBasePadrao)} (Replicado nos dias)
                  </span>
                </div>

                {/* Padrão Segurança */}
                <div className="flex flex-col gap-1">
                  <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-500" /> Segurança (Padrão)
                  </Label>
                  <div className="relative">
                    <Input
                      type="number"
                      min="0"
                      value={tempoSegurancaPadrao}
                      onChange={e => handleChangeSegurancaPadrao(parseInt(e.target.value, 10) || 0)}
                      className="h-8 text-xs font-mono font-bold pr-8"
                    />
                    <span className="absolute right-2 top-2 text-[10px] text-muted-foreground font-mono">min</span>
                  </div>
                  <span className="text-[9px] text-muted-foreground font-mono">
                    {formatHoursDecimal(tempoSegurancaPadrao)} (Replicado nos dias)
                  </span>
                </div>
              </div>

              {/* Banner Resumo da Soma dos Tempos do Dia Ativo */}
              <div className="p-3 rounded-xl bg-muted/40 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-muted-foreground text-xs font-mono">
                  Dia Ativo ({activeDia?.nomeDia} {activeDia?.dataStr}): <strong>{Math.floor(tempoAtividadesMinutos / 60)}h {tempoAtividadesMinutos % 60}m</strong> (ativid.) + <strong>{(activeDia?.tempoTotalDeslocamentoMin || 0) + (diasTemposCompMap[activeDia?.id]?.tempoSaidaBaseMin ?? tempoSaidaBasePadrao) + (diasTemposCompMap[activeDia?.id]?.tempoSegurancaMin ?? tempoSegurancaPadrao)}m</strong> (comp.)
                </span>
                <span className="font-mono font-bold text-sm text-primary">
                  = {formatMinToHours(tempoAtividadesMinutos + (activeDia?.tempoTotalDeslocamentoMin || 0) + (diasTemposCompMap[activeDia?.id]?.tempoSaidaBaseMin ?? tempoSaidaBasePadrao) + (diasTemposCompMap[activeDia?.id]?.tempoSegurancaMin ?? tempoSegurancaPadrao))}
                </span>
              </div>

              {/* META DA EQUIPE & % PREVISTO DA META */}
              <div className="pt-2 border-t border-border/80 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Target className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    Valor da Meta da(s) Equipe(s) {selectedEquipes.length > 0 ? selectedEquipes.join(', ') : 'EH156'} (R$):
                  </Label>

                  {/* Input de Valor da Meta */}
                  <div className="relative w-[150px]">
                    <span className="absolute left-2.5 top-2 text-xs font-mono text-muted-foreground">R$</span>
                    <Input
                      type="number"
                      step="10"
                      min="0"
                      value={metaEquipeInput}
                      onChange={e => setMetaEquipeInput(Math.max(0, Number(e.target.value) || 0))}
                      className="h-8 text-xs text-right font-mono font-bold pl-8 pr-2"
                    />
                  </div>
                </div>

                {/* Progress & Badge de % Previsto da Meta */}
                <div className="p-3 rounded-xl bg-card border border-border flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <TrendingUp className="w-3.5 h-3.5 text-primary" /> % Previsto da Meta:
                    </span>

                    <div className="flex items-center gap-2">
                      <span className="font-mono font-extrabold text-sm text-foreground">
                        {percentualMeta}%
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-2 py-0.5 font-mono font-bold ${
                          percentualMeta >= 100
                            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                            : percentualMeta >= 75
                            ? 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                            : 'bg-rose-500/10 text-rose-600 border-rose-500/30'
                        }`}
                      >
                        {percentualMeta >= 100 ? 'META ATINGIDA' : percentualMeta >= 75 ? 'NA META' : 'ABAIXO DA META'}
                      </Badge>
                    </div>
                  </div>

                  <Progress
                    value={Math.min(100, percentualMeta)}
                    className={`h-2 ${
                      percentualMeta >= 100
                        ? '[&>div]:bg-emerald-500'
                        : percentualMeta >= 75
                        ? '[&>div]:bg-amber-500'
                        : '[&>div]:bg-rose-500'
                    }`}
                  />

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                    <span>Programado: <strong>R$ {totalValor.toFixed(2)}</strong></span>
                    <span>Meta: <strong>R$ {metaEquipeInput.toFixed(2)}</strong></span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 5. CARD RESUMO DOS DIAS DA PROGRAMAÇÃO COM METAS */}
          <Card className="border border-border shadow-xs">
            <CardHeader className="py-2 px-3">
              <CardTitle className="text-xs font-semibold flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <CalendarIcon className="w-3.5 h-3.5 text-primary" /> Resumo do Período ({diasProgramados.length} dias — {selectedEquipes.length > 0 ? selectedEquipes.join(', ') : 'EH156'})
                </span>
                {tempoTotalGeralMinutos > 540 && (
                  <Badge variant="destructive" className="text-[9px] px-1.5 py-0 font-bold">
                    ⚠️ Excede 9h
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 border-t border-border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 text-[10px]">
                    <TableHead className="py-1 px-2 whitespace-nowrap">Dia</TableHead>
                    <TableHead className="py-1 px-2 whitespace-nowrap">Pontos</TableHead>
                    <TableHead className="py-1 px-2 whitespace-nowrap">Tempo Total</TableHead>
                    <TableHead className="py-1 px-2 text-right whitespace-nowrap">V. Meta</TableHead>
                    <TableHead className="py-1 px-2 text-right whitespace-nowrap">V. Planejado</TableHead>
                    <TableHead className="py-1 px-2 text-right whitespace-nowrap">% Meta</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {diasProgramados.map(d => {
                    const isActive = d.id === activeDia?.id;
                    const itensDoDia = d.pontos.flatMap(p => (pontosGroupedMap[p] || []).filter(item => item.selected));
                    const tempoAtiv = itensDoDia.reduce((acc, item) => acc + (item.tempoEstimadoMinutos || 0), 0);
                    const tempoSaidaBaseDia = diasTemposCompMap[d.id]?.tempoSaidaBaseMin ?? tempoSaidaBasePadrao;
                    const tempoSegurancaDia = diasTemposCompMap[d.id]?.tempoSegurancaMin ?? tempoSegurancaPadrao;
                    const tempoTotalDia = tempoAtiv + d.tempoTotalDeslocamentoMin + tempoSaidaBaseDia + tempoSegurancaDia;
                    const valPlanejado = itensDoDia.reduce((acc, item) => acc + (item.valorEstimado || 0), 0);
                    const pctMetaDia = metaEquipeInput > 0 ? Math.round((valPlanejado / metaEquipeInput) * 1000) / 10 : 0;

                    return (
                      <TableRow
                        key={d.id}
                        onClick={() => setActiveDayId(d.id)}
                        className={cn("cursor-pointer transition-colors", isActive ? "bg-primary/10 font-bold" : "hover:bg-accent/40")}
                      >
                        <TableCell className="py-1.5 px-2 text-[11px] font-medium font-mono whitespace-nowrap">
                          {d.nomeDia.slice(0, 3)} ({d.dataStr})
                          {isActive && <Badge className="ml-1 text-[8px] px-1 py-0 bg-primary text-primary-foreground">Ativo</Badge>}
                        </TableCell>
                        <TableCell className="py-1.5 px-2 text-[11px] font-mono text-primary font-bold whitespace-nowrap">
                          {d.pontos.length > 0 ? d.pontos.join(', ') : <span className="text-muted-foreground font-normal">Nenhum</span>}
                        </TableCell>
                        <TableCell className={`py-1.5 px-2 text-[11px] font-mono whitespace-nowrap ${tempoTotalDia > 540 ? 'text-red-500 font-bold' : ''}`}>
                          {formatMinToHours(tempoTotalDia)}
                        </TableCell>
                        <TableCell className="py-1.5 px-2 text-[11px] text-right text-muted-foreground font-mono whitespace-nowrap">
                          R$ {metaEquipeInput.toFixed(2)}
                        </TableCell>
                        <TableCell className="py-1.5 px-2 text-[11px] text-right text-emerald-600 dark:text-emerald-400 font-mono font-semibold whitespace-nowrap">
                          R$ {valPlanejado.toFixed(2)}
                        </TableCell>
                        <TableCell className="py-1.5 px-2 text-[11px] text-right font-mono font-bold whitespace-nowrap">
                          <span className={pctMetaDia >= 100 ? "text-emerald-600 dark:text-emerald-400" : pctMetaDia >= 75 ? "text-amber-600" : "text-rose-600"}>
                            {pctMetaDia}%
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Estrutura por Dia Programado em Sequência (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col gap-3.5">
          {/* Obra Selecionada Banner & Saldos */}
          {selectedObra ? (
            <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-primary">{selectedObra.projeto}</span>
                    <span className="text-xs font-semibold text-foreground">— {selectedObra.nomeProjeto}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Município: <strong>{selectedObra.municipio}</strong> | Dono da Obra: <strong>{selectedObra.donoDaObra}</strong>
                  </p>
                </div>
                <Badge className="bg-primary text-primary-foreground font-semibold shrink-0">
                  Obra Selecionada
                </Badge>
              </div>

              {/* CARDS DE DISPONIBILIDADE E SALDO DE POSTES (COL Y) E CABOS (COL AE) */}
              <div className="grid grid-cols-2 gap-3 my-1">
                {/* Card Postes Disponíveis */}
                <div className="p-2.5 rounded-xl border bg-card/90 border-border/80 flex items-center justify-between shadow-xs">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 shrink-0">
                      <UtilityPole className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground font-semibold">Postes Disponíveis (Col Y)</p>
                      <p className="text-sm font-bold font-mono text-foreground">
                        {selectedObra.qtdPostesDisponiveis} <span className="text-[10px] font-normal text-muted-foreground">na carteira</span>
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-[10px] text-muted-foreground font-semibold">Saldo Restante</p>
                    <Badge
                      variant="outline"
                      className={`font-mono text-xs font-bold ${
                        saldoPostesRestantes < 0
                          ? 'bg-rose-500/10 text-rose-600 border-rose-500/30'
                          : postesProgramadosHoje > 0
                          ? 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                          : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                      }`}
                    >
                      {saldoPostesRestantes} {postesProgramadosHoje > 0 && `(-${postesProgramadosHoje})`}
                    </Badge>
                  </div>
                </div>

                {/* Card Cabos Disponíveis */}
                <div className="p-2.5 rounded-xl border bg-card/90 border-border/80 flex items-center justify-between shadow-xs">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 shrink-0">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground font-semibold">Cabos Disponíveis (Col AE)</p>
                      <p className="text-sm font-bold font-mono text-foreground">
                        {selectedObra.qtdCabosDisponiveis} m <span className="text-[10px] font-normal text-muted-foreground">na carteira</span>
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-[10px] text-muted-foreground font-semibold">Saldo Restante</p>
                    <Badge
                      variant="outline"
                      className={`font-mono text-xs font-bold ${
                        saldoCabosRestantes < 0
                          ? 'bg-rose-500/10 text-rose-600 border-rose-500/30'
                          : cabosProgramadosHoje > 0
                          ? 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                          : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                      }`}
                    >
                      {saldoCabosRestantes} m {cabosProgramadosHoje > 0 && `(-${cabosProgramadosHoje}m)`}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Barra de Ferramentas do Topo: Pré-definição de Filtros & Distribuição Automática */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-primary/20 bg-muted/10 p-2.5 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-primary" />
                    Filtro Pré-definido dos Dias:
                  </span>
                  <div className="inline-flex rounded-lg border border-border bg-background p-0.5 text-xs shadow-2xs">
                    <button
                      onClick={() => handleSetGlobalFiltroLv('COMPLETO')}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all ${
                        filtroLvPadraoGlobal === 'COMPLETO'
                          ? 'bg-primary text-primary-foreground shadow-xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      COMPLETO
                    </button>
                    <button
                      onClick={() => handleSetGlobalFiltroLv('SOMENTE_LV')}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all ${
                        filtroLvPadraoGlobal === 'SOMENTE_LV'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      SOMENTE LV
                    </button>
                    <button
                      onClick={() => handleSetGlobalFiltroLv('SEM_LV')}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all ${
                        filtroLvPadraoGlobal === 'SEM_LV'
                          ? 'bg-primary text-primary-foreground shadow-xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      SEM LV
                    </button>
                  </div>
                </div>

                {/* Botão de Distribuição Automática Global */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDistribuirPontosAuto}
                  className="h-8 text-xs font-semibold bg-background gap-1.5 shadow-2xs"
                  title="Distribuir todos os pontos da obra igualmente entre os dias programados"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-500" /> ⚡ Distribuir Pontos Automaticamente ({diasProgramados.length} dias)
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl border border-dashed border-amber-500/40 bg-amber-500/5 flex items-center gap-3 text-amber-600 text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Selecione uma Obra no painel à esquerda para carregar a lista de Pontos.</span>
            </div>
          )}

          {/* LISTA SEQUENCIAL DE TODOS OS DIAS DO PERÍODO PROGRAMADO */}
          {diasProgramados.map((dia, diaIdx) => {
            const pontosDoDia = dia.pontos || [];
            const etapasDoDia = diasEtapasMap[dia.id] || [];
            const filtroLvDoDia = diasFiltroLvMap[dia.id] || filtroLvPadraoGlobal || 'COMPLETO';

            const itensDoDiaFlat = pontosDoDia.flatMap(p => pontosGroupedMap[p] || []);
            const itensDoDiaSelecionados = itensDoDiaFlat.filter(item => item.selected);
            const tempoAtivMinDia = itensDoDiaSelecionados.reduce((acc, item) => acc + (item.tempoEstimadoMinutos || 0), 0);
            const tempoSaidaBaseDia = diasTemposCompMap[dia.id]?.tempoSaidaBaseMin ?? tempoSaidaBasePadrao;
            const tempoSegurancaDia = diasTemposCompMap[dia.id]?.tempoSegurancaMin ?? tempoSegurancaPadrao;
            const tempoCompTotalDia = dia.tempoTotalDeslocamentoMin + tempoSaidaBaseDia + tempoSegurancaDia;
            const tempoTotalDiaMin = tempoAtivMinDia + tempoCompTotalDia;
            const valPlanejadoDia = itensDoDiaSelecionados.reduce((acc, item) => acc + (item.valorEstimado || 0), 0);
            const pctMetaDia = metaEquipeInput > 0 ? Math.round((valPlanejadoDia / metaEquipeInput) * 1000) / 10 : 0;
            const deslocHoras = dia.tempoTotalDeslocamentoMin / 60;
            const excedeMetaDesloc = deslocHoras > metaDeslocamentoDiarioHoras;

            return (
              <Card key={`${dia.id}_${diaIdx}`} className="border border-border shadow-sm overflow-hidden">
                {/* Header do Bloco do Dia */}
                <CardHeader className="bg-muted/40 border-b border-border/70 py-3.5 px-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className="bg-primary text-primary-foreground font-mono text-xs px-2 py-0.5 font-bold shrink-0">
                          Dia {diaIdx + 1} de {diasProgramados.length}
                        </Badge>
                        
                        {/* Seletor / Editor da Data deste Dia */}
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs font-mono font-bold gap-1.5 bg-background shadow-2xs border-primary/40 hover:border-primary"
                              title="Clique para alterar a data deste dia"
                            >
                              <CalendarIcon className="w-3.5 h-3.5 text-primary" />
                              <span>{dia.nomeDia}, {safeFormatDate(dia.dayDate, 'dd/MM/yyyy')}</span>
                              <span className="text-[10px] text-muted-foreground font-normal ml-1">✏️ Alterar</span>
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={dia.dayDate}
                              onSelect={d => {
                                if (d) {
                                  handleUpdateDiaDate(diaIdx, safeFormatDate(d, 'yyyy-MM-dd'));
                                }
                              }}
                              locale={ptBR}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>

                        {/* Botão de Remover Dia (se tiver mais de 1 dia) */}
                        {diasProgramados.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleRemoveDia(diaIdx);
                            }}
                            className="h-7 w-7 text-rose-600 hover:text-rose-700 hover:bg-rose-500/20 bg-rose-500/10 border border-rose-500/30 transition-colors"
                            title={`Excluir Dia ${diaIdx + 1} (${dia.nomeDia})`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>

                      {/* Detalhes de Deslocamento e Tempos Complementares do Dia */}
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground mt-1.5 font-mono">
                        <span>🛫 Saída: <strong className="text-foreground">{dia.origemNome}</strong> ({formatMinToHours(dia.tempoIdaMin)})</span>
                        <span>•</span>
                        <span>🛬 Retorno: <strong className="text-foreground">{dia.destinoNome}</strong> ({formatMinToHours(dia.tempoVoltaMin)})</span>
                        <span>•</span>
                        <span className={cn("font-bold", excedeMetaDesloc ? "text-amber-600 dark:text-amber-400" : "text-primary")}>
                          Deslocamento: {formatMinToHours(dia.tempoTotalDeslocamentoMin)} {excedeMetaDesloc && `(Meta: ${formatMinToHours(metaDeslocamentoDiarioHoras * 60)})`}
                        </span>
                        <span>•</span>
                        <span>Saída Base: <strong className="text-foreground">{tempoSaidaBaseDia}m</strong></span>
                        <span>•</span>
                        <span>Segurança: <strong className="text-foreground">{tempoSegurancaDia}m</strong></span>
                        <span>•</span>
                        <span className="text-primary font-bold">Total Previsto: {formatMinToHours(tempoTotalDiaMin)}</span>
                      </div>
                    </div>

                    {/* Resumo Rápido no Header do Dia */}
                    <div className="flex items-center gap-2 font-mono text-xs shrink-0 flex-wrap">
                      <Badge variant="outline" className="bg-background">
                        {pontosDoDia.length} {pontosDoDia.length === 1 ? 'ponto' : 'pontos'}
                      </Badge>
                      <Badge variant="outline" className="bg-background text-emerald-600 dark:text-emerald-400 font-bold">
                        R$ {valPlanejadoDia.toFixed(2)}
                      </Badge>
                      <Badge className={pctMetaDia >= 100 ? "bg-emerald-600 text-white font-bold" : pctMetaDia >= 75 ? "bg-amber-600 text-white font-bold" : "bg-rose-600 text-white font-bold"}>
                        {pctMetaDia}% Meta
                      </Badge>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-4 space-y-4">
                  {/* BARRA DE CONFIGURAÇÕES DESTE DIA: ETAPAS DA OBRA + FILTRO LV + SELETOR DE PONTOS */}
                  <div className="flex flex-col gap-2.5 bg-muted/20 p-3 rounded-xl border border-border/60">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      {/* Etapas da Obra para este Dia (Multiseleção) */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-foreground flex items-center gap-1">
                          <Tag className="w-3.5 h-3.5 text-primary" /> Etapas (Col M):
                        </span>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="h-7 text-xs font-semibold bg-background px-2.5 max-w-[250px]">
                              <span className="truncate">
                                {etapasDoDia.length === 0
                                  ? 'Selecionar Etapas (Col M)...'
                                  : etapasDoDia.length === etapasDisponiveis.length
                                  ? 'Todas as Etapas'
                                  : etapasDoDia.join('/')}
                              </span>
                              <ChevronDown className="w-3 h-3 ml-1 opacity-60 shrink-0" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[260px] p-3 text-xs" align="start">
                            <div className="flex items-center justify-between pb-2 border-b border-border mb-2 font-bold">
                              <span>Etapas da Programação (Col M)</span>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => setDiasEtapasMap(prev => ({ ...prev, [dia.id]: [] }))}
                                  className="text-[10px] text-muted-foreground hover:underline"
                                >
                                  Limpar
                                </button>
                                <button
                                  onClick={() => setDiasEtapasMap(prev => ({ ...prev, [dia.id]: [...etapasDisponiveis] }))}
                                  className="text-[10px] text-primary hover:underline"
                                >
                                  Todas
                                </button>
                              </div>
                            </div>

                            <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                              {etapasDisponiveis.map(et => {
                                const isChecked = etapasDoDia.includes(et);
                                return (
                                  <div
                                    key={et}
                                    onClick={() => handleToggleEtapaNoDia(dia.id, et)}
                                    className="flex items-center gap-2 cursor-pointer hover:bg-accent/40 p-1.5 rounded"
                                  >
                                    <Checkbox checked={isChecked} onCheckedChange={() => handleToggleEtapaNoDia(dia.id, et)} />
                                    <span className="text-xs font-medium text-foreground">{et}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>

                      {/* Filtro LV para este Dia (COMPLETO / SOMENTE LV / SEM LV) */}
                      <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg border border-border">
                        <Button
                          size="sm"
                          type="button"
                          variant={filtroLvDoDia === 'COMPLETO' ? 'default' : 'ghost'}
                          onClick={() => handleSetFiltroLvNoDia(dia.id, 'COMPLETO')}
                          className="h-6 text-[10px] font-semibold px-2"
                        >
                          COMPLETO
                        </Button>
                        <Button
                          size="sm"
                          type="button"
                          variant={filtroLvDoDia === 'SOMENTE_LV' ? 'default' : 'ghost'}
                          onClick={() => handleSetFiltroLvNoDia(dia.id, 'SOMENTE_LV')}
                          className="h-6 text-[10px] font-semibold px-2"
                        >
                          SOMENTE LV
                        </Button>
                        <Button
                          size="sm"
                          type="button"
                          variant={filtroLvDoDia === 'SEM_LV' ? 'default' : 'ghost'}
                          onClick={() => handleSetFiltroLvNoDia(dia.id, 'SEM_LV')}
                          className="h-6 text-[10px] font-semibold px-2"
                        >
                          SEM LV
                        </Button>
                      </div>
                    </div>

                    {/* SELETOR C6 DE PONTOS ESPECÍFICO PARA ESTE DIA */}
                    <div className="flex items-center justify-between gap-2 flex-wrap pt-2 border-t border-border/40">
                      <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <PackageCheck className="w-4 h-4 text-primary" />
                        Pontos a Executar em <strong className="text-primary">{dia.nomeDia} ({dia.dataStr})</strong>:
                      </span>

                      <div className="flex items-center gap-2 flex-1 justify-end flex-wrap">
                        {orcamentoPontosQuery.isLoading ? (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando pontos...
                          </div>
                        ) : (
                          <PontosMultiSelect
                            pontos={pontosDisponiveisDoProjeto}
                            selected={pontosDoDia}
                            orcamentoPorPontoMap={orcamentoPorPontoMap}
                            onToggle={p => handleTogglePontoNoDia(dia.id, p)}
                            onSelectAll={() => handleSelectAllPontosNoDia(dia.id)}
                            onDeselectAll={() => handleDeselectAllPontosNoDia(dia.id)}
                          />
                        )}

                        {/* Input rápido para ponto customizado neste dia */}
                        <div className="flex items-center gap-1">
                          <Input
                            placeholder="Outro Ponto..."
                            value={customPontoInputMap[dia.id] || ''}
                            onChange={e => setCustomPontoInputMap(prev => ({ ...prev, [dia.id]: e.target.value }))}
                            onKeyDown={e => e.key === 'Enter' && handleAddCustomPontoNoDia(dia.id)}
                            className="h-7 text-xs w-[110px] font-mono"
                          />
                          <Button size="sm" variant="outline" onClick={() => handleAddCustomPontoNoDia(dia.id)} className="h-7 text-xs px-2">
                            <Plus className="w-3 h-3 mr-0.5" /> Add
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Badges dos Pontos Selecionados neste Dia */}
                  {pontosDoDia.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {pontosDoDia.map(p => (
                        <Badge
                          key={p}
                          variant="secondary"
                          className="font-mono text-xs px-2.5 py-1 cursor-pointer hover:bg-destructive/10 hover:text-destructive transition-colors font-bold"
                          onClick={() => handleTogglePontoNoDia(dia.id, p)}
                          title={`Clique para remover ${p} de ${dia.nomeDia}`}
                        >
                          {p} ✕
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <div className="py-6 text-center text-muted-foreground text-xs border border-dashed rounded-lg">
                      Nenhum ponto marcado para <strong>{dia.nomeDia} ({dia.dataStr})</strong>. Selecione os pontos acima para este dia.
                    </div>
                  )}

                  {/* TABELAS DE ATIVIDADES DOS PONTOS DESTE DIA */}
                  {pontosDoDia.length > 0 && (
                    <div className="space-y-4 pt-1">
                      {pontosDoDia.map(pLabel => {
                        const pUpper = (pLabel || '').toUpperCase();
                        let itemsDoPontoRaw = pontosGroupedMap[pUpper] || pontosGroupedMap[pLabel] || [];
                        if (itemsDoPontoRaw.length === 0 && orcamentoPorPontoMap?.get) {
                          const budget = orcamentoPorPontoMap.get(pUpper);
                          if (budget && budget.length > 0) {
                            itemsDoPontoRaw = budget.map((bItem, bIdx) => ({
                              id: `${pUpper}-${(bItem.servicoPrevisto || '').replace(/\s+/g, '_')}-${bIdx}`,
                              ponto: pUpper,
                              servico: bItem.servicoPrevisto || 'SERVIÇO',
                              codigoMaterial: bItem.codigo,
                              descricaoMaterial: bItem.descricao,
                              qtdOrcadaPonto: bItem.quantidade || 1,
                              etapaPrevista: bItem.etapaPrevista || inferEtapaFromServico(bItem.servicoPrevisto || ''),
                              quantidade: bItem.quantidade || 1,
                              tempoEstimadoMinutos: bItem.tempoMinutos || 15,
                              valorEstimado: bItem.valorEstimado || 0,
                              selected: false,
                              isBudgeted: true,
                            }));
                          }
                        }
                        const itemsDoPonto = itemsDoPontoRaw.filter(i => {
                          const servUpper = (i.servico || '').toUpperCase();
                          const etapaUpper = (i.etapaPrevista || '').toUpperCase();
                          const descMatUpper = (i.descricaoMaterial || '').toUpperCase();
                          const codUpper = (i.codigoMaterial || '').toUpperCase();

                          const isLv = servUpper.includes(' LV') || 
                                       servUpper.includes('LINHA VIVA') || 
                                       servUpper.includes('LV/') ||
                                       servUpper.endsWith('LV') ||
                                       etapaUpper.includes('LV') || 
                                       etapaUpper.includes('LINHA VIVA') ||
                                       descMatUpper.includes(' LV') ||
                                       descMatUpper.includes('LINHA VIVA') ||
                                       descMatUpper.endsWith('LV') ||
                                       codUpper.startsWith('SDEV') ||
                                       codUpper.includes('LV');

                          if (filtroLvDoDia === 'SOMENTE_LV' && !isLv) return false;
                          if (filtroLvDoDia === 'SEM_LV' && isLv) return false;
                          return true;
                        });
                        const itemsSelecionados = itemsDoPonto.filter(i => i.selected);
                        const subtotalMinutos = itemsSelecionados.reduce((acc, i) => acc + (i.tempoEstimadoMinutos || 0), 0);
                        const subtotalValor = itemsSelecionados.reduce((acc, i) => acc + (i.valorEstimado || 0), 0);

                        return (
                          <Card key={pLabel} className="border border-border/80 shadow-2xs">
                            <CardHeader className="pb-2.5 bg-muted/20 flex flex-row items-center justify-between border-b border-border/60">
                              <div>
                                <div className="flex items-center gap-2">
                                  <CardTitle className="text-sm font-bold font-mono text-primary flex items-center gap-1.5">
                                    <Layers className="w-4 h-4" />
                                    PONTO {pLabel}
                                  </CardTitle>
                                  <Badge variant="outline" className="text-[11px] font-mono">
                                    {itemsDoPonto.length} {itemsDoPonto.length === 1 ? 'atividade' : 'atividades'}
                                  </Badge>
                                </div>
                                <CardDescription className="text-xs mt-0.5">
                                  Atividades do ponto <strong className="font-mono text-foreground">{pLabel}</strong> em {dia.nomeDia} ({dia.dataStr})
                                </CardDescription>
                              </div>

                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => handleAddAtividadeNoPonto(pLabel)}
                                className="h-7 gap-1 text-xs font-semibold"
                              >
                                <Plus className="w-3.5 h-3.5" /> Adicionar Atividade em {pLabel}
                              </Button>
                            </CardHeader>

                            <CardContent className="pt-3 space-y-3">
                              <div className="rounded-xl border border-border overflow-hidden">
                                <Table>
                                  <TableHeader>
                                    <TableRow className="bg-muted/50 text-[11px]">
                                      <TableHead className="w-[36px] text-center">
                                        <Checkbox
                                          checked={itemsDoPonto.length > 0 && itemsDoPonto.every(i => i.selected)}
                                          onCheckedChange={c => {
                                            const val = Boolean(c);
                                            const idsInFilter = new Set(itemsDoPonto.map(i => i.id));
                                            setPontosGroupedMap(prev => ({
                                              ...prev,
                                              [pLabel]: (prev[pLabel] || []).map(item => idsInFilter.has(item.id) ? { ...item, selected: val } : item)
                                            }));
                                          }}
                                        />
                                      </TableHead>
                                      <TableHead>Atividade / Serviço em {pLabel}</TableHead>
                                      <TableHead className="w-[85px] text-center" title="Coluna F: Quantidade Prevista no Orçamento">
                                        Qtd Prev. (Col F)
                                      </TableHead>
                                      <TableHead className="w-[140px]" title="Coluna BY: Etapa da Atividade referente à base do pré-fechamento">
                                        Etapa (Col BY)
                                      </TableHead>
                                      <TableHead className="w-[85px] text-center">Qtd Prog.</TableHead>
                                      <TableHead className="w-[95px]">Tempo</TableHead>
                                      <TableHead className="w-[100px]">Valor</TableHead>
                                      <TableHead className="w-[36px] text-right"></TableHead>
                                    </TableRow>
                                  </TableHeader>

                                  <TableBody className="text-xs">
                                    {itemsDoPonto.length === 0 ? (
                                      <TableRow>
                                        <TableCell colSpan={8} className="text-center py-6 text-muted-foreground text-xs">
                                          Nenhuma atividade cadastrada para o Ponto {pLabel}.
                                        </TableCell>
                                      </TableRow>
                                    ) : (
                                      itemsDoPonto.map((item, itemIdx) => (
                                        <TableRow key={item.id || itemIdx} className={`hover:bg-accent/30 transition-colors ${!item.selected ? 'bg-muted/10 text-muted-foreground' : 'bg-background'}`}>
                                          <TableCell className="p-2 text-center">
                                            <Checkbox
                                              checked={item.selected}
                                              onCheckedChange={c => handleUpdateAtividade(pLabel, item.id, 'selected', Boolean(c))}
                                            />
                                          </TableCell>

                                          <TableCell className="p-2">
                                            <div className="flex items-center gap-2">
                                              <Wrench className="w-3.5 h-3.5 text-primary shrink-0" />
                                              {item.isBudgeted ? (
                                                <span className="font-semibold text-xs text-foreground">{item.servico}</span>
                                              ) : (
                                                <SearchableServicoSelect
                                                  value={item.servico}
                                                  onValueChange={val => handleUpdateAtividade(pLabel, item.id, 'servico', val)}
                                                  options={filteredServicosBase}
                                                />
                                              )}
                                            </div>
                                          </TableCell>

                                          <TableCell className="p-2 text-center">
                                            <Badge variant="outline" className="font-mono text-xs bg-muted/40 font-bold px-2 py-0.5">
                                              {item.qtdOrcadaPonto}
                                            </Badge>
                                          </TableCell>

                                          <TableCell className="p-2">
                                            <Select
                                              value={item.etapaPrevista}
                                              onValueChange={val => handleUpdateAtividade(pLabel, item.id, 'etapaPrevista', val)}
                                            >
                                              <SelectTrigger className="h-7 text-[11px] font-medium bg-background px-2">
                                                <SelectValue placeholder="Selecione a Etapa" />
                                              </SelectTrigger>
                                              <SelectContent>
                                                {ETAPAS_ATIVIDADES_PRE_FECHAMENTO.map(et => (
                                                  <SelectItem key={et} value={et} className="text-xs">
                                                    {et}
                                                  </SelectItem>
                                                ))}
                                              </SelectContent>
                                            </Select>
                                          </TableCell>

                                          <TableCell className="p-2">
                                            <Input
                                              type="number"
                                              step="1"
                                              min="1"
                                              value={item.quantidade}
                                              onChange={e => handleUpdateAtividade(pLabel, item.id, 'quantidade', e.target.value)}
                                              className="h-8 text-xs text-center font-mono font-bold w-16"
                                            />
                                          </TableCell>

                                          <TableCell className="p-2 font-mono text-muted-foreground font-semibold">
                                            {formatMinToHours(item.tempoEstimadoMinutos)}
                                          </TableCell>

                                          <TableCell className="p-2 font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                                            R$ {item.valorEstimado.toFixed(2)}
                                          </TableCell>

                                          <TableCell className="p-2 text-right">
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              onClick={() => handleRemoveAtividade(pLabel, item.id)}
                                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </Button>
                                          </TableCell>
                                        </TableRow>
                                      ))
                                    )}
                                  </TableBody>
                                </Table>
                              </div>

                              {/* Subtotais do Ponto */}
                              <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                                <span>Ponto {pLabel}: {itemsSelecionados.length} atividades marcadas</span>
                                <div className="flex items-center gap-4 font-mono font-semibold">
                                  <span>Tempo: {formatMinToHours(subtotalMinutos)}</span>
                                  <span className="text-emerald-600 dark:text-emerald-400">R$ {subtotalValor.toFixed(2)}</span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}

                  {/* Subtotais do Dia e Botão de Gravar Individualmente este Dia */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-2.5 border-t border-border/60 bg-muted/20 p-2.5 rounded-lg">
                    <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground flex-wrap whitespace-nowrap">
                      <span>⏱️ Tempo: <strong className="text-foreground">{formatMinToHours(tempoTotalDiaMin)}</strong></span>
                      <span>•</span>
                      <span>💰 Valor: <strong className="text-emerald-600 dark:text-emerald-400">R$ {valPlanejadoDia.toFixed(2)}</strong></span>
                      <span>•</span>
                      <span>🎯 Meta: <strong className={pctMetaDia >= 100 ? "text-emerald-600" : pctMetaDia >= 75 ? "text-amber-600" : "text-rose-600"}>{pctMetaDia}%</strong></span>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEnviarPlanPrincipalDia(dia)}
                      disabled={pontosDoDia.length === 0 || itensDoDiaSelecionados.length === 0 || salvarProgramacao.isPending || isSavingAll}
                      className="gap-1.5 text-xs font-semibold h-7 bg-background shadow-2xs shrink-0"
                    >
                      <Send className="w-3 h-3 text-primary" /> Gravar Dia {dia.nomeDia} ({dia.dataStr})
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* BOTÃO PARA INSERIR DIA EXTRA NA PROGRAMAÇÃO */}
          <div className="flex items-center justify-center p-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 transition-all shadow-2xs">
            <Button
              onClick={handleAddDiaExtra}
              variant="outline"
              className="h-9 px-4 text-xs font-bold gap-2 bg-background text-primary border-primary/30 shadow-2xs hover:bg-primary hover:text-primary-foreground transition-all"
            >
              <Plus className="w-4 h-4" /> Inserir Dia Extra na Programação (Dia {diasProgramados.length + 1})
            </Button>
          </div>

          {/* RESUMO GERAL CONSOLIDADO DO PERÍODO & GRAVAÇÃO EM LOTE */}
          <Card className="border border-border shadow-sm bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Send className="w-4 h-4 text-primary" />
                  Consolidação do Período & Gravação em Lote ({diasProgramados.length} dias programados)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <div className="text-xs text-muted-foreground">
                  Obra: <strong className="text-foreground">{selectedObra?.projeto || 'Nenhuma'}</strong> | Equipe(s): <strong className="text-foreground">{selectedEquipes.length > 0 ? selectedEquipes.join(', ') : 'Nenhuma'}</strong> | Meta Diária: <strong className="text-foreground">R$ {metaEquipeInput.toFixed(2)}</strong> ({percentualMeta}%)
                </div>

                <Button
                  onClick={handleEnviarTodosOsDias}
                  disabled={!selectedObra || diasProgramados.every(d => d.pontos.length === 0) || salvarProgramacao.isPending || isSavingAll}
                  className="gap-2 font-bold text-xs h-10 px-5 bg-primary text-primary-foreground shadow-md"
                >
                  {isSavingAll ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Gravando {diasProgramados.length} Dias na Plan_Principal...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" /> Gravar Todos os {diasProgramados.length} Dias na Plan_Principal
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
