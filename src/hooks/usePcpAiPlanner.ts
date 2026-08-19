import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSessionState } from '@/hooks/useSessionState';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RiskResult {
  classificacao: 'Verde' | 'Laranja' | 'Vermelho';
  alerta: string;
}

export interface DiaPlano {
  data: string;
  diaSemana: string;
  pontos: string[];
  alojamentoId?: string;
  tempoDeslocamentoOverride?: number;
  tempoSaidaBaseOverride?: number;
  tempoSegurancaOverride?: number;
  tempoTotalMinutos: number;
  tempoTotalFormatado: string;
  valorEstimado: number;
  percentualMeta: number;
  observacao?: string;
}

export interface PlanoEquipe {
  equipe: string;
  semana: string;
  obra: string;
  dias: DiaPlano[];
  totalSemana: {
    pontos: number;
    tempoFormatado: string;
    valorTotal: number;
    mediaPercentualMeta: number;
  };
}

export interface PlanResponse {
  planejamento: PlanoEquipe[];
  alertas: string[];
  resumoTextual: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  planData?: PlanResponse;
  timestamp: Date;
  loading?: boolean;
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
      const { data } = await supabase
        .from('realizadas_vistoria' as any)
        .select('observacoes_vistoria, risk_tags')
        .eq('obra_id', obraId)
        .maybeSingle();
      return data as { observacoes_vistoria: string; risk_tags: any } | null;
    },
    enabled: !!obraId,
    staleTime: 5 * 60 * 1000,
  });

  const analyzeRisk = useCallback(async (obraIdToAnalyze: string): Promise<RiskResult | null> => {
    if (riskCache[obraIdToAnalyze]) return riskCache[obraIdToAnalyze];

    const obs = vistoriaQuery.data?.observacoes_vistoria;
    if (!obs) return null;

    // TODO: In the future, cache the RiskResult directly in Supabase instead of risk_tags array.
    // For now we will always fetch from Edge Function if we don't have it in local riskCache.

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('pcp-ai-planner', {
        body: { mode: 'analyze_risk', observacoes: obs, obraId: obraIdToAnalyze },
      });
      if (error) throw error;

      const result = data as RiskResult;

      setRiskCache(prev => ({ ...prev, [obraIdToAnalyze]: result }));

      return result;
    } catch (err) {
      console.error('Erro ao analisar risco:', err);
      const fallback: RiskResult = { classificacao: 'Verde', alerta: 'Erro ao classificar.' };
      setRiskCache(prev => ({ ...prev, [obraIdToAnalyze]: fallback }));
      return fallback;
    } finally {
      setLoading(false);
    }
  }, [riskCache, vistoriaQuery.data]);

  return { analyzeRisk, riskCache, loadingRisk: loading };
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
