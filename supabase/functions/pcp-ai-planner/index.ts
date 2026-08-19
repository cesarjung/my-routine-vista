import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Modelos em ordem de preferência — fallback automático se 503/429/404
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const GEMINI_MODELS = [
  "gemini-flash-latest",
  "gemini-flash-lite-latest",
  "gemma-4-26b-a4b-it",
];

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

  let lastErr = "";
  for (const model of GEMINI_MODELS) {
    const url = `${GEMINI_BASE}/${model}:generateContent?key=${apiKey}`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (resp.ok) {
      const data = await resp.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
      return text;
    }

    const errText = await resp.text();
    lastErr = `${model} → ${resp.status}: ${errText.slice(0, 200)}`;

    // Se for 503 (sobrecarga), 429 (quota) ou 404 (modelo não encontrado), tenta próximo
    if (resp.status === 503 || resp.status === 429 || resp.status === 404) {
      console.warn(`[pcp-ai-planner] ${model} indisponível (${resp.status}), tentando próximo...`);
      continue;
    }

    // Para outros erros (401, 400), não adianta tentar outro modelo
    throw new Error(`Gemini API error ${resp.status}: ${errText}`);
  }

  throw new Error(`Todos os modelos Gemini indisponíveis. Último erro: ${lastErr}`);
}

// ─── MODO: analyze_risk ─────────────────────────────────────────────────────
async function analyzeRisk(apiKey: string, observacoes: string, obraId: string) {
  const systemPrompt = `Você é um especialista em segurança de obras de distribuição elétrica (COELBA/NEOENERGIA).
Analise o texto de observações de vistoria de campo e classifique o nível de risco ou impedimento.

Retorne APENAS um JSON válido com o seguinte formato:
{
  "classificacao": "Vermelho" | "Laranja" | "Verde",
  "alerta": "Resumo do problema, ou a própria observação se for curta"
}

Regras de Classificação:
- "Vermelho": Problemas relacionados a questões de risco de segurança severo (ex: poste quebrado, poste com trincas, risco de queda, risco de choque, fios expostos, etc).
- "Laranja": Alertas que indiquem problemas de acesso ou impedimento não letal (ex: Difícil Acesso, Sem Acesso, estrada de terra ruim, cliente ausente, necessita agendamento, obra impedida judicialmente).
- "Verde": Se não houver observações relevantes de risco/impedimento, ou o texto estiver vazio.

Para "alerta", resuma o problema em algumas palavras ou traga a observação inteira se achar mais claro. Se for "Verde", retorne "Sem alertas identificados".`;

  const userMessage = `Obra: ${obraId}\nObservações da vistoria: ${observacoes || "(sem observações registradas)"}`;

  const raw = await callGemini(apiKey, systemPrompt, userMessage);
  
  try {
    const clean = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    return JSON.parse(clean);
  } catch {
    return { classificacao: "Verde", alerta: "Não foi possível analisar as observações devido a um erro." };
  }
}

// ─── MODO: plan ──────────────────────────────────────────────────────────────
async function generatePlan(apiKey: string, body: PlanRequest) {
  const { prompt, context } = body;
  const { obras, equipes, alojamentos, atividades, parametros, orcamentoDetalhado } = context;

  const obrasResumidas = obras.slice(0, 10).map(o => ({
    projeto: o.projeto,
    nome: o.nomeProjeto,
    municipio: o.municipio,
    totalPontos: o.pontosDisponiveis?.length ?? 0,
    pontos: o.pontosDisponiveis?.slice(0, 30) ?? [],
  }));

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
- Meta de faturamento DIÁRIA de ${parametros.metaPercent}% (alvo por dia)
- Ponto de saída: ${parametros.pontoSaida}
- Alojamentos disponíveis: ${alojamentos.map(a => `${a.nome} (${a.unidadeNome})`).join(", ") || "base da unidade"}

REGRAS IMPORTANTES E MATEMÁTICAS:
1. Você DEVE distribuir TODOS os pontos do orçamento ao longo de VÁRIOS DIAS da semana, dividindo a carga de trabalho. Crie vários objetos na lista "dias", um para cada dia necessário até esgotar os pontos.
2. Cada dia tem um limite ESTRITO de ${parametros.jornadaHoras * 60} a ${(parametros.jornadaHoras + 1.5) * 60} minutos de trabalho. 
3. ATENÇÃO: Faça a soma do 'tempoEstimadoMinutos' de cada ponto que você colocar em um dia. A SOMA DOS MINUTOS NÃO PODE, EM HIPÓTESE ALGUMA, ULTRAPASSAR ${(parametros.jornadaHoras + 1) * 60} MINUTOS! Quando atingir o limite, crie um novo objeto na lista "dias" para o próximo dia (Terça, Quarta, etc).
4. A meta de ${parametros.metaPercent}% é DIÁRIA — pode não ser atingida todos os dias por limitação de tempo, a prioridade máxima é não estourar os minutos (Regra 3). Mas lembre-se: a meta é por dia!
5. Otimize a ordem dos pontos para minimizar deslocamento.
6. Considere que pontos P são postes, V são vãos de cabo — podem ser executados sequencialmente.

FORMATO DE RESPOSTA — retorne APENAS JSON válido, com a lista "dias" contendo múltiplos dias:
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
          "pontos": ["P1", "P2"],
          "tempoTotalMinutos": 450,
          "tempoTotalFormatado": "7h 30min",
          "valorEstimado": 4890.50,
          "percentualMeta": 110.1,
          "observacao": "Rota otimizada partindo de P1"
        },
        {
          "data": "19/08/2026",
          "diaSemana": "Terça-feira",
          "pontos": ["P3", "P4"],
          "tempoTotalMinutos": 420,
          "tempoTotalFormatado": "7h 00min",
          "valorEstimado": 4100.00,
          "percentualMeta": 95.0,
          "observacao": "Continuação da rota"
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
  "alertas": ["Observação importante 1"],
  "resumoTextual": "Texto descritivo do planejamento"
}`;

  const contextoJSON = JSON.stringify({
    obras: obrasResumidas,
    equipes,
    orcamentoObraSelecionada: orcamentoDetalhado,
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
