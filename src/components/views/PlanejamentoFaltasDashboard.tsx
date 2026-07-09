import React, { useState, useMemo } from 'react';
import { 
  AlertTriangle, ClipboardList, AlertCircle, CheckCircle2, 
  HelpCircle, Download, Calendar, Users, Eye, Play, ArrowRight,
  TrendingDown, ShieldAlert, Loader2, Search
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { downloadCSV } from '@/utils/csvExport';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { parse, format, addDays, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const formatSafe = (date: any, pattern: string, options?: any) => {
  if (!date) return '';
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  if (d instanceof Date && !isNaN(d.getTime())) {
    return format(d, pattern, options);
  }
  return '';
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0
  }).format(value);
};

interface PlanejamentoFaltasDashboardProps {
  data: any;
  filterStart: string;
  filterEnd: string;
}

export const PlanejamentoFaltasDashboard: React.FC<PlanejamentoFaltasDashboardProps> = ({
  data,
  filterStart,
  filterEnd
}) => {
  if (!data || !data.faltasDashboard) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-violet-600 animate-pulse" />
        <p className="text-muted-foreground animate-pulse text-sm">Carregando dados do painel...</p>
      </div>
    );
  }

  const dashData = data?.faltasDashboard;
  
  // Filtro por dia selecionado na listagem de faltas
  const [selectedDayFilter, setSelectedDayFilter] = useState<string>('todos');

  // Estado para modal de análise (Analisar)
  const [analyzingCode, setAnalyzingCode] = useState<string | null>(null);
  
  // Estado para modal de simulação de reprogramação (Reprogramar)
  const [reprogrammingProg, setReprogrammingProg] = useState<any | null>(null);
  
  // Estados para o simulador de entrada de estoque
  const [simulatedQty, setSimulatedQty] = useState<number>(0);
  const [simulatedDate, setSimulatedDate] = useState<string>(
    formatSafe(addDays(new Date(), 2), 'yyyy-MM-dd')
  );
  const [simulationResult, setSimulationResult] = useState<string | null>(null);

  // Estado para modal de detalhes dos KPIs
  interface KPIModalInfo {
    isOpen: boolean;
    title: string;
    description: string;
    headers: string[];
    rows: (string | number)[][];
  }
  const [kpiModal, setKpiModal] = useState<KPIModalInfo>({
    isOpen: false,
    title: '',
    description: '',
    headers: [],
    rows: []
  });
  const [modalSearch, setModalSearch] = useState('');

  const handleOpenItensModal = () => {
    const headers = ['Código', 'Descrição', 'Grupo Traduzido', 'Criticidade', 'Qtd Faltante', 'Qtd Necessária', 'Estoque', 'Primeiro Dia Afetado', 'Equipes Afetadas'];
    const rows = (dashData?.faltas || []).map((f: any) => [
      f.codigo,
      f.descricao,
      f.grupoTraduzido,
      f.critico ? 'Crítico' : 'Normal',
      formatQtd(f.falta),
      formatQtd(f.necessario),
      f.estoqueDesconhecido ? 'Desconhecido' : formatQtd(f.estoque),
      f.primeiroDiaComprometido ? formatSafe(f.primeiroDiaComprometido, 'dd/MM/yyyy') : '-',
      f.equipes.join(' | ')
    ]);
    setKpiModal({
      isOpen: true,
      title: 'Itens em Falta',
      description: 'Detalhamento de materiais com falta de estoque registrada no período.',
      headers,
      rows
    });
  };

  const handleOpenAfetadosModal = () => {
    const headers = ['Dia', 'Equipe', 'Obra', 'Status', 'Valor Planejado', 'Materiais Faltantes'];
    const rows = (dashData?.afetados || []).map((p: any) => [
      p.dataString,
      p.equipe,
      p.obra,
      p.status === 'BLOQUEADO' ? 'Bloqueado' : 'Parcial',
      formatCurrency(p.valorPlanejado || 0),
      p.faltas.map((f: any) => `${f.descricao} (Falta: ${f.faltaAlocada})`).join(' | ')
    ]);
    setKpiModal({
      isOpen: true,
      title: 'Programações Afetadas (Faltas)',
      description: 'Lista de programações cujo andamento está comprometido ou impedido devido à falta de estoque.',
      headers,
      rows
    });
  };

  const handleOpenSemOrcamentoModal = () => {
    const headers = ['Obra', 'Ponto'];
    const rows = (data?.pontosSemOrcamento || []).map((key: string) => {
      const parts = key.split('_');
      const obra = parts[0];
      const ponto = parts.slice(1).join('_') || 'Sem Ponto';
      return [obra, ponto];
    });
    setKpiModal({
      isOpen: true,
      title: 'Pontos Sem Orçamento (Sem Visibilidade)',
      description: 'Pontos programados que não possuem correspondência de materiais no cadastro do sistema.',
      headers,
      rows
    });
  };

  const filteredModalRows = useMemo(() => {
    if (!kpiModal.rows) return [];
    const query = modalSearch.trim().toLowerCase();
    if (!query) return kpiModal.rows;
    return kpiModal.rows.filter(row => 
      row.some(cell => String(cell).toLowerCase().includes(query))
    );
  }, [kpiModal.rows, modalSearch]);

  // 1. Lista de dias disponíveis para filtrar
  const availableDays = useMemo(() => {
    if (!dashData?.cobertura) return [];
    return dashData.cobertura.map((c: any) => c.dateString);
  }, [dashData?.cobertura]);

  // 2. Filtra a tabela de faltas por dia selecionado
  const filteredFaltas = useMemo(() => {
    if (!dashData?.faltas) return [];
    if (selectedDayFilter === 'todos') return dashData.faltas;
    
    return dashData.faltas.filter((f: any) => {
      if (!f.primeiroDiaComprometido) return false;
      const formattedDay = formatSafe(f.primeiroDiaComprometido, 'dd/MM/yyyy');
      return formattedDay === selectedDayFilter;
    });
  }, [dashData?.faltas, selectedDayFilter]);

  // 3. Formatação da data do romaneio para exibição
  const periodText = useMemo(() => {
    if (filterStart && filterEnd) {
      if (filterStart === filterEnd) {
        const parsed = parse(filterStart, 'yyyy-MM-dd', new Date());
        if (isValid(parsed)) return formatSafe(parsed, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
      } else {
        const pStart = parse(filterStart, 'yyyy-MM-dd', new Date());
        const pEnd = parse(filterEnd, 'yyyy-MM-dd', new Date());
        if (isValid(pStart) && isValid(pEnd)) {
          return `${formatSafe(pStart, "dd/MM/yyyy")} até ${formatSafe(pEnd, "dd/MM/yyyy")}`;
        }
      }
    }
    return filterStart || 'Período não definido';
  }, [filterStart, filterEnd]);

  // Encontra a falta que está sendo analisada
  const activeAnalysis = useMemo(() => {
    if (!analyzingCode || !dashData?.faltas) return null;
    return dashData.faltas.find((f: any) => f.codigo === analyzingCode);
  }, [analyzingCode, dashData?.faltas]);

  // Formatação de quantidade decimal/inteiro
  const formatQtd = (val: number | null | undefined) => {
    if (val === undefined || val === null) return '';
    return val % 1 === 0 ? String(val) : Number(val.toFixed(1)).toString().replace('.', ',');
  };

  // 4. Exportar CSV de Faltas
  const handleExportFaltasCsv = () => {
    if (!dashData?.faltas || dashData.faltas.length === 0) return;
    
    const headers = ['Código', 'Descrição', 'Grupo Traduzido', 'Criticidade', 'Qtd Faltante', 'Qtd Necessária', 'Estoque', 'Primeiro Dia Afetado', 'Equipes Afetadas'];
    const rows = dashData.faltas.map((f: any) => [
      f.codigo,
      f.descricao,
      f.grupoTraduzido,
      f.critico ? "CRÍTICO" : "NORMAL",
      formatQtd(f.falta),
      formatQtd(f.necessario),
      f.estoqueDesconhecido ? "DESCONHECIDO" : formatQtd(f.estoque),
      f.primeiroDiaComprometido ? formatSafe(f.primeiroDiaComprometido, 'dd/MM/yyyy') : '-',
      f.equipes.join(' | ')
    ]);

    downloadCSV(`Shortages_Report_${filterStart}_to_${filterEnd}.csv`, headers, rows);
  };

  // 5. Exportar CSV de Planejamentos Afetados
  const handleExportAfetadosCsv = () => {
    if (!dashData?.afetados || dashData.afetados.length === 0) return;
    
    const headers = ['Dia', 'Equipe', 'Obra', 'Status', 'Valor Planejado', 'Materiais Faltantes'];
    const rows = dashData.afetados.map((p: any) => [
      p.dataString,
      p.equipe,
      p.obra,
      p.status,
      p.valorPlanejado || 0,
      p.faltas.map((f: any) => `${f.descricao} (Falta: ${f.faltaAlocada})`).join(' | ')
    ]);

    downloadCSV(`Affected_Plannings_${filterStart}_to_${filterEnd}.csv`, headers, rows);
  };

  // Handler para simular reprogramação
  const handleSimulate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reprogrammingProg) return;
    
    const missingItems = reprogrammingProg.faltas;
    const requiredAdd = missingItems.reduce((acc: number, curr: any) => acc + curr.faltaAlocada, 0);
    
    if (simulatedQty >= requiredAdd) {
      const dateFormatted = formatSafe(parse(simulatedDate, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy');
      setSimulationResult(`✅ Liberado! Entrada simulada de ${simulatedQty} unidades em ${dateFormatted} atende à necessidade desta programação.`);
    } else {
      setSimulationResult(`❌ Saldo insuficiente! Entrada de ${simulatedQty} unidades não cobre a falta acumulada. Necessário ao menos ${requiredAdd} unidades.`);
    }
  };

  // Agrupa os afetados por dia para exibição
  const afetadosAgrupados = useMemo(() => {
    if (!dashData?.afetados) return [];
    
    const map = new Map<string, any[]>();
    dashData.afetados.forEach((prog: any) => {
      const date = prog.dataString;
      if (!map.has(date)) map.set(date, []);
      map.get(date)!.push(prog);
    });
    
    return Array.from(map.entries()).sort((a, b) => {
      try {
        const parsedA = parse(a[0], 'dd/MM/yyyy', new Date());
        const parsedB = parse(b[0], 'dd/MM/yyyy', new Date());
        return parsedA.getTime() - parsedB.getTime();
      } catch {
        return a[0].localeCompare(b[0]);
      }
    });
  }, [dashData?.afetados]);

  // Primeiro dia afetado geral
  const primeiroDiaGeralText = useMemo(() => {
    if (!dashData?.faltas || dashData.faltas.length === 0) return 'Sem comprometimento';
    const dates = dashData.faltas
      .map((f: any) => f.primeiroDiaComprometido)
      .filter(Boolean)
      .map((d: any) => new Date(d));
    if (dates.length === 0) return 'Sem comprometimento';
    const minDate = new Date(Math.min(...dates.map((d: Date) => d.getTime())));
    return formatSafe(minDate, 'dd/MM');
  }, [dashData?.faltas]);

  // Estado vazio positivo
  const hasNoFaltas = !dashData?.faltas || dashData.faltas.length === 0;

  return (
    <div className="flex flex-col gap-6">
      
      {/* SEÇÃO A: Cartões Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* Card 1: Itens em falta */}
        <Card 
          onClick={handleOpenItensModal}
          className={`border-slate-200 shadow-sm relative overflow-hidden transition-all duration-300 cursor-pointer hover:shadow-md hover:scale-[1.01] hover:border-rose-700/50 ${!hasNoFaltas ? 'bg-rose-950 text-white border-rose-900' : 'bg-white dark:bg-zinc-950'}`}
        >
          <CardHeader className="pb-2">
            <CardDescription className={!hasNoFaltas ? 'text-rose-200 text-xs font-semibold' : 'text-slate-500 dark:text-slate-400 text-xs font-semibold'}>
              Itens em Falta
            </CardDescription>
            <CardTitle className="text-2xl font-black flex items-baseline gap-1 mt-1">
              {!hasNoFaltas ? (
                <>
                  <span className="text-3xl text-rose-300">{dashData?.faltas?.filter((f: any) => !f.estoqueDesconhecido).length}</span>
                  <span className="text-xs text-rose-200 font-medium">de {data?.consolidado?.length || 0} do romaneio</span>
                </>
              ) : (
                <>
                  <span className="text-3xl text-emerald-600">0</span>
                  <span className="text-xs text-muted-foreground font-medium">de {data?.consolidado?.length || 0} total</span>
                </>
              )}
            </CardTitle>
          </CardHeader>
          <div className={`absolute right-3 top-3 opacity-15 ${!hasNoFaltas ? 'text-rose-300' : 'text-slate-400'}`}>
            <ShieldAlert className="h-10 w-10" />
          </div>
          <div className="px-6 pb-2 text-[9px] opacity-75 font-medium flex items-center justify-between">
            <span>Clique para ver listagem</span>
            <span>ℹ️</span>
          </div>
        </Card>

        {/* Card 2: Exposição Financeira */}
        <Card 
          onClick={handleOpenAfetadosModal}
          className="bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 shadow-sm relative overflow-hidden transition-all duration-300 cursor-pointer hover:shadow-md hover:scale-[1.01] hover:border-violet-400"
        >
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-500 dark:text-slate-400 text-xs font-semibold">
              Exposição Financeira (Faltas)
            </CardDescription>
            <CardTitle className="text-3xl font-black text-slate-800 dark:text-slate-100 flex items-baseline gap-1 mt-1">
              <span>{formatCurrency(dashData?.valorPlanejadoAfetado || 0)}</span>
            </CardTitle>
          </CardHeader>
          <div className="absolute right-3 top-3 opacity-10 text-slate-400">
            <TrendingDown className="h-10 w-10" />
          </div>
          <div className="px-6 pb-2 text-[9px] text-slate-400 font-medium flex items-center justify-between">
            <span>Clique para ver listagem</span>
            <span>ℹ️</span>
          </div>
        </Card>

        {/* Card 3: Programações afetadas */}
        <Card 
          onClick={handleOpenAfetadosModal}
          className="bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 shadow-sm relative overflow-hidden transition-all duration-300 cursor-pointer hover:shadow-md hover:scale-[1.01] hover:border-amber-400"
        >
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-500 dark:text-slate-400 text-xs font-semibold">
              Programações Afetadas
            </CardDescription>
            <CardTitle className="text-2xl font-black flex items-baseline gap-1 mt-1">
              <span className={dashData?.afetadosCount > 0 ? 'text-amber-600 text-3xl' : 'text-slate-700 dark:text-slate-300 text-3xl'}>
                {dashData?.afetadosCount || 0}
              </span>
              <span className="text-xs text-slate-400 font-semibold">de {dashData?.totalProgramacoes || 0}</span>
            </CardTitle>
          </CardHeader>
          <div className="absolute right-3 top-3 opacity-10 text-slate-400">
            <Users className="h-10 w-10" />
          </div>
          <div className="px-6 pb-2 text-[9px] text-slate-400 font-medium flex items-center justify-between">
            <span>Clique para ver listagem</span>
            <span>ℹ️</span>
          </div>
        </Card>

        {/* Card 4: Primeiro dia comprometido */}
        <Card 
          onClick={handleOpenItensModal}
          className="bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 shadow-sm relative overflow-hidden transition-all duration-300 cursor-pointer hover:shadow-md hover:scale-[1.01] hover:border-slate-400"
        >
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-500 dark:text-slate-400 text-xs font-semibold">
              Primeiro Dia Comprometido
            </CardDescription>
            <CardTitle className={`text-3xl font-black mt-1 ${dashData?.faltas?.length > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600'}`}>
              {primeiroDiaGeralText}
            </CardTitle>
          </CardHeader>
          <div className="absolute right-3 top-3 opacity-10 text-slate-400">
            <Calendar className="h-10 w-10" />
          </div>
          <div className="px-6 pb-2 text-[9px] text-slate-400 font-medium flex items-center justify-between">
            <span>Clique para ver listagem</span>
            <span>ℹ️</span>
          </div>
        </Card>

        {/* Card 5: Sem visibilidade */}
        <Card 
          onClick={handleOpenSemOrcamentoModal}
          className="bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 shadow-sm relative overflow-hidden transition-all duration-300 cursor-pointer hover:shadow-md hover:scale-[1.01] hover:border-amber-500"
        >
          <CardHeader className="pb-2">
            <CardDescription className="text-slate-500 dark:text-slate-400 text-xs font-semibold">
              Sem Visibilidade (Ptos s/ Orç.)
            </CardDescription>
            <CardTitle className="text-3xl font-black text-slate-800 dark:text-slate-100 flex items-baseline gap-1 mt-1">
              <span className={data?.pontosSemOrcamento?.length > 0 ? 'text-amber-500' : ''}>
                {data?.pontosSemOrcamento?.length || 0}
              </span>
              <span className="text-xs font-bold text-slate-400">pontos</span>
            </CardTitle>
          </CardHeader>
          <div className="absolute right-3 top-3 opacity-10 text-slate-400">
            <AlertTriangle className="h-10 w-10 text-amber-500" />
          </div>
          <div className="px-6 pb-2 text-[9px] text-slate-400 font-medium flex items-center justify-between">
            <span>Clique para ver listagem</span>
            <span>ℹ️</span>
          </div>
        </Card>
      </div>

      {/* SEÇÃO B: Cobertura da Semana */}
      <Card className="border-slate-200 shadow-sm bg-white dark:bg-zinc-950">
        <CardHeader className="py-4 border-b">
          <CardTitle className="text-sm font-bold text-slate-700 dark:text-slate-300">
            Cobertura do Período
          </CardTitle>
          <CardDescription>
            % de programações 100% atendíveis com o estoque físico disponível hoje
          </CardDescription>
        </CardHeader>
        <CardContent className="py-6 flex flex-wrap gap-x-8 gap-y-4 justify-between items-center">
          {!dashData?.cobertura || dashData.cobertura.length === 0 ? (
            <div className="text-xs text-muted-foreground w-full text-center">Nenhum dado de cobertura para o período filtrado.</div>
          ) : (
            dashData.cobertura.map((cob: any) => {
              const dayLabel = cob.dateParsed && !isNaN(cob.dateParsed.getTime()) 
                ? formatSafe(cob.dateParsed, 'dd/MM') 
                : cob.dateString.split(' - ')[0];
              const barColor = cob.percent === 100 
                ? 'bg-emerald-500' 
                : cob.percent >= 80 
                ? 'bg-amber-500' 
                : 'bg-rose-500';
              const textColor = cob.percent === 100 
                ? 'text-emerald-600 font-bold' 
                : cob.percent >= 80 
                ? 'text-amber-600 font-bold' 
                : 'text-rose-600 font-bold';
                
              return (
                <div key={cob.dateString} className="flex flex-col items-center gap-1.5 min-w-[70px] flex-1">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{dayLabel}</span>
                  <div className="w-full bg-slate-100 dark:bg-zinc-800 rounded-full h-2 overflow-hidden shadow-inner">
                    <div className={`${barColor} h-full rounded-full transition-all duration-500`} style={{ width: `${cob.percent}%` }} />
                  </div>
                  <span className={`text-xs mt-0.5 ${textColor}`}>{cob.percent}%</span>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* SEÇÃO C: Tabela de Faltas */}
      <Card className="border-slate-200 shadow-sm bg-white dark:bg-zinc-950">
        <CardHeader className="py-4 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <CardTitle className="text-base font-bold text-slate-850 dark:text-slate-200">
              Materiais em falta — prioridade por urgência
            </CardTitle>
            <CardDescription className="mt-1">
              Ordenado cronologicamente pelo primeiro planejamento comprometido
            </CardDescription>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-semibold">Filtrar dia:</span>
              <select
                className="text-xs h-8 border rounded-md px-2 bg-white dark:bg-zinc-900 text-slate-700 dark:text-slate-300 outline-none shadow-sm"
                value={selectedDayFilter}
                onChange={e => setSelectedDayFilter(e.target.value)}
              >
                <option value="todos">Todos os dias</option>
                {availableDays.map((day: string) => {
                  try {
                    const parsed = parse(day, 'dd/MM/yyyy', new Date());
                    const label = parsed && !isNaN(parsed.getTime()) ? formatSafe(parsed, 'dd/MM') : day;
                    return <option key={day} value={day}>{label}</option>;
                  } catch {
                    return <option key={day} value={day}>{day}</option>;
                  }
                })}
              </select>
            </div>
            
            <Button 
              variant="outline" 
              size="xs" 
              onClick={handleExportFaltasCsv}
              className="text-xs h-8 flex items-center gap-1 bg-slate-50 text-slate-700 hover:bg-slate-100"
            >
              <Download className="h-3 w-3" />
              Exportar Faltas
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          {hasNoFaltas ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 gap-3 bg-emerald-50/10">
              <CheckCircle2 className="h-12 w-12 text-emerald-600" />
              <div className="text-center">
                <h4 className="font-bold text-emerald-800 dark:text-emerald-400">Estoque 100% Disponível!</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-md">O estoque atual cobre integralmente todas as programações cadastradas no período ({periodText}).</p>
              </div>
            </div>
          ) : filteredFaltas.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-xs">
              Nenhuma falta encontrada para o dia selecionado.
            </div>
          ) : (
            <div className="divide-y dark:divide-zinc-800 border-t-0">
              {filteredFaltas.map((f: any) => {
                const dayText = f.primeiroDiaComprometido ? formatSafe(f.primeiroDiaComprometido, 'dd/MM') : '';
                return (
                  <div key={f.codigo} className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:bg-slate-50/40 dark:hover:bg-zinc-900/10 transition-colors">
                    
                    <div className="flex flex-col gap-1.5 max-w-xl">
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        <span className="font-mono font-bold text-violet-600 dark:text-violet-400 text-xs">{f.codigo}</span>
                        <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm leading-tight">
                          {f.descricao}
                        </h4>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-2 mt-0.5">
                        {f.estoqueDesconhecido ? (
                          <Badge className="bg-amber-100 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-900 font-semibold text-[9px] py-0 px-1.5 leading-tight uppercase">
                            sem dado de estoque
                          </Badge>
                        ) : f.critico ? (
                          <Badge className="bg-rose-100 dark:bg-rose-950/20 text-rose-800 dark:text-rose-350 border-rose-200 dark:border-rose-900 font-semibold text-[9px] py-0 px-1.5 leading-tight uppercase">
                            bloqueia programação
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-50 dark:bg-amber-950/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900 font-semibold text-[9px] py-0 px-1.5 leading-tight uppercase">
                            falta parcial
                          </Badge>
                        )}
                        
                        {!f.estoqueDesconhecido && (
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            a partir de <strong className="text-slate-850 dark:text-slate-200">{dayText}</strong> · <strong>{f.programacoesCount}</strong> programações afetadas
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-6 w-full md:w-auto shrink-0 border-t md:border-0 pt-3 md:pt-0 dark:border-zinc-800">
                      
                      <div className="flex flex-col items-end shrink-0 w-20">
                        {f.estoqueDesconhecido ? (
                          <span className="font-mono font-bold text-amber-600 dark:text-amber-450 text-sm italic">Desconhecido</span>
                        ) : (
                          <>
                            <span className="font-black text-rose-600 dark:text-rose-455 text-xl leading-none">-{formatQtd(f.falta)}</span>
                            <span className="text-[9px] text-rose-500 dark:text-rose-400 font-bold uppercase mt-1 leading-none">falta</span>
                          </>
                        )}
                      </div>
                      
                      <div className="text-right text-xs shrink-0 text-slate-500 dark:text-slate-400 font-medium w-24">
                        {f.estoqueDesconhecido ? (
                          <span>{formatQtd(f.necessario)} nec. / ? estoque</span>
                        ) : (
                          <>
                            <div>{formatQtd(f.necessario)} nec.</div>
                            <div className="text-slate-700 dark:text-slate-350 font-bold mt-0.5">{formatQtd(f.estoque)} estoque</div>
                          </>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-1 w-[130px] shrink-0 justify-end">
                        {f.equipes.slice(0, 3).map((eq: string) => (
                          <Badge key={eq} variant="outline" className="text-[9px] py-0 px-1.5 bg-slate-50 dark:bg-zinc-900 text-slate-650 dark:text-slate-300 border-slate-200 dark:border-zinc-800 font-semibold">
                            {eq}
                          </Badge>
                        ))}
                        {f.equipes.length > 3 && (
                          <Badge variant="outline" className="text-[9px] py-0 px-1 bg-slate-50 dark:bg-zinc-900 text-slate-500 dark:text-slate-400 font-semibold border-slate-200 dark:border-zinc-800" title={f.equipes.slice(3).join(', ')}>
                            +{f.equipes.length - 3}
                          </Badge>
                        )}
                      </div>

                      <div className="w-[90px] shrink-0 flex justify-end">
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => setAnalyzingCode(f.codigo)}
                          className="text-xs h-8 font-semibold border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-slate-300 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-white"
                        >
                          Analisar ↗
                        </Button>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* SEÇÃO D: Planejamentos Afetados */}
      <Card className="border-slate-200 shadow-sm bg-white dark:bg-zinc-950">
        <CardHeader className="py-4 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <CardTitle className="text-base font-bold text-slate-800 dark:text-slate-200">
              Planejamentos afetados
            </CardTitle>
            <CardDescription className="mt-1">
              Equipes cujo planejamento de separação está impedido pela falta de material
            </CardDescription>
          </div>
          
          <Button 
            variant="outline" 
            size="xs" 
            onClick={handleExportAfetadosCsv}
            className="text-xs h-8 flex items-center gap-1 bg-slate-50 text-slate-700 hover:bg-slate-100"
          >
            <Download className="h-3 w-3" />
            Exportar Afetados
          </Button>
        </CardHeader>
        
        <CardContent className="p-0">
          {!dashData?.afetados || dashData.afetados.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-xs">
              Nenhuma programação impedida ou em falta no período.
            </div>
          ) : (
            <div className="p-4 flex flex-col gap-6">
              {afetadosAgrupados.map(([day, progs]) => {
                try {
                  const parsed = parse(day, 'dd/MM/yyyy', new Date());
                  const formattedDay = parsed && !isNaN(parsed.getTime()) ? formatSafe(parsed, "dd 'de' MMMM", { locale: ptBR }) : day;
                  
                  return (
                    <div key={day} className="flex flex-col gap-3">
                      <h4 className="font-extrabold text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b pb-1">
                        {formattedDay}
                      </h4>
                      
                      <div className="flex flex-col gap-2">
                        {progs.map((prog: any) => (
                          <div key={prog.id} className="p-3 border rounded-lg bg-slate-50/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            
                            <div className="flex flex-wrap items-center gap-3">
                              <Badge className="bg-indigo-600 text-white font-black text-[10px] py-0 px-2 h-5 flex items-center justify-center">
                                {prog.equipe}
                              </Badge>
                              <span className="font-bold text-xs text-slate-800 dark:text-slate-200 shrink-0">
                                {prog.obra}
                              </span>
                              
                              <span className="text-[11px] text-slate-550 max-w-md line-clamp-1">
                                {prog.faltas.map((f: any) => `${f.descricao} (-${f.faltaAlocada})`).join(', ')}
                              </span>
                            </div>
                            
                            <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                              {prog.status === 'BLOQUEADO' ? (
                                <Badge className="bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/20 dark:text-rose-300 font-bold text-[10px] py-0 px-2 h-5 leading-tight uppercase">
                                  bloqueado
                                </Badge>
                              ) : (
                                <Badge className="bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/20 dark:text-amber-300 font-bold text-[10px] py-0 px-2 h-5 leading-tight uppercase">
                                  parcial
                                </Badge>
                              )}
                              
                              <Button
                                variant="outline"
                                size="xs"
                                onClick={() => {
                                  setReprogrammingProg(prog);
                                  setSimulationResult(null);
                                  setSimulatedQty(0);
                                }}
                                className="text-[10px] h-7 font-bold border-slate-200 text-slate-700 bg-white hover:bg-slate-100 hover:text-slate-900 shrink-0"
                              >
                                Reprogramar ↗
                              </Button>
                            </div>
                            
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                } catch {
                  return null;
                }
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ==================== MODAL DE ANÁLISE CRONOLÓGICA (ANALISAR) ==================== */}
      {analyzingCode && activeAnalysis && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl border-slate-200 bg-white dark:bg-zinc-950">
            <CardHeader className="bg-slate-50 dark:bg-zinc-900 border-b pb-4 flex flex-row justify-between items-start">
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="font-mono text-xs">{activeAnalysis.codigo}</Badge>
                  <CardTitle className="text-base font-bold text-slate-800 dark:text-slate-100">{activeAnalysis.descricao}</CardTitle>
                </div>
                <CardDescription className="mt-1">
                  Distribuição cronológica do estoque físico por data de programação
                </CardDescription>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setAnalyzingCode(null)}
                className="h-8 w-8 p-0 rounded-full hover:bg-slate-200/50"
              >
                ✕
              </Button>
            </CardHeader>
            
            <CardContent className="p-4 overflow-y-auto flex-1">
              
              <div className="mb-4 bg-violet-50/50 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900 p-3 rounded-lg text-xs flex flex-wrap justify-between items-center gap-3">
                <div className="text-slate-700 dark:text-slate-350">
                  Estoque Físico Inicial: <strong className="text-violet-700 dark:text-violet-400">{activeAnalysis.estoqueDesconhecido ? 'Desconhecido' : formatQtd(activeAnalysis.estoque)}</strong>
                </div>
                <div className="text-slate-700 dark:text-slate-350">
                  Falta Acumulada no Período: <strong className="text-rose-600 dark:text-rose-400">-{formatQtd(activeAnalysis.falta)}</strong>
                </div>
                <div className="text-slate-700 dark:text-slate-350">
                  Total Solicitado: <strong className="text-slate-900 dark:text-white">{formatQtd(activeAnalysis.necessario)}</strong>
                </div>
              </div>

              <div className="border rounded-lg overflow-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-50 dark:bg-zinc-900 font-bold border-b text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Data</th>
                      <th className="px-4 py-3">Equipe</th>
                      <th className="px-4 py-3">Obra</th>
                      <th className="px-4 py-3 text-right">Qtd Necessária</th>
                      <th className="px-4 py-3 text-right">Estoque Antes</th>
                      <th className="px-4 py-3 text-right">Estoque Depois</th>
                      <th className="px-4 py-3 text-right">Falta Alocada</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {activeAnalysis.tracking.map((t: any, idx: number) => {
                      const hasLacking = t.faltaAlocada > 0;
                      return (
                        <tr key={idx} className={`hover:bg-slate-50/30 ${hasLacking ? 'bg-rose-50/10' : ''}`}>
                          <td className="px-4 py-2.5 font-semibold text-slate-700 dark:text-slate-300">{t.dataString}</td>
                          <td className="px-4 py-2.5">
                            <Badge variant="outline" className="font-bold text-[9px]">{t.equipe}</Badge>
                          </td>
                          <td className="px-4 py-2.5 font-bold text-slate-600 dark:text-slate-400">{t.obra}</td>
                          <td className="px-4 py-2.5 text-right font-semibold text-slate-700 dark:text-slate-300">{formatQtd(t.quantidade)}</td>
                          <td className="px-4 py-2.5 text-right text-slate-500">
                            {t.estoqueAntes === null ? '?' : formatQtd(t.estoqueAntes)}
                          </td>
                          <td className="px-4 py-2.5 text-right text-slate-500">
                            {t.estoqueDepois === null ? '?' : formatQtd(t.estoqueDepois)}
                          </td>
                          <td className={`px-4 py-2.5 text-right font-black ${hasLacking ? 'text-rose-600 bg-rose-50/20' : 'text-slate-400'}`}>
                            {hasLacking ? `-${formatQtd(t.faltaAlocada)}` : '0'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
            
            <div className="bg-slate-50 dark:bg-zinc-900 border-t p-3 flex justify-end gap-2 shrink-0">
              <Button size="xs" variant="secondary" onClick={() => setAnalyzingCode(null)} className="h-8 text-xs font-semibold px-4">
                Fechar
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ==================== MODAL DE SIMULAÇÃO (REPROGRAMAR) ==================== */}
      {reprogrammingProg && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-lg shadow-2xl border-slate-200 bg-white dark:bg-zinc-950">
            <CardHeader className="bg-slate-50 dark:bg-zinc-900 border-b pb-4 flex flex-row justify-between items-start">
              <div>
                <CardTitle className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <Badge className="bg-indigo-600 text-white font-black text-xs">{reprogrammingProg.equipe}</Badge>
                  Simulador de Reprogramação
                </CardTitle>
                <CardDescription className="mt-1">
                  Obra: <span className="font-semibold text-slate-850 dark:text-slate-300">{reprogrammingProg.obra}</span> · Dia original: <span className="font-semibold text-slate-850 dark:text-slate-350">{reprogrammingProg.dataString}</span>
                </CardDescription>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setReprogrammingProg(null)}
                className="h-8 w-8 p-0 rounded-full hover:bg-slate-200/50"
              >
                ✕
              </Button>
            </CardHeader>
            
            <CardContent className="p-5 flex flex-col gap-4">
              
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Materiais Faltantes</h4>
                <div className="flex flex-col gap-1.5 border rounded-lg p-2.5 bg-slate-50/20">
                  {reprogrammingProg.faltas.map((f: any) => (
                    <div key={f.codigo} className="flex justify-between items-center text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-violet-600 font-semibold">{f.codigo}</span>
                        <span className="text-slate-700 dark:text-slate-350 leading-none">{f.descricao}</span>
                      </div>
                      <span className="font-bold text-rose-600 dark:text-rose-400 shrink-0">Falta: {formatQtd(f.faltaAlocada)} de {formatQtd(f.quantidade)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-100/50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-3.5 rounded-lg flex flex-col gap-1.5">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Previsão de Atendimento</span>
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-750">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>Sem previsão de reposição cadastrada no almoxarifado</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-normal mt-0.5">
                  Não há entrada futura de estoque agendada para Barreiras no sistema para cobrir este déficit.
                </p>
              </div>

              <form onSubmit={handleSimulate} className="border border-indigo-100 p-4 rounded-lg bg-indigo-50/10 flex flex-col gap-3">
                <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Simular Entrada de Estoque</span>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-slate-500 font-bold uppercase">Qtd Recebida</label>
                    <input
                      type="number"
                      required
                      min={1}
                      className="border rounded-md px-2 py-1.5 text-xs bg-white dark:bg-zinc-900 text-slate-800 dark:text-slate-200 outline-none shadow-sm"
                      value={simulatedQty || ''}
                      onChange={e => setSimulatedQty(Number(e.target.value))}
                    />
                  </div>
                  
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-slate-500 font-bold uppercase">Data de Entrada</label>
                    <input
                      type="date"
                      required
                      className="border rounded-md px-2 py-1.5 text-xs bg-white dark:bg-zinc-900 text-slate-800 dark:text-slate-200 outline-none shadow-sm"
                      value={simulatedDate}
                      onChange={e => setSimulatedDate(e.target.value)}
                    />
                  </div>
                </div>

                <Button type="submit" size="xs" className="w-full text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 mt-1">
                  Simular Liberação
                </Button>
              </form>

              {simulationResult && (
                <div className="p-3 border rounded-lg bg-slate-50 dark:bg-zinc-900 text-xs font-bold border-indigo-200">
                  {simulationResult}
                </div>
              )}

            </CardContent>
            
            <div className="bg-slate-50 dark:bg-zinc-900 border-t p-3 flex justify-end gap-2">
              <Button size="xs" variant="secondary" onClick={() => setReprogrammingProg(null)} className="h-8 text-xs font-semibold px-4">
                Fechar
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Modal de Detalhes de Faltas (KPIs) */}
      <Dialog open={kpiModal.isOpen} onOpenChange={(open) => {
        if (!open) {
          setKpiModal(prev => ({ ...prev, isOpen: false }));
          setModalSearch('');
        }
      }}>
        <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col p-6 overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-violet-950 dark:text-violet-200">
              <ClipboardList className="h-5 w-5 text-violet-600" />
              {kpiModal.title}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              {kpiModal.description}
            </DialogDescription>
          </DialogHeader>

          {/* Filtro de Busca e Botão Exportar */}
          <div className="flex justify-between items-center gap-4 my-2 no-print">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Pesquisar nesta listagem..."
                value={modalSearch}
                onChange={e => setModalSearch(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                downloadCSV(
                  `${kpiModal.title.replace(/\s+/g, '_')}_Export.csv`,
                  kpiModal.headers,
                  kpiModal.rows
                );
              }}
              className="h-9 text-xs flex items-center gap-1.5"
            >
              <Download className="h-4 w-4" />
              Exportar Base
            </Button>
          </div>

          {/* Tabela de Dados */}
          <div className="flex-1 overflow-auto border rounded-lg shadow-inner bg-slate-50/50">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-100 text-slate-700 font-bold uppercase sticky top-0 z-10 border-b">
                <tr>
                  {kpiModal.headers.map((h, i) => (
                    <th key={i} className="px-4 py-2.5 text-slate-800">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y bg-white">
                {filteredModalRows.length === 0 ? (
                  <tr>
                    <td colSpan={kpiModal.headers.length} className="px-4 py-8 text-center text-muted-foreground">
                      Nenhum registro encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredModalRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      {row.map((cell, i) => (
                        <td key={i} className="px-4 py-2 text-slate-700 whitespace-nowrap overflow-hidden max-w-xs truncate" title={String(cell)}>
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end mt-4">
            <Button size="sm" onClick={() => {
              setKpiModal(prev => ({ ...prev, isOpen: false }));
              setModalSearch('');
            }}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
};
