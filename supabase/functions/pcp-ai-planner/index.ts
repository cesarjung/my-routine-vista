import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

interface RiskAnalysisRequest {
  mode: "analyze_risk";
  observacoes: string;
  obraId: string;
}

interface PlanRequest {
  mode: "plan";
  prompt: string;
  context: {
    obras: Array<{
      projeto: string;
      nomeProjeto: string;
      municipio: string;
      lat?: number;
      lng?: number;
      pontosDisponiveis: string[];
    }>;
    equipes: string[];
    alojamentos: Array<{
      nome: string;
      latitude: number;
      longitude: number;
      unidadeNome: string;
    }>;
    atividades: Array<{
      obra_id: string;
      ponto_id: string;
      atividade: string;
      quantidade: number;
      tempo_minutos: number;
      valor_estimado: number;
    }>;
    parametros: {
      jornadaHoras: number;
      metaPercent: number;
      pontoSaida: string;
      semanaInicio?: string;
      semanaFim?: string;
    };
  };
}

type RequestBody = RiskAnalysisRequest | PlanRequest;

async function callGemini(apiKey: string, systemPrompt: string, userMessage: string): Promise<string> {
  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: `${systemPrompt}\n\n---\n\n${userMessage}` }],
      },
    ],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 4096,
      responseMimeType: "application/json",
    },
  };

  const resp = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Gemini API error ${resp.status}: ${errText}`);
  }

  const data = await resp.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  return text;
}

// ─── MODO: analyze_risk ─────────────────────────────────────────────────────
async function analyzeRisk(apiKey: string, observacoes: string, obraId: string) {
  const systemPrompt = `Você é um especialista em segurança de obras de distribuição elétrica (COELBA/NEOENERGIA).
Analise o texto de observações de vistoria de campo e identifique alertas de risco ou impedimentos.

Retorne APENAS um JSON válido com o seguinte formato:
{
  "tags": ["tag1", "tag2"],
  "resumo": "Uma frase curta descrevendo a situação"
}

Tags possíveis (use EXATAMENTE esses nomes quando aplicável):
- "Poste a Trocar" — se mencionar poste podre, danificado, a substituir ou trocar
- "Risco de Segurança" — se mencionar fio exposto, risco elétrico, perigo, acidente potencial
- "Difícil Acesso" — se mencionar estrada de terra, acesso difícil, área rural de difícil acesso, necessita de caminhonete
- "Cliente Ausente" — se mencionar cliente não estava, sem contato, ausente, retornar
- "Sem Prédio" — se mencionar prédio demolido, não existe, endereço errado
- "Obra Impedida" — se mencionar impedimento legal, ordem judicial, proibição, disputa
- "Necessita Agendamento" — se mencionar necessidade de agendar com cliente ou prefeitura

Se não houver observações relevantes ou o texto estiver vazio, retorne: {"tags": [], "resumo": "Sem alertas identificados"}`;

  const userMessage = `Obra: ${obraId}\nObservações da vistoria: ${observacoes || "(sem observações registradas)"}`;

  const raw = await callGemini(apiKey, systemPrompt, userMessage);
  
  try {
    // Limpar possível markdown ```json ... ```
    const clean = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    return JSON.parse(clean);
  } catch {
    return { tags: [], resumo: "Não foi possível analisar as observações." };
  }
}

// ─── MODO: plan ──────────────────────────────────────────────────────────────
async function generatePlan(apiKey: string, body: PlanRequest) {
  const { prompt, context } = body;
  const { obras, equipes, alojamentos, atividades, parametros } = context;

  // Monta contexto resumido para o Gemini
  const obrasResumidas = obras.slice(0, 10).map(o => ({
    projeto: o.projeto,
    nome: o.nomeProjeto,
    municipio: o.municipio,
    totalPontos: o.pontosDisponiveis?.length ?? 0,
    pontos: o.pontosDisponiveis?.slice(0, 30) ?? [],
  }));

  // Agrupa atividades por obra
  const atividadesPorObra: Record<string, { pontos: Set<string>; totalMinutos: number; totalValor: number }> = {};
  for (const a of atividades) {
    if (!atividadesPorObra[a.obra_id]) {
      atividadesPorObra[a.obra_id] = { pontos: new Set(), totalMinutos: 0, totalValor: 0 };
    }
    atividadesPorObra[a.obra_id].pontos.add(a.ponto_id);
    atividadesPorObra[a.obra_id].totalMinutos += a.tempo_minutos ?? 0;
    atividadesPorObra[a.obra_id].totalValor += a.valor_estimado ?? 0;
  }

  const sistemPrompt = `Você é um planejador especialista em obras de distribuição elétrica (COELBA/NEOENERGIA).
Seu trabalho é gerar planejamentos semanais de execução para equipes de campo, considerando:
- Jornada de trabalho de ${parametros.jornadaHoras}h por dia (mínimo)
- Meta de faturamento de ${parametros.metaPercent}% por dia
- Ponto de saída: ${parametros.pontoSaida}
- Alojamentos disponíveis: ${alojamentos.map(a => `${a.nome} (${a.unidadeNome})`).join(", ") || "base da unidade"}

REGRAS IMPORTANTES:
1. Cada dia deve ter entre ${parametros.jornadaHoras}h e ${parametros.jornadaHoras + 1.5}h de atividades
2. Otimize a ordem dos pontos para minimizar deslocamento (pontos consecutivos numericamente tendem a ser próximos)
3. A meta de ${parametros.metaPercent}% é o alvo — pode não ser atingida todos os dias por limitação de tempo
4. Para múltiplas equipes, distribua os pontos de forma que não haja conflito (cada ponto em apenas uma equipe)
5. Considere que pontos com prefixo P são poste, V são vão de cabo — podem ser executados sequencialmente

FORMATO DE RESPOSTA — retorne APENAS JSON válido:
{
  "planejamento": [
    {
      "equipe": "EH156",
      "semana": "18/08/2026 a 22/08/2026",
      "obra": "B-1233638",
      "dias": [
        {
          "data": "18/08/2026",
          "diaSemana": "Segunda-feira",
          "pontos": ["P1", "P2", "P3", "P4"],
          "tempoTotalMinutos": 492,
          "tempoTotalFormatado": "8h 12min",
          "valorEstimado": 4890.50,
          "percentualMeta": 110.1,
          "observacao": "Rota otimizada partindo de P1"
        }
      ],
      "totalSemana": {
        "pontos": 20,
        "tempoFormatado": "41h 20min",
        "valorTotal": 24500.00,
        "mediaPercentualMeta": 108.5
      }
    }
  ],
  "alertas": ["Observação importante 1", "Observação importante 2"],
  "resumoTextual": "Texto descritivo do planejamento para exibir no chat"
}`;

  const contextoJSON = JSON.stringify({
    obras: obrasResumidas,
    equipes,
    atividadesPorObra: Object.fromEntries(
      Object.entries(atividadesPorObra).map(([k, v]) => [
        k,
        { pontos: Array.from(v.pontos), totalMinutos: v.totalMinutos, totalValor: v.totalValor }
      ])
    ),
    parametros,
  }, null, 2);

  const userMessage = `SOLICITAÇÃO DO USUÁRIO: ${prompt}\n\nCONTEXTO DO SISTEMA:\n${contextoJSON}`;

  const raw = await callGemini(apiKey, sistemPrompt, userMessage);

  try {
    const clean = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    return JSON.parse(clean);
  } catch {
    return {
      planejamento: [],
      alertas: ["Erro ao processar a resposta da IA. Tente reformular o pedido."],
      resumoTextual: "Não foi possível gerar o planejamento. Verifique os parâmetros e tente novamente.",
    };
  }
}

// ─── Main Handler ─────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "GEMINI_API_KEY não configurada nos secrets do Supabase." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: RequestBody = await req.json();

    let result: unknown;

    if (body.mode === "analyze_risk") {
      result = await analyzeRisk(apiKey, body.observacoes, body.obraId);
    } else if (body.mode === "plan") {
      result = await generatePlan(apiKey, body);
    } else {
      return new Response(
        JSON.stringify({ error: `Modo inválido: ${(body as any).mode}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("pcp-ai-planner error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
