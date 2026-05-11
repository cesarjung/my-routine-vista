import React, { useState, useMemo } from 'react';
import { usePlanejamentoSemanalData } from '@/hooks/usePlanejamentoSemanalData';
import { startOfWeek, endOfWeek } from 'date-fns';
import { RefreshCw, Filter, Calendar, Settings, AlertTriangle, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { Input } from '@/components/ui/input';
import { UNIDADES_PLANEJAMENTO } from '@/constants/unidades';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Agrupador auxiliar
type DailyStats = {
  equipe: string;
  data: string;
  valPlanejado: number;
  metaEquipe: number;
  tempoDeslocamento: number;
  tempoPlanejado: number;
  unidadeNome: string;
  supervisor: string;
};

type WeeklyStats = {
  equipe: string;
  unidadeNome: string;
  valPlanejado: number;
  metaEquipe: number;
  diasDeficit: number; // dias em que planejado < meta
};

export const PlanejamentoSemanalView = () => {
  // Estado de Filtros
  const [selectedUnidades, setSelectedUnidades] = useState<string[]>(
    UNIDADES_PLANEJAMENTO.map(u => u.id)
  );

  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({
    from: startOfWeek(new Date(), { weekStartsOn: 1 }), // Segunda-feira
    to: endOfWeek(new Date(), { weekStartsOn: 1 }) // Domingo
  });

  const [limiteDeslocamento, setLimiteDeslocamento] = useState<number>(2.0);

  const [selectedEquipes, setSelectedEquipes] = useState<string[]>([]);
  const [selectedSupervisores, setSelectedSupervisores] = useState<string[]>([]);

  const { data: rawData, isLoading, refetch, isRefetching } = usePlanejamentoSemanalData(
    selectedUnidades, 
    dateRange.from, 
    dateRange.to
  );

  // Processamento de Dados (Agrupamento por Dia/Equipe e Semana/Equipe)
  const { dailyStats, weeklyStats, equipesUnicas, supervisoresUnicos } = useMemo(() => {
    const dailyMap = new Map<string, DailyStats>();
    const weeklyMap = new Map<string, WeeklyStats>();
    
    const equipesSet = new Set<string>();
    const supervisoresSet = new Set<string>();

    rawData.forEach(row => {
      equipesSet.add(row.equipe);
      supervisoresSet.add(row.supervisor);
      
      // Chave diária: Equipe + Data
      const dailyKey = `${row.equipe}|${row.dataString}`;
      if (!dailyMap.has(dailyKey)) {
        dailyMap.set(dailyKey, {
          equipe: row.equipe,
          data: row.dataString,
          valPlanejado: 0,
          metaEquipe: 0,
          tempoDeslocamento: 0,
          tempoPlanejado: 0,
          unidadeNome: row.unidadeNome,
          supervisor: row.supervisor
        });
      }
      const day = dailyMap.get(dailyKey)!;
      day.valPlanejado += row.valPlanejado;
      day.metaEquipe += row.metaEquipe;
      day.tempoDeslocamento += row.tempoDeslocamento;
      day.tempoPlanejado += row.tempoPlanejado;

      // Chave semanal: Equipe
      const weeklyKey = row.equipe;
      if (!weeklyMap.has(weeklyKey)) {
        weeklyMap.set(weeklyKey, {
          equipe: row.equipe,
          unidadeNome: row.unidadeNome,
          valPlanejado: 0,
          metaEquipe: 0,
          diasDeficit: 0
        });
      }
      const week = weeklyMap.get(weeklyKey)!;
      week.valPlanejado += row.valPlanejado;
      week.metaEquipe += row.metaEquipe; // Assumindo que a meta é diluída ou somada ao longo dos dias? Se a meta é a mesma todos os dias (repetida), talvez devamos pegar a MAX?
      // O usuário diz: "A meta das Equipes ativas considera só quem está disponível na semana."
      // Para segurança, vamos somar as metas diárias para ter a meta da semana, assumindo que a planilha já dilui.
    });

    // Calcula dias de déficit na semana
    const dailyArr = Array.from(dailyMap.values());
    dailyArr.forEach(day => {
      if (day.valPlanejado < day.metaEquipe && day.metaEquipe > 0) {
        const week = weeklyMap.get(day.equipe);
        if (week) week.diasDeficit += 1;
      }
    });

    const weeklyArr = Array.from(weeklyMap.values());
    
    return {
      dailyStats: dailyArr,
      weeklyStats: weeklyArr,
      equipesUnicas: Array.from(equipesSet).sort(),
      supervisoresUnicos: Array.from(supervisoresSet).sort()
    };
  }, [rawData]);

  // Aplicação dos filtros de Equipe e Supervisor
  const filteredDailyStats = useMemo(() => {
    return dailyStats.filter(d => {
      if (selectedEquipes.length > 0 && !selectedEquipes.includes(d.equipe)) return false;
      if (selectedSupervisores.length > 0 && !selectedSupervisores.includes(d.supervisor)) return false;
      return true;
    });
  }, [dailyStats, selectedEquipes, selectedSupervisores]);

  // Cálculos dinâmicos com base nos dados filtrados
  const { filteredWeeklyStats, totals } = useMemo(() => {
    const weeklyMap = new Map<string, { equipe: string, valPlanejado: number, metaEquipe: number }>();
    
    let totalPlanejado = 0;
    let totalMeta = 0;
    
    let totalDeslocamento = 0;
    let countDeslocamento = 0;
    let totalTempoServico = 0;
    let countServico = 0;

    filteredDailyStats.forEach(d => {
      if (!weeklyMap.has(d.equipe)) {
        weeklyMap.set(d.equipe, { equipe: d.equipe, valPlanejado: 0, metaEquipe: 0 });
      }
      const week = weeklyMap.get(d.equipe)!;
      week.valPlanejado += d.valPlanejado;
      week.metaEquipe += d.metaEquipe;

      // Card 02 and 03
      if (d.tempoDeslocamento > 0) {
        totalDeslocamento += d.tempoDeslocamento;
        countDeslocamento++;
      }
      if (d.tempoPlanejado > 0) {
        totalTempoServico += d.tempoPlanejado;
        countServico++;
      }
    });

    const weeklyArr = Array.from(weeklyMap.values());
    
    weeklyArr.forEach(w => {
      totalPlanejado += w.valPlanejado;
      totalMeta += w.metaEquipe;
    });

    return {
      filteredWeeklyStats: weeklyArr,
      totals: {
        totalPlanejado,
        totalMeta,
        percentMeta: totalMeta > 0 ? (totalPlanejado / totalMeta) * 100 : 0,
        avgDeslocamento: countDeslocamento > 0 ? totalDeslocamento / countDeslocamento : 0,
        avgTempoServico: countServico > 0 ? totalTempoServico / countServico : 0
      }
    };
  }, [filteredDailyStats]);

  // Filtros de Escalação (Tabelas)
  const deficitMetaEquipes = useMemo(() => {
    return filteredWeeklyStats
      .filter(w => w.metaEquipe > 0)
      .sort((a, b) => {
        const aDeficit = a.valPlanejado < a.metaEquipe;
        const bDeficit = b.valPlanejado < b.metaEquipe;

        // Grupo vermelho (déficit) primeiro, verde depois
        if (aDeficit && !bDeficit) return -1;
        if (!aDeficit && bDeficit) return 1;

        // Dentro de cada grupo, ordena em ordem decrescente de % atingido
        const percentA = a.valPlanejado / a.metaEquipe;
        const percentB = b.valPlanejado / b.metaEquipe;
        
        return percentB - percentA;
      });
  }, [filteredWeeklyStats]);

  const hasDeficit = deficitMetaEquipes.some(w => w.valPlanejado < w.metaEquipe);

  const excessoDeslocamento = useMemo(() => {
    return filteredDailyStats.filter(d => d.tempoDeslocamento > limiteDeslocamento)
      .sort((a, b) => b.tempoDeslocamento - a.tempoDeslocamento);
  }, [filteredDailyStats, limiteDeslocamento]);

  const subutilizadas = useMemo(() => {
    return filteredDailyStats.filter(d => d.tempoPlanejado < 8.0 && d.tempoPlanejado > 0)
      .sort((a, b) => a.tempoPlanejado - b.tempoPlanejado);
  }, [filteredDailyStats]);


  // Handlers
  const handleRefresh = () => {
    refetch();
  };

  const renderMultiSelect = (
    label: string, 
    options: { value: string | number; label: string }[], 
    selectedValues: any[], 
    onChange: (val: any[]) => void
  ) => {
    return (
      <div className="flex flex-col justify-center min-w-[120px]">
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">{label}</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full justify-between text-left font-normal text-[11px] h-8 bg-background">
              <span className="truncate">{selectedValues.length === 0 ? 'Todos' : `${selectedValues.length} selec.`}</span>
              <Filter className="w-3 h-3 ml-2 opacity-50 shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56 max-h-[500px] overflow-y-auto z-[9999]" align="start">
            <div className="p-2 border-b border-border flex gap-2 sticky top-0 bg-popover z-10">
              <Button variant="secondary" size="sm" className="w-full text-xs h-7" onClick={() => onChange(options.map(o => o.value))}>Todas</Button>
              <Button variant="outline" size="sm" className="w-full text-xs h-7" onClick={() => onChange([])}>Limpar</Button>
            </div>
            {options.map((opt) => (
              <DropdownMenuCheckboxItem
                key={opt.value}
                checked={selectedValues.includes(opt.value)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    onChange([...selectedValues, opt.value]);
                  } else {
                    onChange(selectedValues.filter((v) => v !== opt.value));
                  }
                }}
                onSelect={(e) => e.preventDefault()}
              >
                {opt.label}
              </DropdownMenuCheckboxItem>
            ))}
            {options.length === 0 && (
               <div className="px-2 py-2 text-sm text-muted-foreground text-center">Nenhuma opção</div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      
      {/* 1. HEADER E FILTROS */}
      <div className="flex flex-col justify-between items-start gap-4 bg-card p-4 rounded-xl shadow-sm border border-border">
        <div className="flex flex-row justify-between w-full items-center">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Planejamento Semanal</h2>
            <p className="text-sm text-muted-foreground">Monitoramento de aderência aos 3 critérios de planejamento.</p>
          </div>
          <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isRefetching || isLoading} className="h-9 w-9">
            <RefreshCw className={`w-4 h-4 ${isRefetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        
        <div className="flex flex-wrap items-end gap-3 w-full">
          {renderMultiSelect("Unidade", UNIDADES_PLANEJAMENTO.map(u => ({ value: u.id, label: u.nome })), selectedUnidades, setSelectedUnidades)}
          {renderMultiSelect("Supervisor", supervisoresUnicos.map(s => ({ value: s, label: s })), selectedSupervisores, setSelectedSupervisores)}
          {renderMultiSelect("Equipe", equipesUnicas.map(e => ({ value: e, label: e })), selectedEquipes, setSelectedEquipes)}

          <div className="flex flex-col justify-center min-w-[200px]">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Período</span>
            <DatePickerWithRange 
              date={dateRange} 
              setDate={(r) => setDateRange(r || {})} 
              className="h-8 w-full"
            />
          </div>

          <div className="flex flex-col justify-center">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Limite Deslocamento</span>
            <div className="flex items-center gap-2 border border-input rounded-md px-2 h-8 bg-background focus-within:ring-1 focus-within:ring-ring">
              <Settings className="w-3.5 h-3.5 text-muted-foreground" />
              <Input 
                type="number" 
                step="0.5" 
                min="0"
                value={limiteDeslocamento} 
                onChange={(e) => setLimiteDeslocamento(Number(e.target.value) || 0)}
                className="w-16 h-6 px-1 py-0 text-center text-[11px] font-bold border-none shadow-none focus-visible:ring-0"
              />
              <span className="text-[11px] font-medium text-muted-foreground">h</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. CARDS DE RESUMO */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Meta vs Planejado */}
        <div className="bg-card border border-border p-5 rounded-xl shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wider mb-2">01. Meta das Equipes Ativas</h3>
            <p className="text-xs text-muted-foreground mb-4">Mostra se o plano cobre a meta das equipes que de fato vão rodar na semana.</p>
          </div>
          <div className="flex items-end justify-between">
            <div>
              <p className={`text-4xl font-bold ${totals.percentMeta >= 100 ? 'text-green-500' : 'text-red-500'}`}>
                {totals.percentMeta.toFixed(1)}%
              </p>
              <p className="text-[10px] font-semibold mt-1 text-muted-foreground">
                Plan: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(totals.totalPlanejado)} / 
                Meta: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(totals.totalMeta)}
              </p>
            </div>
            {hasDeficit && (
              <div className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-md animate-pulse">
                DISPARA ESCALAÇÃO
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Tempo Médio de Deslocamento */}
        <div className="bg-card border border-border p-5 rounded-xl shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wider mb-2">02. Deslocamento Médio</h3>
            <p className="text-xs text-muted-foreground mb-4">Mostra se a equipe vai gastar tempo demais na estrada antes de produzir.</p>
          </div>
          <div className="flex items-end justify-between">
            <div>
              <p className={`text-4xl font-bold ${totals.avgDeslocamento > limiteDeslocamento ? 'text-orange-500' : 'text-green-500'}`}>
                {totals.avgDeslocamento.toFixed(1)}h
              </p>
              <p className="text-xs font-semibold mt-1 text-muted-foreground">média por dia/equipe</p>
            </div>
            {excessoDeslocamento.length > 0 && (
              <div className="bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded-md animate-pulse">
                DISPARA ESCALAÇÃO
              </div>
            )}
          </div>
        </div>

        {/* Card 3: Tempo Planejado por Equipe */}
        <div className="bg-card border border-border p-5 rounded-xl shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wider mb-2">03. Tempo Planejado</h3>
            <p className="text-xs text-muted-foreground mb-4">Mostra se a equipe foi planejada para uma jornada cheia de trabalho.</p>
          </div>
          <div className="flex items-end justify-between">
            <div>
              <p className={`text-4xl font-bold ${totals.avgTempoServico < 8 ? 'text-red-500' : 'text-green-500'}`}>
                {totals.avgTempoServico.toFixed(1)}h
              </p>
              <p className="text-xs font-semibold mt-1 text-muted-foreground">média por dia/equipe</p>
            </div>
            {subutilizadas.length > 0 && (
              <div className="bg-green-600 text-white text-xs font-bold px-2 py-1 rounded-md animate-pulse">
                DISPARA ESCALAÇÃO
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. TABELAS DE DETALHAMENTO / ESCALAÇÃO */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Tabela 1: Equipes Fora da Meta */}
        <div className="bg-card border border-border rounded-xl shadow-sm flex flex-col overflow-hidden h-[500px]">
          <div className="p-3 border-b border-border bg-muted/30 flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            <h3 className="font-bold text-sm text-foreground">Aderência da Meta por Equipe</h3>
          </div>
          <div className="flex-1 overflow-auto custom-scrollbar p-0">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-3 py-2 font-semibold">Equipe</th>
                  <th className="px-3 py-2 font-semibold text-right">Plan. Total</th>
                  <th className="px-3 py-2 font-semibold text-right">Meta Total</th>
                  <th className="px-3 py-2 font-semibold text-right">% Atingido</th>
                </tr>
              </thead>
              <tbody>
                {deficitMetaEquipes.map((d, i) => {
                  const isDeficit = d.valPlanejado < d.metaEquipe;
                  const valColor = isDeficit ? "text-red-500" : "text-green-500";
                  const percent = d.metaEquipe > 0 ? (d.valPlanejado / d.metaEquipe) * 100 : 0;
                  
                  return (
                    <tr key={i} className="border-b border-border/50 hover:bg-muted/20">
                      <td className="px-3 py-2 font-bold truncate max-w-[120px]" title={d.equipe}>
                        {d.equipe}
                      </td>
                      <td className={`px-3 py-2 text-right font-medium ${valColor}`}>
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(d.valPlanejado)}
                      </td>
                      <td className="px-3 py-2 text-right text-muted-foreground">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(d.metaEquipe)}
                      </td>
                      <td className={`px-3 py-2 text-right font-bold ${valColor}`}>
                        {percent.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
                {deficitMetaEquipes.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Nenhuma equipe com meta</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tabela 2: Excesso de Deslocamento */}
        <div className="bg-card border border-orange-500/20 rounded-xl shadow-sm flex flex-col overflow-hidden h-[500px]">
          <div className="p-3 border-b border-border bg-orange-500/5 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-500" />
            <h3 className="font-bold text-sm text-orange-600">Deslocamento &gt; {limiteDeslocamento}h</h3>
          </div>
          <div className="flex-1 overflow-auto custom-scrollbar p-0">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-3 py-2 font-semibold">Equipe / Dia</th>
                  <th className="px-3 py-2 font-semibold text-right">Tempo</th>
                </tr>
              </thead>
              <tbody>
                {excessoDeslocamento.map((d, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="px-3 py-2">
                      <div className="font-bold truncate max-w-[150px]" title={d.equipe}>{d.equipe}</div>
                      <div className="text-[10px] text-muted-foreground">{d.data}</div>
                    </td>
                    <td className="px-3 py-2 text-right text-orange-500 font-bold">
                      {d.tempoDeslocamento.toFixed(1)}h
                    </td>
                  </tr>
                ))}
                {excessoDeslocamento.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-4 py-8 text-center text-muted-foreground">Nenhuma escalação</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tabela 3: Subutilizadas (< 8h) */}
        <div className="bg-card border border-green-600/20 rounded-xl shadow-sm flex flex-col overflow-hidden h-[500px]">
          <div className="p-3 border-b border-border bg-green-600/5 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-green-600" />
            <h3 className="font-bold text-sm text-green-600">Planejadas &lt; 8.0h</h3>
          </div>
          <div className="flex-1 overflow-auto custom-scrollbar p-0">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-3 py-2 font-semibold">Equipe / Dia</th>
                  <th className="px-3 py-2 font-semibold text-right">Tempo</th>
                </tr>
              </thead>
              <tbody>
                {subutilizadas.map((d, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="px-3 py-2">
                      <div className="font-bold truncate max-w-[150px]" title={d.equipe}>{d.equipe}</div>
                      <div className="text-[10px] text-muted-foreground">{d.data}</div>
                    </td>
                    <td className="px-3 py-2 text-right text-green-600 font-bold">
                      {d.tempoPlanejado.toFixed(1)}h
                    </td>
                  </tr>
                ))}
                {subutilizadas.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-4 py-8 text-center text-muted-foreground">Nenhuma escalação</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};
