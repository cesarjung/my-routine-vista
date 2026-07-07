import React, { useState, useMemo } from 'react';
import { useMateriaisData, getProximoDiaUtil } from '@/hooks/useMateriaisData';
import { useSessionState } from '@/hooks/useSessionState';
import { useSyncPlanejamento } from '@/hooks/usePlanejamentoRaw';
import { format, parse, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  RefreshCw, Filter, Calendar, Download, Printer, 
  AlertTriangle, ClipboardList, Info, CheckCircle2, 
  HelpCircle, Search, FileText, Layers, Loader2
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

export const PlanejamentoMateriaisView = () => {
  // Filtro de Unidades
  const [selectedUnidades, setSelectedUnidades] = useSessionState<string[]>('filter_unidades_materiais', []);
  const [draftUnidadesIds, setDraftUnidadesIds] = useState<string[]>(selectedUnidades);
  const [unidadesDropdownOpen, setUnidadesDropdownOpen] = useState(false);

  // Filtros principais
  const [filterDate, setFilterDate] = useSessionState<string>('filter_date_materiais', '');
  const [filterEquipe, setFilterEquipe] = useSessionState<string>('filter_equipe_materiais', 'TODAS');
  const [filterObra, setFilterObra] = useSessionState<string>('filter_obra_materiais', '');
  
  // Abas de visualização
  const [viewTab, setViewTab] = useState<'consolidada' | 'detalhada'>('consolidada');
  // Termo de pesquisa para os materiais
  const [searchQuery, setSearchQuery] = useState('');

  const activeUnits = selectedUnidades.length === 0 
    ? UNIDADES_PLANEJAMENTO.map(u => u.id)
    : selectedUnidades;

  const defaultDate = useMemo(() => format(getProximoDiaUtil(), 'yyyy-MM-dd'), []);

  // Busca dados de materiais
  const { data, isLoading } = useMateriaisData(activeUnits, {
    data: filterDate || defaultDate,
    equipe: filterEquipe,
    obra: filterObra
  });

  const { mutate: syncPlanejamento, isPending: isSyncing } = useSyncPlanejamento();

  // Lista única de equipes da programação do período para preencher o filtro
  const equipesDisponiveis = useMemo(() => {
    if (!data?.programacoes) return [];
    const equipes = new Set<string>();
    data.programacoes.forEach(prog => {
      if (prog.equipe) equipes.add(prog.equipe);
    });
    return Array.from(equipes).sort();
  }, [data]);

  // Filtra itens consolidados pela pesquisa
  const filteredConsolidado = useMemo(() => {
    if (!data?.consolidado) return [];
    const query = searchQuery.trim().toLowerCase();
    if (!query) return data.consolidado;
    return data.consolidado.filter(
      item => 
        item.codigo.toLowerCase().includes(query) || 
        item.descricao.toLowerCase().includes(query) ||
        item.grupoTraduzido.toLowerCase().includes(query)
    );
  }, [data, searchQuery]);

  // Filtra programações detalhadas pela pesquisa
  const filteredDetalhado = useMemo(() => {
    if (!data?.programacoes) return [];
    const query = searchQuery.trim().toLowerCase();
    if (!query) return data.programacoes;

    return data.programacoes.map(prog => {
      const filteredMats = prog.materiais.filter(
        m => 
          m.codigo.toLowerCase().includes(query) || 
          m.descricao.toLowerCase().includes(query) ||
          m.grupoTraduzido.toLowerCase().includes(query)
      );
      return {
        ...prog,
        materiais: filteredMats
      };
    }).filter(prog => prog.materiais.length > 0 || prog.pontosList.some(p => p.toLowerCase().includes(query)));
  }, [data, searchQuery]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCsv = () => {
    if (!data?.consolidado || data.consolidado.length === 0) return;
    
    // Cabeçalho do CSV
    let csvContent = "data:text/csv;charset=utf-8,Codigo,Descricao,Unidade,Quantidade,Grupo,Origens\n";
    
    data.consolidado.forEach(item => {
      const origens = item.pontosOrigem.map(p => `${p.obra} (${p.ponto})`).join(' | ');
      const descEscaped = `"${item.descricao.replace(/"/g, '""')}"`;
      const origEscaped = `"${origens.replace(/"/g, '""')}"`;
      csvContent += `${item.codigo},${descEscaped},${item.unidade},${item.quantidadeTotal},${item.grupoTraduzido},${origEscaped}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const filename = `Separacao_Materiais_${filterDate || defaultDate}_${filterEquipe}.csv`;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const selectedDateFormatted = useMemo(() => {
    const dStr = filterDate || defaultDate;
    const parsed = parse(dStr, 'yyyy-MM-dd', new Date());
    if (isValid(parsed)) {
      return format(parsed, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    }
    return dStr;
  }, [filterDate, defaultDate]);

  const totalMateriaisLiberadosCount = useMemo(() => {
    if (!data?.consolidado) return 0;
    return data.consolidado.reduce((acc, curr) => acc + curr.quantidadeTotal, 0);
  }, [data]);

  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto w-full min-h-screen">
      
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
        
        <div className="flex items-center gap-2">
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
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
          
          {/* Unidades */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-500">Unidades</label>
            <DropdownMenu open={unidadesDropdownOpen} onOpenChange={setUnidadesDropdownOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full justify-between h-9 text-left font-normal truncate">
                  {selectedUnidades.length === 0 
                    ? "Todas as Unidades" 
                    : `${selectedUnidades.length} selecionada(s)`}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="start">
                {UNIDADES_PLANEJAMENTO.map((unidade) => (
                  <DropdownMenuCheckboxItem
                    key={unidade.id}
                    checked={draftUnidadesIds.includes(unidade.id)}
                    onCheckedChange={(checked) => {
                      let updated: string[];
                      if (checked) {
                        updated = [...draftUnidadesIds, unidade.id];
                      } else {
                        updated = draftUnidadesIds.filter(id => id !== unidade.id);
                      }
                      setDraftUnidadesIds(updated);
                    }}
                  >
                    {unidade.label}
                  </DropdownMenuCheckboxItem>
                ))}
                <div className="p-2 border-t flex justify-end gap-2 bg-slate-50 dark:bg-slate-900">
                  <Button 
                    size="xs" 
                    variant="ghost" 
                    onClick={() => {
                      setDraftUnidadesIds([]);
                      setSelectedUnidades([]);
                      setUnidadesDropdownOpen(false);
                    }}
                  >
                    Limpar
                  </Button>
                  <Button 
                    size="xs" 
                    onClick={() => {
                      setSelectedUnidades(draftUnidadesIds);
                      setUnidadesDropdownOpen(false);
                    }}
                  >
                    Aplicar
                  </Button>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Data */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-500">Data Programada</label>
            <div className="relative">
              <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                type="date"
                className="pl-9 h-9"
                value={filterDate || defaultDate}
                onChange={(e) => setFilterDate(e.target.value)}
              />
            </div>
          </div>

          {/* Equipe */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-500">Equipe</label>
            <select
              className="h-9 px-3 border rounded-md bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              value={filterEquipe}
              onChange={(e) => setFilterEquipe(e.target.value)}
            >
              <option value="TODAS">Todas as Equipes</option>
              {equipesDisponiveis.map(eq => (
                <option key={eq} value={eq}>{eq}</option>
              ))}
            </select>
          </div>

          {/* Obra */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-500">Filtrar por Obra</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Ex: B-1134618"
                className="pl-9 h-9"
                value={filterObra}
                onChange={(e) => setFilterObra(e.target.value)}
              />
            </div>
          </div>

        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-violet-600" />
          <p className="text-muted-foreground animate-pulse text-sm">Buscando e processando materiais de planejamento...</p>
        </div>
      ) : (
        <div id="print-area" className="flex flex-col gap-6">
          
          {/* Alertas Importantes de Qualidade de Dados */}
          {(data?.pontosSemOrcamento && data.pontosSemOrcamento.length > 0) && (
            <div className="bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-900 rounded-lg p-4 flex gap-3 text-amber-800 dark:text-amber-300 no-print">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500 mt-0.5" />
              <div>
                <h4 className="font-bold text-sm">Pontos Sem Orçamento Identificados</h4>
                <p className="text-xs mt-1 text-amber-700 dark:text-amber-400">
                  Os seguintes pontos estão programados, mas não possuem correspondência na planilha de materiais:
                </p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {data.pontosSemOrcamento.map(key => (
                    <Badge key={key} variant="outline" className="bg-amber-100/50 border-amber-300 text-xs font-medium text-amber-900 dark:text-amber-200">
                      {key}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}

          {data?.programacoes.some(p => p.byVazio) && (
            <div className="bg-blue-50 border border-blue-200 dark:bg-blue-950/20 dark:border-blue-900 rounded-lg p-4 flex gap-3 text-blue-800 dark:text-blue-300 no-print">
              <Info className="h-5 w-5 shrink-0 text-blue-500 mt-0.5" />
              <div>
                <h4 className="font-bold text-sm">Programação sem Filtros de Materiais (BY Vazio)</h4>
                <p className="text-xs mt-1 text-blue-700 dark:text-blue-400">
                  Algumas programações selecionadas foram agendadas sem a coluna BY de liberação de materiais (comum em programações antigas). Para estas, todos os materiais associados aos pontos serão listados sem filtragem.
                </p>
              </div>
            </div>
          )}

          {/* Resumo do Romaneio */}
          <Card className="border-slate-200 shadow-md">
            <CardHeader className="bg-slate-50/50 border-b py-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-800">
                    <ClipboardList className="h-5 w-5 text-indigo-600" />
                    Romaneio de Separação
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Dia: <span className="font-semibold text-slate-800">{selectedDateFormatted}</span>
                    {filterEquipe !== 'TODAS' && (
                      <>
                        {' '}| Equipe: <span className="font-semibold text-slate-800">{filterEquipe}</span>
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
                <div className="p-4 rounded-xl bg-slate-50 border flex flex-col">
                  <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Programações</span>
                  <span className="text-2xl font-bold mt-1 text-slate-800">{data?.programacoes.length || 0}</span>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border flex flex-col">
                  <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Pontos Total</span>
                  <span className="text-2xl font-bold mt-1 text-slate-800">
                    {data?.programacoes.reduce((acc, curr) => acc + curr.pontosList.length, 0) || 0}
                  </span>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border flex flex-col">
                  <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Itens Únicos Liberados</span>
                  <span className="text-2xl font-bold mt-1 text-slate-800">{data?.consolidado.length || 0}</span>
                </div>
                <div className="p-4 rounded-xl bg-violet-50/50 border border-violet-100 flex flex-col">
                  <span className="text-xs text-violet-600 font-semibold uppercase tracking-wider">Qtd Total Separar</span>
                  <span className="text-2xl font-bold mt-1 text-violet-950">{totalMateriaisLiberadosCount}</span>
                </div>
              </div>

              {/* Tabela Principal */}
              <div className="flex flex-col gap-4">
                
                {/* Cabeçalho da visualização & pesquisa interna */}
                <div className="flex justify-between items-center gap-4 no-print">
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

                  <div className="relative max-w-xs w-full">
                    <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                    <Input
                      placeholder="Pesquisar material..."
                      className="pl-8 h-8 text-xs"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>

                {viewTab === 'consolidada' ? (
                  /* VISÃO CONSOLIDADA */
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 text-slate-600 uppercase text-xs font-bold border-b">
                        <tr>
                          <th className="px-4 py-3">Código</th>
                          <th className="px-4 py-3">Descrição</th>
                          <th className="px-4 py-3 text-center">Unidade</th>
                          <th className="px-4 py-3 text-right">Qtd Total</th>
                          <th className="px-4 py-3">Grupo Traduzido</th>
                          <th className="px-4 py-3 no-print">Pontos Origem</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {filteredConsolidado.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                              Nenhum material liberado para separação nesta seleção.
                            </td>
                          </tr>
                        ) : (
                          filteredConsolidado.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="px-4 py-3 font-mono font-bold text-violet-600">{item.codigo}</td>
                              <td className="px-4 py-3 font-medium text-slate-800">{item.descricao}</td>
                              <td className="px-4 py-3 text-center font-semibold text-slate-500">{item.unidade}</td>
                              <td className="px-4 py-3 text-right font-black text-slate-900 bg-slate-50/30">{item.quantidadeTotal}</td>
                              <td className="px-4 py-3">
                                <Badge variant="secondary" className="font-semibold text-xs text-indigo-700 bg-indigo-50 border-indigo-100">
                                  {item.grupoTraduzido}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 no-print text-xs text-slate-500 max-w-xs truncate">
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
                    {filteredDetalhado.length === 0 ? (
                      <div className="border rounded-lg py-12 text-center text-muted-foreground text-sm">
                        Nenhuma programação encontrada para esta seleção.
                      </div>
                    ) : (
                      filteredDetalhado.map(prog => (
                        <div key={prog.id} className="border rounded-lg overflow-hidden shadow-sm bg-white dark:bg-zinc-950">
                          
                          {/* Programacao Header */}
                          <div className="bg-slate-50/70 border-b px-4 py-3 flex flex-col md:flex-row md:justify-between md:items-center gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge className="bg-indigo-600 text-white font-bold text-xs">{prog.equipe}</Badge>
                              <span className="font-extrabold text-sm text-slate-900">{prog.obra}</span>
                              <span className="text-xs text-slate-500 font-medium">({prog.pontosList.length} ponto(s): {prog.pontosRaw})</span>
                            </div>
                            
                            <div className="flex flex-wrap items-center gap-1">
                              {prog.byVazio ? (
                                <Badge variant="destructive" className="text-xs font-semibold">BY Vazio (Não Filtrado)</Badge>
                              ) : (
                                prog.byGrupos.map(bg => (
                                  <Badge key={bg} variant="outline" className="bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-300 font-bold text-xs">
                                    {bg}
                                  </Badge>
                                ))
                              )}
                            </div>
                          </div>

                          <div className="p-3 text-xs text-slate-500 italic border-b bg-slate-50/20">
                            Atividades: {prog.descricaoAtividades || 'Nenhuma descrição fornecida'}
                          </div>

                          {/* Materiais da Programação */}
                          <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50/40 text-slate-500 uppercase text-[10px] font-bold border-b">
                              <tr>
                                <th className="px-4 py-2 w-24">Ponto</th>
                                <th className="px-4 py-2 w-28">Código</th>
                                <th className="px-4 py-2">Descrição</th>
                                <th className="px-4 py-2 text-center w-16">Unid</th>
                                <th className="px-4 py-2 text-right w-20">Qtd</th>
                                <th className="px-4 py-2 w-32">Grupo Mat.</th>
                                <th className="px-4 py-2 w-36">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y text-xs">
                              {prog.materiais.length === 0 ? (
                                <tr>
                                  <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                                    Nenhum material encontrado ou liberado para os pontos desta obra.
                                  </td>
                                </tr>
                              ) : (
                                prog.materiais.map((m, idx) => (
                                  <tr 
                                    key={idx} 
                                    className={`hover:bg-slate-50/50 ${!m.liberado ? 'opacity-40 bg-slate-50/10' : ''}`}
                                  >
                                    <td className="px-4 py-2.5 font-bold font-mono text-slate-800">{m.pontoObra}</td>
                                    <td className="px-4 py-2.5 font-mono font-bold text-violet-600">{m.codigo}</td>
                                    <td className="px-4 py-2.5 font-medium text-slate-800">
                                      {m.descricao}
                                      {m.semRegra && (
                                        <Badge variant="outline" className="ml-2 text-[9px] border-amber-300 text-amber-700 bg-amber-50">
                                          sem regra
                                        </Badge>
                                      )}
                                    </td>
                                    <td className="px-4 py-2.5 text-center font-bold text-slate-500">{m.unidade}</td>
                                    <td className="px-4 py-2.5 text-right font-black text-slate-900">{m.quantidade}</td>
                                    <td className="px-4 py-2.5">
                                      <span className="text-slate-500 font-semibold">
                                        {m.grupoTraduzido}
                                      </span>
                                    </td>
                                    <td className="px-4 py-2.5">
                                      {m.liberado ? (
                                        <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                                          <CheckCircle2 className="h-3 w-3" />
                                          Liberado
                                        </span>
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
                      ))
                    )}
                  </div>
                )}

              </div>

            </CardContent>
          </Card>

        </div>
      )}

    </div>
  );
};
