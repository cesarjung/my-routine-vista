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
  Zap,
  ZoomIn,
  ZoomOut,
  ChevronsUpDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSessionState } from '@/hooks/useSessionState';
import {
  usePcpPlanejamentoData,
  UNIDADES_DISPONIVEIS,
  ETAPAS_PADRAO,
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
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MaterialPontoBudget } from '@/hooks/usePcpPlanejamentoData';
import { useAlojamentos } from '@/hooks/useAlojamentos';
import { useVistoriaRisk } from '@/hooks/usePcpAiPlanner';

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

// ─── PontosMultiSelect — Popover compacto de seleção múltipla de pontos ───
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

  const filtered = pontos.filter(p => p.toLowerCase().includes(search.toLowerCase()));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-8 text-xs font-semibold px-3 bg-background min-w-[200px] justify-between">
          <span className="flex items-center gap-1.5">
            <PackageCheck className="w-3.5 h-3.5 text-primary" />
            {selected.length === 0
              ? 'Selecionar Pontos...'
              : `${selected.length} de ${pontos.length} pontos`}
          </span>
          <ChevronDown className="w-3 h-3 opacity-50 ml-2 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        {/* Header com busca */}
        <div className="p-2 border-b border-border">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
            <input
              placeholder="Buscar ponto (P1, V2...)..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full h-8 pl-8 pr-2 text-xs rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary font-mono"
              autoFocus
            />
          </div>
        </div>

        {/* Ações rápidas */}
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-border text-[10px]">
          <button onClick={onSelectAll} className="text-primary hover:underline font-semibold">
            Selecionar todos ({pontos.length})
          </button>
          <button onClick={onDeselectAll} className="text-muted-foreground hover:underline">
            Limpar
          </button>
        </div>

        {/* Lista de pontos com scroll */}
        <div className="overflow-y-auto max-h-[260px] p-1.5 space-y-0.5
          [&::-webkit-scrollbar]:w-1.5
          [&::-webkit-scrollbar-thumb]:bg-border
          [&::-webkit-scrollbar-thumb]:rounded-full">
          {filtered.length === 0 ? (
            <p className="text-xs text-center text-muted-foreground py-4">Nenhum ponto encontrado</p>
          ) : (
            filtered.map(p => {
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
                  <span className="text-[10px] text-muted-foreground ml-auto">{count} ativ.</span>
                </div>
              );
            })
          )}
        </div>

        {/* Footer com contador */}
        <div className="px-3 py-2 border-t border-border text-[10px] text-muted-foreground flex justify-between">
          <span>{selected.length} selecionados</span>
          <button onClick={() => setOpen(false)} className="text-primary hover:underline font-semibold">Confirmar</button>
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
  const [selectedUnidadeId, setSelectedUnidadeId] = useSessionState<string>('pcp_shared_unidade', '1rj2V7CxbZwkan63eCeLkH9G00Gi041IZNC6vwEgq6yI'); // Bom Jesus da Lapa

  // Selected Pontos list for active Obra
  const [selectedPontosLabels, setSelectedPontosLabels] = useSessionState<string[]>('pcp_shared_selected_pontos', []);
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
    statusesCarteira,
    metasPorEquipeMap,
    orcamentoPontosQuery,
    orcamentoPorPontoMap,
    pontosDisponiveisDoProjeto,
    salvarProgramacao,
    servicosBase
  } = usePcpPlanejamentoData(selectedUnidadeId, selectedObraId);

  const selectedObra = useMemo(() => obras.find(o => o.projeto === selectedObraId) || null, [obras, selectedObraId]);

  // Outros states fixos
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState<boolean>(false);
  const [supervisor, setSupervisor] = useState<string>('BARTOLOMEU');
  const [equipe, setEquipe] = useState<string>('EH156');
  const [tempoDeslocamento, setTempoDeslocamento] = useState<number>(30);
  const [tempoSaidaBase, setTempoSaidaBase] = useState<number>(15);
  const [tempoSeguranca, setTempoSeguranca] = useState<number>(15);
  const [metaEquipeInput, setMetaEquipeInput] = useState<number>(4442);

  // MULTI-SELECT ETAPAS FILTER (Tudo desmarcado pré-definido por padrão)
  const [selectedEtapas, setSelectedEtapas] = useState<string[]>([]);
  const [isEtapasPopoverOpen, setIsEtapasPopoverOpen] = useState<boolean>(false);
  
  const [filtroLv, setFiltroLv] = useSessionState<'COMPLETO' | 'SOMENTE_LV' | 'SEM_LV'>('pcp_shared_filtro_lv', 'COMPLETO');

  const filteredServicosBase = useMemo(() => {
    const base = Array.isArray(servicosBase) ? servicosBase : [];
    if (filtroLv === 'SOMENTE_LV') {
      return base.filter(s => s && s.servico && (s.servico.toUpperCase().includes(' LV') || s.servico.toUpperCase().includes('LINHA VIVA')));
    }
    if (filtroLv === 'SEM_LV') {
      return base.filter(s => s && s.servico && !s.servico.toUpperCase().includes(' LV') && !s.servico.toUpperCase().includes('LINHA VIVA'));
    }
    return base;
  }, [servicosBase, filtroLv]);

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

  // Alojamento Handler
  const handleAlojamentoChange = (alojId: string) => {
    setSelectedAlojamentoId(alojId);
    if (alojId !== 'nenhum' && selectedObra?.latitude && selectedObra?.longitude) {
      const aloj = alojamentos.find(a => a.id === alojId);
      if (aloj?.latitude && aloj?.longitude) {
        const distKm = calcDistanceKM(selectedObra.latitude, selectedObra.longitude, aloj.latitude, aloj.longitude);
        setTempoDeslocamento(Math.round(distKm * 1.5)); // avg 40km/h = 1.5 min/km
      }
    } else if (alojId === 'nenhum') {
      setTempoDeslocamento(30);
    }
  };

  // Formatted date string for submission & display
  const dataProgramacaoFormatada = useMemo(() => {
    return format(selectedDate, 'dd/MM/yyyy');
  }, [selectedDate]);

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
    if (equipesDisponiveis.length > 0 && !equipesDisponiveis.includes(equipe)) {
      setEquipe(equipesDisponiveis[0]);
    }
  }, [selectedUnidadeId, supervisoresDisponiveis, equipesDisponiveis]);

  // Auto-sync team goal (Meta da Equipe R$) whenever team changes
  useEffect(() => {
    const metaVal = metasPorEquipeMap.get(equipe.toUpperCase());
    if (metaVal && metaVal > 0) {
      setMetaEquipeInput(metaVal);
    }
  }, [equipe, metasPorEquipeMap]);

  // Map of PcpPontoItem[] grouped by Ponto Label (e.g., 'P71' -> items[], 'P72' -> items[])
  const [pontosGroupedMap, setPontosGroupedMap] = useSessionState<Record<string, PcpPontoItem[]>>('pcp_shared_pontos_grouped', {});

  // Helper for "Limpar Filtros"
  const handleClearFilters = () => {
    setSelectedSituacao('TODAS');
    setSelectedStatuses(statusesCarteira.filter(s => !s.toUpperCase().includes('CONCLU')));
    setSelectedMesFilter('TODOS');
    setSelectedMunicipioFilter('TODOS');
    setSelectedPrioridadeFilter('TODAS');
    setSearchObra('');
  };

  const handleSelectObra = (obra: PcpObra) => {
    setSelectedObraId(obra.projeto);
    setSelectedPontosLabels(['P1']);
    setPontosGroupedMap({});
  };

  // Sync items table grouped by Ponto whenever selectedPontosLabels or orcamentoPorPontoMap changes
  useEffect(() => {
    if (!selectedObra) return;

    setPontosGroupedMap(prevMap => {
      const currentPrevMap = prevMap || {};
      const nextMap: Record<string, PcpPontoItem[]> = {};
      const currentLabels = Array.isArray(selectedPontosLabels) ? selectedPontosLabels : [];

      currentLabels.forEach(pLabel => {
        if (!pLabel) return;
        const pLabelUpper = pLabel.toUpperCase();
        const budgetItems = orcamentoPorPontoMap?.get ? orcamentoPorPontoMap.get(pLabelUpper) : undefined;

        if (currentPrevMap[pLabelUpper] && Array.isArray(currentPrevMap[pLabelUpper]) && currentPrevMap[pLabelUpper].length > 0) {
          // Ponto já existe — atualiza tempo/valor vindo do orçamento, mas preserva seleções manuais
          if (budgetItems && Array.isArray(budgetItems) && budgetItems.length > 0) {
            const budgetByDescricao = new Map(budgetItems.map(b => [b.servicoPrevisto, b]));
            const budgetByCode = new Map(budgetItems.filter(b => b.codigo).map(b => [b.codigo, b]));

            nextMap[pLabelUpper] = currentPrevMap[pLabelUpper].map(item => {
              if (!item) return item;
              const match = (item.codigoMaterial ? budgetByCode.get(item.codigoMaterial) : undefined) || (item.servico ? budgetByDescricao.get(item.servico) : undefined);
              if (match) {
                return {
                  ...item,
                  codigoMaterial: item.codigoMaterial || match.codigo,
                  descricaoMaterial: item.descricaoMaterial || match.descricao,
                  tempoEstimadoMinutos: match.tempoMinutos > 0 ? match.tempoMinutos : (item.tempoEstimadoMinutos || 0),
                  valorEstimado: match.valorEstimado > 0 ? match.valorEstimado : (item.valorEstimado || 0),
                  isBudgeted: true,
                };
              }
              return item;
            });
          } else {
            nextMap[pLabelUpper] = currentPrevMap[pLabelUpper];
          }
        } else if (budgetItems && Array.isArray(budgetItems) && budgetItems.length > 0) {
          // Novo ponto — cria a partir do orçamento
          nextMap[pLabelUpper] = budgetItems.map((bItem, bIdx) => ({
            id: `${pLabelUpper}-${(bItem.servicoPrevisto || '').replace(/\s+/g, '_')}-${bIdx}`,
            ponto: pLabelUpper,
            servico: bItem.servicoPrevisto || 'SERVIÇO',
            codigoMaterial: bItem.codigo,
            descricaoMaterial: bItem.descricao,
            qtdOrcadaPonto: bItem.quantidade || 1,
            etapaPrevista: inferEtapaFromServico(bItem.servicoPrevisto || ''),
            quantidade: bItem.quantidade || 1,
            tempoEstimadoMinutos: bItem.tempoMinutos || 15,
            valorEstimado: bItem.valorEstimado || 0,
            selected: false,
            isBudgeted: true,
          }));
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
  }, [selectedPontosLabels, orcamentoPorPontoMap, selectedObra, servicosBase, filteredServicosBase]);

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

      // 6. Search Text filter
      if (!searchObra.trim()) return true;
      const q = searchObra.toLowerCase().trim();
      return (
        (o.projeto || '').toLowerCase().includes(q) ||
        (o.nomeProjeto || '').toLowerCase().includes(q) ||
        (o.municipio || '').toLowerCase().includes(q) ||
        (o.donoDaObra || '').toLowerCase().includes(q)
      );
    });
  }, [obras, searchObra, selectedStatuses, selectedSituacao, selectedMesFilter, selectedMunicipioFilter, selectedPrioridadeFilter]);

  // Toggle point label selection in C6 (multi-select points)
  const handleTogglePontoLabel = (pLabel: string) => {
    const upper = pLabel.toUpperCase().trim();
    if (!upper) return;
    setSelectedPontosLabels(prev => {
      if (prev.includes(upper)) {
        return prev.filter(p => p !== upper);
      } else {
        return [...prev, upper];
      }
    });
  };

  // Select all points of the current Obra
  const handleSelectAllPontosDaObra = () => {
    if (pontosDisponiveisDoProjeto.length > 0) {
      setSelectedPontosLabels([...pontosDisponiveisDoProjeto]);
    }
  };

  // Deselect all points
  const handleDeselectAllPontos = () => {
    setSelectedPontosLabels([]);
  };

  // Add custom point to active points
  const handleAddCustomPontoLabel = () => {
    if (!newCustomPontoInput.trim()) return;
    const clean = newCustomPontoInput.toUpperCase().trim();
    if (!selectedPontosLabels.includes(clean)) {
      setSelectedPontosLabels(prev => [...prev, clean]);
    }
    setNewCustomPontoInput('');
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

  // Flattened list of ALL items across all selected point cards
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

  // 2. Tempo TOTAL com Deslocamento + Saída Base + Segurança
  const tempoTotalGeralMinutos = useMemo(() => {
    return tempoAtividadesMinutos + Number(tempoDeslocamento || 0) + Number(tempoSaidaBase || 0) + Number(tempoSeguranca || 0);
  }, [tempoAtividadesMinutos, tempoDeslocamento, tempoSaidaBase, tempoSeguranca]);

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

  // Handle submit to Plan_Principal
  const handleEnviarPlanPrincipal = () => {
    if (!selectedObra) {
      alert('Por favor, selecione uma Obra da carteira antes de enviar.');
      return;
    }

    if (selectedItemsFlat.length === 0) {
      alert('Selecione pelo menos uma atividade marcada na tabela para enviar.');
      return;
    }

    salvarProgramacao.mutate({
      unidadeId: selectedUnidadeId,
      dataProgramacao: dataProgramacaoFormatada,
      dateObj: selectedDate,
      supervisor,
      equipe,
      etapa: selectedEtapas.join(', '),
      obra: selectedObra,
      pontos: allPontosListFlat,
      tempoDeslocamentoMinutos: tempoDeslocamento,
      tempoSaidaBaseMinutos: tempoSaidaBase,
      tempoSegurancaMinutos: tempoSeguranca,
      metaEquipeValor: metaEquipeInput,
    });
  };

  return (
    <div className="flex flex-col gap-6 p-6 w-full max-w-[1600px] mx-auto min-h-screen bg-background" style={{ zoom: zoomLevel } as React.CSSProperties}>
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-card border border-border shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-primary/10 text-primary">
            <FileSpreadsheet className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-foreground">Módulo PCP — Seção Planejamento</h1>
              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 font-semibold">
                Ambiente Local
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Réplica fiel da planilha <code className="bg-muted px-1 py-0.5 rounded text-foreground font-mono">Prog_TPM</code>: orçamento Ponto-a-Ponto e envio para a <code className="bg-muted px-1 py-0.5 rounded text-foreground font-mono">Plan_Principal</code>
            </p>
          </div>
        </div>

        {/* Controles: Zoom + Atualizar */}
        <div className="flex items-center gap-3">
          {/* Zoom Control */}
          <div className="flex items-center gap-1 border border-border rounded-lg px-2 py-1">
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
          >
            <RefreshCw className={`w-4 h-4 ${rawCacheQuery.isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* BARRA DE FILTROS SUPERIOR (Padrão das seções do Planejamento) */}
      <Card className="border border-border p-3.5 bg-card shadow-xs rounded-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2.5 flex-1">
            <div className="flex items-center gap-1.5 font-bold text-foreground pr-2.5 border-r border-border">
              <Filter className="w-4 h-4 text-primary" />
              <span>Filtros da Carteira</span>
            </div>

            {/* Unidade */}
            <div className="flex flex-col gap-1 min-w-[180px]">
              <span className="text-[10px] text-muted-foreground font-semibold">Unidade</span>
              <Select value={selectedUnidadeId} onValueChange={setSelectedUnidadeId}>
                <SelectTrigger className="h-8 text-xs font-semibold bg-background">
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

            {/* Situação (Apta / Inapta / Todas) */}
            <div className="flex flex-col gap-1 min-w-[110px]">
              <span className="text-[10px] text-muted-foreground font-semibold">Situação</span>
              <Select value={selectedSituacao} onValueChange={setSelectedSituacao}>
                <SelectTrigger className="h-8 text-xs font-semibold bg-background">
                  <SelectValue placeholder="Situação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="APTA" className="text-xs font-medium text-emerald-600">Aptas</SelectItem>
                  <SelectItem value="INAPTA" className="text-xs font-medium text-rose-600">Inaptas</SelectItem>
                  <SelectItem value="TODAS" className="text-xs font-medium">Todas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Status da Obra (Popover Multiseleção — usa lista DINÂMICA statusesCarteira) */}
            <div className="flex flex-col gap-1 min-w-[140px]">
              <span className="text-[10px] text-muted-foreground font-semibold">Status ({selectedStatuses.length})</span>
              <Popover open={isStatusPopoverOpen} onOpenChange={setIsStatusPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-8 text-xs justify-between px-2.5 font-semibold bg-background">
                    <span className="truncate">
                      {selectedStatuses.length === statusesCarteira.length && statusesCarteira.length > 0
                        ? 'Todos Status'
                        : `${selectedStatuses.length} selecionados`}
                    </span>
                    <ChevronDown className="w-3 h-3 opacity-50 shrink-0 ml-1" />
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

                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
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

            {/* Mês / Carteira (Coluna G) — apenas meses da unidade selecionada */}
            <div className="flex flex-col gap-1 min-w-[150px]">
              <span className="text-[10px] text-muted-foreground font-semibold">Mês da Carteira</span>
              <Select value={selectedMesFilter} onValueChange={v => { setSelectedMesFilter(v); setSelectedMunicipioFilter('TODOS'); setSelectedPrioridadeFilter('TODAS'); }}>
                <SelectTrigger className="h-8 text-xs font-semibold bg-background truncate font-mono">
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

            {/* Município — apenas municípios das obras filtradas pelo mês atual */}
            <div className="flex flex-col gap-1 min-w-[150px]">
              <span className="text-[10px] text-muted-foreground font-semibold">Município</span>
              <Select value={selectedMunicipioFilter} onValueChange={setSelectedMunicipioFilter}>
                <SelectTrigger className="h-8 text-xs font-semibold bg-background truncate">
                  <SelectValue placeholder="Município" />
                </SelectTrigger>
                <SelectContent className="max-h-[240px]">
                  <SelectItem value="TODOS" className="text-xs font-semibold">Todos Municípios</SelectItem>
                  {/* Apenas municípios que existem no mês selecionado */}
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

            {/* Prioridade / Dono — apenas prioridades das obras visíveis (mês + município selecionados) */}
            <div className="flex flex-col gap-1 min-w-[150px]">
              <span className="text-[10px] text-muted-foreground font-semibold">Prioridade / Dono</span>
              <Select value={selectedPrioridadeFilter} onValueChange={setSelectedPrioridadeFilter}>
                <SelectTrigger className="h-8 text-xs font-semibold bg-background truncate">
                  <SelectValue placeholder="Prioridade" />
                </SelectTrigger>
                <SelectContent className="max-h-[240px]">
                  <SelectItem value="TODAS" className="text-xs font-semibold">Todas Prioridades</SelectItem>
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

            {/* Busca por Obra */}
            <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground font-semibold">Pesquisar Obra</span>
                <button onClick={handleClearFilters} className="text-[10px] text-primary hover:underline font-semibold flex items-center gap-1">
                  <Filter className="w-3 h-3" /> Limpar Filtros
                </button>
              </div>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar projeto B-XXXXX, título..."
                  value={searchObra}
                  onChange={e => setSearchObra(e.target.value)}
                  className="pl-8 h-8 text-xs bg-background"
                />
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Main Grid: Parameters & Obra Selector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Carteira de Obras (NO TOPO), Parametros & Tempos (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
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
                            <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-600 border-blue-500/20 font-mono px-1.5 py-0 font-bold">
                              📌 {o.qtdPostesDisponiveis} post.
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

          {/* 3. Card Parâmetros Principais */}
          <Card className="border border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-primary" />
                Parâmetros da Programação
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-xs">
              {/* Calendário Date Picker */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Data da Programação</Label>
                <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full h-9 text-xs justify-start font-mono text-left font-semibold"
                    >
                      <CalendarIcon className="mr-2 h-3.5 w-3.5 text-primary" />
                      {dataProgramacaoFormatada}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={d => {
                        if (d) {
                          setSelectedDate(d);
                          setIsCalendarOpen(false);
                        }
                      }}
                      locale={ptBR}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Dropdown de Equipes */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs flex items-center justify-between">
                  <span>Equipe</span>
                  <span className="text-[10px] text-muted-foreground">({equipesDisponiveis.length})</span>
                </Label>
                <Select value={equipe} onValueChange={setEquipe}>
                  <SelectTrigger className="h-9 text-xs font-mono font-semibold">
                    <SelectValue placeholder="Selecione a equipe" />
                  </SelectTrigger>
                  <SelectContent>
                    {equipesDisponiveis.map(eq => (
                      <SelectItem key={eq} value={eq} className="text-xs font-mono">
                        {eq}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Dropdown de Supervisor Responsável */}
              <div className="col-span-2 flex flex-col gap-1.5">
                <Label className="text-xs flex items-center justify-between">
                  <span>Supervisor Responsável</span>
                  <span className="text-[10px] text-muted-foreground">({supervisoresDisponiveis.length})</span>
                </Label>
                <Select value={supervisor} onValueChange={setSupervisor}>
                  <SelectTrigger className="h-9 text-xs font-semibold">
                    <SelectValue placeholder="Selecione o supervisor" />
                  </SelectTrigger>
                  <SelectContent>
                    {supervisoresDisponiveis.map(sup => (
                      <SelectItem key={sup} value={sup} className="text-xs">
                        {sup}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* MULTI-SELECT ETAPA POPOVER */}
              <div className="col-span-2 flex flex-col gap-1.5">
                <Label className="text-xs">Etapas da Obra (Multiseleção)</Label>
                <Popover open={isEtapasPopoverOpen} onOpenChange={setIsEtapasPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full h-9 text-xs justify-between px-3 font-semibold">
                      <span className="flex items-center gap-1.5 truncate">
                        <Tag className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span className="truncate">
                          {selectedEtapas.length === 0
                            ? 'Nenhuma Etapa (Desmarcado)'
                            : selectedEtapas.length === etapasDisponiveis.length
                            ? 'Todas as Etapas'
                            : selectedEtapas.join(', ')}
                        </span>
                      </span>
                      <ChevronDown className="w-3 h-3 opacity-50 shrink-0" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[260px] p-3 text-xs" align="start">
                    <div className="flex items-center justify-between pb-2 border-b border-border mb-2 font-bold">
                      <span>Selecione as Etapas</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedEtapas([])}
                          className="text-[10px] text-muted-foreground hover:underline"
                        >
                          Desmarcar
                        </button>
                        <button
                          onClick={() => setSelectedEtapas([...etapasDisponiveis])}
                          className="text-[10px] text-primary hover:underline"
                        >
                          Marcar Todas
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                      {etapasDisponiveis.map(et => {
                        const isChecked = selectedEtapas.includes(et);
                        return (
                          <div
                            key={et}
                            onClick={() => handleToggleEtapa(et)}
                            className="flex items-center gap-2 cursor-pointer hover:bg-accent/40 p-1.5 rounded"
                          >
                            <Checkbox checked={isChecked} onCheckedChange={() => handleToggleEtapa(et)} />
                            <span className="text-xs font-medium text-foreground">{et}</span>
                          </div>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
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
                  {equipe}
                </Badge>
              </CardTitle>
            </CardHeader>

            <CardContent className="space-y-4 text-xs">
              {/* Grid Campos de Tempo Complementares */}
              <div className="grid grid-cols-4 gap-3">
                <div className="flex flex-col gap-1">
                  <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Truck className="w-3 h-3 text-blue-500" /> Base
                  </Label>
                  <Select value={selectedAlojamentoId} onValueChange={handleAlojamentoChange}>
                    <SelectTrigger className="h-8 text-[10px] font-mono pr-2">
                      <SelectValue placeholder="Padrão" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nenhum">Nenhum / Padrão</SelectItem>
                      {alojamentos.map(a => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.nome} {a.cidade ? `(${a.cidade})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Navigation className="w-3 h-3 text-blue-500" /> Deslocamento
                  </Label>
                  <div className="relative">
                    <Input
                      type="number"
                      min="0"
                      value={tempoDeslocamento}
                      onChange={e => setTempoDeslocamento(Math.max(0, Number(e.target.value) || 0))}
                      className="h-8 text-xs font-mono font-bold pr-8"
                    />
                    <span className="absolute right-2 top-2 text-[10px] text-muted-foreground font-mono">min</span>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <LogOut className="w-3 h-3 text-amber-500" /> Saída Base
                  </Label>
                  <div className="relative">
                    <Input
                      type="number"
                      min="0"
                      value={tempoSaidaBase}
                      onChange={e => setTempoSaidaBase(Math.max(0, Number(e.target.value) || 0))}
                      className="h-8 text-xs font-mono font-bold pr-8"
                    />
                    <span className="absolute right-2 top-2 text-[10px] text-muted-foreground font-mono">min</span>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-500" /> Segurança
                  </Label>
                  <div className="relative">
                    <Input
                      type="number"
                      min="0"
                      value={tempoSeguranca}
                      onChange={e => setTempoSeguranca(Math.max(0, Number(e.target.value) || 0))}
                      className="h-8 text-xs font-mono font-bold pr-8"
                    />
                    <span className="absolute right-2 top-2 text-[10px] text-muted-foreground font-mono">min</span>
                  </div>
                </div>
              </div>

              {/* Banner Resumo da Soma dos Tempos */}
              <div className="p-3 rounded-xl bg-muted/40 border border-border flex items-center justify-between">
                <span className="text-muted-foreground text-xs">
                  Soma Total do Tempo: <strong>{Math.floor(tempoAtividadesMinutos / 60)}h {tempoAtividadesMinutos % 60}m</strong> (ativid.) + <strong>{tempoDeslocamento + tempoSaidaBase + tempoSeguranca}m</strong> (comp.)
                </span>
                <span className="font-mono font-bold text-sm text-primary">
                  = {tempoTotalFormatado}
                </span>
              </div>

              {/* META DA EQUIPE & % PREVISTO DA META */}
              <div className="pt-2 border-t border-border/80 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Target className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    Valor da Meta da Equipe {equipe} (R$):
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

          {/* 5. CARD RESUMO DA PROGRAMAÇÃO COM VALORES E METAS */}
          <Card className="border border-border shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-semibold flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-primary" /> Resumo da Programação ({equipe})
                </span>
                {tempoTotalGeralMinutos > 540 && (
                  <Badge variant="destructive" className="text-[10px] px-2 py-0.5 font-bold">
                    ⚠️ Excede 9h diárias
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px] p-2">Dia</TableHead>
                    <TableHead className="text-[10px] p-2">Equipe</TableHead>
                    <TableHead className="text-[10px] p-2">Tempo</TableHead>
                    <TableHead className="text-[10px] p-2 text-right">V. Meta</TableHead>
                    <TableHead className="text-[10px] p-2 text-right">V. Planejado</TableHead>
                    <TableHead className="text-[10px] p-2 text-right">% Meta</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="p-2 text-[11px] font-medium">
                      {dataProgramacaoFormatada}
                    </TableCell>
                    <TableCell className="p-2 text-[11px] font-medium text-primary">
                      {equipe}
                    </TableCell>
                    <TableCell className={`p-2 text-[11px] font-mono ${tempoTotalGeralMinutos > 540 ? 'text-red-500 font-bold' : ''}`}>
                      {Math.floor(tempoTotalGeralMinutos / 60)}h {tempoTotalGeralMinutos % 60}m
                      {tempoTotalGeralMinutos > 540 && <span className="text-[9px] ml-1 text-red-500 font-bold">(Excede 9h)</span>}
                    </TableCell>
                    <TableCell className="p-2 text-[11px] text-right text-muted-foreground font-mono">
                      R$ {metaEquipeInput.toFixed(2)}
                    </TableCell>
                    <TableCell className="p-2 text-[11px] text-right text-emerald-600 dark:text-emerald-400 font-mono font-semibold">
                      R$ {totalValor.toFixed(2)}
                    </TableCell>
                    <TableCell className="p-2 text-[11px] text-right font-mono font-bold">
                      <span className={percentualMeta >= 100 ? "text-emerald-600 dark:text-emerald-400" : percentualMeta >= 75 ? "text-amber-600" : "text-rose-600"}>
                        {percentualMeta}%
                      </span>
                    </TableCell>
                  </TableRow>
                </TableBody>
                <TableFooter className="bg-muted/50 border-t">
                  <TableRow>
                    <TableCell colSpan={2} className="p-2 text-[10px] font-bold">TOTAL</TableCell>
                    <TableCell className={`p-2 text-[11px] font-mono font-bold ${tempoTotalGeralMinutos > 540 ? 'text-red-500' : ''}`}>
                      {Math.floor(tempoTotalGeralMinutos / 60)}h {tempoTotalGeralMinutos % 60}m
                    </TableCell>
                    <TableCell className="p-2 text-[11px] text-right text-muted-foreground font-mono font-bold">
                      R$ {metaEquipeInput.toFixed(2)}
                    </TableCell>
                    <TableCell className="p-2 text-[11px] text-right text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                      R$ {totalValor.toFixed(2)}
                    </TableCell>
                    <TableCell className="p-2 text-[11px] text-right font-mono font-bold">
                      <span className={percentualMeta >= 100 ? "text-emerald-600 dark:text-emerald-400" : percentualMeta >= 75 ? "text-amber-600" : "text-rose-600"}>
                        {percentualMeta}%
                      </span>
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Estrutura por Ponto & Tabela de Atividades Orçadas do Ponto (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Obra Selecionada Banner & C6 Marcação de Pontos Previstos (Multi-Seleção) */}
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
                      <MapPin className="w-4 h-4" />
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

              {/* C6 — SELEÇÃO DOS PONTOS: Popover multi-select compacto */}
              <div className="pt-2.5 border-t border-primary/20 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <PackageCheck className="w-4 h-4 text-primary" />
                    C6 — Pontos para trabalhar hoje:
                  </span>

                  {/* Popover multi-select de Pontos */}
                  <div className="flex items-center gap-2 flex-1 justify-end flex-wrap">
                    {orcamentoPontosQuery.isLoading ? (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando pontos...
                      </div>
                    ) : (
                      <PontosMultiSelect
                        pontos={pontosDisponiveisDoProjeto}
                        selected={selectedPontosLabels}
                        orcamentoPorPontoMap={orcamentoPorPontoMap}
                        onToggle={handleTogglePontoLabel}
                        onSelectAll={handleSelectAllPontosDaObra}
                        onDeselectAll={handleDeselectAllPontos}
                      />
                    )}

                    {/* Input rápido para ponto customizado */}
                    <div className="flex items-center gap-1">
                      <Input
                        placeholder="Outro Ponto (P99)..."
                        value={newCustomPontoInput}
                        onChange={e => setNewCustomPontoInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddCustomPontoLabel()}
                        className="h-8 text-xs w-[130px] font-mono"
                      />
                      <Button size="sm" variant="outline" onClick={handleAddCustomPontoLabel} className="h-8 text-xs px-2.5">
                        <Plus className="w-3.5 h-3.5 mr-1" /> Add
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Badges dos pontos selecionados */}
                {selectedPontosLabels.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {selectedPontosLabels.map(p => (
                      <Badge
                        key={p}
                        variant="secondary"
                        className="font-mono text-[11px] px-2 py-0.5 cursor-pointer hover:bg-destructive/10 hover:text-destructive transition-colors"
                        onClick={() => handleTogglePontoLabel(p)}
                        title="Clique para remover"
                      >
                        {p} ✕
                      </Badge>
                    ))}
                  </div>
                )}
                {/* RISK BADGE */}
                {riskForObra && (
                  <div className="mt-2 flex items-center justify-between gap-2 p-2 rounded-md bg-muted/30 border">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        riskForObra.classificacao === 'Vermelho' ? 'bg-red-500' :
                        riskForObra.classificacao === 'Laranja' ? 'bg-orange-500' : 'bg-emerald-500'
                      }`} />
                      <span className="text-[10px] font-semibold text-muted-foreground">IA</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground truncate" title={riskForObra.alerta}>
                      {riskForObra.alerta}
                    </span>
                  </div>
                )}
              </div>

            </div>
          ) : (
            <div className="p-4 rounded-xl border border-dashed border-amber-500/40 bg-amber-500/5 flex items-center gap-3 text-amber-600 text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Selecione uma Obra no painel à esquerda para carregar a lista de Pontos.</span>
            </div>
          )}

          {/* LISTAGEM DOS PONTOS SELECIONADOS COM FILTRO LV NO TOPO DIREITO */}
          <div className="flex flex-col gap-4">
            {/* Header Bar com Título e Botões de Seleção LV (SOMENTE LV / SEM LV / COMPLETO) */}
            <div className="flex items-center justify-between pb-1 flex-wrap gap-2">
              <div>
                <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-primary" />
                  Planejamento das Atividades por Ponto
                </h3>
                <p className="text-xs text-muted-foreground">
                  {selectedPontosLabels.length} {selectedPontosLabels.length === 1 ? 'ponto selecionado' : 'pontos selecionados'} para execução
                </p>
              </div>

              {/* Botão Seletor de LV: SOMENTE LV | SEM LV | COMPLETO */}
              <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border">
                <Button
                  size="sm"
                  variant={filtroLv === 'COMPLETO' ? 'default' : 'ghost'}
                  onClick={() => setFiltroLv('COMPLETO')}
                  className="h-7 text-xs font-semibold px-3"
                >
                  COMPLETO
                </Button>
                <Button
                  size="sm"
                  variant={filtroLv === 'SOMENTE_LV' ? 'default' : 'ghost'}
                  onClick={() => setFiltroLv('SOMENTE_LV')}
                  className="h-7 text-xs font-semibold px-3"
                >
                  SOMENTE LV
                </Button>
                <Button
                  size="sm"
                  variant={filtroLv === 'SEM_LV' ? 'default' : 'ghost'}
                  onClick={() => setFiltroLv('SEM_LV')}
                  className="h-7 text-xs font-semibold px-3"
                >
                  SEM LV
                </Button>
              </div>
            </div>

            {selectedPontosLabels.length === 0 ? (
              <Card className="border border-border">
                <CardContent className="py-12 text-center text-muted-foreground text-xs space-y-1">
                  <p className="font-semibold text-foreground">Nenhum ponto marcado para execução hoje.</p>
                  <p>Marque os pontos no painel acima para carregar o detalhamento das atividades.</p>
                </CardContent>
              </Card>
            ) : (
              selectedPontosLabels.map(pLabel => {
                const itemsDoPontoRaw = pontosGroupedMap[pLabel] || [];
                const itemsDoPonto = itemsDoPontoRaw.filter(i => {
                  const isLv = (i.servico || '').toUpperCase().includes(' LV') || (i.servico || '').toUpperCase().includes('LINHA VIVA');
                  if (filtroLv === 'SOMENTE_LV') return isLv;
                  if (filtroLv === 'SEM_LV') return !isLv;
                  return true;
                });
                const itemsSelecionados = itemsDoPonto.filter(i => i.selected);
                const subtotalMinutos = itemsSelecionados.reduce((acc, i) => acc + (i.tempoEstimadoMinutos || 0), 0);
                const subtotalValor = itemsSelecionados.reduce((acc, i) => acc + (i.valorEstimado || 0), 0);

                return (
                  <Card key={pLabel} className="border border-border shadow-xs">
                    {/* Header do Conjunto do Ponto com BOTÃO "Adicionar Atividade no Ponto Px" */}
                    <CardHeader className="pb-3 bg-muted/30 flex flex-row items-center justify-between border-b border-border/60">
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-sm font-bold font-mono text-primary flex items-center gap-1.5">
                            <Layers className="w-4 h-4" />
                            PONTO {pLabel}
                          </CardTitle>
                          <Badge variant="outline" className="text-[11px] font-mono">
                            {itemsDoPonto.length} {itemsDoPonto.length === 1 ? 'atividade' : 'atividades'} {filtroLv !== 'COMPLETO' ? `(${filtroLv.replace('_', ' ')})` : 'previst.'}
                          </Badge>
                        </div>
                        <CardDescription className="text-xs mt-0.5">
                          Atividades e serviços previstos para execução no ponto <strong className="font-mono text-foreground">{pLabel}</strong>
                        </CardDescription>
                      </div>

                      {/* Botão Adicionar Atividade no Ponto Px com acesso a TODAS as atividades do catálogo */}
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleAddAtividadeNoPonto(pLabel)}
                        className="h-8 gap-1 text-xs font-semibold"
                      >
                        <Plus className="w-3.5 h-3.5" /> Adicionar Atividade no Ponto {pLabel}
                      </Button>
                    </CardHeader>

                    <CardContent className="pt-4 space-y-3">
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
                              <TableHead>Atividade / Serviço no Ponto {pLabel}</TableHead>
                              <TableHead className="w-[85px] text-center" title="Coluna F: Quantidade Prevista no Orçamento">
                                Qtd Prev. (Col F)
                              </TableHead>
                              <TableHead className="w-[140px]" title="Coluna M: Etapa Prevista para esta atividade">
                                Etapa (Col M)
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
                                  {filtroLv !== 'COMPLETO' 
                                    ? `Nenhuma atividade encontrada com o filtro "${filtroLv.replace('_', ' ')}" no Ponto ${pLabel}.`
                                    : `Nenhuma atividade cadastrada para o Ponto ${pLabel}. Clique em "+ Adicionar Atividade no Ponto ${pLabel}".`}
                                </TableCell>
                              </TableRow>
                            ) : (
                              itemsDoPonto.map((item, itemIdx) => (
                                <TableRow key={item.id || itemIdx} className={`hover:bg-accent/30 transition-colors ${!item.selected ? 'bg-muted/10 text-muted-foreground' : 'bg-background'}`}>
                                  {/* Checkbox selecionar por linha (Vêm DESMARCADOS por padrão) */}
                                  <TableCell className="p-2 text-center">
                                    <Checkbox
                                      checked={item.selected}
                                      onCheckedChange={c => handleUpdateAtividade(pLabel, item.id, 'selected', Boolean(c))}
                                    />
                                  </TableCell>

                                  {/* Atividade / Serviço no Ponto Px */}
                                  <TableCell className="p-2">
                                    <div className="flex items-center gap-2">
                                      <Wrench className="w-3.5 h-3.5 text-primary shrink-0" />

                                      {item.isBudgeted ? (
                                        /* Atividade Prevista do Orçamento: Exibe Texto Fixo */
                                        <span className="font-semibold text-xs text-foreground">{item.servico}</span>
                                      ) : (
                                        /* Atividade Inserida pelo Botão: Exibe Seletor com Busca por Digitação */
                                        <SearchableServicoSelect
                                          value={item.servico}
                                          onValueChange={val => handleUpdateAtividade(pLabel, item.id, 'servico', val)}
                                          options={filteredServicosBase}
                                        />
                                      )}
                                    </div>
                                  </TableCell>

                                  {/* COLUNA F — Quantidade Prevista (Orçada) */}
                                  <TableCell className="p-2 text-center">
                                    <Badge variant="outline" className="font-mono text-xs bg-muted/40 font-bold px-2 py-0.5">
                                      {item.qtdOrcadaPonto}
                                    </Badge>
                                  </TableCell>

                                  {/* COLUNA M — Etapa Prevista */}
                                  <TableCell className="p-2">
                                    <Select
                                      value={item.etapaPrevista}
                                      onValueChange={val => handleUpdateAtividade(pLabel, item.id, 'etapaPrevista', val)}
                                    >
                                      <SelectTrigger className="h-7 text-[11px] font-medium bg-background px-2">
                                        <SelectValue placeholder="Selecione a Etapa" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {etapasDisponiveis.map(et => (
                                          <SelectItem key={et} value={et} className="text-xs">
                                            {et}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </TableCell>

                                  {/* Quantidade a Realizar Hoje */}
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

                                  {/* Tempo Calculado */}
                                  <TableCell className="p-2 font-mono text-muted-foreground font-semibold">
                                    {item.tempoEstimadoMinutos} min
                                  </TableCell>

                                  {/* Valor Calculado */}
                                  <TableCell className="p-2 font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                                    R$ {item.valorEstimado.toFixed(2)}
                                  </TableCell>

                                  {/* Excluir Atividade deste Ponto */}
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
                          <span>Tempo: {Math.floor(subtotalMinutos / 60)}h {subtotalMinutos % 60}m</span>
                          <span className="text-emerald-600 dark:text-emerald-400">R$ {subtotalValor.toFixed(2)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>

          {/* Totais Gerais Summary Cards (Com Tempo Total Somado + Meta e % Meta) */}
          <div className="grid grid-cols-4 gap-3">
            <Card className="bg-card border border-border/60">
              <CardContent className="p-3.5 flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-600 shrink-0">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground font-medium">Atividades Marcadas</p>
                  <p className="text-base font-bold font-mono text-foreground">
                    {selectedItemsFlat.length} <span className="text-xs font-normal text-muted-foreground">de {allPontosListFlat.length}</span>
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border border-border/60">
              <CardContent className="p-3.5 flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-600 shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground font-medium">Tempo Total Somado</p>
                  <p className="text-base font-bold font-mono text-foreground">{tempoTotalFormatado}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border border-border/60">
              <CardContent className="p-3.5 flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-600 shrink-0">
                  <DollarSign className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground font-medium">Valor Total Previsto</p>
                  <p className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400">
                    R$ {totalValor.toFixed(2)}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* % PREVISTO DA META CARD */}
            <Card className="bg-card border border-border/60">
              <CardContent className="p-3.5 flex items-center gap-3">
                <div className={`p-2.5 rounded-lg shrink-0 ${
                  percentualMeta >= 100 ? 'bg-emerald-500/10 text-emerald-600' : percentualMeta >= 75 ? 'bg-amber-500/10 text-amber-600' : 'bg-rose-500/10 text-rose-600'
                }`}>
                  <Target className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground font-medium">% Previsto da Meta</p>
                  <p className={`text-base font-extrabold font-mono ${
                    percentualMeta >= 100 ? 'text-emerald-600 dark:text-emerald-400' : percentualMeta >= 75 ? 'text-amber-600' : 'text-rose-600'
                  }`}>
                    {percentualMeta}%
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Envio para Plan_Principal Card */}
          <Card className="border border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Send className="w-4 h-4 text-primary" />
                Pré-visualização do Formato e Envio (Plan_Principal)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 rounded-xl bg-muted/60 border border-border font-mono text-xs text-foreground break-all">
                <span className="text-muted-foreground font-sans text-[11px] block mb-1">
                  Coluna O (Compilado de atividades por ponto com Qtd Prev. Col F e Etapa Col M):
                </span>
                {compiledPreview || <span className="text-muted-foreground italic">Nenhuma atividade selecionada para envio...</span>}
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="text-xs text-muted-foreground">
                  Data: <strong>{dataProgramacaoFormatada}</strong> | Obra: <strong>{selectedObra?.projeto || 'Nenhuma'}</strong> | Equipe: <strong>{equipe}</strong> | Meta: <strong>R$ {metaEquipeInput.toFixed(2)}</strong> ({percentualMeta}%)
                </div>

                <Button
                  onClick={handleEnviarPlanPrincipal}
                  disabled={!selectedObra || selectedItemsFlat.length === 0 || salvarProgramacao.isPending}
                  className="gap-2 font-semibold"
                >
                  {salvarProgramacao.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" /> Gravar Programação na Plan_Principal
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
