import React, { useState, useMemo } from 'react';
import { Filter, Calendar, RefreshCw, Hash, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FilterSelect } from '@/components/ui/filter-select';
import { Toggle } from '@/components/ui/toggle';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UNIDADES_PLANEJAMENTO } from '@/constants/unidades';
import { useEtapasData } from '@/hooks/useEtapasData';
import { usePlanejamentoRaw, useSyncPlanejamento } from '@/hooks/usePlanejamentoRaw';
import { useSessionState } from '@/hooks/useSessionState';
import { parse, startOfDay, endOfDay, isWithinInterval, addDays, subDays, differenceInDays, isValid, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { SyncIndicator } from '@/components/SyncIndicator';
import { cn } from '@/lib/utils';

export const EtapasView = () => {
  const [selectedUnidadesIdsRaw, setSelectedUnidadesIds] = useSessionState<string[]>('filter_unidades_etapas', []);
  const selectedUnidadesIds = useMemo(() => Array.isArray(selectedUnidadesIdsRaw) ? selectedUnidadesIdsRaw : [], [selectedUnidadesIdsRaw]);

  const [zoomLevel, setZoomLevel] = useSessionState<number>('filter_zoom_etapas', 1);
  const [unidadesDropdownOpen, setUnidadesDropdownOpen] = useState(false);
  const [draftUnidadesIds, setDraftUnidadesIds] = useState<string[]>(selectedUnidadesIds);
  const { mutate: syncPlanejamento, isPending: isSyncing } = useSyncPlanejamento();

  const { data: rawData, isLoading, isError, refetch } = useEtapasData(selectedUnidadesIds);
  const data = useMemo(() => Array.isArray(rawData) ? rawData : [], [rawData]);

  // Filtros locais (persistidos em sessão)
  const [selectedMesesRaw, setSelectedMeses] = useSessionState<string[]>('filter_meses_etapas', []);
  const selectedMeses = useMemo(() => Array.isArray(selectedMesesRaw) ? selectedMesesRaw : [], [selectedMesesRaw]);

  const [filterStart, setFilterStart] = useSessionState<string>('filter_start_etapas', '');
  const [filterEnd, setFilterEnd] = useSessionState<string>('filter_end_etapas', '');

  const [selectedSupervisoresRaw, setSelectedSupervisores] = useSessionState<string[]>('filter_supervisores_etapas', []);
  const selectedSupervisores = useMemo(() => Array.isArray(selectedSupervisoresRaw) ? selectedSupervisoresRaw : [], [selectedSupervisoresRaw]);
  const [supervisoresDropdownOpen, setSupervisoresDropdownOpen] = useState(false);

  const [selectedEquipesRaw, setSelectedEquipes] = useSessionState<string[]>('filter_equipes_etapas', []);
  const selectedEquipes = useMemo(() => Array.isArray(selectedEquipesRaw) ? selectedEquipesRaw : [], [selectedEquipesRaw]);
  const [equipesDropdownOpen, setEquipesDropdownOpen] = useState(false);

  const [selectedProjetosRaw, setSelectedProjetos] = useSessionState<string[]>('filter_projetos_etapas', []);
  const selectedProjetos = useMemo(() => Array.isArray(selectedProjetosRaw) ? selectedProjetosRaw : [], [selectedProjetosRaw]);

  // Regra vital
  const [somenteDisponiveis, setSomenteDisponiveis] = useState(false);

  // Extrair opções únicas para os dropdowns
  const {
    mesesUnicos,
    supervisoresUnicos,
    equipesUnicas,
    projetosUnicos
  } = useMemo(() => {
    const mSet = new Set<string>();
    const sSet = new Set<string>();
    const eSet = new Set<string>();
    const pSet = new Set<string>();

    data.forEach(r => {
      if (r.mesCurto) mSet.add(r.mesCurto);
      if (r.supervisor) sSet.add(r.supervisor);
      if (r.equipe) eSet.add(r.equipe);
      if (r.projeto) pSet.add(r.projeto);
    });

    const mArr = Array.from(mSet);
    // Ordenar meses cronologicamente
    const mesesOrder = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    mArr.sort((a, b) => mesesOrder.indexOf(b) - mesesOrder.indexOf(a));

    return {
      mesesUnicos: mArr,
      supervisoresUnicos: Array.from(sSet).sort(),
      equipesUnicas: Array.from(eSet).sort(),
      projetosUnicos: Array.from(pSet).sort()
    };
  }, [data]);

  // Aplicar filtros
  const filteredData = useMemo(() => {
    let dtStart: Date | null = null;
    let dtEnd: Date | null = null;

    if (filterStart) {
      const parsedStart = parse(filterStart, 'yyyy-MM-dd', new Date());
      if (isValid(parsedStart)) dtStart = startOfDay(parsedStart);
    }
    if (filterEnd) {
      const parsedEnd = parse(filterEnd, 'yyyy-MM-dd', new Date());
      if (isValid(parsedEnd)) dtEnd = endOfDay(parsedEnd);
    }

    return data.filter(row => {
      if (selectedMeses.length > 0 && !selectedMeses.includes(row.mesCurto)) return false;
      if (selectedSupervisores.length > 0 && !selectedSupervisores.includes(row.supervisor)) return false;
      if (selectedEquipes.length > 0 && !selectedEquipes.includes(row.equipe)) return false;
      if (selectedProjetos.length > 0 && !selectedProjetos.includes(row.projeto)) return false;

      if (dtStart && row.dataParsed < dtStart) return false;
      if (dtEnd && row.dataParsed > dtEnd) return false;

      return true;
    });
  }, [data, selectedMeses, filterStart, filterEnd, selectedSupervisores, selectedEquipes, selectedProjetos]);

  // Meses a serem exibidos nas tabelas e gráficos
  const mesesExibidos = useMemo(() => {
    const ORDER = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    
    if (selectedMeses.length > 0) {
      return [...selectedMeses].sort((a, b) => {
        let iA = ORDER.indexOf(a);
        let iB = ORDER.indexOf(b);
        if (iA === -1) iA = 99;
        if (iB === -1) iB = 99;
        return iB - iA;
      });
    } else {
      const meses = new Set<string>();
      filteredData.forEach(row => {
        if (row.mesCurto) meses.add(row.mesCurto);
      });
      return Array.from(meses).sort((a, b) => {
        let iA = ORDER.indexOf(a);
        let iB = ORDER.indexOf(b);
        if (iA === -1) iA = 99;
        if (iB === -1) iB = 99;
        return iB - iA;
      });
    }
  }, [selectedMeses, filteredData]);

  // Construir dados para o Grid
  const gridData = useMemo(() => {
    const agrupado: Record<string, any> = {};

    filteredData.forEach(row => {
      // Regra: Desconsiderar quando não tiver meta na coluna AM
      if (row.valProdTurno <= 0) return;

      // Se "Somente Disponíveis" estiver ativo, exclui tudo que NÃO FOR 1 (100%) na coluna BB
      if (somenteDisponiveis && row.valDisponivel !== 1) return;

      const uNome = row.unidadeNome.replace('UNIDADE ', '');
      if (!agrupado[uNome]) {
        agrupado[uNome] = {
          name: uNome,
          mesesObj: {} as Record<string, { totalRows: number, grupos: Record<string, number> }>
        };
      }

      const g = agrupado[uNome].mesesObj;
      if (!g[row.mesCurto]) {
        g[row.mesCurto] = { 
          totalRows: 0, 
          grupos: { 'Conclusão': 0, 'Esc/Imp': 0, 'Esc/Im/Lç': 0, 'Implant.': 0, 'Lançamento': 0 } 
        };
      }
      
      g[row.mesCurto].totalRows += 1;
      
      if (g[row.mesCurto].grupos[row.etapaGrupo] !== undefined) {
        g[row.mesCurto].grupos[row.etapaGrupo] += 1;
      }
    });

    const categories = ['Conclusão', 'Esc/Imp', 'Esc/Im/Lç', 'Implant.', 'Lançamento'];

    const resultadoFinal = Object.values(agrupado).map(u => {
      const unitChartData = categories.map(cat => {
        const point: any = { category: cat };
        mesesExibidos.forEach(m => {
          const mData = u.mesesObj[m];
          if (mData && mData.totalRows > 0) {
            point[m] = Number(((mData.grupos[cat] / mData.totalRows) * 100).toFixed(1));
          } else {
            point[m] = 0;
          }
        });
        return point;
      });

      return {
        name: u.name,
        data: unitChartData
      };
    });

    resultadoFinal.sort((a, b) => a.name.localeCompare(b.name));
    return resultadoFinal;
  }, [filteredData, somenteDisponiveis, mesesExibidos]);

  // Configuração Fixa das 5 Etapas (Cores de Etapa)
  const ETAPAS_CONFIG: Record<string, { label: string; color: string; rgb: string }> = {
    'Conclusão': { label: 'Conclusão', color: '#1A9950', rgb: '26, 153, 80' },
    'Esc/Imp':   { label: 'Esc/Imp', color: '#F97706', rgb: '249, 119, 6' },
    'Esc/Im/Lç': { label: 'Esc/Im/Lç', color: '#EAB308', rgb: '234, 179, 24' },
    'Implant.':  { label: 'Implant.', color: '#B45309', rgb: '180, 83, 9' },
    'Lançamento': { label: 'Lançamento', color: '#3F3F3F', rgb: '63, 63, 63' }
  };

  const ETAPAS_LIST = ['Conclusão', 'Esc/Imp', 'Esc/Im/Lç', 'Implant.', 'Lançamento'];

  // Estado do Agrupamento da Tabela (Unidade | Etapa)
  const [groupBy, setGroupBy] = useSessionState<'unidade' | 'etapa'>('filter_groupby_etapas', 'unidade');

  // Cálculos de Agregação para o Card 1 (Composição Mensal) e Card 2 (Tabela Unificada)
  const { tableDataByUnit, tableDataByEtapa, composicaoMensalData, maxValPerEtapa } = useMemo(() => {
    const agrupadoUnidade: Record<string, Record<string, { totalRows: number; grupos: Record<string, number> }>> = {};
    const agrupadoMesGlobal: Record<string, { totalRows: number; grupos: Record<string, number> }> = {};

    filteredData.forEach(row => {
      // Regra: Desconsiderar quando não tiver meta na coluna AM
      if (row.valProdTurno <= 0) return;

      // Se "Somente Disponíveis" estiver ativo, exclui tudo que NÃO FOR 1 na coluna BB
      if (somenteDisponiveis && row.valDisponivel !== 1) return;

      const uNome = row.unidadeNome.replace('UNIDADE ', '');
      const m = row.mesCurto;
      const cat = row.etapaGrupo;

      // Por Unidade
      if (!agrupadoUnidade[uNome]) agrupadoUnidade[uNome] = {};
      if (!agrupadoUnidade[uNome][m]) {
        agrupadoUnidade[uNome][m] = {
          totalRows: 0,
          grupos: { 'Conclusão': 0, 'Esc/Imp': 0, 'Esc/Im/Lç': 0, 'Implant.': 0, 'Lançamento': 0 }
        };
      }
      agrupadoUnidade[uNome][m].totalRows += 1;
      if (agrupadoUnidade[uNome][m].grupos[cat] !== undefined) {
        agrupadoUnidade[uNome][m].grupos[cat] += 1;
      }

      // Global por Mês (Card 1: Composição Mensal)
      if (!agrupadoMesGlobal[m]) {
        agrupadoMesGlobal[m] = {
          totalRows: 0,
          grupos: { 'Conclusão': 0, 'Esc/Imp': 0, 'Esc/Im/Lç': 0, 'Implant.': 0, 'Lançamento': 0 }
        };
      }
      agrupadoMesGlobal[m].totalRows += 1;
      if (agrupadoMesGlobal[m].grupos[cat] !== undefined) {
        agrupadoMesGlobal[m].grupos[cat] += 1;
      }
    });

    // 1. Dados da Composição Mensal (Empilhado Global)
    const composicaoMensal = mesesExibidos.map(m => {
      const mData = agrupadoMesGlobal[m];
      const total = mData ? mData.totalRows : 0;

      const segmentos = ETAPAS_LIST.map(cat => {
        const count = mData ? (mData.grupos[cat] || 0) : 0;
        const perc = total > 0 ? (count / total) * 100 : 0;
        return {
          cat,
          perc: Number(perc.toFixed(1))
        };
      });

      return {
        mes: m,
        total,
        segmentos
      };
    });

    const unitNames = Object.keys(agrupadoUnidade).sort((a, b) => a.localeCompare(b));

    // 2. Maior Valor Por Etapa (para escala independente de intensidade por etapa)
    const maxValPerEtapa: Record<string, number> = {
      'Conclusão': 0,
      'Esc/Imp': 0,
      'Esc/Im/Lç': 0,
      'Implant.': 0,
      'Lançamento': 0
    };

    const matrix: Record<string, Record<string, Record<string, number | null>>> = {};

    unitNames.forEach(uName => {
      matrix[uName] = {};
      ETAPAS_LIST.forEach(cat => {
        matrix[uName][cat] = {};
        mesesExibidos.forEach(m => {
          const mData = agrupadoUnidade[uName]?.[m];
          if (mData && mData.totalRows > 0) {
            const val = Number(((mData.grupos[cat] / mData.totalRows) * 100).toFixed(1));
            matrix[uName][cat][m] = val;
            if (val > maxValPerEtapa[cat]) {
              maxValPerEtapa[cat] = val;
            }
          } else {
            matrix[uName][cat][m] = null;
          }
        });
      });
    });

    ETAPAS_LIST.forEach(cat => {
      if (maxValPerEtapa[cat] === 0) maxValPerEtapa[cat] = 1;
    });

    // 3. Estrutura para Agrupar por Unidade
    const tableByUnit = unitNames.map(uName => {
      const etapaRows = ETAPAS_LIST.map(cat => {
        const monthValues = mesesExibidos.map(m => matrix[uName][cat][m]);
        const validValues = monthValues.filter((v): v is number => v !== null);
        const media = validValues.length > 0
          ? validValues.reduce((acc, curr) => acc + curr, 0) / validValues.length
          : 0;

        const sparklineData = monthValues.map(v => v ?? 0);

        const lastVal = monthValues[monthValues.length - 1];
        const prevVal = monthValues[monthValues.length - 2];
        let variacao: number | null = null;
        if (lastVal !== null && prevVal !== null) {
          variacao = Number((lastVal - prevVal).toFixed(1));
        }

        return {
          etapa: cat,
          monthValues,
          media: Number(media.toFixed(1)),
          sparklineData,
          variacao
        };
      });

      return {
        unitName: uName,
        rows: etapaRows
      };
    });

    // 4. Estrutura para Agrupar por Etapa
    const tableByEtapa = ETAPAS_LIST.map(cat => {
      const unitRows = unitNames.map(uName => {
        const monthValues = mesesExibidos.map(m => matrix[uName][cat][m]);
        const validValues = monthValues.filter((v): v is number => v !== null);
        const media = validValues.length > 0
          ? validValues.reduce((acc, curr) => acc + curr, 0) / validValues.length
          : 0;

        const sparklineData = monthValues.map(v => v ?? 0);

        const lastVal = monthValues[monthValues.length - 1];
        const prevVal = monthValues[monthValues.length - 2];
        let variacao: number | null = null;
        if (lastVal !== null && prevVal !== null) {
          variacao = Number((lastVal - prevVal).toFixed(1));
        }

        return {
          unitName: uName,
          monthValues,
          media: Number(media.toFixed(1)),
          sparklineData,
          variacao
        };
      });

      return {
        etapa: cat,
        maxVal: maxValPerEtapa[cat],
        rows: unitRows
      };
    });

    return {
      tableDataByUnit: tableByUnit,
      tableDataByEtapa: tableByEtapa,
      composicaoMensalData: composicaoMensal,
      maxValPerEtapa
    };
  }, [filteredData, somenteDisponiveis, mesesExibidos]);

  // Função de Estilo da Pílula de Célula por Intensidade
  const getEtapaCellStyle = (val: number | null, cat: string) => {
    if (val === null || val === undefined) {
      return { bg: 'transparent', text: '#A1A1AA' };
    }

    const maxVal = maxValPerEtapa[cat] || 1;
    const rgb = ETAPAS_CONFIG[cat]?.rgb || '63, 63, 63';
    const intensidade = Math.min(1, Math.max(0, val / maxVal));
    const alpha = 0.05 + intensidade * 0.32;
    const bg = `rgba(${rgb}, ${alpha.toFixed(3)})`;
    const text = intensidade > 0.55 ? '#1F1F1F' : '#4B4B4B';

    return { bg, text };
  };

  // Sparkline SVG 62x22
  const EtapaSparkline = ({ data, color }: { data: number[]; color: string }) => {
    if (!data || data.length === 0) return <div className="w-[62px] h-[22px]" />;

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min === 0 ? 1 : max - min;
    const width = 62;
    const height = 22;

    const points = data.map((val, idx) => {
      const x = data.length > 1 ? (idx / (data.length - 1)) * (width - 8) + 4 : width / 2;
      const y = height - 4 - ((val - min) / range) * (height - 8);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

    const areaPoints = `${points} ${width - 4},${height} 4,${height}`;
    const lastPoint = data.length > 1 ? points.split(' ').pop()?.split(',') : null;

    return (
      <svg width={width} height={height} className="overflow-visible shrink-0">
        <polygon points={areaPoints} fill={color} fillOpacity={0.15} />
        <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        {lastPoint && (
          <circle cx={lastPoint[0]} cy={lastPoint[1]} r={2.5} fill={color} />
        )}
      </svg>
    );
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col h-full w-full items-center justify-center bg-background">
        <div className="animate-spin text-primary mb-4"><RefreshCw className="w-8 h-8" /></div>
        <p className="text-sm font-medium text-muted-foreground">Carregando dados de Etapas...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex-1 flex flex-col h-full w-full items-center justify-center text-destructive bg-background">
        <p className="text-sm font-medium">Ocorreu um erro ao carregar os dados.</p>
        <Button onClick={() => refetch()} variant="outline" className="mt-4">Tentar Novamente</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-background overflow-y-auto overflow-x-hidden custom-scrollbar relative">
      
      {/* HEADER COMPACTO */}
      <div className="flex flex-col gap-3 p-4 shrink-0 border-b border-border sticky top-0 z-10 bg-background w-full min-w-0">
        <div className="flex flex-row flex-nowrap items-end gap-4 overflow-x-auto custom-scrollbar w-full pb-2">
          <div className="shrink-0 mb-1">
            <h1 className="text-xl font-bold text-foreground mb-0.5 leading-none">Percentual Etapas</h1>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Módulo Etapas</p>
          </div>
          
          <div className="w-px h-10 bg-border shrink-0"></div>

          {/* FILTROS */}
          <div className="flex flex-nowrap items-end gap-2 shrink-0">
            
            {/* Toggle Button */}
            <div className="flex flex-col justify-center mr-2">
              <Toggle 
                pressed={somenteDisponiveis} 
                onPressedChange={setSomenteDisponiveis}
                variant="outline"
                className={cn(
                  "h-10 px-3 border transition-colors", 
                  somenteDisponiveis ? "border-primary bg-primary/10 text-primary" : ""
                )}
                title="Considerar apenas linhas onde a coluna BB (Disponível) é igual a 1"
              >
                <Hash className="w-4 h-4 mr-2" />
                Somente Disponíveis
              </Toggle>
            </div>

            <div className="flex flex-col justify-center min-w-[100px]">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Unidade</span>
              <DropdownMenu 
                open={unidadesDropdownOpen} 
                onOpenChange={(open) => {
                  setUnidadesDropdownOpen(open);
                  if (!open) setSelectedUnidadesIds(draftUnidadesIds);
                  else setDraftUnidadesIds(selectedUnidadesIds);
                }}
              >
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-between text-left font-normal text-xs h-10">
                    <span className="truncate">
                      {draftUnidadesIds.length === 0 
                        ? 'Unidades' 
                        : draftUnidadesIds.length === UNIDADES_PLANEJAMENTO.length
                          ? 'Unidades'
                          : draftUnidadesIds.length === 1 
                            ? UNIDADES_PLANEJAMENTO.find(u => u.id === draftUnidadesIds[0])?.nome 
                            : `${draftUnidadesIds.length} unid.`}
                    </span>
                    <Filter className="w-3 h-3 ml-2 opacity-50 shrink-0" />
                  </Button>
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
            </div>

            <FilterSelect label="Mês" options={mesesUnicos.map(m => ({ value: m, label: m }))} selectedValues={selectedMeses} onChange={setSelectedMeses} searchable={true} />

            <div className="flex flex-col justify-center min-w-[130px]">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 flex justify-between">Período
                {(filterStart || filterEnd) && <button onClick={() => { setFilterStart(''); setFilterEnd(''); }} className="text-foreground hover:underline ml-1">Limpar</button>}
              </span>
              <div className="flex items-center gap-1 border border-input bg-background rounded-md h-10 px-2 focus-within:ring-1 focus-within:ring-ring">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <input type="date" value={filterStart} onChange={e => setFilterStart(e.target.value)} className="bg-transparent text-xs outline-none w-[100px] text-foreground" title="Data Inicial" />
                <span className="text-muted-foreground text-xs shrink-0">-</span>
                <input type="date" value={filterEnd} onChange={e => setFilterEnd(e.target.value)} className="bg-transparent text-xs outline-none w-[100px] text-foreground" title="Data Final" />
              </div>
            </div>

            <div className="flex flex-col justify-center min-w-[100px]">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Supervisor</span>
              <DropdownMenu open={supervisoresDropdownOpen} onOpenChange={setSupervisoresDropdownOpen}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-between text-left font-normal text-xs h-10">
                    <span className="truncate">{selectedSupervisores.length === 0 ? 'Todos' : `${selectedSupervisores.length} selec.`}</span>
                    <Filter className="w-3 h-3 ml-2 opacity-50 shrink-0" />
                  </Button>
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
            </div>
            
            <div className="flex flex-col justify-center min-w-[100px]">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Equipe</span>
              <DropdownMenu open={equipesDropdownOpen} onOpenChange={setEquipesDropdownOpen}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full justify-between text-left font-normal text-xs h-10">
                    <span className="truncate">{selectedEquipes.length === 0 ? 'Todas' : `${selectedEquipes.length} selec.`}</span>
                    <Filter className="w-3 h-3 ml-2 opacity-50 shrink-0" />
                  </Button>
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
            </div>

            <FilterSelect label="Projeto" options={projetosUnicos.map(p => ({ value: p, label: p }))} selectedValues={selectedProjetos} onChange={setSelectedProjetos} searchable={true} />

            <div className="flex items-center gap-1 bg-secondary/30 rounded-md border border-border px-1 h-10 ml-2 shrink-0">
               <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoomLevel(z => Math.max(0.5, z - 0.1))} title="Diminuir Zoom">
                 <ZoomOut className="w-4 h-4 text-muted-foreground" />
               </Button>
               <span className="text-xs font-bold w-10 text-center text-muted-foreground" title="Nível de Zoom">{(zoomLevel * 100).toFixed(0)}%</span>
               <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoomLevel(z => Math.min(2.0, z + 0.1))} title="Aumentar Zoom">
                 <ZoomIn className="w-4 h-4 text-muted-foreground" />
               </Button>
            </div>

            <div className="flex items-center ml-2">
              <SyncIndicator />
            </div>
          </div>
        </div>
      </div>

      {/* CONTEÚDO PRINCIPAL REDESENHADO */}
      <div style={{ zoom: zoomLevel } as React.CSSProperties} className="flex flex-col gap-6 p-4 pb-8 w-full">
        
        {/* CABEÇALHO DO DASHBOARD + LEGENDA DAS 5 ETAPAS */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-foreground">Distribuição de Etapas</h2>
            <p className="text-xs text-muted-foreground">Evolução da composição e histórico por unidade e etapa</p>
          </div>

          {/* Legenda de 5 Cores Fixas de Etapa no Topo */}
          <div className="flex flex-wrap items-center gap-3 text-xs font-medium bg-muted/30 px-3 py-1.5 rounded-lg border border-border">
            {ETAPAS_LIST.map(cat => (
              <div key={cat} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-[3px] shrink-0" style={{ backgroundColor: ETAPAS_CONFIG[cat].color }} />
                <span className="text-foreground">{cat}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CARD 1: COMPOSIÇÃO MENSAL (GRÁFICO EMPILHADO GLOBAL) */}
        <div className="w-full border border-border rounded-xl bg-card p-4 shadow-[var(--shadow-card)] flex flex-col gap-4">
          <div>
            <h3 className="text-base font-bold text-foreground">Composição mensal</h3>
            <p className="text-xs text-muted-foreground">Participação de cada etapa no total programado do mês, somando todas as unidades</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 w-full pt-1">
            {composicaoMensalData.map(mItem => (
              <div key={mItem.mes} className="flex flex-col items-center gap-2 flex-1 min-w-[75px]">
                
                {/* Barra Empilhada (Altura 170px) */}
                <div className="h-[170px] w-full rounded-[6px] overflow-hidden bg-muted/40 flex flex-col-reverse relative shadow-inner">
                  {mItem.segmentos.map(seg => {
                    const cfg = ETAPAS_CONFIG[seg.cat];
                    const showLabel = seg.perc >= 9;

                    return (
                      <div
                        key={seg.cat}
                        style={{
                          height: `${seg.perc}%`,
                          backgroundColor: cfg.color
                        }}
                        className="w-full transition-all duration-300 relative flex items-center justify-center"
                        title={`${seg.cat} · ${mItem.mes}: ${seg.perc.toFixed(1).replace('.', ',')}% do programado`}
                      >
                        {showLabel && (
                          <span className="text-[10px] font-bold text-white tabular-nums select-none drop-shadow-sm">
                            {seg.perc.toFixed(0)}%
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Rótulo do Mês Apenas Abaixo da Barra */}
                <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                  {mItem.mes}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* CARD 2: HISTÓRICO POR ETAPA, MÊS E UNIDADE (TABELA UNIFICADA E AGRUPADA) */}
        <div className="w-full border border-border rounded-xl bg-card shadow-[var(--shadow-card)] flex flex-col overflow-hidden">
          
          {/* Header do Card 2 com Segmented Control de Agrupamento */}
          <div className="p-4 border-b border-border bg-muted/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-foreground">Histórico por etapa, mês e unidade</h3>
              <p className="text-xs text-muted-foreground">Detalhamento temporal e tendência por unidade e etapa</p>
            </div>

            {/* Segmented Control "Agrupar por: Unidade | Etapa" */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-medium text-muted-foreground">Agrupar por:</span>
              <div className="inline-flex p-0.5 rounded-lg bg-muted/50 border border-border">
                <button
                  onClick={() => setGroupBy('unidade')}
                  className={cn(
                    "px-3 py-1 rounded-md text-xs font-semibold transition-all duration-180",
                    groupBy === 'unidade' ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Unidade
                </button>
                <button
                  onClick={() => setGroupBy('etapa')}
                  className={cn(
                    "px-3 py-1 rounded-md text-xs font-semibold transition-all duration-180",
                    groupBy === 'etapa' ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Etapa
                </button>
              </div>
            </div>
          </div>

          {/* Tabela Interativa de Detalhamento */}
          <div className="w-full overflow-x-auto custom-scrollbar">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-[#F7F4F0] dark:bg-muted/50 border-b border-border text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                  <th className="px-3 py-2.5 sticky left-0 z-10 bg-[#F7F4F0] dark:bg-card border-r border-border min-w-[170px]">
                    {groupBy === 'unidade' ? 'Etapa' : 'Unidade'}
                  </th>
                  {mesesExibidos.map(m => (
                    <th key={m} className="px-2 py-2.5 text-center min-w-[70px]">{m}</th>
                  ))}
                  <th className="px-3 py-2.5 text-center min-w-[80px]">Média</th>
                  <th className="px-3 py-2.5 text-center min-w-[130px]">Tendência</th>
                </tr>
              </thead>

              {/* MODO 1: AGRUPAR POR UNIDADE */}
              {groupBy === 'unidade' && (
                <>
                  {tableDataByUnit.map(unit => (
                    <tbody key={unit.unitName} className="divide-y divide-[#F5F2EE] dark:divide-border/40">
                      {/* Linha de Cabeçalho do Bloco da Unidade */}
                      <tr className="bg-[#F7F4F0] dark:bg-muted/60 border-t border-[#E4DED7] dark:border-border">
                        <td colSpan={mesesExibidos.length + 3} className="px-3 py-2 font-bold text-xs text-foreground">
                          {unit.unitName}
                          <span className="ml-2 font-normal text-[11px] text-muted-foreground">
                            5 etapas · {mesesExibidos.length} meses
                          </span>
                        </td>
                      </tr>

                      {/* 5 Linhas de Etapas */}
                      {unit.rows.map(r => {
                        const cfg = ETAPAS_CONFIG[r.etapa];

                        return (
                          <tr key={r.etapa} className="hover:bg-muted/30 transition-colors">
                            {/* Nome da Etapa + Marcador de Cor */}
                            <td className="px-3 py-2 font-medium whitespace-nowrap sticky left-0 z-10 bg-card border-r border-border">
                              <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cfg.color }} />
                                <span className="text-xs font-semibold text-foreground">{r.etapa}</span>
                              </div>
                            </td>

                            {/* Células de Meses */}
                            {mesesExibidos.map((m, idx) => {
                              const val = r.monthValues[idx];
                              const style = getEtapaCellStyle(val, r.etapa);

                              return (
                                <td key={m} className="px-1.5 py-1.5 text-center">
                                  <div 
                                    className="inline-flex items-center justify-center min-w-[48px] px-2 py-1 rounded-[6px] text-[11.5px] font-bold tabular-nums transition-all"
                                    style={{ backgroundColor: style.bg, color: style.text }}
                                    title={`${unit.unitName} · ${r.etapa} · ${m}: ${val !== null && val !== undefined ? val.toFixed(1).replace('.', ',') : '0'}%`}
                                  >
                                    {val !== null && val !== undefined ? `${val.toFixed(1).replace('.', ',')}%` : '-'}
                                  </div>
                                </td>
                              );
                            })}

                            {/* Média */}
                            <td className="px-2 py-2 text-center">
                              <span className="text-xs font-bold text-foreground tabular-nums">
                                {r.media.toFixed(1).replace('.', ',')}%
                              </span>
                            </td>

                            {/* Tendência (Sparkline + Variação) */}
                            <td className="px-3 py-2 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <EtapaSparkline data={r.sparklineData} color={cfg.color} />
                                {r.variacao !== null && (
                                  <span 
                                    className={cn(
                                      "text-[10px] font-bold tabular-nums px-1 py-0.5 rounded",
                                      r.variacao > 0 
                                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" 
                                        : r.variacao < 0 
                                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" 
                                        : "text-muted-foreground"
                                    )}
                                  >
                                    {r.variacao > 0 ? `+${r.variacao.toFixed(1).replace('.', ',')}` : r.variacao.toFixed(1).replace('.', ',')}
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  ))}
                </>
              )}

              {/* MODO 2: AGRUPAR POR ETAPA */}
              {groupBy === 'etapa' && (
                <>
                  {tableDataByEtapa.map(etapaBlock => {
                    const cfg = ETAPAS_CONFIG[etapaBlock.etapa];

                    return (
                      <tbody key={etapaBlock.etapa} className="divide-y divide-[#F5F2EE] dark:divide-border/40">
                        {/* Linha de Cabeçalho do Bloco da Etapa */}
                        <tr className="bg-[#F7F4F0] dark:bg-muted/60 border-t border-[#E4DED7] dark:border-border">
                          <td colSpan={mesesExibidos.length + 3} className="px-3 py-2 font-bold text-xs text-foreground">
                            <div className="inline-flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cfg.color }} />
                              <span>{etapaBlock.etapa}</span>
                              <span className="font-normal text-[11px] text-muted-foreground">
                                escala 0 – {etapaBlock.maxVal.toFixed(1).replace('.', ',')}% · {etapaBlock.rows.length} unidades
                              </span>
                            </div>
                          </td>
                        </tr>

                        {/* Linhas de Unidades */}
                        {etapaBlock.rows.map(r => (
                          <tr key={r.unitName} className="hover:bg-muted/30 transition-colors">
                            {/* Nome da Unidade */}
                            <td className="px-3 py-2 font-medium whitespace-nowrap sticky left-0 z-10 bg-card border-r border-border">
                              <span className="text-xs font-semibold text-foreground">{r.unitName}</span>
                            </td>

                            {/* Células de Meses */}
                            {mesesExibidos.map((m, idx) => {
                              const val = r.monthValues[idx];
                              const style = getEtapaCellStyle(val, etapaBlock.etapa);

                              return (
                                <td key={m} className="px-1.5 py-1.5 text-center">
                                  <div 
                                    className="inline-flex items-center justify-center min-w-[48px] px-2 py-1 rounded-[6px] text-[11.5px] font-bold tabular-nums transition-all"
                                    style={{ backgroundColor: style.bg, color: style.text }}
                                    title={`${r.unitName} · ${etapaBlock.etapa} · ${m}: ${val !== null && val !== undefined ? val.toFixed(1).replace('.', ',') : '0'}%`}
                                  >
                                    {val !== null && val !== undefined ? `${val.toFixed(1).replace('.', ',')}%` : '-'}
                                  </div>
                                </td>
                              );
                            })}

                            {/* Média */}
                            <td className="px-2 py-2 text-center">
                              <span className="text-xs font-bold text-foreground tabular-nums">
                                {r.media.toFixed(1).replace('.', ',')}%
                              </span>
                            </td>

                            {/* Tendência (Sparkline + Variação) */}
                            <td className="px-3 py-2 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <EtapaSparkline data={r.sparklineData} color={cfg.color} />
                                {r.variacao !== null && (
                                  <span 
                                    className={cn(
                                      "text-[10px] font-bold tabular-nums px-1 py-0.5 rounded",
                                      r.variacao > 0 
                                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" 
                                        : r.variacao < 0 
                                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" 
                                        : "text-muted-foreground"
                                    )}
                                  >
                                    {r.variacao > 0 ? `+${r.variacao.toFixed(1).replace('.', ',')}` : r.variacao.toFixed(1).replace('.', ',')}
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    );
                  })}
                </>
              )}
            </table>
          </div>

          {/* Rodapé da Tabela com Legenda de Intensidade */}
          <div className="p-3 border-t border-border bg-muted/20 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
            <span className="font-semibold text-foreground">Intensidade:</span>
            <div className="flex items-center gap-1">
              <div className="w-4 h-3 rounded bg-neutral-200/50 dark:bg-neutral-800/50" />
              <div className="w-4 h-3 rounded bg-neutral-300/60 dark:bg-neutral-700/60" />
              <div className="w-4 h-3 rounded bg-neutral-400/70 dark:bg-neutral-600/70" />
              <div className="w-4 h-3 rounded bg-neutral-600/80 dark:bg-neutral-400/80" />
              <div className="w-4 h-3 rounded bg-neutral-800 dark:bg-neutral-200" />
            </div>
            <span>clara = baixo · escura = próximo do maior valor daquela etapa</span>
          </div>

        </div>

      </div>
    </div>
  );
};

