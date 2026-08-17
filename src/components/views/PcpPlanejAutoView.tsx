import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bot,
  Send,
  Loader2,
  RefreshCw,
  Building2,
  AlertTriangle,
  ShieldAlert,
  MapPin,
  Clock,
  Target,
  Zap,
  Plus,
  X,
  ChevronDown,
  Calendar,
  Users,
  Layers,
  TrendingUp,
  Home,
  ZoomIn,
  ZoomOut,
  Trash2,
  FileSpreadsheet,
  CheckCircle2,
  Map,
  BarChart3,
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
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ReactMarkdown from 'react-markdown';

// ─── Risk Badge ───────────────────────────────────────────────────────────────
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

// ─── Tabela Semanal do Plano ──────────────────────────────────────────────────
const TabelaSemanal = ({
  plano,
  onExportar,
}: {
  plano: PlanoEquipe;
  onExportar: (plano: PlanoEquipe) => void;
}) => {
  const dias = plano.dias ?? [];
  return (
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
            {dias.map((dia, i) => (
              <tr key={i} className="hover:bg-accent/20 transition-colors">
                <td className="px-3 py-2.5">
                  <div className="font-semibold text-foreground">{dia.diaSemana?.split('-')[0]?.trim() ?? dia.diaSemana}</div>
                  <div className="text-muted-foreground font-mono text-[10px]">{dia.data}</div>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap gap-1">
                    {dia.pontos.map(p => (
                      <Badge key={p} variant="secondary" className="font-mono text-[10px] px-1.5 py-0">
                        {p}
                      </Badge>
                    ))}
                  </div>
                  {dia.observacao && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 italic">{dia.observacao}</p>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right font-mono font-semibold">{dia.tempoTotalFormatado}</td>
                <td className="px-3 py-2.5 text-right font-mono">
                  R$ {dia.valorEstimado?.toLocaleString('pt-BR', { minimumFractionDigits: 0 }) ?? '—'}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <Badge
                    className={`font-mono text-[10px] px-1.5 py-0 ${
                      dia.percentualMeta >= 100
                        ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
                        : 'bg-amber-500/15 text-amber-600 border-amber-500/30'
                    }`}
                  >
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
};

// ─── Main View ────────────────────────────────────────────────────────────────
export const PcpPlanejAutoView = () => {
  // Estado global
  const [selectedUnidadeId, setSelectedUnidadeId] = useState('1rj2V7CxbZwkan63eCeLkH9G00Gi041IZNC6vwEgq6yI');
  const [zoomLevel, setZoomLevel] = useSessionState<number>('zoom_pcp_auto', 1);

  // Parâmetros do planejamento
  const [jornadaHoras, setJornadaHoras] = useState(9);
  const [metaPercent, setMetaPercent] = useState(110);
  const [pontoSaida, setPontoSaida] = useState<'base' | string>('base');
  const [equipesSelecionadas, setEquipesSelecionadas] = useState<string[]>([]);
  const [selectedObraAuto, setSelectedObraAuto] = useState<string>('');

  // Chat input
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Dados do PCP
  const { obras, equipesDisponiveis, orcamentoPorPontoMap, rawCacheQuery } =
    usePcpPlanejamentoData(selectedUnidadeId, selectedObraAuto || undefined);

  const { alojamentos } = useAlojamentos();
  const { messages, sendMessage, isLoading, clearMessages } = usePcpAiPlanner();
  const { analyzeRisk, riskCache, loadingRisk } = useVistoriaRisk(selectedObraAuto || null);

  // Atividades do Supabase para a obra selecionada
  const atividadesQuery = useQuery({
    queryKey: ['atividades_plano', selectedUnidadeId, selectedObraAuto],
    queryFn: async () => {
      if (!selectedObraAuto) return [];
      const { data } = await supabase
        .from('atividades_por_ponto' as any)
        .select('obra_id, ponto_id, atividade, quantidade, tempo_minutos, valor_estimado')
        .eq('obra_id', selectedObraAuto)
        .limit(2000);
      return (data ?? []) as any[];
    },
    enabled: !!selectedObraAuto,
    staleTime: 5 * 60 * 1000,
  });

  // Alojamentos da unidade selecionada
  const alojamentosUnidade = alojamentos.filter(a => {
    const u = UNIDADES_DISPONIVEIS.find(u => u.id === selectedUnidadeId);
    return a.unidadeNome === u?.name || !a.unidadeId || a.unidadeId === selectedUnidadeId;
  });

  // Scroll ao fim do chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Análise de risco ao mudar de obra
  useEffect(() => {
    if (selectedObraAuto) {
      analyzeRisk(selectedObraAuto);
    }
  }, [selectedObraAuto]);

  // Toggle equipe
  const toggleEquipe = (eq: string) => {
    setEquipesSelecionadas(prev =>
      prev.includes(eq) ? prev.filter(e => e !== eq) : [...prev, eq]
    );
  };

  // Monta contexto para a IA
  const buildContext = useCallback(() => ({
    obras: obras.slice(0, 15).map(o => ({
      projeto: o.projeto,
      nomeProjeto: o.nomeProjeto,
      municipio: o.municipio,
      lat: (o as any).lat,
      lng: (o as any).lng,
      pontosDisponiveis: Array.from(orcamentoPorPontoMap.keys()).filter(k =>
        k.startsWith(o.projeto)
      ),
    })),
    equipes: equipesSelecionadas.length > 0 ? equipesSelecionadas : equipesDisponiveis.slice(0, 3),
    alojamentos: alojamentosUnidade.map(a => ({
      nome: a.nome,
      latitude: a.latitude,
      longitude: a.longitude,
      unidadeNome: a.unidadeNome,
    })),
    atividades: atividadesQuery.data ?? [],
    parametros: {
      jornadaHoras,
      metaPercent,
      pontoSaida,
    },
  }), [obras, equipesSelecionadas, equipesDisponiveis, alojamentosUnidade, atividadesQuery.data, orcamentoPorPontoMap, jornadaHoras, metaPercent, pontoSaida]);

  const handleSend = () => {
    if (!chatInput.trim() || isLoading) return;
    const prompt = chatInput.trim();
    setChatInput('');
    sendMessage(prompt, buildContext());
  };

  const handleExportarPlan = (plano: PlanoEquipe) => {
    // Gera texto no formato da Plan_Principal para cada dia
    const linhas = plano.dias.map(dia => {
      const pontosStr = dia.pontos.join(' → ');
      return `${dia.data} | ${plano.equipe} | ${plano.obra} | ${pontosStr} | ${dia.tempoTotalFormatado} | R$ ${dia.valorEstimado?.toLocaleString('pt-BR')} | ${dia.percentualMeta?.toFixed(0)}%`;
    }).join('\n');

    const blob = new Blob([linhas], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Planejamento_${plano.equipe}_${plano.obra}_${plano.semana?.replace(/\//g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const risksForObra = selectedObraAuto ? (riskCache[selectedObraAuto] ?? []) : [];
  const obraAtual = obras.find(o => o.projeto === selectedObraAuto);

  const SUGESTOES = [
    'monte um planejamento para a semana atual para as equipes selecionadas',
    `planifique EH156 na obra ${selectedObraAuto || 'B-XXXXX'} a partir do P1 com saturação por tempo`,
    'qual a melhor ordem de pontos para minimizar deslocamento?',
    'divida os pontos da obra entre 2 equipes para a próxima semana',
  ];

  return (
    <div
      className="flex flex-col gap-6 p-6 w-full max-w-[1600px] mx-auto min-h-screen bg-background"
      style={{ zoom: zoomLevel } as React.CSSProperties}
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-card border border-border shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-primary/10 text-primary">
            <Bot className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-foreground">Planejamento Automático com IA</h1>
              <Badge variant="outline" className="bg-violet-500/10 text-violet-600 border-violet-500/20 font-semibold">
                Gemini 1.5 Flash
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Planejamento semanal inteligente — análise de riscos, otimização de rotas e geração automática de programação
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Zoom */}
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

      {/* Filtros topo */}
      <Card className="border border-border p-3.5 bg-card shadow-xs rounded-2xl">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-foreground pr-2.5 border-r border-border">
            <Building2 className="w-4 h-4 text-primary" />
            <span>Configuração</span>
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

          {/* Obra */}
          <div className="flex flex-col gap-1 min-w-[200px]">
            <span className="text-[10px] text-muted-foreground font-semibold">Obra para Planejar</span>
            <Select value={selectedObraAuto} onValueChange={setSelectedObraAuto}>
              <SelectTrigger className="h-8 text-xs font-semibold bg-background">
                <Layers className="w-3 h-3 mr-1 text-muted-foreground shrink-0" />
                <SelectValue placeholder="Selecionar obra..." />
              </SelectTrigger>
              <SelectContent className="max-h-[240px]">
                {obras.map(o => (
                  <SelectItem key={o.projeto} value={o.projeto} className="text-xs font-mono">
                    {o.projeto} — {o.municipio}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Equipes multi-select */}
          <div className="flex flex-col gap-1 min-w-[180px]">
            <span className="text-[10px] text-muted-foreground font-semibold">
              Equipes ({equipesSelecionadas.length || 'todas'})
            </span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-8 text-xs justify-between px-2.5 font-semibold bg-background">
                  <Users className="w-3 h-3 mr-1" />
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
                  <button onClick={() => setEquipesSelecionadas([])}
                    className="text-[10px] text-muted-foreground hover:underline mt-2 block">
                    Limpar seleção
                  </button>
                )}
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </Card>

      {/* Grid Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* ── Coluna Esquerda: Parâmetros ── */}
        <div className="lg:col-span-4 flex flex-col gap-4">

          {/* Card Parâmetros */}
          <Card className="border border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                Parâmetros do Planejamento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Jornada */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                  Jornada de Trabalho
                  <span className="text-[10px] text-muted-foreground font-normal">(mín. 8h)</span>
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={8}
                    max={12}
                    value={jornadaHoras}
                    onChange={e => setJornadaHoras(Math.max(8, Number(e.target.value)))}
                    className="h-9 text-sm font-mono font-bold w-24"
                  />
                  <span className="text-sm text-muted-foreground">horas</span>
                </div>
              </div>

              {/* Meta */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
                  Meta Planejada
                  <span className="text-[10px] text-muted-foreground font-normal">(&gt; 100%)</span>
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={100}
                    max={200}
                    value={metaPercent}
                    onChange={e => setMetaPercent(Math.max(100, Number(e.target.value)))}
                    className="h-9 text-sm font-mono font-bold w-24"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              </div>

              {/* Ponto de Saída */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Home className="w-3.5 h-3.5 text-muted-foreground" />
                  Ponto de Saída das Equipes
                </label>
                <Select value={pontoSaida} onValueChange={setPontoSaida}>
                  <SelectTrigger className="h-9 text-xs font-semibold bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="base" className="text-xs font-semibold">
                      🏢 Base da Unidade
                    </SelectItem>
                    {alojamentosUnidade.map(a => (
                      <SelectItem key={a.id} value={a.id} className="text-xs">
                        🏠 {a.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {alojamentosUnidade.length === 0 && (
                  <p className="text-[10px] text-muted-foreground">
                    Nenhum alojamento cadastrado para esta unidade.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Card Obra + Riscos */}
          {selectedObraAuto && (
            <Card className="border border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Layers className="w-4 h-4 text-primary" />
                  Obra Selecionada
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="font-mono font-bold text-primary text-sm">{selectedObraAuto}</p>
                  <p className="text-xs text-muted-foreground">{obraAtual?.nomeProjeto}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3" /> {obraAtual?.municipio}
                  </p>
                </div>

                {/* Alertas de Risco por IA */}
                <div className="pt-2 border-t border-border/60">
                  <div className="flex items-center gap-1.5 mb-2">
                    <ShieldAlert className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-[11px] font-semibold text-muted-foreground">
                      Análise de Risco (Vistoria)
                    </span>
                    {loadingRisk && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                  </div>

                  {risksForObra.length === 0 && !loadingRisk ? (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Nenhum alerta identificado na vistoria
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {risksForObra.map(r => (
                        <Badge
                          key={r.tag}
                          variant="outline"
                          className={`text-[11px] px-2 py-0.5 font-semibold ${RISK_STYLE[r.color]}`}
                        >
                          {RISK_ICON[r.color]} {r.tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Dados do orçamento */}
                <div className="pt-2 border-t border-border/60 grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-muted/40 rounded-lg p-2 text-center">
                    <div className="font-bold text-foreground text-base">
                      {atividadesQuery.data?.length ?? '—'}
                    </div>
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

          {/* Card Sugestões rápidas */}
          <Card className="border border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                Sugestões Rápidas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {SUGESTOES.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setChatInput(s)}
                  className="w-full text-left text-xs px-3 py-2 rounded-lg border border-border/60 bg-card hover:bg-accent/40 hover:border-primary/30 transition-all text-muted-foreground hover:text-foreground"
                >
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
                  <Bot className="w-4 h-4 text-primary" />
                  Chat com IA — Planejamento Automático
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={clearMessages} className="h-7 text-xs text-muted-foreground hover:text-destructive gap-1">
                  <Trash2 className="w-3 h-3" /> Limpar
                </Button>
              </div>
            </CardHeader>

            {/* Mensagens */}
            <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[520px]
              [&::-webkit-scrollbar]:w-1.5
              [&::-webkit-scrollbar-thumb]:bg-border
              [&::-webkit-scrollbar-thumb]:rounded-full">
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
                        <div className="prose prose-sm dark:prose-invert max-w-none text-xs leading-relaxed">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>

                        {/* Tabela do plano */}
                        {msg.planData && msg.planData.planejamento?.length > 0 && (
                          <div className="space-y-3 mt-3">
                            {msg.planData.planejamento.map((plano, i) => (
                              <TabelaSemanal
                                key={i}
                                plano={plano}
                                onExportar={handleExportarPlan}
                              />
                            ))}
                          </div>
                        )}

                        {/* Alertas da IA */}
                        {msg.planData && msg.planData.alertas?.length > 0 && (
                          <div className="space-y-1 mt-2">
                            {msg.planData.alertas.map((a, i) => (
                              <div key={i} className="flex items-start gap-2 text-[11px] text-amber-700 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-1.5">
                                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                {a}
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

            {/* Input do chat */}
            <div className="p-4 border-t border-border space-y-2">
              {/* Equipes selecionadas como chips */}
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
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder='Ex: "monte um planejamento para EH156 na obra B-1233638 na semana de 18/08 a 22/08/2026 com saturação por tempo"'
                  className="resize-none text-xs min-h-[56px] max-h-[120px] flex-1"
                  rows={2}
                />
                <Button
                  onClick={handleSend}
                  disabled={isLoading || !chatInput.trim()}
                  className="h-auto px-4 self-end"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Enter para enviar · Shift+Enter para nova linha · Configure parâmetros à esquerda antes de pedir o plano
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
