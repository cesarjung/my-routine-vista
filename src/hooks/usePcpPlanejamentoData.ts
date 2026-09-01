import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseMoedaPtBr } from './usePlanejamentoSemanal';

export interface PcpObra {
  projeto: string;
  nomeProjeto: string;
  municipio: string;
  supervisor: string;
  statusExecucao: string;
  dataInicio: string;
  dataFim: string;
  qtdOrcada: string;
  donoDaObra: string;
  prioridade: string;
  situacao: string; // 'APTA' | 'INAPTA'
  qtdPostesDisponiveis: number; // Coluna Y (index 24 em Carteira_Planejador)
  qtdCabosDisponiveis: number;  // Coluna AE (index 30 em Carteira_Planejador)
  valorConsiderado: number;     // Coluna AM (index 38 em Carteira_Planejador)
  carteirasStr: string;         // Coluna G (index 6 em Carteira_Planejador, ex: "mai./25, jun./25")
  meses: string[];              // Lista dos meses/carteira da obra
  latitude?: number | null;
  longitude?: number | null;
}

export interface PcpPontoItem {
  id: string;
  ponto: string;
  servico: string;
  codigoMaterial?: string;
  descricaoMaterial?: string;
  qtdOrcadaPonto: number;       // Coluna F: Qtd Prevista (orçada)
  etapaPrevista: string;         // Coluna BY: Etapa da atividade na base do pré-fechamento
  quantidade: number;           // Qtd a programar hoje
  tempoEstimadoMinutos: number; // Ex: 15 min
  valorEstimado: number;        // Ex: R$ 280.00
  valorUnitario?: number;       // Ex: R$ 67.64
  tempoUnitarioMinutos?: number;// Ex: 15 min
  selected: boolean;            // Checkbox se vai incluir no envio
  isBudgeted?: boolean;         // True se veio do orçamento do ponto
  usaRetro?: boolean;          // Checkbox se usa Retro na Cava
  tempoRetroMinutos?: number;  // Tempo adicional da Retro (padrão 30 min)
}

export interface PcpProgramacaoForm {
  unidadeId: string;
  dataProgramacao: string;
  dateObj?: Date;
  equipe: string;
  supervisor: string;
  encarregado?: string;
  obra: PcpObra;
  etapaGeral: string;
  pontos: PcpPontoItem[];
  isPes: boolean;
  reprogramar?: boolean;
  motivoReprogramacao?: string;
  motivoDescumprimento?: string;
  tempoDeslocamentoMinutos?: number;
  tempoSaidaBaseMinutos?: number;
  tempoSegurancaMinutos?: number;
  metaEquipeValor?: number;
  observacao?: string;
  alojamento?: string;
  alojamentoIda?: string;
  alojamentoVolta?: string;
}

export const MOTIVOS_REPROGRAMACAO_COL_AU = [
  'ATEND. EMERGENCIAL | EMERGENCIA',
  'CLIMA | SEM CONDIÇÕES P/ LV ATUAR',
  'COD | DEMANDA NÃO ATENDIDA',
  'GESTÃO CLIENTE | CARTEIRA/PROJETO ALTERADO FORA PRAZO',
  'GESTÃO OPERACIONAL | CAVA EM ROCHA/DISBAM',
  'GESTÃO OPERACIONAL | FALTA COLABORADOR',
  'GESTÃO OPERACIONAL | PRODUTIVIDADE',
  'GESTÃO OPERACIONAL | RETRO NÃO ATENDEU',
  'GESTÃO OPERACIONAL | SEM ACESSO',
  'GESTÃO OPERACIONAL | TSB ELEVADO',
  'GESTÃO OPERACIONAL | VEÍCULO',
  'GESTÃO OPERACIONAL | ALTERAÇÃO PLANEJAMENTO',
  'GESTÃO OPERACIONAL | ALTERAÇÃO PLANEJAMENTO - ATRASO DIA ANTERIOR',
  'GESTÃO OPERACIONAL | DESCARREGAR CARRETA',
  'GESTÃO OPERACIONAL | PARALIZAÇÃO SEGURANÇA',
  'GESTÃO OPERACIONAL | SEM ALOJAMENTO/FALTA DE KIT',
  'MATERIAL | RESERVAS NÃO ATENDIDAS A TEMPO',
  'MATERIAL | FALTA DE MATERIAL',
  'MATERIAL | NÃO ENVIADO/ENVIADO EM ATRASO',
  'MATERIAL | SEPARADO/ENVIADO ERRADO',
  'PCP - PLANEJAMENTO | CAVA EM ROCHA IDENTIFICADO NO DIA',
  'PCP - PLANEJAMENTO | DOCUMENTO PES C/ PROBLEMA',
  'PCP - PLANEJAMENTO | FALHA NO PLANEJAMENTO',
  'PCP - PLANEJAMENTO | NÃO REALIZ./PROBLEMA NO PRÉ-FECHAMENTO',
  'PCP - PLANEJAMENTO | NÃO REALIZADA/FALHA NA VISTORIA'
];

export interface ParsedAtividadeItem {
  id: string;
  ponto: string;
  etapa: string;
  servico: string;
  quantidade: number;
  tempoMinutos: number;
}

export interface ParsedPlanejamentoExistente {
  rowIdx: number;
  dataStr: string;        // "21/09/2026"
  dataCompleta: string;   // "21/09/2026 - segunda-feira"
  supervisor: string;
  equipe: string;
  projeto: string;
  pontosStr: string;      // "P1, P2"
  pontos: string[];       // ['P1', 'P2']
  municipio: string;
  etapasGeral: string[];  // ['IMPLANTAÇÃO', 'LINHA VIVA']
  isPes: boolean;
  compiladoAtividades: string;
  parsedAtividades: ParsedAtividadeItem[];
  tempoServicoMin: number;
  tempoDeslocamentoMin: number;
  tempoSaidaBaseMin: number;
  tempoSegurancaMin: number;
  metaEquipeValor: number;
  valorPlanejado: number;
  percentualCumprimento?: string; // Coluna AP (Index 41)
  motivoDescumprimento?: string;  // Coluna AU (Index 46)
  chaveBk: string;
  alojamento?: string;            // Resumo
  alojamentoIda?: string;         // Coluna BZ (Index 77)
  alojamentoVolta?: string;       // Coluna CA (Index 78)
}

export interface PlanPrincipalRow {
  index: number;
  data: string;
  supervisor: string;
  equipe: string;
  projeto: string;
  municipio: string;
  etapa: string;
  detalhesPontos: string;
}

export interface MaterialPontoBudget {
  id: string;
  ponto: string;
  codigo: string;
  descricao: string;
  quantidade: number;
  unidade: string;
  servicoPrevisto: string;
  etapaPrevista?: string; // From ATIVIDADES_POR_PONTO_BASE (Col C), optional for materiais fallback
  tempoMinutos: number;
  valorEstimado: number;
  valorUnitario?: number;
  tempoUnitarioMinutos?: number;
}

export const UNIDADES_DISPONIVEIS = [
  { id: '1rj2V7CxbZwkan63eCeLkH9G00Gi041IZNC6vwEgq6yI', name: 'BOM JESUS DA LAPA', sigla: 'BJL' },
  { id: '1OTHF2ytEOjGgfE49paARXkz9GjaklOQC_UhiXwUjC2E', name: 'BARREIRAS', sigla: 'BAR' },
  { id: '1FO5tyhXygbbzSmmTGdnm45j4DD_rRFQgEheN8T8Wy70', name: 'GUANAMBI', sigla: 'GNB' },
  { id: '1dNwj8qWTl1k92PxI9iXwaNZYITnxuKP-kOF1QnZK3Iw', name: 'IBOTIRAMA', sigla: 'IBO' },
  { id: '1sGHf-zWXoxjnO20QBw2KWX39BSCzT8rzHdEz1hL7jyU', name: 'JEQUIÉ', sigla: 'JEQ' },
  { id: '1XmpY8mqkRou-CRY68j1ljHH8W8zcROy7wnwMMSfbV7o', name: 'VITÓRIA DA CONQUISTA', sigla: 'VDC' },
  { id: '1rzT8o6XZi4v8j7CYLky3BD3sT5IPjv1PRb45ipBfbw4', name: 'ITAPETINGA', sigla: 'ITP' },
];

// LISTA OFICIAL DE ETAPAS EXTRAÍDA DIRETAMENTE DA ABA BD_CONFIG (COLUNA P / INDEX 15) DA PLANILHA SIRTEC
export const ETAPAS_PADRAO = [
  'ACABAMENTO',
  'ATENDIMENTO A OC',
  'ATERRAMENTO CERCA/EQ',
  'ATIVIDADE LV',
  'ATIVIDADE LV/EQUIPAMENTO',
  'CONCLUSÃO',
  'DESATIVAÇÃO DE REDE',
  'DESLIGAMENTO',
  'DESLIGAMENTO/CONCLUSÃO',
  'DESLOCAMENTO',
  'DISTRIBUIÇÃO/LOCAÇÃO',
  'DOMINGO/FERIADO',
  'EQUIPE PARADA',
  'ESCAVAÇÃO',
  'ESCAVAÇÃO/IMPLANTAÇÃO',
  'ESCAVAÇÃO/IMPLANTAÇÃO/LANÇAMENTO',
  'FOLGA',
  'FUNDAÇÃO',
  'IMPLANTAÇÃO',
  'IMPLANTAÇÃO/LANÇAMENTO',
  'INSTALAÇÃO/EQUIPAMENTO',
  'LANÇAMENTO DE CABO',
  'OFICINA',
  'PLANO DE MANUTENÇÃO',
  'PODA',
  'PREPARAÇÃO DESLIGAMENTO',
  'REALOCAÇÃO',
  'TREINAMENTO'
];

// LISTA DE ETAPAS QUE PODEM SER ENVIADAS SEM ATIVIDADES/PONTOS
export const ETAPAS_SEM_ATIVIDADES_OBRIGATORIAS = [
  'ATENDIMENTO A OC',
  'DESLOCAMENTO',
  'DOMINGO/FERIADO',
  'EQUIPE PARADA',
  'FOLGA',
  'OFICINA',
  'PLANO DE MANUTENÇÃO',
  'PODA',
  'PREPARAÇÃO DESLIGAMENTO',
  'REALOCAÇÃO',
  'TREINAMENTO'
];

export function isEtapaSemAtividades(etapa?: string): boolean {
  if (!etapa) return false;
  const upper = etapa.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  return ETAPAS_SEM_ATIVIDADES_OBRIGATORIAS.some(e => {
    const eNorm = e.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    return upper === eNorm || upper.includes(eNorm) || eNorm.includes(upper);
  });
}

// LISTA DE ETAPAS DAS ATIVIDADES DA BASE DO PRÉ-FECHAMENTO (COLUNA BY)
export const ETAPAS_ATIVIDADES_PRE_FECHAMENTO = [
  'ESCAVAÇÃO',
  'IMPLANTAÇÃO',
  'LANÇAMENTO DE CABO',
  'LINHA VIVA',
  'DESATIVAÇÃO DE REDE',
  'DESLIGAMENTO',
  'PODA',
  'REALOCAÇÃO DE REDE',
  'RECONDUTORAMENTO',
  'SUBSTITUIÇÃO DE TRAFO',
  'TRANSPORTE'
];

// Exact Column Header titles from line 5 of Plan_Principal sheet in Google Sheets (Col A to CA / index 0 to 78)
export const EXACT_PLAN_PRINCIPAL_HEADERS = [
  'Reprog.', 'Data', 'Inicio', 'Fim', 'Supervisor', 'Encarregado', 'Equipe', 'Projeto',
  'Observação', 'Titulo', 'Município', 'Prioridade', 'Etapa', 'Descrição PES',
  'Descrição do Serviço', 'Observações PaP', 'PES', 'CAVA NORMAL', 'CAVA EM ROCHA', 'FUNDAÇ. ESPECIAL',
  'IMPLANTAÇÃO', 'EQUIPAM.', 'ACABAMENTO', 'CABO BT (metros)', 'CABO 4 (metros)', 'CABO 1/0 (metros)',
  'CABO 4/0 (metros)', 'CABO 336 (metros)', 'CABO MT XLPE (metros)', 'PODA', 'ATER. CERCA',
  'EST. SIMPLES LV', 'EST. DUPLA LV', 'Nº FASES', '18', '19', 'ANALISAR PRODUÇÃO?',
  'Planejado R$', 'Meta R$', '% Plan.', 'Realizado Planejado (R$)', '% Cumprimento Planejado',
  'Produção GPM (R$)', '% Produção', 'Observações Equipe GPM', 'ANÁLISE REALIZADA?', 'Motivo da não conclusão',
  'PROJETO', 'Observações', 'PTs INSTALADOS', 'KM PRIM REAL', 'KM SEC REAL', 'Descrição Atividades',
  'Equipe disponível?', 'Motivo Indisponibilidade', 'Pontos Disponíveis (GPM)', 'Unidade Plan',
  '% Chuva', 'Prev. Descrição', 'Máscara & Obra & Ponto', 'Valida Importação', 'Máscara e Obra',
  'Equipe & Data', 'Tempo Serviço', 'Tempo Deslocamento', 'Tempo Saída Base', 'Tempo Segurança',
  'Tempo Total', 'Planejado TPM', 'Reserva Solicitada', 'Reserva Atendida', 'Vistoria',
  'Acesso', 'Alojamento', 'Materiais', 'Entrega na Obra', 'ETAPA MATERIAIS',
  'ALOJAMENTO IDA', 'ALOJAMENTO VOLTA'
];

// Helper to format quantity cleanly (integer if whole, 1 decimal if fraction) matching Prog_TPM macro:
export const formatQuantityDisplay = (qty: number): string => {
  const rounded = Math.round(qty * 100) / 100;
  return String(rounded);
};

// Helper para parsear string compilada da Coluna O da Plan_Principal em itens estruturados
export const parseCompiledAtividades = (compiledStr: string): ParsedAtividadeItem[] => {
  if (!compiledStr || !compiledStr.trim()) return [];
  const blocos = compiledStr.split(/\s*\|\s*/);
  const results: ParsedAtividadeItem[] = [];

  blocos.forEach((bloco, idx) => {
    const raw = bloco.trim();
    if (!raw || raw === '-') return;

    // 1. Extrair Ponto/Vão do início (ex: "P1 - ...", "V1-2 - ...", "V55-65 - ...")
    let ponto = 'P1';
    let restante = raw;

    const pontoMatch = restante.match(/^([P|V]\d+(?:-\d+)?|[A-Z0-9_-]+)\s*-\s*/i);
    if (pontoMatch) {
      ponto = pontoMatch[1].trim().toUpperCase();
      restante = restante.slice(pontoMatch[0].length).trim();
    }

    if (!restante) return;

    // 2. Extrair etapa entre colchetes se houver (ex: "[IMPLANTAÇÃO]")
    let etapa = 'IMPLANTAÇÃO';
    const etapaMatch = restante.match(/^\[([^\]]+)\]\s*/);
    if (etapaMatch) {
      etapa = etapaMatch[1].trim();
      restante = restante.slice(etapaMatch[0].length).trim();
    }

    // 3. Extrair Hr. Prev do final se houver (ex: "- Hr. Prev: 00:15")
    let tempoMinutos = 15;
    const hrMatch = restante.match(/-\s*Hr\.?\s*Prev:?\s*(\d{1,2}):(\d{2})/i);
    if (hrMatch) {
      const h = parseInt(hrMatch[1], 10) || 0;
      const m = parseInt(hrMatch[2], 10) || 0;
      tempoMinutos = h * 60 + m;
      restante = restante.replace(hrMatch[0], '').trim();
    }

    // 4. Extrair Qtd do final se houver (ex: "- Qtd: 1" ou "- Qtd: 61.4")
    let quantidade = 1;
    const qtdMatch = restante.match(/-\s*Qtd:?\s*([0-9.,]+)/i);
    if (qtdMatch) {
      quantidade = parseFloat(qtdMatch[1].replace(',', '.')) || 1;
      restante = restante.replace(qtdMatch[0], '').trim();
    }

    // 5. O que restou é a descrição do serviço
    let servico = restante.replace(/^-+\s*/, '').replace(/\s*-+$/, '').trim();
    if (!servico) {
      servico = 'ATIVIDADE PREVISTA';
    }

    // 6. Inferência de etapa se veio a padrão
    if (etapa === 'IMPLANTAÇÃO') {
      const sUpper = servico.toUpperCase();
      if (sUpper.includes('CABO') || sUpper.includes('CONDUTOR') || sUpper.includes('FIO') || ponto.startsWith('V')) {
        etapa = 'LANÇAMENTO DE CABO';
      } else if (sUpper.includes('LV') || sUpper.includes('LINHA VIVA')) {
        etapa = 'LINHA VIVA';
      } else if (sUpper.includes('PODA') || sUpper.includes('ÁRVORE') || sUpper.includes('ARVORE')) {
        etapa = 'PODA';
      } else if (sUpper.includes('ESCAVA') || sUpper.includes('ROCHA') || sUpper.includes('SOLO')) {
        etapa = 'ESCAVAÇÃO';
      } else if (sUpper.includes('DESLIG')) {
        etapa = 'DESLIGAMENTO';
      }
    }

    results.push({
      id: `parsed-${ponto}-${idx}`,
      ponto,
      etapa,
      servico,
      quantidade,
      tempoMinutos,
    });
  });

  return results;
};

// Helper to format date with weekday matching Sirtec sheet format: "16/08/2026 - domingo"
export const formatDateWithWeekday = (dateStr: string, dateObj?: Date): string => {
  if (!dateStr) return '';
  const weekdays = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

  let d = dateObj;
  if (!d && dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
    }
  }

  if (d && !isNaN(d.getTime())) {
    const dayName = weekdays[d.getDay()];
    return `${dateStr} - ${dayName}`;
  }

  return dateStr;
};

// Helper to infer Etapa (Coluna M) based on service type without leading numbers
export const inferEtapaFromServico = (servicoName: string): string => {
  const s = (servicoName || '').toUpperCase();
  if (s.includes(' LV') || s.includes('LINHA VIVA') || s.includes('LV/') || s.endsWith('LV')) {
    return 'ATIVIDADE LV';
  }
  if (s.includes('POSTE') || s.includes('DISTRIBUIÇÃO DE POSTES') || s.includes('ESTAI')) {
    return 'IMPLANTAÇÃO';
  }
  if (s.includes('CAVA') || s.includes('ESCAVA') || s.includes('ROCHA') || s.includes('SOLO')) {
    return 'ESCAVAÇÃO';
  }
  if (s.includes('ESTRUTURA') || s.includes('CRUZ') || s.includes('FERRAGEM') || s.includes('ISOLADOR') || s.includes('CHAVE') || s.includes('ACABAMENTO') || s.includes('ARMACAO')) {
    return 'ESTRUTURA';
  }
  if (s.includes('CABO') || s.includes('FIO') || s.includes('CONDUTOR') || s.includes('MULTIPLEX') || s.includes('TENSIONAR')) {
    return 'LANÇAMENTO DE CABO';
  }
  if (s.includes('TRAFO') || s.includes('TRANSFORMADOR') || s.includes('RELIGADOR') || s.includes('DESLIGAMENTO')) {
    return 'DESLIGAMENTO';
  }
  if (s.includes('PODA') || s.includes('ÁRVORE') || s.includes('ARVORE')) {
    return 'PODA';
  }
  return 'CONCLUSÃO';
};

// Helper to safely parse numeric values from sheet cells
const parseNumericCell = (val: any): number => {
  if (val === null || val === undefined) return 0;
  const s = String(val).trim().replace(',', '.');
  if (s.startsWith('#') || s === '-' || !s) return 0;
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};

export interface ServicoBase {
  codigo?: string;
  servico: string;
  tempoMinutosPorUnidade: number;
  valorPorUnidade: number;
}

export const sortPontosAndVaos = (a: string, b: string): number => {
  const isVaoA = (a || '').toUpperCase().startsWith('V');
  const isVaoB = (b || '').toUpperCase().startsWith('V');
  
  if (!isVaoA && isVaoB) return -1;
  if (isVaoA && !isVaoB) return 1;

  if (isVaoA && isVaoB) {
    const matchA = a.match(/V(\d+)(?:-(\d+))?/i);
    const matchB = b.match(/V(\d+)(?:-(\d+))?/i);
    const startA = matchA ? parseInt(matchA[1], 10) : 0;
    const startB = matchB ? parseInt(matchB[1], 10) : 0;
    if (startA !== startB) return startA - startB;
    const endA = matchA && matchA[2] ? parseInt(matchA[2], 10) : 0;
    const endB = matchB && matchB[2] ? parseInt(matchB[2], 10) : 0;
    return endA - endB;
  }

  const matchA = a.match(/P(\d+)/i);
  const matchB = b.match(/P(\d+)/i);
  if (matchA && matchB) {
    return parseInt(matchA[1], 10) - parseInt(matchB[1], 10);
  }

  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
};

// Status reais da aba Carteira_Planejador (coluna L / index 11)
export const ALL_STATUSES = [
  'EM EXECUÇÃO',
  'PROGRAMADA',
  'REPROGRAMADA',
  'SEM PROGR.',
  'INTERROMPIDA',
  'CONCLUÍDA',
];
// Status que vêm pré-selecionados por padrão (tudo exceto CONCLUÍDA)
export const DEFAULT_SELECTED_STATUSES = ALL_STATUSES.filter(s => s !== 'CONCLUÍDA');

export const usePcpPlanejamentoData = (
  selectedUnidadeId: string = '',
  selectedProjetoCode?: string
) => {
  const queryClient = useQueryClient();

  // Load raw cache from Supabase
  const rawCacheQuery = useQuery({
    queryKey: ['pcp-planejamento-cache', selectedUnidadeId],
    queryFn: async () => {
      if (!selectedUnidadeId) return null;
      const { data, error } = await supabase
        .from('planejamento_cache')
        .select('*')
        .eq('unidade_id', selectedUnidadeId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: Boolean(selectedUnidadeId),
    staleTime: 1000 * 60 * 5,
  });

  // Etapas oficiais extraídas da BD_Config Coluna P
  const etapasDisponiveis = useMemo(() => {
    return ETAPAS_PADRAO;
  }, []);

  // Parse bd_metas table to extract team goal values (Valor_Meta)
  const metasPorEquipeMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!rawCacheQuery.data?.bd_metas) return map;

    try {
      const rawStr = rawCacheQuery.data.bd_metas;
      const parsed = typeof rawStr === 'string' ? JSON.parse(rawStr) : rawStr;
      const rows = parsed?.bd_metas || [];

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < 4) continue;

        const eq = String(row[1] || '').trim().toUpperCase();
        const num = parseMoedaPtBr(row[3]);

        if (eq && num > 0) {
          map.set(eq, num);
        }
      }
    } catch (e) {
      console.error('Erro ao parsear bd_metas:', e);
    }

    return map;
  }, [rawCacheQuery.data]);

  // Parse BD_Config to extract Encarregado per Equipe (Coluna D=Equipe, Coluna E=Encarregado)
  const encarregadosPorEquipeMap = useMemo(() => {
    const map = new Map<string, string>();
    if (!rawCacheQuery.data?.bd_metas) return map;
    try {
      const rawStr = rawCacheQuery.data.bd_metas;
      const parsed = typeof rawStr === 'string' ? JSON.parse(rawStr) : rawStr;
      const bdConfigRows = parsed?.bd_config || [];

      for (let i = 2; i < bdConfigRows.length; i++) {
        const row = bdConfigRows[i];
        if (!row || row.length < 5) continue;
        const eq = String(row[3] || '').trim().toUpperCase();
        const enc = String(row[4] || '').trim();
        if (eq && enc && enc.toUpperCase() !== 'ENCARREGADO') {
          map.set(eq, enc);
        }
      }
    } catch (e) {
      console.error('Erro ao parsear encarregados de bd_config:', e);
    }
    return map;
  }, [rawCacheQuery.data]);

  // Parse BD_Config to extract official services catalog with correct times and values
  const servicosBase = useMemo(() => {
    const lista: ServicoBase[] = [];
    if (!rawCacheQuery.data?.bd_metas) return lista;

    try {
      const rawStr = rawCacheQuery.data.bd_metas;
      const parsed = typeof rawStr === 'string' ? JSON.parse(rawStr) : rawStr;
      const bdConfigRows = parsed?.bd_config || [];

      // Colunas: AK=36 (Código), AL=37 (Atividade), AO=40 (Tempo), AS=44 (Valor), AT=45 (Valor + Fator K)
      for (let i = 1; i < bdConfigRows.length; i++) {
        const row = bdConfigRows[i];
        if (!row || row.length < 38) continue;

        const codigo = String(row[36] || '').trim();
        const atividade = String(row[37] || '').trim().toUpperCase();
        const tempoStr = String(row[40] || '').trim();
        const valStr = String(row[44] || '').trim();
        const valKStr = String(row[45] || '').trim();
        
        if (!atividade || atividade === 'DESCRIÇÃO ATIVIDADE') continue;

        let tempoMinutos = 0;
        if (tempoStr) {
           const p = tempoStr.split(':');
           if (p.length === 3) {
             tempoMinutos = parseInt(p[0]||'0', 10) * 60 + parseInt(p[1]||'0', 10) + parseFloat(p[2]||'0') / 60;
           } else if (p.length === 2) {
             tempoMinutos = parseInt(p[0]||'0', 10) * 60 + parseInt(p[1]||'0', 10);
           } else if (p.length === 1 && parseFloat(p[0])) {
             tempoMinutos = parseFloat(p[0]);
           }
        }

        // Prioriza o Valor Contratual / Valor com Fator K da Unidade (Coluna AT / Index 45)
        let valor = 0;
        if (valKStr) {
           valor = parseMoedaPtBr(valKStr);
        }
        if (valor === 0 && valStr) {
           valor = parseMoedaPtBr(valStr);
        }

        lista.push({
          codigo,
          servico: atividade,
          tempoMinutosPorUnidade: tempoMinutos > 0 ? tempoMinutos : 15,
          valorPorUnidade: valor,
        });
      }
    } catch (e) {
      console.error('Erro ao parsear bd_config:', e);
    }
    
    if (lista.length === 0) {
      lista.push({ codigo: 'SIR0000001', servico: 'SUBSTITUIÇÃO DE POSTE', tempoMinutosPorUnidade: 60, valorPorUnidade: 100.0 });
    }
    
    return lista;
  }, [rawCacheQuery.data]);

  // Parse BD_Config to extract activity classification mappings (Coluna AL/37 -> Coluna AU/46)
  const atividadeGrupoMap = useMemo(() => {
    const map = new Map<string, string>();
    if (!rawCacheQuery.data?.bd_metas) return map;

    try {
      const rawStr = rawCacheQuery.data.bd_metas;
      const parsed = typeof rawStr === 'string' ? JSON.parse(rawStr) : rawStr;
      const bdConfigRows = parsed?.bd_config || [];

      for (let i = 1; i < bdConfigRows.length; i++) {
        const row = bdConfigRows[i];
        if (!row || row.length < 38) continue;
        const atividade = String(row[37] || '').trim().toUpperCase();
        const grupo = String(row[46] || '').trim().toUpperCase();
        if (atividade && atividade !== 'DESCRIÇÃO ATIVIDADE') {
          map.set(atividade, grupo === 'GRUPO' ? '' : grupo);
        }
      }
    } catch (e) {
      console.error('Erro ao mapear atividade -> grupo em bd_config:', e);
    }
    return map;
  }, [rawCacheQuery.data]);

  const codigoGrupoMap = useMemo(() => {
    const map = new Map<string, string>();
    if (!rawCacheQuery.data?.bd_metas) return map;

    try {
      const rawStr = rawCacheQuery.data.bd_metas;
      const parsed = typeof rawStr === 'string' ? JSON.parse(rawStr) : rawStr;
      const bdConfigRows = parsed?.bd_config || [];

      for (let i = 1; i < bdConfigRows.length; i++) {
        const row = bdConfigRows[i];
        if (!row || row.length < 38) continue;
        const codigo = String(row[36] || '').trim().toUpperCase();
        const grupo = String(row[46] || '').trim().toUpperCase();
        if (codigo && codigo !== '-') {
          map.set(codigo, grupo === 'GRUPO' ? '' : grupo);
        }
      }
    } catch (e) {
      console.error('Erro ao mapear codigo -> grupo em bd_config:', e);
    }
    return map;
  }, [rawCacheQuery.data]);

  const getGrupoAtividade = (servicoOuDesc: string, cod?: string): string => {
    const cleanDesc = (servicoOuDesc || '').trim().toUpperCase();
    const cleanCod = (cod || '').trim().toUpperCase();

    // 1. Match por código na BD_Config (Coluna AK / 36) -> Coluna AU / 46
    if (cleanCod && codigoGrupoMap.has(cleanCod)) {
      return codigoGrupoMap.get(cleanCod) || '';
    }

    // 2. Match por descrição exata na BD_Config Coluna AL (37) -> Coluna AU (46)
    if (atividadeGrupoMap.has(cleanDesc)) {
      return atividadeGrupoMap.get(cleanDesc) || '';
    }

    // 3. Match por prefixo / aproximação estrita na BD_Config
    for (const [ativBd, grp] of atividadeGrupoMap.entries()) {
      if (cleanDesc === ativBd || cleanDesc.startsWith(ativBd) || ativBd.startsWith(cleanDesc)) {
        return grp || '';
      }
    }

    // 4. Fallback estrito apenas para atividades não cadastradas na BD_Config
    if (/^(INSTALAR|SUBSTITUIR|IMPLANTAR)\s+POSTE/.test(cleanDesc)) return 'IMPLANT';
    if (/^CAVA EM ROCHA/.test(cleanDesc)) return 'CAVA EM ROCHA';
    if (/^CAVA NORMAL/.test(cleanDesc)) return 'CAVA NORMAL';
    if (/^(PODA|CORTE DE ARVORE)/.test(cleanDesc)) return 'PODA';
    if (/^INSTALAR\s+(TRAFO|TRANSFORMADOR|RELIGADOR|CELULA)/.test(cleanDesc)) return 'EQUIPAM.';
    if (/^INSTALAR\s+CABO\s+(MULTIPLEX|BT)/.test(cleanDesc)) return 'CABO BT (METROS)';
    if (/^INSTALAR\s+CABO\s+(AL\s+)?(CAA\s+)?4($|\s)/.test(cleanDesc)) return 'CABO 4 (METROS)';
    if (/^INSTALAR\s+CABO\s+(AL\s+)?(CAA\s+)?1\/0/.test(cleanDesc)) return 'CABO 1/0 (METROS)';
    if (/^INSTALAR\s+CABO\s+(AL\s+)?(CAA\s+)?4\/0/.test(cleanDesc)) return 'CABO 4/0 (METROS)';
    if (/^INSTALAR\s+CABO\s+(AL\s+)?(336|CAA\s+336)/.test(cleanDesc)) return 'CABO 336 (METROS)';
    if (/^INSTALAR\s+CABO\s+(COBERTO|XLPE|MT)/.test(cleanDesc)) return 'CABO MT XLPE (METROS)';
    if (/^INSTALAR\s+EST/.test(cleanDesc)) return 'ACABAM.';

    return '';
  };

  // Parse Carteira_Planejador (com Qtd Postes Col Y / Index 24, Qtd Cabos Col AE / Index 30, Mês Col G / Index 6)
  const obras = useMemo(() => {
    if (!rawCacheQuery.data?.carteira) return [];
    try {
      const carteiraRows: any[][] = JSON.parse(rawCacheQuery.data.carteira);
      if (!Array.isArray(carteiraRows) || carteiraRows.length < 7) return [];

      const result: PcpObra[] = [];
      // Identifica dinamicamente a coluna de Dono da Obra nos cabeçalhos da planilha ou usa Coluna BG (index 58)
      let colDonoIdx = 58; // Coluna BG (index 58)
      for (let r = 0; r < Math.min(6, carteiraRows.length); r++) {
        const headerRow = carteiraRows[r];
        if (Array.isArray(headerRow)) {
          const foundIdx = headerRow.findIndex(cell => {
            const str = String(cell || '').toUpperCase().trim();
            return str.includes('DONO DA OBRA') || str === 'DONO' || str.includes('DONO');
          });
          if (foundIdx !== -1) {
            colDonoIdx = foundIdx;
            break;
          }
        }
      }

      const mapProjetos = new Set<string>();

      for (let i = 6; i < carteiraRows.length; i++) {
        const row = carteiraRows[i];
        if (!row || !Array.isArray(row)) continue;

        const projeto = String(row[12] || '').trim();
        if (!projeto || mapProjetos.has(projeto)) continue;

        mapProjetos.add(projeto);

        const colApta = String(row[1] || '').trim();
        let situacao = 'APTA';
        if (colApta.includes('2') || colApta.toUpperCase().includes('INAPTA') || colApta.toUpperCase().includes('NÃO')) {
          situacao = 'INAPTA';
        }

        const carteirasStr = String(row[6] || '').trim(); // Coluna G (Index 6)
        const meses = carteirasStr
          ? carteirasStr.split(',').map(m => m.trim()).filter(Boolean)
          : [];

        let lat = Number(String(row[46] || '').replace(',', '.'));
        let lng = Number(String(row[47] || '').replace(',', '.'));

        const donoDaObraRaw = String(row[colDonoIdx] || '').trim();
        const prioridadeRaw = String(row[15] || '').trim();

        result.push({
          projeto,
          nomeProjeto: String(row[13] || row[14] || '').trim(),
          municipio: String(row[14] || '').trim(),
          statusExecucao: String(row[11] || 'EM ANDAMENTO').trim(),
          supervisor: String(row[32] || '').trim(),
          dataInicio: String(row[9] || '').trim(),
          dataFim: String(row[10] || '').trim(),
          qtdOrcada: String(row[3] || '0').trim(),
          donoDaObra: donoDaObraRaw || 'NÃO INFORMADO',
          prioridade: prioridadeRaw || 'SEM PRIORIDADE',
          situacao,
          qtdPostesDisponiveis: parseNumericCell(row[24]), // Coluna Y (PT DISP.)
          qtdCabosDisponiveis: parseNumericCell(row[30]),  // Coluna AE (CABO DISP.)
          valorConsiderado: parseNumericCell(row[38]),     // Coluna AM (VALOR CONSIDERADO)
          carteirasStr,
          meses,
          latitude: !isNaN(lat) && lat !== 0 ? lat : null,
          longitude: !isNaN(lng) && lng !== 0 ? lng : null,
        });
      }
      return result;
    } catch (e) {
      console.error('Erro ao parsear Carteira_Planejador para PCP:', e);
      return [];
    }
  }, [rawCacheQuery.data]);

  // Unique lists for Carteira filters (Meses, Municípios, Donos/Prioridades, Supervisores, Situações)
  const mesesCarteira = useMemo(() => {
    const setMeses = new Set<string>();
    obras.forEach(o => {
      o.meses.forEach(m => setMeses.add(m));
    });

    const parseMesToDate = (m: string) => {
      if (m === 'OBRA RETIRADA') return 0;
      try {
        const cleanStr = m.replace('./', ' ');
        return parse(cleanStr, 'MMM yy', new Date(), { locale: ptBR }).getTime();
      } catch (e) {
        return 0;
      }
    };

    return Array.from(setMeses).sort((a, b) => parseMesToDate(b) - parseMesToDate(a));
  }, [obras]);

  const municipiosCarteira = useMemo(() => {
    const setM = new Set<string>();
    obras.forEach(o => {
      if (o.municipio && o.municipio.trim()) setM.add(o.municipio.trim().toUpperCase());
    });
    return Array.from(setM).sort();
  }, [obras]);

  const prioridadesCarteira = useMemo(() => {
    const setP = new Set<string>();
    obras.forEach(o => {
      if (o.prioridade && o.prioridade.trim()) setP.add(o.prioridade.trim().toUpperCase());
    });
    return Array.from(setP).sort();
  }, [obras]);

  const donosCarteira = useMemo(() => {
    const setD = new Set<string>();
    obras.forEach(o => {
      if (o.donoDaObra && o.donoDaObra.trim() && o.donoDaObra !== 'NÃO INFORMADO') {
        setD.add(o.donoDaObra.trim().toUpperCase());
      }
    });
    return Array.from(setD).sort();
  }, [obras]);

  const supervisoresCarteira = useMemo(() => {
    const setSup = new Set<string>();
    obras.forEach(o => {
      if (o.supervisor && o.supervisor.trim()) {
        setSup.add(o.supervisor.trim().toUpperCase());
      }
    });
    return Array.from(setSup).sort();
  }, [obras]);

  // Dynamic unique status values extracted from real obra data
  const statusesCarteira = useMemo(() => {
    const setS = new Set<string>();
    obras.forEach(o => {
      const s = (o.statusExecucao || '').trim().toUpperCase();
      if (s) setS.add(s);
    });
    // Sort: CONCLUÍDA always last
    return Array.from(setS).sort((a, b) => {
      if (a === 'CONCLUÍDA') return 1;
      if (b === 'CONCLUÍDA') return -1;
      return a.localeCompare(b, 'pt-BR');
    });
  }, [obras]);

  // Parse Plan_Principal
  const programacoesAtivas = useMemo(() => {
    if (!rawCacheQuery.data?.principal) return [];
    try {
      const principalRows: any[][] = JSON.parse(rawCacheQuery.data.principal);
      if (!Array.isArray(principalRows) || principalRows.length < 6) return [];

      const result: PlanPrincipalRow[] = [];
      for (let i = 5; i < principalRows.length; i++) {
        const row = principalRows[i];
        if (!row || !Array.isArray(row)) continue;

        const dataStr = String(row[1] || '').trim();
        const supervisor = String(row[4] || row[3] || '').trim();
        const equipe = String(row[6] || row[5] || '').trim();
        const projeto = String(row[7] || row[12] || '').trim();
        const municipio = String(row[10] || row[14] || '').trim();
        const detalhesPontos = String(row[14] || row[15] || row[20] || '').trim();

        if (projeto || dataStr || detalhesPontos) {
          result.push({
            index: i,
            data: dataStr,
            supervisor,
            equipe,
            projeto,
            municipio,
            detalhesPontos,
          });
        }
      }
      return result;
    } catch (e) {
      console.error('Erro ao parsear Plan_Principal para PCP:', e);
      return [];
    }
  }, [rawCacheQuery.data]);

  // Extract unique Supervisors for this unit
  const supervisoresDisponiveis = useMemo(() => {
    const setSup = new Set<string>();

    obras.forEach(o => {
      if (o.supervisor && o.supervisor.trim() && o.supervisor.toUpperCase() !== 'NÃO INFORMADO') {
        setSup.add(o.supervisor.trim().toUpperCase());
      }
    });

    programacoesAtivas.forEach(p => {
      if (p.supervisor && p.supervisor.trim()) {
        setSup.add(p.supervisor.trim().toUpperCase());
      }
    });

    if (setSup.size === 0) {
      ['BARTOLOMEU', 'JOSE NILTON', 'ALFREDO', 'DANIEL', 'JHANATAN'].forEach(s => setSup.add(s));
    }

    return Array.from(setSup).sort();
  }, [obras, programacoesAtivas]);

  // Extract unique Equipes for this unit (from bd_metas and programacoesAtivas)
  const equipesDisponiveis = useMemo(() => {
    const setEq = new Set<string>();

    // 1. Extrai da tabela bd_metas da unidade selecionada
    if (rawCacheQuery.data?.bd_metas) {
      try {
        const rawStr = rawCacheQuery.data.bd_metas;
        const parsed = typeof rawStr === 'string' ? JSON.parse(rawStr) : rawStr;
        const rows = parsed?.bd_metas || [];
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length < 2) continue;
          const eq = String(row[1] || '').trim().toUpperCase();
          if (eq && eq !== 'EQUIPE' && eq !== 'TOTAL' && !eq.includes('TOTAL')) {
            setEq.add(eq);
          }
        }
      } catch (e) {
        console.error('Erro ao extrair equipes de bd_metas:', e);
      }
    }

    // 2. Extrai de programacoesAtivas da unidade
    programacoesAtivas.forEach(p => {
      if (p.equipe && p.equipe.trim()) {
        setEq.add(p.equipe.trim().toUpperCase());
      }
    });

    if (setEq.size === 0) {
      ['EH156', 'EH155', 'EH154', 'EH_PODA158'].forEach(e => setEq.add(e));
    }

    return Array.from(setEq).sort();
  }, [rawCacheQuery.data?.bd_metas, programacoesAtivas]);

  // Query point-by-point ATIVIDADES (from centralized ATIVIDADES_POR_PONTO_BASE sheet)
  // Primary: atividades_por_ponto table with pagination (clean activity data)
  // Fallback: materiais_por_ponto (raw materials — used only if primary is empty)
  const orcamentoPontosQuery = useQuery({
    queryKey: ['pcp-orcamento-pontos', selectedProjetoCode],
    enabled: !!selectedProjetoCode,
    queryFn: async () => {
      if (!selectedProjetoCode) return [];

      let cleanCode = selectedProjetoCode.trim();
      const rawNum = cleanCode.replace(/^[A-Z]-/, '').trim();
      const codeVariants = Array.from(new Set([cleanCode, `B-${rawNum}`, `B-0${rawNum}`, rawNum, `0${rawNum}`]));

      // === PRIMARY: atividades_por_ponto com busca paginada ===
      let allAtivs: any[] = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore && from < 100000) {
        const { data: pageData, error } = await supabase
          .from('atividades_por_ponto')
          .select('ponto_obra, etapa, codigo_atividade, descricao, quantidade, com_mascara, com_ponto_mascara, unidade_medida')
          .in('com_mascara', codeVariants)
          .range(from, from + batchSize - 1);

        if (error || !pageData || pageData.length === 0) {
          hasMore = false;
        } else {
          allAtivs.push(...pageData);
          if (pageData.length < batchSize) {
            hasMore = false;
          } else {
            from += batchSize;
          }
        }
      }

      if (allAtivs.length > 0) {
        return allAtivs.map((r: any) => ({ ...r, _source: 'atividades' }));
      }

      // === FALLBACK: materiais_por_ponto (raw materials, older source) ===
      const { data: dataComMascara } = await supabase
        .from('materiais_por_ponto')
        .select('*')
        .in('com_mascara', codeVariants)
        .limit(2000);

      if (dataComMascara && dataComMascara.length > 0) {
        return dataComMascara.map((r: any) => ({ ...r, _source: 'materiais' }));
      }

      // Last fallback: raw project code query
      from = 0;
      hasMore = true;
      let dataProjetoAll: any[] = [];
      while (hasMore && from < 100000) {
        const { data: dataProjeto, error } = await supabase
          .from('atividades_por_ponto')
          .select('ponto_obra, etapa, codigo_atividade, descricao, quantidade, com_mascara, com_ponto_mascara')
          .in('projeto', codeVariants)
          .range(from, from + batchSize - 1);

        if (error || !dataProjeto || dataProjeto.length === 0) {
          hasMore = false;
        } else {
          dataProjetoAll.push(...dataProjeto);
          if (dataProjeto.length < batchSize) {
            hasMore = false;
          } else {
            from += batchSize;
          }
        }
      }

      return (dataProjetoAll || []).map((r: any) => ({ ...r, _source: 'atividades' }));
    },
    staleTime: 1000 * 60 * 10,
  });

  // Aggregate budget data into unique ATIVIDADES per Ponto
  // Handles two sources:
  //   1. atividades_por_ponto (_source='atividades'): clean data, uses etapa+descricao directly
  //   2. materiais_por_ponto (_source='materiais'): raw materials, needs inference (fallback)
  const orcamentoPorPontoMap = useMemo(() => {
    const map = new Map<string, MaterialPontoBudget[]>();
    if (!orcamentoPontosQuery.data || orcamentoPontosQuery.data.length === 0) return map;

    const firstItem = orcamentoPontosQuery.data[0] as any;
    const isAtividadesSource = firstItem?._source === 'atividades';

    if (isAtividadesSource) {
      // === PATH 1: ATIVIDADES_POR_PONTO_BASE (clean, direct mapping) ===
      // Each row IS an activity: etapa, descricao, quantidade already correct
      // Group by ponto, dedup by exact (codigo + descricao + etapa) to prevent summing duplicate batch rows
      const pontoMap = new Map<string, Map<string, { qty: number; etapa: string; codigo: string; descricao: string }>>();

      orcamentoPontosQuery.data.forEach((item: any) => {
        let pontoRaw = String(item.ponto_obra || item.com_ponto_mascara || '').trim();
        if (pontoRaw.includes('_')) {
          pontoRaw = pontoRaw.split('_').pop() || pontoRaw;
        }
        if (!pontoRaw) pontoRaw = 'P1';
        const pontoKey = pontoRaw.toUpperCase();

        const descricao = String(item.descricao || '').trim().toUpperCase();
        if (!descricao) return;

        const etapa = String(item.etapa || '').trim();
        const codigo = String(item.codigo_atividade || '').trim();
        const qty = Math.max(1, Math.round(Number(item.quantidade) || 1));

        if (!pontoMap.has(pontoKey)) pontoMap.set(pontoKey, new Map());
        const atvsMap = pontoMap.get(pontoKey)!;

        // Dedup by composite key to protect against duplicate database rows
        const ativKey = `${codigo}___${descricao}___${etapa}`;
        if (!atvsMap.has(ativKey)) {
          atvsMap.set(ativKey, { qty, etapa, codigo, descricao });
        }
      });

      pontoMap.forEach((atvsMap, pontoKey) => {
        const list: MaterialPontoBudget[] = [];
        atvsMap.forEach((info) => {
          const cod = String(info.codigo || '').trim();
          const descricao = info.descricao;
          const etapa = info.etapa;

          // 1. Match por código da atividade (ex: SIR0000001, SDEMU1004II)
          let foundServ = cod ? servicosBase.find(s => s.codigo && s.codigo === cod) : undefined;
          
          // 2. Match por descrição exata
          if (!foundServ) {
            foundServ = servicosBase.find(s => s.servico === descricao);
          }
          
          // 3. Match por aproximação / substring
          if (!foundServ) {
            foundServ = servicosBase.find(s => descricao.includes(s.servico) || s.servico.includes(descricao)) 
              || (servicosBase.length > 0 ? servicosBase[0] : { codigo: cod, servico: descricao, tempoMinutosPorUnidade: 15, valorPorUnidade: 0 });
          }

          const totalQty = Math.max(1, Math.round(info.qty));
          list.push({
            id: `${pontoKey}-${cod || 'NOCOD'}-${descricao.replace(/\s+/g, '_').slice(0, 30)}-${etapa.replace(/\s+/g, '_').slice(0, 15)}`,
            ponto: pontoKey,
            codigo: info.codigo,
            descricao,
            quantidade: totalQty,
            unidade: 'UND',
            servicoPrevisto: descricao, // Use description directly from sheet
            etapaPrevista: etapa,       // Etapa directly from sheet (Col C)
            tempoMinutos: Math.round(foundServ.tempoMinutosPorUnidade * totalQty),
            valorEstimado: Math.round(foundServ.valorPorUnidade * totalQty * 100) / 100,
            valorUnitario: foundServ.valorPorUnidade,
            tempoUnitarioMinutos: foundServ.tempoMinutosPorUnidade,
          });
        });
        if (list.length > 0) map.set(pontoKey, list);
      });

    } else {
      // === PATH 2: MATERIAIS_POR_PONTO (fallback — raw materials, needs inference) ===
      const pontoAtividadesMap = new Map<string, Map<string, number[]>>();

      orcamentoPontosQuery.data.forEach((item: any) => {
        let pontoRaw = String(item.ponto_obra || item.mascara_e_ponto || '').trim();
        if (pontoRaw.includes('_')) pontoRaw = pontoRaw.split('_').pop() || pontoRaw;
        if (!pontoRaw) pontoRaw = 'P1';
        const pontoKey = pontoRaw.toUpperCase();
        const desc = String(item.descricao || '').toUpperCase();
        const itemQty = Number(item.quantidade || 1);

        let servico = '';
        let isPrimaryItem = false;

        if (desc.includes('POSTE')) {
          servico = (desc.includes('14M') || desc.includes('14 METRO') || desc.includes('15/') || desc.includes('16/'))
            ? 'INSTALAR POSTE 14 METROS OU SUPERIOR' : 'INSTALAR POSTE 9 A 14 METROS';
          isPrimaryItem = desc.includes('POSTE CONCRETO') || desc.includes('POSTE DE CONCRETO') || desc.includes('POSTE MADEIRA');
          if (!isPrimaryItem) servico = '';
        } else if (desc.includes('ESCAVA') || desc.includes('APILOA') || (desc.includes('CAVA') && !desc.includes('CABO'))) {
          servico = 'ESCAVAR SOLO NORMAL'; isPrimaryItem = true;
        } else if (desc.includes('ESTAI')) {
          servico = 'INSTALAR ESTAI EM SOLO'; isPrimaryItem = true;
        } else if (desc.includes('CABO') || desc.includes('MPLX') || desc.includes('MULTIPLEXADO')) {
          servico = 'LANÇAMENTO DE CABO MULTIPLEXADO'; isPrimaryItem = desc.includes('CABO') || desc.includes('FIO');
        } else if (desc.includes('TRAFO') || desc.includes('TRANSFORMADOR')) {
          servico = 'INSTALAR TRAFO MONOFASICO'; isPrimaryItem = true;
        } else if (desc.includes('CHAVE') && desc.includes('FUSIVEL')) {
          servico = 'INSTALAR CHAVE FUSIVEL'; isPrimaryItem = true;
        } else if (desc.includes('CHAVE') && desc.includes('FACA')) {
          servico = 'INSTALAR CHAVE FACA'; isPrimaryItem = true;
        } else if (desc.includes('CRUZ') || desc.includes('CRUZETA')) {
          servico = 'INSTALAR EST CRUZ DUPLA 1 ANCORAGEM'; isPrimaryItem = true;
        }
        if (!servico || !isPrimaryItem) return;

        if (!pontoAtividadesMap.has(pontoKey)) pontoAtividadesMap.set(pontoKey, new Map());
        const ativsMap = pontoAtividadesMap.get(pontoKey)!;
        if (!ativsMap.has(servico)) ativsMap.set(servico, [itemQty]);
        else ativsMap.get(servico)!.push(itemQty);
      });

      pontoAtividadesMap.forEach((ativsMap, pontoKey) => {
        const list: MaterialPontoBudget[] = [];
        ativsMap.forEach((quantities, servico) => {
          const foundServ = servicosBase.find(s => s.servico === servico) || (servicosBase.length > 0 ? servicosBase[0] : { servico, tempoMinutosPorUnidade: 15, valorPorUnidade: 0 });
          const totalQty = Math.max(1, Math.round(quantities.reduce((a, b) => a + b, 0)));
          list.push({
            id: `${pontoKey}-${servico.replace(/\s+/g, '_')}`,
            ponto: pontoKey,
            codigo: '',
            descricao: servico,
            quantidade: totalQty,
            unidade: 'UNID',
            servicoPrevisto: servico,
            tempoMinutos: foundServ.tempoMinutosPorUnidade * totalQty,
            valorEstimado: foundServ.valorPorUnidade * totalQty,
            valorUnitario: foundServ.valorPorUnidade,
            tempoUnitarioMinutos: foundServ.tempoMinutosPorUnidade,
          });
        });
        if (list.length > 0) map.set(pontoKey, list);
      });
    }

    return map;
  }, [orcamentoPontosQuery.data, servicosBase]);

  // Unique budgeted point labels for the selected project (e.g. ['P1', 'P2', ..., 'V1-2', 'V2-3', ...])
  const pontosDisponiveisDoProjeto = useMemo(() => {
    const setPontos = new Set<string>(orcamentoPorPontoMap.keys());

    // Se a obra não tiver pontos orçados no pré-fechamento, usa os postes disponíveis da carteira como fallback
    if (setPontos.size === 0) {
      const selectedObra = obras.find(o => o.projeto === selectedProjetoCode);
      const qtdPostes = Math.max(1, selectedObra?.qtdPostesDisponiveis || 1);
      for (let i = 1; i <= qtdPostes; i++) {
        setPontos.add(`P${i}`);
      }
    }

    return Array.from(setPontos).sort(sortPontosAndVaos);
  }, [orcamentoPorPontoMap, obras, selectedProjetoCode]);

  // Function to generate filename timestamp format: UNIDADE_ddmmhhmmss.csv (ex: BJL_1608140345.csv)
  const generateCsvFilename = (unidadeId: string) => {
    const u = UNIDADES_DISPONIVEIS.find(x => x.id === unidadeId) || UNIDADES_DISPONIVEIS[0];
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const sec = String(now.getSeconds()).padStart(2, '0');
    return `${u.sigla}_${dd}${mm}${hh}${min}${sec}.csv`;
  };

  // Helper to build CSV content string with exact 78 Plan_Principal headers for single or multiple rows
  const buildCsvContent = (rows: any[][]): string => {
    const lines = rows.map(fullRow => {
      return fullRow.map(val => {
        const s = String(val ?? '');
        if (s.includes(';') || s.includes('"') || s.includes('\n')) {
          return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
      }).join(';');
    });
    return EXACT_PLAN_PRINCIPAL_HEADERS.join(';') + '\n' + lines.join('\n');
  };

  // Helper to generate a single 78-column row for a form item
  const buildPlanPrincipalRow = (form: PcpProgramacaoForm): any[] => {
    const unidadeObj = UNIDADES_DISPONIVEIS.find(u => u.id === form.unidadeId) || UNIDADES_DISPONIVEIS[0];
    const nomeUnidadePlanejadaUpper = unidadeObj.name.toUpperCase();

    let cleanEtapaGeral = (form.etapaGeral || 'IMPLANTAÇÃO').trim();
    cleanEtapaGeral = cleanEtapaGeral
      .split(/[,/]/)
      .map(e => e.trim().replace(/^\d+\s*-\s*/, '').trim())
      .filter(Boolean)
      .join('/');
    if (!cleanEtapaGeral) cleanEtapaGeral = 'IMPLANTAÇÃO';

    const isSemAtivPermitido = isEtapaSemAtividades(cleanEtapaGeral) || isEtapaSemAtividades(form.etapaGeral);
    const selectedPontos = (form.pontos || []).filter(p => p.selected);

    if (selectedPontos.length === 0 && !isSemAtivPermitido) {
      throw new Error(`Nenhuma atividade selecionada para a equipe ${form.equipe} em ${form.dataProgramacao}.`);
    }

    let tempoAtividadesMin = 0;
    let valorTotalAtividades = 0;
    let qtdPostes = 0;
    let qtdEquipamentos = 0;
    let qtdEstruturas = 0;
    let qtdCabosBt = 0;
    let qtdCabos4 = 0;
    let qtdCabos10 = 0;
    let qtdCabosMtXlpe = 0;
    let qtdPoda = 0;
    let qtdCavaRocha = 0;

    const blocos = selectedPontos.map(p => {
      const h = Math.floor(p.tempoEstimadoMinutos / 60);
      const m = p.tempoEstimadoMinutos % 60;
      const hrPrevStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      const qtdStr = formatQuantityDisplay(p.quantidade);

      tempoAtividadesMin += p.tempoEstimadoMinutos;
      valorTotalAtividades += p.valorEstimado;

      let cleanEtapaPonto = (p.etapaPrevista || cleanEtapaGeral).trim();
      if (/^\d+\s*-\s*/.test(cleanEtapaPonto)) {
        cleanEtapaPonto = cleanEtapaPonto.replace(/^\d+\s*-\s*/, '').trim();
      }

      // Classificar a quantidade utilizando estritamente a BD_Config (Coluna AL -> Coluna AU)
      const grupo = getGrupoAtividade(p.servico || p.descricao || '', (p as any).codigo || (p as any).codigoMaterial || (p as any).codigoAtividade || '');
      const qtd = Number(p.quantidade || 1);

      if (grupo === 'IMPLANT' || grupo === 'IMPLANTAÇÃO' || grupo === 'POSTE') {
        qtdPostes += qtd;
      } else if (grupo === 'EQUIPAM.' || grupo === 'EQUIPAMENTO' || grupo === 'EQUIPAMENTOS') {
        qtdEquipamentos += qtd;
      } else if (grupo === 'ACABAM.' || grupo === 'ACABAMENTO' || grupo === 'EST. DUPLA LV' || grupo === 'EST. SIMPLES LV') {
        qtdEstruturas += qtd;
      } else if (grupo === 'CABO BT (METROS)' || grupo === 'CABO BT') {
        qtdCabosBt += qtd;
      } else if (grupo === 'CABO 4 (METROS)' || grupo === 'CABO 4') {
        qtdCabos4 += qtd;
      } else if (grupo === 'CABO 1/0 (METROS)' || grupo === 'CABO 1/0') {
        qtdCabos10 += qtd;
      } else if (grupo === 'CABO MT XLPE (METROS)' || grupo === 'CABO MT XLPE') {
        qtdCabosMtXlpe += qtd;
      } else if (grupo === 'PODA') {
        qtdPoda += qtd;
      } else if (grupo === 'CAVA EM ROCHA') {
        qtdCavaRocha += qtd;
      }

      return `${p.ponto} - [${cleanEtapaPonto}] ${p.servico} - Qtd: ${qtdStr} - Hr. Prev: ${hrPrevStr}`;
    });

    const compiledStr = blocos.join(' | ');
    const formattedDateWithDay = formatDateWithWeekday(form.dataProgramacao, form.dateObj);

    const encarregado = form.encarregado || encarregadosPorEquipeMap.get((form.equipe || '').trim().toUpperCase()) || '';
    const titulo = form.obra.nomeProjeto || (form.obra as any).titulo || (form.obra as any).descricao || '';
    const prioridade = form.obra.prioridade || '';

    const newRow = new Array(79).fill('');
    newRow[0] = form.reprogramar ? 'REPROGRAMADA' : '';    // Col A (0): Reprog.
    newRow[1] = form.dataProgramacao;                       // Col B (1): Data como valor de data puro (dd/MM/yyyy)
    newRow[4] = form.supervisor;                            // Col E (4): Supervisor
    newRow[5] = encarregado;                                // Col F (5): Encarregado
    newRow[6] = form.equipe;                                // Col G (6): Equipe
    newRow[7] = form.obra.projeto;                          // Col H (7): Projeto

    const pontosUnicos = Array.from(new Set(selectedPontos.map(p => p.ponto))).sort().join(', ');
    newRow[8] = pontosUnicos;                               // Col I (8): Resumo de Pontos
    newRow[9] = titulo;                                     // Col J (9): Titulo
    newRow[10] = form.obra.municipio;                       // Col K (10): Município da Obra
    newRow[11] = prioridade;                                // Col L (11): Prioridade
    newRow[12] = cleanEtapaGeral;                           // Col M (12): Etapa(s) Prevista(s) do Topo
    newRow[14] = compiledStr;                               // Col O (14): Compilado de atividades

    if (form.isPes) {
      newRow[16] = 'TRUE';                                  // Col Q (16): PES (Checkbox marcado como TRUE)
    }

    if (qtdCavaRocha > 0) newRow[18] = formatQuantityDisplay(qtdCavaRocha);       // Col S (18): CAVA EM ROCHA
    if (qtdPostes > 0) newRow[20] = formatQuantityDisplay(qtdPostes);             // Col U (20): IMPLANT. (Postes)
    if (qtdEquipamentos > 0) newRow[21] = formatQuantityDisplay(qtdEquipamentos); // Col V (21): EQUIPAM. (Trafos e Equipamentos)
    if (qtdEstruturas > 0) newRow[22] = formatQuantityDisplay(qtdEstruturas);     // Col W (22): ACABAM. (Estruturas / Acabamento)
    if (qtdCabosBt > 0) newRow[23] = formatQuantityDisplay(qtdCabosBt);           // Col X (23): CABO BT (metros)
    if (qtdCabos4 > 0) newRow[24] = formatQuantityDisplay(qtdCabos4);             // Col Y (24): CABO 4 (metros)
    if (qtdCabos10 > 0) newRow[25] = formatQuantityDisplay(qtdCabos10);           // Col Z (25): CABO 1/0 (metros)
    if (qtdCabosMtXlpe > 0) newRow[28] = formatQuantityDisplay(qtdCabosMtXlpe);   // Col AC (28): CABO MT XLPE (metros)
    if (qtdPoda > 0) newRow[29] = formatQuantityDisplay(qtdPoda);                 // Col AD (29): PODA

    newRow[36] = 'NÃO';                                     // Col AK (36): ANALISAR PRODUÇÃO?
    newRow[37] = `R$ ${valorTotalAtividades.toFixed(2)}`;   // Col AL (37): Valor Planejado
    
    const metaVal = form.metaEquipeValor || 4442;
    newRow[38] = `R$ ${metaVal.toFixed(2)}`;                // Col AM (38): Valor da Meta da Equipe

    const pctMeta = metaVal > 0 ? (valorTotalAtividades / metaVal * 100) : 0;
    const pctMetaFormatted = `${pctMeta.toFixed(1)}%`;
    newRow[39] = pctMetaFormatted;                          // Col AN (39): Percentual Planejado da Meta

    if (form.reprogramar) {
      newRow[46] = '';                                      // Col AU (46): Vazio na Plan_Principal (motivo vai apenas para Reprogramadas)
    } else if (form.motivoDescumprimento) {
      newRow[46] = form.motivoDescumprimento;               // Col AU (46): Motivo Descumprimento
    }

    newRow[56] = nomeUnidadePlanejadaUpper;                 // Col BE (56): Unidade Planejada
    
    const cleanDateNum = form.dataProgramacao.replace(/\//g, '');
    newRow[62] = `${form.equipe}_${cleanDateNum}`;          // Col BK: Chave Equipe & Data

    const tSaidaBase = form.tempoSaidaBaseMinutos || 15;
    const tDesloc = form.tempoDeslocamentoMinutos || 30;
    const tSeg = form.tempoSegurancaMinutos || 15;

    const hAtiv = Math.floor(tempoAtividadesMin / 60);
    const mAtiv = tempoAtividadesMin % 60;
    newRow[63] = `${String(hAtiv).padStart(2, '0')}:${String(mAtiv).padStart(2, '0')}:00`; // Col BL (63): Tempo de Serviço

    const hDesl = Math.floor(tDesloc / 60);
    const mDesl = tDesloc % 60;
    newRow[64] = `${String(hDesl).padStart(2, '0')}:${String(mDesl).padStart(2, '0')}:00`; // Col BM (64): Tempo Deslocamento

    newRow[65] = `00:${String(tSaidaBase).padStart(2, '0')}:00`;                           // Col BN (65): Tempo Saída Base

    newRow[66] = `00:${String(tSeg).padStart(2, '0')}:00`;                                 // Col BO (66): Tempo Segurança

    const tTotalGeral = tempoAtividadesMin + tDesloc + tSaidaBase + tSeg;
    const hTot = Math.floor(tTotalGeral / 60);
    const mTot = tTotalGeral % 60;
    newRow[67] = `${String(hTot).padStart(2, '0')}:${String(mTot).padStart(2, '0')}:00`; // Col BP (67): Tempo Total Geral Somado

    newRow[68] = `R$ ${valorTotalAtividades.toFixed(2)}`;   // Col BQ (68): Planejado TPM (Valor Planejado em R$)

    const etapasAtividadesUnicas = Array.from(
      new Set(
        selectedPontos
          .map(p => (p.etapaPrevista || '').replace(/^\d+\s*-\s*/, '').trim())
          .filter(Boolean)
      )
    );
    newRow[76] = etapasAtividadesUnicas.length > 0 ? etapasAtividadesUnicas.join('/') : ''; // Col BY (76): ETAPA MATERIAIS (apenas etapas dos pontos com materiais)

    newRow[77] = form.alojamentoIda || form.alojamento || ''; // Col BZ (77): Alojamento de Ida
    newRow[78] = form.alojamentoVolta || form.alojamento || ''; // Col CA (78): Alojamento de Volta

    return newRow;
  };

  // Mutation to append new daily schedule(s) to Plan_Principal atomically in a single CSV batch
  const salvarProgramacao = useMutation({
    mutationFn: async (input: PcpProgramacaoForm | PcpProgramacaoForm[] | { forms: PcpProgramacaoForm[]; deletedSchedules?: any[] }) => {
      let formsArray: PcpProgramacaoForm[] = [];
      let deletedSchedules: any[] = [];

      if (input && typeof input === 'object' && 'forms' in input && Array.isArray((input as any).forms)) {
        formsArray = (input as any).forms;
        deletedSchedules = (input as any).deletedSchedules || [];
      } else if (Array.isArray(input)) {
        formsArray = input;
      } else if (input) {
        formsArray = [input as PcpProgramacaoForm];
      }

      if (formsArray.length === 0 && deletedSchedules.length === 0) {
        throw new Error('Nenhum dado informado para envio.');
      }

      const allNewRows = formsArray.map(form => buildPlanPrincipalRow(form));
      const firstForm = formsArray[0];
      const targetUnidadeId = firstForm?.unidadeId || selectedUnidadeId;
      const unidadeObj = UNIDADES_DISPONIVEIS.find(u => u.id === targetUnidadeId) || UNIDADES_DISPONIVEIS[0];

      // Generate filename with pattern UNIDADE_ddmmhhmmss.csv
      const csvFilename = generateCsvFilename(targetUnidadeId);
      const csvContent = formsArray.length > 0 ? buildCsvContent(allNewRows) : EXACT_PLAN_PRINCIPAL_HEADERS.join(';') + '\n';

      const isReprogramar = formsArray.some(f => Boolean(f.reprogramar));
      const motivo = formsArray.find(f => Boolean(f.motivoReprogramacao))?.motivoReprogramacao || '';

      // 1. DISPARO AO BACKEND (Vercel Serverless / Local) PARA SALVAR NO GOOGLE DRIVE E COLAR NA PLAN_PRINCIPAL DO SHEETS
      const apiRes = await fetch('/api/salvar-programacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvFilename,
          csvContent,
          unitSigla: unidadeObj.sigla,
          reprogramar: isReprogramar,
          motivo: motivo,
          deletedSchedules: deletedSchedules,
        }),
      });
      const apiData = await apiRes.json().catch(() => ({}));
      if (!apiRes.ok || apiData.success === false) {
        throw new Error(apiData?.error || `Falha ao gravar no Google Sheets/Drive (Status HTTP ${apiRes.status})`);
      }

      // 2. Dispara sincronização em segundo plano do cache da unidade para manter Supabase idêntico ao Google Sheets
      try {
        await fetch('/api/sync-pcp-cache', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ unitSigla: unidadeObj.sigla }),
        });
      } catch (syncErr) {
        console.warn('Sync cache disparado com aviso:', syncErr);
      }

      return { csvFilename, totalRows: allNewRows.length };
    },
    onMutate: () => {
      toast.loading('Enviando programação para a Plan_Principal no Google Sheets...', { id: 'salvar-programacao' });
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['pcp-planejamento-cache', selectedUnidadeId] });
      queryClient.invalidateQueries({ queryKey: ['planejamento-cache-raw'] });
      toast.success(`Programação gravada com sucesso na Plan_Principal! (CSV ${result.csvFilename})`, { id: 'salvar-programacao' });
    },
    onError: (err: any) => {
      console.error('Erro ao salvar programação no PCP:', err);
      toast.error('Erro ao salvar programação: ' + (err.message || err), { id: 'salvar-programacao' });
    },
  });

  // Lista de planejamentos existentes carregados do cache da Plan_Principal
  const planejamentosExistentesList = useMemo<ParsedPlanejamentoExistente[]>(() => {
    if (!rawCacheQuery.data?.principal) return [];
    try {
      const rawStr = rawCacheQuery.data.principal;
      const rows: any[][] = typeof rawStr === 'string' ? JSON.parse(rawStr) : rawStr;
      if (!Array.isArray(rows)) return [];

      const result: ParsedPlanejamentoExistente[] = [];
      rows.forEach((row, idx) => {
        if (!Array.isArray(row) || row.length < 15) return;
        const dataCompleta = String(row[1] || '').trim();
        const equipe = String(row[6] || '').trim();
        const projeto = String(row[7] || '').trim();
        if (!dataCompleta || !equipe || !projeto) return;

        const dataMatch = dataCompleta.match(/(\d{2}\/\d{2}\/\d{4})/);
        const dataStr = dataMatch ? dataMatch[1] : dataCompleta;

        const supervisor = String(row[4] || '').trim();
        const pontosStr = String(row[8] || '').trim();
        const pontos = pontosStr ? pontosStr.split(/[,/]/).map(p => p.trim().toUpperCase()).filter(Boolean) : [];
        const municipio = String(row[10] || '').trim();
        const etapasStr = String(row[12] || '').trim();
        const etapasGeral = etapasStr ? etapasStr.split(/[,/]/).map(e => e.trim()).filter(Boolean) : ['IMPLANTAÇÃO'];
        const compiladoAtividades = String(row[14] || '').trim();
        const isPes = String(row[16] || '').trim().toUpperCase() === 'TRUE';

        const valorPlanRaw = String(row[37] || '').replace(/[^0-9.,]/g, '').replace(',', '.');
        const valorPlanejado = parseFloat(valorPlanRaw) || 0;

        const metaRaw = String(row[38] || '').replace(/[^0-9.,]/g, '').replace(',', '.');
        const metaEquipeValor = parseFloat(metaRaw) || 4442;

        const chaveBk = String(row[62] || '').trim();

        const parseTimeToMin = (tStr: string) => {
          if (!tStr) return 0;
          const parts = tStr.split(':');
          const h = parseInt(parts[0], 10) || 0;
          const m = parseInt(parts[1], 10) || 0;
          return h * 60 + m;
        };

        const tempoServicoMin = parseTimeToMin(String(row[63] || ''));
        const tempoDeslocamentoMin = parseTimeToMin(String(row[64] || ''));
        const tempoSaidaBaseMin = parseTimeToMin(String(row[65] || ''));
        const tempoSegurancaMin = parseTimeToMin(String(row[66] || ''));

        // Coluna AP (Index 41): Percentual de Cumprimento
        const percCumprimentoRaw = String(row[41] || '').trim();
        let percentualCumprimento = '';
        if (percCumprimentoRaw) {
          const num = parseFloat(percCumprimentoRaw.replace('%', '').replace(',', '.').trim());
          if (!isNaN(num)) {
            percentualCumprimento = num <= 1 && num > 0 ? `${(num * 100).toFixed(0)}%` : `${num.toFixed(0)}%`;
          } else {
            percentualCumprimento = percCumprimentoRaw;
          }
        }

        // Coluna AU (Index 46): Motivo Descumprimento
        const motivoDescumprimento = String(row[46] || '').trim();

        const parsedAtividades = parseCompiledAtividades(compiladoAtividades);

        // Se houver pontos no compilado que não constavam na Col I, inclui
        parsedAtividades.forEach(a => {
          if (a.ponto && !pontos.includes(a.ponto)) {
            pontos.push(a.ponto);
          }
        });

        // Coluna BZ (Index 77): Alojamento de Ida | Coluna CA (Index 78): Alojamento de Volta
        const alojamentoIda = String(row[77] || '').trim();
        const alojamentoVolta = String(row[78] || '').trim();
        const alojamento = alojamentoIda === alojamentoVolta
          ? alojamentoIda
          : (alojamentoIda && alojamentoVolta ? `${alojamentoIda} ➔ ${alojamentoVolta}` : (alojamentoIda || alojamentoVolta));

        result.push({
          rowIdx: idx,
          dataStr,
          dataCompleta,
          supervisor,
          equipe,
          projeto,
          pontosStr: pontos.join(', '),
          pontos,
          municipio,
          etapasGeral,
          isPes,
          compiladoAtividades,
          parsedAtividades,
          tempoServicoMin,
          tempoDeslocamentoMin,
          tempoSaidaBaseMin,
          tempoSegurancaMin,
          metaEquipeValor,
          valorPlanejado,
          percentualCumprimento,
          motivoDescumprimento,
          chaveBk,
          alojamento,
          alojamentoIda,
          alojamentoVolta,
        });
      });

      return result.reverse(); // Mais recentes primeiro
    } catch (e) {
      console.error('Erro ao parsear planejamentos existentes da Plan_Principal:', e);
      return [];
    }
  }, [rawCacheQuery.data?.principal]);

  return {
    rawCacheQuery,
    obras,
    programacoesAtivas,
    planejamentosExistentesList,
    supervisoresDisponiveis,
    equipesDisponiveis,
    etapasDisponiveis,
    mesesCarteira,
    municipiosCarteira,
    prioridadesCarteira,
    donosCarteira,
    supervisoresCarteira,
    statusesCarteira,
    metasPorEquipeMap,
    encarregadosPorEquipeMap,
    orcamentoPontosQuery,
    orcamentoPorPontoMap,
    pontosDisponiveisDoProjeto,
    salvarProgramacao,
    servicosBase: servicosBase || [],
  };
};
