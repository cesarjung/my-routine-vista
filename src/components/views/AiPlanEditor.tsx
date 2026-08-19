import { useState, useMemo, useCallback, useEffect } from 'react';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DatePicker } from '@/components/ui/date-picker';
import { useAlojamentos } from '@/hooks/useAlojamentos';

// --- Helper Haversine ---
function calcDistanceKM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { usePcpPlanejamentoData, inferEtapaFromServico, ETAPAS_PADRAO, formatQuantityDisplay, PcpPontoItem, formatCurrency } from '@/hooks/usePcpPlanejamentoData';
import { PlanoEquipe } from '@/hooks/usePcpAiPlanner';

// ─── PontosMultiSelect (copiado do PcpPlanejamentoView) ───────────────────────
interface PontosMultiSelectProps {
  pontos: string[];
  selected: string[];
  orcamentoPorPontoMap: Map<string, any[]>;
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
  obra: any | null;
  obraId: string;
  unidadeId: string;
  pontosDisponiveis: string[];
  orcamentoPorPontoMap: Map<string, any[]>;
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
  const { servicosBase } = usePcpPlanejamentoData(unidadeId, plano.projeto);

  // ── State ─────────────────────────────────────────────────────────────────
  const [equipe, setEquipe] = useState(plano.equipe || (equipesDisponiveis[0] ?? ''));
  const [supervisor, setSupervisor] = useState(supervisoresDisponiveis[0] ?? 'SUPERVISOR');
  const [selectedEtapas, setSelectedEtapas] = useState<string[]>([]);
  const [isEtapasPopoverOpen, setIsEtapasPopoverOpen] = useState(false);
  const [filtroLv, setFiltroLv] = useState<'COMPLETO' | 'SOMENTE_LV' | 'SEM_LV'>('COMPLETO');

  const { alojamentos } = useAlojamentos();
  const [globalAlojamentoId, setGlobalAlojamentoId] = useState<string>('nenhum');

  const [tempoDeslocamento, setTempoDeslocamento] = useState(30);
  const [tempoSaidaBase, setTempoSaidaBase] = useState(15);
  const [tempoSeguranca, setTempoSeguranca] = useState(15);
  const [metaEquipeInput, setMetaEquipeInput] = useState(4442);

  const [newCustomPontoInput, setNewCustomPontoInput] = useState<{ dayIdx: number, value: string }>({ dayIdx: 0, value: '' });

  // Array of days containing the sequence of points
  const [diasProgramacao, setDiasProgramacao] = useState(() => plano.dias || []);

  // Compute a unique list of all points across all days (for initializing the activities map)
  const pontosIa = useMemo(() => {
    const set = new Set<string>();
    plano.dias?.forEach(dia => dia.pontos?.forEach(p => set.add(p.toUpperCase())));
    return Array.from(set);
  }, [plano]);

  // Monta mapa de atividades pré-preenchidas a partir do orçamento
  const [pontosGroupedMap, setPontosGroupedMap] = useState<Record<string, PcpPontoItem[]>>(() => {
    const map: Record<string, PcpPontoItem[]> = {};
    pontosIa.forEach(pLabel => {
      const orcItems = orcamentoPorPontoMap.get(pLabel) ?? [];
      map[pLabel] = orcItems.map((o, idx) => {
        const qty = o.quantidade ?? 1;
        return {
          id: `${pLabel}-${idx}`,
          ponto: pLabel,
          servico: o.servicoPrevisto ?? '',
          qtdOrcadaPonto: qty,
          etapaPrevista: o.etapaPrevista ?? inferEtapaFromServico(o.servicoPrevisto ?? ''),
          quantidade: qty,
          tempoEstimadoMinutos: o.tempoMinutos ?? 0,
          valorEstimado: o.valorEstimado ?? 0,
          selected: true,
          isBudgeted: true,
        };
      });
      if (map[pLabel].length === 0) {
        const fallback = servicosBase.length > 0 ? servicosBase[0] : { servico: 'SUBSTITUIÇÃO DE POSTE', tempoMinutosPorUnidade: 60, valorPorUnidade: 100 };
        map[pLabel] = [{
          id: `${pLabel}-blank-0`,
          ponto: pLabel,
          servico: fallback.servico,
          qtdOrcadaPonto: 1,
          etapaPrevista: inferEtapaFromServico(fallback.servico),
          quantidade: 1,
          tempoEstimadoMinutos: fallback.tempoMinutosPorUnidade,
          valorEstimado: fallback.valorPorUnidade,
          selected: true,
          isBudgeted: false,
        }];
      }
    });
    return map;
  });
  const filteredServicosBase = useMemo(() => {
    if (filtroLv === 'SOMENTE_LV') return servicosBase.filter(s => s.servico.includes(' LV'));
    if (filtroLv === 'SEM_LV') return servicosBase.filter(s => !s.servico.includes(' LV'));
    return servicosBase;
  }, [servicosBase, filtroLv]);

  const handleGlobalAlojamentoChange = (alojId: string) => {
    setGlobalAlojamentoId(alojId);
    if (alojId !== 'nenhum' && obra?.latitude && obra?.longitude) {
      const aloj = alojamentos.find(a => a.id === alojId);
      if (aloj?.latitude && aloj?.longitude) {
        const distKm = calcDistanceKM(obra.latitude, obra.longitude, aloj.latitude, aloj.longitude);
        setTempoDeslocamento(Math.round(distKm * 1.5)); // avg 40km/h = 1.5 min/km
      }
    }
  };

  const handleDayOverride = (dayIdx: number, field: 'alojamentoId'|'tempoDeslocamentoOverride'|'tempoSaidaBaseOverride'|'tempoSegurancaOverride', value: any) => {
    setDiasProgramacao(prev => {
      const next = [...prev];
      const dia = { ...next[dayIdx] };
      (dia as any)[field] = value;

      if (field === 'alojamentoId') {
        if (value === 'nenhum') {
          dia.tempoDeslocamentoOverride = undefined;
        } else if (obra?.latitude && obra?.longitude) {
          const aloj = alojamentos.find(a => a.id === value);
          if (aloj?.latitude && aloj?.longitude) {
            dia.tempoDeslocamentoOverride = Math.round(calcDistanceKM(obra.latitude, obra.longitude, aloj.latitude, aloj.longitude) * 1.5);
          }
        }
      }
      next[dayIdx] = dia;
      return next;
    });
  };

  useEffect(() => {
    setDiasProgramacao(plano.dias || []);
    
    const newMap: Record<string, PcpPontoItem[]> = {};
    const newPontosIa = new Set<string>();
    plano.dias?.forEach(dia => dia.pontos?.forEach(p => newPontosIa.add(p.toUpperCase())));
    
    Array.from(newPontosIa).forEach(pLabel => {
      const orcItems = orcamentoPorPontoMap.get(pLabel) ?? [];
      newMap[pLabel] = orcItems.map((o, idx) => ({
        id: `${pLabel}-${idx}`,
        ponto: pLabel,
        servico: o.servicoPrevisto ?? '',
        qtdOrcadaPonto: o.quantidade ?? 1,
        etapaPrevista: o.etapaPrevista ?? inferEtapaFromServico(o.servicoPrevisto ?? ''),
        quantidade: 1,
        tempoEstimadoMinutos: o.tempoMinutos ?? 0,
        valorEstimado: o.valorEstimado ?? 0,
        selected: true,
        isBudgeted: true,
      }));
      // Se não há atividades no orçamento, cria uma linha em branco
      if (newMap[pLabel].length === 0) {
        const fallback = servicosBase.length > 0 ? servicosBase[0] : { servico: 'SUBSTITUIÇÃO DE POSTE', tempoMinutosPorUnidade: 60, valorPorUnidade: 100 };
        newMap[pLabel] = [{
          id: `${pLabel}-blank-0`,
          ponto: pLabel,
          servico: fallback.servico,
          qtdOrcadaPonto: 1,
          etapaPrevista: inferEtapaFromServico(fallback.servico),
          quantidade: 1,
          tempoEstimadoMinutos: fallback.tempoMinutosPorUnidade,
          valorEstimado: fallback.valorPorUnidade,
          selected: true,
          isBudgeted: false,
        }];
      }
    });
    setPontosGroupedMap(newMap);
  }, [plano, orcamentoPorPontoMap]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleTogglePontoDia = (dayIdx: number, pLabel: string) => {
    const upper = pLabel.toUpperCase().trim();
    setDiasProgramacao(prev => {
      const next = [...prev];
      const dia = next[dayIdx];
      if (dia.pontos.includes(upper)) {
        dia.pontos = dia.pontos.filter(p => p !== upper);
      } else {
        dia.pontos = [...dia.pontos, upper];
      }
      return next;
    });
  };

  const handleSelectAllPontosDia = (dayIdx: number) => {
    setDiasProgramacao(prev => {
      const next = [...prev];
      next[dayIdx].pontos = [...pontosDisponiveis];
      return next;
    });
  };

  const handleDeselectAllPontosDia = (dayIdx: number) => {
    setDiasProgramacao(prev => {
      const next = [...prev];
      next[dayIdx].pontos = [];
      return next;
    });
  };

  const handleAddCustomPontoLabel = (dayIdx: number) => {
    const inputStr = newCustomPontoInput.dayIdx === dayIdx ? newCustomPontoInput.value : '';
    if (!inputStr.trim()) return;
    const clean = inputStr.toUpperCase().trim();
    
    setDiasProgramacao(prev => {
      const next = [...prev];
      if (!next[dayIdx].pontos.includes(clean)) {
        next[dayIdx].pontos = [...next[dayIdx].pontos, clean];
      }
      return next;
    });

    // Adiciona linha vazia no mapa se não existir
      if (!pontosGroupedMap[clean]) {
        const fallback = servicosBase.length > 0 ? servicosBase[0] : { servico: 'SUBSTITUIÇÃO DE POSTE', tempoMinutosPorUnidade: 60, valorPorUnidade: 100 };
        setPontosGroupedMap(prev => ({
          ...prev,
          [clean]: [{
            id: `${clean}-blank-0`,
            ponto: clean,
            servico: fallback.servico,
            qtdOrcadaPonto: 1,
            etapaPrevista: inferEtapaFromServico(fallback.servico),
            quantidade: 1,
            tempoEstimadoMinutos: fallback.tempoMinutosPorUnidade,
            valorEstimado: fallback.valorPorUnidade,
            selected: true,
            isBudgeted: false,
          }]
        }));
      }
    
    setNewCustomPontoInput({ dayIdx: 0, value: '' });
  };

  const handleAddAtividadeNoPonto = (pontoLabelTarget: string) => {
    const existing = pontosGroupedMap[pontoLabelTarget] || [];
    const existingServicos = new Set(existing.map(i => i.servico));
    const fallback = servicosBase.length > 0 ? servicosBase[0] : { servico: 'SUBSTITUIÇÃO DE POSTE', tempoMinutosPorUnidade: 60, valorPorUnidade: 100 };
    const next = servicosBase.find(s => !existingServicos.has(s.servico)) || fallback;
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
        const found = servicosBase.find(s => s.servico === value);
        target.servico = value;
        target.etapaPrevista = inferEtapaFromServico(value);
        if (found) {
          target.tempoEstimadoMinutos = Math.round(found.tempoMinutosPorUnidade * target.quantidade);
          target.valorEstimado = found.valorPorUnidade * target.quantidade;
        }
      } else if (field === 'quantidade') {
        const qty = Math.max(1, Math.round(Number(value) || 1));
        const fallback = servicosBase.length > 0 ? servicosBase[0] : { servico: target.servico, tempoMinutosPorUnidade: 60, valorPorUnidade: 100 };
        const found = servicosBase.find(s => s.servico === target.servico) || fallback;
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
    const seen = new Set<string>();
    diasProgramacao.forEach(dia => {
      dia.pontos.forEach(p => {
        if (!seen.has(p)) {
          seen.add(p);
          list.push(...(pontosGroupedMap[p] || []));
        }
      });
    });
    return list;
  }, [diasProgramacao, pontosGroupedMap]);

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

  const postesProgramados = useMemo(() =>
    selectedItemsFlat.filter(i => (i.servico || '').toUpperCase().includes('POSTE'))
      .reduce((acc, i) => acc + (i.quantidade || 0), 0), [selectedItemsFlat]);

  const saldoPostes = obra ? obra.qtdPostesDisponiveis - postesProgramados : 0;

  // ── Submit ─────────────────────────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleEnviar = async () => {
    if (!obra) { alert('Obra não encontrada.'); return; }
    if (selectedItemsFlat.length === 0) { alert('Selecione ao menos uma atividade na semana.'); return; }

    setIsSubmitting(true);
    try {
      // Para cada dia programado, envia as atividades correspondentes àquele dia
      for (const dia of diasProgramacao) {
        const pontosDoDia = dia.pontos;
        if (pontosDoDia.length === 0) continue;

        const itemsDoDia: PcpPontoItem[] = [];
        pontosDoDia.forEach(p => {
          const acts = pontosGroupedMap[p] || [];
          itemsDoDia.push(...acts.filter(a => a.selected));
        });

        if (itemsDoDia.length === 0) continue;

        // Parse a data que vem no formato "18/08/2026"
        const [day, month, year] = dia.data.split('/');
        const dateObj = new Date(Number(year), Number(month) - 1, Number(day));

        // Determina a etapa geral para este dia pegando a primeira etapa
        const etapaDia = itemsDoDia[0]?.etapaPrevista || selectedEtapas.join(', ');

        await salvarProgramacao.mutateAsync({
          unidadeId,
          dataProgramacao: dia.data,
          dateObj: dateObj,
          supervisor,
          equipe,
          etapa: etapaDia,
          obra,
          pontos: itemsDoDia,
          tempoDeslocamentoMinutos: tempoDeslocamento,
          tempoSaidaBaseMinutos: tempoSaidaBase,
          tempoSegurancaMinutos: tempoSeguranca,
          metaEquipeValor: metaEquipeInput,
        });
      }
      alert('Programação semanal salva com sucesso na Plan_Principal!');
    } catch (error) {
      console.error('Erro ao salvar programação semanal:', error);
      alert('Ocorreu um erro ao salvar um dos dias da programação. Verifique o console.');
    } finally {
      setIsSubmitting(false);
    }
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
              {/* GLOBAL ALOJAMENTO */}
              <div className="flex flex-col gap-1.5 border-b border-border/80 pb-3">
                <Label className="text-[11px] text-muted-foreground font-semibold flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-rose-500" /> Alojamento / Base de Referência
                </Label>
                <Select value={globalAlojamentoId} onValueChange={handleGlobalAlojamentoChange}>
                  <SelectTrigger className="h-8 text-xs font-medium">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[250px]">
                    <SelectItem value="nenhum" className="text-xs">Nenhum / Manual</SelectItem>
                    {alojamentos.map(a => (
                      <SelectItem key={a.id} value={a.id} className="text-xs">{a.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

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

          {/* Card Resumo Semanal da Equipe */}
          <Card className="border border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-semibold flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-primary" /> Resumo da Semana ({equipe})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {(() => {
                const totalDias = diasProgramacao.length;
                const totalMetaSemana = metaEquipeInput * totalDias;
                let totalTempoSemana = 0;
                let totalValorSemana = 0;

                diasProgramacao.forEach(dia => {
                  const itemsSelecionadosDia = dia.pontos.flatMap(p => (pontosGroupedMap[p] || []).filter(i => i.selected));
                  const tempoAtiv = itemsSelecionadosDia.reduce((acc, i) => acc + (i.tempoEstimadoMinutos || 0), 0);
                  
                  const dDesloc = dia.tempoDeslocamentoOverride ?? tempoDeslocamento;
                  const dSaida = dia.tempoSaidaBaseOverride ?? tempoSaidaBase;
                  const dSeg = dia.tempoSegurancaOverride ?? tempoSeguranca;
                  
                  if (tempoAtiv > 0) {
                    totalTempoSemana += tempoAtiv + dDesloc + dSaida + dSeg;
                  }
                  totalValorSemana += itemsSelecionadosDia.reduce((acc, i) => acc + (i.valorEstimado || 0), 0);
                });

                const percSemana = totalMetaSemana > 0 ? (totalValorSemana / totalMetaSemana) * 100 : 0;

                return (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[10px] p-2">Dia</TableHead>
                        <TableHead className="text-[10px] p-2">Equipe</TableHead>
                        <TableHead className="text-[10px] p-2">Tempo</TableHead>
                        <TableHead className="text-[10px] p-2 text-right">V. Meta</TableHead>
                        <TableHead className="text-[10px] p-2 text-right">V. Planejado</TableHead>
                        <TableHead className="text-[10px] p-2 text-right">% Meta</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {diasProgramacao.map((dia, idx) => {
                        const itemsSelecionadosDia = dia.pontos.flatMap(p => (pontosGroupedMap[p] || []).filter(i => i.selected));
                        const tempoAtiv = itemsSelecionadosDia.reduce((acc, i) => acc + (i.tempoEstimadoMinutos || 0), 0);
                        
                        const dDesloc = dia.tempoDeslocamentoOverride ?? tempoDeslocamento;
                        const dSaida = dia.tempoSaidaBaseOverride ?? tempoSaidaBase;
                        const dSeg = dia.tempoSegurancaOverride ?? tempoSeguranca;
                        
                        const tempoDia = tempoAtiv > 0 ? tempoAtiv + dDesloc + dSaida + dSeg : 0;
                        const valorDia = itemsSelecionadosDia.reduce((acc, i) => acc + (i.valorEstimado || 0), 0);
                        const percDia = metaEquipeInput > 0 ? (valorDia / metaEquipeInput) * 100 : 0;
                        
                        return (
                          <TableRow key={idx}>
                            <TableCell className="p-2 text-[11px] font-medium">{dia.data.substring(0,5)}<br/><span className="text-[9px] text-muted-foreground">{dia.diaSemana.split('-')[0]}</span></TableCell>
                            <TableCell className="p-2 text-[11px] font-medium text-primary">{equipe}</TableCell>
                            <TableCell className={`p-2 text-[11px] font-mono ${tempoDia > 540 ? 'text-red-500 font-bold' : ''}`}>
                              {Math.floor(tempoDia/60)}h {Math.floor(tempoDia%60)}m
                              {tempoDia > 540 && <span className="text-[9px] ml-1">(Excede 9h)</span>}
                            </TableCell>
                            <TableCell className="p-2 text-[11px] text-right text-muted-foreground font-mono">R$ {metaEquipeInput.toFixed(2)}</TableCell>
                            <TableCell className="p-2 text-[11px] text-right text-emerald-600 font-mono font-semibold">R$ {valorDia.toFixed(2)}</TableCell>
                            <TableCell className="p-2 text-[11px] text-right font-mono font-bold">
                              <span className={percDia >= 100 ? "text-emerald-600" : percDia >= 75 ? "text-amber-600" : "text-rose-600"}>
                                {percDia.toFixed(1)}%
                              </span>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {diasProgramacao.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-xs text-muted-foreground p-4">
                            Nenhum dia programado.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                    {diasProgramacao.length > 0 && (
                      <TableFooter className="bg-muted/50 border-t">
                        <TableRow>
                          <TableCell colSpan={2} className="p-2 text-[10px] font-bold">TOTAL</TableCell>
                          <TableCell className="p-2 text-[11px] font-mono font-bold">{Math.floor(totalTempoSemana/60)}h {Math.floor(totalTempoSemana%60)}m</TableCell>
                          <TableCell className="p-2 text-[11px] text-right text-muted-foreground font-mono font-bold">R$ {totalMetaSemana.toFixed(2)}</TableCell>
                          <TableCell className="p-2 text-[11px] text-right text-emerald-600 font-mono font-bold">R$ {totalValorSemana.toFixed(2)}</TableCell>
                          <TableCell className="p-2 text-[11px] text-right font-mono font-bold">
                            <span className={percSemana >= 100 ? "text-emerald-600" : percSemana >= 75 ? "text-amber-600" : "text-rose-600"}>
                              {percSemana.toFixed(1)}%
                            </span>
                          </TableCell>
                        </TableRow>
                      </TableFooter>
                    )}
                  </Table>
                );
              })()}
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
            </div>
            ) : (
              <div className="p-4 text-center text-muted-foreground italic border border-dashed rounded-xl border-border bg-muted/20">
                Obra não encontrada ou não selecionada.
              </div>
            )}

            {/* FILTRO LV */}
            <div className="flex items-center justify-between gap-4 bg-muted/20 p-2 rounded-xl border border-border mt-4">
              <span className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                <Filter className="w-3.5 h-3.5" /> Exibir Serviços (Filtro LV):
              </span>
              <div className="w-[180px]">
                <Select value={filtroLv} onValueChange={(v: any) => setFiltroLv(v)}>
                  <SelectTrigger className="h-8 text-[11px] font-medium bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="COMPLETO" className="text-[11px]">Todas as Atividades</SelectItem>
                    <SelectItem value="SOMENTE_LV" className="text-[11px]">Somente LV</SelectItem>
                    <SelectItem value="SEM_LV" className="text-[11px]">Sem LV</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Sequência Diária de Pontos e Atividades */}
            <div className="flex flex-col gap-5 pt-2">
                {diasProgramacao.map((dia, dayIdx) => {
                  const itemsSelecionadosDia = dia.pontos.flatMap(p => (pontosGroupedMap[p] || []).filter(i => i.selected));
                  const tempoAtiv = itemsSelecionadosDia.reduce((acc, i) => acc + (i.tempoEstimadoMinutos || 0), 0);
                  
                  const dDesloc = dia.tempoDeslocamentoOverride ?? tempoDeslocamento;
                  const dSaida = dia.tempoSaidaBaseOverride ?? tempoSaidaBase;
                  const dSeg = dia.tempoSegurancaOverride ?? tempoSeguranca;
                  
                  const tempoDia = tempoAtiv + dDesloc + dSaida + dSeg;
                  const valorDia = itemsSelecionadosDia.reduce((acc, i) => acc + (i.valorEstimado || 0), 0);

                  return (
                    <div key={dayIdx} className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
                      <div className="bg-muted/30 border-b border-border p-4 flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CalendarIcon className="w-4 h-4 text-primary" />
                            <h3 className="font-bold text-sm text-foreground">{dia.data} — {dia.diaSemana}</h3>
                          </div>
                          <div className="flex items-center gap-4 text-xs font-mono">
                            <span className="text-muted-foreground">Tempo Total: <strong className={tempoDia > 540 ? "text-rose-600" : ""}>{Math.floor(tempoDia/60)}h {tempoDia%60}m</strong></span>
                            <span className="text-emerald-600 font-bold">R$ {valorDia.toFixed(2)}</span>
                          </div>
                        </div>

                        {/* DIA OVERRIDES */}
                        <div className="bg-background border border-border/60 rounded-lg p-2.5 flex flex-col gap-2 shadow-xs">
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            <div className="flex-1 w-full sm:w-auto">
                              <Label className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1 mb-1">
                                <MapPin className="w-3 h-3 text-rose-500" /> Alojamento Local do Dia
                              </Label>
                              <Select value={dia.alojamentoId || 'nenhum'} onValueChange={v => handleDayOverride(dayIdx, 'alojamentoId', v)}>
                                <SelectTrigger className="h-7 text-[11px]">
                                  <SelectValue placeholder="Usar Global" />
                                </SelectTrigger>
                                <SelectContent className="max-h-[200px]">
                                  <SelectItem value="nenhum" className="text-[11px]">Usar Global / Padrão</SelectItem>
                                  {alojamentos.map(a => (
                                    <SelectItem key={a.id} value={a.id} className="text-[11px]">{a.nome}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <div className="flex flex-col gap-1 w-[90px]">
                                <Label className="text-[10px] text-muted-foreground flex items-center gap-1"><Navigation className="w-2.5 h-2.5 text-blue-500"/> Desl. (m)</Label>
                                <Input type="number" min="0" className="h-7 text-[11px] font-mono px-2"
                                  placeholder={String(tempoDeslocamento)}
                                  value={dia.tempoDeslocamentoOverride ?? ''}
                                  onChange={e => handleDayOverride(dayIdx, 'tempoDeslocamentoOverride', e.target.value === '' ? undefined : Number(e.target.value))} />
                              </div>
                              <div className="flex flex-col gap-1 w-[90px]">
                                <Label className="text-[10px] text-muted-foreground flex items-center gap-1"><LogOut className="w-2.5 h-2.5 text-amber-500"/> Saída (m)</Label>
                                <Input type="number" min="0" className="h-7 text-[11px] font-mono px-2"
                                  placeholder={String(tempoSaidaBase)}
                                  value={dia.tempoSaidaBaseOverride ?? ''}
                                  onChange={e => handleDayOverride(dayIdx, 'tempoSaidaBaseOverride', e.target.value === '' ? undefined : Number(e.target.value))} />
                              </div>
                              <div className="flex flex-col gap-1 w-[90px]">
                                <Label className="text-[10px] text-muted-foreground flex items-center gap-1"><ShieldCheck className="w-2.5 h-2.5 text-emerald-500"/> Seg. (m)</Label>
                                <Input type="number" min="0" className="h-7 text-[11px] font-mono px-2"
                                  placeholder={String(tempoSeguranca)}
                                  value={dia.tempoSegurancaOverride ?? ''}
                                  onChange={e => handleDayOverride(dayIdx, 'tempoSegurancaOverride', e.target.value === '' ? undefined : Number(e.target.value))} />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Seleção de Pontos para este Dia */}
                        <div className="flex items-center justify-between gap-2 flex-wrap bg-background p-2 rounded-lg border border-border">
                          <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                            <PackageCheck className="w-4 h-4" /> Pontos deste dia:
                          </span>
                          <div className="flex items-center gap-2 flex-1 justify-end flex-wrap">
                            <PontosMultiSelect
                              pontos={pontosDisponiveis.length > 0 ? pontosDisponiveis : pontosIa}
                              selected={dia.pontos}
                              orcamentoPorPontoMap={orcamentoPorPontoMap}
                              onToggle={(p) => handleTogglePontoDia(dayIdx, p)}
                              onSelectAll={() => handleSelectAllPontosDia(dayIdx)}
                              onDeselectAll={() => handleDeselectAllPontosDia(dayIdx)}
                            />
                            <div className="flex items-center gap-1">
                              <Input placeholder="Ponto extra..." value={newCustomPontoInput.dayIdx === dayIdx ? newCustomPontoInput.value : ''}
                                onChange={e => setNewCustomPontoInput({ dayIdx, value: e.target.value })}
                                onKeyDown={e => e.key === 'Enter' && handleAddCustomPontoLabel(dayIdx)}
                                className="h-8 text-xs w-[120px] font-mono" />
                              <Button size="sm" variant="outline" onClick={() => handleAddCustomPontoLabel(dayIdx)} className="h-8 text-xs px-2.5">
                                <Plus className="w-3.5 h-3.5 mr-1" /> Add
                              </Button>
                            </div>
                          </div>
                        </div>
                        
                        {/* Badges dos pontos do dia */}
                        {dia.pontos.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {dia.pontos.map(p => (
                              <Badge key={p} variant="secondary"
                                className="font-mono text-[11px] px-2 py-0.5 cursor-pointer hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => handleTogglePontoDia(dayIdx, p)}>
                                {p} ✕
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Atividades dos pontos do dia */}
                      <div className="p-4 flex flex-col gap-4 bg-background">
                        {dia.pontos.length === 0 ? (
                           <div className="text-center py-4 text-muted-foreground text-xs italic border border-dashed border-border rounded-xl">
                             Nenhum ponto alocado para este dia.
                           </div>
                        ) : dia.pontos.map(pLabel => {
                          const itemsDoPonto = pontosGroupedMap[pLabel] || [];
                          const itemsSelecionados = itemsDoPonto.filter(i => i.selected);
                          const subtotalMinutos = itemsSelecionados.reduce((acc, i) => acc + (i.tempoEstimadoMinutos || 0), 0);
                          const subtotalValor = itemsSelecionados.reduce((acc, i) => acc + (i.valorEstimado || 0), 0);
            
                          return (
                            <div key={pLabel} className="border border-border/60 rounded-xl overflow-hidden shadow-xs">
                              <div className="bg-muted/10 p-2 flex flex-row items-center justify-between border-b border-border/60">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h4 className="text-xs font-bold font-mono text-primary flex items-center gap-1.5">
                                      <Layers className="w-3.5 h-3.5" /> PONTO {pLabel}
                                    </h4>
                                    <Badge variant="outline" className="text-[10px] font-mono">
                                      {itemsDoPonto.length} ativ.
                                    </Badge>
                                  </div>
                                </div>
                                <Button size="sm" variant="secondary" onClick={() => handleAddAtividadeNoPonto(pLabel)} className="h-7 gap-1 text-[10px] font-semibold">
                                  <Plus className="w-3 h-3" /> Adicionar
                                </Button>
                              </div>
            
                              <div className="p-2 space-y-2">
                                <div className="rounded-lg border border-border/60 overflow-hidden">
                                  <Table>
                                    <TableHeader>
                                      <TableRow className="bg-muted/30 text-[10px] [&>th]:h-8 [&>th]:px-2">
                                        <TableHead className="w-[32px] text-center">
                                          <Checkbox
                                            checked={itemsDoPonto.length > 0 && itemsDoPonto.every(i => i.selected)}
                                            onCheckedChange={c => {
                                              const val = Boolean(c);
                                              setPontosGroupedMap(prev => ({ ...prev, [pLabel]: (prev[pLabel] || []).map(item => ({ ...item, selected: val })) }));
                                            }}
                                          />
                                        </TableHead>
                                        <TableHead>Atividade / Serviço</TableHead>
                                        <TableHead className="w-[70px] text-center">Qtd Prev.</TableHead>
                                        <TableHead className="w-[120px]">Etapa</TableHead>
                                        <TableHead className="w-[70px] text-center">Qtd Prog.</TableHead>
                                        <TableHead className="w-[85px]">Tempo</TableHead>
                                        <TableHead className="w-[90px]">Valor</TableHead>
                                        <TableHead className="w-[32px]" />
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody className="text-[11px]">
                                      {itemsDoPonto.length === 0 ? (
                                        <TableRow>
                                          <TableCell colSpan={8} className="text-center py-4 text-muted-foreground text-[10px]">
                                            Adicione atividades...
                                          </TableCell>
                                        </TableRow>
                                      ) : itemsDoPonto.map((item, itemIdx) => (
                                        <TableRow key={item.id || itemIdx} className={`hover:bg-accent/30 transition-colors [&>td]:p-1.5 ${!item.selected ? 'bg-muted/5 text-muted-foreground' : 'bg-background'}`}>
                                          <TableCell className="text-center">
                                            <Checkbox checked={item.selected} onCheckedChange={c => handleUpdateAtividade(pLabel, itemIdx, 'selected', Boolean(c))} />
                                          </TableCell>
                                          <TableCell>
                                            {item.isBudgeted ? (
                                              <span className="font-semibold text-foreground">{item.servico}</span>
                                            ) : (
                                              <Select value={item.servico} onValueChange={v => handleUpdateAtividade(pLabel, itemIdx, 'servico', v)}>
                                                <SelectTrigger className="h-6 text-[10px] font-semibold border-dashed">
                                                  <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="max-h-[200px]">
                                                  {filteredServicosBase.map(s => (
                                                    <SelectItem key={s.servico} value={s.servico} className="text-[10px]">{s.servico}</SelectItem>
                                                  ))}
                                                </SelectContent>
                                              </Select>
                                            )}
                                          </TableCell>
                                          <TableCell className="text-center">
                                            <Input type="number" min="0" value={item.qtdOrcadaPonto}
                                              onChange={e => handleUpdateAtividade(pLabel, itemIdx, 'qtdOrcadaPonto', e.target.value)}
                                              className="h-6 text-[10px] text-center font-mono w-full px-1" />
                                          </TableCell>
                                          <TableCell>
                                            <Select value={item.etapaPrevista} onValueChange={v => handleUpdateAtividade(pLabel, itemIdx, 'etapaPrevista', v)}>
                                              <SelectTrigger className="h-6 text-[10px] px-2">
                                                <SelectValue />
                                              </SelectTrigger>
                                              <SelectContent>
                                                {ETAPAS_PADRAO.map(e => (
                                                  <SelectItem key={e} value={e} className="text-[10px]">{e}</SelectItem>
                                                ))}
                                              </SelectContent>
                                            </Select>
                                          </TableCell>
                                          <TableCell className="text-center">
                                            <Input type="number" min="1" value={item.quantidade}
                                              onChange={e => handleUpdateAtividade(pLabel, itemIdx, 'quantidade', e.target.value)}
                                              className="h-6 text-[10px] text-center font-mono font-bold w-full px-1" />
                                          </TableCell>
                                          <TableCell className="font-mono">
                                            {Math.floor(item.tempoEstimadoMinutos / 60)}h {item.tempoEstimadoMinutos % 60}m
                                          </TableCell>
                                          <TableCell className="font-mono text-emerald-600">
                                            R$ {(item.valorEstimado || 0).toFixed(2)}
                                          </TableCell>
                                          <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" onClick={() => handleRemoveAtividade(pLabel, itemIdx)}
                                              className="h-6 w-6 text-muted-foreground hover:text-destructive">
                                              <Trash2 className="w-3 h-3" />
                                            </Button>
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                                <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1">
                                  <span>{itemsSelecionados.length} atividades</span>
                                  <div className="flex items-center gap-3 font-mono font-semibold">
                                    <span>{Math.floor(subtotalMinutos / 60)}h {subtotalMinutos % 60}m</span>
                                    <span className="text-emerald-600">R$ {subtotalValor.toFixed(2)}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
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
                  Semana: <strong>{plano.semana}</strong> | Obra: <strong>{obraId}</strong> | Equipe: <strong>{equipe}</strong> | Meta: <strong>R$ {metaEquipeInput.toFixed(2)}</strong> ({percentualMeta}%)
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
