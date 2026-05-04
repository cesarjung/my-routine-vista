import { useMemo, useState } from 'react';
import { usePlanejamentoEquipesData, PlanejamentoEquipeRow } from '@/hooks/usePlanejamentoEquipesData';
import { UNIDADES_PLANEJAMENTO } from '@/constants/unidades';
import { getEtapaColorClass } from '@/hooks/usePlanejamentoData';
import { cn } from '@/lib/utils';
import { Loader2, ChevronLeft, ChevronRight, Filter, Calendar, RefreshCw } from 'lucide-react';
import { format, differenceInDays, startOfDay, addDays, subDays, parseISO, parse, isValid, startOfMonth, getDaysInMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

export const PlanejamentoEquipesGanttView = () => {
  const [selectedUnidadesIds, setSelectedUnidadesIds] = useState<string[]>([UNIDADES_PLANEJAMENTO[0].id]);
  const [draftUnidadesIds, setDraftUnidadesIds] = useState<string[]>([UNIDADES_PLANEJAMENTO[0].id]);
  const [unidadesDropdownOpen, setUnidadesDropdownOpen] = useState(false);
  const { data, isLoading, isError, error, refetch, isRefetching } = usePlanejamentoEquipesData(selectedUnidadesIds);
  const [selectedMeses, setSelectedMeses] = useState<string[]>([]);
  const [filterStart, setFilterStart] = useState<string>('');
  const [filterEnd, setFilterEnd] = useState<string>('');
  const [selectedSupervisores, setSelectedSupervisores] = useState<string[]>([]);
  const [selectedEquipes, setSelectedEquipes] = useState<string[]>([]);
  const [selectedProjetos, setSelectedProjetos] = useState<string[]>([]);
  
  const [viewStartManual, setViewStartManual] = useState(() => startOfMonth(new Date()));
  
  const dayWidth = 48;

  const { viewStartEfetivo, daysToShowEfetivo } = useMemo(() => {
    if (filterStart && filterEnd) {
      const start = startOfDay(parseISO(filterStart));
      const end = startOfDay(parseISO(filterEnd));
      return {
        viewStartEfetivo: start,
        daysToShowEfetivo: Math.max(1, differenceInDays(end, start) + 1)
      };
    }
    
    if (filterStart && !filterEnd) {
      return {
        viewStartEfetivo: startOfDay(parseISO(filterStart)),
        daysToShowEfetivo: 60
      };
    }

    if (selectedMeses.length === 1) {
      const parsedMes = parse(selectedMeses[0], 'MMM/yy', new Date(), { locale: ptBR });
      if (isValid(parsedMes)) {
         return {
            viewStartEfetivo: startOfMonth(parsedMes),
            daysToShowEfetivo: getDaysInMonth(parsedMes)
         };
      }
    }
    
    return {
       viewStartEfetivo: viewStartManual,
       daysToShowEfetivo: 60
    };
  }, [selectedMeses, filterStart, filterEnd, viewStartManual]);

  const dates = useMemo(() => {
    return Array.from({ length: daysToShowEfetivo }, (_, i) => addDays(viewStartEfetivo, i));
  }, [viewStartEfetivo, daysToShowEfetivo]);

  const mesesDisponiveis = useMemo(() => {
    if (!data) return [];
    const meses = new Set<string>();
    data.forEach(row => {
      row.atividadesDiarias.forEach(ativ => {
        const mesAno = format(ativ.dataParsed, 'MMM/yy', { locale: ptBR }).toUpperCase();
        meses.add(mesAno);
      });
    });
    return Array.from(meses);
  }, [data]);

  const dataFilteredByDate = useMemo(() => {
    if (!data) return [];
    return data.filter(row => {
      let passMes = selectedMeses.length === 0;
      if (!passMes) {
        passMes = row.atividadesDiarias.some(ativ => selectedMeses.includes(format(ativ.dataParsed, 'MMM/yy', { locale: ptBR }).toUpperCase()));
      }

      let passDateStart = true;
      let passDateEnd = true;

      if (filterStart) {
        if (!row.maxDate) passDateStart = false;
        else {
          const fs = startOfDay(parseISO(filterStart));
          if (startOfDay(row.maxDate) < fs) passDateStart = false;
        }
      }

      if (filterEnd) {
        if (!row.minDate) passDateEnd = false;
        else {
          const fe = startOfDay(parseISO(filterEnd));
          if (startOfDay(row.minDate) > fe) passDateEnd = false;
        }
      }

      return passMes && passDateStart && passDateEnd;
    });
  }, [data, selectedMeses, filterStart, filterEnd]);

  const supervisoresDisponiveis = useMemo(() => {
    const supSet = new Set<string>();
    dataFilteredByDate.forEach(row => {
      const s = row.supervisor ? row.supervisor.trim() : 'N/A';
      if (s) supSet.add(s);
    });
    return Array.from(supSet).sort();
  }, [dataFilteredByDate]);

  const equipesDisponiveis = useMemo(() => {
    const eqSet = new Set<string>();
    dataFilteredByDate.forEach(row => {
      const s = row.supervisor ? row.supervisor.trim() : 'N/A';
      if (selectedSupervisores.length === 0 || selectedSupervisores.includes(s)) {
        eqSet.add(row.equipe);
      }
    });
    return Array.from(eqSet).sort();
  }, [dataFilteredByDate, selectedSupervisores]);

  const toggleSupervisor = (s: string) => {
    setSelectedSupervisores(prev => 
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    );
  };
  
  const toggleEquipe = (e: string) => {
    setSelectedEquipes(prev => 
      prev.includes(e) ? prev.filter(x => x !== e) : [...prev, e]
    );
  };

  const toggleProjeto = (p: string) => {
    setSelectedProjetos(prev => 
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    );
  };

  const toggleMes = (m: string) => {
    setSelectedMeses(prev => 
      prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]
    );
  };

  const baseFilteredData = useMemo(() => {
    return dataFilteredByDate.filter(row => {
      const passSupervisor = selectedSupervisores.length === 0 || selectedSupervisores.includes(row.supervisor ? row.supervisor.trim() : 'N/A');
      const passEquipe = selectedEquipes.length === 0 || selectedEquipes.includes(row.equipe);
      return passSupervisor && passEquipe;
    });
  }, [dataFilteredByDate, selectedSupervisores, selectedEquipes]);

  const projetosDisponiveis = useMemo(() => {
    const projSet = new Set<string>();
    baseFilteredData.forEach(row => {
      row.atividadesDiarias.forEach(ativ => {
        ativ.atividades.forEach(a => {
          if (a.projeto) projSet.add(a.projeto);
        });
      });
    });
    return Array.from(projSet).sort();
  }, [baseFilteredData]);

  const filteredData = useMemo(() => {
    if (selectedProjetos.length === 0) return baseFilteredData;
    
    return baseFilteredData.map(row => {
      return {
        ...row,
        atividadesDiarias: row.atividadesDiarias.map(ativ => ({
          ...ativ,
          atividades: ativ.atividades.filter(a => selectedProjetos.includes(a.projeto))
        })).filter(ativ => ativ.atividades.length > 0)
      };
    }).filter(row => row.atividadesDiarias.length > 0);
  }, [baseFilteredData, selectedProjetos]);

  const dashboardStats = useMemo(() => {
    let valorPlanejadoTotal = 0;
    let valorMetaTotal = 0;
    let realizadoPlanejadoTotal = 0;
    let totalProduzidoTotal = 0;

    filteredData.forEach(row => {
      row.atividadesDiarias.forEach(ativ => {
        let isValidDate = true;
        
        if (selectedMeses.length > 0) {
          const mesAno = format(ativ.dataParsed, 'MMM/yy', { locale: ptBR }).toUpperCase();
          if (!selectedMeses.includes(mesAno)) isValidDate = false;
        }

        if (filterStart) {
          const fs = startOfDay(parseISO(filterStart));
          if (startOfDay(ativ.dataParsed) < fs) isValidDate = false;
        }

        if (filterEnd) {
          const fe = startOfDay(parseISO(filterEnd));
          if (startOfDay(ativ.dataParsed) > fe) isValidDate = false;
        }

        if (isValidDate) {
          ativ.atividades.forEach(a => {
            valorPlanejadoTotal += a.valorPlanejado || 0;
            valorMetaTotal += a.valorMeta || 0;
            realizadoPlanejadoTotal += a.realizadoPlanejado || 0;
            totalProduzidoTotal += a.totalProduzido || 0;
          });
        }
      });
    });

    const percPlanejadoMeta = valorMetaTotal > 0 ? (valorPlanejadoTotal / valorMetaTotal) * 100 : 0;
    const percProducaoMeta = valorMetaTotal > 0 ? (totalProduzidoTotal / valorMetaTotal) * 100 : 0;
    const percCumprimentoPlan = valorPlanejadoTotal > 0 ? (realizadoPlanejadoTotal / valorPlanejadoTotal) * 100 : 0;
    const percProduzidoPlanejado = valorPlanejadoTotal > 0 ? (totalProduzidoTotal / valorPlanejadoTotal) * 100 : 0;

    return {
      valorPlanejadoTotal,
      valorMetaTotal,
      realizadoPlanejadoTotal,
      totalProduzidoTotal,
      percPlanejadoMeta,
      percProducaoMeta,
      percCumprimentoPlan,
      percProduzidoPlanejado
    };
  }, [filteredData, selectedMeses, filterStart, filterEnd]);

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[400px] text-muted-foreground gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p>Analisando alocações de equipes...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[400px] text-destructive gap-2">
        <p>Falha ao carregar os dados de Equipes.</p>
        <p className="text-sm opacity-70">{(error as Error).message}</p>
      </div>
    );
  }

  const getPercentageColorClass = (val: number) => {
    if (val === 0) return "bg-red-500/10 text-red-500";
    if (val <= 40) return "bg-red-500/10 text-red-500";
    if (val <= 80) return "bg-orange-500/10 text-orange-500";
    if (val < 100) return "bg-yellow-500/10 text-yellow-600";
    if (val === 100) return "bg-green-500/10 text-green-500";
    if (val <= 120) return "bg-sky-500/10 text-sky-500";
    return "bg-blue-600/10 text-blue-600";
  };

  const today = startOfDay(new Date());
  const todayPosition = differenceInDays(today, viewStartEfetivo) * dayWidth;

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="flex flex-col h-full w-full bg-background">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 px-6 py-2 shrink-0 border-b border-border">
        <div>
          <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
            Planejamento de Equipes
            <span className="text-muted-foreground text-xs font-normal hidden sm:inline-block">
              - Visualize e filtre o dia a dia de cada equipe
            </span>
          </h1>
        </div>
        <div className="flex items-center gap-4 text-[10px] bg-secondary/20 px-2 py-1 rounded-md border border-border">
           <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 bg-blue-500 rounded-[2px]"></div> <span className="text-muted-foreground font-medium uppercase tracking-wider">1 Obra</span></div>
           <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 bg-orange-500 rounded-[2px]"></div> <span className="text-muted-foreground font-medium uppercase tracking-wider">Múltiplas Obras</span></div>
        </div>
      </div>

      <div className="px-6 py-3 bg-background border-b border-border flex flex-row flex-nowrap gap-4 items-end overflow-x-auto no-scrollbar-custom">
        
        <div className="flex flex-nowrap items-end gap-2 shrink-0">
          {/* Valor Planejado + Cumprimento Planejamento */}
          <div className="flex flex-col justify-center border border-border bg-card p-2 rounded-lg shadow-sm min-w-[120px]">
            <div className="flex items-center gap-2 mb-0.5 justify-between">
              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Valor Planejado</span>
              <span className={cn(
                "text-[9px] font-bold px-1.5 py-0.5 rounded-sm",
                getPercentageColorClass(dashboardStats.percCumprimentoPlan)
              )} title="Cumprimento Planejamento (Realizado Planejado / Valor Planejado)">
                {dashboardStats.percCumprimentoPlan.toFixed(1)}%
              </span>
            </div>
            <span className="text-base font-bold text-foreground tracking-tight truncate" title={formatCurrency(dashboardStats.valorPlanejadoTotal)}>
               {formatCurrency(dashboardStats.valorPlanejadoTotal)}
            </span>
          </div>

          {/* Valor Produzido + Produção x Meta */}
          <div className="flex flex-col justify-center border border-border bg-card p-2 rounded-lg shadow-sm min-w-[120px]">
            <div className="flex items-center gap-2 mb-0.5 justify-between">
              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Valor Produzido</span>
              <span className={cn(
                "text-[9px] font-bold px-1.5 py-0.5 rounded-sm",
                getPercentageColorClass(dashboardStats.percProduzidoPlanejado)
              )} title="% Produzido / Planejado (Total Produzido / Valor Planejado)">
                {dashboardStats.percProduzidoPlanejado.toFixed(1)}%
              </span>
            </div>
            <span className="text-base font-bold text-foreground tracking-tight truncate" title={formatCurrency(dashboardStats.totalProduzidoTotal)}>
               {formatCurrency(dashboardStats.totalProduzidoTotal)}
            </span>
          </div>

          {/* Valor Meta + Planejado x Meta */}
          <div className="flex flex-col justify-center border border-border bg-card p-2 rounded-lg shadow-sm min-w-[120px]">
            <div className="flex items-center gap-2 mb-0.5 justify-between">
              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Valor Meta</span>
              <span className={cn(
                "text-[9px] font-bold px-1.5 py-0.5 rounded-sm",
                getPercentageColorClass(dashboardStats.percPlanejadoMeta)
              )} title="% Planejado / Meta (Valor Planejado / Valor Meta)">
                {dashboardStats.percPlanejadoMeta.toFixed(1)}%
              </span>
            </div>
            <span className="text-base font-bold text-foreground tracking-tight truncate" title={formatCurrency(dashboardStats.valorMetaTotal)}>
               {formatCurrency(dashboardStats.valorMetaTotal)}
            </span>
          </div>
          {/* Divider */}
          <div className="w-px h-10 bg-border mx-1"></div>

          <div className="flex flex-col justify-center min-w-[100px]">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Unidade</span>
            <DropdownMenu 
              open={unidadesDropdownOpen} 
              onOpenChange={(open) => {
                setUnidadesDropdownOpen(open);
                if (!open) {
                  // Aplica os filtros apenas ao fechar o dropdown
                  setSelectedUnidadesIds(draftUnidadesIds);
                } else {
                  // Sincroniza ao abrir
                  setDraftUnidadesIds(selectedUnidadesIds);
                }
              }}
            >
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between text-left font-normal text-xs h-8">
                  <span className="truncate">
                    {draftUnidadesIds.length === 0 
                      ? 'Unidades' 
                      : draftUnidadesIds.length === 1
                        ? UNIDADES_PLANEJAMENTO.find(u => u.id === draftUnidadesIds[0])?.nome
                        : `${draftUnidadesIds.length} unid.`}
                  </span>
                  <Filter className="w-3 h-3 ml-2 opacity-50 shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64 max-h-72 overflow-y-auto">
                <DropdownMenuCheckboxItem
                  checked={draftUnidadesIds.length === UNIDADES_PLANEJAMENTO.length}
                  onSelect={(e) => e.preventDefault()}
                  onCheckedChange={() => {
                    if (draftUnidadesIds.length === UNIDADES_PLANEJAMENTO.length) {
                      setDraftUnidadesIds([]);
                    } else {
                      setDraftUnidadesIds(UNIDADES_PLANEJAMENTO.map(u => u.id));
                    }
                  }}
                >
                  Todas Unidades
                </DropdownMenuCheckboxItem>
                {UNIDADES_PLANEJAMENTO.map(uni => (
                  <DropdownMenuCheckboxItem
                    key={uni.id}
                    checked={draftUnidadesIds.includes(uni.id)}
                    onSelect={(e) => e.preventDefault()}
                    onCheckedChange={() => {
                      setDraftUnidadesIds(prev => 
                        prev.includes(uni.id) ? prev.filter(x => x !== uni.id) : [...prev, uni.id]
                      );
                    }}
                  >
                    {uni.nome}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex flex-col justify-center w-[110px]">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Supervisor</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between text-left font-normal text-xs h-8">
                  <span className="truncate">
                    {selectedSupervisores.length === 0 
                      ? 'Supervisores' 
                      : `${selectedSupervisores.length} supervisor(es)`}
                  </span>
                  <Filter className="w-3 h-3 ml-2 opacity-50 shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64 max-h-72 overflow-y-auto">
                <DropdownMenuCheckboxItem
                  checked={selectedSupervisores.length === 0}
                  onSelect={(e) => e.preventDefault()}
                  onCheckedChange={() => setSelectedSupervisores([])}
                >
                  Todos Supervisores
                </DropdownMenuCheckboxItem>
                {supervisoresDisponiveis.map(sup => (
                  <DropdownMenuCheckboxItem
                    key={sup}
                    checked={selectedSupervisores.includes(sup)}
                    onSelect={(e) => e.preventDefault()}
                    onCheckedChange={() => toggleSupervisor(sup)}
                  >
                    {sup}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex flex-col justify-center w-[110px]">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Equipe</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between text-left font-normal text-xs h-8">
                  <span className="truncate">
                    {selectedEquipes.length === 0 
                      ? 'Todas as Equipes' 
                      : `${selectedEquipes.length} equipe(s)`}
                  </span>
                  <Filter className="w-3 h-3 ml-2 opacity-50 shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64 max-h-72 overflow-y-auto">
                <DropdownMenuCheckboxItem
                  checked={selectedEquipes.length === 0}
                  onSelect={(e) => e.preventDefault()}
                  onCheckedChange={() => setSelectedEquipes([])}
                >
                  Todas as Equipes
                </DropdownMenuCheckboxItem>
                {equipesDisponiveis.map(eq => (
                  <DropdownMenuCheckboxItem
                    key={eq}
                    checked={selectedEquipes.includes(eq)}
                    onSelect={(e) => e.preventDefault()}
                    onCheckedChange={() => toggleEquipe(eq)}
                  >
                    {eq}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex flex-col justify-center w-[110px]">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Projeto</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between text-left font-normal text-xs h-8">
                  <span className="truncate">
                    {selectedProjetos.length === 0 
                      ? 'Todos Projetos' 
                      : `${selectedProjetos.length} projeto(s)`}
                  </span>
                  <Filter className="w-3 h-3 ml-2 opacity-50 shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64 max-h-72 overflow-y-auto">
                <DropdownMenuCheckboxItem
                  checked={selectedProjetos.length === 0}
                  onSelect={(e) => e.preventDefault()}
                  onCheckedChange={() => setSelectedProjetos([])}
                >
                  Todos Projetos
                </DropdownMenuCheckboxItem>
                {projetosDisponiveis.map(proj => (
                  <DropdownMenuCheckboxItem
                    key={proj}
                    checked={selectedProjetos.includes(proj)}
                    onSelect={(e) => e.preventDefault()}
                    onCheckedChange={() => toggleProjeto(proj)}
                  >
                    {proj}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex flex-col justify-center w-24">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Mês</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between text-left font-normal text-xs h-8">
                  <span className="truncate">
                    {selectedMeses.length === 0 
                      ? 'Todos Meses' 
                      : `${selectedMeses.length} mês`}
                  </span>
                  <Filter className="w-3 h-3 ml-2 opacity-50 shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64 max-h-72 overflow-y-auto">
                <DropdownMenuCheckboxItem
                  checked={selectedMeses.length === 0}
                  onSelect={(e) => e.preventDefault()}
                  onCheckedChange={() => setSelectedMeses([])}
                >
                  Todos Meses
                </DropdownMenuCheckboxItem>
                {mesesDisponiveis.map(mes => (
                  <DropdownMenuCheckboxItem
                    key={mes}
                    checked={selectedMeses.includes(mes)}
                    onSelect={(e) => e.preventDefault()}
                    onCheckedChange={() => toggleMes(mes)}
                  >
                    {mes}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          
          <div className="flex flex-col justify-center">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Período</span>
            <div className="flex items-center gap-1.5 bg-secondary/30 rounded-md border border-border px-2 h-8">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="date"
                value={filterStart}
                onChange={(e) => setFilterStart(e.target.value)}
                className="h-full bg-transparent text-[10px] text-foreground focus-visible:outline-none w-[80px]"
                title="A partir de"
              />
              <span className="text-muted-foreground text-[10px]">até</span>
              <input
                type="date"
                value={filterEnd}
                onChange={(e) => setFilterEnd(e.target.value)}
                className="h-full bg-transparent text-[10px] text-foreground focus-visible:outline-none w-[80px]"
                title="Até"
              />
              {(filterStart || filterEnd) && (
                <button onClick={() => { setFilterStart(''); setFilterEnd(''); }} className="text-[10px] text-muted-foreground hover:text-foreground underline ml-1">
                  Limpar
                </button>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => refetch()}
              disabled={isRefetching}
              title="Atualizar Dados"
              className="h-8 text-xs mr-1"
            >
              <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", isRefetching && "animate-spin")} />
              Atualizar
            </Button>
            <div className="w-px h-5 bg-border mr-1"></div>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setViewStartManual(subDays(viewStartManual, 7))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs px-3" onClick={() => setViewStartManual(startOfDay(subDays(new Date(), 3)))}>
              Hoje
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setViewStartManual(addDays(viewStartManual, 7))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col bg-card relative">
        <div className="flex-1 overflow-auto relative flex no-scrollbar-custom">
          <div className="flex min-w-max h-max">
            
            <div className="w-[280px] flex-shrink-0 sticky left-0 z-30 bg-card border-r border-border flex flex-col shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
              <div className="h-12 bg-secondary/95 backdrop-blur border-b border-border p-3 flex flex-col justify-center sticky top-0 z-40">
                <span className="font-semibold text-xs text-foreground">Equipe</span>
                <span className="text-[10px] text-muted-foreground">Supervisor</span>
              </div>
              
              <div className="flex flex-col bg-background/50">
                {filteredData.map((row, i) => (
                  <div
                    key={i}
                    className="h-10 border-b border-border px-3 flex flex-col justify-center group hover:bg-secondary/30 transition-colors"
                  >
                    <p className="text-xs font-semibold text-foreground truncate" title={row.equipe}>
                      {row.equipe}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate" title={row.supervisor}>
                      {row.supervisor || 'Sem supervisor'}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex-shrink-0 flex flex-col relative" style={{ width: daysToShowEfetivo * dayWidth }}>
              <div className="h-12 bg-secondary/95 backdrop-blur border-b border-border flex sticky top-0 z-20">
                {dates.map((date, i) => {
                  const isCurrentDay = differenceInDays(date, today) === 0;
                  const isSaturday = date.getDay() === 6;
                  const isSunday = date.getDay() === 0;
                  return (
                    <div
                      key={i}
                      className={cn(
                        'flex-shrink-0 border-r border-border flex flex-col items-center justify-center text-[10px]',
                        isSaturday && 'bg-slate-100 dark:bg-slate-800/40',
                        isSunday && 'bg-slate-200 dark:bg-slate-800/80',
                        isCurrentDay && 'bg-primary/10 text-primary font-bold',
                        !isCurrentDay && 'text-muted-foreground'
                      )}
                      style={{ width: dayWidth }}
                    >
                      <span className="text-[8px] text-muted-foreground uppercase tracking-tighter">
                        {format(date, 'EEE', { locale: ptBR })}
                      </span>
                      <span className={cn(
                        'text-[10px] font-bold tracking-tighter',
                        isCurrentDay ? 'text-primary' : 'text-foreground'
                      )}>
                        {format(date, 'dd/MM')}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-col relative bg-background/30">
                <div className="absolute inset-0 flex pointer-events-none z-0">
                  {dates.map((date, i) => {
                    const isSaturday = date.getDay() === 6;
                    const isSunday = date.getDay() === 0;
                    return (
                      <div 
                        key={i} 
                        className={cn(
                          "flex-shrink-0 border-r border-border/50",
                          isSaturday && "bg-slate-100/50 dark:bg-slate-800/30",
                          isSunday && "bg-slate-200/50 dark:bg-slate-800/60"
                        )}
                        style={{ width: dayWidth }}
                      />
                    );
                  })}
                </div>

                {todayPosition >= 0 && todayPosition < daysToShowEfetivo * dayWidth && (
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-primary z-10 pointer-events-none"
                    style={{ left: todayPosition + dayWidth / 2 }}
                  />
                )}

                {filteredData.map((row, i) => (
                  <div
                    key={i}
                    className="h-10 border-b border-border/40 relative flex items-center"
                  >
                    {row.atividadesDiarias?.map((ativ, idx) => {
                      const daysDiff = differenceInDays(ativ.dataParsed, viewStartEfetivo);
                      if (daysDiff < 0 || daysDiff >= daysToShowEfetivo) return null;
                      
                      const hasMultiple = ativ.atividades.length > 1;

                      const combinedEtapas = Array.from(new Set(ativ.atividades.map(a => a.etapa).filter(e => e))).join(' | ');
                      
                      const isFolga = combinedEtapas.toLowerCase().includes('folga');
                      const isSemProjeto = ativ.atividades.every(a => a.projeto === 'Sem Projeto');
                      const isFolgaSemProjeto = isFolga && isSemProjeto;

                      const etapaColorClass = isFolgaSemProjeto 
                        ? "bg-slate-500 border-slate-600 hover:bg-slate-400 text-white" 
                        : getEtapaColorClass(combinedEtapas);

                      return (
                        <div key={idx} className="absolute h-10 w-full" style={{ left: daysDiff * dayWidth, width: dayWidth }}>
                          {/* Etapa Block (Top) */}
                          <div
                            className={cn(
                              "absolute top-[3px] h-3.5 rounded-[2px] border shadow-sm flex items-center justify-center z-10 cursor-pointer transition-colors",
                              etapaColorClass
                            )}
                            style={{ left: 1, width: dayWidth - 2 }}
                            title={`Data: ${format(ativ.dataParsed, 'dd/MM/yyyy')}\nEtapas: ${combinedEtapas || 'Sem etapa'}`}
                          >
                            <span className="text-[8px] text-zinc-100 font-bold uppercase tracking-tighter truncate px-0.5 pointer-events-none">
                              {combinedEtapas ? combinedEtapas.substring(0, 3) : '-'}
                            </span>
                          </div>

                          {/* Projeto Block (Bottom) */}
                          <div
                            className={cn(
                              "absolute top-[18px] h-5 rounded-[3px] shadow-sm flex flex-col items-center justify-center z-10 cursor-pointer transition-all hover:scale-105 border px-0.5 overflow-hidden",
                              isFolgaSemProjeto 
                                ? "bg-slate-500 border-slate-600 hover:bg-slate-400" 
                                : (hasMultiple ? "bg-orange-500 border-orange-600 hover:bg-orange-400" : "bg-blue-500 border-blue-600 hover:bg-blue-400")
                            )}
                            style={{ left: 1, width: dayWidth - 2 }}
                            title={`Data: ${format(ativ.dataParsed, 'dd/MM/yyyy')}\nProjetos: \n${ativ.atividades.map(a => '- ' + a.projeto).join('\n')}`}
                          >
                            {ativ.atividades.map((a, pIdx) => (
                               <span key={pIdx} className={cn(
                                 "text-white font-bold leading-tight tracking-tighter truncate w-full text-center",
                                 hasMultiple ? "text-[8px]" : "text-[9px]"
                               )}>
                                 {a.projeto.split('-').pop()?.trim() || a.projeto}
                               </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
