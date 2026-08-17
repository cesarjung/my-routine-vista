import { useState, useMemo, useCallback } from 'react';
import {
  Users, Clock, Send, Loader2, Layers, AlertCircle, PackageCheck,
  ChevronDown, Tag, Wrench, Target, Navigation, ShieldCheck, LogOut,
  TrendingUp, MapPin, Zap, Plus, Trash2, Search, Calendar as CalendarIcon,
  CheckCircle2, DollarSign, Bot, Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  SERVICOS_PADRAO, ETAPAS_PADRAO, PcpObra, PcpPontoItem,
  inferEtapaFromServico, MaterialPontoBudget,
} from '@/hooks/usePcpPlanejamentoData';
import { PlanoEquipe } from '@/hooks/usePcpAiPlanner';

// ─── PontosMultiSelect (copiado do PcpPlanejamentoView) ───────────────────────
interface PontosMultiSelectProps {
  pontos: string[];
  selected: string[];
  orcamentoPorPontoMap: Map<string, MaterialPontoBudget[]>;
  onToggle: (p: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

const PontosMultiSelect = ({ pontos, selected, orcamentoPorPontoMap, onToggle, onSelectAll, onDeselectAll }: PontosMultiSelectProps) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const filtered = pontos.filter(p => p.toLowerCase().includes(search.toLowerCase()));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-8 text-xs font-semibold px-3 bg-background min-w-[200px] justify-between">
          <span className="flex items-center gap-1.5">
            <PackageCheck className="w-3.5 h-3.5 text-primary" />
            {selected.length === 0 ? 'Selecionar Pontos...' : `${selected.length} de ${pontos.length} pontos`}
          </span>
          <ChevronDown className="w-3 h-3 opacity-50 ml-2 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <div className="p-2 border-b border-border">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
            <input placeholder="Buscar ponto..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full h-8 pl-8 pr-2 text-xs rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary font-mono" autoFocus />
          </div>
        </div>
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-border text-[10px]">
          <button onClick={onSelectAll} className="text-primary hover:underline font-semibold">Todos ({pontos.length})</button>
          <button onClick={onDeselectAll} className="text-muted-foreground hover:underline">Limpar</button>
        </div>
        <div className="overflow-y-auto max-h-[260px] p-1.5 space-y-0.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full">
          {filtered.map(p => {
            const isChecked = selected.includes(p);
            const count = (orcamentoPorPontoMap.get(p) || []).length;
            return (
              <div key={p} onClick={() => onToggle(p)}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors text-xs ${isChecked ? 'bg-primary/10 text-primary font-semibold' : 'hover:bg-accent text-foreground'}`}>
                <Checkbox checked={isChecked} className="h-3.5 w-3.5 shrink-0" />
                <span className="font-mono font-bold">{p}</span>
                <span className="text-[10px] text-muted-foreground ml-auto">{count} ativ.</span>
              </div>
            );
          })}
        </div>
        <div className="px-3 py-2 border-t border-border text-[10px] text-muted-foreground flex justify-between">
          <span>{selected.length} selecionados</span>
          <button onClick={() => setOpen(false)} className="text-primary hover:underline font-semibold">Confirmar</button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

// ─── Props ────────────────────────────────────────────────────────────────────
interface AiPlanEditorProps {
  plano: PlanoEquipe;
  obra: PcpObra | null;
  obraId: string;
  unidadeId: string;
  pontosDisponiveis: string[];
  orcamentoPorPontoMap: Map<string, MaterialPontoBudget[]>;
  supervisoresDisponiveis: string[];
  equipesDisponiveis: string[];
  etapasDisponiveis: string[];
  salvarProgramacao: any;  // useMutation
  index: number;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export const AiPlanEditor = ({
  plano,
  obra,
  obraId,
  unidadeId,
  pontosDisponiveis,
  orcamentoPorPontoMap,
  supervisoresDisponiveis,
  equipesDisponiveis,
  etapasDisponiveis,
  salvarProgramacao,
  index,
}: AiPlanEditorProps) => {

  // ── State ─────────────────────────────────────────────────────────────────
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [equipe, setEquipe] = useState(plano.equipe || (equipesDisponiveis[0] ?? ''));
  const [supervisor, setSupervisor] = useState(supervisoresDisponiveis[0] ?? 'SUPERVISOR');
  const [selectedEtapas, setSelectedEtapas] = useState<string[]>([]);
  const [isEtapasPopoverOpen, setIsEtapasPopoverOpen] = useState(false);

  const [tempoDeslocamento, setTempoDeslocamento] = useState(30);
  const [tempoSaidaBase, setTempoSaidaBase] = useState(15);
  const [tempoSeguranca, setTempoSeguranca] = useState(15);
  const [metaEquipeInput, setMetaEquipeInput] = useState(4442);

  const [newCustomPontoInput, setNewCustomPontoInput] = useState('');

  // Pré-seleciona pontos sugeridos pela IA (union de todos os dias)
  const pontosIa = useMemo(() => {
    const set = new Set<string>();
    plano.dias?.forEach(dia => dia.pontos?.forEach(p => set.add(p.toUpperCase())));
    return Array.from(set);
  }, [plano]);

  const [selectedPontosLabels, setSelectedPontosLabels] = useState<string[]>(pontosIa);

  // Monta mapa de atividades pré-preenchidas a partir do orçamento
  const [pontosGroupedMap, setPontosGroupedMap] = useState<Record<string, PcpPontoItem[]>>(() => {
    const map: Record<string, PcpPontoItem[]> = {};
    pontosIa.forEach(pLabel => {
      const orcItems = orcamentoPorPontoMap.get(pLabel) ?? [];
      map[pLabel] = orcItems.map((o, idx) => ({
        id: `${pLabel}-${idx}`,
        ponto: pLabel,
        servico: o.servico ?? '',
        qtdOrcadaPonto: o.qtdOrcada ?? 1,
        etapaPrevista: o.etapaPrevista ?? inferEtapaFromServico(o.servico ?? ''),
        quantidade: 1,
        tempoEstimadoMinutos: o.tempoEstimadoMinutos ?? 0,
        valorEstimado: o.valorEstimado ?? 0,
        selected: true,
        isBudgeted: true,
      }));
      // Se não há atividades no orçamento, cria uma linha em branco
      if (map[pLabel].length === 0) {
        map[pLabel] = [{
          id: `${pLabel}-blank-0`,
          ponto: pLabel,
          servico: SERVICOS_PADRAO[0]?.servico ?? 'SUBSTITUIÇÃO DE POSTE',
          qtdOrcadaPonto: 1,
          etapaPrevista: inferEtapaFromServico(SERVICOS_PADRAO[0]?.servico ?? ''),
          quantidade: 1,
          tempoEstimadoMinutos: SERVICOS_PADRAO[0]?.tempoMinutosPorUnidade ?? 60,
          valorEstimado: SERVICOS_PADRAO[0]?.valorPorUnidade ?? 0,
          selected: true,
          isBudgeted: false,
        }];
      }
    });
    return map;
  });

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleTogglePontoLabel = (pLabel: string) => {
    const upper = pLabel.toUpperCase().trim();
    setSelectedPontosLabels(prev =>
      prev.includes(upper) ? prev.filter(p => p !== upper) : [...prev, upper]
    );
  };

  const handleSelectAllPontos = () => setSelectedPontosLabels([...pontosDisponiveis]);
  const handleDeselectAllPontos = () => setSelectedPontosLabels([]);

  const handleAddCustomPontoLabel = () => {
    if (!newCustomPontoInput.trim()) return;
    const clean = newCustomPontoInput.toUpperCase().trim();
    if (!selectedPontosLabels.includes(clean)) {
      setSelectedPontosLabels(prev => [...prev, clean]);
      // Adiciona linha vazia para este ponto
      if (!pontosGroupedMap[clean]) {
        setPontosGroupedMap(prev => ({
          ...prev,
          [clean]: [{
            id: `${clean}-blank-0`,
            ponto: clean,
            servico: SERVICOS_PADRAO[0]?.servico ?? '',
            qtdOrcadaPonto: 1,
            etapaPrevista: inferEtapaFromServico(SERVICOS_PADRAO[0]?.servico ?? ''),
            quantidade: 1,
            tempoEstimadoMinutos: SERVICOS_PADRAO[0]?.tempoMinutosPorUnidade ?? 60,
            valorEstimado: SERVICOS_PADRAO[0]?.valorPorUnidade ?? 0,
            selected: true,
            isBudgeted: false,
          }]
        }));
      }
    }
    setNewCustomPontoInput('');
  };

  const handleAddAtividadeNoPonto = (pontoLabelTarget: string) => {
    const existing = pontosGroupedMap[pontoLabelTarget] || [];
    const existingServicos = new Set(existing.map(i => i.servico));
    const next = SERVICOS_PADRAO.find(s => !existingServicos.has(s.servico)) || SERVICOS_PADRAO[0];
    const newItem: PcpPontoItem = {
      id: `${pontoLabelTarget}-manual-${Date.now()}`,
      ponto: pontoLabelTarget,
      servico: next.servico,
      qtdOrcadaPonto: 1,
      etapaPrevista: inferEtapaFromServico(next.servico),
      quantidade: 1,
      tempoEstimadoMinutos: next.tempoMinutosPorUnidade,
      valorEstimado: next.valorPorUnidade,
      selected: true,
      isBudgeted: false,
    };
    setPontosGroupedMap(prev => ({ ...prev, [pontoLabelTarget]: [...(prev[pontoLabelTarget] || []), newItem] }));
  };

  const handleUpdateAtividade = useCallback((ponto: string, idx: number, field: keyof PcpPontoItem, value: any) => {
    setPontosGroupedMap(prev => {
      const items = [...(prev[ponto] || [])];
      if (!items[idx]) return prev;
      const target = { ...items[idx] };
      if (field === 'servico') {
        const found = SERVICOS_PADRAO.find(s => s.servico === value);
        target.servico = value;
        target.etapaPrevista = inferEtapaFromServico(value);
        if (found) {
          target.tempoEstimadoMinutos = Math.round(found.tempoMinutosPorUnidade * target.quantidade);
          target.valorEstimado = found.valorPorUnidade * target.quantidade;
        }
      } else if (field === 'quantidade') {
        const qty = Math.max(1, Math.round(Number(value) || 1));
        const found = SERVICOS_PADRAO.find(s => s.servico === target.servico) || SERVICOS_PADRAO[0];
        target.quantidade = qty;
        target.tempoEstimadoMinutos = Math.round(found.tempoMinutosPorUnidade * qty);
        target.valorEstimado = found.valorPorUnidade * qty;
      } else if (field === 'qtdOrcadaPonto') {
        target.qtdOrcadaPonto = Math.max(0.1, Number(value) || 1);
      } else if (field === 'etapaPrevista') {
        target.etapaPrevista = String(value);
      } else if (field === 'selected') {
        target.selected = Boolean(value);
      }
      items[idx] = target;
      return { ...prev, [ponto]: items };
    });
  }, []);

  const handleRemoveAtividade = useCallback((ponto: string, idx: number) => {
    setPontosGroupedMap(prev => ({
      ...prev,
      [ponto]: (prev[ponto] || []).filter((_, i) => i !== idx)
    }));
  }, []);

  const handleToggleEtapa = (et: string) =>
    setSelectedEtapas(prev => prev.includes(et) ? prev.filter(e => e !== et) : [...prev, et]);

  // ── Computed ──────────────────────────────────────────────────────────────
  const allPontosListFlat = useMemo(() => {
    const list: PcpPontoItem[] = [];
    selectedPontosLabels.forEach(p => list.push(...(pontosGroupedMap[p] || [])));
    return list;
  }, [selectedPontosLabels, pontosGroupedMap]);

  const selectedItemsFlat = useMemo(() => allPontosListFlat.filter(p => p.selected), [allPontosListFlat]);

  const tempoAtividadesMinutos = useMemo(() =>
    selectedItemsFlat.reduce((acc, p) => acc + (p.tempoEstimadoMinutos || 0), 0), [selectedItemsFlat]);

  const tempoTotalGeralMinutos = useMemo(() =>
    tempoAtividadesMinutos + tempoDeslocamento + tempoSaidaBase + tempoSeguranca, [tempoAtividadesMinutos, tempoDeslocamento, tempoSaidaBase, tempoSeguranca]);

  const tempoTotalFormatado = useMemo(() => {
    const h = Math.floor(tempoTotalGeralMinutos / 60);
    const m = tempoTotalGeralMinutos % 60;
    return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}min`;
  }, [tempoTotalGeralMinutos]);

  const totalValor = useMemo(() =>
    selectedItemsFlat.reduce((acc, p) => acc + (p.valorEstimado || 0), 0), [selectedItemsFlat]);

  const percentualMeta = useMemo(() => {
    const meta = Number(metaEquipeInput) || 0;
    if (meta <= 0) return 0;
    return Math.round((totalValor / meta) * 1000) / 10;
  }, [totalValor, metaEquipeInput]);

  const compiledPreview = useMemo(() =>
    selectedItemsFlat.map(p => {
      const h = Math.floor(p.tempoEstimadoMinutos / 60);
      const m = p.tempoEstimadoMinutos % 60;
      const hr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      return `${p.ponto} - [${p.etapaPrevista}] ${p.servico} - Qtd: ${p.quantidade} - Hr. Prev: ${hr}`;
    }).join(' | '), [selectedItemsFlat]);

  const dataProgramacaoFormatada = useMemo(() =>
    format(selectedDate, 'dd/MM/yyyy', { locale: ptBR }), [selectedDate]);

  const postesProgramados = useMemo(() =>
    selectedItemsFlat.filter(i => (i.servico || '').toUpperCase().includes('POSTE'))
      .reduce((acc, i) => acc + (i.quantidade || 0), 0), [selectedItemsFlat]);

  const saldoPostes = obra ? obra.qtdPostesDisponiveis - postesProgramados : 0;

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleEnviar = () => {
    if (!obra) { alert('Obra não encontrada.'); return; }
    if (selectedItemsFlat.length === 0) { alert('Selecione ao menos uma atividade.'); return; }
    salvarProgramacao.mutate({
      unidadeId,
      dataProgramacao: dataProgramacaoFormatada,
      dateObj: selectedDate,
      supervisor,
      equipe,
      etapa: selectedEtapas.join(', '),
      obra,
      pontos: allPontosListFlat,
      tempoDeslocamentoMinutos: tempoDeslocamento,
      tempoSaidaBaseMinutos: tempoSaidaBase,
      tempoSegurancaMinutos: tempoSeguranca,
      metaEquipeValor: metaEquipeInput,
    });
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-5 border border-violet-500/30 rounded-2xl bg-violet-500/5 p-5">
      {/* Header */}
      <div className="flex items-center gap-3 pb-3 border-b border-violet-500/20">
        <div className="p-2 rounded-xl bg-violet-500/15 text-violet-600">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-foreground">
              Programação Gerada pela IA — Equipe {plano.equipe}
            </h2>
            <Badge variant="outline" className="bg-violet-500/10 text-violet-600 border-violet-500/20 text-[10px]">
              {plano.semana}
            </Badge>
            <Badge variant="secondary" className="font-mono text-[10px]">{obraId}</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Edite pontos e atividades abaixo e grave na Plan_Principal
          </p>
        </div>
      </div>

      {/* Grid 2 colunas: Parâmetros + Pontos/Atividades */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

        {/* ── Coluna Esquerda: Parâmetros ── */}
        <div className="lg:col-span-4 flex flex-col gap-4">

          {/* Card Data + Equipe + Supervisor */}
          <Card className="border border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-semibold flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" /> Dados da Programação
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {/* Data */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Data da Programação</Label>
                <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-9 text-xs font-mono font-semibold justify-start gap-2">
                      <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground" />
                      {dataProgramacaoFormatada}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={selectedDate}
                      onSelect={d => { if (d) { setSelectedDate(d); setIsCalendarOpen(false); } }}
                      locale={ptBR} />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Equipe */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Equipe</Label>
                <Select value={equipe} onValueChange={setEquipe}>
                  <SelectTrigger className="h-9 text-xs font-mono font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {equipesDisponiveis.map(eq => (
                      <SelectItem key={eq} value={eq} className="text-xs font-mono">{eq}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Supervisor */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Supervisor Responsável</Label>
                <Select value={supervisor} onValueChange={setSupervisor}>
                  <SelectTrigger className="h-9 text-xs font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {supervisoresDisponiveis.map(s => (
                      <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Etapas */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Etapas da Obra</Label>
                <Popover open={isEtapasPopoverOpen} onOpenChange={setIsEtapasPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full h-9 text-xs justify-between px-3">
                      <span className="flex items-center gap-1.5 truncate">
                        <Tag className="w-3.5 h-3.5 text-primary shrink-0" />
                        {selectedEtapas.length === 0 ? 'Nenhuma' : selectedEtapas.join(', ')}
                      </span>
                      <ChevronDown className="w-3 h-3 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[240px] p-3 text-xs" align="start">
                    <div className="flex items-center justify-between pb-2 border-b mb-2 font-bold text-xs">
                      <span>Etapas</span>
                      <div className="flex gap-2">
                        <button onClick={() => setSelectedEtapas([])} className="text-[10px] text-muted-foreground hover:underline">Desmarcar</button>
                        <button onClick={() => setSelectedEtapas([...etapasDisponiveis])} className="text-[10px] text-primary hover:underline">Todas</button>
                      </div>
                    </div>
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {etapasDisponiveis.map(et => (
                        <div key={et} onClick={() => handleToggleEtapa(et)} className="flex items-center gap-2 cursor-pointer hover:bg-accent/40 p-1.5 rounded">
                          <Checkbox checked={selectedEtapas.includes(et)} />
                          <span className="text-xs font-medium">{et}</span>
                        </div>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </CardContent>
          </Card>

          {/* Card Tempos + Meta */}
          <Card className="border border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-semibold flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" /> Tempos Complementares e Meta
                </span>
                <Badge variant="secondary" className="font-mono text-[11px]">{equipe}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Deslocamento', icon: <Navigation className="w-3 h-3 text-blue-500" />, value: tempoDeslocamento, set: setTempoDeslocamento },
                  { label: 'Saída Base', icon: <LogOut className="w-3 h-3 text-amber-500" />, value: tempoSaidaBase, set: setTempoSaidaBase },
                  { label: 'Segurança', icon: <ShieldCheck className="w-3 h-3 text-emerald-500" />, value: tempoSeguranca, set: setTempoSeguranca },
                ].map(({ label, icon, value, set }) => (
                  <div key={label} className="flex flex-col gap-1">
                    <Label className="text-[11px] text-muted-foreground flex items-center gap-1">{icon} {label}</Label>
                    <div className="relative">
                      <Input type="number" min="0" value={value}
                        onChange={e => set(Math.max(0, Number(e.target.value) || 0))}
                        className="h-8 text-xs font-mono font-bold pr-8" />
                      <span className="absolute right-2 top-2 text-[10px] text-muted-foreground font-mono">min</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 rounded-xl bg-muted/40 border border-border flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  Ativid.: <strong>{Math.floor(tempoAtividadesMinutos / 60)}h {tempoAtividadesMinutos % 60}m</strong> + comp.: <strong>{tempoDeslocamento + tempoSaidaBase + tempoSeguranca}m</strong>
                </span>
                <span className="font-mono font-bold text-sm text-primary">{tempoTotalFormatado}</span>
              </div>

              <div className="pt-2 border-t border-border/80 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold flex items-center gap-1.5">
                    <Target className="w-4 h-4 text-emerald-600" /> Meta da Equipe {equipe} (R$):
                  </Label>
                  <div className="relative w-[150px]">
                    <span className="absolute left-2.5 top-2 text-xs font-mono text-muted-foreground">R$</span>
                    <Input type="number" step="10" min="0" value={metaEquipeInput}
                      onChange={e => setMetaEquipeInput(Math.max(0, Number(e.target.value) || 0))}
                      className="h-8 text-xs text-right font-mono font-bold pl-8 pr-2" />
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-card border border-border flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <TrendingUp className="w-3.5 h-3.5 text-primary" /> % Previsto da Meta:
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-extrabold text-sm">{percentualMeta}%</span>
                      <Badge variant="outline" className={`text-[10px] px-2 py-0.5 font-mono font-bold ${
                        percentualMeta >= 100 ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                        : percentualMeta >= 75 ? 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                        : 'bg-rose-500/10 text-rose-600 border-rose-500/30'}`}>
                        {percentualMeta >= 100 ? 'META ATINGIDA' : percentualMeta >= 75 ? 'NA META' : 'ABAIXO DA META'}
                      </Badge>
                    </div>
                  </div>
                  <Progress value={Math.min(100, percentualMeta)} className={`h-2 ${
                    percentualMeta >= 100 ? '[&>div]:bg-emerald-500' : percentualMeta >= 75 ? '[&>div]:bg-amber-500' : '[&>div]:bg-rose-500'}`} />
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                    <span>Programado: <strong>R$ {totalValor.toFixed(2)}</strong></span>
                    <span>Meta: <strong>R$ {metaEquipeInput.toFixed(2)}</strong></span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Coluna Direita: Obra Banner + Pontos + Atividades ── */}
        <div className="lg:col-span-8 flex flex-col gap-5">

          {/* Banner da Obra */}
          {obra ? (
            <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-primary">{obra.projeto}</span>
                    <span className="text-xs font-semibold text-foreground">— {obra.nomeProjeto}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Município: <strong>{obra.municipio}</strong> | Dono: <strong>{obra.donoDaObra}</strong>
                  </p>
                </div>
                <Badge className="bg-primary text-primary-foreground">Obra Selecionada</Badge>
              </div>

              {/* Cards de Saldo */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-2.5 rounded-xl border bg-card/90 border-border/80 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600"><MapPin className="w-4 h-4" /></div>
                    <div>
                      <p className="text-[10px] text-muted-foreground font-semibold">Postes Disponíveis</p>
                      <p className="text-sm font-bold font-mono">{obra.qtdPostesDisponiveis}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className={`font-mono text-xs ${saldoPostes < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    Saldo: {saldoPostes}
                  </Badge>
                </div>
                <div className="p-2.5 rounded-xl border bg-card/90 border-border/80 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600"><Zap className="w-4 h-4" /></div>
                    <div>
                      <p className="text-[10px] text-muted-foreground font-semibold">Cabos Disponíveis</p>
                      <p className="text-sm font-bold font-mono">{obra.qtdCabosDisponiveis} m</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="font-mono text-xs text-emerald-600">
                    OK
                  </Badge>
                </div>
              </div>

              {/* Seleção de Pontos */}
              <div className="pt-2.5 border-t border-primary/20 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <PackageCheck className="w-4 h-4 text-primary" />
                    C6 — Pontos para trabalhar:
                  </span>
                  <div className="flex items-center gap-2 flex-1 justify-end flex-wrap">
                    <PontosMultiSelect
                      pontos={pontosDisponiveis.length > 0 ? pontosDisponiveis : pontosIa}
                      selected={selectedPontosLabels}
                      orcamentoPorPontoMap={orcamentoPorPontoMap}
                      onToggle={handleTogglePontoLabel}
                      onSelectAll={handleSelectAllPontos}
                      onDeselectAll={handleDeselectAllPontos}
                    />
                    <div className="flex items-center gap-1">
                      <Input placeholder="Outro Ponto (P99)..." value={newCustomPontoInput}
                        onChange={e => setNewCustomPontoInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddCustomPontoLabel()}
                        className="h-8 text-xs w-[130px] font-mono" />
                      <Button size="sm" variant="outline" onClick={handleAddCustomPontoLabel} className="h-8 text-xs px-2.5">
                        <Plus className="w-3.5 h-3.5 mr-1" /> Add
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Badges dos pontos */}
                {selectedPontosLabels.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {selectedPontosLabels.map(p => (
                      <Badge key={p} variant="secondary"
                        className="font-mono text-[11px] px-2 py-0.5 cursor-pointer hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => handleTogglePontoLabel(p)}>
                        {p} ✕
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl border border-dashed border-amber-500/40 bg-amber-500/5 flex items-center gap-3 text-amber-600 text-xs font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Obra não encontrada. Selecione uma obra na lista acima.</span>
            </div>
          )}

          {/* Atividades por Ponto */}
          <div className="flex flex-col gap-5">
            {selectedPontosLabels.length === 0 ? (
              <Card className="border border-border">
                <CardContent className="py-10 text-center text-muted-foreground text-xs space-y-1">
                  <p className="font-semibold text-foreground">Nenhum ponto marcado para execução.</p>
                  <p>Selecione pontos no painel acima.</p>
                </CardContent>
              </Card>
            ) : selectedPontosLabels.map(pLabel => {
              const itemsDoPonto = pontosGroupedMap[pLabel] || [];
              const itemsSelecionados = itemsDoPonto.filter(i => i.selected);
              const subtotalMinutos = itemsSelecionados.reduce((acc, i) => acc + (i.tempoEstimadoMinutos || 0), 0);
              const subtotalValor = itemsSelecionados.reduce((acc, i) => acc + (i.valorEstimado || 0), 0);

              return (
                <Card key={pLabel} className="border border-border shadow-xs">
                  <CardHeader className="pb-3 bg-muted/30 flex flex-row items-center justify-between border-b border-border/60">
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-sm font-bold font-mono text-primary flex items-center gap-1.5">
                          <Layers className="w-4 h-4" /> PONTO {pLabel}
                        </CardTitle>
                        <Badge variant="outline" className="text-[11px] font-mono">
                          {itemsDoPonto.length} atividade(s)
                        </Badge>
                      </div>
                      <CardDescription className="text-xs mt-0.5">
                        Atividades para execução no ponto <strong className="font-mono text-foreground">{pLabel}</strong>
                      </CardDescription>
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => handleAddAtividadeNoPonto(pLabel)} className="h-8 gap-1 text-xs font-semibold">
                      <Plus className="w-3.5 h-3.5" /> Adicionar Atividade
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
                                  setPontosGroupedMap(prev => ({ ...prev, [pLabel]: (prev[pLabel] || []).map(item => ({ ...item, selected: val })) }));
                                }}
                              />
                            </TableHead>
                            <TableHead>Atividade / Serviço no Ponto {pLabel}</TableHead>
                            <TableHead className="w-[85px] text-center">Qtd Prev. (Col F)</TableHead>
                            <TableHead className="w-[140px]">Etapa (Col M)</TableHead>
                            <TableHead className="w-[85px] text-center">Qtd Prog.</TableHead>
                            <TableHead className="w-[95px]">Tempo</TableHead>
                            <TableHead className="w-[100px]">Valor</TableHead>
                            <TableHead className="w-[36px]" />
                          </TableRow>
                        </TableHeader>
                        <TableBody className="text-xs">
                          {itemsDoPonto.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={8} className="text-center py-6 text-muted-foreground text-xs">
                                Clique em "Adicionar Atividade" para incluir.
                              </TableCell>
                            </TableRow>
                          ) : itemsDoPonto.map((item, itemIdx) => (
                            <TableRow key={item.id || itemIdx} className={`hover:bg-accent/30 transition-colors ${!item.selected ? 'bg-muted/10 text-muted-foreground' : 'bg-background'}`}>
                              <TableCell className="p-2 text-center">
                                <Checkbox checked={item.selected} onCheckedChange={c => handleUpdateAtividade(pLabel, itemIdx, 'selected', Boolean(c))} />
                              </TableCell>
                              <TableCell className="p-2">
                                {item.isBudgeted ? (
                                  <span className="font-semibold text-xs text-foreground">{item.servico}</span>
                                ) : (
                                  <Select value={item.servico} onValueChange={v => handleUpdateAtividade(pLabel, itemIdx, 'servico', v)}>
                                    <SelectTrigger className="h-7 text-xs font-semibold border-dashed">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-[200px]">
                                      {SERVICOS_PADRAO.map(s => (
                                        <SelectItem key={s.servico} value={s.servico} className="text-xs">{s.servico}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                              </TableCell>
                              <TableCell className="p-2 text-center">
                                <Input type="number" min="0" value={item.qtdOrcadaPonto}
                                  onChange={e => handleUpdateAtividade(pLabel, itemIdx, 'qtdOrcadaPonto', e.target.value)}
                                  className="h-7 text-xs text-center font-mono w-full" />
                              </TableCell>
                              <TableCell className="p-2">
                                <Select value={item.etapaPrevista} onValueChange={v => handleUpdateAtividade(pLabel, itemIdx, 'etapaPrevista', v)}>
                                  <SelectTrigger className="h-7 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {ETAPAS_PADRAO.map(e => (
                                      <SelectItem key={e} value={e} className="text-xs">{e}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell className="p-2 text-center">
                                <Input type="number" min="1" value={item.quantidade}
                                  onChange={e => handleUpdateAtividade(pLabel, itemIdx, 'quantidade', e.target.value)}
                                  className="h-7 text-xs text-center font-mono font-bold w-full" />
                              </TableCell>
                              <TableCell className="p-2 font-mono text-xs">
                                {Math.floor(item.tempoEstimadoMinutos / 60)}h {item.tempoEstimadoMinutos % 60}m
                              </TableCell>
                              <TableCell className="p-2 font-mono text-xs text-emerald-600">
                                R$ {(item.valorEstimado || 0).toFixed(2)}
                              </TableCell>
                              <TableCell className="p-2 text-right">
                                <Button variant="ghost" size="icon" onClick={() => handleRemoveAtividade(pLabel, itemIdx)}
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                      <span>Ponto {pLabel}: {itemsSelecionados.length} atividades marcadas</span>
                      <div className="flex items-center gap-4 font-mono font-semibold">
                        <span>Tempo: {Math.floor(subtotalMinutos / 60)}h {subtotalMinutos % 60}m</span>
                        <span className="text-emerald-600">R$ {subtotalValor.toFixed(2)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Totais */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { icon: <Layers className="w-4 h-4" />, color: 'text-blue-600 bg-blue-500/10', label: 'Atividades Marcadas', value: `${selectedItemsFlat.length} de ${allPontosListFlat.length}` },
              { icon: <Clock className="w-4 h-4" />, color: 'text-amber-600 bg-amber-500/10', label: 'Tempo Total', value: tempoTotalFormatado },
              { icon: <DollarSign className="w-4 h-4" />, color: 'text-emerald-600 bg-emerald-500/10', label: 'Valor Total Previsto', value: `R$ ${totalValor.toFixed(2)}` },
              { icon: <Target className="w-4 h-4" />, color: `${percentualMeta >= 100 ? 'text-emerald-600 bg-emerald-500/10' : 'text-amber-600 bg-amber-500/10'}`, label: '% Previsto da Meta', value: `${percentualMeta}%` },
            ].map(({ icon, color, label, value }) => (
              <Card key={label} className="bg-card border border-border/60">
                <CardContent className="p-3.5 flex items-center gap-3">
                  <div className={`p-2.5 rounded-lg shrink-0 ${color}`}>{icon}</div>
                  <div>
                    <p className="text-[10px] text-muted-foreground font-medium">{label}</p>
                    <p className={`text-base font-bold font-mono ${color.split(' ')[0]}`}>{value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Envio */}
          <Card className="border border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Send className="w-4 h-4 text-primary" /> Pré-visualização e Envio (Plan_Principal)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 rounded-xl bg-muted/60 border border-border font-mono text-xs text-foreground break-all">
                <span className="text-muted-foreground font-sans text-[11px] block mb-1">Coluna O (formato Prog_TPM):</span>
                {compiledPreview || <span className="text-muted-foreground italic">Nenhuma atividade selecionada...</span>}
              </div>
              <div className="flex items-center justify-between pt-2">
                <div className="text-xs text-muted-foreground">
                  Data: <strong>{dataProgramacaoFormatada}</strong> | Obra: <strong>{obraId}</strong> | Equipe: <strong>{equipe}</strong> | Meta: <strong>R$ {metaEquipeInput.toFixed(2)}</strong> ({percentualMeta}%)
                </div>
                <Button onClick={handleEnviar} disabled={!obra || selectedItemsFlat.length === 0 || salvarProgramacao.isPending} className="gap-2 font-semibold">
                  {salvarProgramacao.isPending ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
                  ) : (
                    <><Send className="w-4 h-4" /> Gravar na Plan_Principal</>
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
