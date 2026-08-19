import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSessionState } from '@/hooks/useSessionState';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RiskResult {
  classificacao: 'Verde' | 'Laranja' | 'Vermelho';
  alerta: string;
  resumoIa?: string;
  pontosAtencao?: string[];
  observacoesOriginais?: string;
}

// ─── Local Rule-Based NLP Analyzer for Vistoria Observations ──────────────────
export function parseVistoriaObservations(obs?: string | null, tags?: string[]): RiskResult {
  if (!obs || !obs.trim()) {
    return {
      classificacao: 'Verde',
      alerta: 'Sem observações registradas na vistoria.',
      resumoIa: 'Nenhum alerta de risco ou impedimento operacional registrado.',
      pontosAtencao: [],
      observacoesOriginais: '',
    };
  }

  const textUpper = obs.toUpperCase();

  // Regras de Risco Vermelho (Segurança / Estrutural / Elétrico Grave)
  const redKeywords = [
    'POSTE QUEBRADO', 'TRINCA', 'FERRAGEM EXPOSTA', 'RISCO DE QUEDA', 
    'RISCO DE CHOQUE', 'FIO PARTIDO', 'FIOS EXPOSTOS', 'FIO CAÍDO', 'FIO NO CHÃO',
    'FAÍSCA', 'FAISCAMENTO', 'ESTRUTURA CONDENADA', 'CRÍTICO', 'PERIGO', 'EMERGENCIAL'
  ];

  // Regras de Risco Laranja (Acesso / Operacional / Restrições / Meio Ambiente)
  const orangeKeywords = [
    'DIFÍCIL ACESSO', 'DIFICIL ACESSO', 'SEM ACESSO', 'ACESSO COMPROMETIDO', 
    'CHUVA', 'CHUVAS', 'CHUVOSOS', 'ATOLAMENTO', 'ATOLAR', 'ATOLEIRO', 'ABRIR CERCA', 'CERCA',
    'CANCELA', 'CADEADO', 'SOLICITANTE AUSENTE', 'CLIENTE AUSENTE', 'ROCHA', 'PEDRA', 'PEDRAS',
    'PODA', 'PODAS', 'ALAGADO', 'ALAGADOS', 'ALAGAMENTOS', 'AUTORIZAÇÃO', 'AGENDAMENTO', 
    'IMPEDIMENTO', 'IMPEDIDA', 'DIVERGÊNCIA', 'DIVERGENCIA', 'AREIA', 'ARENOSO', 'PONTE', 'RETROESCAVADEIRA'
  ];

  const matchedRed = redKeywords.filter(k => textUpper.includes(k));
  const matchedOrange = orangeKeywords.filter(k => textUpper.includes(k));

  let classificacao: 'Verde' | 'Laranja' | 'Vermelho' = 'Verde';
  if (matchedRed.length > 0) {
    classificacao = 'Vermelho';
  } else if (matchedOrange.length > 0 || (Array.isArray(tags) && tags.length > 0)) {
    classificacao = 'Laranja';
  }

  // Divide as observações por // ou quebras de linha
  const parts = obs
    .split(/\/\/|\n|\r/)
    .map(p => p.trim())
    .filter(p => p.length > 2);

  // Extrai trechos que contêm alertas críticos
  const pontosCriticos: string[] = [];
  parts.forEach(p => {
    const pUpper = p.toUpperCase();
    const isRed = redKeywords.some(k => pUpper.includes(k));
    const isOrange = orangeKeywords.some(k => pUpper.includes(k));
    if (isRed || isOrange) {
      pontosCriticos.push(p);
    }
  });

  const alertaPrincipal = pontosCriticos.length > 0
    ? pontosCriticos.slice(0, 2).join(' • ')
    : (parts.length > 0 && !parts[0].toUpperCase().includes('OBRA OK') && !parts[0].toUpperCase().includes('SEM OBS')
        ? parts[0]
        : 'Sem alertas de risco ou impedimento.');

  const resumoGeral = pontosCriticos.length > 0
    ? pontosCriticos.join(' • ')
    : parts.filter(p => !p.toUpperCase().startsWith('OBRA APTA')).join(' • ') || 'Obra sem impeditivos de campo.';

  return {
    classificacao,
    alerta: alertaPrincipal,
    resumoIa: resumoGeral,
    pontosAtencao: pontosCriticos.length > 0 ? pontosCriticos : parts.slice(0, 3),
    observacoesOriginais: obs,
  };
}

// ─── Hook: Vistoria Risks ─────────────────────────────────────────────────────

export function useVistoriaRisk(obraId: string | null) {
  const [riskCache, setRiskCache] = useState<Record<string, RiskResult>>({});
  const [loading, setLoading] = useState(false);

  // Busca observações do Supabase
  const vistoriaQuery = useQuery({
    queryKey: ['realizadas_vistoria', obraId],
    queryFn: async () => {
      if (!obraId) return null;
      const cleanId = String(obraId).trim();
      const numId = cleanId.replace(/\D/g, '');
      const { data } = await supabase
        .from('realizadas_vistoria' as any)
        .select('observacoes_vistoria, risk_tags')
        .or(`obra_id.eq.${cleanId},obra_id.eq.${numId},obra_id.eq.B-${numId}`)
        .limit(1)
        .maybeSingle();
      return data as { observacoes_vistoria: string; risk_tags: any } | null;
    },
    enabled: !!obraId,
    staleTime: 5 * 60 * 1000,
  });

  const analyzeRisk = useCallback(async (obraIdToAnalyze: string): Promise<RiskResult | null> => {
    const cleanId = String(obraIdToAnalyze).trim();
    if (riskCache[cleanId]) return riskCache[cleanId];

    // Consulta direta para garantir dados atualizados
    let obs = vistoriaQuery.data?.observacoes_vistoria;
    let tags = vistoriaQuery.data?.risk_tags;

    if (!obs) {
      const numId = cleanId.replace(/\D/g, '');
      const { data } = await supabase
        .from('realizadas_vistoria' as any)
        .select('observacoes_vistoria, risk_tags')
        .or(`obra_id.eq.${cleanId},obra_id.eq.${numId},obra_id.eq.B-${numId}`)
        .limit(1)
        .maybeSingle();
      obs = data?.observacoes_vistoria;
      tags = data?.risk_tags;
    }

    // Calcula resultado local instantaneamente
    const localResult = parseVistoriaObservations(obs, tags);
    setRiskCache(prev => ({ ...prev, [cleanId]: localResult }));

    if (!obs) return localResult;

    // Opcionalmente aciona Edge Function para enriquecer
    try {
      const { data, error } = await supabase.functions.invoke('pcp-ai-planner', {
        body: { mode: 'analyze_risk', observacoes: obs, obraId: cleanId },
      });
      if (!error && data && data.classificacao) {
        const enriched: RiskResult = {
          classificacao: data.classificacao,
          alerta: data.alerta || localResult.alerta,
          resumoIa: data.alerta || localResult.resumoIa,
          pontosAtencao: localResult.pontosAtencao,
          observacoesOriginais: obs,
        };
        setRiskCache(prev => ({ ...prev, [cleanId]: enriched }));
        return enriched;
      }
    } catch {
      // Usa resultado local se edge function falhar
    }

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
