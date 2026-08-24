import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
}

export interface PcpProgramacaoForm {
  unidadeId: string;
  dataProgramacao: string; // Ex: "16/08/2026"
  dateObj?: Date;
  supervisor: string;
  equipe: string;
  etapa: string;
  obra: PcpObra;
  pontos: PcpPontoItem[];
  isPes?: boolean;
  reprogramar?: boolean;
  motivoReprogramacao?: string;
  tempoDeslocamentoMinutos?: number;
  tempoSaidaBaseMinutos?: number;
  tempoSegurancaMinutos?: number;
  metaEquipeValor?: number;
  observacao?: string;
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
  chaveBk: string;
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

// Exact Column Header titles from line 4 of Plan_Principal sheet in Google Sheets
export const EXACT_PLAN_PRINCIPAL_HEADERS = [
  'SELECIONAR', 'DATA', 'Inicio', 'Fim', 'Supervisor', 'Encarregado', 'Equipe', 'Projeto',
  'Observação', 'Titulo', 'Município', 'Prioridade', 'Etapa', 'Descrição PES',
  'Descrição do Serviço', 'Pontos/Vãos', '', '', 'CAVA EM ROCHA', '',
  '', '', '', '', '', '', '', '',
  '', '', '', '', 'EST. DUPLA LV', 'Nº FASES', '', '',
  'ANALISAR PRODUÇÃO?', '', '', '', '', '', '', '',
  'Observações Equipe GPM', 'ANÁLISE REALIZADA?', 'Motivo da não conclusão', 'PROJETO', 'Observações', '',
  '', '', 'Descrição Atividades', '', 'Motivo Indisponibilidade', 'Pontos Disponíveis (GPM)', 'Unidade Plan',
  '% Chuva', 'Prev. Descrição', 'Máscara & Obra & Ponto', '', 'Máscara e Obra', 'Equipe & Data', '',
  '', '', '', '', '', '', '', '',
  'Acesso', 'Alojamento', 'Materiais', 'Entrega na Obra', ''
];

// Helper to format quantity cleanly (integer if whole, 1 decimal if fraction) matching Prog_TPM macro:
export const formatQuantityDisplay = (qty: number): string => {
  const rounded = Math.round(qty * 100) / 100;
  return String(rounded);
};

// Helper para parsear string compilada da Coluna O da Plan_Principal em itens estruturados
export const parseCompiledAtividades = (compiledStr: string): ParsedAtividadeItem[] => {
  if (!compiledStr) return [];
  const blocos = compiledStr.split(/\s*\|\s*/);
  return blocos.map((bloco, idx) => {
    // Formato padrão: P1 - [ETAPA] SERVICO - Qtd: X - Hr. Prev: hh:mm
    const m = bloco.match(/^([^-]+?)\s*-\s*(?:\[([^\]]+)\]\s*)?(.+?)\s*-\s*Qtd:\s*([0-9.,]+)\s*-\s*Hr\.\s*Prev:\s*(\d{1,2}):(\d{2})/i);
    if (m) {
      const ponto = m[1].trim().toUpperCase();
      const etapa = (m[2] || 'IMPLANTAÇÃO').trim();
      const servico = m[3].trim();
      const qtd = parseFloat(m[4].replace(',', '.')) || 1;
      const h = parseInt(m[5], 10) || 0;
      const min = parseInt(m[6], 10) || 0;
      return {
        id: `parsed-${ponto}-${idx}`,
        ponto,
        etapa,
        servico,
        quantidade: qtd,
        tempoMinutos: h * 60 + min,
      };
    } else {
      const parts = bloco.split(/\s*-\s*/);
      const ponto = parts[0]?.trim().toUpperCase() || 'P1';
      return {
        id: `fallback-${idx}`,
        ponto,
        etapa: 'IMPLANTAÇÃO',
        servico: bloco.trim(),
        quantidade: 1,
        tempoMinutos: 15,
      };
    }
  });
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
  if (s.includes('POSTE') || s.includes('ESCAVA') || s.includes('CAVA') || s.includes('DISTRIBUIÇÃO DE POSTES') || s.includes('ESTAI')) {
    return 'IMPLANTAÇÃO';
  }
  if (s.includes('ESTRUTURA') || s.includes('CRUZ') || s.includes('FERRAGEM') || s.includes('ISOLADOR') || s.includes('CHAVE')) {
    return 'ESTRUTURA';
  }
  if (s.includes('CABO') || s.includes('FIO') || s.includes('CONDUTOR') || s.includes('MULTIPLEX') || s.includes('TENSIONAR')) {
    return 'LANÇAMENTO DE CABO';
  }
  if (s.includes('TRAFO') || s.includes('TRANSFORMADOR') || s.includes('RELIGADOR') || s.includes('DESLIGAMENTO')) {
    return 'DESLIGAMENTO';
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
        const valStr = String(row[3] || '').trim().replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
        const num = parseFloat(valStr) || 0;

        if (eq && num > 0) {
          map.set(eq, num);
        }
      }
    } catch (e) {
      console.error('Erro ao parsear bd_metas:', e);
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

        let valor = 0;
        if (valStr) {
           valor = parseFloat(valStr.replace('R$', '').replace(/\./g, '').replace(',', '.').trim()) || 0;
        }
        if (valor === 0 && valKStr) {
           valor = parseFloat(valKStr.replace('R$', '').replace(/\./g, '').replace(',', '.').trim()) || 0;
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
  // Primary: atividades_por_ponto table (clean activity data)
  // Fallback: materiais_por_ponto (raw materials — used only if primary is empty)
  const orcamentoPontosQuery = useQuery({
    queryKey: ['pcp-orcamento-pontos', selectedProjetoCode],
    enabled: !!selectedProjetoCode,
    queryFn: async () => {
      if (!selectedProjetoCode) return [];

      let cleanCode = selectedProjetoCode.trim();
      if (!cleanCode.startsWith('B-')) {
        cleanCode = `B-${cleanCode}`;
      }

      // === PRIMARY: atividades_por_ponto (ATIVIDADES_POR_PONTO_BASE) ===
      const { data: dataAtiv, error: errAtiv } = await supabase
        .from('atividades_por_ponto')
        .select('ponto_obra, etapa, codigo_atividade, descricao, quantidade, com_mascara, com_ponto_mascara, unidade_medida')
        .eq('com_mascara', cleanCode)
        .limit(2000);

      if (dataAtiv && dataAtiv.length > 0) {
        // Mark records as coming from the clean atividades source
        return dataAtiv.map((r: any) => ({ ...r, _source: 'atividades' }));
      }

      // === FALLBACK: materiais_por_ponto (raw materials, older source) ===
      const { data: dataComMascara } = await supabase
        .from('materiais_por_ponto')
        .select('*')
        .eq('com_mascara', cleanCode)
        .limit(1000);

      if (dataComMascara && dataComMascara.length > 0) {
        return dataComMascara.map((r: any) => ({ ...r, _source: 'materiais' }));
      }

      // Last fallback: raw project code without prefix
      const rawNum = selectedProjetoCode.replace(/^[A-Z]-/, '').trim();
      const { data: dataProjeto } = await supabase
        .from('atividades_por_ponto')
        .select('ponto_obra, etapa, codigo_atividade, descricao, quantidade, com_mascara, com_ponto_mascara')
        .eq('projeto', rawNum)
        .limit(2000);

      return (dataProjeto || []).map((r: any) => ({ ...r, _source: 'atividades' }));
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
      // Group by ponto, aggregate same descricao within same ponto
      const pontoMap = new Map<string, Map<string, { qty: number; etapa: string; codigo: string }>>();

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

        if (!atvsMap.has(descricao)) {
          atvsMap.set(descricao, { qty, etapa, codigo });
        } else {
          // Same activity appears multiple times in same ponto: sum quantities
          atvsMap.get(descricao)!.qty += qty;
        }
      });

      pontoMap.forEach((atvsMap, pontoKey) => {
        const list: MaterialPontoBudget[] = [];
        atvsMap.forEach((info, descricao) => {
          const cod = String(info.codigo || '').trim();

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
            id: `${pontoKey}-${descricao.replace(/\s+/g, '_').slice(0, 40)}`,
            ponto: pontoKey,
            codigo: info.codigo,
            descricao,
            quantidade: totalQty,
            unidade: 'UND',
            servicoPrevisto: descricao, // Use description directly from sheet
            etapaPrevista: info.etapa,  // Etapa directly from sheet (Col C)
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

  // Unique budgeted point labels for the selected project (e.g. ['P1', 'P2', 'P3', 'P4', 'P5'])
  const pontosDisponiveisDoProjeto = useMemo(() => {
    const setPontos = new Set<string>(orcamentoPorPontoMap.keys());

    // Se a obra tem X postes na carteira (ex: 5 postes), garante que P1..P5 existam na lista de opções
    const selectedObra = obras.find(o => o.projeto === selectedProjetoCode);
    const qtdPostes = Math.min(50, Math.max(1, selectedObra?.qtdPostesDisponiveis || 1));
    for (let i = 1; i <= qtdPostes; i++) {
      setPontos.add(`P${i}`);
    }

    return Array.from(setPontos).sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, '')) || 0;
      const numB = parseInt(b.replace(/\D/g, '')) || 0;
      return numA - numB;
    });
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
    const selectedPontos = form.pontos.filter(p => p.selected);
    if (selectedPontos.length === 0) {
      throw new Error(`Nenhuma atividade selecionada para a equipe ${form.equipe} em ${form.dataProgramacao}.`);
    }

    const unidadeObj = UNIDADES_DISPONIVEIS.find(u => u.id === form.unidadeId) || UNIDADES_DISPONIVEIS[0];
    const nomeUnidadePlanejadaUpper = unidadeObj.name.toUpperCase();

    let cleanEtapaGeral = (form.etapa || 'IMPLANTAÇÃO').trim();
    cleanEtapaGeral = cleanEtapaGeral
      .split(/[,/]/)
      .map(e => e.trim().replace(/^\d+\s*-\s*/, '').trim())
      .filter(Boolean)
      .join('/');
    if (!cleanEtapaGeral) cleanEtapaGeral = 'IMPLANTAÇÃO';

    let tempoAtividadesMin = 0;
    let valorTotalAtividades = 0;
    let qtdPostes = 0;
    let qtdEstruturas = 0;
    let qtdCabos = 0;
    let qtdCavaRocha = 0;
    let qtdTrafos = 0;

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

      const s = (p.servico || '').toUpperCase();
      if (s.includes('POSTE')) {
        qtdPostes += p.quantidade;
      } else if (s.includes('ROCHA') || s.includes('CAVA EM ROCHA')) {
        qtdCavaRocha += p.quantidade;
      } else if (s.includes('CABO') || s.includes('FIO') || s.includes('CONDUTOR') || s.includes('MULTIPLEX')) {
        qtdCabos += p.quantidade;
      } else if (s.includes('TRAFO') || s.includes('TRANSFORMADOR') || s.includes('RELIGADOR')) {
        qtdTrafos += p.quantidade;
      } else {
        qtdEstruturas += p.quantidade;
      }

      return `${p.ponto} - [${cleanEtapaPonto}] ${p.servico} - Qtd: ${qtdStr} - Hr. Prev: ${hrPrevStr}`;
    });

    const compiledStr = blocos.join(' | ');
    const formattedDateWithDay = formatDateWithWeekday(form.dataProgramacao, form.dateObj);

    const newRow = new Array(78).fill('');
    newRow[0] = '';                                         // Col A (0): Leave empty string ""
    newRow[1] = formattedDateWithDay;                       // Col B: Data
    newRow[4] = form.supervisor;                            // Col E: Supervisor
    newRow[6] = form.equipe;                                // Col G: Equipe
    newRow[7] = form.obra.projeto;                          // Col H: Projeto

    const pontosUnicos = Array.from(new Set(selectedPontos.map(p => p.ponto))).sort().join(', ');
    newRow[8] = pontosUnicos;                               // Col I: Resumo de Pontos
    newRow[10] = form.obra.municipio;                       // Col K: Município da Obra
    newRow[12] = cleanEtapaGeral;                           // Col M: Etapa(s) Prevista(s) do Topo
    newRow[14] = compiledStr;                               // Col O: Compilado de atividades

    if (form.isPes) {
      newRow[16] = 'TRUE';                                  // Col Q (16): PES (Checkbox marcado como TRUE)
    }

    if (qtdCavaRocha > 0) newRow[18] = formatQuantityDisplay(qtdCavaRocha);   // Col S: Cava em Rocha
    if (qtdPostes > 0) newRow[20] = formatQuantityDisplay(qtdPostes);         // Col U: Postes
    if (qtdEstruturas > 0) newRow[22] = formatQuantityDisplay(qtdEstruturas); // Col W: Estruturas
    if (qtdCabos > 0) newRow[24] = formatQuantityDisplay(qtdCabos);           // Col Y: Cabos
    if (qtdTrafos > 0) newRow[29] = formatQuantityDisplay(qtdTrafos);         // Col AD: Trafos/Equipamentos

    newRow[36] = 'NÃO';                                     // Col AK (36): ANALISAR PRODUÇÃO?
    newRow[37] = `R$ ${valorTotalAtividades.toFixed(2)}`;   // Col AL (37): Valor Planejado
    
    const metaVal = form.metaEquipeValor || 4442;
    newRow[38] = `R$ ${metaVal.toFixed(2)}`;                // Col AM (38): Valor da Meta da Equipe

    const pctMeta = metaVal > 0 ? (valorTotalAtividades / metaVal * 100) : 0;
    const pctMetaFormatted = `${pctMeta.toFixed(1)}%`;
    newRow[39] = pctMetaFormatted;                          // Col AN (39): Percentual Planejado da Meta

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

    newRow[68] = pctMetaFormatted;                          // Col BQ (68): % Previsto da Meta

    const etapasAtividadesUnicas = Array.from(
      new Set(
        selectedPontos
          .map(p => (p.etapaPrevista || '').replace(/^\d+\s*-\s*/, '').trim())
          .filter(Boolean)
      )
    );
    newRow[76] = etapasAtividadesUnicas.join('/');          // Col BY (76): Etapas da base do pré-fechamento

    return newRow;
  };

  // Mutation to append new daily schedule(s) to Plan_Principal atomically in a single CSV batch
  const salvarProgramacao = useMutation({
    mutationFn: async (formInput: PcpProgramacaoForm | PcpProgramacaoForm[]) => {
      const formsArray = Array.isArray(formInput) ? formInput : [formInput];
      if (formsArray.length === 0) {
        throw new Error('Nenhum dado informado para envio.');
      }

      const allNewRows = formsArray.map(form => buildPlanPrincipalRow(form));
      const firstForm = formsArray[0];
      const unidadeObj = UNIDADES_DISPONIVEIS.find(u => u.id === firstForm.unidadeId) || UNIDADES_DISPONIVEIS[0];

      // Generate filename with pattern UNIDADE_ddmmhhmmss.csv
      const csvFilename = generateCsvFilename(firstForm.unidadeId);
      const csvContent = buildCsvContent(allNewRows);

      const isReprogramar = formsArray.some(f => Boolean(f.reprogramar));
      const motivo = formsArray.find(f => Boolean(f.motivoReprogramacao))?.motivoReprogramacao || '';

      // 1. DISPARO IMEDIATO AO BACKEND PARA SALVAR DIRETO NO GOOGLE DRIVE E COLAR NA PLAN_PRINCIPAL DO SHEETS
      try {
        await fetch('/api/salvar-programacao', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            csvFilename,
            csvContent,
            unitSigla: unidadeObj.sigla,
            reprogramar: isReprogramar,
            motivo: motivo,
          }),
        });
      } catch (apiErr) {
        console.error('Erro na chamada da API /api/salvar-programacao:', apiErr);
      }

      // 2. Atualizar cache local do Supabase
      const existingPrincipal: any[][] = rawCacheQuery.data?.principal
        ? JSON.parse(rawCacheQuery.data.principal)
        : [];

      const updatedPrincipal = [...existingPrincipal, ...allNewRows];

      const { data, error } = await supabase
        .from('planejamento_cache')
        .upsert(
          {
            unidade_id: firstForm.unidadeId,
            principal: JSON.stringify(updatedPrincipal),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'unidade_id' }
        )
        .select()
        .single();

      if (error) throw error;
      return { data, csvFilename, totalRows: allNewRows.length };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['pcp-planejamento-cache', selectedUnidadeId] });
      queryClient.invalidateQueries({ queryKey: ['planejamento-cache-raw'] });
      toast.success(`Programação gravada com sucesso! CSV ${result.csvFilename} enviado ao Drive e colado na Plan_Principal!`);
    },
    onError: (err: any) => {
      console.error('Erro ao salvar programação no PCP:', err);
      toast.error('Erro ao salvar programação: ' + (err.message || err));
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

        const parsedAtividades = parseCompiledAtividades(compiladoAtividades);

        // Se houver pontos no compilado que não constavam na Col I, inclui
        parsedAtividades.forEach(a => {
          if (a.ponto && !pontos.includes(a.ponto)) {
            pontos.push(a.ponto);
          }
        });

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
          chaveBk,
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
    orcamentoPontosQuery,
    orcamentoPorPontoMap,
    pontosDisponiveisDoProjeto,
    salvarProgramacao,
    servicosBase: servicosBase || [],
  };
};
