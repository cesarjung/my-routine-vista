import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, HardHat, FileSpreadsheet, Save, CheckCircle2, ChevronRight } from 'lucide-react';
import { fetchBDConfig, fetchAtividadesBase, PontoObraRow } from '@/services/googleSheets';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

const GRUPOS_POSSIVEIS = ['POSTE', 'CAVA', 'ESTRUTURA', 'ACABAMENTOS', 'EQUIPAMENTOS', 'CABO'];

interface FormularioPonto {
  variacao: string;
  gruposRequeridos: Set<string>;
  respostas: Record<string, string>;
  caboQuantidade: string;
}

export const LancamentosServicosView = () => {
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  // Dados carregados das planilhas
  const [bdConfigMap, setBdConfigMap] = useState<Map<string, string>>(new Map());
  const [atividadesBase, setAtividadesBase] = useState<PontoObraRow[]>([]);

  // Filtros
  const [selectedUnidade, setSelectedUnidade] = useState<string>('');
  const [selectedProjeto, setSelectedProjeto] = useState<string>('');
  const [selectedVariacoes, setSelectedVariacoes] = useState<string[]>([]);

  // Estado do formulário
  const [isFormLoaded, setIsFormLoaded] = useState(false);
  const [formularios, setFormularios] = useState<FormularioPonto[]>([]);

  // Carregar dados iniciais
  useEffect(() => {
    const carregarDados = async () => {
      setIsLoadingData(true);
      setDataError(null);
      try {
        const [configMap, baseData] = await Promise.all([
          fetchBDConfig(),
          fetchAtividadesBase()
        ]);
        setBdConfigMap(configMap);
        setAtividadesBase(baseData);
      } catch (err: any) {
        console.error("Erro ao carregar dados do Google Sheets:", err);
        setDataError(err.message || "Erro desconhecido ao carregar planilhas.");
        toast.error("Falha ao carregar dados. Verifique a permissão da planilha.");
      } finally {
        setIsLoadingData(false);
      }
    };

    carregarDados();
  }, []);

  // Listas derivadas para os selects
  const unidades = useMemo(() => {
    const set = new Set<string>();
    atividadesBase.forEach(row => set.add(row.unidade));
    return Array.from(set).sort();
  }, [atividadesBase]);

  const projetos = useMemo(() => {
    if (!selectedUnidade) return [];
    const set = new Set<string>();
    atividadesBase
      .filter(row => row.unidade === selectedUnidade)
      .forEach(row => set.add(row.projeto));
    return Array.from(set).sort();
  }, [atividadesBase, selectedUnidade]);

  const variacoes = useMemo(() => {
    if (!selectedProjeto) return [];
    const set = new Set<string>();
    atividadesBase
      .filter(row => row.projeto === selectedProjeto)
      .forEach(row => set.add(row.variacao));
    return Array.from(set).sort();
  }, [atividadesBase, selectedProjeto]);

  // Resets ao mudar filtros pai
  useEffect(() => {
    setSelectedProjeto('');
    setSelectedVariacoes([]);
    setIsFormLoaded(false);
  }, [selectedUnidade]);

  useEffect(() => {
    setSelectedVariacoes([]);
    setIsFormLoaded(false);
  }, [selectedProjeto]);

  useEffect(() => {
    setIsFormLoaded(false);
  }, [selectedVariacoes]);

  const toggleVariacao = (variacao: string) => {
    setSelectedVariacoes(prev => 
      prev.includes(variacao)
        ? prev.filter(v => v !== variacao)
        : [...prev, variacao]
    );
  };

  const selectAllVariacoes = () => {
    if (selectedVariacoes.length === variacoes.length) {
      setSelectedVariacoes([]);
    } else {
      setSelectedVariacoes([...variacoes]);
    }
  };

  const handleCarregar = () => {
    if (!selectedProjeto || selectedVariacoes.length === 0) return;

    // Gerar um formulário para cada variação selecionada
    const novosFormularios = selectedVariacoes.map(variacao => {
      // Achar todas as linhas desta variação
      const rowsDaVariacao = atividadesBase.filter(
        row => row.projeto === selectedProjeto && row.variacao === variacao
      );

      // Mapear quais grupos existem para essa variação
      const gruposEncontrados = new Set<string>();
      rowsDaVariacao.forEach(row => {
        const grupo = bdConfigMap.get(row.descricaoAtividade);
        if (grupo) {
          gruposEncontrados.add(grupo);
        }
      });

      // Iniciar respostas padrão
      const respostasIniciais: Record<string, string> = {};
      GRUPOS_POSSIVEIS.forEach(grupo => {
        if (!gruposEncontrados.has(grupo)) {
          respostasIniciais[grupo] = 'N/A';
        } else {
          respostasIniciais[grupo] = ''; // Para o usuário selecionar SIM/NÃO
        }
      });

      return {
        variacao,
        gruposRequeridos: gruposEncontrados,
        respostas: respostasIniciais,
        caboQuantidade: ''
      };
    });

    // Ordenar para exibição mais agradável
    novosFormularios.sort((a, b) => a.variacao.localeCompare(b.variacao));

    setFormularios(novosFormularios);
    setIsFormLoaded(true);
    toast.success(`${novosFormularios.length} pontos carregados com sucesso!`);
  };

  const handleRespostaChange = (formIndex: number, grupo: string, valor: string) => {
    setFormularios(prev => {
      const novos = [...prev];
      const form = { ...novos[formIndex] };
      form.respostas = { ...form.respostas, [grupo]: valor };
      if (grupo === 'CABO' && valor !== 'PARCIAL') {
        form.caboQuantidade = '';
      }
      novos[formIndex] = form;
      return novos;
    });
  };

  const handleCaboChange = (formIndex: number, valor: string) => {
    setFormularios(prev => {
      const novos = [...prev];
      novos[formIndex] = { ...novos[formIndex], caboQuantidade: valor };
      return novos;
    });
  };

  const handleSalvar = () => {
    // Validação de todos os formulários
    let temErro = false;
    
    formularios.forEach((form, idx) => {
      const faltantes = Array.from(form.gruposRequeridos).filter(g => !form.respostas[g]);
      if (faltantes.length > 0) {
        toast.warning(`Preencha todos os campos do ponto ${form.variacao || 'Base'} (${faltantes.join(', ')})`);
        temErro = true;
      }
      if (form.respostas['CABO'] === 'PARCIAL' && !form.caboQuantidade) {
        toast.warning(`Informe a quantidade parcial do CABO para o ponto ${form.variacao || 'Base'}`);
        temErro = true;
      }
    });

    if (temErro) return;

    const payload = formularios.map(form => ({
      unidade: selectedUnidade,
      projeto: selectedProjeto,
      variacao: form.variacao,
      respostas: form.respostas,
      caboQuantidade: form.respostas['CABO'] === 'PARCIAL' ? form.caboQuantidade : null,
      dataLancamento: new Date().toISOString()
    }));

    console.log("=== LANÇAMENTOS SALVOS EM LOTE ===", payload);
    toast.success(`${formularios.length} lançamentos salvos com sucesso (MVP Local)!`);
    
    // Opcional: limpar tela
    // setIsFormLoaded(false);
    // setSelectedVariacoes([]);
  };

  if (isLoadingData) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Sincronizando com Google Sheets...</p>
      </div>
    );
  }

  if (dataError) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full">
        <FileSpreadsheet className="w-12 h-12 text-red-500 mb-4 opacity-50" />
        <p className="text-destructive font-medium mb-2">Erro ao carregar dados</p>
        <p className="text-muted-foreground text-sm max-w-md text-center">{dataError}</p>
        <Button className="mt-4" onClick={() => window.location.reload()}>Tentar Novamente</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full pb-10 h-full overflow-y-auto pr-2 custom-scrollbar">
      
      {/* 1. FILTROS PRINCIPAIS */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl text-primary">
            <HardHat className="w-6 h-6" />
            Filtros da Obra
          </CardTitle>
          <CardDescription>
            Selecione a unidade e o projeto para visualizar os pontos disponíveis.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Unidade */}
            <div className="space-y-2">
              <Label>Unidade</Label>
              <Select value={selectedUnidade} onValueChange={setSelectedUnidade}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {unidades.map(u => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Projeto */}
            <div className="space-y-2">
              <Label>Projeto (Máscara)</Label>
              <Select 
                value={selectedProjeto} 
                onValueChange={setSelectedProjeto}
                disabled={!selectedUnidade}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {projetos.map(p => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. SELEÇÃO DE PONTOS (ABAIXO DOS FILTROS) */}
      {selectedProjeto && (
        <Card className="border-muted shadow-sm">
          <CardHeader className="bg-muted/10 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Selecione os Pontos</CardTitle>
                <CardDescription>
                  Marque um ou mais pontos para lançar os serviços.
                </CardDescription>
              </div>
              {variacoes.length > 0 && (
                <Button variant="outline" size="sm" onClick={selectAllVariacoes}>
                  {selectedVariacoes.length === variacoes.length ? 'Desmarcar Todos' : 'Marcar Todos'}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {variacoes.length === 0 ? (
              <div className="text-sm text-muted-foreground italic bg-muted/30 p-4 rounded-md border border-dashed text-center">
                Nenhum ponto encontrado para este projeto.
              </div>
            ) : (
              <ScrollArea className="max-h-[250px] w-full rounded-md border bg-card p-4">
                <div className="flex flex-row flex-wrap gap-3">
                  {variacoes.map(v => (
                    <div 
                      key={v} 
                      className={`flex items-center gap-2 p-2 rounded-lg border transition-all cursor-pointer hover:bg-muted/30 w-[100px] shrink-0 justify-center ${selectedVariacoes.includes(v) ? 'border-primary/50 bg-primary/5' : 'border-border'}`}
                      onClick={() => toggleVariacao(v)}
                    >
                      <Checkbox 
                        id={`var-${v}`} 
                        checked={selectedVariacoes.includes(v)}
                        onCheckedChange={() => toggleVariacao(v)}
                        className="scale-90"
                      />
                      <Label 
                        htmlFor={`var-${v}`} 
                        className="cursor-pointer font-medium text-sm leading-none truncate max-w-[6ch]"
                        title={v || 'Base'}
                      >
                        {v || 'Base'}
                      </Label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
          <CardFooter className="bg-muted/10 border-t flex justify-end p-4">
            <Button 
              onClick={handleCarregar} 
              disabled={selectedVariacoes.length === 0}
              className="gap-2"
            >
              Carregar {selectedVariacoes.length > 0 ? selectedVariacoes.length : ''} Formulários
              <ChevronRight className="w-4 h-4" />
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* 3. FORMULÁRIOS MÚLTIPLOS (OPÇÃO B) */}
      {isFormLoaded && (
        <div className="space-y-6">
          <div className="flex items-center justify-between pb-2 border-b">
            <h2 className="text-xl font-bold text-primary flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6" />
              Lançamentos para {selectedProjeto}
            </h2>
            <Button size="lg" onClick={handleSalvar} className="gap-2 font-semibold">
              <Save className="w-4 h-4" />
              Salvar Todos
            </Button>
          </div>

          {formularios.map((form, index) => (
            <Card key={form.variacao} className="border-primary/20 shadow-md">
              <CardHeader className="bg-primary/5 pb-4 border-b border-primary/10">
                <CardTitle className="text-lg">
                  Ponto: {form.variacao || 'Base'}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 grid gap-4">
                {GRUPOS_POSSIVEIS.map(grupo => {
                  const isRequerido = form.gruposRequeridos.has(grupo);
                  const valorAtual = form.respostas[grupo] || '';

                  return (
                    <div key={grupo} className={`p-4 rounded-lg border ${isRequerido ? 'border-border bg-card' : 'border-muted bg-muted/30 opacity-60'}`}>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <Label className="text-base font-semibold w-32 shrink-0">{grupo}</Label>
                        
                        <div className="flex-1">
                          {isRequerido ? (
                            <RadioGroup 
                              value={valorAtual} 
                              onValueChange={(val) => handleRespostaChange(index, grupo, val)}
                              className="flex flex-wrap gap-4"
                            >
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="SIM" id={`${form.variacao}-${grupo}-sim`} />
                                <Label htmlFor={`${form.variacao}-${grupo}-sim`} className="cursor-pointer font-medium text-green-600">SIM</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="NÃO" id={`${form.variacao}-${grupo}-nao`} />
                                <Label htmlFor={`${form.variacao}-${grupo}-nao`} className="cursor-pointer font-medium text-red-600">NÃO</Label>
                              </div>
                              
                              {grupo === 'CABO' && (
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="PARCIAL" id={`${form.variacao}-${grupo}-parcial`} />
                                  <Label htmlFor={`${form.variacao}-${grupo}-parcial`} className="cursor-pointer font-medium text-orange-500">PARCIAL</Label>
                                </div>
                              )}
                            </RadioGroup>
                          ) : (
                            <div className="text-sm font-medium text-muted-foreground italic px-2">
                              N/A (Não Aplicável)
                            </div>
                          )}
                        </div>

                        {/* Input adicional para CABO Parcial */}
                        {grupo === 'CABO' && valorAtual === 'PARCIAL' && (
                          <div className="sm:w-1/3 animate-in fade-in slide-in-from-left-2">
                            <Input 
                              type="number" 
                              placeholder="Qtd (m)" 
                              value={form.caboQuantidade}
                              onChange={(e) => handleCaboChange(index, e.target.value)}
                              className="border-orange-200 focus-visible:ring-orange-500"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
          
          <div className="flex justify-end pt-4">
            <Button size="lg" onClick={handleSalvar} className="gap-2 font-semibold">
              <Save className="w-5 h-5" />
              Salvar Lançamentos
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
