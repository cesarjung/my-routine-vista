import { useState, useMemo } from 'react';
import { Filter, Calendar, RefreshCw, ZoomIn, ZoomOut, BarChart2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FilterSelect } from '@/components/ui/filter-select';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UNIDADES_PLANEJAMENTO } from '@/constants/unidades';
import { usePlanejadoMetaData } from '@/hooks/usePlanejadoMetaData';
import { usePlanejamentoRaw, useSyncPlanejamento } from '@/hooks/usePlanejamentoRaw';
import { useBdMetasData } from '@/hooks/useBdMetasData';
import { useSessionState } from '@/hooks/useSessionState';
import { useReprogramadasData } from '@/hooks/useReprogramadasData';
import { parse, startOfDay, endOfDay, isValid } from 'date-fns';
import { SyncIndicator } from '@/components/SyncIndicator';
import { cn } from '@/lib/utils';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea
} from 'recharts';

const META_PLANEJADO_META = 100; // Meta: 100% de Planejado vs Meta
const META_PLANEJADO = 100;

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

// Função de cor por faixa de desempenho de produção
const getPerformanceColor = (perc: number) => {
  if (perc >= 110) return '#2563EB'; // Azul (>= 110%)
  if (perc >= 90) return '#1A9950';  // Verde (90-109%)
  if (perc >= 70) return '#EAB308';  // Amarelo (70-89%)
  return '#DC3232';                  // Vermelho (< 70%)
};

export const PlanejadoMetaView = () => {
  const [selectedUnidadesIds, setSelectedUnidadesIds] = useSessionState<string[]>('filter_unidades_planejadometa', []);
  const [zoomLevel, setZoomLevel] = useSessionState<number>('filter_zoom_planejadometa', 1);
  const [unidadesDropdownOpen, setUnidadesDropdownOpen] = useState(false);
  const [draftUnidadesIds, setDraftUnidadesIds] = useState<string[]>(selectedUnidadesIds);
  const { mutate: syncPlanejamento, isPending: isSyncing } = useSyncPlanejamento();

  const { data, isLoading, isError, lastUpdated, refetch } = usePlanejadoMetaData(selectedUnidadesIds);
  const { data: bdMetasData = [], isLoading: isBdMetasLoading } = useBdMetasData(selectedUnidadesIds);
  const { data: reprogData = [], isLoading: isReprogLoading } = useReprogramadasData(selectedUnidadesIds);

  // Filtros locais (persistidos em sessão)
  const [selectedMeses, setSelectedMeses] = useSessionState<string[]>('filter_meses_planejadometa', []);
  const [filterStart, setFilterStart] = useSessionState<string>('filter_start_planejadometa', '');
  const [filterEnd, setFilterEnd] = useSessionState<string>('filter_end_planejadometa', '');
  const [selectedSupervisores, setSelectedSupervisores] = useSessionState<string[]>('filter_supervisores_planejadometa', []);
  const [supervisoresDropdownOpen, setSupervisoresDropdownOpen] = useState(false);
  const [selectedEquipes, setSelectedEquipes] = useSessionState<string[]>('filter_equipes_planejadometa', []);
  const [equipesDropdownOpen, setEquipesDropdownOpen] = useState(false);
  const [selectedProjetos, setSelectedProjetos] = useSessionState<string[]>('filter_projetos_planejadometa', []);
  
  // Toggles existentes
  const [somenteDisponiveis, setSomenteDisponiveis] = useState(false);
  const [somenteDiasComMeta, setSomenteDiasComMeta] = useState(false);
  const [isBaseMetas, setIsBaseMetas] = useState(false);

  // Filtro "Tipo de Equipe"
  const [selectedTiposEquipe, setSelectedTiposEquipe] = useState<string[]>(['CONSTRUÇÃO', 'LINHA VIVA']);
  const [tiposEquipeDropdownOpen, setTiposEquipeDropdownOpen] = useState(false);

  // Estados do Redesign
  const [janela, setJanela] = useSessionState<number>('filter_janela_planejadometa', 6);
  const [chartMode, setChartMode] = useState<'grid' | 'line'>('grid');
  const [unidadeAtiva, setUnidadeAtiva] = useState<string | null>(null);

  // Estados dos Novos Blocos Finais
  const [viewLevel, setViewLevel] = useState<'unidades' | 'equipes'>('unidades');
  const [selectedItemName, setSelectedItemName] = useState<string | null>(null);

  // Tooltip Flutuante que Segue o Cursor do Mouse (Estilo Clássico Solicitado no Print)
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [activeHoverData, setActiveHoverData] = useState<{
    title: string;
    producaoPerc?: number | null;
    items?: Array<{ label: string; value: string; color?: string }>;
  } | null>(null);

  const [selectedParetoMotivo, setSelectedParetoMotivo] = useState<string | null>(null);

  // Capturar Movimento do Mouse Global para o Tooltip Flutuante
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

  // Meta por unidade via BD_Metas
  const metaPorUnidadeBdMetas = useMemo(() => {
    const map = new Map<string, { total: number, porMes: Record<string, number> }>();
    if (!isBaseMetas) return map;

    bdMetasData.forEach(row => {
      if (selectedTiposEquipe.length > 0 && !selectedTiposEquipe.includes(row.tipoEquipe)) return;
      if (selectedMeses.length > 0 && !selectedMeses.includes(row.mesCurto)) return;
      if (filterStart) {
        const start = startOfDay(parse(filterStart, 'yyyy-MM-dd', new Date()));
        if (row.dataParsed < start) return;
      }
      if (filterEnd) {
        const end = endOfDay(parse(filterEnd, 'yyyy-MM-dd', new Date()));
        if (row.dataParsed > end) return;
      }

      const uNome = row.unidadeNome.replace('UNIDADE ', '').trim().toUpperCase();
      if (!map.has(uNome)) {
        map.set(uNome, { total: 0, porMes: {} });
      }
      const g = map.get(uNome)!;
      g.total += row.valorMeta;
      
      if (!g.porMes[row.mesCurto]) g.porMes[row.mesCurto] = 0;
      g.porMes[row.mesCurto] += row.valorMeta;
    });

    return map;
  }, [bdMetasData, isBaseMetas, selectedTiposEquipe, selectedMeses, filterStart, filterEnd]);

  // Mapeamento de contagem de equipes por unidade
  const unitEquipeCountMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    filteredData.forEach(row => {
      const uNome = row.unidadeNome.replace('UNIDADE ', '').trim();
      if (!map.has(uNome)) map.set(uNome, new Set());
      if (row.equipe) map.get(uNome)!.add(row.equipe.trim());
    });
    return map;
  }, [filteredData]);

  // Cálculos de Agrupamento por Unidade
  // CORREÇÃO CRÍTICA DOS RÓTULOS:
  // sumU (valPlanejado) = Planejado Vigente (%) (60.2%)
  // sumUMisto (valPlanejadoMisto) = Planejado Original (%) (72.0%)
  const chartData = useMemo(() => {
    const agrupado: Record<string, any> = {};

    filteredData.forEach(row => {
      if (somenteDiasComMeta && row.valProdTurno <= 0) return;
      if (somenteDisponiveis && row.valDisponivel !== 1) return;

      const uNome = row.unidadeNome.replace('UNIDADE ', '');
      if (!agrupado[uNome]) {
        agrupado[uNome] = {
          name: uNome,
          sumU: 0, countU: 0, countAM: 0,
          sumAQ: 0, sumAMGlob: 0,
          sumUMisto: 0,
          meses: {} as Record<string, { sumU: number, countU: number, countAM: number, sumAQ: number, sumAM: number, sumUMisto: number }>
        };
      }

      const g = agrupado[uNome];
      g.sumU += row.valPlanejado;
      g.sumUMisto += row.valPlanejadoMisto;
      if (row.valPlanejado > 0) g.countU += 1;
      if (row.valProdTurno > 0) g.countAM += 1;
      
      g.sumAQ += row.valProgTurno;
      g.sumAMGlob += row.valProdTurno;

      if (!g.meses[row.mesCurto]) {
        g.meses[row.mesCurto] = { sumU: 0, countU: 0, countAM: 0, sumAQ: 0, sumAM: 0, sumUMisto: 0 };
      }
      const gm = g.meses[row.mesCurto];
      gm.sumU += row.valPlanejado;
      gm.sumUMisto += row.valPlanejadoMisto;
      if (row.valPlanejado > 0) gm.countU += 1;
      if (row.valProdTurno > 0) gm.countAM += 1;
      gm.sumAQ += row.valProgTurno;
      if (!isBaseMetas) gm.sumAM += row.valProdTurno;
    });

    if (isBaseMetas) {
      Object.keys(agrupado).forEach(uNome => {
        const base = metaPorUnidadeBdMetas.get(uNome.trim().toUpperCase());
        if (base) {
          agrupado[uNome].sumAMGlob = base.total;
          Object.keys(agrupado[uNome].meses).forEach(m => {
             agrupado[uNome].meses[m].sumAM = base.porMes[m] || 0;
          });
        } else {
          agrupado[uNome].sumAMGlob = 0;
          Object.keys(agrupado[uNome].meses).forEach(m => {
             agrupado[uNome].meses[m].sumAM = 0;
          });
        }
      });
    }

    const resultadoFinal = Object.values(agrupado).map(u => {
      const item: any = { 
        name: u.name,
        _producaoPerc: u.sumAMGlob > 0 ? (u.sumAQ / u.sumAMGlob) * 100 : 0,
        vlrPlanejado: u.sumU,
        vlrProduzido: u.sumAQ,
        vlrMeta: u.sumAMGlob,
        vlrPlanejadoMisto: u.sumUMisto
      };

      // CORREÇÃO DOS RÓTULOS (CONFORME SISTEMA ONLINE):
      // Planejado Vigente (%): sumU / sumAMGlob (ex: 60.2%)
      // Planejado Original (%): sumUMisto / sumAMGlob (ex: 72.0%)
      item._mediaMista = u.sumAMGlob > 0 ? Number(((u.sumU / u.sumAMGlob) * 100).toFixed(1)) : 0; // Vigente
      item._mediaGeral = u.sumAMGlob > 0 ? Number(((u.sumUMisto / u.sumAMGlob) * 100).toFixed(1)) : 0; // Original

      mesesExibidos.forEach(m => {
        if (u.meses[m] && u.meses[m].sumAM > 0) {
          item[m] = Number(((u.meses[m].sumU / u.meses[m].sumAM) * 100).toFixed(1));
          item[`${m}_prod`] = Number(((u.meses[m].sumAQ / u.meses[m].sumAM) * 100).toFixed(1));
          item[`${m}_mista`] = Number(((u.meses[m].sumUMisto / u.meses[m].sumAM) * 100).toFixed(1));
        } else {
          item[m] = null;
          item[`${m}_prod`] = null;
          item[`${m}_mista`] = null;
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
  }, [filteredData, mesesExibidos, isBaseMetas, metaPorUnidadeBdMetas, somenteDiasComMeta, somenteDisponiveis]);

  // Agrupamento por Equipes para o Nível Equipes
  const equipesDetailedData = useMemo(() => {
    const agrupado: Record<string, { name: string, sumAL: number, sumAM: number, sumAQ: number, sumUMisto: number }> = {};

    filteredData.forEach(row => {
      if (somenteDiasComMeta && row.valProdTurno <= 0) return;
      if (somenteDisponiveis && row.valDisponivel !== 1) return;

      const eNome = row.equipe?.trim();
      if (!eNome) return;

      if (!agrupado[eNome]) {
        agrupado[eNome] = { name: eNome, sumAL: 0, sumAM: 0, sumAQ: 0, sumUMisto: 0 };
      }

      const g = agrupado[eNome];
      g.sumAL += row.valPlanejado;
      g.sumUMisto += row.valPlanejadoMisto;
      g.sumAQ += row.valProgTurno;
      if (!isBaseMetas) g.sumAM += row.valProdTurno;
    });

    if (isBaseMetas) {
      const metaMap = new Map<string, number>();
      bdMetasData.forEach(r => {
        if (selectedTiposEquipe.length > 0 && !selectedTiposEquipe.includes(r.tipoEquipe)) return;
        if (selectedMeses.length > 0 && !selectedMeses.includes(r.mesCurto)) return;
        const k = r.equipe.trim().toUpperCase();
        metaMap.set(k, (metaMap.get(k) || 0) + r.valorMeta);
      });

      Object.keys(agrupado).forEach(eKey => {
        const meta = metaMap.get(eKey.toUpperCase()) || 0;
        agrupado[eKey].sumAM = meta;
      });
    }

    const result = Object.values(agrupado).map(e => ({
      name: e.name,
      _producaoPerc: e.sumAM > 0 ? (e.sumAQ / e.sumAM) * 100 : 0,
      _mediaMista: e.sumAM > 0 ? (e.sumAL / e.sumAM) * 100 : 0, // Vigente (60%)
      _mediaGeral: e.sumAM > 0 ? (e.sumUMisto / e.sumAM) * 100 : 0 // Original (72%)
    }));

    result.sort((a, b) => b._producaoPerc - a._producaoPerc);
    return result;
  }, [filteredData, somenteDiasComMeta, somenteDisponiveis, isBaseMetas, bdMetasData, selectedTiposEquipe, selectedMeses]);

  // Escala Dinâmica
  const currentLevelItems = useMemo(() => {
    return viewLevel === 'unidades' 
      ? [...chartData].sort((a, b) => b._producaoPerc - a._producaoPerc) 
      : equipesDetailedData;
  }, [viewLevel, chartData, equipesDetailedData]);

  const maxValCurrentLevel = useMemo(() => {
    let max = 0;
    currentLevelItems.forEach(item => {
      if (item._producaoPerc > max) max = item._producaoPerc;
      if (item._mediaMista > max) max = item._mediaMista;
      if (item._mediaGeral > max) max = item._mediaGeral;
    });
    return max;
  }, [currentLevelItems]);

  const escala = useMemo(() => {
    return Math.max(120, Math.ceil(maxValCurrentLevel / 20) * 20);
  }, [maxValCurrentLevel]);

  const escalaMarks = useMemo(() => {
    const mid = Math.round((escala / 2) / 10) * 10;
    return [0, mid, 100, escala];
  }, [escala]);

  // Totais Globais para o Painel Lateral
  const totals = useMemo(() => {
    let totalMeta = 0;
    let totalPlanejado = 0;
    let totalProduzido = 0;

    filteredData.forEach(row => {
      if (somenteDiasComMeta && row.valProdTurno <= 0) return;
      if (somenteDisponiveis && row.valDisponivel !== 1) return;

      totalPlanejado += row.valPlanejado;
      totalProduzido += row.valProgTurno;
      if (!isBaseMetas) totalMeta += row.valProdTurno;
    });

    if (isBaseMetas) {
      metaPorUnidadeBdMetas.forEach(val => totalMeta += val.total);
    }

    const percPlanejadoMeta = totalMeta > 0 ? (totalPlanejado / totalMeta) * 100 : 0;
    const diffPP = percPlanejadoMeta - 100;

    return { 
      totalMeta, 
      totalPlanejado, 
      totalProduzido, 
      desvio: totalPlanejado - totalMeta, 
      percPlanejadoMeta,
      diffPP
    };
  }, [filteredData, somenteDiasComMeta, somenteDisponiveis, isBaseMetas, metaPorUnidadeBdMetas]);

  // Pareto Verdadeiro
  const paretoProcessed = useMemo(() => {
    const filteredReprog = reprogData.filter(row => {
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
      if (selectedEquipes.length > 0 && !selectedEquipes.includes(row.equipe)) return false;
      if (selectedProjetos.length > 0 && !selectedProjetos.includes(row.projeto)) return false;

      return true;
    });

    const map = new Map<string, { motivo: string; count: number; planejado: number }>();

    filteredReprog.forEach(r => {
      const mRaw = r.motivo ? r.motivo.toUpperCase() : 'NÃO INFORMADO';
      const m = mRaw.includes('|') ? mRaw.split('|')[0].trim() : mRaw.trim();
      if (!map.has(m)) {
        map.set(m, { motivo: m, count: 0, planejado: 0 });
      }

      const g = map.get(m)!;
      g.count += 1;
      g.planejado += r.valPlanejado;
    });

    const allItems = Array.from(map.values()).sort((a, b) => b.planejado - a.planejado);

    if (allItems.length === 0) {
      return { items: [], vitalMotivos: [], topo: 100000, totalPlanejado: 0 };
    }

    const top8 = allItems.slice(0, 8);
    const tail = allItems.slice(8);

    const items: Array<{
      motivo: string;
      planejado: number;
      count: number;
      share: number;
      cum: number;
      isVital: boolean;
    }> = [];

    const totalPlanejado = allItems.reduce((acc, x) => acc + x.planejado, 0);

    let accShare = 0;

    top8.forEach(item => {
      const share = totalPlanejado > 0 ? (item.planejado / totalPlanejado) * 100 : 0;
      const prevCum = accShare;
      accShare += share;
      const cum = Math.min(100, accShare);
      const isVital = prevCum < 80;

      items.push({
        motivo: item.motivo,
        planejado: item.planejado,
        count: item.count,
        share,
        cum,
        isVital
      });
    });

    if (tail.length > 0) {
      const tailPlanejado = tail.reduce((acc, x) => acc + x.planejado, 0);
      const tailCount = tail.reduce((acc, x) => acc + x.count, 0);
      const share = totalPlanejado > 0 ? (tailPlanejado / totalPlanejado) * 100 : 0;
      accShare += share;
      const cum = 100;

      items.push({
        motivo: `Outros (${tail.length})`,
        planejado: tailPlanejado,
        count: tailCount,
        share,
        cum,
        isVital: false
      });
    }

    const maxVal = Math.max(...items.map(i => i.planejado), 1);
    const topo = Math.ceil(maxVal / 100000) * 100000 || 100000;
    const vitalMotivos = items.filter(i => i.isVital).map(i => i.motivo);

    return { items, vitalMotivos, topo, totalPlanejado };
  }, [reprogData, bdMetasData, selectedTiposEquipe, selectedMeses, filterStart, filterEnd, selectedEquipes, selectedProjetos, equipeToTipo]);

  // Domínio Y Compartilhado
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
      });
    });

    if (min === 999) min = 50;
    if (max === 0) max = 120;

    let calculatedMin = Math.max(0, Math.floor((min - 10) / 10) * 10);
    let calculatedMax = Math.ceil((max + 10) / 10) * 10;

    if (calculatedMin >= META_PLANEJADO_META) calculatedMin = 50;
    if (calculatedMax <= META_PLANEJADO_META) calculatedMax = 120;

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

    const withinTargetCount = validLatestVals.filter(v => v >= META_PLANEJADO_META).length;

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

  // Dados para o Ranking
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
      });
      return entry;
    });
  }, [mesesExibidos, chartData]);

  // Estilos de Heatmap Suave para Células
  const getHeatmapStyle = (val: number | null) => {
    if (val === null || val === undefined) {
      return { bg: '#F5F2EE', text: '#A8A099' };
    }
    if (val >= 110) {
      return { bg: '#E0F2FE', text: '#0369A1' };
    }
    if (val >= 90) {
      return { bg: '#E7F6EC', text: '#15803D' };
    }
    if (val >= 70) {
      return { bg: '#FDF3DC', text: '#B45309' };
    }
    return { bg: '#FBE5E5', text: '#B91C1C' };
  };

  const getRankingBarColor = (val: number | null) => {
    if (val === null || val === undefined) return 'hsl(var(--muted))';
    if (val >= 110) return '#2563EB';
    if (val >= 90) return '#1A9950';
    if (val >= 70) return '#EAB308';
    return '#DC3232';
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

  if (isLoading || isBdMetasLoading) {
    return (
      <div className="flex-1 flex flex-col h-full w-full items-center justify-center bg-background">
        <div className="animate-spin text-primary mb-4"><RefreshCw className="w-8 h-8" /></div>
        <p className="text-sm font-medium text-muted-foreground">Carregando dados de Planejado x Meta...</p>
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
      
      {/* TOOLTIP FLUTUANTE QUE SEGUE O CURSOR DO MOUSE (ESTILO CLÁSSICO SOLICITADO NO PRINT) */}
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
        <div className="flex items-between justify-between gap-4 w-full">
          <div className="flex items-center gap-3">
            <div className="w-1 h-8 rounded-full bg-primary shrink-0" />
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider leading-none mb-1">
                PLANEJAMENTO · PLANEJADO X META
              </p>
              <h1 className="text-xl font-bold text-foreground leading-none">
                Percentual Planejado vs Meta
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <SyncIndicator />

            {/* Switches Verdadeiros */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
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
                  <span className={cn("w-[11px] h-[11px] rounded-full bg-white transition-transform absolute top-[2px] left-[2px]", somenteDisponiveis ? "translate-x-[11px]" : "translate-x-0")} />
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground font-medium">Apenas com Meta</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={somenteDiasComMeta}
                  onClick={() => setSomenteDiasComMeta(!somenteDiasComMeta)}
                  className={cn(
                    "w-[26px] h-[15px] rounded-full transition-colors relative focus:outline-none",
                    somenteDiasComMeta ? "bg-primary" : "bg-muted-foreground/30"
                  )}
                  title="Considerar apenas dias onde a meta é maior que zero"
                >
                  <span className={cn("w-[11px] h-[11px] rounded-full bg-white transition-transform absolute top-[2px] left-[2px]", somenteDiasComMeta ? "translate-x-[11px]" : "translate-x-0")} />
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground font-medium">Base Metas</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isBaseMetas}
                  onClick={() => setIsBaseMetas(!isBaseMetas)}
                  className={cn(
                    "w-[26px] h-[15px] rounded-full transition-colors relative focus:outline-none",
                    isBaseMetas ? "bg-primary" : "bg-muted-foreground/30"
                  )}
                  title="Usar metas da planilha BD_Metas em vez das metas diárias do Planejamento"
                >
                  <span className={cn("w-[11px] h-[11px] rounded-full bg-white transition-transform absolute top-[2px] left-[2px]", isBaseMetas ? "translate-x-[11px]" : "translate-x-0")} />
                </button>
              </div>
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

          {/* Chips de Filtros com Estilo de Fonte Uniforme em Normal Case */}
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
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Unidades</span>
                <span className="font-medium text-foreground truncate max-w-[110px] tracking-normal select-none">
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

          {/* Tipo Equipe Chip */}
          <FilterSelect label="TIPO EQUIPE" options={tiposEquipeUnicos.map(t => ({ value: t, label: t }))} selectedValues={selectedTiposEquipe} onChange={setSelectedTiposEquipe} searchable={true} />

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

          {/* Equipes Chip com Estilo de Fonte Uniforme em Normal Case */}
          <DropdownMenu open={equipesDropdownOpen} onOpenChange={setEquipesDropdownOpen}>
            <DropdownMenuTrigger asChild>
              <button className="h-[30px] px-3 rounded-full border border-border bg-card hover:bg-accent flex items-center gap-1.5 transition-colors shrink-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Equipes</span>
                <span className="font-medium text-foreground truncate max-w-[110px] tracking-normal select-none">
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

      {/* CONTEÚDO PRINCIPAL */}
      <div style={{ zoom: zoomLevel } as React.CSSProperties} className="flex flex-col gap-6 p-4 pb-8 w-full">
        
        {/* LINHA DE KPIS (4 CARDS) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
          {/* KPI 1: Média Geral (Vigente) */}
          <div className="bg-card border border-border rounded-xl p-4 shadow-[var(--shadow-card)] relative flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-[.08em] text-muted-foreground">MÉDIA GERAL (VIGENTE)</span>
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

          {/* KPI 3: Maior Percentual */}
          <div className="bg-card border border-border rounded-xl p-4 shadow-[var(--shadow-card)] relative flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-[.08em] text-muted-foreground">MAIOR PERCENTUAL</span>
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

        {/* GRÁFICO PRINCIPAL (MODO A/B) + PAINEL DE RANKING */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full items-start">
          
          {/* GRÁFICO PRINCIPAL */}
          <div className="lg:col-span-8 border border-border rounded-xl bg-card p-4 shadow-[var(--shadow-card)] flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-foreground">Evolução do Planejado x Meta</h2>
                <p className="text-xs text-muted-foreground">Visão temporal por unidade</p>
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
                  const isAboveMeta = latestVal !== null && latestVal >= META_PLANEJADO;

                  const miniData = mesesExibidos.map(m => ({
                    mes: m,
                    val: unit[m]
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
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-sm text-foreground tabular-nums">
                            {latestVal !== null ? `${latestVal.toFixed(1).replace('.', ',')}%` : '-'}
                          </span>
                          {variation !== 0 && (
                            <span 
                              className={cn(
                                "text-[10px] font-bold px-1 py-0.5 rounded tabular-nums",
                                variation > 0 
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" 
                                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                              )}
                            >
                              {variation > 0 ? `+${variation.toFixed(1).replace('.', ',')}%` : `${variation.toFixed(1).replace('.', ',')}%`}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Mini AreaChart */}
                      <div className="h-[96px] w-full mt-1">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={miniData} margin={{ top: 6, right: 6, left: 6, bottom: 2 }}>
                            <YAxis hide domain={[yMin, yMax]} />
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
                                padding: '4px 8px',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                              }}
                              formatter={(val: any) => [val !== null && val !== undefined ? `${Number(val).toFixed(1).replace('.', ',')}%` : '-', 'Planejado x Meta']}
                              labelFormatter={(label: any) => `Mês: ${label}`}
                            />
                            <ReferenceArea y1={META_PLANEJADO} y2={yMax} fill="hsl(var(--success))" fillOpacity={0.06} />
                            <ReferenceLine y={META_PLANEJADO} strokeDasharray="4 4" stroke="hsl(var(--muted-foreground))" />
                            <Area
                              type="monotone"
                              dataKey="val"
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
                            />
                          </AreaChart>
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
                    <ReferenceArea y1={META_PLANEJADO} y2={yMax} fill="hsl(var(--success))" fillOpacity={0.05} />
                    <ReferenceLine 
                      y={META_PLANEJADO} 
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
              <h2 className="text-base font-bold text-foreground">Detalhamento de Planejado x Meta</h2>
              <p className="text-xs text-muted-foreground">Por mês: percentual planejado sobre a meta na célula e, abaixo, a barra de produção do mesmo mês</p>
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
                  <th className="px-3 py-2.5 text-center min-w-[80px]">Média (Vigente)</th>
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
                            { label: 'Planejado', value: `${row._mediaMista.toFixed(0)}%`, color: '#F97706' },
                            { label: 'Plan. Original', value: `${row._mediaGeral.toFixed(0)}%`, color: '#000000' }
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
                        const mistaVal = row[`${m}_mista`];

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
                                  { label: 'Planejado', value: val !== null && val !== undefined ? `${val.toFixed(0)}%` : '-', color: '#F97706' },
                                  ...(mistaVal !== null && mistaVal !== undefined ? [{ label: 'Plan. Original', value: `${mistaVal.toFixed(0)}%`, color: '#000000' }] : [])
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
                          const style = getHeatmapStyle(row._mediaMista);
                          return (
                            <div 
                              className="inline-flex items-center justify-center min-w-[46px] px-2 py-1 rounded-[6px] text-xs font-bold tabular-nums"
                              style={{ backgroundColor: style.bg, color: style.text }}
                            >
                              {row._mediaMista !== null ? `${row._mediaMista.toFixed(1).replace('.', ',')}%` : '-'}
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
        {/* 1 & 2: BLOCO "DESEMPENHO POR UNIDADE / POR EQUIPE" + PAINEL LATERAL DE KPIS */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 w-full items-start relative">
          
          {/* 1. CARD PRINCIPAL COM SEGMENTED CONTROL (UNIDADES / EQUIPES) */}
          <div className="xl:col-span-8 border border-border rounded-xl bg-card p-5 shadow-[var(--shadow-card)] flex flex-col gap-4">
            
            {/* CABEÇALHO DO CARD COM SEGMENTED CONTROL E LEGENDA CORRIGIDA */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
              <div>
                <h2 className="text-base font-bold text-foreground">Desempenho da Produção</h2>
                <p className="text-xs text-muted-foreground">
                  {viewLevel === 'unidades' 
                    ? 'Comparativo de Produção, Planejado Vigente e Original por Unidade' 
                    : 'Comparativo por Equipe ordenado por produção decrescente'}
                </p>
              </div>

              <div className="flex items-center gap-4">
                {/* Legenda dos Marcadores */}
                <div className="hidden md:flex items-center gap-4 text-xs text-muted-foreground font-medium">
                  <div className="flex items-center gap-1.5" title="Planejado Vigente">
                    <div className="w-3 h-3 rounded-[3px] bg-[#F97706] shrink-0" />
                    <span className="text-foreground font-medium leading-normal">Planejado Vigente</span>
                  </div>
                  <div className="flex items-center gap-1.5" title="Planejado Original">
                    <div className="w-3 h-3 rounded-[3px] bg-[#3F3F3F] dark:bg-[#ffffff] shrink-0" />
                    <span className="text-foreground font-medium leading-normal">Planejado Original</span>
                  </div>
                </div>

                {/* Segmented Control 2 Níveis (Botões Unidades e Equipes) */}
                <div className="inline-flex p-0.5 rounded-lg bg-muted/50 border border-border shrink-0 font-sans">
                  <button
                    type="button"
                    onClick={() => { setViewLevel('unidades'); setSelectedItemName(null); setActiveHoverData(null); }}
                    className={cn(
                      "px-3 py-1 rounded-md text-xs font-medium normal-case tracking-normal transition-all duration-180 select-none",
                      viewLevel === 'unidades' ? "bg-card text-foreground shadow-sm font-semibold" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Unidades
                  </button>
                  <button
                    type="button"
                    onClick={() => { setViewLevel('equipes'); setSelectedItemName(null); setActiveHoverData(null); }}
                    className={cn(
                      "px-3 py-1 rounded-md text-xs font-medium normal-case tracking-normal transition-all duration-180 select-none",
                      viewLevel === 'equipes' ? "bg-card text-foreground shadow-sm font-semibold" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Equipes
                  </button>
                </div>
              </div>
            </div>

            {/* NÍVEL UNIDADES — BARRAS HORIZONTAIS */}
            {viewLevel === 'unidades' && (
              <div className="w-full flex flex-col gap-2">
                
                {/* Cabeçalho da Lista */}
                <div className="grid grid-cols-[140px_1fr_50px_50px_50px] gap-2.5 min-w-[560px] px-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  <span>Unidade</span>
                  <span>Produção &amp; Marcadores</span>
                  <span className="text-right" title="Produção Realizada %">Prod %</span>
                  <span className="text-right" title="Planejado Vigente %">Vig. %</span>
                  <span className="text-right" title="Planejado Original %">Orig. %</span>
                </div>

                {/* Container de Rolagem */}
                <div className="w-full overflow-x-auto custom-scrollbar flex flex-col gap-2.5 pt-1 pb-2">
                  {currentLevelItems.map(unit => {
                    const isSelected = selectedItemName === unit.name;
                    const numEquipes = unitEquipeCountMap.get(unit.name)?.size || 0;
                    
                    const prodWidth = Math.min(100, (unit._producaoPerc / escala) * 100);
                    const vigenteLeft = Math.min(100, (unit._mediaMista / escala) * 100);
                    const originalLeft = Math.min(100, (unit._mediaGeral / escala) * 100);

                    return (
                      <div
                        key={unit.name}
                        onClick={() => setSelectedItemName(isSelected ? null : unit.name)}
                        onMouseEnter={() => setActiveHoverData({
                          title: unit.name,
                          producaoPerc: unit._producaoPerc,
                          mediaMista: unit._mediaMista,
                          mediaGeral: unit._mediaGeral
                        })}
                        onMouseLeave={() => setActiveHoverData(null)}
                        className={cn(
                          "grid grid-cols-[140px_1fr_50px_50px_50px] gap-2.5 items-center min-w-[560px] p-2 rounded-lg transition-all duration-180 cursor-pointer group relative",
                          isSelected ? "bg-[#FFF7ED] dark:bg-primary/10 border border-primary/40" : "hover:bg-muted/40"
                        )}
                      >
                        {/* Coluna 1: Nome da Unidade e Contagem de Equipes */}
                        <div className="flex flex-col min-w-0 pr-2">
                          <span className="text-xs font-semibold text-foreground truncate">{unit.name}</span>
                          <span className="text-[10px] text-muted-foreground font-normal">{numEquipes} equipes</span>
                        </div>

                        {/* Coluna 2: Faixa 28px com Marcadores Verticais */}
                        <div className="h-[28px] bg-[#F7F4F0] dark:bg-muted/40 rounded-[4px] relative overflow-hidden flex items-center">
                          {/* Grid Lines das Marcas */}
                          {escalaMarks.map(mark => {
                            const leftPerc = (mark / escala) * 100;
                            const is100 = mark === 100;
                            return (
                              <div
                                key={mark}
                                className={cn(
                                  "absolute top-0 bottom-0 w-px pointer-events-none z-0",
                                  is100 ? "bg-muted-foreground/50 w-[1.5px]" : "bg-border/60"
                                )}
                                style={{ left: `${leftPerc}%` }}
                              />
                            );
                          })}

                          {/* Barra de Produção */}
                          <div
                            className="h-full rounded-r-[3px] transition-all duration-300 z-0"
                            style={{
                              width: `${prodWidth}%`,
                              backgroundColor: getPerformanceColor(unit._producaoPerc)
                            }}
                          />

                          {/* Marcador 1: Planejado Vigente (Laranja #F97706) */}
                          <div
                            className="absolute top-0 bottom-0 w-[3.5px] bg-[#F97706] z-10 rounded-full shadow-sm"
                            style={{ left: `calc(${vigenteLeft}% - 1.75px)` }}
                          />

                          {/* Marcador 2: Planejado Original (Escuro #3F3F3F) */}
                          <div
                            className="absolute top-0 bottom-0 w-[3.5px] bg-[#3F3F3F] dark:bg-[#ffffff] z-10 rounded-full shadow-sm"
                            style={{ left: `calc(${originalLeft}% - 1.75px)` }}
                          />
                        </div>

                        {/* Colunas 3 a 5: Valores Numéricos */}
                        <span className="text-xs font-bold tabular-nums text-right text-foreground">
                          {unit._producaoPerc.toFixed(1).replace('.', ',')}%
                        </span>
                        <span className="text-xs font-bold tabular-nums text-right text-[#F97706]">
                          {unit._mediaMista.toFixed(1).replace('.', ',')}%
                        </span>
                        <span className="text-xs font-bold tabular-nums text-right text-muted-foreground">
                          {unit._mediaGeral.toFixed(1).replace('.', ',')}%
                        </span>
                      </div>
                    );
                  })}

                  {/* Eixo Sticky com Rótulos das Marcas */}
                  <div className="grid grid-cols-[140px_1fr_50px_50px_50px] gap-2.5 min-w-[560px] px-2 pt-2 border-t border-border mt-1">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Escala</span>
                    <div className="relative h-4 w-full">
                      {escalaMarks.map((mark, idx) => {
                        const leftPerc = (mark / escala) * 100;
                        const isFirst = idx === 0;
                        const isLast = idx === escalaMarks.length - 1;
                        
                        let transformClass = "translateX(-50%)";
                        if (isFirst) transformClass = "translateX(0%)";
                        if (isLast) transformClass = "translateX(-100%)";

                        return (
                          <span
                            key={mark}
                            className="absolute text-[10px] font-bold text-muted-foreground tabular-nums"
                            style={{ 
                              left: `${leftPerc}%`, 
                              transform: transformClass 
                            }}
                          >
                            {mark}%
                          </span>
                        );
                      })}
                    </div>
                    <span />
                    <span />
                    <span />
                  </div>
                </div>

              </div>
            )}

            {/* NÍVEL EQUIPES — BARRAS VERTICAIS */}
            {viewLevel === 'equipes' && (
              <div className="w-full flex flex-col gap-2">
                <div className="w-full overflow-x-auto custom-scrollbar pt-2 pb-6">
                  <div className="h-[320px] min-w-[650px] grid grid-cols-[52px_1fr] relative">
                    
                    {/* Eixo Y à Esquerda */}
                    <div className="flex flex-col justify-between items-end pr-2 text-[10px] font-bold text-muted-foreground tabular-nums py-6">
                      <span>{escala}%</span>
                      <span>{Math.round(escala * 0.75)}%</span>
                      <span>{Math.round(escala * 0.50)}%</span>
                      <span>{Math.round(escala * 0.25)}%</span>
                      <span>0%</span>
                    </div>

                    {/* Área de Plotagem do Gráfico */}
                    <div className="relative border-l border-b border-border flex items-end gap-1.5 px-2 py-6">
                      
                      {/* Grid Lines Horizontais */}
                      <div className="absolute inset-x-0 top-6 bottom-6 flex flex-col justify-between pointer-events-none">
                        <div className="w-full h-px bg-border/40" />
                        <div className="w-full h-px bg-border/40" />
                        <div className="w-full h-px bg-border/40" />
                        <div className="w-full h-px bg-border/40" />
                        <div className="w-full h-px bg-border" />
                      </div>

                      {/* Linha Tracejada de Meta 100% */}
                      <div 
                        className="absolute inset-x-0 border-t-2 border-dashed border-muted-foreground/60 pointer-events-none z-10 flex justify-end pr-2"
                        style={{ bottom: `calc(${Math.min(100, (100 / escala) * 100)}% + 24px - 12px)` }}
                      >
                        <span className="text-[9.5px] font-bold text-muted-foreground bg-card px-1.5 py-0.5 rounded border border-border -mt-3 shadow-sm">
                          meta 100%
                        </span>
                      </div>

                      {/* Colunas por Equipe */}
                      {equipesDetailedData.map(team => {
                        const isSelected = selectedItemName === team.name;
                        const prodHeight = Math.min(100, (team._producaoPerc / escala) * 100);
                        const vigenteBottom = Math.min(100, (team._mediaMista / escala) * 100);
                        const originalBottom = Math.min(100, (team._mediaGeral / escala) * 100);

                        return (
                          <div
                            key={team.name}
                            onClick={() => setSelectedItemName(isSelected ? null : team.name)}
                            onMouseEnter={() => setActiveHoverData({
                              title: team.name,
                              producaoPerc: team._producaoPerc,
                              mediaMista: team._mediaMista,
                              mediaGeral: team._mediaGeral
                            })}
                            onMouseLeave={() => setActiveHoverData(null)}
                            className="flex-1 min-w-[16px] max-w-[48px] h-full flex flex-col justify-end items-center relative group cursor-pointer"
                          >
                            {/* Track da Coluna */}
                            <div className="w-full h-full bg-[#F7F4F0] dark:bg-muted/40 rounded-t-[4px] relative overflow-hidden flex items-end">
                              {/* Barra de Produção */}
                              <div
                                className="w-full rounded-t-[3px] transition-all duration-300"
                                style={{
                                  height: `${prodHeight}%`,
                                  backgroundColor: getPerformanceColor(team._producaoPerc)
                                }}
                              />

                              {/* Marcador Horizontal: Planejado Vigente (#F97706) */}
                              <div
                                className="absolute inset-x-0 h-[2.5px] bg-[#F97706] z-10 shadow-sm"
                                style={{ bottom: `${vigenteBottom}%` }}
                              />

                              {/* Marcador Horizontal: Planejado Original (#3F3F3F) */}
                              <div
                                className="absolute inset-x-0 h-[2.5px] bg-[#3F3F3F] dark:bg-[#ffffff] z-10 shadow-sm"
                                style={{ bottom: `${originalBottom}%` }}
                              />
                            </div>

                            {/* Código da Equipe Rotacionado (-90deg) */}
                            <span className="absolute -bottom-7 text-[9.5px] font-bold text-muted-foreground whitespace-nowrap tracking-normal transform -rotate-90 origin-center pt-1 font-mono">
                              {team.name}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Legenda de Rodapé */}
                <div className="text-xs text-muted-foreground flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-2 border-t border-border font-medium">
                  <span>Passe o mouse sobre qualquer equipe ou unidade para visualizar a legenda com os valores no local do cursor.</span>
                  <div className="flex items-center gap-4 shrink-0 font-medium">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-1 bg-[#F97706] rounded-full" />
                      <span className="text-foreground font-medium">Marcador Vigente</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-1 bg-[#3F3F3F] dark:bg-[#ffffff] rounded-full" />
                      <span className="text-foreground font-medium">Marcador Original</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* 2. PAINEL LATERAL — 4 CARDS BRANCOS */}
          <div className="xl:col-span-4 flex flex-col gap-3.5 w-full">
            
            {/* Card 1: Planejado sobre a meta */}
            <div className="bg-card border border-border rounded-xl p-4 shadow-[var(--shadow-card)] flex flex-col justify-between gap-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                PLANEJADO SOBRE A META
              </span>

              <div className="flex items-baseline gap-2">
                <span 
                  className="text-[34px] font-bold tabular-nums leading-none"
                  style={{ color: getPerformanceColor(totals.percPlanejadoMeta) }}
                >
                  {totals.percPlanejadoMeta.toFixed(1).replace('.', ',')}%
                </span>
                
                <span className={cn(
                  "text-xs font-bold tabular-nums px-1.5 py-0.5 rounded",
                  totals.diffPP >= 0 
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" 
                    : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                )}>
                  {totals.diffPP >= 0 ? `+${totals.diffPP.toFixed(1).replace('.', ',')}` : totals.diffPP.toFixed(1).replace('.', ',')} p.p.
                </span>
              </div>

              {/* Barra de Progresso com Marcador em 100% */}
              <div className="flex flex-col gap-1 w-full pt-1">
                <div className="h-[12px] bg-[#F7F4F0] dark:bg-muted/40 rounded-full relative overflow-hidden flex items-center">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(100, (totals.percPlanejadoMeta / escala) * 100)}%`,
                      backgroundColor: getPerformanceColor(totals.percPlanejadoMeta)
                    }}
                  />
                  {/* Traço Escuro na Marca de 100% */}
                  <div
                    className="absolute top-0 bottom-0 w-[2px] bg-[#3F3F3F] dark:bg-[#ffffff] z-10"
                    style={{ left: `${(100 / escala) * 100}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground tabular-nums">
                  <span>0%</span>
                  <span>100%</span>
                  <span>{escala}%</span>
                </div>
              </div>
            </div>

            {/* Card 2: Vlr meta */}
            <div className="bg-card border border-border rounded-xl p-4 shadow-[var(--shadow-card)] flex flex-col justify-between relative">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                VLR META
              </span>
              <h3 className="text-[20px] font-bold text-foreground tabular-nums leading-snug">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(totals.totalMeta)}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Soma das metas do período</p>
              <div className="w-2.5 h-2.5 rounded-[2px] bg-primary/30 absolute top-4 right-4" />
            </div>

            {/* Card 3: Vlr planejado */}
            <div className="bg-card border border-border rounded-xl p-4 shadow-[var(--shadow-card)] flex flex-col justify-between relative">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                VLR PLANEJADO
              </span>
              <h3 className="text-[20px] font-bold text-foreground tabular-nums leading-snug">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(totals.totalPlanejado)}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Valor total planejado</p>
              <div className="w-2.5 h-2.5 rounded-[2px] bg-[#F97706]/40 absolute top-4 right-4" />
            </div>

            {/* Card 4: Desvio */}
            <div className="bg-card border border-border rounded-xl p-4 shadow-[var(--shadow-card)] flex flex-col justify-between relative">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                DESVIO
              </span>
              <h3 
                className="text-[20px] font-bold tabular-nums leading-snug"
                style={{ color: totals.desvio < 0 ? '#DC3232' : '#1A9950' }}
              >
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(totals.desvio)}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Planejado minus Meta</p>
              <div 
                className="w-2.5 h-2.5 rounded-[2px] absolute top-4 right-4"
                style={{ backgroundColor: totals.desvio < 0 ? '#DC3232' : '#1A9950' }}
              />
            </div>

          </div>

        </div>

        {/* 3. PARETO DE VERDADE — MOTIVOS DE REPROGRAMAÇÃO */}
        {paretoProcessed.items.length > 0 && (
          <div className="w-full border border-border rounded-xl bg-card p-5 shadow-[var(--shadow-card)] flex flex-col gap-4">
            
            {/* Cabeçalho do Card */}
            <div className="border-b border-border pb-3">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-primary" />
                Motivos de Reprogramação (Pareto)
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Análise 80/20 do impacto de reprogramações por motivo (Top 8 + Outros)
              </p>
            </div>

            {/* Layout em Grid 56px | 1fr | 46px */}
            <div className="w-full overflow-x-auto custom-scrollbar">
              <div className="min-w-[700px] flex flex-col gap-2">
                
                <div className="grid grid-cols-[56px_1fr_46px] items-stretch h-[270px] relative">
                  
                  {/* Eixo Y Esquerdo em Valor (R$) */}
                  <div className="flex flex-col justify-between items-end pr-2 text-[10.5px] font-bold text-muted-foreground tabular-nums py-2">
                    <span>R$ {(paretoProcessed.topo / 1000).toFixed(0)}k</span>
                    <span>R$ {((paretoProcessed.topo * 0.75) / 1000).toFixed(0)}k</span>
                    <span>R$ {((paretoProcessed.topo * 0.50) / 1000).toFixed(0)}k</span>
                    <span>R$ {((paretoProcessed.topo * 0.25) / 1000).toFixed(0)}k</span>
                    <span>R$ 0</span>
                  </div>

                  {/* Área do Gráfico */}
                  <div className="relative border-l border-r border-b border-border flex items-end gap-3 px-3 py-2">
                    
                    {/* Linhas de Grade Horizontais */}
                    <div className="absolute inset-x-0 top-2 bottom-2 flex flex-col justify-between pointer-events-none">
                      <div className="w-full h-px bg-border/40" />
                      <div className="w-full h-px bg-border/40" />
                      <div className="w-full h-px bg-border/40" />
                      <div className="w-full h-px bg-border/40" />
                      <div className="w-full h-px bg-border" />
                    </div>

                    {/* Linha Tracejada dos 80% */}
                    <div 
                      className="absolute inset-x-0 border-t-2 border-dashed border-muted-foreground/60 pointer-events-none z-10 flex justify-end pr-2"
                      style={{ top: '20%' }}
                    >
                      <span className="text-[9.5px] font-bold text-muted-foreground bg-card px-1 py-0.5 rounded -mt-2.5 border border-border shadow-sm">
                        80%
                      </span>
                    </div>

                    {/* Colunas de Barras */}
                    {paretoProcessed.items.map((item) => {
                      const isSelected = selectedParetoMotivo === item.motivo;
                      const barHeight = Math.min(100, (item.planejado / paretoProcessed.topo) * 100);

                      let barColor = item.isVital ? '#F97706' : '#DCD5CC';
                      if (isSelected) barColor = '#C2410C';

                      return (
                        <div
                          key={item.motivo}
                          onClick={() => setSelectedParetoMotivo(isSelected ? null : item.motivo)}
                          className="flex-1 h-full flex flex-col justify-end items-center relative group cursor-pointer z-0"
                        >
                          <div
                            className="w-full rounded-t-[4px] transition-all duration-180 hover:opacity-90"
                            style={{
                              height: `${barHeight}%`,
                              backgroundColor: barColor
                            }}
                          />
                        </div>
                      );
                    })}

                    {/* Overlay SVG da Curva de Acumulado (Cum %) */}
                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none z-20 overflow-visible">
                      {(() => {
                        const totalCount = paretoProcessed.items.length;
                        if (totalCount === 0) return null;

                        const points = paretoProcessed.items.map((item, i) => {
                          const xPerc = ((i + 0.5) / totalCount) * 100;
                          const yPerc = 100 - item.cum;
                          return { xPerc, yPerc, cum: item.cum };
                        });

                        const pathD = points.map((p, idx) => {
                          return `${idx === 0 ? 'M' : 'L'} ${p.xPerc.toFixed(2)} ${p.yPerc.toFixed(2)}`;
                        }).join(' ');

                        return (
                          <g>
                            <path
                              d={pathD}
                              fill="none"
                              stroke="#3F3F3F"
                              strokeWidth="2.5"
                              vectorEffect="non-scaling-stroke"
                            />
                            {points.map((p, idx) => (
                              <circle
                                key={idx}
                                cx={`${p.xPerc}%`}
                                cy={`${p.yPerc}%`}
                                r="4"
                                fill="#ffffff"
                                stroke="#3F3F3F"
                                strokeWidth="2"
                              />
                            ))}
                          </g>
                        );
                      })()}
                    </svg>

                  </div>

                  {/* Eixo Y Direito em Acumulado % */}
                  <div className="flex flex-col justify-between items-start pl-2 text-[10.5px] font-bold text-muted-foreground tabular-nums py-2">
                    <span>100%</span>
                    <span>75%</span>
                    <span>50%</span>
                    <span>25%</span>
                    <span>0%</span>
                  </div>

                </div>

                {/* Eixo X com Nomes, Valores e Share (Abaixo das colunas) */}
                <div className="grid grid-cols-[56px_1fr_46px]">
                  <div />
                  <div className="flex items-start gap-3 px-3 pt-2">
                    {paretoProcessed.items.map(item => (
                      <div key={item.motivo} className="flex-1 flex flex-col min-w-0 text-center">
                        <span className={cn(
                          "text-[10.5px] truncate leading-tight",
                          item.isVital ? "font-bold text-foreground" : "font-medium text-muted-foreground"
                        )} title={item.motivo}>
                          {item.motivo}
                        </span>
                        <span className="text-[10.5px] font-bold text-foreground tabular-nums mt-0.5">
                          R$ {(item.planejado / 1000).toFixed(0)}k
                        </span>
                        <span className="text-[10px] text-muted-foreground tabular-nums">
                          {item.share.toFixed(1).replace('.', ',')}%
                        </span>
                      </div>
                    ))}
                  </div>
                  <div />
                </div>

              </div>
            </div>

            {/* Rodapé com Frase Resumo */}
            {paretoProcessed.vitalMotivos.length > 0 && (
              <div className="border-t border-border pt-3 mt-1 text-xs font-semibold text-foreground">
                <span className="text-primary font-bold">{paretoProcessed.vitalMotivos.length} motivos</span>
                {" concentram 80% do impacto: "}
                <span className="text-muted-foreground">{paretoProcessed.vitalMotivos.join(', ') + '.'}</span>
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  </div>
);
};
