import React, { useState, useMemo } from 'react';
import { useMateriaisData, getProximoDiaUtil } from '@/hooks/useMateriaisData';
import { useSessionState } from '@/hooks/useSessionState';
import { useSyncPlanejamento } from '@/hooks/usePlanejamentoRaw';
import { format, parse, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FilterSelect } from '@/components/ui/filter-select';
import { 
  RefreshCw, Filter, Calendar, Download, Printer, 
  AlertTriangle, ClipboardList, Info, CheckCircle2, 
  HelpCircle, Search, FileText, Layers, Loader2, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UNIDADES_PLANEJAMENTO } from '@/constants/unidades';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PlanejamentoFaltasDashboard } from './PlanejamentoFaltasDashboard';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { downloadCSV } from '@/utils/csvExport';

const formatQtd = (val: number) => {
  if (val === undefined || val === null) return '';
  return val % 1 === 0 ? String(val) : Number(val.toFixed(1)).toString().replace('.', ',');
};

const getGrupoColorClasses = (grupo: string) => {
  const norm = String(grupo).trim().toUpperCase();
  switch (norm) {
    case 'IMPLANTACAO':
    case 'IMPLANTAÇÃO':
      return 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950/20 dark:text-blue-300 dark:border-blue-900';
    case 'LANCAMENTO DE CABO':
    case 'LANÇAMENTO DE CABO':
      return 'bg-purple-50 text-purple-700 border-purple-100 dark:bg-purple-950/20 dark:text-purple-300 dark:border-purple-900';
    case 'EQUIPAMENTO':
      return 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/20 dark:text-amber-300 dark:border-amber-900';
    case 'ESTRUTURA':
      return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800';
    default:
      return 'bg-slate-50 text-slate-600 border-slate-100 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800';
  }
};

export const PlanejamentoMateriaisView = () => {
  // Filtro de Unidades
  const [selectedUnidades, setSelectedUnidades] = useSessionState<string[]>('filter_unidades_materiais', []);

  const defaultDate = useMemo(() => format(getProximoDiaUtil(), 'yyyy-MM-dd'), []);

  // Filtros principais
  const [filterStart, setFilterStart] = useSessionState<string>('filter_start_materiais', defaultDate);
  const [filterEnd, setFilterEnd] = useSessionState<string>('filter_end_materiais', defaultDate);
  const [selectedMonths, setSelectedMonths] = useSessionState<string[]>('filter_months_materiais', []);
  
  const [selectedSupervisores, setSelectedSupervisores] = useSessionState<string[]>('filter_supervisores_materiais', []);
  const [selectedEquipes, setSelectedEquipes] = useSessionState<string[]>('filter_equipes_materiais', []);
  const [selectedMunicipios, setSelectedMunicipios] = useSessionState<string[]>('filter_municipios_materiais', []);
  
  const [selectedObras, setSelectedObras] = useSessionState<string[]>('filter_obras_materiais', []);
  
  // Abas de visualização
  const [activeMainTab, setActiveMainTab] = useState<'separacao' | 'faltas'>('separacao');

  // Estado para modal de detalhes dos KPIs (Separação)
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

  const handleOpenProgramacoesModal = () => {
    const headers = ['Data', 'Equipe', 'Supervisor', 'Município', 'Obra', 'Pontos', 'Descrição Atividades', 'Valor Planejado'];
    const rows = filteredProgramacoes.map(p => [
      p.dataString,
      p.equipe,
      p.supervisor,
      p.municipio,
      p.obra,
      p.pontosRaw,
      p.descricaoAtividades,
      new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.valorPlanejado || 0)
    ]);
    setKpiModal({
      isOpen: true,
      title: 'Programações Selecionadas',
      description: 'Lista completa de programações de barreiras no período e filtros ativos.',
      headers,
      rows
    });
  };

  const handleOpenPontosModal = () => {
    const headers = ['Obra', 'Ponto', 'Equipe', 'Supervisor', 'Município'];
    const rows: string[][] = [];
    const seen = new Set<string>();
    filteredProgramacoes.forEach(p => {
      p.pontosList.forEach(pt => {
        const key = `${p.obra}_${pt}`;
        if (!seen.has(key)) {
          seen.add(key);
          rows.push([p.obra, pt, p.equipe, p.supervisor, p.municipio]);
        }
      });
    });
    setKpiModal({
      isOpen: true,
      title: 'Pontos de Planejamento',
      description: 'Relação de todos os pontos programados sob os filtros atuais.',
      headers,
      rows
    });
  };

  const handleOpenItensModal = () => {
    const headers = ['Código', 'Descrição', 'Unidade', 'Quantidade Total', 'Estoque', 'Saldo', 'Status', 'Grupo Traduzido'];
    const rows = consolidadoList.map(item => [
      item.codigo,
      item.descricao,
      item.unidade,
      item.quantidadeTotal,
      item.estoque,
      item.saldo,
      item.saldo < 0 ? 'Em falta' : 'Disponível',
      item.grupoTraduzido
    ]);
    setKpiModal({
      isOpen: true,
      title: 'Itens Únicos Liberados',
      description: 'Resumo consolidado dos materiais que possuem regras liberadas no período.',
      headers,
      rows
    });
  };

  const handleOpenQtdModal = () => {
    const headers = ['Código', 'Descrição', 'Unidade', 'Obra', 'Ponto', 'Quantidade Necessária', 'Equipe', 'Status'];
    const rows: (string | number)[][] = [];
    filteredProgramacoes.forEach(p => {
      p.materiais.forEach(m => {
        if (!m.liberado) return;
        rows.push([
          m.codigo,
          m.descricao,
          m.unidade,
          p.obra,
          m.pontoObra,
          m.quantidade,
          p.equipe,
          m.saldo < 0 ? 'Em falta' : 'Disponível'
        ]);
      });
    });
    setKpiModal({
      isOpen: true,
      title: 'Quantidades Detalhadas por Ponto',
      description: 'Detalhamento item a item a ser separado para cada ponto de obra.',
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
  const [viewTab, setViewTab] = useState<'consolidada' | 'detalhada'>('consolidada');
  const [detalhadaMode, setDetalhadaMode] = useState<'equipe' | 'geral'>('equipe');
  // Termo de pesquisa para os materiais
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMateriais, setSelectedMateriais] = useSessionState<string[]>('filter_materiais_selecionados', []);
  const [showPontosSemOrcamentoDetails, setShowPontosSemOrcamentoDetails] = useState(false);

  // Filtros de cabeçalho da Visão Consolidada
  const [colFilterCodigo, setColFilterCodigo] = useState<string[]>([]);
  const [colFilterDescricao, setColFilterDescricao] = useState<string[]>([]);
  const [colFilterUnidade, setColFilterUnidade] = useState<string[]>([]);
  const [colFilterGrupo, setColFilterGrupo] = useState<string[]>([]);
  const [colFilterEquipes, setColFilterEquipes] = useState<string[]>([]);
  const [colFilterOrigem, setColFilterOrigem] = useState<string[]>([]);
  
  // Filtro de Status Global (Separação)
  const [globalStatusFilter, setGlobalStatusFilter] = useState<'todos' | 'disponivel' | 'falta'>('todos');

  // Filtros de cabeçalho do Detalhamento por Ponto
  const [colFilterPonto, setColFilterPonto] = useState<string[]>([]);
  const [colFilterDetalhadaCodigo, setColFilterDetalhadaCodigo] = useState<string[]>([]);
  const [colFilterDetalhadaDescricao, setColFilterDetalhadaDescricao] = useState<string[]>([]);
  const [colFilterDetalhadaUnidade, setColFilterDetalhadaUnidade] = useState<string[]>([]);
  const [colFilterDetalhadaGrupo, setColFilterDetalhadaGrupo] = useState<string[]>([]);
  const [colFilterDetalhadaEquipe, setColFilterDetalhadaEquipe] = useState<string[]>([]);

  const activeUnits = selectedUnidades.length === 0 
    ? UNIDADES_PLANEJAMENTO.map(u => u.id)
    : selectedUnidades;

  // Busca dados de materiais
  const { data, isLoading } = useMateriaisData(activeUnits, {
    filterStart,
    filterEnd,
    selectedMonths
  });

  const { mutate: syncPlanejamento, isPending: isSyncing } = useSyncPlanejamento();

  // Filtra as programações com base nos filtros de múltipla seleção
  const filteredProgramacoes = useMemo(() => {
    if (!data?.programacoes) return [];
    return data.programacoes.filter(prog => {
      // Filtro por Equipe (Multi-seleção)
      if (selectedEquipes.length > 0 && !selectedEquipes.includes(prog.equipe)) return false;
      // Filtro por Supervisor (Multi-seleção)
      if (selectedSupervisores.length > 0 && !selectedSupervisores.includes(prog.supervisor)) return false;
      // Filtro por Município (Multi-seleção)
      if (selectedMunicipios.length > 0 && !selectedMunicipios.includes(prog.municipio)) return false;
      // Filtro por Obra (Multi-seleção)
      if (selectedObras.length > 0 && !selectedObras.includes(prog.obra)) return false;
      return true;
    });
  }, [data?.programacoes, selectedEquipes, selectedSupervisores, selectedMunicipios, selectedObras]);

  // Recalcula a consolidação apenas para as programações filtradas
  const consolidadoList = useMemo(() => {
    const consolidatedMap = new Map<string, ConsolidatedMaterial>();
    
    filteredProgramacoes.forEach(prog => {
      prog.materiais.forEach(m => {
        if (!m.liberado) return; // Só consolida o que está liberado

        const key = m.codigo;
        if (!consolidatedMap.has(key)) {
          const hookCons = data?.consolidado?.find(c => c.codigo === key);
          const estoque = hookCons ? hookCons.estoque : 0;

          consolidatedMap.set(key, {
            codigo: m.codigo,
            descricao: m.descricao,
            unidade: m.unidade,
            quantidadeTotal: 0,
            qtdJaFornecidaTotal: 0,
            qtdASepararTotal: 0,
            pontosOrigem: [],
            grupoTraduzido: m.grupoTraduzido,
            equipes: [],
            estoque,
            saldo: estoque,
            disponivel: false
          });
        }

        const cons = consolidatedMap.get(key)!;
        cons.quantidadeTotal += m.quantidade;
        cons.qtdJaFornecidaTotal = (cons.qtdJaFornecidaTotal || 0) + (m.qtdJaFornecida || 0);
        cons.qtdASepararTotal = (cons.qtdASepararTotal || 0) + (m.qtdASeparar || 0);
        
        // Rastreia equipe
        if (prog.equipe && !cons.equipes.includes(prog.equipe)) {
          cons.equipes.push(prog.equipe);
        }
        
        const origExistente = cons.pontosOrigem.find(p => p.ponto === m.pontoObra && p.obra === prog.obra);
        if (origExistente) {
          origExistente.qtd += m.quantidade;
        } else {
          cons.pontosOrigem.push({
            ponto: m.pontoObra,
            obra: prog.obra,
            qtd: m.quantidade
          });
        }
      });
    });

    // Atualiza o saldo consolidado deduzindo a quantidade necessária
    consolidatedMap.forEach(cons => {
      cons.saldo = cons.estoque - cons.quantidadeTotal;
      cons.disponivel = (cons.qtdJaFornecidaTotal || 0) + cons.estoque >= cons.quantidadeTotal;
    });

    return Array.from(consolidatedMap.values()).sort((a, b) => a.descricao.localeCompare(b.descricao));
  }, [filteredProgramacoes, data?.consolidado]);

  // Lista de materiais cadastrados disponíveis para filtragem
  const materiaisDisponiveis = useMemo(() => {
    const list = new Set<string>();
    consolidadoList.forEach(m => {
      if (m.descricao) list.add(m.descricao);
    });
    return Array.from(list).sort();
  }, [consolidadoList]);

  // 1. Filtra itens consolidados pela pesquisa e pelos materiais selecionados
  const filteredConsolidado = useMemo(() => {
    let result = consolidadoList;
    if (selectedMateriais.length > 0) {
      result = result.filter(item => selectedMateriais.includes(item.descricao));
    }
    const query = searchQuery.trim().toLowerCase();
    if (!query) return result;
    return result.filter(
      item => 
        item.codigo.toLowerCase().includes(query) || 
        item.descricao.toLowerCase().includes(query) ||
        item.grupoTraduzido.toLowerCase().includes(query)
    );
  }, [consolidadoList, selectedMateriais, searchQuery]);

  // 2. Filtra programações detalhadas pela pesquisa e pelos materiais selecionados
  const filteredDetalhado = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return filteredProgramacoes.map(prog => {
      let filteredMats = prog.materiais;
      if (selectedMateriais.length > 0) {
        filteredMats = filteredMats.filter(m => selectedMateriais.includes(m.descricao));
      }
      if (query) {
        filteredMats = filteredMats.filter(
          m => 
            m.codigo.toLowerCase().includes(query) || 
            m.descricao.toLowerCase().includes(query) ||
            m.grupoTraduzido.toLowerCase().includes(query)
        );
      }
      return {
        ...prog,
        materiais: filteredMats
      };
    }).filter(prog => prog.materiais.length > 0 || (query && prog.pontosList.some(p => p.toLowerCase().includes(query))));
  }, [filteredProgramacoes, selectedMateriais, searchQuery]);

  // 3. Opções para os filtros de cabeçalho da Visão Consolidada
  const codigosOptions = useMemo(() => {
    const set = new Set<string>();
    filteredConsolidado.forEach(item => {
      if (item.codigo) set.add(item.codigo);
    });
    return Array.from(set).sort().map(v => ({ value: v, label: v }));
  }, [filteredConsolidado]);

  const descricoesOptions = useMemo(() => {
    const set = new Set<string>();
    filteredConsolidado.forEach(item => {
      if (item.descricao) set.add(item.descricao);
    });
    return Array.from(set).sort().map(v => ({ value: v, label: v }));
  }, [filteredConsolidado]);

  const unidadesOptions = useMemo(() => {
    const set = new Set<string>();
    filteredConsolidado.forEach(item => {
      if (item.unidade) set.add(item.unidade);
    });
    return Array.from(set).sort().map(v => ({ value: v, label: v }));
  }, [filteredConsolidado]);

  const gruposOptions = useMemo(() => {
    const set = new Set<string>();
    filteredConsolidado.forEach(item => {
      if (item.grupoTraduzido) set.add(item.grupoTraduzido);
    });
    return Array.from(set).sort().map(v => ({ value: v, label: v }));
  }, [filteredConsolidado]);

  const equipesOptions = useMemo(() => {
    const set = new Set<string>();
    filteredConsolidado.forEach(item => {
      if (item.equipes) {
        item.equipes.forEach(eq => {
          if (eq) set.add(eq);
        });
      }
    });
    return Array.from(set).sort().map(v => ({ value: v, label: v }));
  }, [filteredConsolidado]);

  const origensOptions = useMemo(() => {
    const set = new Set<string>();
    filteredConsolidado.forEach(item => {
      if (item.pontosOrigem) {
        item.pontosOrigem.forEach(p => {
          set.add(`${p.obra} (${p.ponto})`);
        });
      }
    });
    return Array.from(set).sort().map(v => ({ value: v, label: v }));
  }, [filteredConsolidado]);

  // 4. Opções para os filtros de cabeçalho do Detalhamento por Ponto
  const detalhadaPontosOptions = useMemo(() => {
    const set = new Set<string>();
    filteredDetalhado.forEach(prog => {
      prog.materiais.forEach(m => {
        if (m.pontoObra) set.add(m.pontoObra);
      });
    });
    return Array.from(set).sort().map(v => ({ value: v, label: v }));
  }, [filteredDetalhado]);

  const detalhadaCodigosOptions = useMemo(() => {
    const set = new Set<string>();
    filteredDetalhado.forEach(prog => {
      prog.materiais.forEach(m => {
        if (m.codigo) set.add(m.codigo);
      });
    });
    return Array.from(set).sort().map(v => ({ value: v, label: v }));
  }, [filteredDetalhado]);

  const detalhadaDescricoesOptions = useMemo(() => {
    const set = new Set<string>();
    filteredDetalhado.forEach(prog => {
      prog.materiais.forEach(m => {
        if (m.descricao) set.add(m.descricao);
      });
    });
    return Array.from(set).sort().map(v => ({ value: v, label: v }));
  }, [filteredDetalhado]);

  const detalhadaUnidadesOptions = useMemo(() => {
    const set = new Set<string>();
    filteredDetalhado.forEach(prog => {
      prog.materiais.forEach(m => {
        if (m.unidade) set.add(m.unidade);
      });
    });
    return Array.from(set).sort().map(v => ({ value: v, label: v }));
  }, [filteredDetalhado]);

  const detalhadaGruposOptions = useMemo(() => {
    const set = new Set<string>();
    filteredDetalhado.forEach(prog => {
      prog.materiais.forEach(m => {
        if (m.grupoTraduzido) set.add(m.grupoTraduzido);
      });
    });
    return Array.from(set).sort().map(v => ({ value: v, label: v }));
  }, [filteredDetalhado]);

  const detalhadaEquipesOptions = useMemo(() => {
    const set = new Set<string>();
    filteredDetalhado.forEach(prog => {
      prog.materiais.forEach(m => {
        if (m.equipe) set.add(m.equipe);
      });
    });
    return Array.from(set).sort().map(v => ({ value: v, label: v }));
  }, [filteredDetalhado]);

  // 5. Aplica filtros de coluna da Visão Consolidada
  const finalConsolidado = useMemo(() => {
    let result = filteredConsolidado;
    if (colFilterCodigo.length > 0) {
      result = result.filter(item => colFilterCodigo.includes(item.codigo));
    }
    if (colFilterDescricao.length > 0) {
      result = result.filter(item => colFilterDescricao.includes(item.descricao));
    }
    if (colFilterUnidade.length > 0) {
      result = result.filter(item => colFilterUnidade.includes(item.unidade));
    }
    if (colFilterGrupo.length > 0) {
      result = result.filter(item => colFilterGrupo.includes(item.grupoTraduzido));
    }
    if (colFilterEquipes.length > 0) {
      result = result.filter(item => item.equipes.some(eq => colFilterEquipes.includes(eq)));
    }
    if (colFilterOrigem.length > 0) {
      result = result.filter(item => 
        item.pontosOrigem.some(p => colFilterOrigem.includes(`${p.obra} (${p.ponto})`))
      );
    }
    if (globalStatusFilter !== 'todos') {
      const isFalta = globalStatusFilter === 'falta';
      result = result.filter(item => (item.saldo < 0) === isFalta);
    }
    return result;
  }, [filteredConsolidado, colFilterCodigo, colFilterDescricao, colFilterUnidade, colFilterGrupo, colFilterEquipes, colFilterOrigem, globalStatusFilter]);

  // 6. Aplica filtros de coluna do Detalhamento por Ponto
  const finalDetalhado = useMemo(() => {
    return filteredDetalhado.map(prog => {
      let filteredMats = prog.materiais;
      if (colFilterPonto.length > 0) {
        filteredMats = filteredMats.filter(m => colFilterPonto.includes(m.pontoObra));
      }
      if (colFilterDetalhadaCodigo.length > 0) {
        filteredMats = filteredMats.filter(m => colFilterDetalhadaCodigo.includes(m.codigo));
      }
      if (colFilterDetalhadaDescricao.length > 0) {
        filteredMats = filteredMats.filter(m => colFilterDetalhadaDescricao.includes(m.descricao));
      }
      if (colFilterDetalhadaUnidade.length > 0) {
        filteredMats = filteredMats.filter(m => colFilterDetalhadaUnidade.includes(m.unidade));
      }
      if (colFilterDetalhadaGrupo.length > 0) {
        filteredMats = filteredMats.filter(m => colFilterDetalhadaGrupo.includes(m.grupoTraduzido));
      }
      if (colFilterDetalhadaEquipe.length > 0) {
        filteredMats = filteredMats.filter(m => colFilterDetalhadaEquipe.includes(m.equipe));
      }
      if (globalStatusFilter !== 'todos') {
        const isFalta = globalStatusFilter === 'falta';
        filteredMats = filteredMats.filter(m => (m.saldo < 0) === isFalta);
      }
      return {
        ...prog,
        materiais: filteredMats
      };
    }).filter(prog => prog.materiais.length > 0);
  }, [filteredDetalhado, colFilterPonto, colFilterDetalhadaCodigo, colFilterDetalhadaDescricao, colFilterDetalhadaUnidade, colFilterDetalhadaGrupo, colFilterDetalhadaEquipe, globalStatusFilter]);

  // Flattened detailed materials for "geral" single table mode
  const allDetailedMaterials = useMemo(() => {
    const list: any[] = [];
    finalDetalhado.forEach(prog => {
      prog.materiais.forEach(m => {
        list.push({
          ...m,
          equipe: prog.equipe,
          obra: prog.obra
        });
      });
    });
    return list;
  }, [finalDetalhado]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCsv = () => {
    const eqLabel = selectedEquipes.length > 0 ? selectedEquipes.join('-') : 'TODAS';
    
    if (viewTab === 'consolidada') {
      if (consolidadoList.length === 0) return;
      const headers = ['Código', 'Descrição', 'Unidade', 'Quantidade Necessária', 'Separado', 'A Separar', 'Estoque Disponível', 'Saldo', 'Status', 'Equipes', 'Grupo', 'Pontos Origem'];
      const rows = consolidadoList.map(item => [
        item.codigo,
        item.descricao,
        item.unidade,
        item.quantidadeTotal,
        item.qtdJaFornecidaTotal || 0,
        item.qtdASepararTotal || 0,
        item.estoque,
        item.saldo,
        !item.disponivel ? 'Em falta' : 'Disponível',
        item.equipes.join(' | '),
        item.grupoTraduzido,
        item.pontosOrigem.map(p => `${p.obra} (${p.ponto}): ${p.qtd}`).join(' | ')
      ]);
      downloadCSV(`Separacao_Materiais_Consolidado_${filterStart}_${filterEnd}_${eqLabel}.csv`, headers, rows);
    } else {
      if (finalDetalhado.length === 0) return;
      const headers = ['Equipe', 'Obra', 'Ponto', 'Código', 'Descrição', 'Unidade', 'Quantidade Necessária', 'Separado', 'A Separar', 'Estoque Disponível', 'Saldo', 'Grupo', 'Status', 'Motivo Retenção'];
      const rows: (string | number)[][] = [];
      finalDetalhado.forEach(prog => {
        prog.materiais.forEach(m => {
          rows.push([
            m.equipe,
            prog.obra,
            m.pontoObra,
            m.codigo,
            m.descricao,
            m.unidade,
            m.quantidade,
            m.qtdJaFornecida || 0,
            m.qtdASeparar || 0,
            m.estoque,
            m.saldo,
            m.grupoTraduzido,
            m.liberado ? (!m.disponivel ? 'Em falta' : 'Disponível') : 'Retido',
            m.motivoNaoLiberado || ''
          ]);
        });
      });
      downloadCSV(`Separacao_Materiais_Detalhado_${filterStart}_${filterEnd}_${eqLabel}.csv`, headers, rows);
    }
  };

  const selectedDateFormatted = useMemo(() => {
    if (filterStart && filterEnd) {
      if (filterStart === filterEnd) {
        const parsed = parse(filterStart, 'yyyy-MM-dd', new Date());
        if (isValid(parsed)) return format(parsed, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
      } else {
        const pStart = parse(filterStart, 'yyyy-MM-dd', new Date());
        const pEnd = parse(filterEnd, 'yyyy-MM-dd', new Date());
        if (isValid(pStart) && isValid(pEnd)) {
          return `${format(pStart, "dd/MM/yyyy")} até ${format(pEnd, "dd/MM/yyyy")}`;
        }
      }
    }
    return filterStart || 'Período não definido';
  }, [filterStart, filterEnd]);

  const totalMateriaisLiberadosCount = useMemo(() => {
    return consolidadoList.reduce((acc, curr) => acc + curr.quantidadeTotal, 0);
  }, [consolidadoList]);

  const filteredPontosSemOrcamento = useMemo(() => {
    if (!data?.pontosSemOrcamento) return [];
    const activePontoKeys = new Set<string>();
    filteredProgramacoes.forEach(prog => {
      prog.pontosList.forEach(p => {
        activePontoKeys.add(`${prog.obra}_${p}`);
      });
    });
    return data.pontosSemOrcamento.filter(key => activePontoKeys.has(key));
  }, [data?.pontosSemOrcamento, filteredProgramacoes]);

  // Agrupa os pontos sem orçamento por Obra para melhor visualização
  const pontosSemOrcamentoAgrupados = useMemo(() => {
    const groups = new Map<string, string[]>();
    filteredPontosSemOrcamento.forEach(key => {
      const parts = key.split('_');
      const obra = parts[0];
      const ponto = parts.slice(1).join('_') || 'Sem Ponto';
      if (!groups.has(obra)) {
        groups.set(obra, []);
      }
      groups.get(obra)!.push(ponto);
    });
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredPontosSemOrcamento]);

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6 w-full min-h-screen">
      
      {/* Estilos para Impressão */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #print-area, #print-area * {
            visibility: visible;
          }
          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4 no-print">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
            Separação de Materiais
          </h1>
          <p className="text-muted-foreground mt-1">
            Geração de listas de separação com base no Planejamento de Barreiras
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {/* Main Tab selector */}
          <div className="flex items-center bg-slate-100 dark:bg-zinc-800 p-0.5 rounded-lg border mr-2">
            <button
              onClick={() => setActiveMainTab('separacao')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                activeMainTab === 'separacao'
                  ? 'bg-white dark:bg-zinc-950 shadow text-slate-900 dark:text-white'
                  : 'text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              Separação
            </button>
            <button
              onClick={() => setActiveMainTab('faltas')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                activeMainTab === 'faltas'
                  ? 'bg-white dark:bg-zinc-950 shadow text-slate-900 dark:text-white'
                  : 'text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              Faltas
              {data?.faltasDashboard?.faltas?.length > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-rose-600 text-white leading-none">
                  {data.faltasDashboard.faltas.length}
                </span>
              )}
            </button>
          </div>

          {data?.lastUpdated && (
            <span className="text-xs text-muted-foreground bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full border">
              Última Sync: {new Date(data.lastUpdated).toLocaleString('pt-BR')}
            </span>
          )}
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => syncPlanejamento()} 
            disabled={isSyncing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card className="no-print border-slate-200 shadow-md">
        <CardHeader className="py-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Filter className="h-4 w-4 text-violet-500" />
            Filtros de Busca
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3 w-full">
          
          {/* Unidades */}
          <div className="w-full sm:w-40 lg:w-44 shrink-0">
            <FilterSelect 
              label="Unidades" 
              options={UNIDADES_PLANEJAMENTO.map(u => ({ value: u.id, label: u.nome }))} 
              selectedValues={selectedUnidades} 
              onChange={setSelectedUnidades} 
            />
          </div>

          {/* Mês */}
          <div className="w-full sm:w-36 lg:w-40 shrink-0">
            <FilterSelect 
              label="Mês" 
              options={(data?.allMonths || []).map(m => ({ value: m, label: m }))} 
              selectedValues={selectedMonths} 
              onChange={setSelectedMonths} 
              searchable={true} 
            />
          </div>

          {/* Período */}
          <div className="flex flex-col justify-center shrink-0 w-full sm:w-auto">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 flex justify-between">Período
              {(filterStart || filterEnd) && <button onClick={() => { setFilterStart(''); setFilterEnd(''); }} className="text-foreground hover:underline ml-1">Limpar</button>}
            </span>
            <div className="flex items-center gap-1 border border-input bg-background rounded-md h-9 px-2.5 focus-within:ring-1 focus-within:ring-ring w-full sm:w-fit">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <input type="date" value={filterStart} onChange={e => setFilterStart(e.target.value)} className="bg-transparent text-xs outline-none w-[95px] text-foreground" title="Data Inicial" />
              <span className="text-muted-foreground text-xs shrink-0 px-1 font-medium">-</span>
              <input type="date" value={filterEnd} onChange={e => setFilterEnd(e.target.value)} className="bg-transparent text-xs outline-none w-[95px] text-foreground" title="Data Final" />
            </div>
          </div>

          {/* Supervisor */}
          <div className="w-full sm:w-36 lg:w-40 shrink-0">
            <FilterSelect 
              label="Supervisor" 
              options={(data?.allSupervisores || []).map(s => ({ value: s, label: s }))} 
              selectedValues={selectedSupervisores} 
              onChange={setSelectedSupervisores} 
              searchable={true} 
            />
          </div>

          {/* Equipe */}
          <div className="w-full sm:w-36 lg:w-40 shrink-0">
            <FilterSelect 
              label="Equipe" 
              options={(data?.allEquipes || []).map(eq => ({ value: eq, label: eq }))} 
              selectedValues={selectedEquipes} 
              onChange={setSelectedEquipes} 
              searchable={true} 
            />
          </div>

          {/* Município */}
          <div className="w-full sm:w-36 lg:w-40 shrink-0">
            <FilterSelect 
              label="Município" 
              options={(data?.allMunicipios || []).map(m => ({ value: m, label: m }))} 
              selectedValues={selectedMunicipios} 
              onChange={setSelectedMunicipios} 
              searchable={true} 
            />
          </div>

          {/* Obra */}
          <div className="w-full sm:w-40 lg:w-44 shrink-0">
            <FilterSelect 
              label="Obra" 
              options={(data?.allObras || []).map(o => ({ value: o, label: o }))} 
              selectedValues={selectedObras} 
              onChange={setSelectedObras} 
            />
          </div>

        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-violet-600" />
          <p className="text-muted-foreground animate-pulse text-sm">Buscando e processando materiais de planejamento...</p>
        </div>
      ) : activeMainTab === 'faltas' ? (
        <PlanejamentoFaltasDashboard 
          data={data}
          filterStart={filterStart}
          filterEnd={filterEnd}
        />
      ) : (
        <div id="print-area" className="flex flex-col gap-6">
          
          {/* Alertas Importantes de Qualidade de Dados */}
          {filteredPontosSemOrcamento.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-900 rounded-lg p-4 flex gap-3 text-amber-800 dark:text-amber-300 no-print shadow-sm">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500 mt-0.5" />
              <div className="w-full">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <h4 className="font-bold text-sm text-amber-900 dark:text-amber-300">Pontos Sem Orçamento Identificados</h4>
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                      Há <strong className="text-amber-900 dark:text-amber-200">{filteredPontosSemOrcamento.length}</strong> pontos programados que não possuem correspondência de materiais no cadastro.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="xs"
                    className="border-amber-300 text-amber-900 bg-amber-100/50 hover:bg-amber-200 hover:text-amber-950 text-xs shrink-0"
                    onClick={() => setShowPontosSemOrcamentoDetails(!showPontosSemOrcamentoDetails)}
                  >
                    {showPontosSemOrcamentoDetails ? 'Ocultar Detalhes' : 'Ver Detalhes dos Pontos'}
                  </Button>
                </div>

                {showPontosSemOrcamentoDetails && (
                  <div className="mt-3 bg-white/80 dark:bg-slate-900/50 border border-amber-200/80 rounded-md p-3 max-h-48 overflow-y-auto">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-3">
                      {pontosSemOrcamentoAgrupados.map(([obra, pontos]) => (
                        <div key={obra} className="flex flex-col gap-0.5 text-xs border-b border-amber-100/30 pb-2 last:border-0 last:pb-0">
                          <span className="font-bold text-amber-950 dark:text-amber-100">{obra}</span>
                          <span className="text-slate-600 dark:text-slate-400 break-all leading-normal">
                            {pontos.join(', ')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}



          {/* Resumo do Romaneio */}
          <Card className="border-slate-200 dark:border-zinc-800 shadow-md">
            <CardHeader className="bg-slate-50/50 dark:bg-zinc-900/50 border-b dark:border-zinc-800 py-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100">
                    <ClipboardList className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                    Romaneio de Separação
                  </CardTitle>
                  <CardDescription className="mt-1 text-slate-500 dark:text-slate-400">
                    Dia: <span className="font-semibold text-slate-850 dark:text-slate-200">{selectedDateFormatted}</span>
                  {selectedEquipes.length > 0 && (
                    <>
                      {' '}| Equipes: <span className="font-semibold text-slate-850 dark:text-slate-200">{selectedEquipes.join(', ')}</span>
                    </>
                  )}
                  </CardDescription>
                </div>
                
                <div className="flex items-center gap-2 no-print">
                  <Button variant="outline" size="sm" className="h-8" onClick={handlePrint}>
                    <Printer className="h-4 w-4 mr-2" />
                    Imprimir Romaneio
                  </Button>
                  <Button variant="outline" size="sm" className="h-8" onClick={handleExportCsv}>
                    <Download className="h-4 w-4 mr-2" />
                    Exportar CSV
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              
              {/* KPIs rápidas */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div 
                  onClick={handleOpenProgramacoesModal}
                  className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 flex flex-col cursor-pointer hover:bg-slate-100 dark:hover:bg-zinc-900 hover:shadow-sm transition-all"
                >
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider flex items-center justify-between">
                    <span>Programações</span>
                    <span className="text-[10px] text-slate-400 font-normal">ℹ️</span>
                  </span>
                  <span className="text-2xl font-bold mt-1 text-slate-800 dark:text-slate-100">{filteredProgramacoes.length}</span>
                </div>
                <div 
                  onClick={handleOpenPontosModal}
                  className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 flex flex-col cursor-pointer hover:bg-slate-100 dark:hover:bg-zinc-900 hover:shadow-sm transition-all"
                >
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider flex items-center justify-between">
                    <span>Pontos Total</span>
                    <span className="text-[10px] text-slate-400 font-normal">ℹ️</span>
                  </span>
                  <span className="text-2xl font-bold mt-1 text-slate-800 dark:text-slate-100">
                    {filteredProgramacoes.reduce((acc, curr) => acc + curr.pontosList.length, 0)}
                  </span>
                </div>
                <div 
                  onClick={handleOpenItensModal}
                  className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 flex flex-col cursor-pointer hover:bg-slate-100 dark:hover:bg-zinc-900 hover:shadow-sm transition-all"
                >
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider flex items-center justify-between">
                    <span>Itens Únicos Liberados</span>
                    <span className="text-[10px] text-slate-400 font-normal">ℹ️</span>
                  </span>
                  <span className="text-2xl font-bold mt-1 text-slate-800 dark:text-slate-100">{consolidadoList.length}</span>
                </div>
                <div 
                  onClick={handleOpenQtdModal}
                  className="p-4 rounded-xl bg-violet-50/50 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900/30 flex flex-col cursor-pointer hover:bg-violet-50 dark:hover:bg-violet-950/30 hover:shadow-sm transition-all"
                >
                  <span className="text-xs text-violet-600 dark:text-violet-400 font-semibold uppercase tracking-wider flex items-center justify-between">
                    <span>Qtd Total Separar</span>
                    <span className="text-[10px] text-violet-400 font-normal">ℹ️</span>
                  </span>
                  <span className="text-2xl font-bold mt-1 text-violet-950 dark:text-violet-200">{Math.round(totalMateriaisLiberadosCount)}</span>
                </div>
              </div>

              {/* Tabela Principal */}
              <div className="flex flex-col gap-4">
                {/* Cabeçalho da visualização & pesquisa interna */}
                <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 no-print">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex bg-slate-100 p-0.5 rounded-lg border">
                      <button
                        className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                          viewTab === 'consolidada' 
                            ? 'bg-white shadow text-slate-900' 
                            : 'text-slate-500 hover:text-slate-950'
                        }`}
                        onClick={() => setViewTab('consolidada')}
                      >
                        <Layers className="h-3 w-3 inline mr-1" />
                        Visão Consolidada
                      </button>
                      <button
                        className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                          viewTab === 'detalhada' 
                            ? 'bg-white shadow text-slate-900' 
                            : 'text-slate-500 hover:text-slate-950'
                        }`}
                        onClick={() => setViewTab('detalhada')}
                      >
                        <FileText className="h-3 w-3 inline mr-1" />
                        Detalhamento por Ponto
                      </button>
                    </div>

                    {/* Filtro de materiais listados */}
                    <div className="w-64">
                      <FilterSelect
                        label=""
                        options={materiaisDisponiveis.map(m => ({ value: m, label: m }))}
                        selectedValues={selectedMateriais}
                        onChange={setSelectedMateriais}
                        searchable={true}
                      />
                    </div>

                    {/* Filtro de Status Global */}
                    <div className="w-44">
                      <select
                        value={globalStatusFilter}
                        onChange={e => setGlobalStatusFilter(e.target.value as any)}
                        className="w-full h-8 px-2 text-xs border rounded bg-white dark:bg-zinc-900 text-slate-700 dark:text-slate-350 outline-none font-semibold shadow-sm"
                      >
                        <option value="todos">Status: Todos</option>
                        <option value="disponivel">Status: Disponíveis</option>
                        <option value="falta">Status: Em falta</option>
                      </select>
                    </div>
                  </div>

                  <div className="relative max-w-xs w-full">
                    <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                    <Input
                      placeholder="Pesquisar material..."
                      className="pl-8 h-8 text-xs w-full"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>

                {viewTab === 'consolidada' ? (
                  /* VISÃO CONSOLIDADA */
                  <div className="border rounded-lg overflow-auto h-[750px] min-h-[400px] max-h-[85vh] resize-y relative shadow-inner bg-white dark:bg-zinc-950">
                    <table className="w-full text-sm text-left border-collapse">
                      <thead className="bg-slate-50 dark:bg-zinc-900 text-slate-600 dark:text-slate-400 uppercase text-xs font-bold border-b dark:border-zinc-800 sticky top-0 z-20 shadow-[0_1px_0_0_rgba(226,232,240,1)]">
                        <tr className="bg-slate-50 dark:bg-zinc-900">
                          <th className="px-4 py-3 text-center bg-slate-50 dark:bg-zinc-900">Código</th>
                          <th className="px-4 py-3 text-center bg-slate-50 dark:bg-zinc-900">Descrição</th>
                          <th className="px-4 py-3 text-center bg-slate-50 dark:bg-zinc-900">Unidade</th>
                          <th className="px-4 py-3 text-center bg-slate-50 dark:bg-zinc-900">Qtd Nec.</th>
                          <th className="px-4 py-3 text-center bg-slate-50 dark:bg-zinc-900">Separado</th>
                          <th className="px-4 py-3 text-center bg-slate-50 dark:bg-zinc-900">A Separar</th>
                          <th className="px-4 py-3 text-center bg-slate-50 dark:bg-zinc-900">Estoque Disp.</th>
                          <th className="px-4 py-3 text-center bg-slate-50 dark:bg-zinc-900">Saldo</th>
                          <th className="px-4 py-3 text-center bg-slate-50 dark:bg-zinc-900">Status</th>
                          <th className="px-4 py-3 text-center bg-slate-50 dark:bg-zinc-900">Equipe(s)</th>
                          <th className="px-4 py-3 text-center bg-slate-50 dark:bg-zinc-900">Grupo Traduzido</th>
                          <th className="px-4 py-3 text-center no-print bg-slate-50 dark:bg-zinc-900">Pontos Origem</th>
                        </tr>
                        <tr className="bg-slate-100 dark:bg-zinc-900/80 no-print border-b dark:border-zinc-800">
                          <td className="px-2 py-1 bg-slate-100 dark:bg-zinc-900/80">
                            <FilterSelect
                              label=""
                              options={codigosOptions}
                              selectedValues={colFilterCodigo}
                              onChange={setColFilterCodigo}
                              searchable={true}
                            />
                          </td>
                          <td className="px-2 py-1 bg-slate-100 dark:bg-zinc-900/80">
                            <FilterSelect
                              label=""
                              options={descricoesOptions}
                              selectedValues={colFilterDescricao}
                              onChange={setColFilterDescricao}
                              searchable={true}
                            />
                          </td>
                          <td className="px-2 py-1 text-center bg-slate-100 dark:bg-zinc-900/80">
                            <FilterSelect
                              label=""
                              options={unidadesOptions}
                              selectedValues={colFilterUnidade}
                              onChange={setColFilterUnidade}
                            />
                          </td>
                          <td className="px-2 py-1 text-right bg-slate-100 dark:bg-zinc-900/80">
                            {/* Qtd Nec */}
                          </td>
                          <td className="px-2 py-1 text-right bg-slate-100 dark:bg-zinc-900/80">
                            {/* Separado */}
                          </td>
                          <td className="px-2 py-1 text-right bg-slate-100 dark:bg-zinc-900/80">
                            {/* A Separar */}
                          </td>
                          <td className="px-2 py-1 text-right bg-slate-100 dark:bg-zinc-900/80">
                            {/* Estoque Disp */}
                          </td>
                          <td className="px-2 py-1 text-right bg-slate-100 dark:bg-zinc-900/80">
                            {/* Saldo */}
                          </td>
                          <td className="px-2 py-1 bg-slate-100 dark:bg-zinc-900/80">
                             <select
                               value={globalStatusFilter}
                               onChange={e => setGlobalStatusFilter(e.target.value as any)}
                               className="w-full h-8 px-1 text-xs border dark:border-zinc-800 rounded bg-white dark:bg-zinc-900 text-slate-700 dark:text-slate-200 outline-none font-normal shadow-sm"
                             >
                               <option value="todos">Todos</option>
                               <option value="disponivel">Disponíveis</option>
                               <option value="falta">Em falta</option>
                             </select>
                          </td>
                          <td className="px-2 py-1 bg-slate-100 dark:bg-zinc-900/80">
                            <FilterSelect
                              label=""
                              options={equipesOptions}
                              selectedValues={colFilterEquipes}
                              onChange={setColFilterEquipes}
                              searchable={true}
                            />
                          </td>
                          <td className="px-2 py-1 bg-slate-100 dark:bg-zinc-900/80">
                            <FilterSelect
                              label=""
                              options={gruposOptions}
                              selectedValues={colFilterGrupo}
                              onChange={setColFilterGrupo}
                              searchable={true}
                            />
                          </td>
                          <td className="px-2 py-1 no-print bg-slate-100 dark:bg-zinc-900/80">
                            <FilterSelect
                              label=""
                              options={origensOptions}
                              selectedValues={colFilterOrigem}
                              onChange={setColFilterOrigem}
                              searchable={true}
                            />
                          </td>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {finalConsolidado.length === 0 ? (
                           <tr>
                             <td colSpan={12} className="px-4 py-12 text-center text-muted-foreground">
                               Nenhum material liberado para separação nesta seleção.
                             </td>
                           </tr>
                        ) : (
                          finalConsolidado.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-zinc-900/50 border-b dark:border-zinc-900">
                              <td className="px-4 py-3 font-mono font-bold text-violet-600 dark:text-violet-400">{item.codigo}</td>
                              <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">{item.descricao}</td>
                              <td className="px-4 py-3 text-center font-semibold text-slate-500 dark:text-slate-400">{item.unidade}</td>
                              <td className="px-4 py-3 text-right font-black text-slate-950 dark:text-slate-100 bg-slate-50/30 dark:bg-zinc-900/30">{formatQtd(item.quantidadeTotal)}</td>
                              <td className="px-4 py-3 text-right font-bold text-slate-650 dark:text-slate-350 bg-blue-50/20 dark:bg-blue-950/10">{formatQtd(item.qtdJaFornecidaTotal || 0)}</td>
                              <td className="px-4 py-3 text-right font-black text-slate-900 dark:text-slate-100 bg-amber-50/20 dark:bg-amber-950/10">{formatQtd(item.qtdASepararTotal || 0)}</td>
                              <td className="px-4 py-3 text-right font-bold text-slate-600 dark:text-slate-400 bg-slate-50/20 dark:bg-zinc-900/20">{formatQtd(item.estoque)}</td>
                              <td className={`px-4 py-3 text-right font-black ${item.saldo < 0 ? 'text-rose-600 bg-rose-50/20 dark:text-rose-400 dark:bg-rose-950/20' : 'text-emerald-700 bg-emerald-50/10 dark:text-emerald-400 dark:bg-emerald-950/10'}`}>
                                {formatQtd(item.saldo)}
                              </td>
                              <td className="px-4 py-3">
                                {!item.disponivel ? (
                                  <span className="text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1">
                                    <AlertCircle className="h-3.5 w-3.5" />
                                    Em falta
                                  </span>
                                ) : (
                                  <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    Disponível
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <div className="grid grid-cols-2 gap-x-1 gap-y-0.5 w-28 min-w-[110px]">
                                  {item.equipes?.map(eq => (
                                    <Badge key={eq} variant="outline" className="font-semibold text-[9px] py-0 px-1 bg-slate-50 dark:bg-zinc-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-zinc-800 justify-center">
                                      {eq}
                                    </Badge>
                                  ))}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <Badge variant="outline" className={`font-bold text-xs ${getGrupoColorClasses(item.grupoTraduzido)}`}>
                                  {item.grupoTraduzido}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 no-print text-xs text-slate-500 dark:text-slate-400 max-w-xs truncate">
                                {item.pontosOrigem.map(p => `${p.obra} (${p.ponto}: ${p.qtd})`).join(', ')}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  /* VISÃO DETALHADA POR PONTO */
                  <div className="flex flex-col gap-6">
                    {/* Toggle button for Mode (Por Equipe vs Geral) */}
                    <div className="flex justify-between items-center bg-slate-50/50 p-2 border rounded-lg no-print">
                      <div className="text-xs font-semibold text-slate-600 px-2">
                        Visualização do Detalhamento:
                      </div>
                      <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border">
                        <button
                          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1 ${
                            detalhadaMode === 'equipe'
                              ? 'bg-white shadow text-slate-900'
                              : 'text-slate-500 hover:text-slate-950'
                          }`}
                          onClick={() => setDetalhadaMode('equipe')}
                        >
                          <ClipboardList className="h-3 w-3" />
                          Por Equipe
                        </button>
                        <button
                          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1 ${
                            detalhadaMode === 'geral'
                              ? 'bg-white shadow text-slate-900'
                              : 'text-slate-500 hover:text-slate-950'
                          }`}
                          onClick={() => setDetalhadaMode('geral')}
                        >
                          <Layers className="h-3 w-3" />
                          Geral (Tabela Única)
                        </button>
                      </div>
                    </div>

                    {detalhadaMode === 'geral' ? (
                      /* TABELA GERAL ÚNICA */
                      <div className="border rounded-lg overflow-auto h-[500px] min-h-[250px] max-h-[85vh] resize-y relative shadow-inner bg-white dark:bg-zinc-950">
                        <table className="w-full text-sm text-left border-collapse">
                          <thead className="bg-slate-50 text-slate-600 dark:text-slate-400 uppercase text-xs font-bold border-b dark:border-zinc-800 sticky top-0 z-20 shadow-[0_1px_0_0_rgba(226,232,240,1)]">
                            <tr className="bg-slate-50 dark:bg-zinc-900">
                              <th className="px-4 py-3 text-center bg-slate-50 dark:bg-zinc-900">Equipe</th>
                              <th className="px-4 py-3 text-center bg-slate-50 dark:bg-zinc-900">Ponto</th>
                              <th className="px-4 py-3 text-center bg-slate-50 dark:bg-zinc-900">Código</th>
                              <th className="px-4 py-3 text-center bg-slate-50 dark:bg-zinc-900">Descrição</th>
                              <th className="px-4 py-3 text-center bg-slate-50 dark:bg-zinc-900">Unid</th>
                              <th className="px-4 py-3 text-center bg-slate-50 dark:bg-zinc-900">Qtd Nec.</th>
                              <th className="px-4 py-3 text-center bg-slate-50 dark:bg-zinc-900">Separado</th>
                              <th className="px-4 py-3 text-center bg-slate-50 dark:bg-zinc-900">A Separar</th>
                              <th className="px-4 py-3 text-center bg-slate-50 dark:bg-zinc-900">Estoque Disp</th>
                              <th className="px-4 py-3 text-center bg-slate-50 dark:bg-zinc-900">Saldo</th>
                              <th className="px-4 py-3 text-center bg-slate-50 dark:bg-zinc-900">Grupo Mat.</th>
                              <th className="px-4 py-3 text-center bg-slate-50 dark:bg-zinc-900">Status</th>
                            </tr>
                            <tr className="bg-slate-100 dark:bg-zinc-900/80 no-print border-b dark:border-zinc-800">
                              <td className="px-2 py-1 bg-slate-100 dark:bg-zinc-900/80">
                                <FilterSelect
                                  label=""
                                  options={detalhadaEquipesOptions}
                                  selectedValues={colFilterDetalhadaEquipe}
                                  onChange={setColFilterDetalhadaEquipe}
                                  searchable={true}
                                />
                              </td>
                              <td className="px-2 py-1 bg-slate-100 dark:bg-zinc-900/80">
                                <FilterSelect
                                  label=""
                                  options={detalhadaPontosOptions}
                                  selectedValues={colFilterPonto}
                                  onChange={setColFilterPonto}
                                  searchable={true}
                                />
                              </td>
                              <td className="px-2 py-1 bg-slate-100 dark:bg-zinc-900/80">
                                <FilterSelect
                                  label=""
                                  options={detalhadaCodigosOptions}
                                  selectedValues={colFilterDetalhadaCodigo}
                                  onChange={setColFilterDetalhadaCodigo}
                                  searchable={true}
                                />
                              </td>
                              <td className="px-2 py-1 bg-slate-100 dark:bg-zinc-900/80">
                                <FilterSelect
                                  label=""
                                  options={detalhadaDescricoesOptions}
                                  selectedValues={colFilterDetalhadaDescricao}
                                  onChange={setColFilterDetalhadaDescricao}
                                  searchable={true}
                                />
                              </td>
                              <td className="px-2 py-1 text-center bg-slate-100 dark:bg-zinc-900/80">
                                <FilterSelect
                                  label=""
                                  options={detalhadaUnidadesOptions}
                                  selectedValues={colFilterDetalhadaUnidade}
                                  onChange={setColFilterDetalhadaUnidade}
                                />
                              </td>
                              <td className="px-2 py-1 bg-slate-100 dark:bg-zinc-900/80">
                                {/* Qtd Nec */}
                              </td>
                              <td className="px-2 py-1 bg-slate-100 dark:bg-zinc-900/80">
                                {/* Separado */}
                              </td>
                              <td className="px-2 py-1 bg-slate-100 dark:bg-zinc-900/80">
                                {/* A Separar */}
                              </td>
                              <td className="px-2 py-1 bg-slate-100 dark:bg-zinc-900/80">
                                {/* Estoque Disp */}
                              </td>
                              <td className="px-2 py-1 bg-slate-100 dark:bg-zinc-900/80">
                                {/* Saldo */}
                              </td>
                              <td className="px-2 py-1 bg-slate-100 dark:bg-zinc-900/80">
                                <FilterSelect
                                  label=""
                                  options={detalhadaGruposOptions}
                                  selectedValues={colFilterDetalhadaGrupo}
                                  onChange={setColFilterDetalhadaGrupo}
                                  searchable={true}
                                />
                              </td>
                              <td className="px-2 py-1 bg-slate-100 dark:bg-zinc-900/80">
                                 <select
                                   value={globalStatusFilter}
                                   onChange={e => setGlobalStatusFilter(e.target.value as any)}
                                   className="w-full h-8 px-1 text-xs border dark:border-zinc-800 rounded bg-white dark:bg-zinc-900 text-slate-700 dark:text-slate-200 outline-none font-normal shadow-sm"
                                 >
                                   <option value="todos">Todos</option>
                                   <option value="disponivel">Disponíveis</option>
                                   <option value="falta">Em falta</option>
                                 </select>
                              </td>
                            </tr>
                          </thead>
                          <tbody className="divide-y text-xs">
                            {allDetailedMaterials.length === 0 ? (
                              <tr>
                                <td colSpan={12} className="px-4 py-12 text-center text-muted-foreground">
                                  Nenhum material encontrado com os filtros selecionados.
                                </td>
                              </tr>
                            ) : (
                              allDetailedMaterials.map((m, idx) => (
                                <tr 
                                  key={idx} 
                                  className={`hover:bg-slate-50/50 dark:hover:bg-zinc-900/50 border-b dark:border-zinc-900 ${!m.liberado ? 'opacity-40 bg-slate-50/10 dark:bg-zinc-900/10' : ''}`}
                                >
                                  <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">
                                    <div className="flex flex-col">
                                      <span className="font-bold text-indigo-600 dark:text-indigo-400">{m.equipe}</span>
                                      <span className="text-[10px] text-slate-400 dark:text-slate-500">{m.obra}</span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 font-mono font-bold text-slate-800 dark:text-slate-200">{m.pontoObra}</td>
                                  <td className="px-4 py-3 font-mono font-bold text-violet-600 dark:text-violet-400">{m.codigo}</td>
                                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">
                                    {m.descricao}
                                    {m.semRegra && (
                                      <Badge variant="outline" className="ml-2 text-[9px] border-amber-300 dark:border-amber-900 text-amber-700 dark:text-amber-450 bg-amber-50 dark:bg-amber-950/20">
                                        sem regra
                                      </Badge>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-center font-bold text-slate-500 dark:text-slate-400">{m.unidade}</td>
                                  <td className="px-4 py-3 text-right font-black text-slate-950 dark:text-slate-100 bg-slate-50/30 dark:bg-zinc-900/30">{formatQtd(m.quantidade)}</td>
                                  <td className="px-4 py-3 text-right font-bold text-slate-650 dark:text-slate-350 bg-blue-50/20 dark:bg-blue-950/10">{formatQtd(m.qtdJaFornecida || 0)}</td>
                                  <td className="px-4 py-3 text-right font-black text-slate-900 dark:text-slate-100 bg-amber-50/20 dark:bg-amber-950/10">{formatQtd(m.qtdASeparar || 0)}</td>
                                  <td className="px-4 py-3 text-right font-bold text-slate-600 dark:text-slate-400 bg-slate-50/20 dark:bg-zinc-900/20">{formatQtd(m.estoque)}</td>
                                  <td className={`px-4 py-3 text-right font-black ${m.saldo < 0 ? 'text-rose-600 bg-rose-50/20 dark:text-rose-400 dark:bg-rose-950/20' : 'text-emerald-700 bg-emerald-50/10 dark:text-emerald-400 dark:bg-emerald-950/10'}`}>
                                    {formatQtd(m.saldo)}
                                  </td>
                                  <td className="px-4 py-3">
                                    <Badge variant="outline" className={`font-bold text-[10px] ${getGrupoColorClasses(m.grupoTraduzido)}`}>
                                      {m.grupoTraduzido}
                                    </Badge>
                                  </td>
                                  <td className="px-4 py-3">
                                    {m.liberado ? (
                                      !m.disponivel ? (
                                        <span className="text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1">
                                          <AlertCircle className="h-3 w-3" />
                                          Em falta
                                        </span>
                                      ) : (
                                        <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                                          <CheckCircle2 className="h-3 w-3" />
                                          Disponível
                                        </span>
                                      )
                                    ) : (
                                      <span className="text-slate-400 flex items-center gap-1" title={m.motivoNaoLiberado}>
                                        <HelpCircle className="h-3 w-3" />
                                        Retido
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      /* VISÃO POR EQUIPE (CARDS) */
                      finalDetalhado.length === 0 ? (
                        <div className="border rounded-lg py-12 text-center text-muted-foreground text-sm">
                          Nenhuma programação encontrada para esta seleção.
                        </div>
                      ) : (
                        finalDetalhado.map(prog => (
                          <div key={prog.id} className="border rounded-lg overflow-hidden shadow-sm bg-white dark:bg-zinc-950 mb-6 last:mb-0">
                            
                            {/* Programacao Header */}
                            <div className="bg-slate-50/70 dark:bg-zinc-900/70 border-b dark:border-zinc-800 px-4 py-3 flex flex-col md:flex-row md:justify-between md:items-center gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge className="bg-indigo-600 dark:bg-indigo-500 text-white font-bold text-xs">{prog.equipe}</Badge>
                                <span className="font-extrabold text-sm text-slate-900 dark:text-slate-150">{prog.obra}</span>
                                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">({prog.pontosList.length} ponto(s): {prog.pontosRaw})</span>
                              </div>
                              
                              <div className="flex flex-wrap items-center gap-1">
                                {prog.byGrupos.map(bg => (
                                  <Badge key={bg} variant="outline" className="bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-300 font-bold text-xs">
                                    {bg}
                                  </Badge>
                                ))}
                              </div>
                            </div>

                            <div className="p-3 text-xs text-slate-500 dark:text-slate-400 italic border-b dark:border-zinc-800 bg-slate-50/20 dark:bg-zinc-900/20">
                              Atividades: {prog.descricaoAtividades || 'Nenhuma descrição fornecida'}
                            </div>

                            {/* Materiais da Programação */}
                            <div className="overflow-auto h-[250px] min-h-[150px] max-h-[70vh] resize-y relative shadow-inner bg-white dark:bg-zinc-950">
                              <table className="w-full text-sm text-left border-collapse">
                                <thead className="bg-slate-50 dark:bg-zinc-900 text-slate-500 dark:text-slate-400 uppercase text-[10px] font-bold border-b dark:border-zinc-800 sticky top-0 z-20 shadow-[0_1px_0_0_rgba(226,232,240,1)]">
                                  <tr className="bg-slate-50 dark:bg-zinc-900">
                                    <th className="px-4 py-2 w-28 text-center bg-slate-50 dark:bg-zinc-900">Equipe</th>
                                    <th className="px-4 py-2 w-24 text-center bg-slate-50 dark:bg-zinc-900">Ponto</th>
                                    <th className="px-4 py-2 w-28 text-center bg-slate-50 dark:bg-zinc-900">Código</th>
                                    <th className="px-4 py-2 text-center bg-slate-50 dark:bg-zinc-900">Descrição</th>
                                    <th className="px-4 py-2 text-center w-12 bg-slate-50 dark:bg-zinc-900">Unid</th>
                                    <th className="px-4 py-2 text-center w-16 bg-slate-50 dark:bg-zinc-900">Qtd Nec.</th>
                                    <th className="px-4 py-2 text-center w-20 bg-slate-50 dark:bg-zinc-900">Separado</th>
                                    <th className="px-4 py-2 text-center w-20 bg-slate-50 dark:bg-zinc-900">A Separar</th>
                                    <th className="px-4 py-2 text-center w-20 bg-slate-50 dark:bg-zinc-900">Estoque Disp</th>
                                    <th className="px-4 py-2 text-center w-20 bg-slate-50 dark:bg-zinc-900">Saldo</th>
                                    <th className="px-4 py-2 w-24 text-center bg-slate-50 dark:bg-zinc-900">Status</th>
                                    <th className="px-4 py-2 w-28 text-center bg-slate-50 dark:bg-zinc-900">Grupo Mat.</th>
                                  </tr>
                                  <tr className="bg-slate-100 dark:bg-zinc-900/80 no-print border-b dark:border-zinc-800">
                                    <td className="px-2 py-1 bg-slate-100 dark:bg-zinc-900/80">
                                      <FilterSelect
                                        label=""
                                        options={detalhadaEquipesOptions}
                                        selectedValues={colFilterDetalhadaEquipe}
                                        onChange={setColFilterDetalhadaEquipe}
                                        searchable={true}
                                      />
                                    </td>
                                    <td className="px-2 py-1 bg-slate-100 dark:bg-zinc-900/80">
                                      <FilterSelect
                                        label=""
                                        options={detalhadaPontosOptions}
                                        selectedValues={colFilterPonto}
                                        onChange={setColFilterPonto}
                                        searchable={true}
                                      />
                                    </td>
                                    <td className="px-2 py-1 bg-slate-100 dark:bg-zinc-900/80">
                                      <FilterSelect
                                        label=""
                                        options={detalhadaCodigosOptions}
                                        selectedValues={colFilterDetalhadaCodigo}
                                        onChange={setColFilterDetalhadaCodigo}
                                        searchable={true}
                                      />
                                    </td>
                                    <td className="px-2 py-1 bg-slate-100 dark:bg-zinc-900/80">
                                      <FilterSelect
                                        label=""
                                        options={detalhadaDescricoesOptions}
                                        selectedValues={colFilterDetalhadaDescricao}
                                        onChange={setColFilterDetalhadaDescricao}
                                        searchable={true}
                                      />
                                    </td>
                                    <td className="px-2 py-1 text-center bg-slate-100 dark:bg-zinc-900/80">
                                      <FilterSelect
                                        label=""
                                        options={detalhadaUnidadesOptions}
                                        selectedValues={colFilterDetalhadaUnidade}
                                        onChange={setColFilterDetalhadaUnidade}
                                      />
                                    </td>
                                    <td className="px-2 py-1 bg-slate-100 dark:bg-zinc-900/80">
                                      {/* Qtd Nec */}
                                    </td>
                                    <td className="px-2 py-1 bg-slate-100 dark:bg-zinc-900/80">
                                      {/* Separado */}
                                    </td>
                                    <td className="px-2 py-1 bg-slate-100 dark:bg-zinc-900/80">
                                      {/* A Separar */}
                                    </td>
                                    <td className="px-2 py-1 bg-slate-100 dark:bg-zinc-900/80">
                                      {/* Estoque Disp */}
                                    </td>
                                    <td className="px-2 py-1 bg-slate-100 dark:bg-zinc-900/80">
                                      {/* Saldo */}
                                    </td>
                                    <td className="px-2 py-1 bg-slate-100 dark:bg-zinc-900/80">
                                       <select
                                         value={globalStatusFilter}
                                         onChange={e => setGlobalStatusFilter(e.target.value as any)}
                                         className="w-full h-8 px-1 text-xs border dark:border-zinc-800 rounded bg-white dark:bg-zinc-900 text-slate-700 dark:text-slate-200 outline-none font-normal shadow-sm"
                                       >
                                         <option value="todos">Todos</option>
                                         <option value="disponivel">Disponíveis</option>
                                         <option value="falta">Em falta</option>
                                       </select>
                                    </td>
                                    <td className="px-2 py-1 bg-slate-100 dark:bg-zinc-900/80">
                                      <FilterSelect
                                        label=""
                                        options={detalhadaGruposOptions}
                                        selectedValues={colFilterDetalhadaGrupo}
                                        onChange={setColFilterDetalhadaGrupo}
                                        searchable={true}
                                      />
                                    </td>
                                  </tr>
                                </thead>
                                <tbody className="divide-y text-xs">
                                  {prog.materiais.length === 0 ? (
                                    <tr>
                                      <td colSpan={12} className="px-4 py-6 text-center text-muted-foreground">
                                        Nenhum material encontrado ou liberado para os pontos desta obra.
                                      </td>
                                    </tr>
                                  ) : (
                                    prog.materiais.map((m, idx) => (
                                      <tr 
                                        key={idx} 
                                        className={`hover:bg-slate-50/50 dark:hover:bg-zinc-900/50 border-b dark:border-zinc-900 ${!m.liberado ? 'opacity-40 bg-slate-50/10 dark:bg-zinc-900/10' : ''}`}
                                      >
                                        <td className="px-4 py-2.5 font-bold text-slate-700 dark:text-slate-300">{m.equipe}</td>
                                        <td className="px-4 py-2.5 font-bold font-mono text-slate-800 dark:text-slate-200">{m.pontoObra}</td>
                                        <td className="px-4 py-2.5 font-mono font-bold text-violet-600 dark:text-violet-400">{m.codigo}</td>
                                        <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-200">
                                          {m.descricao}
                                          {m.semRegra && (
                                            <Badge variant="outline" className="ml-2 text-[9px] border-amber-300 dark:border-amber-900 text-amber-700 dark:text-amber-450 bg-amber-50 dark:bg-amber-950/20">
                                              sem regra
                                            </Badge>
                                          )}
                                        </td>
                                        <td className="px-4 py-2.5 text-center font-bold text-slate-500 dark:text-slate-400">{m.unidade}</td>
                                        <td className="px-4 py-2.5 text-right font-black text-slate-950 dark:text-slate-100 bg-slate-50/30 dark:bg-zinc-900/30">{formatQtd(m.quantidade)}</td>
                                        <td className="px-4 py-2.5 text-right font-bold text-slate-650 dark:text-slate-350 bg-blue-50/20 dark:bg-blue-950/10">{formatQtd(m.qtdJaFornecida || 0)}</td>
                                        <td className="px-4 py-2.5 text-right font-black text-slate-900 dark:text-slate-100 bg-amber-50/20 dark:bg-amber-950/10">{formatQtd(m.qtdASeparar || 0)}</td>
                                        <td className="px-4 py-2.5 text-right font-bold text-slate-600 dark:text-slate-400 bg-slate-50/20 dark:bg-zinc-900/20">{formatQtd(m.estoque)}</td>
                                        <td className={`px-4 py-2.5 text-right font-black ${m.saldo < 0 ? 'text-rose-600 bg-rose-50/20 dark:text-rose-400 dark:bg-rose-950/20' : 'text-emerald-700 bg-emerald-50/10 dark:text-emerald-400 dark:bg-emerald-950/10'}`}>
                                          {formatQtd(m.saldo)}
                                        </td>
                                        <td className="px-4 py-2.5">
                                          {m.liberado ? (
                                            !m.disponivel ? (
                                              <span className="text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1">
                                                <AlertCircle className="h-3 w-3" />
                                                Em falta
                                              </span>
                                            ) : (
                                              <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                                                <CheckCircle2 className="h-3 w-3" />
                                                Disponível
                                              </span>
                                            )
                                          ) : (
                                            <span className="text-slate-400 flex items-center gap-1" title={m.motivoNaoLiberado}>
                                              <HelpCircle className="h-3 w-3" />
                                              Retido
                                            </span>
                                          )}
                                        </td>
                                        <td className="px-4 py-2.5">
                                          <Badge variant="outline" className={`font-bold text-[10px] ${getGrupoColorClasses(m.grupoTraduzido)}`}>
                                            {m.grupoTraduzido}
                                          </Badge>
                                        </td>
                                      </tr>
                                    ))
                                  )}
                                </tbody>
                              </table>
                            </div>

                          </div>
                        ))
                      )
                    )}
                  </div>
                )}

              </div>

            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal de Detalhes dos KPIs (Separação) */}
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
