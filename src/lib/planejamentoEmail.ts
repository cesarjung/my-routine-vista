/**
 * Gerador de Payload e HTML para Envio de Planejamento Semanal (Módulo PCP)
 * 
 * Prepara o payload consolidado e gera o template HTML com design corporativo Sirtec,
 * formato amplo (1100px max-width) e compatível com clientes de e-mail (Outlook, Gmail, etc).
 */

import { gerarMapaEstaticoBase64 } from './geradorMapaEstatico';
import type { RiskResult } from '@/hooks/usePcpAiPlanner';

export function cleanPontosList(pontos: string[]): string[] {
  if (!pontos || !Array.isArray(pontos)) return [];
  const result: string[] = [];
  pontos.forEach(p => {
    if (!p) return;
    const str = String(p).trim();
    const matches = str.match(/([PV]\d+(?:-\d+)?)/gi);
    if (matches && matches.length > 0) {
      matches.forEach(m => {
        const cleanM = m.toUpperCase();
        if (!result.includes(cleanM)) result.push(cleanM);
      });
    } else {
      const firstPart = str.split('-')[0].trim();
      if (firstPart && !result.includes(firstPart)) result.push(firstPart);
    }
  });
  return result;
}

export interface EmailDestinatarios {
  para: string[];
  cc: string[];
  bcc?: string[];
}

export interface EmailBlocosConfig {
  resumo: boolean;
  calendario: boolean;
  conclusoes?: boolean;
  vistorias?: boolean;
  disponiveis?: boolean;
  alojamentos: boolean;
  observacoes: boolean;
  mapa: boolean;
}

export interface PlanejamentoEmailPayload {
  unidade: string;
  unidadeNome: string;
  semana: {
    inicio: string;
    fim: string;
    label: string;
  };
  assunto: string;
  modelo: 'completo' | 'resumido';
  destinatarios: EmailDestinatarios;
  blocos: EmailBlocosConfig;
  densidade: 'detalhado' | 'compacto';
  escopo: 'todas' | 'com_programacao';
  obrasConclusoes?: Array<{
    data: string;
    supervisorEquipe: string;
    equipe: string;
    projeto: string;
    tipo: string;
    valorObra: number;
  }>;
  resumoExecutivo?: {
    texto: string;
    destaques: Array<{
      id: string;
      titulo: string;
      texto: string;
      gravidade: 'critico' | 'atencao' | 'bom' | 'otimo';
    }>;
  };
  observacoes: string[];
  metricas: {
    planejado: number;
    meta: number;
    aderencia: number;
    jornadaMediaMin: number;
    deslocamentoMedioH: number;
    turnosAbaixo8: number;
    turnosAcima10: number;
    turnosAcima2h: number;
    turnosDentroMetaDesloc: number;
    equipesAcimaMeta: number;
    equipesAbaixoMeta: number;
  };
  equipes: Array<{
    codigo: string;
    supervisor: string;
    pctMeta: number;
    planejadoTotal?: number;
    totalPlanejado?: number;
    metaTotal?: number;
    mediaJornadaMin: number;
    mediaDeslocamentoH: number;
    temProgramacao: boolean;
    dias: any; // Record<string, any> ou Array<any>
  }>;
  alojamentos?: Array<{
    equipe: string;
    municipio: string;
    alojamento: string;
  }>;
  dias: Array<{
    data: string;
    label: string;
    diaSemana: string;
  }>;
  mapa?: {
    center: [number, number];
    zoom: number;
    imagemBase64?: string | null;
  };
  assinatura?: {
    tipo: 'html' | 'texto';
    conteudo: string;
  };
  vistorias?: Record<string, RiskResult>;
  criadoEm?: string;
}

/**
 * Cria o payload consolidado para o envio do planejamento
 */
export function buildPlanejamentoEmailPayload(params: Omit<PlanejamentoEmailPayload, 'criadoEm'>): PlanejamentoEmailPayload {
  return {
    ...params,
    criadoEm: new Date().toISOString(),
  };
}

/**
 * Destaca valores monetários (R$), percentuais (%) e tempos (h/m) no texto da Síntese
 * com cores: R$ em azul bold, % em escala verde-amarelo-vermelho, tempo em cinza bold
 */
function highlightResumoValues(texto: string): string {
  return texto.replace(
    /(R\$\s*[\d.,]+(?:\.[\d]+)?)|([\d.,]+%)|([\d]+h[\d]*m?|[\d.,]+h\s)/g,
    (match, money, pct, time) => {
      if (money) {
        return `<strong style="color: #1D58B5;">${match}</strong>`;
      }
      if (pct) {
        const val = parseFloat(pct.replace(',', '.'));
        const color = val >= 100 ? '#17794C' : val >= 70 ? '#C9A227' : '#C0392E';
        return `<strong style="color: ${color};">${match}</strong>`;
      }
      if (time) {
        return `<strong style="color: #5C574F;">${match}</strong>`;
      }
      return match;
    }
  );
}

/**
 * Gera o template HTML corporativo com distribuição ampla (1100px) para envio por e-mail
 */
export function generatePlanejamentoEmailHtml(payload: PlanejamentoEmailPayload): string {
  const {
    unidadeNome,
    semana,
    metricas,
    resumoExecutivo,
    blocos = { resumo: true, calendario: true, alojamentos: true, observacoes: true, mapa: true },
    equipes = [],
    dias = [],
    alojamentos = [],
    observacoes = [],
    vistorias = {},
  } = payload;

  const corAderencia = metricas.aderencia >= 100 ? '#17794C' : metricas.aderencia >= 80 ? '#D9782E' : '#C0392E';

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${payload.assunto}</title>
  <style>
    body { font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif; background-color: #F7F6F3; color: #23211E; margin: 0; padding: 10px 4px; }
    .email-container { width: 100%; max-width: 1380px; margin: 0 auto; background-color: #FFFFFF; border-radius: 10px; border: 1px solid #E6E3DD; overflow: hidden; }
    .header-box { padding: 16px 18px; border-bottom: 2px solid #E07A1F; background: linear-gradient(180deg, #FFFFFF 0%, #FAF8F5 100%); }
    .kpi-table { width: 100%; border-collapse: separate; border-spacing: 10px; }
    .kpi-card { background-color: #FFFFFF; border: 1px solid #E6E3DD; border-radius: 8px; padding: 12px 14px; }
    .data-table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 8px; }
    .data-table th { background-color: #F2F0EC; color: #5C574F; font-size: 10px; text-transform: uppercase; font-weight: bold; padding: 8px 6px; border-bottom: 1px solid #E6E3DD; }
    .data-table td { padding: 8px 6px; border-bottom: 1px solid #E6E3DD; vertical-align: top; }
  </style>
</head>
<body>
  <div class="email-container">
    <!-- CABEÇALHO -->
    <div class="header-box">
      <table style="width: 100%;">
        <tr>
          <td>
            <span style="font-size: 10px; font-weight: bold; color: #E07A1F; text-transform: uppercase; letter-spacing: 0.1em; display: block;">
              SIRTEC PCP · PROGRAMAÇÃO OPERACIONAL
            </span>
            <h1 style="margin: 3px 0 0 0; font-size: 19px; font-weight: bold; color: #23211E;">
              ${unidadeNome}
            </h1>
            <p style="margin: 2px 0 0 0; font-size: 11px; color: #6B6660;">
              Programação da Semana · ${semana.label || `${semana.inicio} a ${semana.fim}`}
            </p>
          </td>
          <td style="text-align: right;">
            <span style="font-size: 10px; color: #A39E96; display: block;">GERADO EM</span>
            <strong style="font-size: 11.5px; color: #23211E;">${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</strong>
          </td>
        </tr>
      </table>
    </div>

    <!-- CARDS DE INDICADORES (KPIS) -->
    <div style="padding: 12px 14px;">
      <table class="kpi-table">
        <tr>
          <td class="kpi-card" style="width: 33.3%;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 11px; font-weight: bold; color: #6B6660;">Planejado x Meta</span>
              <span style="font-size: 10px; font-weight: bold; padding: 2px 6px; border-radius: 4px; background-color: #EDF4E7; color: #17794C; border: 1px solid #CCE3B8;">
                Prog: ${metricas.aderenciaEquipesProgramadas || metricas.aderencia}%
              </span>
            </div>
            <div style="font-size: 24px; font-weight: bold; color: ${corAderencia}; margin: 4px 0;">
              ${metricas.aderencia}%
              <span style="font-size: 11px; font-weight: normal; color: #6B6660;">(global)</span>
            </div>
            <span style="font-size: 11px; color: #5C574F; display: block;">
              R$ ${metricas.planejado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} de R$ ${metricas.meta.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
            ${metricas.metaEquipesProgramadas && metricas.metaEquipesProgramadas < metricas.meta ? `
              <span style="font-size: 10px; color: #8C877D; display: block; margin-top: 2px;">
                Meta das programadas: R$ ${metricas.metaEquipesProgramadas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            ` : ''}
            <div style="margin-top: 8px; font-size: 10.5px; color: #6B6660;">
              <span style="display: inline-block; background-color: #E6F2EA; color: #17794C; padding: 2px 6px; border-radius: 4px; font-weight: bold; margin-right: 4px;">
                ${metricas.equipesAcimaMeta} equipes ≥100%
              </span>
              <span style="display: inline-block; background-color: #FBEBDC; color: #B4581A; padding: 2px 6px; border-radius: 4px; font-weight: bold;">
                ${metricas.equipesAbaixoMeta} abaixo
              </span>
            </div>
          </td>
          <td class="kpi-card" style="width: 33.3%;">
            <span style="font-size: 11px; font-weight: bold; color: #6B6660; display: block;">Jornada Média das Equipes</span>
            <div style="font-size: 24px; font-weight: bold; color: #23211E; margin: 4px 0;">
              ${Math.floor(metricas.jornadaMediaMin / 60).toString().padStart(2, '0')}:${Math.round(metricas.jornadaMediaMin % 60).toString().padStart(2, '0')}
            </div>
            <span style="font-size: 11px; color: #5C574F; display: block;">
              Média por turno programado
            </span>
            <div style="margin-top: 8px; font-size: 10.5px; color: #6B6660;">
              <span style="display: inline-block; background-color: #FBF2DA; color: #A06A16; padding: 2px 6px; border-radius: 4px; font-weight: bold; margin-right: 4px;">
                ${metricas.turnosAbaixo8} &lt; 08:00
              </span>
              <span style="display: inline-block; background-color: #F9E4E1; color: #B03028; padding: 2px 6px; border-radius: 4px; font-weight: bold;">
                ${metricas.turnosAcima10} &gt; 10:00
              </span>
            </div>
          </td>
          <td class="kpi-card" style="width: 33.3%;">
            <span style="font-size: 11px; font-weight: bold; color: #6B6660; display: block;">Deslocamento Médio</span>
            <div style="font-size: 24px; font-weight: bold; color: #23211E; margin: 4px 0;">
              ${metricas.deslocamentoMedioH.toFixed(1)}h
            </div>
            <span style="font-size: 11px; color: #5C574F; display: block;">
              Média acumulada de ida e volta
            </span>
            <div style="margin-top: 8px; font-size: 10.5px; color: #6B6660;">
              <span style="display: inline-block; background-color: #E6F2EA; color: #17794C; padding: 2px 6px; border-radius: 4px; font-weight: bold; margin-right: 4px;">
                ${metricas.turnosDentroMetaDesloc} na meta
              </span>
              <span style="display: inline-block; background-color: #FBEBDC; color: #B4581A; padding: 2px 6px; border-radius: 4px; font-weight: bold;">
                ${metricas.turnosAcima2h} &gt; 2,0h
              </span>
            </div>
          </td>
        </tr>
      </table>
    </div>



    <!-- 6. OBSERVAÇÕES DO PLANEJADOR -->
    ${blocos.observacoes && observacoes && observacoes.length > 0 ? `
    <div style="padding: 0 14px 16px 14px;">
      <div style="background-color: #FBF5EC; border: 1px solid #E8C9A0; border-radius: 8px; padding: 14px 16px;">
        <strong style="font-size: 12px; color: #23211E; display: block; margin-bottom: 8px;">
          Observações e Recomendações do Planejador
        </strong>
        <ul style="margin: 0; padding-left: 18px; font-size: 11.5px; color: #23211E; line-height: 1.6;">
          ${observacoes.map(obs => `<li>${obs}</li>`).join('')}
        </ul>
      </div>
    </div>
    ` : ''}

    <!-- 2. MAPA DE DESLOCAMENTOS -->
    ${blocos.mapa ? (() => {
      const mapaImg = payload.mapa?.imagemBase64 || (typeof document !== 'undefined' ? gerarMapaEstaticoBase64(
        equipes.filter(e => e.temProgramacao).map(eq => {
          const munSet = new Set<string>();
          if (eq.dias) {
            if (Array.isArray(eq.dias)) {
              eq.dias.forEach((d: any) => { if (d && d.municipio && !d.isFolga && !d.isFeriado && d.municipio !== 'FOLGA') munSet.add(d.municipio); });
            } else {
              Object.values(eq.dias).forEach((d: any) => { if (d && d.municipio && !d.isFolga && !d.isFeriado && d.municipio !== 'FOLGA') munSet.add(d.municipio); });
            }
          }
          return {
            codigo: eq.codigo,
            supervisor: eq.supervisor,
            municipios: Array.from(munSet),
            deslocamentoH: eq.mediaDeslocamentoH,
            pctMeta: eq.pctMeta,
          };
        }),
        unidadeNome || 'BOM JESUS DA LAPA',
        semana.label || ''
      ) : '');

      return `
      <div style="padding: 0 14px 16px 14px;">
        <div style="background-color: #FFFFFF; border: 1px solid #E6E3DD; border-radius: 10px; padding: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <div>
              <strong style="font-size: 13px; color: #23211E; display: block;">
                📍 Mapa de Deslocamentos das Equipes
              </strong>
              <span style="font-size: 11px; color: #6B6660;">
                Raios de atendimento e frentes de trabalho no período
              </span>
            </div>
            <span style="font-size: 11px; font-weight: bold; color: #17794C; background-color: #E6F2EA; padding: 3px 8px; border-radius: 4px;">
              Média Geral: ${metricas.deslocamentoMedioH.toFixed(1).replace('.', ',')}h / turno
            </span>
          </div>

          ${mapaImg ? `
            <div style="text-align: center; margin: 12px 0;">
              <img src="${mapaImg}" alt="Mapa de Deslocamentos das Equipes" style="display: block; width: 100%; max-width: 100%; height: auto; border-radius: 8px; border: 1px solid #E6E3DD;" />
            </div>
          ` : ''}
        </div>
      </div>
      `;
    })() : ''}

    <!-- 3. GRADE DA PROGRAMAÇÃO SEMANAL -->
    ${blocos.calendario ? `
    <div style="padding: 0 14px 16px 14px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <h3 style="font-size: 13px; font-weight: bold; color: #23211E; margin: 0;">
          Grade de Programação por Equipe (${equipes.length} equipes)
        </h3>
        <span style="font-size: 11px; color: #6B6660;">
          Horários em hh:mm · Deslocamento médio acumulado
        </span>
      </div>
      <div style="overflow-x: auto;">
        <table class="data-table" style="table-layout: fixed; width: 1520px; border-collapse: collapse;">
          <thead>
            <tr>
              <th style="text-align: left; width: 90px; padding: 6px 4px;">Equipe</th>
              ${dias.map(d => `<th style="text-align: center; width: 140px; padding: 6px 2px;">${d.diaSemana}<br><span style="font-weight: normal; font-size: 8px;">${d.label || d.data}</span></th>`).join('')}
              <th style="text-align: right; width: 75px; padding: 6px 4px;">Planejado</th>
              <th style="text-align: right; width: 65px; padding: 6px 4px;">Meta</th>
              <th style="text-align: center; width: 42px; padding: 6px 2px;">%</th>
              <th style="text-align: center; width: 90px; padding: 6px 2px;">Status Prod.</th>
              <th style="text-align: center; width: 50px; padding: 6px 2px;">Desloc.</th>
              <th style="text-align: center; width: 100px; padding: 6px 2px;">Status Desloc.</th>
            </tr>
          </thead>
          <tbody>
            ${(() => {
              // Group by supervisor
              const supervisorGroups = new Map<string, typeof equipes>();
              equipes.forEach(eq => {
                const supName = eq.supervisor || 'Sem Supervisor';
                if (!supervisorGroups.has(supName)) {
                  supervisorGroups.set(supName, []);
                }
                supervisorGroups.get(supName)!.push(eq);
              });

              // Convert map to sorted array of groups
              const sortedGroups = Array.from(supervisorGroups.entries()).sort((a, b) => a[0].localeCompare(b[0]));

              return sortedGroups.map(([supervisor, groupEquipes]) => {
                // Calcular totais do supervisor
                const supTotalPlan = groupEquipes.reduce((s, e) => s + (e.totalPlanejado ?? e.planejadoTotal ?? 0), 0);
                const supTotalMeta = groupEquipes.reduce((s, e) => s + (e.metaSemanal || 0), 0);
                const supPctMeta = supTotalMeta > 0 ? Math.round((supTotalPlan / supTotalMeta) * 100) : 0;
                const supEquipesComProg = groupEquipes.filter(e => e.temProgramacao);
                const supMediaDesloc = supEquipesComProg.length > 0
                  ? Math.round(supEquipesComProg.reduce((s, e) => s + Number(e.mediaDeslocamentoH || 0), 0) / supEquipesComProg.length * 10) / 10
                  : 0;

                // Status badges do supervisor
                const supFundoBadge = supPctMeta >= 100 ? '#E6F2EA' : supPctMeta >= 70 ? '#FBF2DA' : '#F9E4E1';
                const supCorBadge = supPctMeta >= 100 ? '#17794C' : supPctMeta >= 70 ? '#A06A16' : '#C0392E';
                const supStatusTexto = supPctMeta >= 100 ? 'Meta Atingida' : supPctMeta >= 70 ? 'Atenção' : 'Abaixo Meta';
                const supFundoDesloc = supMediaDesloc <= 2.0 ? '#E6F2EA' : '#FBEBDC';
                const supCorDesloc = supMediaDesloc <= 2.0 ? '#17794C' : '#B4581A';
                const supTextoDesloc = supMediaDesloc <= 2.0 ? 'Dentro da Meta' : 'Atenção > 2,0h';

                // Header for the supervisor group with totals
                const groupHeaderHtml = `
                  <tr>
                    <td colspan="${dias.length + 1}" style="background-color: #FAF8F5; font-weight: bold; color: #5C574F; padding: 6px 8px; border-bottom: 1px solid #E6E3DD; font-size: 11px; text-align: left;">
                      👤 Supervisor: ${supervisor} (${groupEquipes.length} ${groupEquipes.length === 1 ? 'equipe' : 'equipes'})
                    </td>
                    <td style="background-color: #FAF8F5; text-align: right; font-family: monospace; font-size: 10px; color: #17794C; font-weight: bold; padding: 6px 4px; border-bottom: 1px solid #E6E3DD; white-space: nowrap;">
                      R$ ${supTotalPlan.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>
                    <td style="background-color: #FAF8F5; text-align: right; font-family: monospace; font-size: 10px; color: #6B6660; font-weight: bold; padding: 6px 4px; border-bottom: 1px solid #E6E3DD; white-space: nowrap;">
                      R$ ${supTotalMeta.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>
                    <td style="background-color: #FAF8F5; text-align: center; vertical-align: middle; padding: 4px 2px; border-bottom: 1px solid #E6E3DD;">
                      <span style="background-color: ${supFundoBadge}; color: ${supCorBadge}; font-weight: bold; font-family: monospace; font-size: 9px; padding: 2px 4px; border-radius: 3px; display: inline-block;">
                        ${supPctMeta}%
                      </span>
                    </td>
                    <td style="background-color: #FAF8F5; text-align: center; vertical-align: middle; padding: 4px 2px; border-bottom: 1px solid #E6E3DD;">
                      <span style="background-color: ${supFundoBadge}; color: ${supCorBadge}; font-weight: bold; font-family: monospace; font-size: 9px; padding: 2px 4px; border-radius: 3px; display: inline-block;">
                        ${supStatusTexto}
                      </span>
                    </td>
                    <td style="background-color: #FAF8F5; text-align: center; vertical-align: middle; font-weight: bold; color: #23211E; font-family: monospace; font-size: 10px; border-bottom: 1px solid #E6E3DD;">
                      ${supEquipesComProg.length > 0 ? `${supMediaDesloc.toFixed(1).replace('.', ',')}h` : '-'}
                    </td>
                    <td style="background-color: #FAF8F5; text-align: center; vertical-align: middle; padding: 4px 2px; border-bottom: 1px solid #E6E3DD;">
                      ${supEquipesComProg.length > 0 ? `
                        <span style="background-color: ${supFundoDesloc}; color: ${supCorDesloc}; font-weight: bold; font-family: monospace; font-size: 9px; padding: 2px 4px; border-radius: 3px; display: inline-block;">
                          ${supTextoDesloc}
                        </span>
                      ` : '-'}
                    </td>
                  </tr>
                `;

                const rowsHtml = groupEquipes.map(eq => {
                  const pctMeta = Math.round(eq.pctMeta || 0);
                  const totalPlan = eq.totalPlanejado ?? eq.planejadoTotal ?? 0;
                  const metaSemanal = eq.metaSemanal || 0;
                  const temProg = eq.temProgramacao;
                  const mediaDesloc = Number(eq.mediaDeslocamentoH || 0);
                  const mediaDeslocH = mediaDesloc.toFixed(1).replace('.', ',');

                  // Status Produção badges
                  const corBadge = !temProg ? '#BFB9B0' : pctMeta >= 100 ? '#17794C' : pctMeta >= 70 ? '#C9A227' : '#C0392E';
                  const fundoBadge = !temProg ? '#F0EDE8' : pctMeta >= 100 ? '#E6F2EA' : pctMeta >= 70 ? '#FBF2DA' : '#F9E4E1';
                  const statusTexto = !temProg ? 'Sem Progr.' : pctMeta >= 100 ? 'Meta Atingida' : pctMeta >= 70 ? 'Atenção' : 'Abaixo Meta';

                  // Status Deslocamento badges
                  const fundoDesloc = !temProg ? '#F0EDE8' : mediaDesloc <= 2.0 ? '#E6F2EA' : '#FBEBDC';
                  const corDesloc = !temProg ? '#6B6660' : mediaDesloc <= 2.0 ? '#17794C' : '#B4581A';
                  const textoDesloc = !temProg ? '-' : mediaDesloc <= 2.0 ? 'Dentro da Meta' : 'Atenção > 2,0h';

                  const mediaJornadaH = eq.mediaJornadaMin ? `${Math.floor(eq.mediaJornadaMin / 60).toString().padStart(2, '0')}:${Math.round(eq.mediaJornadaMin % 60).toString().padStart(2, '0')}` : '';

                  return `
                  <tr>
                    <td style="font-weight: bold; color: #23211E; border-left: 3px solid ${temProg ? corBadge : '#BFB9B0'}; vertical-align: top; padding: 5px 6px; height: 130px; box-sizing: border-box;">
                      <span style="font-size: 11.5px; color: #23211E; display: block; white-space: nowrap;">${eq.codigo}</span>
                      <span style="font-size: 9px; font-weight: normal; color: #6B6660; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 75px;" title="${eq.supervisor || ''}">${eq.supervisor || ''}</span>
                      ${temProg ? `
                        <span style="font-size: 8.5px; font-weight: normal; color: #8C877D; font-family: monospace; display: block; margin-top: 2px; white-space: nowrap;">
                          ${mediaJornadaH} · ${mediaDeslocH}h
                        </span>
                      ` : ''}
                    </td>
                    ${dias.map(d => {
                      let diaInfo: any = null;
                      if (eq.dias) {
                        if (Array.isArray(eq.dias)) {
                          diaInfo = eq.dias.find((item: any) => item.data === d.data);
                        } else {
                          diaInfo = eq.dias[d.data];
                        }
                      }

                      if (!diaInfo) {
                        return `
                          <td style="text-align: center; vertical-align: middle; background-color: #F7F6F3; padding: 4px 2px; height: 130px; box-sizing: border-box;">
                            ${d.diaSemana?.toLowerCase() === 'dom' ? '<span style="color: #8C877D; font-size: 9.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Domingo</span>' : ''}
                          </td>
                        `;
                      }

                      if (diaInfo.isFolga || diaInfo.folga) {
                        return `
                          <td style="text-align: center; vertical-align: middle; background-color: #F7F6F3; padding: 4px 2px; height: 130px; box-sizing: border-box;">
                            <span style="color: #8C877D; font-size: 9.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                              Folga
                            </span>
                          </td>
                        `;
                      }

                      if (diaInfo.isFeriado) {
                        return `
                          <td style="text-align: center; vertical-align: middle; background-color: #F7F6F3; padding: 4px 2px; height: 130px; box-sizing: border-box;">
                            <span style="color: #8C877D; font-size: 9.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Feriado</span>
                          </td>
                        `;
                      }

                      if (diaInfo.isIndisponivel) {
                        return `
                          <td style="text-align: center; vertical-align: middle; background-color: #FBF5EC; border: 1px solid #E8C9A0; padding: 4px 2px; height: 130px; box-sizing: border-box;">
                            <span style="color: #B4581A; font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Indisponível</span>
                          </td>
                        `;
                      }

                      const pctDia = Math.round(diaInfo.pctMetaDia || 0);
                      const corBadgeFundo = pctDia >= 100 ? '#E6F2EA' : pctDia >= 70 ? '#FBF2DA' : pctDia > 0 ? '#FBEBDC' : '#F0EDE8';
                      const corBadgeTexto = pctDia >= 100 ? '#17794C' : pctDia >= 70 ? '#A06A16' : pctDia > 0 ? '#B4581A' : '#6B6660';

                      const etapa = diaInfo.etapa || 'IMPLANTAÇÃO';
                      const obra = diaInfo.obra || 'OBRA';
                      const municipio = diaInfo.municipio || 'BASE';
                      
                      const jornadaTotalMin = diaInfo.tempoTotalMin || 510;
                      const jornadaH = `${Math.floor(jornadaTotalMin / 60).toString().padStart(2, '0')}:${Math.round(jornadaTotalMin % 60).toString().padStart(2, '0')}`;
                      const corJornadaDot = jornadaTotalMin > 600 ? '#C0392E' : jornadaTotalMin >= 450 ? '#17794C' : '#C9A227';
                      
                      const deslocMin = diaInfo.tempoDeslocamentoMin || 60;
                      const deslocH = (deslocMin / 60).toFixed(1).replace('.', ',');
                      const corDeslocDot = deslocMin / 60 <= 1.2 ? '#17794C' : deslocMin / 60 <= 2.0 ? '#48A866' : deslocMin / 60 <= 2.5 ? '#C9A227' : '#C0392E';

                      const rawPontos = Array.isArray(diaInfo.pontos) ? diaInfo.pontos : [];
                      const cleanPontos = cleanPontosList(rawPontos);

                      return `
                        <td style="text-align: left; vertical-align: top; background-color: #FFFFFF; padding: 4px 5px; height: 130px; box-sizing: border-box; overflow: hidden;">
                          <!-- Faixa Superior: % e Município -->
                          <table style="width: 100%; border-collapse: collapse; margin-bottom: 2px;">
                            <tr>
                              <td style="text-align: left; padding: 0; white-space: nowrap;">
                                <span style="background-color: ${corBadgeFundo}; color: ${corBadgeTexto}; font-weight: bold; font-family: monospace; font-size: 8.5px; padding: 1px 3px; border-radius: 2px;">
                                  ${pctDia > 0 ? `${pctDia}%` : '-'}
                                </span>
                              </td>
                              <td style="text-align: right; padding: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 90px;">
                                <span style="background-color: #F2F0EC; color: #6B6660; font-weight: bold; font-size: 8px; padding: 1px 3px; border-radius: 2px; text-transform: uppercase;" title="${municipio}">
                                  ${municipio}
                                </span>
                              </td>
                            </tr>
                          </table>

                          <!-- Etapa -->
                          <div style="font-weight: bold; color: #23211E; font-size: 9px; text-transform: uppercase; line-height: 1.1; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${etapa}">
                            ${etapa}
                          </div>

                          <!-- Obra -->
                          <div style="color: #6B6660; font-family: monospace; font-size: 8.5px; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${obra}">
                            ${obra}
                          </div>

                          <!-- Saturação (Jornada) e Deslocamento -->
                          <div style="font-family: monospace; font-size: 8.5px; color: #5C574F; margin-top: 2px; line-height: 1.1; white-space: nowrap;">
                            <span style="color: ${corJornadaDot}; font-weight: bold;">•</span>
                            <strong style="color: #23211E;">${jornadaH}</strong>
                            <span style="color: #A39E96;">·</span>
                            <span style="color: ${corDeslocDot}; font-weight: bold;">•</span>
                            <span style="color: ${corDeslocDot}; font-weight: bold;">desl ${deslocH}h</span>
                          </div>

                          <!-- Pontos e Vãos -->
                          ${cleanPontos.length > 0 ? `
                            <div style="font-family: monospace; font-size: 8px; color: #8C877D; border-top: 1px solid #F0EDE8; margin-top: 2px; padding-top: 1px; line-height: 1.25; word-break: break-word; overflow: hidden;" title="${cleanPontos.join(', ')}">
                              ${cleanPontos.join(', ')}
                            </div>
                          ` : ''}
                        </td>
                      `;
                    }).join('')}
                    <td style="text-align: right; font-weight: bold; color: #17794C; vertical-align: middle; font-family: monospace; font-size: 10.5px; padding: 4px 4px; white-space: nowrap;">
                      R$ ${totalPlan.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>
                    <td style="text-align: right; color: #6B6660; vertical-align: middle; font-family: monospace; font-size: 10px; padding: 4px 4px; white-space: nowrap;">
                      R$ ${metaSemanal.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>
                    <td style="text-align: center; vertical-align: middle; padding: 4px 2px;">
                      <span style="background-color: ${temProg ? fundoBadge : '#F0EDE8'}; color: ${temProg ? corBadge : '#6B6660'}; font-weight: bold; font-family: monospace; font-size: 9.5px; padding: 2px 4px; border-radius: 3px; display: inline-block;">
                        ${temProg ? `${pctMeta}%` : '-'}
                      </span>
                    </td>
                    <td style="text-align: center; vertical-align: middle; padding: 4px 2px;">
                      <span style="background-color: ${fundoBadge}; color: ${corBadge}; font-weight: bold; font-family: monospace; font-size: 9.5px; padding: 2px 4px; border-radius: 3px; display: inline-block;">
                        ${statusTexto}
                      </span>
                    </td>
                    <td style="text-align: center; vertical-align: middle; font-weight: bold; color: #23211E; font-family: monospace; font-size: 10.5px;">
                      ${temProg ? `${mediaDeslocH}h` : '-'}
                    </td>
                    <td style="text-align: center; vertical-align: middle; padding: 4px 2px;">
                      ${temProg ? `
                        <span style="background-color: ${fundoDesloc}; color: ${corDesloc}; font-weight: bold; font-family: monospace; font-size: 9.5px; padding: 2px 4px; border-radius: 3px; display: inline-block;">
                          ${textoDesloc}
                        </span>
                      ` : '-'}
                    </td>
                  </tr>
                  `;
                }).join('');

                return groupHeaderHtml + rowsHtml;
              }).join('');
            })()}
          </tbody>
          <tfoot>
            ${(() => {
              const totalPlanejadoGeral = metricas.planejado || 0;
              const totalMetaGeral = metricas.meta || 0;
              const pctGeral = metricas.aderencia || 0;
              const deslocGeral = metricas.deslocamentoMedioH || 0;
              
              // Status Produção Geral
              const fundoBadgeGeral = pctGeral >= 100 ? '#E6F2EA' : pctGeral >= 70 ? '#FBF2DA' : '#F9E4E1';
              const corBadgeGeral = pctGeral >= 100 ? '#17794C' : pctGeral >= 70 ? '#A06A16' : '#C0392E';
              const statusTextoGeral = pctGeral >= 100 ? 'Meta Atingida' : pctGeral >= 70 ? 'Atenção' : 'Abaixo Meta';

              // Status Deslocamento Geral
              const fundoDeslocGeral = deslocGeral <= 2.0 ? '#E6F2EA' : '#FBEBDC';
              const corDeslocGeral = deslocGeral <= 2.0 ? '#17794C' : '#B4581A';
              const textoDeslocGeral = deslocGeral <= 2.0 ? 'Dentro da Meta' : 'Atenção > 2,0h';

              return `
              <tr style="background-color: #FAF8F5; border-top: 2px solid #DEDAD3; font-weight: bold;">
                <td style="padding: 6px 4px; text-transform: uppercase; font-size: 9px; color: #5C574F; letter-spacing: 0.5px;">Total Geral</td>
                ${dias.map(() => '<td></td>').join('')}
                <td style="text-align: right; font-family: monospace; font-size: 10.5px; color: #17794C; padding: 6px 4px; white-space: nowrap;">
                  R$ ${totalPlanejadoGeral.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </td>
                <td style="text-align: right; font-family: monospace; font-size: 10px; color: #6B6660; padding: 6px 4px; white-space: nowrap;">
                  R$ ${totalMetaGeral.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </td>
                <td style="text-align: center; vertical-align: middle; padding: 4px 2px;">
                  <span style="background-color: ${fundoBadgeGeral}; color: ${corBadgeGeral}; font-weight: bold; font-family: monospace; font-size: 9.5px; padding: 2px 4px; border-radius: 3px; display: inline-block;">
                    ${pctGeral}%
                  </span>
                </td>
                <td style="text-align: center; vertical-align: middle; padding: 4px 2px;">
                  <span style="background-color: ${fundoBadgeGeral}; color: ${corBadgeGeral}; font-weight: bold; font-family: monospace; font-size: 9.5px; padding: 2px 4px; border-radius: 3px; display: inline-block;">
                    ${statusTextoGeral}
                  </span>
                </td>
                <td style="text-align: center; vertical-align: middle; font-weight: bold; color: #23211E; font-family: monospace; font-size: 10.5px;">
                  ${deslocGeral.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}h
                </td>
                <td style="text-align: center; vertical-align: middle; padding: 4px 2px;">
                  <span style="background-color: ${fundoDeslocGeral}; color: ${corDeslocGeral}; font-weight: bold; font-family: monospace; font-size: 9.5px; padding: 2px 4px; border-radius: 3px; display: inline-block;">
                    ${textoDeslocGeral}
                  </span>
                </td>
              </tr>`;
            })()}
          </tfoot>
        </table>
      </div>
    </div>
    ` : ''}

    <!-- 3.5 QUADRO DE CONCLUSÕES DE OBRAS -->
    ${(() => {
      if (blocos.conclusoes === false) return '';
      const conclusoesList = payload.obrasConclusoes || [];
      if (conclusoesList.length === 0) return '';

      const totalValConsiderado = conclusoesList.reduce((acc, c) => acc + (c.valorObra || 0), 0);
      const semanaLabel = semana?.inicio && semana?.fim
        ? `${semana.inicio.split('-').reverse().slice(0, 2).join('/')} ATÉ ${semana.fim.split('-').reverse().slice(0, 2).join('/')}`
        : 'SEMANA';

      return `
      <div style="margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px;">
          <tr>
            <td style="vertical-align: middle;">
              <h3 style="margin: 0; font-size: 13px; font-weight: bold; color: #23211E; text-transform: uppercase; letter-spacing: 0.5px;">
                Planejado Conclusão de Obras (${conclusoesList.length})
              </h3>
            </td>
            <td style="text-align: right; vertical-align: middle;">
              <span style="font-size: 10.5px; color: #6B6660;">
                Semana de ${semanaLabel} · Obras com etapa Conclusão ou Desligamento/Conclusão
              </span>
            </td>
          </tr>
        </table>

        <div style="background-color: #FFFFFF; border: 1px solid #E6E3DD; border-radius: 8px; overflow: hidden;">
          <table style="width: 100%; border-collapse: collapse; font-size: 10.5px; text-align: left;">
            <thead>
              <tr style="background-color: #FAF8F5; border-bottom: 1px solid #E6E3DD; color: #5C574F; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px;">
                <th style="padding: 7px 8px; font-weight: bold; text-align: center; width: 14%;">Data</th>
                <th style="padding: 7px 8px; font-weight: bold; text-align: left; width: 24%;">Supervisor Equipe</th>
                <th style="padding: 7px 8px; font-weight: bold; text-align: left; width: 18%;">Projeto</th>
                <th style="padding: 7px 8px; font-weight: bold; text-align: center; width: 24%;">Tipo</th>
                <th style="padding: 7px 8px; font-weight: bold; text-align: right; width: 20%;">Valor Obra</th>
              </tr>
            </thead>
            <tbody>
              ${conclusoesList.map((c, idx) => {
                const bgRow = idx % 2 === 0 ? '#FFFFFF' : '#FBFAF7';
                const badgeBg = c.tipo.includes('DESLIG') ? '#FBF2DA' : '#E6F2EA';
                const badgeColor = c.tipo.includes('DESLIG') ? '#A06A16' : '#17794C';

                return `
                <tr style="background-color: ${bgRow}; border-bottom: 1px solid #F0EDE8;">
                  <td style="padding: 6px 8px; text-align: center; color: #23211E;">${c.data}</td>
                  <td style="padding: 6px 8px; text-align: left; font-weight: bold; color: #23211E; text-transform: uppercase;">${c.supervisorEquipe}</td>
                  <td style="padding: 6px 8px; text-align: left; font-family: monospace; font-weight: bold; color: #E07A1F;">${c.projeto}</td>
                  <td style="padding: 6px 8px; text-align: center;">
                    <span style="background-color: ${badgeBg}; color: ${badgeColor}; font-weight: bold; font-size: 8.5px; padding: 2px 6px; border-radius: 3px; text-transform: uppercase;">
                      ${c.tipo}
                    </span>
                  </td>
                  <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-weight: bold; color: #23211E; white-space: nowrap;">
                    ${c.valorObra > 0 ? `R$ ${c.valorObra.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                  </td>
                </tr>
                `;
              }).join('')}
            </tbody>
            <tfoot>
              <tr style="background-color: #FAF8F5; border-top: 2px solid #DEDAD3; font-weight: bold; font-size: 10.5px;">
                <td colspan="4" style="padding: 6px 8px; text-align: right; text-transform: uppercase; font-size: 9px; color: #5C574F;">
                  Total (${conclusoesList.length} ${conclusoesList.length === 1 ? 'obra' : 'obras'}):
                </td>
                <td style="padding: 6px 8px; text-align: right; font-family: monospace; color: #17794C; white-space: nowrap;">
                  R$ ${totalValConsiderado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      `;
    })()}

    <!-- 4. ANÁLISE DE VISTORIA POR OBRA -->
    ${(() => {
      // ANÁLISE DE VISTORIA POR OBRA
      if (blocos.vistorias === false) return '';
      const obrasMap = new Map<string, { obra: string; equipes: Set<string>; etapas: Set<string> }>();
      equipes.forEach(eq => {
        const diasObj = Array.isArray(eq.dias) ? eq.dias : (eq.dias ? Object.values(eq.dias) : []);
        diasObj.forEach((d: any) => {
          if (d && d.obra && !d.isFolga && !d.isFeriado) {
            if (!obrasMap.has(d.obra)) obrasMap.set(d.obra, { obra: d.obra, equipes: new Set(), etapas: new Set() });
            const e = obrasMap.get(d.obra)!;
            e.equipes.add(eq.codigo);
            if (d.etapa) e.etapas.add(d.etapa);
          }
        });
      });
      const obrasArr = Array.from(obrasMap.values());
      if (obrasArr.length === 0) return '';

      // Helper: gera HTML de um card de obra
      function renderObraCard(o: { obra: string; equipes: Set<string>; etapas: Set<string> }) {
        const risk = vistorias[o.obra];
        const isVermelho = risk?.classificacao === 'Vermelho';
        const isSemVistoria = !risk;

        // Badge
        let badgeBg = '#E6F2EA'; let badgeColor = '#17794C'; let badgeBorder = '1px solid #A0D4B2';
        let label = risk ? 'Risco ' + risk.classificacao : 'Sem vistoria';
        if (isVermelho) { badgeBg = '#C0392E'; badgeColor = '#FFFFFF'; badgeBorder = '1px solid #A93226'; }
        else if (isSemVistoria) { badgeBg = '#3C3833'; badgeColor = '#FFFFFF'; badgeBorder = 'none'; }
        else if (risk?.classificacao === 'Laranja') { badgeBg = '#FBF2DA'; badgeColor = '#A06A16'; badgeBorder = '1px solid #E8C9A0'; }

        // Card border
        let cardBorder = '1px solid #E6E3DD';
        if (isVermelho) cardBorder = '2px solid #C0392E';
        else if (isSemVistoria) cardBorder = '2px solid #3C3833';
        else if (risk?.classificacao === 'Laranja') cardBorder = '2px solid #E8C9A0';

        // Pontos detalhados
        const pontosHtml = risk?.pontosDetalhados && risk.pontosDetalhados.length > 0
          ? risk.pontosDetalhados.map(pt => {
              const isCrit = Boolean(pt.isCritico);
              return '<div style="padding: 4px 8px; margin-bottom: 3px; border-radius: 4px; font-size: 10.5px; line-height: 1.4; '
                + (isCrit ? 'background-color: #C0392E; color: #FFFFFF; font-weight: bold; border: 1px solid #A93226;' : 'background-color: #FFFFFF; border: 1px solid #E6E3DD; color: #23211E;')
                + '">' + (pt.icone || (isCrit ? '🔴' : '📌')) + ' '
                + (pt.categoria ? '<span style="font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; '
                  + (isCrit ? 'color: #FFD4D0; font-weight: bold;' : 'color: #8A857D; font-weight: 600;')
                  + '">[' + pt.categoria + ']</span> ' : '')
                + pt.texto + '</div>';
            }).join('')
          : '<div style="font-size: 10.5px; color: #A39E96; font-style: italic;">' + (risk ? 'Nenhum impeditivo crítico registrado.' : 'Vistoria não realizada para esta obra.') + '</div>';

        return '<div style="background-color: #FBFAF7; border: ' + cardBorder + '; border-radius: 8px; padding: 10px 12px; margin-bottom: 8px;">'
          + '<table style="width: 100%; border-collapse: collapse;"><tr>'
          + '<td style="vertical-align: top;"><strong style="font-size: 11.5px; color: #23211E;">' + o.obra + '</strong>'
          + '<br><span style="font-size: 10px; color: #6B6660;">' + Array.from(o.equipes).join(', ') + ' · ' + Array.from(o.etapas).join(', ') + '</span></td>'
          + '<td style="text-align: right; vertical-align: top; white-space: nowrap; padding-left: 8px;">'
          + '<span style="padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; background-color: ' + badgeBg + '; color: ' + badgeColor + '; border: ' + badgeBorder + ';">' + label + '</span>'
          + '</td></tr></table>'
          + '<div style="margin-top: 6px;">' + pontosHtml + '</div>'
          + '</div>';
      }

      // Ordenar: Vermelho > Laranja > Verde > Sem vistoria
      const riskOrder = (o: typeof obrasArr[0]) => {
        const r = vistorias[o.obra];
        if (!r) return 4;
        if (r.classificacao === 'Vermelho') return 1;
        if (r.classificacao === 'Laranja') return 2;
        return 3;
      };
      obrasArr.sort((a, b) => riskOrder(a) - riskOrder(b));

      // Distribuir em 2 colunas balanceando pelo "peso" (nº de pontos detalhados = altura estimada)
      const col1: typeof obrasArr = [];
      const col2: typeof obrasArr = [];
      let h1 = 0, h2 = 0;
      obrasArr.forEach(o => {
        const risk = vistorias[o.obra];
        const numPontos = risk?.pontosDetalhados?.length || 0;
        const peso = 1 + numPontos;
        if (h1 <= h2) { col1.push(o); h1 += peso; }
        else { col2.push(o); h2 += peso; }
      });

      return `
      <div style="padding: 0 14px 16px 14px;">
        <div style="background-color: #FFFFFF; border: 1px solid #E6E3DD; border-radius: 10px; padding: 16px;">
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 10px;">
            <tr>
              <td style="vertical-align: middle;">
                <strong style="font-size: 13px; color: #23211E;">👁️ Análise de Vistoria por Obra (${obrasArr.length})</strong>
              </td>
              <td style="text-align: right; vertical-align: middle;">
                <span style="font-size: 11px; color: #6B6660;">Dados da vistoria analisados por IA</span>
              </td>
            </tr>
          </table>

          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="width: 50%; vertical-align: top; padding-right: 6px;">
                ${col1.map(o => renderObraCard(o)).join('')}
              </td>
              <td style="width: 50%; vertical-align: top; padding-left: 6px;">
                ${col2.map(o => renderObraCard(o)).join('')}
              </td>
            </tr>
          </table>
        </div>
      </div>
      `;
    })()}

    <!-- 5. ALOJAMENTOS -->
    ${blocos.alojamentos && alojamentos && alojamentos.length > 0 ? `
    <div style="padding: 0 14px 16px 14px;">
      <h3 style="font-size: 13px; font-weight: bold; color: #23211E; margin: 0 0 10px 0;">
        🏢 Alojamentos e Bases (${alojamentos.length})
      </h3>
      <table style="width: 100%; border-collapse: separate; border-spacing: 6px;">
        <tr>
          ${alojamentos.map((a, i) => `
            ${i > 0 && i % 4 === 0 ? '</tr><tr>' : ''}
            <td style="width: 25%; vertical-align: top; background-color: #FBFAF7; border: 1px solid #E6E3DD; border-radius: 6px; padding: 8px 10px;">
              <strong style="font-size: 11px; color: #23211E; font-family: monospace; display: block;">${a.equipe}</strong>
              <span style="font-size: 10.5px; color: #5C574F;">${a.alojamento || '<em style="color: #A39E96;">Base Central</em>'}</span>
            </td>
          `).join('')}
        </tr>
      </table>
    </div>
    ` : ''}


    <!-- 7. RESUMO OPERACIONAL DA PROGRAMAÇÃO (SÍNTESE) -->

    ${blocos.resumo ? `
    <!-- RESUMO EXECUTIVO DO PERÍODO -->
    <div style="padding: 0 14px 16px 14px;">
      <div style="background-color: #FFFFFF; border: 1px solid #E6E3DD; border-radius: 10px; padding: 16px;">
        <strong style="font-size: 12.5px; color: #23211E; display: block; margin-bottom: 8px;">
          ✦ Síntese Operacional da Programação
        </strong>
        <p style="font-size: 12px; line-height: 1.5; color: #3C3833; margin: 0 0 12px 0;">
          ${highlightResumoValues(resumoExecutivo?.texto || `A programação da semana prevê um volume planejado de R$ ${metricas.planejado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} com ${metricas.aderencia}% de aderência geral.`)}
        </p>

        ${resumoExecutivo?.destaques && resumoExecutivo.destaques.length > 0 ? `
          <div style="margin-top: 10px;">
            ${resumoExecutivo.destaques.map(d => {
              const cor = d.gravidade === 'critico' ? '#C0392E' : d.gravidade === 'atencao' ? '#C9A227' : '#17794C';
              return `
                <div style="background-color: #FBFAF7; border: 1px solid #E6E3DD; border-left: 3px solid ${cor}; border-radius: 6px; padding: 8px 12px; margin-bottom: 6px;">
                  <strong style="font-size: 11.5px; color: #23211E; display: block;">${d.titulo}</strong>
                  <span style="font-size: 11px; color: #5C574F;">${d.texto}</span>
                </div>
              `;
            }).join('')}
          </div>
        ` : ''}
      </div>
    </div>
    ` : ''}

    ${payload.assinatura && payload.assinatura.conteudo ? `
    <!-- ASSINATURA DO USUÁRIO -->
    <div style="padding: 10px 20px 20px 20px;">
      ${payload.assinatura.tipo === 'html'
        ? payload.assinatura.conteudo
        : `<div style="font-family: 'Trebuchet MS', sans-serif; font-size: 12px; color: #23211E; white-space: pre-line;">${payload.assinatura.conteudo}</div>`}
    </div>
    ` : ''}

    <!-- RODAPÉ CORPORATIVO -->
    <div style="padding: 16px 20px; background-color: #FAF8F5; border-top: 1px solid #E6E3DD; text-align: center; font-size: 11px; color: #6B6660;">
      Sirtec Sistemas Elétricos · PCP - Planejamento e Controle da Produção<br>
      E-mail gerado automaticamente pelo sistema de Gestão Operacional.
    </div>
  </div>
</body>
</html>
  `.trim();
}
