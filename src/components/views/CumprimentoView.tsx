import { useState, useMemo } from 'react';
import { Filter, Calendar, RefreshCw, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FilterSelect } from '@/components/ui/filter-select';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UNIDADES_PLANEJAMENTO } from '@/constants/unidades';
import { useCumprimentoData } from '@/hooks/useCumprimentoData';
import { usePlanejamentoRaw, useSyncPlanejamento } from '@/hooks/usePlanejamentoRaw';
import { useBdMetasData } from '@/hooks/useBdMetasData';
import { useSessionState } from '@/hooks/useSessionState';
import { parse, startOfDay, endOfDay, isValid } from 'date-fns';
import { SyncIndicator } from '@/components/SyncIndicator';
import { cn } from '@/lib/utils';
import {
  ComposedChart,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
  LabelList,
  CartesianGrid
} from 'recharts';

const META_CUMPRIMENTO = 100; // Meta: 100% de Cumprimento

// Componente Sparkline SVG para a tabela
const Sparkline = ({ data, width = 96, height = 24 }: { data: (number | null)[]; width?: number; height?: number }) => {
  const validData = data.map(v => (v === null || v === undefined ? null : v));
  const numericValues = validData.filter((v): v is number => v !== null);

  if (numericValues.length < 2) {
    return <div className="w-[96px] h-[24px] flex items-center justify-center text-[10px] text-muted-foreground">-</div>;
  }

  const min = Math.min(...numericValues);
  const max = Math.max(...numericValues);
  const range = max - min || 1;

  const points = validData.map((val, i) => {
    if (val === null) return null;
    const x = (i / (validData.length - 1)) * (width - 8) + 4;
    const y = height - 4 - ((val - min) / range) * (height - 8);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const validPoints = points.filter((p): p is string => p !== null);
  const pathD = `M ${validPoints.join(' L ')}`;

  const isImproving = numericValues[numericValues.length - 1] >= numericValues[0];
  const strokeColor = isImproving ? 'hsl(var(--success))' : 'hsl(var(--primary))';

  return (
    <svg width={width} height={height} className="overflow-visible">
      <path d={pathD} fill="none" stroke={strokeColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      {validPoints.length > 0 && (
        <circle
          cx={Number(validPoints[validPoints.length - 1].split(',')[0])}
          cy={Number(validPoints[validPoints.length - 1].split(',')[1])}
          r="2.5"
          fill={strokeColor}
        />
      )}
    </svg>
  );
};

export const CumprimentoView = () => {
  const [selectedUnidadesIds, setSelectedUnidadesIds] = useSessionState<string[]>('filter_unidades_cumprimento', []);
  const [zoomLevel, setZoomLevel] = useSessionState<number>('filter_zoom_cumprimento', 1);
  const [unidadesDropdownOpen, setUnidadesDropdownOpen] = useState(false);
  const [draftUnidadesIds, setDraftUnidadesIds] = useState<string[]>(selectedUnidadesIds);
  const { mutate: syncPlanejamento, isPending: isSyncing } = useSyncPlanejamento();

  const { data, isLoading, isError, lastUpdated, refetch } = useCumprimentoData(selectedUnidadesIds);
  const { data: bdMetasData = [], isLoading: isBdMetasLoading } = useBdMetasData(selectedUnidadesIds);

  // Filtros locais (persistidos em sessão)
  const [selectedMeses, setSelectedMeses] = useSessionState<string[]>('filter_meses_cumprimento', []);
  const [filterStart, setFilterStart] = useSessionState<string>('filter_start_cumprimento', '');
  const [filterEnd, setFilterEnd] = useSessionState<string>('filter_end_cumprimento', '');
  const [selectedSupervisores, setSelectedSupervisores] = useSessionState<string[]>('filter_supervisores_cumprimento', []);
  const [supervisoresDropdownOpen, setSupervisoresDropdownOpen] = useState(false);
  const [selectedEquipes, setSelectedEquipes] = useSessionState<string[]>('filter_equipes_cumprimento', []);
  const [equipesDropdownOpen, setEquipesDropdownOpen] = useState(false);
  const [selectedProjetos, setSelectedProjetos] = useSessionState<string[]>('filter_projetos_cumprimento', []);
  
  // Toggle "Somente Disponíveis"
  const [somenteDisponiveis, setSomenteDisponiveis] = useState(false);

  // Filtro "Tipo de Equipe"
  const [selectedTiposEquipe, setSelectedTiposEquipe] = useState<string[]>(['CONSTRUÇÃO', 'LINHA VIVA']);
  const [tiposEquipeDropdownOpen, setTiposEquipeDropdownOpen] = useState(false);

  // Novos estados do Redesign
  const [janela, setJanela] = useSessionState<number>('filter_janela_cumprimento', 6);
  const [chartMode, setChartMode] = useState<'grid' | 'line'>('grid');
  const [unidadeAtiva, setUnidadeAtiva] = useState<string | null>(null);

  // Tooltip Flutuante que Segue o Cursor do Mouse
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [activeHoverData, setActiveHoverData] = useState<{
    title: string;
    producaoPerc?: number | null;
    items?: Array<{ label: string; value: string; color?: string }>;
  } | null>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  };

  // Mapear Equipe para TipoEquipe
  const { equipeToTipo, tiposEquipeUnicos } = useMemo(() => {
    const map = new Map<string, string>();
    const tipos = new Set<string>();
    
    bdMetasData.forEach(row => {
      map.set(row.equipe, row.tipoEquipe);
      tipos.add(row.tipoEquipe);
    });
    
    return {
      equipeToTipo: map,
      tiposEquipeUnicos: Array.from(tipos).sort()
    };
  }, [bdMetasData]);

  // Extrair opções únicas dos dados
  const { mesesUnicos, supervisoresUnicos, equipesUnicas, projetosUnicos } = useMemo(() => {
    const meses = new Set<string>();
    const supervisores = new Set<string>();
    const equipes = new Set<string>();
    const projetos = new Set<string>();

    data.forEach(row => {
      if (row.mesCurto) meses.add(row.mesCurto);
      if (row.supervisor) supervisores.add(row.supervisor);
      if (row.equipe) equipes.add(row.equipe);
      if (row.projeto) projetos.add(row.projeto);
    });

    const ORDER = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    
    return {
      mesesUnicos: Array.from(meses).sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b)),
      supervisoresUnicos: Array.from(supervisores).sort(),
      equipesUnicas: Array.from(equipes).sort(),
      projetosUnicos: Array.from(projetos).sort(),
    };
  }, [data]);

  // Aplicar Filtros Locais
  const filteredData = useMemo(() => {
    return data.filter(row => {
      if (bdMetasData.length > 0 && selectedTiposEquipe.length > 0) {
        const tipoEquipe = equipeToTipo.get(row.equipe.trim().toUpperCase());
        if (!tipoEquipe || !selectedTiposEquipe.includes(tipoEquipe)) return false;
      }
      if (selectedMeses.length > 0 && !selectedMeses.includes(row.mesCurto)) return false;
      if (filterStart || filterEnd) {
        let isWithin = true;
        if (filterStart) {
          const start = startOfDay(parse(filterStart, 'yyyy-MM-dd', new Date()));
          if (row.dataParsed < start) isWithin = false;
        }
        if (filterEnd) {
          const end = endOfDay(parse(filterEnd, 'yyyy-MM-dd', new Date()));
          if (row.dataParsed > end) isWithin = false;
        }
        if (!isWithin) return false;
      }
      if (selectedSupervisores.length > 0 && !selectedSupervisores.includes(row.supervisor)) return false;
      if (selectedEquipes.length > 0 && !selectedEquipes.includes(row.equipe)) return false;
      if (selectedProjetos.length > 0 && !selectedProjetos.includes(row.projeto)) return false;

      return true;
    });
  }, [data, selectedMeses, filterStart, filterEnd, selectedSupervisores, selectedEquipes, selectedProjetos, selectedTiposEquipe, equipeToTipo, bdMetasData]);

  // Meses exibidos em ordem cronológica crescente
  const mesesExibidos = useMemo(() => {
    const ORDER = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    let list: string[] = [];

    if (selectedMeses.length > 0) {
      list = [...selectedMeses].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
    } else {
      const meses = new Set<string>();
      filteredData.forEach(row => {
        if (row.mesCurto) meses.add(row.mesCurto);
      });
      list = Array.from(meses).sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
    }

    if (janela > 0 && list.length > janela) {
      list = list.slice(list.length - janela);
    }

    return list;
  }, [selectedMeses, filteredData, janela]);

  // Cálculos de Agrupamento por Unidade
  const chartData = useMemo(() => {
    const agrupado: Record<string, any> = {};

    filteredData.forEach(row => {
      if (somenteDisponiveis && row.valDisponivel !== 1) return;

      const uNome = row.unidadeNome.replace('UNIDADE ', '');
      if (!agrupado[uNome]) {
        agrupado[uNome] = {
          name: uNome,
          sumAL: 0, sumAO: 0, countAL: 0, countAM: 0,
          sumAQ: 0, sumAMGlob: 0,
          meses: {} as Record<string, { sumAL: number, sumAO: number, countAL: number, countAM: number, sumAQ: number, sumAM: number }>
        };
      }

      const g = agrupado[uNome];
      if (row.valPlanejado !== 0) {
        g.sumAL += row.valPlanejado;
        g.sumAO += row.valRealizado;
      }
      if (row.valPlanejado > 0) g.countAL += 1;
      if (row.valProdTurno > 0) g.countAM += 1;
      
      g.sumAQ += row.valProgTurno;
      g.sumAMGlob += row.valProdTurno;

      if (!g.meses[row.mesCurto]) {
        g.meses[row.mesCurto] = { sumAL: 0, sumAO: 0, countAL: 0, countAM: 0, sumAQ: 0, sumAM: 0 };
      }
      const gm = g.meses[row.mesCurto];
      if (row.valPlanejado !== 0) {
        gm.sumAL += row.valPlanejado;
        gm.sumAO += row.valRealizado;
      }
      if (row.valPlanejado > 0) gm.countAL += 1;
      if (row.valProdTurno > 0) gm.countAM += 1;
      gm.sumAQ += row.valProgTurno;
      gm.sumAM += row.valProdTurno;
    });

    const resultadoFinal = Object.values(agrupado).map(u => {
      const item: any = { 
        name: u.name,
        _producaoPerc: u.sumAMGlob > 0 ? (u.sumAQ / u.sumAMGlob) * 100 : 0
      };

      item._mediaGeral = u.sumAL > 0 ? Number(((u.sumAO / u.sumAL) * 100).toFixed(1)) : 0;

      mesesExibidos.forEach(m => {
        if (u.meses[m]) {
          item[m] = u.meses[m].sumAL > 0 ? Number(((u.meses[m].sumAO / u.meses[m].sumAL) * 100).toFixed(1)) : null;
          item[`${m}_prod`] = u.meses[m].sumAM > 0 ? Number(((u.meses[m].sumAQ / u.meses[m].sumAM) * 100).toFixed(1)) : null;
        } else {
          item[m] = null;
          item[`${m}_prod`] = null;
        }
      });

      const validMonths = mesesExibidos.filter(m => item[m] !== null && item[m] !== undefined);
      const latestMonth = validMonths[validMonths.length - 1] || mesesExibidos[mesesExibidos.length - 1];
      const prevMonth = validMonths[validMonths.length - 2] || mesesExibidos[mesesExibidos.length - 2];

      item._latestVal = latestMonth && item[latestMonth] !== null && item[latestMonth] !== undefined ? item[latestMonth] : null;
      item._prevVal = prevMonth && item[prevMonth] !== null && item[prevMonth] !== undefined ? item[prevMonth] : null;
      item._variation = (item._latestVal !== null && item._prevVal !== null) ? (item._latestVal - item._prevVal) : 0;

      item._sparklineData = mesesExibidos.map(m => item[m]);

      return item;
    });

    resultadoFinal.sort((a, b) => a.name.localeCompare(b.name));
    return resultadoFinal;
  }, [filteredData, somenteDisponiveis, mesesExibidos]);

  // Cálculo do Domínio Y Compartilhado (inclui valores de Produção)
  const { yMin, yMax } = useMemo(() => {
    let min = 999;
    let max = 0;

    chartData.forEach(unit => {
      mesesExibidos.forEach(m => {
        const val = unit[m];
        if (val !== null && val !== undefined && typeof val === 'number') {
          if (val < min) min = val;
          if (val > max) max = val;
        }
        const prodVal = unit[`${m}_prod`];
        if (prodVal !== null && prodVal !== undefined && typeof prodVal === 'number' && prodVal > 0) {
          if (prodVal < min) min = prodVal;
          if (prodVal > max) max = prodVal;
        }
      });
    });

    if (min === 999) min = 50;
    if (max === 0) max = 120;

    let calculatedMin = Math.max(0, Math.floor((min - 10) / 10) * 10);
    let calculatedMax = Math.ceil((max + 10) / 10) * 10;

    if (calculatedMin >= META_CUMPRIMENTO) calculatedMin = 50;
    if (calculatedMax <= META_CUMPRIMENTO) calculatedMax = 120;

    return {
      yMin: calculatedMin,
      yMax: calculatedMax
    };
  }, [chartData, mesesExibidos]);

  // KPIs
  const kpis = useMemo(() => {
    let latestMonth = '';
    for (let i = mesesExibidos.length - 1; i >= 0; i--) {
      const m = mesesExibidos[i];
      if (chartData.some(u => u[m] !== null && u[m] !== undefined)) {
        latestMonth = m;
        break;
      }
    }
    if (!latestMonth) latestMonth = mesesExibidos[mesesExibidos.length - 1] || '';
    const totalUnits = chartData.length;
    
    const validLatestVals = chartData
      .map(u => u._latestVal)
      .filter((v): v is number => v !== null && v !== undefined);

    const avgLatest = validLatestVals.length > 0
      ? validLatestVals.reduce((acc, v) => acc + v, 0) / validLatestVals.length
      : 0;

    const withinTargetCount = validLatestVals.filter(v => v >= META_CUMPRIMENTO).length;

    let bestVal = 0;
    let bestUnit = '-';
    chartData.forEach(u => {
      if (u._latestVal !== null && u._latestVal > bestVal) {
        bestVal = u._latestVal;
        bestUnit = u.name;
      }
    });

    const avgProd = chartData.length > 0
      ? chartData.reduce((acc, u) => acc + (u._producaoPerc || 0), 0) / chartData.length
      : 0;

    return {
      avgLatest,
      withinTargetCount,
      totalUnits,
      bestVal,
      bestUnit,
      avgProd,
      latestMonth
    };
  }, [chartData, mesesExibidos]);

  // Dados para o Ranking (ordenado do maior para o menor cumprimento)
  const rankingUnits = useMemo(() => {
    const sorted = [...chartData].sort((a, b) => {
      const valA = a._latestVal ?? 0;
      const valB = b._latestVal ?? 0;
      return valB - valA;
    });

    const maxVal = Math.max(...sorted.map(u => u._latestVal ?? 0), 120);

    return sorted.map(u => ({
      ...u,
      barWidthPerc: u._latestVal !== null ? Math.min(100, (u._latestVal / maxVal) * 100) : 0
    }));
  }, [chartData]);

  // Dados para o LineChart (Modo B)
  const lineChartData = useMemo(() => {
    return mesesExibidos.map(m => {
      const entry: any = { mes: m };
      chartData.forEach(unit => {
        entry[unit.name] = unit[m];
        entry[`${unit.name}_prod`] = unit[`${m}_prod`];
      });
      // Média de produção ponderada entre unidades para a linha consolidada
      const prodVals = chartData.map(u => u[`${m}_prod`]).filter((v): v is number => v !== null && v !== undefined && v > 0);
      entry['_mediaProd'] = prodVals.length > 0 ? Number((prodVals.reduce((a, b) => a + b, 0) / prodVals.length).toFixed(1)) : null;
      return entry;
    });
  }, [mesesExibidos, chartData]);

  // Estilos de Heatmap Suave para Células
  const getHeatmapStyle = (val: number | null) => {
    if (val === null || val === undefined) {
      return { bg: '#F5F2EE', text: '#A8A099' };
    }
    if (val >= 110) {
      return { bg: '#E0F2FE', text: '#0369A1' }; // Azul (≥ 110%)
    }
    if (val >= 90) {
      return { bg: '#E7F6EC', text: '#15803D' }; // Verde (90% - 109%)
    }
    if (val >= 70) {
      return { bg: '#FDF3DC', text: '#B45309' }; // Amarelo (70% - 89%)
    }
    return { bg: '#FBE5E5', text: '#B91C1C' }; // Vermelho (< 70%)
  };

  // Cor das Barras de Ranking por Faixa
  const getRankingBarColor = (val: number | null) => {
    if (val === null || val === undefined) return 'hsl(var(--muted))';
    if (val >= 110) return 'hsl(210, 85%, 45%)';
    if (val >= 90) return 'hsl(var(--success))';
    if (val >= 70) return 'hsl(var(--warning))';
    return 'hsl(var(--destructive))';
  };

  // Escala Dinâmica Compartilhada da Produção (Sem corte em 100%)
  const todasAsProducoesExibidas = useMemo(() => {
    const list: number[] = [];
    chartData.forEach(row => {
      if (typeof row._producaoPerc === 'number' && !isNaN(row._producaoPerc)) {
        list.push(row._producaoPerc);
      }
      mesesExibidos.forEach(m => {
        const p = row[`${m}_prod`];
        if (typeof p === 'number' && !isNaN(p)) {
          list.push(p);
        }
      });
    });
    return list;
  }, [chartData, mesesExibidos]);

  const maxProd = Math.max(100, ...todasAsProducoesExibidas);
  const escalaProd = Math.ceil(maxProd / 10) * 10;
  const getBarWidthPerc = (p: number) => `${((p / escalaProd) * 100).toFixed(1)}%`;
  const marca100Perc = `${((100 / escalaProd) * 100).toFixed(1)}%`;

  const getProdBarColor = (p: number) => {
    if (p >= 100) return '#1A9950';
    if (p >= 85) return '#65A30D';
    if (p >= 70) return '#EAB308';
    return '#DC3232';
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col h-full w-full items-center justify-center bg-background">
        <div className="animate-spin text-primary mb-4"><RefreshCw className="w-8 h-8" /></div>
        <p className="text-sm font-medium text-muted-foreground">Carregando dados de Cumprimento...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex-1 flex flex-col h-full w-full items-center justify-center bg-background text-destructive">
        <p className="text-sm font-medium">Falha ao carregar os dados.</p>
        <Button onClick={() => refetch()} className="mt-4" variant="outline">Tentar Novamente</Button>
      </div>
    );
  }

  return (
    <div 
      className="flex flex-col h-full w-full bg-background overflow-y-auto overflow-x-hidden custom-scrollbar relative"
      onMouseMove={handleMouseMove}
    >
      
      {/* TOOLTIP FLUTUANTE QUE SEGUE O CURSOR DO MOUSE */}
      {activeHoverData && (
        <div 
          className="fixed z-[9999] pointer-events-none bg-card border border-border/80 rounded-xl p-3 shadow-xl backdrop-blur min-w-[170px] animate-in fade-in-50 duration-100"
          style={{
            left: Math.min(mousePos.x + 16, window.innerWidth - 200),
            top: Math.min(mousePos.y + 16, window.innerHeight - 180)
          }}
        >
          <p className="font-bold text-sm text-foreground uppercase tracking-tight mb-2 border-b border-border/50 pb-1">
            {activeHoverData.title}
          </p>

          {typeof activeHoverData.producaoPerc === 'number' && !isNaN(activeHoverData.producaoPerc) && (
            <div className="flex items-center gap-2 text-xs mb-1.5 font-medium">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: getProdBarColor(activeHoverData.producaoPerc) }} />
              <span className="text-muted-foreground">Produção:</span>
              <strong className="font-bold text-foreground tabular-nums ml-auto">
                {activeHoverData.producaoPerc.toFixed(0)}%
              </strong>
            </div>
          )}

          {activeHoverData.items?.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2 text-xs mb-1 font-medium">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color || '#F97706' }} />
              <span className="text-muted-foreground">{item.label}:</span>
              <strong className="font-bold text-foreground tabular-nums ml-auto">
                {item.value}
              </strong>
            </div>
          ))}
        </div>
      )}
      
      {/* HEADER COMPACTO EM 2 FILEIRAS */}
      <div className="flex flex-col gap-2.5 p-4 shrink-0 border-b border-border sticky top-0 z-20 bg-background/85 backdrop-blur w-full">
        {/* Fileira 1 */}
        <div className="flex items-center justify-between gap-4 w-full">
          <div className="flex items-center gap-3">
            <div className="w-1 h-8 rounded-full bg-primary shrink-0" />
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider leading-none mb-1">
                PLANEJAMENTO · CUMPRIMENTO
              </p>
              <h1 className="text-xl font-bold text-foreground leading-none">
                Cumprimento do Planejamento
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <SyncIndicator />

            {/* Switch para Somente Disponíveis */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium">Somente Disponíveis</span>
              <button
                type="button"
                role="switch"
                aria-checked={somenteDisponiveis}
                onClick={() => setSomenteDisponiveis(!somenteDisponiveis)}
                className={cn(
                  "w-[26px] h-[15px] rounded-full transition-colors relative focus:outline-none",
                  somenteDisponiveis ? "bg-primary" : "bg-muted-foreground/30"
                )}
                title="Considerar apenas linhas onde a coluna BB (Disponível) é igual a 1"
              >
                <span
                  className={cn(
                    "w-[11px] h-[11px] rounded-full bg-white transition-transform absolute top-[2px] left-[2px]",
                    somenteDisponiveis ? "translate-x-[11px]" : "translate-x-0"
                  )}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Fileira 2 */}
        <div className="flex flex-nowrap items-center gap-2 overflow-x-auto custom-scrollbar pb-1 w-full text-xs">
          
          {/* Segmented Control da Janela Temporal */}
          <div className="inline-flex p-0.5 rounded-lg bg-muted/50 border border-border shrink-0">
            <button
              onClick={() => setJanela(6)}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-semibold transition-all duration-180",
                janela === 6 ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              6 meses
            </button>
            <button
              onClick={() => setJanela(12)}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-semibold transition-all duration-180",
                janela === 12 ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              12 meses
            </button>
            <button
              onClick={() => setJanela(0)}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-semibold transition-all duration-180",
                janela === 0 ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Tudo
            </button>
          </div>

          <div className="w-px h-5 bg-border shrink-0 mx-1" />

          {/* Chips de Filtros */}
          <DropdownMenu 
            open={unidadesDropdownOpen} 
            onOpenChange={(open) => {
              setUnidadesDropdownOpen(open);
              if (!open) setSelectedUnidadesIds(draftUnidadesIds);
              else setDraftUnidadesIds(selectedUnidadesIds);
            }}
          >
            <DropdownMenuTrigger asChild>
              <button className="h-[30px] px-3 rounded-full border border-border bg-card hover:bg-accent flex items-center gap-1.5 transition-colors shrink-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">UNIDADE</span>
                <span className="font-semibold text-foreground truncate max-w-[110px]">
                  {draftUnidadesIds.length === 0 || draftUnidadesIds.length === UNIDADES_PLANEJAMENTO.length
                    ? 'Todas' 
                    : draftUnidadesIds.length === 1 
                      ? UNIDADES_PLANEJAMENTO.find(u => u.id === draftUnidadesIds[0])?.nome 
                      : `${draftUnidadesIds.length} selec.`}
                </span>
                <Filter className="w-3 h-3 text-muted-foreground shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="start">
              <div className="p-2 border-b border-border flex gap-2 sticky top-0 bg-popover z-10">
                <Button variant="secondary" size="sm" className="w-full text-xs h-7" onClick={() => setDraftUnidadesIds(UNIDADES_PLANEJAMENTO.map(u => u.id))}>Selecionar todos</Button>
                <Button variant="outline" size="sm" className="w-full text-xs h-7" onClick={() => setDraftUnidadesIds([])}>Limpar</Button>
              </div>
              {UNIDADES_PLANEJAMENTO.map(u => (
                <DropdownMenuCheckboxItem key={u.id} checked={draftUnidadesIds.includes(u.id)} onCheckedChange={(checked) => {
                  if (checked) setDraftUnidadesIds([...draftUnidadesIds.filter(id => id !== u.id), u.id]);
                  else setDraftUnidadesIds(draftUnidadesIds.filter(id => id !== u.id));
                }}>{u.nome}</DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Tipo Equipe Chip */}
          <DropdownMenu open={tiposEquipeDropdownOpen} onOpenChange={setTiposEquipeDropdownOpen}>
            <DropdownMenuTrigger asChild>
              <button className="h-[30px] px-3 rounded-full border border-border bg-card hover:bg-accent flex items-center gap-1.5 transition-colors shrink-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">TIPO EQUIPE</span>
                <span className="font-semibold text-foreground truncate max-w-[110px]">
                  {selectedTiposEquipe.length === 0 ? 'Todos' : `${selectedTiposEquipe.length} selec.`}
                </span>
                <Filter className="w-3 h-3 text-muted-foreground shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 max-h-64 overflow-auto" align="start">
              <div className="p-2 border-b border-border flex gap-2 sticky top-0 bg-popover z-10">
                <Button variant="secondary" size="sm" className="w-full text-xs h-7" onClick={() => setSelectedTiposEquipe(tiposEquipeUnicos)}>Selecionar todos</Button>
                <Button variant="outline" size="sm" className="w-full text-xs h-7" onClick={() => setSelectedTiposEquipe([])}>Limpar</Button>
              </div>
              {tiposEquipeUnicos.map(t => (
                <DropdownMenuCheckboxItem key={t} checked={selectedTiposEquipe.includes(t)} onCheckedChange={(checked) => {
                  if (checked) setSelectedTiposEquipe([...selectedTiposEquipe.filter(x => x !== t), t]);
                  else setSelectedTiposEquipe(selectedTiposEquipe.filter(x => x !== t));
                }}>{t}</DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Mês Chip */}
          <FilterSelect label="MÊS" options={mesesUnicos.map(m => ({ value: m, label: m }))} selectedValues={selectedMeses} onChange={setSelectedMeses} searchable={true} />

          {/* Período Chip */}
          <div className="h-[30px] px-3 rounded-full border border-border bg-card flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">PERÍODO</span>
            <input type="date" value={filterStart} onChange={e => setFilterStart(e.target.value)} className="bg-transparent text-xs text-foreground font-semibold outline-none w-[90px]" title="Data Inicial" />
            <span className="text-muted-foreground">-</span>
            <input type="date" value={filterEnd} onChange={e => setFilterEnd(e.target.value)} className="bg-transparent text-xs text-foreground font-semibold outline-none w-[90px]" title="Data Final" />
            {(filterStart || filterEnd) && (
              <button onClick={() => { setFilterStart(''); setFilterEnd(''); }} className="text-[10px] text-muted-foreground hover:text-foreground font-bold ml-1">✕</button>
            )}
          </div>

          {/* Supervisor Chip */}
          <DropdownMenu open={supervisoresDropdownOpen} onOpenChange={setSupervisoresDropdownOpen}>
            <DropdownMenuTrigger asChild>
              <button className="h-[30px] px-3 rounded-full border border-border bg-card hover:bg-accent flex items-center gap-1.5 transition-colors shrink-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">SUPERVISOR</span>
                <span className="font-semibold text-foreground truncate max-w-[110px]">
                  {selectedSupervisores.length === 0 ? 'Todos' : `${selectedSupervisores.length} selec.`}
                </span>
                <Filter className="w-3 h-3 text-muted-foreground shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="start">
              <div className="p-2 border-b border-border flex gap-2 sticky top-0 bg-popover z-10">
                <Button variant="secondary" size="sm" className="w-full text-xs h-7" onClick={() => setSelectedSupervisores(supervisoresUnicos)}>Selecionar todos</Button>
                <Button variant="outline" size="sm" className="w-full text-xs h-7" onClick={() => setSelectedSupervisores([])}>Limpar</Button>
              </div>
              {supervisoresUnicos.map(s => (
                <DropdownMenuCheckboxItem key={s} checked={selectedSupervisores.includes(s)} onCheckedChange={(checked) => {
                  if (checked) setSelectedSupervisores([...selectedSupervisores.filter(x => x !== s), s]);
                  else setSelectedSupervisores(selectedSupervisores.filter(x => x !== s));
                }}>{s}</DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Equipe Chip */}
          <DropdownMenu open={equipesDropdownOpen} onOpenChange={setEquipesDropdownOpen}>
            <DropdownMenuTrigger asChild>
              <button className="h-[30px] px-3 rounded-full border border-border bg-card hover:bg-accent flex items-center gap-1.5 transition-colors shrink-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">EQUIPE</span>
                <span className="font-semibold text-foreground truncate max-w-[110px]">
                  {selectedEquipes.length === 0 ? 'Todas' : `${selectedEquipes.length} selec.`}
                </span>
                <Filter className="w-3 h-3 text-muted-foreground shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 max-h-64 overflow-auto" align="start">
              <div className="p-2 border-b border-border flex gap-2 sticky top-0 bg-popover z-10">
                <Button variant="secondary" size="sm" className="w-full text-xs h-7" onClick={() => setSelectedEquipes(equipesUnicas)}>Selecionar todos</Button>
                <Button variant="outline" size="sm" className="w-full text-xs h-7" onClick={() => setSelectedEquipes([])}>Limpar</Button>
              </div>
              {equipesUnicas.map(e => (
                <DropdownMenuCheckboxItem key={e} checked={selectedEquipes.includes(e)} onCheckedChange={(checked) => {
                  if (checked) setSelectedEquipes([...selectedEquipes.filter(x => x !== e), e]);
                  else setSelectedEquipes(selectedEquipes.filter(x => x !== e));
                }}>{e}</DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Projeto Chip */}
          <FilterSelect label="PROJETO" options={projetosUnicos.map(p => ({ value: p, label: p }))} selectedValues={selectedProjetos} onChange={setSelectedProjetos} searchable={true} />

          {/* Zoom Control */}
          <div className="flex items-center gap-1 bg-muted/40 rounded-full border border-border px-2 h-[30px] shrink-0">
            <button onClick={() => setZoomLevel(z => Math.max(0.5, z - 0.1))} className="text-muted-foreground hover:text-foreground" title="Diminuir Zoom">
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-bold text-muted-foreground w-9 text-center tabular-nums font-mono font-normal font-sans">{(zoomLevel * 100).toFixed(0)}%</span>
            <button onClick={() => setZoomLevel(z => Math.min(2.0, z + 0.1))} className="text-muted-foreground hover:text-foreground" title="Aumentar Zoom">
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>
      </div>

      {/* CONTEÚDO PRINCIPAL (KPIs + Gráficos/Ranking + Tabela) */}
      <div style={{ zoom: zoomLevel } as React.CSSProperties} className="flex flex-col gap-6 p-4 pb-8 w-full">
        
        {/* LINHA DE KPIS (4 CARDS) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
          {/* KPI 1: Média Geral */}
          <div className="bg-card border border-border rounded-xl p-4 shadow-[var(--shadow-card)] relative flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-[.08em] text-muted-foreground">MÉDIA GERAL</span>
            <div className="my-1.5 flex items-baseline gap-1">
              <span className="text-[30px] font-bold text-foreground tabular-nums leading-none">
                {kpis.avgLatest.toFixed(1).replace('.', ',')}%
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground">
              Meta 100% · {kpis.latestMonth}
            </span>
            <div className="w-3 h-3 rounded-[3px] bg-primary absolute top-3.5 right-3.5" />
          </div>

          {/* KPI 2: Dentro da Meta */}
          <div className="bg-card border border-border rounded-xl p-4 shadow-[var(--shadow-card)] relative flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-[.08em] text-muted-foreground">DENTRO DA META</span>
            <div className="my-1.5 flex items-baseline gap-1">
              <span className="text-[30px] font-bold text-foreground tabular-nums leading-none">
                {kpis.withinTargetCount}
              </span>
              <span className="text-xs text-muted-foreground font-medium">de {kpis.totalUnits} unidades</span>
            </div>
            <span className="text-[11px] text-muted-foreground">
              ≥ 100% no mês
            </span>
            <div className="w-3 h-3 rounded-[3px] bg-[hsl(var(--success))] absolute top-3.5 right-3.5" />
          </div>

          {/* KPI 3: Maior Cumprimento */}
          <div className="bg-card border border-border rounded-xl p-4 shadow-[var(--shadow-card)] relative flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-[.08em] text-muted-foreground">MAIOR CUMPRIMENTO</span>
            <div className="my-1.5 flex items-baseline gap-1">
              <span className="text-[30px] font-bold text-foreground tabular-nums leading-none">
                {kpis.bestVal > 0 ? `${kpis.bestVal.toFixed(1).replace('.', ',')}%` : '-'}
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground truncate">
              {kpis.bestUnit}
            </span>
            <div className="w-3 h-3 rounded-[3px] bg-[hsl(var(--success))] absolute top-3.5 right-3.5" />
          </div>

          {/* KPI 4: Produção Global */}
          <div className="bg-card border border-border rounded-xl p-4 shadow-[var(--shadow-card)] relative flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-[.08em] text-muted-foreground">PRODUÇÃO GLOBAL</span>
            <div className="my-1.5 flex items-baseline gap-1">
              <span className="text-[30px] font-bold text-foreground tabular-nums leading-none">
                {kpis.avgProd.toFixed(1).replace('.', ',')}%
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground">
              Média de execução
            </span>
            <div className="w-3 h-3 rounded-[3px] bg-[hsl(var(--warning))] absolute top-3.5 right-3.5" />
          </div>
        </div>

        {/* GRÁFICO PRINCIPAL + PAINEL DE RANKING */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full items-start">
          
          {/* GRÁFICO PRINCIPAL */}
          <div className="lg:col-span-8 border border-border rounded-xl bg-card p-4 shadow-[var(--shadow-card)] flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div>
                  <h2 className="text-base font-bold text-foreground">Evolução do Cumprimento & Produção</h2>
                  <p className="text-xs text-muted-foreground">Comparativo temporal por unidade</p>
                </div>
                {/* Legenda visual com estilo das linhas */}
                <div className="hidden sm:flex items-center gap-4 px-3 py-1 rounded-lg bg-secondary/50 border border-border text-xs font-semibold">
                  <span className="flex items-center gap-2 text-foreground">
                    <span className="w-4 h-1 bg-[#ea580c] dark:bg-[#f97316] rounded-full inline-block" />
                    Cumprimento
                  </span>
                  <span className="flex items-center gap-2 text-foreground">
                    <span className="w-4 h-0.5 border-b-2 border-dashed border-[#ef4444] inline-block" />
                    Produção
                  </span>
                </div>
              </div>

              <div className="inline-flex p-0.5 rounded-lg bg-muted/50 border border-border">
                <button
                  onClick={() => setChartMode('grid')}
                  className={cn(
                    "px-3 py-1 rounded-md text-xs font-semibold transition-all duration-180",
                    chartMode === 'grid' ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Painel por unidade
                </button>
                <button
                  onClick={() => setChartMode('line')}
                  className={cn(
                    "px-3 py-1 rounded-md text-xs font-semibold transition-all duration-180",
                    chartMode === 'line' ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Linhas
                </button>
              </div>
            </div>

            {/* MODO A: PAINEL POR UNIDADE */}
            {chartMode === 'grid' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full">
                {chartData.map(unit => {
                  const isSelected = unidadeAtiva === unit.name;
                  const latestVal = unit._latestVal;
                  const variation = unit._variation;
                  const isAboveMeta = latestVal !== null && latestVal >= META_CUMPRIMENTO;

                  // Último valor de produção disponível
                  const validProdMonths = mesesExibidos.filter(m => unit[`${m}_prod`] !== null && unit[`${m}_prod`] !== undefined && unit[`${m}_prod`] > 0);
                  const latestProdMonth = validProdMonths[validProdMonths.length - 1];
                  const latestProdVal = latestProdMonth ? unit[`${latestProdMonth}_prod`] : null;

                  const miniData = mesesExibidos.map(m => ({
                    mes: m,
                    val: unit[m],
                    prod: unit[`${m}_prod`]
                  }));

                  return (
                    <div
                      key={unit.name}
                      onClick={() => setUnidadeAtiva(isSelected ? null : unit.name)}
                      className={cn(
                        "p-3 rounded-xl border transition-all duration-180 cursor-pointer flex flex-col justify-between",
                        isSelected 
                          ? "border-primary bg-primary/[0.06] shadow-sm" 
                          : "border-border bg-card hover:border-primary/50"
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-xs text-foreground truncate">{unit.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-[#ea580c] dark:text-[#f97316] tabular-nums" title="Cumprimento">
                            C: {latestVal !== null ? `${latestVal.toFixed(1).replace('.', ',')}%` : '-'}
                          </span>
                          {latestProdVal !== null && (
                            <span className="text-[11px] font-bold text-[#ef4444] tabular-nums" title="Produção">
                              P: {latestProdVal.toFixed(1).replace('.', ',')}%
                            </span>
                          )}
                          {variation !== 0 && (
                            <span 
                              className={cn(
                                "text-[10px] font-bold px-1 py-0.5 rounded tabular-nums",
                                variation > 0 
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" 
                                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                              )}
                            >
                              {variation > 0 ? `+${variation.toFixed(1).replace('.', ',')}%` : `${variation.toFixed(1).replace('.', ',')}%`}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Mini ComposedChart com Cumprimento, Produção, Faixa de % e Labels em cada mês */}
                      <div className="h-[125px] w-full mt-1">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={miniData} margin={{ top: 14, right: 6, left: -24, bottom: 2 }}>
                            <CartesianGrid strokeDasharray="2 2" vertical={false} stroke="hsl(var(--border))" opacity={0.4} />
                            <YAxis 
                              domain={[yMin, yMax]} 
                              ticks={[0, 50, 100]}
                              tickFormatter={(v) => `${v}%`}
                              axisLine={false}
                              tickLine={false}
                              tick={{ fontSize: 8, fill: 'hsl(var(--muted-foreground))', fontWeight: 500 }}
                            />
                            <XAxis 
                              dataKey="mes" 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))', fontWeight: 600 }}
                              interval={0}
                              dy={2}
                            />
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: 'hsl(var(--card))', 
                                borderColor: 'hsl(var(--border))', 
                                borderRadius: '8px',
                                fontSize: '11px',
                                padding: '6px 10px',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                              }}
                              formatter={(val: any, name: any, item: any) => {
                                const isProd = name === 'Produção' || name === 'prod' || item?.dataKey === 'prod';
                                const label = isProd ? 'Produção' : 'Cumprimento';
                                return [val !== null && val !== undefined ? `${Number(val).toFixed(1).replace('.', ',')}%` : '-', label];
                              }}
                              labelFormatter={(label: any) => `Mês: ${label}`}
                            />
                            <ReferenceArea y1={META_CUMPRIMENTO} y2={yMax} fill="hsl(var(--success))" fillOpacity={0.06} />
                            <ReferenceLine y={META_CUMPRIMENTO} strokeDasharray="3 3" stroke="hsl(var(--muted-foreground))" opacity={0.5} />
                            <Area
                              type="monotone"
                              dataKey="val"
                              name="Cumprimento"
                              stroke={
                                isSelected 
                                  ? 'hsl(var(--primary))' 
                                  : isAboveMeta 
                                  ? 'hsl(var(--success))' 
                                  : 'hsl(var(--primary))'
                              }
                              fill={
                                isSelected 
                                  ? 'hsl(var(--primary) / 0.15)' 
                                  : isAboveMeta 
                                  ? 'hsl(var(--success) / 0.15)' 
                                  : 'hsl(var(--primary) / 0.15)'
                              }
                              strokeWidth={2}
                              dot={{ r: 3, strokeWidth: 1.5, fill: 'hsl(var(--card))' }}
                              activeDot={{ r: 5, strokeWidth: 2 }}
                            >
                              <LabelList 
                                dataKey="val" 
                                position="top"
                                offset={4}
                                formatter={(v: any) => v !== null && v !== undefined ? `${Number(v).toFixed(0)}%` : ''}
                                style={{ fontSize: '8.5px', fontWeight: '700', fill: 'hsl(var(--foreground))' }}
                              />
                            </Area>
                            <Line
                              type="monotone"
                              dataKey="prod"
                              name="Produção"
                              stroke="#ef4444"
                              strokeWidth={1.8}
                              strokeDasharray="4 3"
                              dot={{ r: 2.5, strokeWidth: 1, fill: '#ef4444' }}
                              activeDot={{ r: 4.5 }}
                              connectNulls
                            />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* MODO B: LINHAS */}
            {chartMode === 'line' && (
              <div className="h-[340px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={lineChartData} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                    <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={11} fontWeight={600} axisLine={false} tickLine={false} />
                    <YAxis 
                      domain={[yMin, yMax]} 
                      stroke="hsl(var(--muted-foreground))" 
                      fontSize={11} 
                      axisLine={false} 
                      tickLine={false} 
                      tickFormatter={(v: number) => `${v.toFixed(0)}%`}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        borderColor: 'hsl(var(--border))', 
                        borderRadius: '8px',
                        fontSize: '12px'
                      }}
                      formatter={(v: any) => [v !== null && v !== undefined ? `${Number(v).toFixed(1).replace('.', ',')}%` : '-', '']}
                    />
                    <ReferenceArea y1={META_CUMPRIMENTO} y2={yMax} fill="hsl(var(--success))" fillOpacity={0.05} />
                    <ReferenceLine 
                      y={META_CUMPRIMENTO} 
                      strokeDasharray="4 4" 
                      stroke="hsl(var(--muted-foreground))" 
                      label={{ value: 'Meta (100%)', fill: 'hsl(var(--muted-foreground))', fontSize: 10, position: 'insideTopRight' }} 
                    />
                    {chartData.map(unit => {
                      const isSelected = unidadeAtiva === unit.name;
                      return (
                        <Line
                          key={unit.name}
                          type="monotone"
                          dataKey={unit.name}
                          stroke={isSelected ? 'hsl(var(--primary))' : 'hsl(var(--border))'}
                          strokeWidth={isSelected ? 2.4 : 1.2}
                          strokeOpacity={isSelected ? 1 : 0.6}
                          dot={{ r: 3, strokeWidth: 1.5, fill: 'hsl(var(--card))' }}
                          activeDot={{ r: 5.5 }}
                        />
                      );
                    })}
                    {/* Linha de Produção Consolidada (média entre unidades) */}
                    <Line
                      type="monotone"
                      dataKey="_mediaProd"
                      name="Produção (média)"
                      stroke="#ef4444"
                      strokeWidth={2}
                      strokeDasharray="6 3"
                      dot={{ r: 3.5, strokeWidth: 1.5, fill: '#ef4444' }}
                      activeDot={{ r: 5 }}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* PAINEL DE RANKING */}
          <div className="lg:col-span-4 border border-border rounded-xl bg-card p-4 shadow-[var(--shadow-card)] flex flex-col justify-between">
            <div>
              <div className="border-b border-border pb-3 mb-3">
                <h2 className="text-base font-bold text-foreground">Ranking por Unidade</h2>
                <p className="text-xs text-muted-foreground">Mês corrente: {kpis.latestMonth}</p>
              </div>

              <div className="space-y-2.5">
                {rankingUnits.map(unit => {
                  const isSelected = unidadeAtiva === unit.name;
                  const latestVal = unit._latestVal;
                  const variation = unit._variation;

                  return (
                    <div
                      key={unit.name}
                      onClick={() => setUnidadeAtiva(isSelected ? null : unit.name)}
                      className={cn(
                        "p-2 rounded-lg transition-all duration-180 cursor-pointer flex flex-col gap-1",
                        isSelected ? "bg-primary/[0.08]" : "hover:bg-muted/40"
                      )}
                    >
                      <div className="flex items-center justify-between text-xs font-medium">
                        <span className="font-semibold text-foreground truncate">{unit.name}</span>
                        <div className="flex items-center gap-2">
                          {variation !== 0 && (
                            <span 
                              className={cn(
                                "text-[10px] font-bold tabular-nums",
                                variation > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                              )}
                            >
                              {variation > 0 ? `+${variation.toFixed(1).replace('.', ',')}%` : `${variation.toFixed(1).replace('.', ',')}%`}
                            </span>
                          )}
                          <span className="font-bold text-foreground tabular-nums">
                            {latestVal !== null ? `${latestVal.toFixed(1).replace('.', ',')}%` : '-'}
                          </span>
                        </div>
                      </div>

                      <div className="w-full bg-muted/40 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${unit.barWidthPerc}%`,
                            backgroundColor: getRankingBarColor(latestVal)
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 border-t border-border mt-4 text-[10px] text-muted-foreground">
              Barras proporcionais ao maior valor do mês. Maior é melhor.
            </div>
          </div>

        </div>

        {/* TABELA COM SPARKLINE E HEATMAP */}
        <div className="w-full border border-border rounded-xl bg-card shadow-[var(--shadow-card)] flex flex-col overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-foreground">Detalhamento de Cumprimento</h2>
              <p className="text-xs text-muted-foreground">Por mês: percentual de cumprimento na célula e, abaixo, a barra de produção do mesmo mês</p>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: '#E0F2FE', border: '1px solid #0369A1' }} />
                <span className="text-muted-foreground">≥ 110%</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: '#E7F6EC', border: '1px solid #15803D' }} />
                <span className="text-muted-foreground">90% - 109%</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: '#FDF3DC', border: '1px solid #B45309' }} />
                <span className="text-muted-foreground">70% - 89%</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: '#FBE5E5', border: '1px solid #B91C1C' }} />
                <span className="text-muted-foreground">&lt; 70%</span>
              </div>
            </div>
          </div>
          
          <div className="w-full overflow-x-auto custom-scrollbar">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-[#F7F4F0] dark:bg-muted/50 border-b border-border text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                  <th className="px-3 py-2.5 sticky left-0 z-10 bg-[#F7F4F0] dark:bg-card border-r border-border min-w-[160px]">
                    Unidade
                  </th>
                  <th className="px-3 py-2.5 min-w-[130px]">Produção</th>
                  <th className="px-3 py-2.5 min-w-[110px] text-center">Tendência</th>
                  {mesesExibidos.map(m => (
                    <th key={m} className="px-2 py-2.5 text-center min-w-[70px]">{m}</th>
                  ))}
                  <th className="px-3 py-2.5 text-center min-w-[80px]">Média</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {chartData.map((row) => {
                  const isSelected = unidadeAtiva === row.name;

                  return (
                    <tr
                      key={row.name}
                      onClick={() => setUnidadeAtiva(isSelected ? null : row.name)}
                      onMouseEnter={() => {
                        setActiveHoverData({
                          title: row.name,
                          producaoPerc: row._producaoPerc,
                          items: [
                            { label: 'Cumprimento', value: `${row._mediaGeral.toFixed(1).replace('.', ',')}%`, color: '#F97706' }
                          ]
                        });
                      }}
                      onMouseLeave={() => setActiveHoverData(null)}
                      className={cn(
                        "transition-colors duration-180 cursor-pointer",
                        isSelected ? "bg-primary/[0.08]" : "hover:bg-[#FFF7ED] dark:hover:bg-primary/5"
                      )}
                    >
                      <td className="px-3 py-2.5 font-medium whitespace-nowrap sticky left-0 z-10 bg-card border-r border-border relative">
                        {isSelected && (
                          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary" />
                        )}
                        <span className="text-xs font-semibold text-foreground">{row.name}</span>
                      </td>
                      
                      {/* Coluna Única de Produção (Barra com Régua de 100% sem corte) */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-[#EFEBE6] dark:bg-muted/60 h-[6px] rounded-full relative">
                            <div 
                              className="h-full rounded-full transition-all duration-300"
                              style={{ 
                                width: getBarWidthPerc(row._producaoPerc),
                                backgroundColor: getProdBarColor(row._producaoPerc)
                              }} 
                            />
                            <div 
                              className="absolute top-0 bottom-0 w-px bg-[#A8A099] z-10"
                              style={{ left: marca100Perc }}
                            />
                          </div>
                          <span className="text-xs font-bold tabular-nums text-foreground w-11 text-right">
                            {row._producaoPerc.toFixed(1).replace('.', ',')}%
                          </span>
                        </div>
                      </td>

                      <td className="px-2 py-2.5 text-center">
                        <Sparkline data={row._sparklineData} />
                      </td>

                      {/* Colunas dos Meses (Heatmap em Pills + Barra de Produção 3px) */}
                      {mesesExibidos.map(m => {
                        const val = row[m];
                        const style = getHeatmapStyle(val);
                        const prodVal = row[`${m}_prod`];

                        return (
                          <td 
                            key={m} 
                            className="px-1.5 py-2 text-center"
                            onMouseEnter={(e) => {
                              e.stopPropagation();
                              setActiveHoverData({
                                title: `${row.name} · ${m}`,
                                producaoPerc: prodVal,
                                items: [
                                  { label: 'Cumprimento', value: val !== null && val !== undefined ? `${val.toFixed(1).replace('.', ',')}%` : '-', color: '#F97706' }
                                ]
                              });
                            }}
                          >
                            <div className="inline-flex flex-col items-center gap-[3px]">
                              <div 
                                className="inline-flex items-center justify-center min-w-[46px] px-2 py-1 rounded-[6px] text-xs font-bold tabular-nums"
                                style={{ backgroundColor: style.bg, color: style.text }}
                              >
                                {val !== null && val !== undefined ? `${val.toFixed(1).replace('.', ',')}%` : '-'}
                              </div>

                              {prodVal !== null && prodVal !== undefined ? (
                                <div 
                                  className="w-[46px] h-[3px] bg-[#EFEBE6] dark:bg-muted/60 rounded-full relative cursor-pointer"
                                  title={`Produção em ${m}: ${Number(prodVal).toFixed(1).replace('.', ',')}%`}
                                >
                                  <div 
                                    className="h-full rounded-full transition-all duration-300"
                                    style={{
                                      width: getBarWidthPerc(Number(prodVal)),
                                      backgroundColor: getProdBarColor(Number(prodVal))
                                    }}
                                  />
                                  <div 
                                    className="absolute top-0 bottom-0 w-px bg-[#A8A099] z-10"
                                    style={{ left: marca100Perc }}
                                  />
                                </div>
                              ) : (
                                <div className="w-[46px] h-[3px]" />
                              )}
                            </div>
                          </td>
                        );
                      })}

                      <td className="px-2 py-2 text-center">
                        {(() => {
                          const style = getHeatmapStyle(row._mediaGeral);
                          return (
                            <div 
                              className="inline-flex items-center justify-center min-w-[46px] px-2 py-1 rounded-[6px] text-xs font-bold tabular-nums"
                              style={{ backgroundColor: style.bg, color: style.text }}
                            >
                              {row._mediaGeral !== null ? `${row._mediaGeral.toFixed(1).replace('.', ',')}%` : '-'}
                            </div>
                          );
                        })()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};
