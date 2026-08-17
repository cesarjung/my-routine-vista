import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RiskTag {
  tag: string;
  color: 'red' | 'yellow' | 'orange' | 'gray' | 'purple';
}

export interface DiaPlano {
  data: string;
  diaSemana: string;
  pontos: string[];
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
  const [riskCache, setRiskCache] = useState<Record<string, RiskTag[]>>({});
  const [loading, setLoading] = useState(false);

  const RISK_COLORS: Record<string, RiskTag['color']> = {
    'Poste a Trocar': 'orange',
    'Risco de Segurança': 'red',
    'Difícil Acesso': 'yellow',
    'Cliente Ausente': 'gray',
    'Sem Prédio': 'purple',
    'Obra Impedida': 'red',
    'Necessita Agendamento': 'yellow',
  };

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
      return data as { observacoes_vistoria: string; risk_tags: string[] } | null;
    },
    enabled: !!obraId,
    staleTime: 5 * 60 * 1000,
  });

  const analyzeRisk = useCallback(async (obraIdToAnalyze: string): Promise<RiskTag[]> => {
    if (riskCache[obraIdToAnalyze]) return riskCache[obraIdToAnalyze];

    const obs = vistoriaQuery.data?.observacoes_vistoria;
    if (!obs) return [];

    // Se já tem tags em cache no Supabase, usa elas
    const cachedTags = vistoriaQuery.data?.risk_tags;
    if (cachedTags && cachedTags.length > 0) {
      const tags = cachedTags.map(t => ({ tag: t, color: RISK_COLORS[t] ?? 'gray' })) as RiskTag[];
      setRiskCache(prev => ({ ...prev, [obraIdToAnalyze]: tags }));
      return tags;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('pcp-ai-planner', {
        body: { mode: 'analyze_risk', observacoes: obs, obraId: obraIdToAnalyze },
      });
      if (error) throw error;

      const tags = (data.tags ?? []).map((t: string) => ({
        tag: t,
        color: RISK_COLORS[t] ?? 'gray',
      })) as RiskTag[];

      setRiskCache(prev => ({ ...prev, [obraIdToAnalyze]: tags }));

      // Salva tags no Supabase para cache futuro
      await supabase
        .from('realizadas_vistoria' as any)
        .update({ risk_tags: data.tags ?? [] })
        .eq('obra_id', obraIdToAnalyze);

      return tags;
    } catch (e) {
      console.error('analyzeRisk error:', e);
      return [];
    } finally {
      setLoading(false);
    }
  }, [riskCache, vistoriaQuery.data]);

  return { analyzeRisk, riskCache, loadingRisk: loading };
}

// ─── Hook: AI Planner Chat ────────────────────────────────────────────────────

export function usePcpAiPlanner() {
  const [messages, setMessages] = useState<ChatMessage[]>([
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
  ) => {
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
      const { data, error } = await supabase.functions.invoke('pcp-ai-planner', {
        body: { mode: 'plan', prompt: userPrompt, context },
      });

      if (error) throw error;

      const planData = data as PlanResponse;

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: planData.resumoTextual ?? 'Planejamento gerado com sucesso.',
        planData,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev.filter(m => !m.loading), assistantMsg]);
    } catch (e) {
      const errMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `❌ Erro ao gerar planejamento: ${String(e)}. Verifique se a chave GEMINI_API_KEY está configurada nos Secrets do Supabase.`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev.filter(m => !m.loading), errMsg]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearMessages = useCallback(() => {
    setMessages(prev => prev.slice(0, 1)); // Mantém apenas a mensagem de boas-vindas
  }, []);

  return { messages, sendMessage, isLoading, clearMessages };
}
