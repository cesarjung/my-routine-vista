import React, { useState, useMemo, Fragment, useEffect } from 'react';
import { useCarteiraDashboardData } from '@/hooks/useCarteiraDashboardData';
import { CarteiraMapView } from './CarteiraMapView';
import { format, differenceInMonths, parse, startOfDay, endOfDay, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { RefreshCw, Filter, Calendar, Maximize2, Minimize2, ZoomIn, ZoomOut, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Toggle } from '@/components/ui/toggle';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { UNIDADES_PLANEJAMENTO } from '@/constants/unidades';
import { useSyncPlanejamento } from '@/hooks/usePlanejamentoRaw';
import { useSessionState } from '@/hooks/useSessionState';
import { FilterSelect } from '@/components/ui/filter-select';
import { SyncIndicator } from '@/components/SyncIndicator';
import { cn } from '@/lib/utils';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const Gauge = ({ value, max, colorClass, size = 60 }: { value: number, max: number, colorClass: string, size?: number }) => {
  const strokeWidth = size * 0.12;
  const radius = size / 2 - strokeWidth;
  const circumference = radius * Math.PI;
  const percent = max > 0 ? Math.min(value / max, 1) : 0;
  const strokeDashoffset = circumference * (1 - percent);

  return (
    <div className="relative flex flex-col items-center justify-center" style={{ width: size, height: size / 2 + strokeWidth }}>
      <svg width={size} height={size / 2 + strokeWidth} className="overflow-visible">
        <path
          d={`M ${strokeWidth} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth} ${size / 2}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className="text-muted/30"
        />
        <path
          d={`M ${strokeWidth} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth} ${size / 2}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className={`transition-all duration-1000 ease-out ${colorClass}`}
        />
      </svg>
      <div className="absolute bottom-0 left-0 w-full text-center" style={{ marginBottom: -strokeWidth }}>
        <span className="text-[10px] font-bold text-muted-foreground">{(percent * 100).toFixed(0)}%</span>
      </div>
    </div>
  );
};

export const CarteiraDashboardView = () => {
  const [selectedUnidadesIds, setSelectedUnidadesIds] = useSessionState<string[]>('filter_unidades_carteiradashboard', []);
  const [zoomLevel, setZoomLevel] = useSessionState<number>('filter_zoom_carteiradashboard', 1);
  const [draftUnidadesIds, setDraftUnidadesIds] = useState<string[]>(selectedUnidadesIds);
  const [unidadesDropdownOpen, setUnidadesDropdownOpen] = useState(false);
  const { mutate: syncPlanejamento, isPending: isSyncing } = useSyncPlanejamento();

  const { data, isLoading } = useCarteiraDashboardData(selectedUnidadesIds);

  // Estados dos filtros
  const [selectedMeses, setSelectedMeses] = useSessionState<string[]>('filter_meses_carteiradashboard', []);
  const [selectedStatus, setSelectedStatus] = useSessionState<string[]>('filter_status_carteiradashboard', []);
  const [selectedProjetos, setSelectedProjetos] = useSessionState<string[]>('filter_projetos_carteiradashboard', []);
  const [selectedMunicipios, setSelectedMunicipios] = useSessionState<string[]>('filter_municipios_carteiradashboard', []);
  const [selectedPrioridades, setSelectedPrioridades] = useSessionState<string[]>('filter_prioridades_carteiradashboard', []);
  const [selectedVistorias, setSelectedVistorias] = useSessionState<string[]>('filter_vistorias_carteiradashboard', []); // 'SIM', 'NÃO', 'VENCIDAS'
  const [selectedPostes, setSelectedPostes] = useSessionState<number[]>('filter_postes_carteiradashboard', []);
  const [selectedAVNPs, setSelectedAVNPs] = useSessionState<number[]>('filter_avnps_carteiradashboard', []);
  const [selectedRecursoDisp, setSelectedRecursoDisp] = useSessionState<string[]>('filter_recurso_disp_carteiradashboard', []);
  const [filterStart, setFilterStart] = useSessionState<string>('filter_start_carteiradashboard', '');
  const [filterEnd, setFilterEnd] = useSessionState<string>('filter_end_carteiradashboard', '');
  const [selectedSituacao, setSelectedSituacao] = useSessionState<string[]>('filter_situacao_carteiradashboard', ['APTA']);
  const [ocultarConcluidasPassado, setOcultarConcluidasPassado] = useSessionState<boolean>('filter_ocultar_concluidas_passado', true);
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);

  // Filtros computados para manter compatibilidade
  const considerarInaptas = selectedSituacao.includes('INAPTA') || selectedSituacao.length === 0;
  const mostrarApenasInaptas = selectedSituacao.length === 1 && selectedSituacao[0] === 'INAPTA';

  // Modal de detalhe por indicador
  const [activeMetricModal, setActiveMetricModal] = useState<{
    title: string;
    filterFn: (row: any) => boolean;
  } | null>(null);
  const [modalSearchTerm, setModalSearchTerm] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMapFullscreen) {
        setIsMapFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMapFullscreen]);


  // Listas de opções para os filtros
  const options = useMemo(() => {
    const meses = new Set<string>();
    const status = new Set<string>();
    const projetos = new Set<string>();
    const municipios = new Set<string>();
    const prioridades = new Set<string>();
    const postes = new Set<number>();
    const avnps = new Set<number>();

    data.carteira.forEach(row => {
      // Meses sempre adicionados independentemente do filtro
      row.meses.forEach(m => meses.add(m));

      // Se há filtro de mês ativo, só mostra opções de projetos/status/municipios etc do mês filtrado
      if (selectedMeses.length > 0 && !selectedMeses.some(m => row.meses.includes(m))) return;

      if (row.statusExecucao) status.add(row.statusExecucao);
      if (row.projeto) projetos.add(row.projeto);
      if (row.municipio) municipios.add(row.municipio);
      if (row.prioridade) prioridades.add(row.prioridade);
      if (row.postesDisponiveis !== undefined && row.postesDisponiveis !== null) postes.add(row.postesDisponiveis);
      avnps.add(row.avnpMaisRecente);
      Object.values(row.avnpMap).forEach(v => avnps.add(v));
    });

    const parseMesToDate = (m: string) => {
      if (m === 'OBRA RETIRADA') return 0;
      try {
        const cleanStr = m.replace('./', ' ');
        return parse(cleanStr, 'MMM yy', new Date(), { locale: ptBR }).getTime();
      } catch (e) {
        return 0;
      }
    };

    return {
      meses: Array.from(meses).sort((a, b) => parseMesToDate(b) - parseMesToDate(a)),
      status: Array.from(status).sort(),
      projetos: Array.from(projetos).sort(),
      municipios: Array.from(municipios).sort(),
      prioridades: Array.from(prioridades).sort(),
      postes: Array.from(postes).sort((a, b) => a - b),
      avnps: Array.from(avnps).sort((a, b) => b - a),
    };
  }, [data.carteira, selectedMeses]);

  // Aplicação dos filtros
  const filteredData = useMemo(() => {
    const now = new Date();

    const baseFiltered = data.carteira.filter(row => {
      // Filtro Mês
      if (selectedMeses.length > 0) {
        const hasMes = selectedMeses.some(m => row.meses.includes(m));
        if (!hasMes) return false;
      }

      // Filtro Status
      if (selectedStatus.length > 0 && !selectedStatus.includes(row.statusExecucao)) return false;

      // Filtro Projeto
      if (selectedProjetos.length > 0 && !selectedProjetos.includes(row.projeto)) return false;

      // Filtro Municipio
      if (selectedMunicipios.length > 0 && !selectedMunicipios.includes(row.municipio)) return false;

      // Filtro Prioridade
      if (selectedPrioridades.length > 0 && !selectedPrioridades.includes(row.prioridade)) return false;

      // Filtro Postes
      if (selectedPostes.length > 0 && !selectedPostes.includes(row.postesDisponiveis)) return false;

      // Filtro Vistoria
      if (selectedVistorias.length > 0) {
        let vistoriaStatus = 'NÃO';
        if (row.dataVistoria) {
          const diff = differenceInMonths(now, row.dataVistoria);
          vistoriaStatus = diff <= 6 ? 'SIM' : 'VENCIDAS';
        }
        if (!selectedVistorias.includes(vistoriaStatus)) return false;
      }

      // Filtro AVNP
      if (selectedAVNPs.length > 0) {
        let avnpAplicavel = row.avnpMaisRecente;
        if (selectedMeses.length === 1) {
          const mes = selectedMeses[0];
          avnpAplicavel = row.avnpMap[mes] !== undefined ? row.avnpMap[mes] : row.avnpMaisRecente;
          if (!selectedAVNPs.includes(avnpAplicavel)) return false;
        } else if (selectedMeses.length > 1) {
          const matchAVNP = selectedMeses.some(mes => {
            const val = row.avnpMap[mes] !== undefined ? row.avnpMap[mes] : row.avnpMaisRecente;
            return selectedAVNPs.includes(val);
          });
          if (!matchAVNP) return false;
        } else {
          if (!selectedAVNPs.includes(avnpAplicavel)) return false;
        }
      }

      // Filtro de Conclusões (Datas J e K)
      if (filterStart || filterEnd) {
        let isWithin = true;
        if (filterStart) {
          const start = startOfDay(parse(filterStart, 'yyyy-MM-dd', new Date()));
          if (!row.dataFim || row.dataFim < start) isWithin = false;
        }
        if (filterEnd) {
          const end = endOfDay(parse(filterEnd, 'yyyy-MM-dd', new Date()));
          if (!row.dataFim || row.dataFim > end) isWithin = false;
        }
        if (!isWithin) return false;
      }

      // Filtro Recurso Disponível
      if (selectedRecursoDisp.length > 0) {
        const recursoStatus = ((row.orcamentoValidado || 0) - (row.recursosAplicados || 0)) >= 0 ? 'SIM' : 'NÃO';
        if (!selectedRecursoDisp.includes(recursoStatus)) return false;
      }

      // Filtro Apenas Inaptas
      if (mostrarApenasInaptas && (row.obrasInaptasVal === '0' || row.obrasInaptasVal === '')) {
        return false;
      }

      return true;
    }).map(row => {
      let isConcluidaNoPassado = false;
      if (row.dataFim) {
        const fimMesTime = startOfMonth(row.dataFim).getTime();
        
        const parseMesToDateLocal = (mesStr: string) => {
          if (mesStr === 'OBRA RETIRADA') return 0;
          try {
            const cleanStr = mesStr.replace('./', ' ');
            return parse(cleanStr, 'MMM yy', new Date(), { locale: ptBR }).getTime();
          } catch (e) {
            return 0;
          }
        };

        if (selectedMeses.length > 0) {
          const mesesMatching = selectedMeses.filter(m => row.meses.includes(m));
          if (mesesMatching.length > 0) {
            isConcluidaNoPassado = mesesMatching.every(m => {
              const mTime = parseMesToDateLocal(m);
              return mTime > 0 && mTime > fimMesTime;
            });
          }
        } else {
          if (row.meses.length > 0) {
            isConcluidaNoPassado = row.meses.every(m => {
              const mTime = parseMesToDateLocal(m);
              return mTime > 0 && mTime > fimMesTime;
            });
          }
        }
      }
      
      return { ...row, isConcluidaNoPassado };
    });
    
    if (ocultarConcluidasPassado) {
      return baseFiltered.filter(row => !row.isConcluidaNoPassado);
    }
    
    return baseFiltered;
  }, [data.carteira, selectedMeses, selectedStatus, selectedProjetos, selectedMunicipios, selectedPrioridades, selectedPostes, selectedVistorias, selectedAVNPs, selectedRecursoDisp, filterStart, filterEnd, ocultarConcluidasPassado]);

  // Indicadores
  const indicators = useMemo(() => {
    let sumPostes = 0;
    let sumFaturamento = 0;
    let countVistoriadas = 0;
    let countSemOrcamento = 0;
    let sumGpm = 0;
    let sumNeoex = 0;
    let countEnergizadas = 0;
    let countConcluidas = 0;
    let countAvnp100 = 0;
    let countAvnp100Eficaz = 0;

    let countInaptas = 0;
    let sumPostesInaptas = 0;
    let sumFaturamentoInaptas = 0;

    let totalObrasAptas = 0;

    const municipioMap: Record<string, { count: number, postes: number, valor: number }> = {};

    filteredData.forEach(row => {
      const isInapta = row.obrasInaptasVal !== '0' && row.obrasInaptasVal !== '';
      const considerarApta = considerarInaptas || !isInapta;

      if (isInapta) {
        countInaptas++;
        sumPostesInaptas += row.postesDisponiveis;
        sumFaturamentoInaptas += row.capacidadeFaturamento;
      }
      if (considerarApta) {
        totalObrasAptas++;
        sumPostes += row.postesDisponiveis;
        sumFaturamento += row.capacidadeFaturamento;

        if (row.dataVistoria) countVistoriadas++;
        if (row.obrasSemOrcamentoVal === '0') countSemOrcamento++;
        if (row.dataEnergizacao) countEnergizadas++;
        if (row.statusExecucao.toUpperCase().includes('CONCLUÍD')) countConcluidas++;

        const mun = row.municipio || 'Não Informado';
        if (!municipioMap[mun]) municipioMap[mun] = { count: 0, postes: 0, valor: 0 };
        municipioMap[mun].count += 1;
        municipioMap[mun].postes += row.postesDisponiveis;
        municipioMap[mun].valor += row.capacidadeFaturamento;

        sumGpm += row.qtdGpm || 0;
        sumNeoex += row.qtdNeoex || 0;

        // Eficácia Prevista Logic
        let avnpAplicavel = row.avnpMaisRecente;
        if (selectedMeses.length === 1) {
          avnpAplicavel = row.avnpMap[selectedMeses[0]] !== undefined ? row.avnpMap[selectedMeses[0]] : row.avnpMaisRecente;
        } else if (selectedMeses.length > 1) {
          avnpAplicavel = Math.max(...selectedMeses.map(m => row.avnpMap[m] !== undefined ? row.avnpMap[m] : row.avnpMaisRecente));
        }

        if (avnpAplicavel === 1) {
          countAvnp100++;
          if (row.dataFim) {
            const mStr = `${format(row.dataFim, 'MMM', { locale: ptBR })}./${format(row.dataFim, 'yy')}`.toLowerCase();
            if (selectedMeses.length > 0) {
              if (selectedMeses.includes(mStr)) {
                countAvnp100Eficaz++;
              }
            } else {
              countAvnp100Eficaz++;
            }
          }
        }
      }
    });

    const totalObras = totalObrasAptas;
    const mediaPostes = totalObras > 0 ? sumPostes / totalObras : 0;
    const eficaciaPrevista = countAvnp100 > 0 ? (countAvnp100Eficaz / countAvnp100) * 100 : 0;

    // Municípios ranking
    const municipiosRanking = Object.entries(municipioMap)
      .map(([nome, data]) => ({
        nome,
        count: data.count,
        postes: data.postes,
        valor: data.valor,
        percent: totalObras > 0 ? (data.count / totalObras) * 100 : 0
      }))
      .sort((a, b) => b.count - a.count);

    // Metas
    let sumMetaPostes = 0;
    let sumEquipes = 0;
    let sumMetaFaturamento = 0;
    let sumMetaPostesEquipe = 0;
    let countMetaEquipe = 0;

    data.baseCurva.forEach(bc => {
      if (selectedMeses.length > 0 && !selectedMeses.includes(bc.mesMeta)) return;
      sumMetaPostes += bc.totalPostes;
      sumEquipes += bc.totalEquipes;
      sumMetaPostesEquipe += bc.metaPostesEquipe;
      countMetaEquipe++;
    });

    data.metasFaturamento.forEach(mf => {
      if (selectedMeses.length > 0 && !selectedMeses.includes(mf.mesMeta)) return;
      sumMetaFaturamento += mf.valor;
    });

    const percentMeta = sumMetaPostes > 0 ? (sumPostes / sumMetaPostes) * 100 : 0;
    const ratioEquipes = sumEquipes > 0 ? sumPostes / sumEquipes : 0;
    const metaPostesEquipeAvg = countMetaEquipe > 0 ? sumMetaPostesEquipe / countMetaEquipe : 0;

    const carteiraApta = data.carteira.filter(r => considerarInaptas || r.obrasInaptasVal === '0' || r.obrasInaptasVal === '');
    const geralTotalObras = carteiraApta.length;
    const geralSumPostes = carteiraApta.reduce((acc, r) => acc + r.postesDisponiveis, 0);

    return {
      totalObras,
      mediaPostes,
      sumPostes,
      sumFaturamento,
      countVistoriadas,
      countInaptas,
      countSemOrcamento,
      countEnergizadas,
      sumGpm,
      sumNeoex,
      countConcluidas,
      municipiosRanking,
      sumMetaPostes,
      percentMeta,
      sumEquipes,
      ratioEquipes,
      metaPostesEquipeAvg,
      sumMetaFaturamento,
      eficaciaPrevista,

      sumPostesInaptas,
      sumFaturamentoInaptas,
      geralTotalObras,
      geralSumPostes
    };
  }, [filteredData, data.baseCurva, data.metasFaturamento, selectedMeses, data.carteira, considerarInaptas]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  // Componente de badge para filtros ativos
  const FilterBadge = ({ label, onRemove }: { label: string, onRemove: () => void }) => (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
      {label}
      <button onClick={onRemove} className="ml-1 text-primary hover:text-primary/70 focus:outline-none">×</button>
    </span>
  );

  return (
    <div className="flex flex-col h-full w-full bg-background overflow-y-auto overflow-x-hidden custom-scrollbar relative">

      {/* HEADER / FILTROS BÁSICOS (Sticky) */}
      <div className="sticky top-0 z-[100] bg-background border-b border-border space-y-3 pt-4 px-6 pb-4">

        <div className="flex flex-row flex-nowrap items-end gap-4 overflow-x-auto custom-scrollbar pb-2">
          {/* Header Title */}
          <div className="shrink-0 mb-1">
            <h1 className="text-xl font-bold text-foreground mb-0.5 leading-none">Dashboard da Carteira</h1>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Gestão à Vista</p>
          </div>

          <div className="w-px h-10 bg-border shrink-0"></div>

          {/* Filters Row */}
          <div className="flex flex-nowrap items-end gap-2 shrink-0 pb-1">

            {/* Filtro Unidade */}
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
                  <Button variant="outline" className="w-full justify-between text-left font-normal text-[11px] h-8 bg-background">
                    <span className="truncate">
                      {draftUnidadesIds.length === 0
                        ? 'Unidades'
                        : draftUnidadesIds.length === UNIDADES_PLANEJAMENTO.length
                          ? 'Unidades'
                          : `${draftUnidadesIds.length} selec.`}
                    </span>
                    <Filter className="w-3 h-3 ml-2 opacity-50 shrink-0" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 max-h-[500px] overflow-y-auto z-[9999]" align="start">
                  <div className="p-2 border-b border-border flex gap-2 sticky top-0 bg-popover z-10">
                    <Button variant="secondary" size="sm" className="w-full text-xs h-7" onClick={() => setDraftUnidadesIds(UNIDADES_PLANEJAMENTO.map(u => u.id))}>Todas</Button>
                    <Button variant="outline" size="sm" className="w-full text-xs h-7" onClick={() => setDraftUnidadesIds([])}>Limpar</Button>
                  </div>
                  {UNIDADES_PLANEJAMENTO.map(u => (
                    <DropdownMenuCheckboxItem key={u.id} checked={draftUnidadesIds.includes(u.id)} onCheckedChange={(checked) => {
                      if (checked) setDraftUnidadesIds([...draftUnidadesIds.filter(id => id !== u.id), u.id]);
                      else setDraftUnidadesIds(draftUnidadesIds.filter(id => id !== u.id));
                    }} onSelect={(e) => e.preventDefault()}>{u.nome}</DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Outros filtros combinados na mesma linha, unidade ao lado de prioridade */}
            <FilterSelect label="Projeto" options={options.projetos.map(m => ({ value: m, label: m }))} selectedValues={selectedProjetos} onChange={setSelectedProjetos} searchable={true} />
            <FilterSelect label="Prioridade" options={options.prioridades.map(m => ({ value: m, label: m }))} selectedValues={selectedPrioridades} onChange={setSelectedPrioridades} />
            <FilterSelect label="Mês" options={options.meses.map(m => ({ value: m, label: m }))} selectedValues={selectedMeses} onChange={setSelectedMeses} />
            <FilterSelect label="Postes" options={options.postes.map(p => ({ value: p, label: String(p) }))} selectedValues={selectedPostes} onChange={setSelectedPostes} />
            <FilterSelect label="Vistoria" options={[
              { value: "SIM", label: "SIM (Válidas)" },
              { value: "VENCIDAS", label: "VENCIDAS (+6 meses)" },
              { value: "NÃO", label: "NÃO (Sem Data)" }
            ]} selectedValues={selectedVistorias} onChange={setSelectedVistorias} />
            <FilterSelect label="Município" options={options.municipios.map(m => ({ value: m, label: m }))} selectedValues={selectedMunicipios} onChange={setSelectedMunicipios} searchable={true} />
            <FilterSelect label="AVNP" options={options.avnps.map(m => ({ value: m, label: `${(m * 100).toFixed(0)}%` }))} selectedValues={selectedAVNPs} onChange={setSelectedAVNPs} />
            <FilterSelect label="Recurso Disp." options={[
              { value: 'SIM', label: 'SIM (Positivos)' },
              { value: 'NÃO', label: 'NÃO (Negativos)' }
            ]} selectedValues={selectedRecursoDisp} onChange={setSelectedRecursoDisp} />
            <FilterSelect label="Status" options={options.status.map(m => ({ value: m, label: m }))} selectedValues={selectedStatus} onChange={setSelectedStatus} />

            <FilterSelect 
              label="Situação" 
              options={[
                { value: 'APTA', label: 'APTA' }, 
                { value: 'INAPTA', label: 'INAPTA' }
              ]} 
              selectedValues={selectedSituacao} 
              onChange={setSelectedSituacao} 
            />

            <Toggle
              pressed={ocultarConcluidasPassado}
              onPressedChange={setOcultarConcluidasPassado}
              variant="outline"
              size="sm"
              className="h-8 mb-0.5 text-[10px] uppercase font-bold tracking-wider data-[state=on]:bg-primary data-[state=on]:text-primary-foreground shrink-0"
              title="Ocultar obras que já foram concluídas em meses anteriores à carteira filtrada"
            >
              - CONCLUÍDAS
            </Toggle>

            {/* DateRangePicker para Conclusões */}
            <div className="flex flex-col justify-center min-w-[130px]">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 flex justify-between">Conclusões
                {(filterStart || filterEnd) && <button onClick={() => { setFilterStart(''); setFilterEnd(''); }} className="text-foreground hover:underline ml-1">Limpar</button>}
              </span>
              <div className="flex items-center gap-1 border border-input bg-background rounded-md h-8 px-2 focus-within:ring-1 focus-within:ring-ring">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <input type="date" value={filterStart} onChange={e => setFilterStart(e.target.value)} className="bg-transparent text-[11px] outline-none w-[90px] text-foreground" title="Data Inicial" />
                <span className="text-muted-foreground text-[11px] shrink-0">-</span>
                <input type="date" value={filterEnd} onChange={e => setFilterEnd(e.target.value)} className="bg-transparent text-[11px] outline-none w-[90px] text-foreground" title="Data Final" />
              </div>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-1 bg-secondary/30 rounded-md border border-border px-1 h-8 ml-2 shrink-0">
               <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setZoomLevel(z => Math.max(0.5, z - 0.1))} title="Diminuir Zoom">
                 <ZoomOut className="w-3.5 h-3.5 text-muted-foreground" />
               </Button>
               <span className="text-[10px] font-bold w-8 text-center text-muted-foreground" title="Nível de Zoom">{(zoomLevel * 100).toFixed(0)}%</span>
               <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setZoomLevel(z => Math.min(2.0, z + 0.1))} title="Aumentar Zoom">
                 <ZoomIn className="w-3.5 h-3.5 text-muted-foreground" />
               </Button>
            </div>

            {/* Botão Sincronizar (Estilo PlanejadoMetaView) */}
            <div className="flex items-center ml-2">
              <SyncIndicator />
            </div>

          </div>
        </div>

        {/* Filtros Ativos Badge row (Opcional, mas útil) */}
        {(selectedMeses.length > 0 || selectedVistorias.length > 0 || selectedStatus.length > 0 || selectedAVNPs.length > 0 || selectedPrioridades.length > 0 || selectedMunicipios.length > 0) && (
          <div className="flex flex-wrap gap-2 pt-2">
            {selectedMeses.map(m => <FilterBadge key={m} label={`Mês: ${m}`} onRemove={() => setSelectedMeses(selectedMeses.filter(x => x !== m))} />)}
            {selectedVistorias.map(m => <FilterBadge key={m} label={`Vistoria: ${m}`} onRemove={() => setSelectedVistorias(selectedVistorias.filter(x => x !== m))} />)}
            {selectedStatus.map(m => <FilterBadge key={m} label={`Status: ${m}`} onRemove={() => setSelectedStatus(selectedStatus.filter(x => x !== m))} />)}
            {selectedAVNPs.map(m => <FilterBadge key={m} label={`AVNP: ${(m * 100).toFixed(0)}%`} onRemove={() => setSelectedAVNPs(selectedAVNPs.filter(x => x !== m))} />)}
            {selectedPrioridades.map(m => <FilterBadge key={m} label={`Prioridade: ${m}`} onRemove={() => setSelectedPrioridades(selectedPrioridades.filter(x => x !== m))} />)}
            {selectedMunicipios.map(m => <FilterBadge key={m} label={`Município: ${m}`} onRemove={() => setSelectedMunicipios(selectedMunicipios.filter(x => x !== m))} />)}
          </div>
        )}
      </div>

      <div style={{ zoom: zoomLevel } as React.CSSProperties}>
        <div className="px-6 pb-6 pt-6">
        {/* DASHBOARD GRID (11 Indicadores - 4 por linha) */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 mb-8">

          {/* LINHA 1 */}
          {/* 1. Total de obras */}
          <div 
            onClick={() => setActiveMetricModal({
              title: 'Total de Obras',
              filterFn: (r) => considerarInaptas || r.obrasInaptasVal === '0' || r.obrasInaptasVal === ''
            })}
            className="bg-card border border-border p-4 rounded-xl shadow-sm flex items-center justify-between cursor-pointer hover:shadow-md hover:border-primary/50 transition-all"
          >
            <div className="flex flex-col justify-center">
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">Total de Obras</p>
              <div className="flex items-end gap-2">
                <p className="text-3xl font-bold text-primary">{indicators.totalObras}</p>
                <p className="text-xs text-muted-foreground mb-1">Geral: {indicators.geralTotalObras}</p>
              </div>
            </div>
            <Gauge value={indicators.totalObras} max={indicators.geralTotalObras || 1} colorClass="text-primary" />
          </div>

          {/* 2. Total de Postes Disponíveis */}
          <div 
            onClick={() => setActiveMetricModal({
              title: 'Obras com Postes Disponíveis',
              filterFn: (r) => (considerarInaptas || r.obrasInaptasVal === '0' || r.obrasInaptasVal === '') && r.postesDisponiveis > 0
            })}
            className="bg-card border border-border p-4 rounded-xl shadow-sm flex items-center justify-between overflow-hidden gap-2 cursor-pointer hover:shadow-md hover:border-primary/50 transition-all"
          >
            <div className="flex flex-col justify-center min-w-0 flex-1">
              <p className="text-[10px] sm:text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1 truncate" title="Postes Disponíveis">Postes Disponíveis</p>
              <div className="flex flex-col sm:flex-row sm:items-end gap-1 min-w-0">
                <p className="text-xl sm:text-3xl font-bold text-foreground leading-none">{indicators.sumPostes.toLocaleString('pt-BR')}</p>
                <div className="flex flex-col text-[9px] sm:text-[10px] text-muted-foreground sm:ml-1 mb-1 min-w-0">
                  <span className="truncate" title={`Geral: ${indicators.geralSumPostes.toLocaleString('pt-BR')}`}>Geral: {indicators.geralSumPostes.toLocaleString('pt-BR')}</span>
                  <span className="font-semibold text-primary truncate" title={`Meta: ${indicators.sumMetaPostes.toLocaleString('pt-BR')}`}>Meta: {indicators.sumMetaPostes.toLocaleString('pt-BR')}</span>
                </div>
              </div>
            </div>
            <div className="flex justify-center items-center px-1 sm:px-2 shrink-0">
              <span className="text-lg sm:text-2xl font-black text-primary">{indicators.percentMeta.toFixed(1)}%</span>
            </div>
            <div className="shrink-0">
              <Gauge value={indicators.sumPostes} max={indicators.sumMetaPostes || indicators.geralSumPostes || 1} colorClass="text-foreground" />
            </div>
          </div>

          {/* 3. Obras Sem Orçamento */}
          <div 
            onClick={() => setActiveMetricModal({
              title: 'Obras Sem Orçamento',
              filterFn: (r) => (considerarInaptas || r.obrasInaptasVal === '0' || r.obrasInaptasVal === '') && r.obrasSemOrcamentoVal === '0'
            })}
            className="bg-card border border-border p-4 rounded-xl shadow-sm flex items-center justify-between cursor-pointer hover:shadow-md hover:border-primary/50 transition-all"
          >
            <div className="flex flex-col justify-center">
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">Sem Orçamento</p>
              <div className="flex items-end gap-2">
                <p className="text-3xl font-bold text-orange-500">{indicators.countSemOrcamento}</p>
                <div className="flex flex-col text-[10px] text-muted-foreground ml-2">
                  <span>Total: {indicators.totalObras}</span>
                </div>
              </div>
            </div>
            <Gauge value={indicators.countSemOrcamento} max={indicators.totalObras || 1} colorClass="text-orange-500" />
          </div>

          {/* 4. Obras Vistoriadas */}
          <div 
            onClick={() => setActiveMetricModal({
              title: 'Obras Vistoriadas',
              filterFn: (r) => (considerarInaptas || r.obrasInaptasVal === '0' || r.obrasInaptasVal === '') && !!r.dataVistoria
            })}
            className="bg-card border border-border p-4 rounded-xl shadow-sm flex items-center justify-between cursor-pointer hover:shadow-md hover:border-primary/50 transition-all"
          >
            <div className="flex flex-col justify-center">
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">Obras Vistoriadas</p>
              <div className="flex items-end gap-2">
                <p className="text-3xl font-bold text-blue-500">{indicators.countVistoriadas}</p>
                <div className="flex flex-col text-[10px] text-muted-foreground ml-2">
                  <span>Total: {indicators.totalObras}</span>
                </div>
              </div>
            </div>
            <Gauge value={indicators.countVistoriadas} max={indicators.totalObras || 1} colorClass="text-blue-500" />
          </div>

          {/* LINHA 2 */}
          {/* 5. Obras Concluídas */}
          <div 
            onClick={() => setActiveMetricModal({
              title: 'Obras Concluídas',
              filterFn: (r) => (considerarInaptas || r.obrasInaptasVal === '0' || r.obrasInaptasVal === '') && r.statusExecucao.toUpperCase().includes('CONCLUÍD')
            })}
            className="bg-card border border-border p-4 rounded-xl shadow-sm flex items-center justify-between cursor-pointer hover:shadow-md hover:border-primary/50 transition-all"
          >
            <div className="flex flex-col justify-center">
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">Obras Concluídas</p>
              <div className="flex items-end gap-2">
                <p className="text-3xl font-bold text-green-600">{indicators.countConcluidas}</p>
                <div className="flex flex-col text-[10px] text-muted-foreground ml-2">
                  <span>Total: {indicators.totalObras}</span>
                </div>
              </div>
            </div>
            <Gauge value={indicators.countConcluidas} max={indicators.totalObras || 1} colorClass="text-green-600" />
          </div>

          {/* 6. Obras Energizadas */}
          <div 
            onClick={() => setActiveMetricModal({
              title: 'Obras Energizadas',
              filterFn: (r) => (considerarInaptas || r.obrasInaptasVal === '0' || r.obrasInaptasVal === '') && !!r.dataEnergizacao
            })}
            className="bg-card border border-border p-4 rounded-xl shadow-sm flex items-center justify-between cursor-pointer hover:shadow-md hover:border-primary/50 transition-all"
          >
            <div className="flex flex-col justify-center">
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">Obras Energizadas</p>
              <div className="flex items-end gap-2">
                <p className="text-3xl font-bold text-yellow-500">{indicators.countEnergizadas}</p>
                <div className="flex flex-col text-[10px] text-muted-foreground ml-2">
                  <span>Total: {indicators.totalObras}</span>
                </div>
              </div>
            </div>
            <Gauge value={indicators.countEnergizadas} max={indicators.totalObras || 1} colorClass="text-yellow-500" />
          </div>

          {/* 7. Obras Inaptas */}
          <div 
            onClick={() => setActiveMetricModal({
              title: 'Obras Inaptas',
              filterFn: (r) => r.obrasInaptasVal !== '0' && r.obrasInaptasVal !== ''
            })}
            className="bg-card border border-border p-4 rounded-xl shadow-sm flex items-center justify-between cursor-pointer hover:shadow-md hover:border-primary/50 transition-all"
          >
            <div className="flex flex-col justify-center">
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">Obras Inaptas</p>
              <div className="flex items-end gap-2">
                <p className="text-3xl font-bold text-destructive">{indicators.countInaptas}</p>
                <div className="flex flex-col text-[10px] text-muted-foreground ml-2">
                  <span>Postes: {indicators.sumPostesInaptas}</span>
                  <span>Valor: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact' }).format(indicators.sumFaturamentoInaptas)}</span>
                </div>
              </div>
            </div>
            <Gauge value={indicators.countInaptas} max={indicators.totalObras + indicators.countInaptas || 1} colorClass="text-destructive" />
          </div>

          {/* 8. Postes / Equipes */}
          <div 
            onClick={() => setActiveMetricModal({
              title: 'Obras com Postes por Equipe',
              filterFn: (r) => (considerarInaptas || r.obrasInaptasVal === '0' || r.obrasInaptasVal === '') && r.postesDisponiveis > 0
            })}
            className="bg-card border border-border p-4 rounded-xl shadow-sm flex items-center justify-between overflow-hidden gap-2 cursor-pointer hover:shadow-md hover:border-primary/50 transition-all"
          >
            <div className="flex flex-col justify-center min-w-0 flex-1">
              <p className="text-[10px] sm:text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1 truncate" title="Postes / Equipes">Postes / Equipes</p>
              <div className="flex flex-col sm:flex-row sm:items-end gap-1 min-w-0">
                <p className="text-xl sm:text-3xl font-bold text-foreground leading-none">{indicators.ratioEquipes.toFixed(2)}</p>
                <div className="flex flex-col text-[9px] sm:text-[10px] text-muted-foreground sm:ml-1 mb-1 min-w-0">
                  <span className="truncate">Ut: {indicators.sumPostes} / Eq: {indicators.sumEquipes}</span>
                  <span className="font-semibold text-primary truncate">Meta: {indicators.metaPostesEquipeAvg.toFixed(1)}</span>
                </div>
              </div>
            </div>
            <div className="shrink-0">
              <Gauge value={indicators.ratioEquipes} max={indicators.metaPostesEquipeAvg || 1} colorClass="text-foreground" />
            </div>
          </div>

          {/* LINHA 3 */}
          {/* 9. GPM x NEOEX */}
          <div 
            onClick={() => setActiveMetricModal({
              title: 'Obras com Divergência (GPM x NEOEX)',
              filterFn: (r) => (considerarInaptas || r.obrasInaptasVal === '0' || r.obrasInaptasVal === '') && r.qtdGpm !== r.qtdNeoex
            })}
            className="bg-card border border-border p-4 rounded-xl shadow-sm flex items-center justify-between cursor-pointer hover:shadow-md hover:border-primary/50 transition-all"
          >
            <div className="flex flex-col justify-center">
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-1" title="Déficit de lançamentos (GPM - NEOEX)">Déficit NEOEX</p>
              <div className="flex items-end gap-2">
                <p className={`text-3xl font-bold ${(indicators.sumGpm - indicators.sumNeoex) < 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {(indicators.sumGpm - indicators.sumNeoex).toLocaleString('pt-BR')}
                </p>
                <div className="flex flex-col text-[10px] text-muted-foreground ml-2 mb-1">
                  <span>GPM: {indicators.sumGpm.toLocaleString('pt-BR')}</span>
                  <span>NEX: {indicators.sumNeoex.toLocaleString('pt-BR')}</span>
                </div>
              </div>
            </div>
            <Gauge value={Math.abs(indicators.sumGpm - indicators.sumNeoex)} max={indicators.sumGpm || 1} colorClass={(indicators.sumGpm - indicators.sumNeoex) < 0 ? 'text-green-500' : 'text-red-500'} />
          </div>

          {/* 10. Média de Postes por Obra */}
          <div 
            onClick={() => setActiveMetricModal({
              title: 'Obras com Postes Disponíveis (Média)',
              filterFn: (r) => (considerarInaptas || r.obrasInaptasVal === '0' || r.obrasInaptasVal === '') && r.postesDisponiveis > 0
            })}
            className="bg-card border border-border p-4 rounded-xl shadow-sm flex items-center justify-between cursor-pointer hover:shadow-md hover:border-primary/50 transition-all"
          >
            <div className="flex flex-col justify-center">
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">Média Postes/Obra</p>
              <div className="flex items-end gap-2">
                <p className="text-3xl font-bold text-foreground">{indicators.mediaPostes.toFixed(1)}</p>
                <p className="text-[10px] text-muted-foreground mb-1">Geral: {indicators.geralTotalObras > 0 ? (indicators.geralSumPostes / indicators.geralTotalObras).toFixed(1) : 0}</p>
              </div>
            </div>
            <Gauge value={indicators.mediaPostes} max={indicators.geralTotalObras > 0 ? (indicators.geralSumPostes / indicators.geralTotalObras) * 1.5 : 1} colorClass="text-foreground" />
          </div>

          {/* 11. Capacidade Faturamento */}
          <div 
            onClick={() => setActiveMetricModal({
              title: 'Obras com Faturamento',
              filterFn: (r) => (considerarInaptas || r.obrasInaptasVal === '0' || r.obrasInaptasVal === '') && r.capacidadeFaturamento > 0
            })}
            className="bg-card border border-border p-4 rounded-xl shadow-sm flex items-center justify-between overflow-hidden gap-2 cursor-pointer hover:shadow-md hover:border-primary/50 transition-all"
          >
            <div className="flex flex-col justify-center min-w-0 flex-1">
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-1 truncate" title="Capacidade Faturamento">Capacidade Faturamento</p>
              <div className="flex flex-col gap-0.5 min-w-0">
                <p className="text-xl sm:text-2xl font-bold text-green-500 truncate" title={indicators.sumFaturamento.toString()}>
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(indicators.sumFaturamento)}
                </p>
                <div className="text-[10px] text-muted-foreground overflow-hidden">
                  <span className="font-semibold text-primary truncate block" title={`Meta: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(indicators.sumMetaFaturamento)}`}>
                    Meta: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(indicators.sumMetaFaturamento)}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex-shrink-0">
              <Gauge value={indicators.sumFaturamento} max={indicators.sumMetaFaturamento || indicators.sumFaturamento || 1} colorClass="text-green-500" />
            </div>
          </div>

          {/* 12. Eficácia Prevista */}
          <div 
            onClick={() => setActiveMetricModal({
              title: 'Obras com Eficácia Prevista (AVNP 100%)',
              filterFn: (r) => {
                const isInapta = r.obrasInaptasVal !== '0' && r.obrasInaptasVal !== '';
                const considerarApta = considerarInaptas || !isInapta;
                if (!considerarApta) return false;
                
                let avnpAplicavel = r.avnpMaisRecente;
                if (selectedMeses.length === 1) {
                  avnpAplicavel = r.avnpMap[selectedMeses[0]] !== undefined ? r.avnpMap[selectedMeses[0]] : r.avnpMaisRecente;
                } else if (selectedMeses.length > 1) {
                  avnpAplicavel = Math.max(...selectedMeses.map(m => r.avnpMap[m] !== undefined ? r.avnpMap[m] : r.avnpMaisRecente));
                }
                return avnpAplicavel === 1;
              }
            })}
            className="bg-card border border-border p-4 rounded-xl shadow-sm flex items-center justify-between cursor-pointer hover:shadow-md hover:border-primary/50 transition-all"
          >
            <div className="flex flex-col justify-center">
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">Eficácia Prevista</p>
              <div className="flex items-end gap-2">
                <p className="text-3xl font-bold text-indigo-500">{indicators.eficaciaPrevista.toFixed(1)}%</p>
              </div>
            </div>
            <Gauge value={indicators.eficaciaPrevista} max={100} colorClass="text-indigo-500" />
          </div>

        </div>



        {/* NOVO: RELAÇÃO DE OBRAS CONSIDERADAS NO FILTRO */}
        <div className="px-6 pb-6">
          <div className="w-full bg-card border border-border rounded-xl shadow-sm flex flex-col overflow-hidden h-[500px] min-h-[300px] max-h-[1200px] resize-y pb-1">
            <div className="p-4 border-b border-border bg-muted/20 flex justify-between items-center">
              <h3 className="font-bold text-sm">Relação de Obras Filtradas ({mostrarApenasInaptas ? 'Apenas Inaptas' : considerarInaptas ? 'Aptas + Inaptas' : 'Aptas'}) ({indicators.totalObras})</h3>
              <div className="flex gap-2">
                <Button 
                  onClick={() => exportToCSV(
                    filteredData.filter(r => considerarInaptas || r.obrasInaptasVal !== '0'), 
                    selectedMeses, 
                    'Obras_Filtradas'
                  )}
                  variant="outline" 
                  size="sm" 
                  className="h-7 text-xs flex items-center gap-1.5 text-foreground shrink-0 bg-background"
                >
                  <Download className="w-3.5 h-3.5" /> CSV
                </Button>
                <Button 
                  onClick={() => exportToExcelXML(
                    filteredData.filter(r => considerarInaptas || r.obrasInaptasVal !== '0'), 
                    selectedMeses, 
                    'Obras_Filtradas'
                  )}
                  variant="outline" 
                  size="sm" 
                  className="h-7 text-xs flex items-center gap-1.5 text-foreground shrink-0 bg-background"
                >
                  <Download className="w-3.5 h-3.5" /> Excel
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-auto custom-scrollbar p-0">
              <ErrorBoundary>
                <table className="w-full min-w-[1500px] table-auto text-sm text-left whitespace-nowrap">
                  <thead className="bg-muted sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="px-4 py-2 font-semibold text-center">Obra</th>
                      <th className="px-4 py-2 font-semibold text-center max-w-[280px]">Título</th>
                      <th className="px-4 py-2 font-semibold text-center">Município</th>
                      <th className="px-4 py-2 font-semibold text-center">Carteira</th>
                      <th className="px-4 py-2 font-semibold text-center">Prioridade</th>
                      <th className="px-4 py-2 font-semibold text-center">Status Execução</th>
                      <th className="px-4 py-2 font-semibold text-center">Postes Disp.</th>
                      <th className="px-4 py-2 font-semibold text-center">AVNP</th>
                      <th className="px-4 py-2 font-semibold text-center">Valor Considerado</th>
                      <th className="px-4 py-2 font-semibold text-center">Orçamento Val.</th>
                      <th className="px-4 py-2 font-semibold text-center">Recursos Aplic.</th>
                      <th className="px-4 py-2 font-semibold text-center">Recurso Disp.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.filter(r => considerarInaptas || r.obrasInaptasVal === '0' || r.obrasInaptasVal === '').sort((a, b) => (b.postesDisponiveis || 0) - (a.postesDisponiveis || 0)).slice(0, 100).map(obra => (
                      <tr key={obra.id} className={cn(
                        "border-b border-border/50",
                        obra.isConcluidaNoPassado 
                          ? "bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-950/30" 
                          : "hover:bg-muted/20"
                      )}>
                        <td className="px-4 py-2 font-medium">{obra.projeto}</td>
                        <td className="px-4 py-2 text-muted-foreground"><div className="max-w-[280px] truncate" title={obra.titulo}>{obra.titulo}</div></td>
                        <td className="px-4 py-2"><div className="max-w-[150px] truncate" title={obra.municipio}>{obra.municipio}</div></td>
                        <td className="px-4 py-2 text-center text-[10px] text-muted-foreground whitespace-nowrap">
                          {(() => {
                            const mesesParaMostrar = selectedMeses.length > 0
                              ? obra.meses.filter(m => selectedMeses.includes(m))
                              : obra.meses;
                            return mesesParaMostrar.join(' | ') || '-';
                          })()}
                        </td>
                        <td className="px-4 py-2 text-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-secondary text-secondary-foreground truncate max-w-full">
                            {obra.prioridade || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-center"><div className="max-w-[120px] truncate mx-auto" title={obra.statusExecucao || '-'}>{obra.statusExecucao || '-'}</div></td>
                        <td className="px-4 py-2 text-center">{obra.postesDisponiveis}</td>
                        <td className="px-4 py-2 text-center font-bold text-[11px] text-indigo-600 whitespace-nowrap">
                          {(() => {
                            const mesesParaMostrar = selectedMeses.length > 0
                              ? obra.meses.filter(m => selectedMeses.includes(m))
                              : obra.meses;
                            
                            if (mesesParaMostrar.length === 0) {
                              return `${(obra.avnpMaisRecente * 100).toFixed(0)}%`;
                            }

                            return mesesParaMostrar.map(m => {
                              const avnp = obra.avnpMap[m] !== undefined ? obra.avnpMap[m] : obra.avnpMaisRecente;
                              return `${(avnp * 100).toFixed(0)}%`;
                            }).join(' | ');
                          })()}
                        </td>
                        <td className="px-4 py-2 text-center">
                          <span className="text-green-600 font-medium">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(obra.capacidadeFaturamento)}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-center">
                          <div className="flex flex-col items-center w-full">
                            <span className="font-medium text-[13px]">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(obra.orcamentoValidado)}
                            </span>
                            {obra.orcamentoValidado > 0 && (
                              <div className="w-full mt-0.5">
                                <div className="flex justify-between text-[9px] text-muted-foreground mb-0.5">
                                  <span>{((obra.orcamentoValidado - obra.capacidadeFaturamento) / obra.orcamentoValidado * 100).toFixed(1)}%</span>
                                  <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(obra.orcamentoValidado - obra.capacidadeFaturamento)}</span>
                                </div>
                                <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                                  <div
                                    className={`h-full ${(((obra.orcamentoValidado - obra.capacidadeFaturamento) / obra.orcamentoValidado) * 100) > 100 ? 'bg-red-500' : 'bg-green-500'}`}
                                    style={{ width: `${Math.min(Math.max(((obra.orcamentoValidado - obra.capacidadeFaturamento) / obra.orcamentoValidado) * 100, 0), 100)}%` }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-center">
                          <div className="flex flex-col items-center w-full">
                            <span className="font-medium text-[13px] text-blue-600">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(obra.recursosAplicados)}
                            </span>
                            {obra.orcamentoValidado > 0 && (
                              <div className="w-full mt-0.5">
                                <div className="flex justify-between text-[9px] text-muted-foreground mb-0.5">
                                  <span>{((obra.recursosAplicados) / obra.orcamentoValidado * 100).toFixed(1)}%</span>
                                  <span className={(obra.orcamentoValidado - obra.recursosAplicados) < 0 ? 'text-red-500' : ''}>
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(obra.orcamentoValidado - obra.recursosAplicados)}
                                  </span>
                                </div>
                                <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                                  <div
                                    className={`h-full ${((obra.recursosAplicados) / obra.orcamentoValidado) * 100 > 100 ? 'bg-red-500' : 'bg-blue-500'}`}
                                    style={{ width: `${Math.min(Math.max(((obra.recursosAplicados) / obra.orcamentoValidado) * 100, 0), 100)}%` }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-center">
                          <span className={`font-medium ${(obra.orcamentoValidado - obra.recursosAplicados) >= 0 ? 'text-blue-600' : 'text-red-500'}`}>
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(obra.orcamentoValidado - obra.recursosAplicados)}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {filteredData.length === 0 && (
                      <tr>
                        <td colSpan={11} className="px-4 py-8 text-center text-muted-foreground">Nenhuma obra encontrada para os filtros atuais.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </ErrorBoundary>
            </div>
          </div>
        </div>

        {/* MAPA */}
        <div className={cn("w-full transition-all duration-300 relative z-10", isMapFullscreen ? "fixed inset-0 z-50 bg-background p-4" : "h-[80vh] min-h-[700px] mb-8 px-6")}>
          <div className="w-full h-full relative border border-border rounded-xl overflow-hidden shadow-sm">
            <Button
              variant="secondary"
              size="icon"
              className="absolute top-4 right-4 z-[400] shadow-md hover:scale-105 transition-transform opacity-90 hover:opacity-100"
              onClick={() => setIsMapFullscreen(!isMapFullscreen)}
              title={isMapFullscreen ? "Sair da Tela Cheia" : "Expandir Mapa em Tela Cheia"}
            >
              {isMapFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
            </Button>
            <ErrorBoundary><CarteiraMapView obras={filteredData.filter(r => considerarInaptas || r.obrasInaptasVal !== '0')} /></ErrorBoundary>
          </div>
        </div>

        {/* 10. Localização das Obras (Tabela) */}
        <div className="w-full bg-card border border-border rounded-xl shadow-sm flex flex-col overflow-hidden mb-6 h-[400px]">
          <div className="p-4 border-b border-border bg-muted/20">
            <h3 className="font-bold text-sm">Localização (Municípios)</h3>
          </div>
          <div className="flex-1 overflow-auto custom-scrollbar p-0">
            <ErrorBoundary>
              <table className="w-full text-sm text-left">
                <thead className="bg-muted sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="px-4 py-2 font-semibold">Município</th>
                    <th className="px-4 py-2 font-semibold text-right">Qtd Obras</th>
                    <th className="px-4 py-2 font-semibold text-right">%</th>
                    <th className="px-4 py-2 font-semibold text-right">Postes Disp.</th>
                    <th className="px-4 py-2 font-semibold text-right">Valor Considerado</th>
                  </tr>
                </thead>
                <tbody>
                  {indicators.municipiosRanking.map(m => (
                    <tr key={m.nome} className="border-b border-border/50 hover:bg-muted/20">
                      <td className="px-4 py-2 font-medium truncate max-w-[150px]" title={m.nome}>{m.nome}</td>
                      <td className="px-4 py-2 text-right">{m.count}</td>
                      <td className="px-4 py-2 text-right text-muted-foreground">{m.percent.toFixed(1)}%</td>
                      <td className="px-4 py-2 text-right font-medium">{m.postes}</td>
                      <td className="px-4 py-2 text-right text-green-600 font-medium">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(m.valor)}
                      </td>
                    </tr>
                  ))}
                  {indicators.municipiosRanking.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Nenhum dado</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </ErrorBoundary>
          </div>
        </div>

        {/* OBRAS COM DÉFICIT NEOEX */}
        <div className="w-full bg-card border border-border rounded-xl shadow-sm flex flex-col overflow-hidden h-[400px] min-h-[250px] max-h-[1000px] resize-y mb-6">
          <div className="p-4 border-b border-border bg-muted/20 flex justify-between items-center">
            <h3 className="font-bold text-sm text-red-500">Obras com Divergência de Lançamento (GPM x NEOEX)</h3>
          </div>
          <div className="flex-1 overflow-auto custom-scrollbar p-0">
            <ErrorBoundary>
              <table className="w-full text-sm text-left whitespace-nowrap">
                <thead className="bg-muted sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="px-4 py-2 font-semibold">Obra</th>
                    <th className="px-4 py-2 font-semibold min-w-[200px]">Título</th>
                    <th className="px-4 py-2 font-semibold text-right">GPM</th>
                    <th className="px-4 py-2 font-semibold text-right">NEOEX</th>
                    <th className="px-4 py-2 font-semibold text-right">Diferença</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.filter(r => (considerarInaptas || r.obrasInaptasVal !== '0') && (r.qtdGpm !== r.qtdNeoex)).slice(0, 100).map(obra => (
                    <tr key={`deficit-${obra.id}`} className="border-b border-border/50 hover:bg-muted/20">
                      <td className="px-4 py-2 font-medium">{obra.projeto}</td>
                      <td className="px-4 py-2 text-muted-foreground truncate max-w-[300px]" title={obra.titulo}>{obra.titulo}</td>
                      <td className="px-4 py-2 text-right">{obra.qtdGpm}</td>
                      <td className="px-4 py-2 text-right">{obra.qtdNeoex}</td>
                      <td className={`px-4 py-2 text-right font-bold ${(obra.qtdGpm - obra.qtdNeoex) < 0 ? 'text-green-500' : 'text-red-500'}`}>{obra.qtdGpm - obra.qtdNeoex}</td>
                    </tr>
                  ))}
                  {filteredData.filter(r => (considerarInaptas || r.obrasInaptasVal !== '0') && (r.qtdGpm !== r.qtdNeoex)).length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Nenhuma obra com divergência encontrada.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </ErrorBoundary>
          </div>
        </div>

      </div>
      </div>

      {/* Modal de Detalhes da Métrica */}
      <Dialog 
        open={activeMetricModal !== null} 
        onOpenChange={(open) => {
          if (!open) {
            setActiveMetricModal(null);
            setModalSearchTerm('');
          }
        }}
      >
        <DialogContent 
          className="max-w-6xl w-[95vw] min-h-[300px] max-h-[95vh] h-[85vh] fixed top-[5vh] left-1/2 -translate-x-1/2 translate-y-0 flex flex-col p-0 overflow-hidden bg-background border-border shadow-2xl rounded-xl resize-y pb-2"
        >
          {activeMetricModal && (() => {
            const isObrasInaptasMetric = activeMetricModal.title === 'Obras Inaptas';
            
            const allModalObras = data.carteira.filter(row => {
              // 1. Filtro Mês
              if (selectedMeses.length > 0) {
                const hasMes = selectedMeses.some(m => row.meses.includes(m));
                if (!hasMes) return false;
              }

              // 2. Filtro Status
              if (selectedStatus.length > 0 && !selectedStatus.includes(row.statusExecucao)) return false;

              // 3. Filtro Projeto
              if (selectedProjetos.length > 0 && !selectedProjetos.includes(row.projeto)) return false;

              // 4. Filtro Municipio
              if (selectedMunicipios.length > 0 && !selectedMunicipios.includes(row.municipio)) return false;

              // 5. Filtro Prioridade
              if (selectedPrioridades.length > 0 && !selectedPrioridades.includes(row.prioridade)) return false;

              // 6. Filtro Postes
              if (selectedPostes.length > 0 && !selectedPostes.includes(row.postesDisponiveis)) return false;

              // 7. Filtro Vistoria
              if (selectedVistorias.length > 0) {
                let vistoriaStatus = 'NÃO';
                const now = new Date();
                if (row.dataVistoria) {
                  const diff = differenceInMonths(now, row.dataVistoria);
                  vistoriaStatus = diff <= 6 ? 'SIM' : 'VENCIDAS';
                }
                if (!selectedVistorias.includes(vistoriaStatus)) return false;
              }

              // 8. Filtro AVNP
              if (selectedAVNPs.length > 0) {
                let avnpAplicavel = row.avnpMaisRecente;
                if (selectedMeses.length === 1) {
                  const mes = selectedMeses[0];
                  avnpAplicavel = row.avnpMap[mes] !== undefined ? row.avnpMap[mes] : row.avnpMaisRecente;
                  if (!selectedAVNPs.includes(avnpAplicavel)) return false;
                } else if (selectedMeses.length > 1) {
                  const matchAVNP = selectedMeses.some(mes => {
                    const val = row.avnpMap[mes] !== undefined ? row.avnpMap[mes] : row.avnpMaisRecente;
                    return selectedAVNPs.includes(val);
                  });
                  if (!matchAVNP) return false;
                } else {
                  if (!selectedAVNPs.includes(avnpAplicavel)) return false;
                }
              }

              // 9. Filtro de Conclusões
              if (filterStart || filterEnd) {
                let isWithin = true;
                if (filterStart) {
                  const start = startOfDay(parse(filterStart, 'yyyy-MM-dd', new Date()));
                  if (!row.dataFim || row.dataFim < start) isWithin = false;
                }
                if (filterEnd) {
                  const end = endOfDay(parse(filterEnd, 'yyyy-MM-dd', new Date()));
                  if (!row.dataFim || row.dataFim > end) isWithin = false;
                }
                if (!isWithin) return false;
              }

              // 10. Filtro Recurso Disponível
              if (selectedRecursoDisp.length > 0) {
                const recursoStatus = ((row.orcamentoValidado || 0) - (row.recursosAplicados || 0)) >= 0 ? 'SIM' : 'NÃO';
                if (!selectedRecursoDisp.includes(recursoStatus)) return false;
              }

              // 11. Filtro Situação (APTA/INAPTA)
              if (!isObrasInaptasMetric && selectedSituacao.length > 0) {
                const isInapta = row.obrasInaptasVal !== '0' && row.obrasInaptasVal !== '';
                const rowSituacao = isInapta ? 'INAPTA' : 'APTA';
                if (!selectedSituacao.includes(rowSituacao)) return false;
              }

              return true;
            }).map(row => {
              let isConcluidaNoPassado = false;
              if (row.dataFim) {
                const fimMesTime = startOfMonth(row.dataFim).getTime();
                const parseMesToDateLocal = (mesStr: string) => {
                  if (mesStr === 'OBRA RETIRADA') return 0;
                  try {
                    const cleanStr = mesStr.replace('./', ' ');
                    return parse(cleanStr, 'MMM yy', new Date(), { locale: ptBR }).getTime();
                  } catch (e) {
                    return 0;
                  }
                };
                if (selectedMeses.length > 0) {
                  const mesesMatching = selectedMeses.filter(m => row.meses.includes(m));
                  if (mesesMatching.length > 0) {
                    isConcluidaNoPassado = mesesMatching.every(m => {
                      const mTime = parseMesToDateLocal(m);
                      return mTime > 0 && mTime > fimMesTime;
                    });
                  }
                } else {
                  if (row.meses.length > 0) {
                    isConcluidaNoPassado = row.meses.every(m => {
                      const mTime = parseMesToDateLocal(m);
                      return mTime > 0 && mTime > fimMesTime;
                    });
                  }
                }
              }
              return { ...row, isConcluidaNoPassado };
            });

            const filteredModalObras = allModalObras.filter(activeMetricModal.filterFn).filter(row => {
              if (ocultarConcluidasPassado && row.isConcluidaNoPassado) return false;
              return true;
            });

            const searchedModalObras = filteredModalObras.filter(row => {
              if (!modalSearchTerm) return true;
              const term = modalSearchTerm.toLowerCase();
              return (
                (row.projeto && row.projeto.toLowerCase().includes(term)) ||
                (row.titulo && row.titulo.toLowerCase().includes(term)) ||
                (row.municipio && row.municipio.toLowerCase().includes(term)) ||
                (row.prioridade && row.prioridade.toLowerCase().includes(term)) ||
                (row.statusExecucao && row.statusExecucao.toLowerCase().includes(term))
              );
            });

            const totalObras = searchedModalObras.length;
            const totalPostes = searchedModalObras.reduce((sum, o) => sum + (o.postesDisponiveis || 0), 0);
            const totalValor = searchedModalObras.reduce((sum, o) => sum + (o.capacidadeFaturamento || 0), 0);

            return (
              <div className="flex flex-col h-full overflow-hidden text-foreground">
                {/* Modal Header */}
                <div className="p-6 border-b border-border bg-muted/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-foreground">{activeMetricModal.title}</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Relação de obras correspondentes ao indicador selecionado.
                    </p>
                  </div>
                  
                  {/* Search and Action Buttons */}
                  <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <input
                      type="text"
                      placeholder="Pesquisar nesta lista..."
                      value={modalSearchTerm}
                      onChange={(e) => setModalSearchTerm(e.target.value)}
                      className="h-8 px-3 text-xs bg-background border border-input rounded-md outline-none focus:ring-1 focus:ring-ring w-full md:w-48 text-foreground"
                    />
                    <div className="flex gap-2">
                      <Button 
                        onClick={() => exportToCSV(searchedModalObras, selectedMeses, activeMetricModal.title)}
                        variant="outline" 
                        size="sm" 
                        className="h-8 text-xs flex items-center gap-1.5 bg-background text-foreground"
                      >
                        <Download className="w-3.5 h-3.5" /> CSV
                      </Button>
                      <Button 
                        onClick={() => exportToExcelXML(searchedModalObras, selectedMeses, activeMetricModal.title)}
                        variant="outline" 
                        size="sm" 
                        className="h-8 text-xs flex items-center gap-1.5 bg-background text-foreground"
                      >
                        <Download className="w-3.5 h-3.5" /> Excel
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Summaries strip */}
                <div className="px-6 py-3 bg-secondary/20 border-b border-border flex flex-wrap gap-6 text-xs font-semibold text-muted-foreground">
                  <div>Obras: <span className="text-foreground">{totalObras}</span></div>
                  <div>Total Postes: <span className="text-foreground">{totalPostes.toLocaleString('pt-BR')}</span></div>
                  <div>Total Valor: <span className="text-green-600 font-bold">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalValor)}
                  </span></div>
                </div>

                {/* Table Container */}
                <div className="flex-1 overflow-auto custom-scrollbar p-0">
                  <ErrorBoundary>
                    <table className="w-full min-w-[1500px] table-auto text-sm text-left whitespace-nowrap">
                      <thead className="bg-muted sticky top-0 z-10 shadow-sm">
                        <tr>
                          <th className="px-4 py-2 font-semibold text-center">Obra</th>
                          <th className="px-4 py-2 font-semibold text-center max-w-[280px]">Título</th>
                          <th className="px-4 py-2 font-semibold text-center">Município</th>
                          <th className="px-4 py-2 font-semibold text-center">Carteira</th>
                          <th className="px-4 py-2 font-semibold text-center">Prioridade</th>
                          <th className="px-4 py-2 font-semibold text-center">Status Execução</th>
                          <th className="px-4 py-2 font-semibold text-center">Postes Disp.</th>
                          <th className="px-4 py-2 font-semibold text-center">AVNP</th>
                          <th className="px-4 py-2 font-semibold text-center">Valor Considerado</th>
                          <th className="px-4 py-2 font-semibold text-center">Orçamento Val.</th>
                          <th className="px-4 py-2 font-semibold text-center">Recursos Aplic.</th>
                          <th className="px-4 py-2 font-semibold text-center">Recurso Disp.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {searchedModalObras.sort((a, b) => (b.postesDisponiveis || 0) - (a.postesDisponiveis || 0)).map(obra => (
                          <tr key={`modal-${obra.id}`} className={cn(
                            "border-b border-border/50",
                            obra.isConcluidaNoPassado 
                              ? "bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-950/30" 
                              : "hover:bg-muted/20"
                          )}>
                            <td className="px-4 py-2 font-medium">{obra.projeto}</td>
                            <td className="px-4 py-2 text-muted-foreground"><div className="max-w-[280px] truncate" title={obra.titulo}>{obra.titulo}</div></td>
                            <td className="px-4 py-2"><div className="max-w-[150px] truncate" title={obra.municipio}>{obra.municipio}</div></td>
                            <td className="px-4 py-2 text-center text-[10px] text-muted-foreground whitespace-nowrap">
                              {(() => {
                                const mesesParaMostrar = selectedMeses.length > 0
                                  ? obra.meses.filter(m => selectedMeses.includes(m))
                                  : obra.meses;
                                return mesesParaMostrar.join(' | ') || '-';
                              })()}
                            </td>
                            <td className="px-4 py-2 text-center">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-secondary text-secondary-foreground truncate max-w-full">
                                {obra.prioridade || '-'}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-center"><div className="max-w-[120px] truncate mx-auto" title={obra.statusExecucao || '-'}>{obra.statusExecucao || '-'}</div></td>
                            <td className="px-4 py-2 text-center">{obra.postesDisponiveis}</td>
                            <td className="px-4 py-2 text-center font-bold text-[11px] text-indigo-600 whitespace-nowrap">
                              {(() => {
                                const mesesParaMostrar = selectedMeses.length > 0
                                  ? obra.meses.filter(m => selectedMeses.includes(m))
                                  : obra.meses;
                                
                                if (mesesParaMostrar.length === 0) {
                                  return `${(obra.avnpMaisRecente * 100).toFixed(0)}%`;
                                }

                                return mesesParaMostrar.map(m => {
                                  const avnp = obra.avnpMap[m] !== undefined ? obra.avnpMap[m] : obra.avnpMaisRecente;
                                  return `${(avnp * 100).toFixed(0)}%`;
                                }).join(' | ');
                              })()}
                            </td>
                            <td className="px-4 py-2 text-center">
                              <span className="text-green-600 font-medium">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(obra.capacidadeFaturamento)}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-center">
                              <div className="flex flex-col items-center w-full">
                                <span className="font-medium text-[13px]">
                                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(obra.orcamentoValidado)}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-2 text-center">
                              <div className="flex flex-col items-center w-full">
                                <span className="font-medium text-[13px] text-blue-600">
                                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(obra.recursosAplicados)}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-2 text-center">
                              <span className={`font-medium ${(obra.orcamentoValidado - obra.recursosAplicados) >= 0 ? 'text-blue-600' : 'text-red-500'}`}>
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(obra.orcamentoValidado - obra.recursosAplicados)}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {searchedModalObras.length === 0 && (
                          <tr>
                            <td colSpan={12} className="px-4 py-8 text-center text-muted-foreground">
                              Nenhuma obra encontrada.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </ErrorBoundary>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Utilities for exporting CSV/Excel client-side
const escapeXml = (unsafe: any) => {
  if (unsafe === null || unsafe === undefined) return '';
  return String(unsafe).replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
};

const exportToCSV = (obras: any[], selectedMeses: string[], title: string) => {
  const headers = [
    'Obra', 'Título', 'Município', 'Carteira', 'Prioridade', 
    'Status Execução', 'Postes Disp.', 'AVNP', 'Valor Considerado', 
    'Orçamento Val.', 'Recursos Aplic.', 'Recurso Disp.'
  ];
  
  const rows = obras.map(obra => {
    const mesesParaMostrar = selectedMeses.length > 0
      ? obra.meses.filter((m: string) => selectedMeses.includes(m))
      : obra.meses;
    const carteiraStr = mesesParaMostrar.join(' | ') || '-';

    let avnpStr = `${(obra.avnpMaisRecente * 100).toFixed(0)}%`;
    if (selectedMeses.length > 0) {
      avnpStr = mesesParaMostrar.map((m: string) => {
        const avnp = obra.avnpMap[m] !== undefined ? obra.avnpMap[m] : obra.avnpMaisRecente;
        return `${(avnp * 100).toFixed(0)}%`;
      }).join(' | ');
    }

    return [
      obra.projeto || '',
      obra.titulo || '',
      obra.municipio || '',
      carteiraStr,
      obra.prioridade || '-',
      obra.statusExecucao || '-',
      obra.postesDisponiveis ?? 0,
      avnpStr,
      obra.capacidadeFaturamento ?? 0,
      obra.orcamentoValidado ?? 0,
      obra.recursosAplicados ?? 0,
      (obra.orcamentoValidado ?? 0) - (obra.recursosAplicados ?? 0)
    ];
  });

  const csvContent = "\uFEFF" + [
    headers.join(';'),
    ...rows.map(row => row.map(val => {
      if (typeof val === 'string') {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    }).join(';'))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${title.toLowerCase().replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const exportToExcelXML = (obras: any[], selectedMeses: string[], title: string) => {
  const headers = [
    'Obra', 'Título', 'Município', 'Carteira', 'Prioridade', 
    'Status Execução', 'Postes Disp.', 'AVNP', 'Valor Considerado', 
    'Orçamento Val.', 'Recursos Aplic.', 'Recurso Disp.'
  ];
  
  const rows = obras.map(obra => {
    const mesesParaMostrar = selectedMeses.length > 0
      ? obra.meses.filter((m: string) => selectedMeses.includes(m))
      : obra.meses;
    const carteiraStr = mesesParaMostrar.join(' | ') || '-';

    let avnpStr = `${(obra.avnpMaisRecente * 100).toFixed(0)}%`;
    if (selectedMeses.length > 0) {
      avnpStr = mesesParaMostrar.map((m: string) => {
        const avnp = obra.avnpMap[m] !== undefined ? obra.avnpMap[m] : obra.avnpMaisRecente;
        return `${(avnp * 100).toFixed(0)}%`;
      }).join(' | ');
    }

    return [
      obra.projeto || '',
      obra.titulo || '',
      obra.municipio || '',
      carteiraStr,
      obra.prioridade || '-',
      obra.statusExecucao || '-',
      obra.postesDisponiveis ?? 0,
      avnpStr,
      obra.capacidadeFaturamento ?? 0,
      obra.orcamentoValidado ?? 0,
      obra.recursosAplicados ?? 0,
      (obra.orcamentoValidado ?? 0) - (obra.recursosAplicados ?? 0)
    ];
  });

  let xml = '<?xml version="1.0" encoding="utf-8"?>\n';
  xml += '<?mso-application progid="Excel.Sheet"?>\n';
  xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"\n';
  xml += ' xmlns:o="urn:schemas-microsoft-com:office:office"\n';
  xml += ' xmlns:x="urn:schemas-microsoft-com:office:excel"\n';
  xml += ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"\n';
  xml += ' xmlns:html="http://www.w3.org/TR/REC-html40">\n';
  
  xml += ' <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">\n';
  xml += `  <Title>${title}</Title>\n`;
  xml += '  <Created>' + new Date().toISOString() + '</Created>\n';
  xml += ' </DocumentProperties>\n';

  xml += ' <Styles>\n';
  xml += '  <Style ss:ID="Default" ss:Name="Normal">\n';
  xml += '   <Alignment ss:Vertical="Bottom"/>\n';
  xml += '   <Borders/>\n';
  xml += '   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#000000"/>\n';
  xml += '   <Interior/>\n';
  xml += '   <NumberFormat/>\n';
  xml += '   <Protection/>\n';
  xml += '  </Style>\n';
  xml += '  <Style ss:ID="sHeader">\n';
  xml += '   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#FFFFFF" ss:Bold="1"/>\n';
  xml += '   <Interior ss:Color="#1f2937" ss:Pattern="Solid"/>\n';
  xml += '   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>\n';
  xml += '  </Style>\n';
  xml += '  <Style ss:ID="sNumber">\n';
  xml += '   <NumberFormat ss:Format="Standard"/>\n';
  xml += '  </Style>\n';
  xml += '  <Style ss:ID="sCurrency">\n';
  xml += '   <NumberFormat ss:Format="&quot;R$&quot;\ #,##0.00;[Red]&quot;R$&quot;\ #,##0.00"/>\n';
  xml += '  </Style>\n';
  xml += ' </Styles>\n';

  const sheetName = title.replace(/[:\/\\\?\*\[\]]/g, '').substring(0, 31) || 'Carteira';
  xml += ` <Worksheet ss:Name="${sheetName}">\n`;
  xml += '  <Table>\n';
  
  xml += '   <Column ss:Width="100"/>\n';
  xml += '   <Column ss:Width="250"/>\n';
  xml += '   <Column ss:Width="120"/>\n';
  xml += '   <Column ss:Width="120"/>\n';
  xml += '   <Column ss:Width="80"/>\n';
  xml += '   <Column ss:Width="120"/>\n';
  xml += '   <Column ss:Width="80"/>\n';
  xml += '   <Column ss:Width="80"/>\n';
  xml += '   <Column ss:Width="120"/>\n';
  xml += '   <Column ss:Width="120"/>\n';
  xml += '   <Column ss:Width="120"/>\n';
  xml += '   <Column ss:Width="120"/>\n';

  xml += '   <Row ss:Height="22">\n';
  headers.forEach(h => {
    xml += `    <Cell ss:StyleID="sHeader"><Data ss:Type="String">${h}</Data></Cell>\n`;
  });
  xml += '   </Row>\n';

  rows.forEach(row => {
    xml += '   <Row>\n';
    xml += `    <Cell><Data ss:Type="String">${escapeXml(row[0])}</Data></Cell>\n`;
    xml += `    <Cell><Data ss:Type="String">${escapeXml(row[1])}</Data></Cell>\n`;
    xml += `    <Cell><Data ss:Type="String">${escapeXml(row[2])}</Data></Cell>\n`;
    xml += `    <Cell><Data ss:Type="String">${escapeXml(row[3])}</Data></Cell>\n`;
    xml += `    <Cell><Data ss:Type="String">${escapeXml(row[4])}</Data></Cell>\n`;
    xml += `    <Cell><Data ss:Type="String">${escapeXml(row[5])}</Data></Cell>\n`;
    xml += `    <Cell ss:StyleID="sNumber"><Data ss:Type="Number">${row[6]}</Data></Cell>\n`;
    xml += `    <Cell><Data ss:Type="String">${escapeXml(row[7])}</Data></Cell>\n`;
    xml += `    <Cell ss:StyleID="sCurrency"><Data ss:Type="Number">${row[8]}</Data></Cell>\n`;
    xml += `    <Cell ss:StyleID="sCurrency"><Data ss:Type="Number">${row[9]}</Data></Cell>\n`;
    xml += `    <Cell ss:StyleID="sCurrency"><Data ss:Type="Number">${row[10]}</Data></Cell>\n`;
    xml += `    <Cell ss:StyleID="sCurrency"><Data ss:Type="Number">${row[11]}</Data></Cell>\n`;
    xml += '   </Row>\n';
  });

  xml += '  </Table>\n';
  xml += ' </Worksheet>\n';
  xml += '</Workbook>\n';

  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${title.toLowerCase().replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.xls`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

