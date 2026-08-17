import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AiPlanEditor } from './AiPlanEditor';
import { PlanResponse } from '@/hooks/usePcpAiPlanner';
import {
  Bot, Send, Loader2, RefreshCw, Building2, AlertTriangle, ShieldAlert,
  MapPin, Clock, Target, Zap, ChevronDown, Users, Layers, TrendingUp, Home,
  ZoomIn, ZoomOut, Trash2, FileSpreadsheet, CheckCircle2, Filter, Search,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { useSessionState } from '@/hooks/useSessionState';
import { usePcpPlanejamentoData, UNIDADES_DISPONIVEIS } from '@/hooks/usePcpPlanejamentoData';
import { useAlojamentos } from '@/hooks/useAlojamentos';
import { usePcpAiPlanner, useVistoriaRisk, PlanoEquipe } from '@/hooks/usePcpAiPlanner';
import type { PlanResponse as _PlanResponse } from '@/hooks/usePcpAiPlanner';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

// ─── Constantes ───────────────────────────────────────────────────────────────
const DEFAULT_SELECTED_STATUSES = [
  'PROGRAMADA',
  'EM EXECUÇÃO',
  'AGENDADA',
  'LIBERADA',
  'PROGRAMADA/PARCIAL',
  'EM ESPERA',
  'REPROGRAMAR',
  'VISTORIADA',
  'PENDÊNCIA CLIENTE',
  'PENDÊNCIA TÉCNICA',
  'SEM MATERIAL',
  'PROJETO / ORÇAMENTO',
  'PENDENCIA SUPRIMENTOS',
];

const RISK_STYLE: Record<string, string> = {
  red:    'bg-red-500/15 text-red-600 border-red-500/30',
  yellow: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
  orange: 'bg-orange-500/15 text-orange-600 border-orange-500/30',
  gray:   'bg-muted text-muted-foreground border-border',
  purple: 'bg-purple-500/15 text-purple-600 border-purple-500/30',
};
const RISK_ICON: Record<string, string> = {
  red: '🔴', yellow: '🟡', orange: '🟠', gray: '⚫', purple: '🟣',
};

// ─── Tabela Semanal ───────────────────────────────────────────────────────────
const TabelaSemanal = ({ plano, onExportar }: { plano: PlanoEquipe; onExportar: (p: PlanoEquipe) => void }) => (
  <div className="rounded-xl border border-border overflow-hidden text-xs">
    <div className="bg-muted/60 px-4 py-2 flex items-center justify-between border-b border-border">
      <div className="flex items-center gap-2 font-bold text-sm text-foreground">
        <Users className="w-4 h-4 text-primary" />
        {plano.equipe}
        <span className="text-muted-foreground font-normal">— {plano.obra} — {plano.semana}</span>
      </div>
      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => onExportar(plano)}>
        <FileSpreadsheet className="w-3.5 h-3.5" /> Exportar Plan_Principal
      </Button>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-muted/30">
            <th className="text-left px-3 py-2 font-semibold text-muted-foreground w-32">Dia</th>
            <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Pontos</th>
            <th className="text-right px-3 py-2 font-semibold text-muted-foreground w-24">Tempo</th>
            <th className="text-right px-3 py-2 font-semibold text-muted-foreground w-28">Valor</th>
            <th className="text-right px-3 py-2 font-semibold text-muted-foreground w-16">Meta</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {(plano.dias ?? []).map((dia, i) => (
            <tr key={i} className="hover:bg-accent/20 transition-colors">
              <td className="px-3 py-2.5">
                <div className="font-semibold text-foreground">{dia.diaSemana?.split('-')[0]?.trim() ?? dia.diaSemana}</div>
                <div className="text-muted-foreground font-mono text-[10px]">{dia.data}</div>
              </td>
              <td className="px-3 py-2.5">
                <div className="flex flex-wrap gap-1">
                  {dia.pontos.map(p => (
                    <Badge key={p} variant="secondary" className="font-mono text-[10px] px-1.5 py-0">{p}</Badge>
                  ))}
                </div>
                {dia.observacao && <p className="text-[10px] text-muted-foreground mt-0.5 italic">{dia.observacao}</p>}
              </td>
              <td className="px-3 py-2.5 text-right font-mono font-semibold">{dia.tempoTotalFormatado}</td>
              <td className="px-3 py-2.5 text-right font-mono">
                R$ {dia.valorEstimado?.toLocaleString('pt-BR', { minimumFractionDigits: 0 }) ?? '—'}
              </td>
              <td className="px-3 py-2.5 text-right">
                <Badge className={`font-mono text-[10px] px-1.5 py-0 ${dia.percentualMeta >= 100 ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' : 'bg-amber-500/15 text-amber-600 border-amber-500/30'}`}>
                  {dia.percentualMeta?.toFixed(0)}%
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-primary/5 border-t border-primary/20 font-bold">
            <td className="px-3 py-2 text-primary text-xs">TOTAL SEMANA</td>
            <td className="px-3 py-2 text-xs text-muted-foreground">{plano.totalSemana?.pontos ?? '—'} pontos</td>
            <td className="px-3 py-2 text-right font-mono text-xs">{plano.totalSemana?.tempoFormatado}</td>
            <td className="px-3 py-2 text-right font-mono text-xs">
              R$ {plano.totalSemana?.valorTotal?.toLocaleString('pt-BR', { minimumFractionDigits: 0 }) ?? '—'}
            </td>
            <td className="px-3 py-2 text-right text-xs">
              <Badge className="bg-primary/15 text-primary border-primary/30 font-mono text-[10px]">
                ⌀ {plano.totalSemana?.mediaPercentualMeta?.toFixed(0)}%
              </Badge>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  </div>
);

// ─── Main View ────────────────────────────────────────────────────────────────
export const PcpPlanejAutoView = () => {
  // ── Filtros (persistentes) ────────────────────────────────────────────────
  const [selectedUnidadeId, setSelectedUnidadeId] = useSessionState('pcp_auto_unidade', '1rj2V7CxbZwkan63eCeLkH9G00Gi041IZNC6vwEgq6yI');
  const [selectedSituacao, setSelectedSituacao] = useSessionState('pcp_auto_situacao', 'APTA');
  const [selectedStatuses, setSelectedStatuses] = useSessionState<string[]>('pcp_auto_statuses', DEFAULT_SELECTED_STATUSES);
  const [isStatusPopoverOpen, setIsStatusPopoverOpen] = useState(false);
  const [selectedMesFilter, setSelectedMesFilter] = useSessionState('pcp_auto_mes', 'TODOS');
  const [selectedMunicipioFilter, setSelectedMunicipioFilter] = useSessionState('pcp_auto_municipio', 'TODOS');
  const [selectedPrioridadeFilter, setSelectedPrioridadeFilter] = useSessionState('pcp_auto_prioridade', 'TODAS');
  const [searchObra, setSearchObra] = useSessionState('pcp_auto_search', '');
  const [selectedObraId, setSelectedObraId] = useSessionState('pcp_auto_obra', '');

  // ── Parâmetros IA ─────────────────────────────────────────────────────────
  const [jornadaHoras, setJornadaHoras] = useState(9);
  const [metaPercent, setMetaPercent] = useState(110);
  const [pontoSaida, setPontoSaida] = useState('base');
  const [equipesSelecionadas, setEquipesSelecionadas] = useState<string[]>([]);

  // ── Zoom ──────────────────────────────────────────────────────────────────
  const [zoomLevel, setZoomLevel] = useSessionState<number>('zoom_pcp_auto', 1);

  // ── AI Plans — resultado da IA para renderizar editável ────────────────────
  const [aiPlans, setAiPlans] = useState<PlanResponse | null>(null);

  // ── Chat ──────────────────────────────────────────────────────────────────
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ── Dados ─────────────────────────────────────────────────────────────────
  const {
    rawCacheQuery, obras, equipesDisponiveis, supervisoresDisponiveis, etapasDisponiveis,
    mesesCarteira, statusesCarteira, orcamentoPorPontoMap, pontosDisponiveisDoProjeto,
    salvarProgramacao,
  } = usePcpPlanejamentoData(selectedUnidadeId, selectedObraId || undefined);

  // ── Auto-selecionar status dinâmicos (menos os concluídos) ────────────────
  useEffect(() => {
    if (statusesCarteira.length > 0) {
      // Se a sessão ainda tiver apenas os defaults, sobrescrevemos com todos da carteira exceto concluídos
      const isStillDefault = selectedStatuses.length === DEFAULT_SELECTED_STATUSES.length &&
        selectedStatuses.every(s => DEFAULT_SELECTED_STATUSES.includes(s));
      if (isStillDefault) {
        setSelectedStatuses(statusesCarteira.filter(s => !s.toUpperCase().includes('CONCLU')));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusesCarteira]);

  const { alojamentos } = useAlojamentos();
  const { messages, sendMessage, isLoading, clearMessages } = usePcpAiPlanner();
  const { analyzeRisk, riskCache, loadingRisk } = useVistoriaRisk(selectedObraId || null);

  // Atividades da obra selecionada
  const atividadesQuery = useQuery({
    queryKey: ['atividades_plano', selectedUnidadeId, selectedObraId],
    queryFn: async () => {
      if (!selectedObraId) return [];
      const { data } = await supabase
        .from('atividades_por_ponto' as any)
        .select('obra_id, ponto_id, atividade, quantidade, tempo_minutos, valor_estimado')
        .eq('obra_id', selectedObraId)
        .limit(2000);
      return (data ?? []) as any[];
    },
    enabled: !!selectedObraId,
    staleTime: 5 * 60 * 1000,
  });

  // ── Filtros derivados ─────────────────────────────────────────────────────
  const filteredObras = useMemo(() => {
    return obras.filter(o => {
      const matchSituacao = selectedSituacao === 'TODAS' ||
        (selectedSituacao === 'APTA' && !(o as any).inapta) ||
        (selectedSituacao === 'INAPTA' && (o as any).inapta);
      const matchStatus = selectedStatuses.length === 0 || selectedStatuses.includes(o.statusExecucao ?? '');
      const matchMes = selectedMesFilter === 'TODOS' ||
        (o as any).meses?.some((m: string) => m.trim().toLowerCase() === selectedMesFilter.trim().toLowerCase());
      const matchMun = selectedMunicipioFilter === 'TODOS' ||
        o.municipio?.toUpperCase() === selectedMunicipioFilter.toUpperCase();
      const matchPrio = selectedPrioridadeFilter === 'TODAS' ||
        (o as any).prioridade === selectedPrioridadeFilter;
      const matchSearch = !searchObra ||
        o.projeto?.toLowerCase().includes(searchObra.toLowerCase()) ||
        o.nomeProjeto?.toLowerCase().includes(searchObra.toLowerCase()) ||
        o.municipio?.toLowerCase().includes(searchObra.toLowerCase());
      return matchSituacao && matchStatus && matchMes && matchMun && matchPrio && matchSearch;
    });
  }, [obras, selectedSituacao, selectedStatuses, selectedMesFilter, selectedMunicipioFilter, selectedPrioridadeFilter, searchObra]);

  const obraAtual = useMemo(() => obras.find(o => o.projeto === selectedObraId), [obras, selectedObraId]);

  const municipiosFiltrados = useMemo(() => [...new Set(
    obras.filter(o => selectedMesFilter === 'TODOS' ||
      (o as any).meses?.some((m: string) => m.trim().toLowerCase() === selectedMesFilter.trim().toLowerCase()))
      .map(o => o.municipio).filter(Boolean)
  )].sort(), [obras, selectedMesFilter]);

  const prioridadesFiltradas = useMemo(() => [...new Set(
    obras.filter(o => {
      const mm = selectedMesFilter === 'TODOS' || (o as any).meses?.some((m: string) => m.trim().toLowerCase() === selectedMesFilter.trim().toLowerCase());
      const mu = selectedMunicipioFilter === 'TODOS' || o.municipio?.toUpperCase() === selectedMunicipioFilter.toUpperCase();
      return mm && mu;
    }).map(o => (o as any).prioridade).filter(Boolean)
  )].sort(), [obras, selectedMesFilter, selectedMunicipioFilter]);

  const alojamentosUnidade = useMemo(() => {
    const u = UNIDADES_DISPONIVEIS.find(u => u.id === selectedUnidadeId);
    return alojamentos.filter(a => !a.unidadeId || a.unidadeId === selectedUnidadeId || a.unidadeNome === u?.name);
  }, [alojamentos, selectedUnidadeId]);

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (selectedObraId) analyzeRisk(selectedObraId);
  }, [selectedObraId]);

  // Reset obra ao mudar unidade
  useEffect(() => {
    setSelectedObraId('');
    setSelectedMesFilter('TODOS');
    setSelectedMunicipioFilter('TODOS');
    setSelectedPrioridadeFilter('TODAS');
  }, [selectedUnidadeId]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const toggleEquipe = (eq: string) =>
    setEquipesSelecionadas(prev => prev.includes(eq) ? prev.filter(e => e !== eq) : [...prev, eq]);

  const handleToggleStatus = (st: string) =>
    setSelectedStatuses(prev => prev.includes(st) ? prev.filter(s => s !== st) : [...prev, st]);

  const buildContext = useCallback(() => {
    const orcamentoDetalhado = selectedObraId ? Object.fromEntries(
      Array.from(orcamentoPorPontoMap.entries()).map(([ponto, ativs]) => [
        ponto,
        ativs.map(a => ({ servico: a.servico, qtd: a.qtdOrcada, tempo_min: a.tempoEstimadoMinutos, valor: a.valorEstimado }))
      ])
    ) : undefined;

    return {
      obras: filteredObras.slice(0, 15).map(o => ({
        projeto: o.projeto,
        nomeProjeto: o.nomeProjeto,
        municipio: o.municipio,
        pontosDisponiveis: o.projeto === selectedObraId ? pontosDisponiveisDoProjeto : [],
      })),
      equipes: equipesSelecionadas.length > 0 ? equipesSelecionadas : equipesDisponiveis.slice(0, 3),
      alojamentos: alojamentosUnidade.map(a => ({ nome: a.nome, latitude: a.latitude, longitude: a.longitude, unidadeNome: a.unidadeNome })),
      atividades: atividadesQuery.data ?? [],
      orcamentoDetalhado,
      parametros: { jornadaHoras, metaPercent, pontoSaida },
    };
  }, [filteredObras, equipesSelecionadas, equipesDisponiveis, alojamentosUnidade, atividadesQuery.data, orcamentoPorPontoMap, pontosDisponiveisDoProjeto, selectedObraId, jornadaHoras, metaPercent, pontoSaida]);

  const handleSend = async () => {
    if (!chatInput.trim() || isLoading) return;
    const prompt = chatInput.trim();
    setChatInput('');
    const planData = await sendMessage(prompt, buildContext());
    if (planData && planData.planejamento?.length > 0) {
      setAiPlans(planData);
      // Scroll para o editor logo abaixo
      setTimeout(() => {
        document.getElementById('ai-plan-editor-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    }
  };

  const handleExportar = (plano: PlanoEquipe) => {
    const linhas = plano.dias.map(dia =>
      `${dia.data} | ${plano.equipe} | ${plano.obra} | ${dia.pontos.join(' → ')} | ${dia.tempoTotalFormatado} | R$ ${dia.valorEstimado?.toLocaleString('pt-BR')} | ${dia.percentualMeta?.toFixed(0)}%`
    ).join('\n');
    const blob = new Blob([linhas], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Planejamento_${plano.equipe}_${plano.obra}_${plano.semana?.replace(/\//g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const risksForObra = selectedObraId ? (riskCache[selectedObraId] ?? []) : [];

  const SUGESTOES = [
    selectedObraId
      ? `monte um planejamento para as equipes selecionadas na obra ${selectedObraId} para a semana atual`
      : 'selecione uma obra acima e peça: "monte um planejamento para esta semana"',
    'qual a melhor ordem de pontos para minimizar deslocamento?',
    'divida os pontos entre 2 equipes para a próxima semana',
  ];

  return (
    <div
      className="flex flex-col gap-6 p-6 w-full max-w-[1600px] mx-auto min-h-screen bg-background"
      style={{ zoom: zoomLevel } as React.CSSProperties}
    >
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-card border border-border shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-violet-500/10 text-violet-600">
            <Bot className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-foreground">Planejamento Automático com IA</h1>
              <Badge variant="outline" className="bg-violet-500/10 text-violet-600 border-violet-500/20 font-semibold">
                Gemini 2.5 Flash
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Planejamento semanal inteligente — análise de riscos, otimização de rotas e programação automática
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 border border-border rounded-lg px-2 py-1">
            <button onClick={() => setZoomLevel(z => Math.max(0.5, z - 0.1))} className="text-muted-foreground hover:text-foreground">
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-bold text-muted-foreground w-9 text-center tabular-nums font-mono">
              {(zoomLevel * 100).toFixed(0)}%
            </span>
            <button onClick={() => setZoomLevel(z => Math.min(2.0, z + 0.1))} className="text-muted-foreground hover:text-foreground">
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
          <Button variant="ghost" size="icon" onClick={() => rawCacheQuery.refetch()} disabled={rawCacheQuery.isFetching}>
            <RefreshCw className={`w-4 h-4 ${rawCacheQuery.isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* ── BARRA DE FILTROS (idêntica ao Planejamento) ── */}
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
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNIDADES_DISPONIVEIS.map(u => (
                    <SelectItem key={u.id} value={u.id} className="text-xs">{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Situação */}
            <div className="flex flex-col gap-1 min-w-[110px]">
              <span className="text-[10px] text-muted-foreground font-semibold">Situação</span>
              <Select value={selectedSituacao} onValueChange={setSelectedSituacao}>
                <SelectTrigger className="h-8 text-xs font-semibold bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="APTA" className="text-xs font-medium text-emerald-600">Aptas</SelectItem>
                  <SelectItem value="INAPTA" className="text-xs font-medium text-rose-600">Inaptas</SelectItem>
                  <SelectItem value="TODAS" className="text-xs font-medium">Todas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Status multi-select */}
            <div className="flex flex-col gap-1 min-w-[140px]">
              <span className="text-[10px] text-muted-foreground font-semibold">Status ({selectedStatuses.length})</span>
              <Popover open={isStatusPopoverOpen} onOpenChange={setIsStatusPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-8 text-xs justify-between px-2.5 font-semibold bg-background">
                    <span className="truncate">
                      {selectedStatuses.length === statusesCarteira.length && statusesCarteira.length > 0
                        ? 'Todos Status' : `${selectedStatuses.length} selecionados`}
                    </span>
                    <ChevronDown className="w-3 h-3 opacity-50 shrink-0 ml-1" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[230px] p-3 text-xs" align="start">
                  <div className="flex items-center justify-between pb-2 border-b border-border mb-2 font-bold text-xs">
                    <span>Status das Obras</span>
                    <button onClick={() => setSelectedStatuses(statusesCarteira.filter(s => !s.toUpperCase().includes('CONCLU')))} className="text-[10px] text-primary hover:underline">
                      Sem Concluídas
                    </button>
                  </div>
                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {(statusesCarteira.length > 0 ? statusesCarteira : DEFAULT_SELECTED_STATUSES).map(st => (
                      <div key={st} onClick={() => handleToggleStatus(st)}
                        className="flex items-center gap-2 cursor-pointer hover:bg-accent/40 p-1 rounded">
                        <Checkbox checked={selectedStatuses.includes(st)} />
                        <span className="text-xs font-medium text-foreground">{st}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-border mt-2">
                    <button onClick={() => setSelectedStatuses([...statusesCarteira])} className="text-[10px] text-muted-foreground hover:underline">
                      Marcar Todas
                    </button>
                    <span className="text-[10px] text-muted-foreground">{selectedStatuses.length} de {statusesCarteira.length}</span>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Mês */}
            <div className="flex flex-col gap-1 min-w-[150px]">
              <span className="text-[10px] text-muted-foreground font-semibold">Mês da Carteira</span>
              <Select value={selectedMesFilter} onValueChange={v => { setSelectedMesFilter(v); setSelectedMunicipioFilter('TODOS'); setSelectedPrioridadeFilter('TODAS'); }}>
                <SelectTrigger className="h-8 text-xs font-semibold bg-background truncate font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-[240px]">
                  <SelectItem value="TODOS" className="text-xs font-semibold">Todos os Meses ({obras.length})</SelectItem>
                  {mesesCarteira.map(m => (
                    <SelectItem key={m} value={m} className="text-xs font-mono">{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Município */}
            <div className="flex flex-col gap-1 min-w-[150px]">
              <span className="text-[10px] text-muted-foreground font-semibold">Município</span>
              <Select value={selectedMunicipioFilter} onValueChange={setSelectedMunicipioFilter}>
                <SelectTrigger className="h-8 text-xs font-semibold bg-background truncate">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-[240px]">
                  <SelectItem value="TODOS" className="text-xs font-semibold">Todos Municípios</SelectItem>
                  {municipiosFiltrados.map(m => (
                    <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Prioridade */}
            <div className="flex flex-col gap-1 min-w-[150px]">
              <span className="text-[10px] text-muted-foreground font-semibold">Prioridade / Dono</span>
              <Select value={selectedPrioridadeFilter} onValueChange={setSelectedPrioridadeFilter}>
                <SelectTrigger className="h-8 text-xs font-semibold bg-background truncate">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-[240px]">
                  <SelectItem value="TODAS" className="text-xs font-semibold">Todas Prioridades</SelectItem>
                  {prioridadesFiltradas.map(p => (
                    <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Busca */}
            <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
              <span className="text-[10px] text-muted-foreground font-semibold">Pesquisar Obra</span>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar projeto B-XXXXX..."
                  value={searchObra}
                  onChange={e => setSearchObra(e.target.value)}
                  className="pl-8 h-8 text-xs bg-background"
                />
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* ── Grid Principal ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* ── Coluna Esquerda: Lista de Obras + Parâmetros ── */}
        <div className="lg:col-span-4 flex flex-col gap-4">

          {/* Lista de Obras filtradas */}
          <Card className="border border-border flex flex-col">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                Carteira de Obras ({filteredObras.length})
                {selectedObraId && (
                  <Badge variant="secondary" className="font-mono text-[10px] ml-auto">{selectedObraId}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-y-auto space-y-1.5 px-3 pb-3 max-h-[280px]
                [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full">
                {rawCacheQuery.isLoading ? (
                  <div className="flex items-center justify-center py-8 text-muted-foreground text-xs gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
                  </div>
                ) : filteredObras.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-xs">
                    Nenhuma obra encontrada.
                  </div>
                ) : filteredObras.map(o => {
                  const isSelected = o.projeto === selectedObraId;
                  return (
                    <div
                      key={o.projeto}
                      onClick={() => setSelectedObraId(o.projeto)}
                      className={`cursor-pointer rounded-lg px-3 py-2 transition-all border text-xs ${
                        isSelected
                          ? 'bg-primary/10 border-primary/30 text-primary'
                          : 'bg-card border-border/60 hover:bg-accent/40 text-foreground'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-bold text-[11px]">{o.projeto}</span>
                        <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0">{o.statusExecucao}</Badge>
                      </div>
                      <div className="text-muted-foreground text-[10px] mt-0.5 truncate">{o.municipio}</div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Info da Obra + Riscos */}
          {selectedObraId && (
            <Card className="border border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-primary" />
                  Análise de Risco — Vistoria
                  {loadingRisk && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground ml-auto" />}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <div>
                  <p className="font-mono font-bold text-primary text-sm">{selectedObraId}</p>
                  <p className="text-xs text-muted-foreground">{obraAtual?.nomeProjeto}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3" /> {obraAtual?.municipio}
                  </p>
                </div>

                {risksForObra.length === 0 && !loadingRisk ? (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Nenhum alerta de vistoria
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {risksForObra.map(r => (
                      <Badge key={r.tag} variant="outline" className={`text-[11px] px-2 py-0.5 font-semibold ${RISK_STYLE[r.color]}`}>
                        {RISK_ICON[r.color]} {r.tag}
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div className="bg-muted/40 rounded-lg p-2 text-center">
                    <div className="font-bold text-foreground text-base">{atividadesQuery.data?.length ?? '—'}</div>
                    <div className="text-muted-foreground">Atividades</div>
                  </div>
                  <div className="bg-muted/40 rounded-lg p-2 text-center">
                    <div className="font-bold text-foreground text-base">
                      {new Set(atividadesQuery.data?.map((a: any) => a.ponto_id)).size || '—'}
                    </div>
                    <div className="text-muted-foreground">Pontos</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Parâmetros */}
          <Card className="border border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                Parâmetros do Planejamento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {/* Jornada */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                  Jornada de Trabalho <span className="text-[10px] text-muted-foreground font-normal">(mín. 8h)</span>
                </label>
                <div className="flex items-center gap-2">
                  <Input type="number" min={8} max={12} value={jornadaHoras}
                    onChange={e => setJornadaHoras(Math.max(8, Number(e.target.value)))}
                    className="h-9 text-sm font-mono font-bold w-24" />
                  <span className="text-sm text-muted-foreground">horas</span>
                </div>
              </div>

              {/* Meta */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
                  Meta Planejada <span className="text-[10px] text-muted-foreground font-normal">(&gt; 100%)</span>
                </label>
                <div className="flex items-center gap-2">
                  <Input type="number" min={100} max={200} value={metaPercent}
                    onChange={e => setMetaPercent(Math.max(100, Number(e.target.value)))}
                    className="h-9 text-sm font-mono font-bold w-24" />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              </div>

              {/* Ponto de Saída */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Home className="w-3.5 h-3.5 text-muted-foreground" />
                  Ponto de Saída
                </label>
                <Select value={pontoSaida} onValueChange={setPontoSaida}>
                  <SelectTrigger className="h-9 text-xs font-semibold bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="base" className="text-xs font-semibold">🏢 Base da Unidade</SelectItem>
                    {alojamentosUnidade.map(a => (
                      <SelectItem key={a.id} value={a.id} className="text-xs">🏠 {a.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Equipes */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-muted-foreground" />
                  Equipes ({equipesSelecionadas.length || 'todas'})
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-8 text-xs justify-between px-2.5 font-semibold bg-background">
                      {equipesSelecionadas.length === 0 ? 'Todas Equipes' : `${equipesSelecionadas.length} selecionadas`}
                      <ChevronDown className="w-3 h-3 opacity-50 ml-1" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[200px] p-2" align="start">
                    <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                      {equipesDisponiveis.map(eq => (
                        <div key={eq} onClick={() => toggleEquipe(eq)}
                          className="flex items-center gap-2 cursor-pointer hover:bg-accent/40 p-1 rounded text-xs">
                          <Checkbox checked={equipesSelecionadas.includes(eq)} />
                          <span className="font-mono font-semibold">{eq}</span>
                        </div>
                      ))}
                    </div>
                    {equipesSelecionadas.length > 0 && (
                      <button onClick={() => setEquipesSelecionadas([])} className="text-[10px] text-muted-foreground hover:underline mt-2 block">
                        Limpar seleção
                      </button>
                    )}
                  </PopoverContent>
                </Popover>
              </div>
            </CardContent>
          </Card>

          {/* Sugestões */}
          <Card className="border border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                Sugestões Rápidas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 pt-0">
              {SUGESTOES.map((s, i) => (
                <button key={i} onClick={() => setChatInput(s)}
                  className="w-full text-left text-xs px-3 py-2 rounded-lg border border-border/60 bg-card hover:bg-accent/40 hover:border-primary/30 transition-all text-muted-foreground hover:text-foreground">
                  💬 {s}
                </button>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* ── Coluna Direita: Chat ── */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          <Card className="border border-border flex flex-col" style={{ minHeight: '600px' }}>
            <CardHeader className="pb-3 border-b border-border">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Bot className="w-4 h-4 text-violet-500" />
                  Chat com IA — Planejamento Automático
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={clearMessages} className="h-7 text-xs text-muted-foreground hover:text-destructive gap-1">
                  <Trash2 className="w-3 h-3" /> Limpar
                </Button>
              </div>
            </CardHeader>

            {/* Mensagens */}
            <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[520px]
              [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full">
              {messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-tr-sm'
                      : 'bg-muted/60 text-foreground rounded-tl-sm border border-border/60'
                  }`}>
                    {msg.loading ? (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-xs">{msg.content}</span>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-xs leading-relaxed whitespace-pre-wrap">{msg.content}</p>

                        {/* Tabelas do plano */}
                        {msg.planData && msg.planData.planejamento?.length > 0 && (
                          <div className="space-y-3 mt-3">
                            {msg.planData.planejamento.map((plano, i) => (
                              <TabelaSemanal key={i} plano={plano} onExportar={handleExportar} />
                            ))}
                          </div>
                        )}

                        {/* Alertas */}
                        {msg.planData && msg.planData.alertas?.length > 0 && (
                          <div className="space-y-1 mt-2">
                            {msg.planData.alertas.map((a, i) => (
                              <div key={i} className="flex items-start gap-2 text-[11px] text-amber-700 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-1.5">
                                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {a}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="text-[10px] opacity-50 mt-1.5 text-right">
                      {format(msg.timestamp, 'HH:mm')}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </CardContent>

            {/* Input */}
            <div className="p-4 border-t border-border space-y-2">
              {equipesSelecionadas.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {equipesSelecionadas.map(eq => (
                    <Badge key={eq} variant="secondary" className="font-mono text-[11px] gap-1 cursor-pointer hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => toggleEquipe(eq)}>
                      {eq} ✕
                    </Badge>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Textarea
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder={selectedObraId
                    ? `Monte um planejamento para a obra ${selectedObraId} na semana de 18/08 a 22/08...`
                    : 'Selecione uma obra na lista acima e descreva o planejamento desejado...'
                  }
                  className="resize-none text-xs min-h-[56px] max-h-[120px] flex-1"
                  rows={2}
                />
                <Button onClick={handleSend} disabled={isLoading || !chatInput.trim()} className="h-auto px-4 self-end">
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Enter para enviar · Shift+Enter para nova linha · Selecione a obra e configure os parâmetros antes de pedir o plano
              </p>
            </div>
          </Card>
        </div>
      </div>

      {/* ── Seção de Edição da Programação da IA ── */}
      {aiPlans && aiPlans.planejamento && aiPlans.planejamento.length > 0 && (
        <div id="ai-plan-editor-section" className="flex flex-col gap-6 pt-4 border-t border-border mt-2">
          <div className="flex items-center gap-2 mb-2">
            <Bot className="w-5 h-5 text-violet-500" />
            <h2 className="text-base font-bold text-foreground">Programação Gerada pela IA para Edição</h2>
          </div>
          {aiPlans.planejamento.map((plano, i) => (
            <AiPlanEditor
              key={`${plano.equipe}-${i}`}
              plano={plano}
              obra={obras.find(o => o.projeto === plano.obra) || null}
              obraId={plano.obra}
              unidadeId={selectedUnidadeId}
              pontosDisponiveis={pontosDisponiveisDoProjeto}
              orcamentoPorPontoMap={orcamentoPorPontoMap}
              supervisoresDisponiveis={supervisoresDisponiveis}
              equipesDisponiveis={equipesDisponiveis}
              etapasDisponiveis={etapasDisponiveis}
              salvarProgramacao={salvarProgramacao}
              index={i}
            />
          ))}
        </div>
      )}

    </div>
  );
};
