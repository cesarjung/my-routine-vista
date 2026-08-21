import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSessionState } from '@/hooks/useSessionState';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface VistoriaFormularioRecord {
  obra_id: string;
  data_vistoria?: string;
  apta_inapta?: string;
  obs_planejamento?: string;
  desligamento_bt?: boolean;
  desligamento_mt?: boolean;
  equipe_lv?: boolean;
  acesso_chuva?: boolean;
  autorizacao_passagem?: boolean;
  alojamento_proximo?: string;
  obs_acesso?: string;
  equipamentos_manobra?: string;
  conservacao_lv?: boolean;
  necessita_poda?: boolean;
  solo_rochoso?: boolean;
  condicoes_manobra_seguras?: boolean;
  risco_queda_cabos?: boolean;
  auxilio_lv?: boolean;
  arquivo_origem?: string;
}

export interface VistoriaPontoDetalhe {
  categoria: 'Segurança' | 'Acesso' | 'Podas' | 'Solo/Equipamentos' | 'Logística' | 'Operacional' | 'Geral';
  icone: string;
  texto: string;
  isCritico?: boolean;
}

export interface RiskResult {
  classificacao: 'Verde' | 'Laranja' | 'Vermelho';
  alerta: string;
  resumoIa?: string;
  pontosEspecificos?: string[];
  pontosDetalhados?: VistoriaPontoDetalhe[];
  observacoesOriginais?: string;
  recomendacao?: string;
  formularioCompleto?: VistoriaFormularioRecord;
}

// ─── Consolidador Inteligente de Dados da Vistoria (Formulário + Texto) ─────
export function parseVistoriaData(
  formData?: VistoriaFormularioRecord | null,
  obsTexto?: string | null,
  tags?: string[]
): RiskResult {
  const pontosDetalhados: VistoriaPontoDetalhe[] = [];
  const pontosEspecificos: string[] = [];
  let isVermelho = false;
  let isLaranja = false;

  // 1. CHECAGENS DE SEGURANÇA CRÍTICA (ALERTA VERMELHO)
  if (formData) {
    // 6.4: Postes e estruturas dos equipamentos NÃO estão em boas condições para manobra
    if (formData.condicoes_manobra_seguras === false) {
      isVermelho = true;
      const t = '6.4: Postes e estruturas dos equipamentos NÃO estão em boas condições para manobra.';
      pontosDetalhados.push({ categoria: 'Segurança', icone: '🔴', texto: t, isCritico: true });
      pontosEspecificos.push(`🔴 SEGURANÇA: ${t}`);
    }

    // 6.5: Risco de queda de poste, estrutura ou rompimento de cabos
    if (formData.risco_queda_cabos === true) {
      isVermelho = true;
      const t = '6.5: Risco de queda de poste, estrutura ou rompimento de cabos adjacentes à área de trabalho.';
      pontosDetalhados.push({ categoria: 'Segurança', icone: '🔴', texto: t, isCritico: true });
      pontosEspecificos.push(`🔴 SEGURANÇA: ${t}`);
    }

    // 4.5: O estado de conservação das estruturas NÃO permite trabalho com Linha Viva
    if (formData.conservacao_lv === false) {
      isVermelho = true;
      const t = '4.5: Estado de conservação das estruturas NÃO permite trabalho com Linha Viva.';
      pontosDetalhados.push({ categoria: 'Segurança', icone: '🔴', texto: t, isCritico: true });
      pontosEspecificos.push(`🔴 SEGURANÇA: ${t}`);
    }

    // 2. CHECAGENS OPERACIONAIS E DE ACESSO (ALERTA LARANJA)
    if (formData.apta_inapta && formData.apta_inapta.toUpperCase().includes('INAPTA')) {
      isLaranja = true;
      const t = '0.2: Obra classificada como INAPTA para execução.';
      pontosDetalhados.push({ categoria: 'Operacional', icone: '⚠️', texto: t });
      pontosEspecificos.push(`⚠️ OPERACIONAL: ${t}`);
    }

    if (formData.desligamento_bt === true) {
      isLaranja = true;
      const t = '0.4: Necessário desligamento BT.';
      pontosDetalhados.push({ categoria: 'Operacional', icone: '⚡', texto: t });
      pontosEspecificos.push(`⚡ REDE: ${t}`);
    }

    if (formData.desligamento_mt === true) {
      isLaranja = true;
      const t = '0.5: Necessário desligamento MT.';
      pontosDetalhados.push({ categoria: 'Operacional', icone: '⚡', texto: t });
      pontosEspecificos.push(`⚡ REDE: ${t}`);
    }

    if (formData.equipe_lv === true || formData.auxilio_lv === true) {
      isLaranja = true;
      const t = '0.6 / 6.10: Necessário atuação / auxílio de equipe de Linha Viva (LV).';
      pontosDetalhados.push({ categoria: 'Operacional', icone: '⚡', texto: t });
      pontosEspecificos.push(`⚡ LINHA VIVA: ${t}`);
    }

    if (formData.acesso_chuva === false) {
      isLaranja = true;
      const t = '1.4: Em condições de terreno molhado devido a chuva, NÃO haverá acesso.';
      pontosDetalhados.push({ categoria: 'Acesso', icone: '🌧️', texto: t });
      pontosEspecificos.push(`🌧️ ACESSO: ${t}`);
    }

    if (formData.autorizacao_passagem === true) {
      isLaranja = true;
      const t = '1.6: Necessário verificar autorização de passagem com proprietário.';
      pontosDetalhados.push({ categoria: 'Acesso', icone: '📝', texto: t });
      pontosEspecificos.push(`📝 AUTORIZAÇÃO: ${t}`);
    }

    if (formData.solo_rochoso === true) {
      isLaranja = true;
      const t = '6.2: Existe solo rochoso (Solo C) no local da obra.';
      pontosDetalhados.push({ categoria: 'Solo/Equipamentos', icone: '⛏️', texto: t });
      pontosEspecificos.push(`⛏️ SOLO: ${t}`);
    }

    if (formData.necessita_poda === true) {
      isLaranja = true;
      const t = '5.1: Necessidade de manejo da vegetação (poda / supressão / roçada).';
      pontosDetalhados.push({ categoria: 'Podas', icone: '🌳', texto: t });
      pontosEspecificos.push(`🌳 PODAS: ${t}`);
    }

    if (formData.alojamento_proximo && formData.alojamento_proximo.trim() && !formData.alojamento_proximo.toUpperCase().includes('NÃO') && !formData.alojamento_proximo.toUpperCase().includes('NAO')) {
      const t = `1.7: Alojamento próximo identificado: ${formData.alojamento_proximo.trim()}`;
      pontosDetalhados.push({ categoria: 'Logística', icone: '🏠', texto: t });
      pontosEspecificos.push(`🏠 ALOJAMENTO: ${t}`);
    }

    if (formData.obs_acesso && formData.obs_acesso.trim() && !formData.obs_acesso.toUpperCase().includes('SEM OBS') && !formData.obs_acesso.toUpperCase().includes('N/A')) {
      isLaranja = true;
      const t = `1.10 Acesso: ${formData.obs_acesso.trim()}`;
      pontosDetalhados.push({ categoria: 'Acesso', icone: '🛣️', texto: t });
      pontosEspecificos.push(`🛣️ ACESSO: ${t}`);
    }

    if (formData.equipamentos_manobra && formData.equipamentos_manobra.trim() && !formData.equipamentos_manobra.toUpperCase().includes('NÃO') && !formData.equipamentos_manobra.toUpperCase().includes('NAO')) {
      const t = `2.1 Equipamentos de Manobra: ${formData.equipamentos_manobra.trim()}`;
      pontosDetalhados.push({ categoria: 'Operacional', icone: '🔧', texto: t });
      pontosEspecificos.push(`🔧 MANOBRA: ${t}`);
    }
  }

  // 3. PARSING TEXTUAL DAS OBSERVAÇÕES DE CAMPO (0.1 ou observacoes_vistoria)
  const fullObs = formData?.obs_planejamento || obsTexto || '';
  if (fullObs && fullObs.trim()) {
    const textUpper = fullObs.toUpperCase();

    const redKeywords = [
      // Postes e Integridade Estrutural
      'POSTE QUEBRADO', 'POSTES QUEBRADOS', 'POSTE DANIFICADO', 'POSTES DANIFICADOS',
      'POSTE RACHADO', 'POSTES RACHADOS', 'POSTE PODRE', 'POSTES PODRES',
      'POSTE TRINCADO', 'POSTES TRINCADOS', 'POSTE ABALROADO', 'POSTES ABALROADOS',
      'POSTE INCLINADO', 'POSTES INCLINADOS', 'POSTE TOMBADO', 'POSTES TOMBADOS',
      'POSTE CAÍDO', 'POSTE CAIDO', 'POSTES CAÍDOS', 'POSTES CAIDOS',
      'SUBSTITUIÇÃO DE POSTE', 'SUBSTITUICAO DE POSTE', 'SUBSTITUIÇÃO DOS POSTES', 'SUBSTITUICAO DOS POSTES',
      'SUBSTITUIR POSTE', 'SUBSTITUIR POSTES', 'TROCA DE POSTE', 'TROCA DOS POSTES',
      'TRINCA', 'TRINCADO', 'FERRAGEM EXPOSTA', 'FERRAGENS EXPOSTAS',
      'ESTRUTURA CONDENADA', 'ESTRUTURA DANIFICADA', 'ESTRUTURAS DANIFICADAS', 'ESTRUTURA ABALROADA',
      'RISCO DE QUEDA', 'QUEDA DE POSTE', 'QUEDA DE ESTRUTURA',

      // Elétrica e Segurança Crítica
      'REDE ENERGIZADA', 'REDE DE ALTA TENSÃO', 'REDE DE ALTA TENSAO', 'ALTA TENSÃO', 'ALTA TENSAO',
      'MÉDIA TENSÃO', 'MEDIA TENSAO', 'CRUZAMENTO DE REDE', 'CRUZANDO REDE',
      'FIO PARTIDO', 'FIOS PARTIDOS', 'FIO EXPOSTO', 'FIOS EXPOSTOS', 'FIO CAÍDO', 'FIO CAIDO', 'FIO NO CHÃO', 'FIO NO CHAO',
      'CABO PARTIDO', 'CABOS PARTIDOS', 'CABO CAÍDO', 'CABO CAIDO', 'CABO NO CHÃO', 'CABO NO CHAO',
      'CABO ROMPIDO', 'CABOS ROMPIDOS', 'ROMPIMENTO DE CABO', 'ROMPIMENTO DE CABOS',
      'RISCO DE CHOQUE', 'CHOQUE ELÉTRICO', 'CHOQUE ELETRICO', 'FAÍSCA', 'FAISCA', 'FAISCAMENTO',
      'CURTO-CIRCUITO', 'CURTO CIRCUITO',

      // Emergência / Gravidade Extrema
      'CRÍTICO', 'CRITICO', 'PERIGO', 'PERIGOSO', 'EMERGENCIAL', 'EMERGÊNCIA', 'EMERGENCIA',
      'INTERDITADO', 'INTERDITADA', 'ÁREA DE RISCO', 'AREA DE RISCO'
    ];

    const orangeKeywords = [
      'DIFÍCIL ACESSO', 'DIFICIL ACESSO', 'SEM ACESSO', 'ACESSO COMPROMETIDO', 'ACESSO GERAL',
      'CHUVA', 'CHUVAS', 'CHUVOSOS', 'ATOLAMENTO', 'ATOLAR', 'ATOLEIRO', 'ABRIR CERCA', 'CERCA',
      'CANCELA', 'CADEADO', 'SOLICITANTE AUSENTE', 'CLIENTE AUSENTE', 'ROCHA', 'PEDRA', 'PEDRAS',
      'PODA', 'PODAS', 'ALAGADO', 'ALAGADOS', 'ALAGAMENTOS', 'AUTORIZAÇÃO', 'AGENDAMENTO', 
      'IMPEDIMENTO', 'IMPEDIDA', 'DIVERGÊNCIA', 'DIVERGENCIA', 'AREIA', 'ARENOSO', 'PONTE', 'RETROESCAVADEIRA'
    ];

    if (redKeywords.some(k => textUpper.includes(k))) isVermelho = true;
    if (orangeKeywords.some(k => textUpper.includes(k))) isLaranja = true;

    const rawParts = fullObs
      .split(/\/\/|\n|\r/)
      .map(p => p.trim())
      .filter(p => p.length > 3 && !p.toUpperCase().startsWith('OBRA APTA') && !p.toUpperCase().startsWith('OBRA OK'));

    rawParts.forEach(part => {
      const pUpper = part.toUpperCase();
      let categoria: VistoriaPontoDetalhe['categoria'] = 'Geral';
      let icone = '📌';
      let isCritico = false;

      // Se esta observação específica contém gatilho de risco vermelho
      if (redKeywords.some(k => pUpper.includes(k))) {
        isCritico = true;
      }

      if (
        pUpper.includes('POSTE') && (pUpper.includes('DANIFICADO') || pUpper.includes('QUEBRADO') || pUpper.includes('SUBSTITU') || pUpper.includes('TRINCA') || pUpper.includes('RACHAD') || pUpper.includes('ABALRO') || pUpper.includes('CAID') || pUpper.includes('CAÍD') || pUpper.includes('INCLINAD')) ||
        pUpper.includes('FERRAGEM EXPOSTA') || pUpper.includes('RISCO DE CHOQUE') || pUpper.includes('CHOQUE') || 
        pUpper.includes('FIO') || pUpper.includes('CABO PARTIDO') || pUpper.includes('CABO ROMPIDO') || pUpper.includes('ENERGIZAD') || 
        pUpper.includes('CRUZANDO') || pUpper.includes('LINHA VIVA') || pUpper.includes('LV') || pUpper.includes('PERIGO') || pUpper.includes('CRITIC')
      ) {
        categoria = 'Segurança';
        icone = isCritico ? '🔴' : '⚡';
      } else if (pUpper.includes('PODA') || pUpper.includes('VEGETAÇÃO') || pUpper.includes('ÁRVORE')) {
        categoria = 'Podas';
        icone = '🌳';
      } else if (pUpper.includes('ROCHA') || pUpper.includes('PEDRA') || pUpper.includes('RETROESCAVADEIRA') || pUpper.includes('AREIA') || pUpper.includes('ARENOSO') || pUpper.includes('ESCAVAÇÃO')) {
        categoria = 'Solo/Equipamentos';
        icone = '🚜';
      } else if (pUpper.includes('ACESSO') || pUpper.includes('PONTE') || pUpper.includes('CERCA') || pUpper.includes('CANCELA') || pUpper.includes('CAMINHÃO') || pUpper.includes('CARRETA') || pUpper.includes('CHUVA') || pUpper.includes('ALAGAM')) {
        categoria = 'Acesso';
        icone = '🛣️';
      }

      pontosDetalhados.push({ categoria, icone, texto: part, isCritico });
      pontosEspecificos.push(`${icone} ${categoria}: ${part}`);
    });
  }

  // 4. CLASSIFICAÇÃO FINAL
  let classificacao: 'Verde' | 'Laranja' | 'Vermelho' = 'Verde';
  if (isVermelho) {
    classificacao = 'Vermelho';
  } else if (isLaranja || (Array.isArray(tags) && tags.length > 0)) {
    classificacao = 'Laranja';
  }

  const alertaPrincipal = pontosDetalhados.length > 0
    ? pontosDetalhados.map(p => p.texto).slice(0, 2).join(' • ')
    : 'Sem alertas de risco ou impedimento operacional.';

  return {
    classificacao,
    alerta: alertaPrincipal,
    resumoIa: pontosDetalhados.length > 0 ? pontosDetalhados.map(p => p.texto).join(' • ') : 'Obra liberada para execução.',
    pontosEspecificos: pontosEspecificos.length > 0 ? pontosEspecificos : ['Obra liberada sem impeditivos identificados.'],
    pontosDetalhados,
    observacoesOriginais: fullObs,
    formularioCompleto: formData || undefined,
  };
}

// ─── Hook: Vistoria Risks ─────────────────────────────────────────────────────

export function useVistoriaRisk(obraId: string | null) {
  const [riskCache, setRiskCache] = useState<Record<string, RiskResult>>({});
  const [loading, setLoading] = useState(false);

  // Busca do formulário completo ou realizadas_vistoria
  const vistoriaQuery = useQuery({
    queryKey: ['vistorias_formulario', obraId],
    queryFn: async () => {
      if (!obraId) return null;
      const cleanId = String(obraId).trim();
      const numId = cleanId.replace(/\D/g, '');

      // 1. Tenta buscar em vistorias_formulario
      try {
        const { data: formResp } = await supabase
          .from('vistorias_formulario' as any)
          .select('*')
          .or(`obra_id.eq.${cleanId},obra_id.eq.${numId},obra_id.eq.B-${numId}`)
          .limit(1)
          .maybeSingle();

        if (formResp) return { form: formResp as VistoriaFormularioRecord, obs: formResp.obs_planejamento, tags: [] };
      } catch {
        // Fallback para realizadas_vistoria se vistorias_formulario ainda estiver populando
      }

      // 2. Fallback para realizadas_vistoria
      const { data: realResp } = await supabase
        .from('realizadas_vistoria' as any)
        .select('observacoes_vistoria, risk_tags')
        .or(`obra_id.eq.${cleanId},obra_id.eq.${numId},obra_id.eq.B-${numId}`)
        .limit(1)
        .maybeSingle();

      return {
        form: null,
        obs: realResp?.observacoes_vistoria || null,
        tags: realResp?.risk_tags || []
      };
    },
    enabled: !!obraId,
    staleTime: 5 * 60 * 1000,
  });

  const analyzeRisk = useCallback(async (obraIdToAnalyze: string): Promise<RiskResult | null> => {
    const cleanId = String(obraIdToAnalyze).trim();
    if (riskCache[cleanId]) return riskCache[cleanId];

    let formData = vistoriaQuery.data?.form;
    let obs = vistoriaQuery.data?.obs;
    let tags = vistoriaQuery.data?.tags;

    if (!formData && !obs) {
      const numId = cleanId.replace(/\D/g, '');
      try {
        const { data: fData } = await supabase
          .from('vistorias_formulario' as any)
          .select('*')
          .or(`obra_id.eq.${cleanId},obra_id.eq.${numId},obra_id.eq.B-${numId}`)
          .limit(1)
          .maybeSingle();
        if (fData) {
          formData = fData as VistoriaFormularioRecord;
          obs = fData.obs_planejamento;
        }
      } catch {}

      if (!formData) {
        const { data: rData } = await supabase
          .from('realizadas_vistoria' as any)
          .select('observacoes_vistoria, risk_tags')
          .or(`obra_id.eq.${cleanId},obra_id.eq.${numId},obra_id.eq.B-${numId}`)
          .limit(1)
          .maybeSingle();
        obs = rData?.observacoes_vistoria;
        tags = rData?.risk_tags;
      }
    }

    const localResult = parseVistoriaData(formData, obs, tags);
    setRiskCache(prev => ({ ...prev, [cleanId]: localResult }));

    return localResult;
  }, [riskCache, vistoriaQuery.data]);

  return { analyzeRisk, riskCache, loadingRisk: loading || vistoriaQuery.isLoading };
}

// ─── Hook: AI Planner Chat ────────────────────────────────────────────────────

export function usePcpAiPlanner() {
  const [messages, setMessages] = useSessionState<ChatMessage[]>('pcp_ai_chat_messages', [
    {
      id: 'welcome',
      role: 'assistant',
      content: `Olá! Sou o assistente de planejamento automático de obras. 

Posso ajudar você a montar planejamentos semanais considerando jornada, meta e deslocamento.

**Exemplos de como me usar:**
- *"monte um planejamento para a equipe EH156 na obra B-1233638 a partir do ponto P1 com saturação por tempo na semana de 18/08 a 22/08/2026"*
- *"planifique as equipes EH156 e EH200 na obra B-1233638 para a próxima semana"*
- *"qual a melhor sequência de pontos para EH156 considerando 9h de jornada?"*`,
      timestamp: new Date(),
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);

  const clearMessages = useCallback(() => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: `Olá! Sou o assistente de planejamento automático de obras...`,
        timestamp: new Date(),
      }
    ]);
  }, [setMessages]);

  const sendMessage = useCallback(async (
    userPrompt: string,
    context: {
      obras: any[];
      equipes: string[];
      alojamentos: any[];
      atividades: any[];
      parametros: {
        jornadaHoras: number;
        metaPercent: number;
        pontoSaida: string;
      };
    }
  ): Promise<PlanResponse | null> => {
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userPrompt,
      timestamp: new Date(),
    };

    const loadingMsg: ChatMessage = {
      id: `loading-${Date.now()}`,
      role: 'assistant',
      content: 'Analisando dados e gerando planejamento...',
      timestamp: new Date(),
      loading: true,
    };

    setMessages(prev => [...prev, userMsg, loadingMsg]);
    setIsLoading(true);

    try {
      // Usa fetch direto para ter controle total sobre erros
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

      const resp = await fetch(`${supabaseUrl}/functions/v1/pcp-ai-planner`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ mode: 'plan', prompt: userPrompt, context }),
      });

      const respBody = await resp.json();

      if (!resp.ok) {
        throw new Error(respBody?.error ?? `HTTP ${resp.status}: ${JSON.stringify(respBody).slice(0, 200)}`);
      }

      const planData = respBody as PlanResponse;

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: planData.resumoTextual ?? 'Planejamento gerado com sucesso.',
        planData,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev.filter(m => !m.loading), assistantMsg]);
      return planData;
    } catch (e: any) {
      const errMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `❌ Erro: ${e?.message ?? String(e)}`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev.filter(m => !m.loading), errMsg]);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);



  // clearMessages removed from here, since it is defined above

  return { messages, sendMessage, isLoading, clearMessages };
}
