/**
 * Gerador de Payload e HTML para Envio de Planejamento Semanal (Módulo PCP)
 * 
 * Prepara o payload consolidado e gera o template HTML com design corporativo Sirtec,
 * formato amplo (1100px max-width) e compatível com clientes de e-mail (Outlook, Gmail, etc).
 */

import { gerarMapaEstaticoBase64 } from './geradorMapaEstatico';

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
    body { font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif; background-color: #F7F6F3; color: #23211E; margin: 0; padding: 20px 10px; }
    .email-container { max-width: 1100px; margin: 0 auto; background-color: #FFFFFF; border-radius: 12px; border: 1px solid #E6E3DD; overflow: hidden; }
    .header-box { padding: 20px 24px; border-bottom: 2px solid #E07A1F; background: linear-gradient(180deg, #FFFFFF 0%, #FAF8F5 100%); }
    .kpi-table { width: 100%; border-collapse: separate; border-spacing: 12px; }
    .kpi-card { background-color: #FFFFFF; border: 1px solid #E6E3DD; border-radius: 10px; padding: 14px 16px; }
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
            <span style="font-size: 10.5px; font-weight: bold; color: #E07A1F; text-transform: uppercase; letter-spacing: 0.1em; display: block;">
              SIRTEC PCP · PROGRAMAÇÃO OPERACIONAL
            </span>
            <h1 style="margin: 4px 0 0 0; font-size: 20px; font-weight: bold; color: #23211E;">
              ${unidadeNome}
            </h1>
            <p style="margin: 3px 0 0 0; font-size: 11.5px; color: #6B6660;">
              Programação da Semana · ${semana.label || `${semana.inicio} a ${semana.fim}`}
            </p>
          </td>
          <td style="text-align: right;">
            <span style="font-size: 10.5px; color: #A39E96; display: block;">GERADO EM</span>
            <strong style="font-size: 12px; color: #23211E;">${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</strong>
          </td>
        </tr>
      </table>
    </div>

    <!-- CARDS DE INDICADORES (KPIS) -->
    <div style="padding: 16px 20px;">
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

    ${blocos.resumo ? `
    <!-- RESUMO EXECUTIVO DO PERÍODO -->
    <div style="padding: 0 20px 20px 20px;">
      <div style="background-color: #FFFFFF; border: 1px solid #E6E3DD; border-radius: 10px; padding: 16px;">
        <strong style="font-size: 12.5px; color: #23211E; display: block; margin-bottom: 8px;">
          ✦ Síntese Operacional da Programação
        </strong>
        <p style="font-size: 12px; line-height: 1.5; color: #3C3833; margin: 0 0 12px 0;">
          ${resumoExecutivo?.texto || `A programação da semana prevê um volume planejado de R$ ${metricas.planejado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} com ${metricas.aderencia}% de aderência geral.`}
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

    <!-- RESUMO DAS EQUIPES -->
    <div style="padding: 0 20px 20px 20px;">
      <div style="background-color: #FFFFFF; border: 1px solid #E6E3DD; border-radius: 10px; padding: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <div>
            <strong style="font-size: 13px; color: #23211E; display: block;">
              👥 Resumo Operacional das Equipes (${equipes.length} equipes)
            </strong>
            <span style="font-size: 11px; color: #6B6660;">
              ${equipes.filter(e => e.temProgramacao).length} equipes programadas · ${equipes.filter(e => !e.temProgramacao).length} equipes sem programação no período
            </span>
          </div>
          <div style="text-align: right;">
            <span style="font-size: 11px; font-weight: bold; color: #17794C; background-color: #E6F2EA; padding: 3px 8px; border-radius: 4px;">
              Aderência Programadas: ${metricas.aderenciaEquipesProgramadas || metricas.aderencia}%
            </span>
          </div>
        </div>

        <table class="data-table">
          <thead>
            <tr>
              <th style="text-align: left; width: 90px;">Equipe</th>
              <th style="text-align: left; width: 140px;">Supervisor</th>
              <th style="text-align: right; width: 110px;">Planejado</th>
              <th style="text-align: right; width: 110px;">Meta Semanal</th>
              <th style="text-align: center; width: 70px;">% Meta</th>
              <th style="text-align: center; width: 90px;">Deslocamento</th>
              <th style="text-align: center; width: 120px;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${equipes.map(eq => {
              const pctMeta = Math.round(eq.pctMeta || 0);
              const totalPlan = eq.totalPlanejado ?? eq.planejadoTotal ?? 0;
              const metaSemanal = eq.metaSemanal || 0;
              const temProg = eq.temProgramacao;
              const mediaDesloc = Number(eq.mediaDeslocamentoH || 0);
              const corBadge = !temProg ? '#BFB9B0' : pctMeta >= 100 ? '#17794C' : pctMeta >= 70 ? '#C9A227' : '#C0392E';
              const fundoBadge = !temProg ? '#F0EDE8' : pctMeta >= 100 ? '#E6F2EA' : pctMeta >= 70 ? '#FBF2DA' : '#F9E4E1';
              const statusTexto = !temProg ? 'Sem Progr.' : pctMeta >= 100 ? 'Meta Atingida' : pctMeta >= 70 ? 'Atenção' : 'Abaixo Meta';

              return `
              <tr>
                <td style="font-weight: bold; color: #23211E;">${eq.codigo}</td>
                <td style="color: #5C574F;">${eq.supervisor || '-'}</td>
                <td style="text-align: right; font-weight: bold; color: ${temProg ? '#23211E' : '#A39E96'};">
                  R$ ${totalPlan.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </td>
                <td style="text-align: right; color: #6B6660;">
                  R$ ${metaSemanal.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </td>
                <td style="text-align: center; font-weight: bold; color: ${corBadge};">
                  ${temProg ? `${pctMeta}%` : '-'}
                </td>
                <td style="text-align: center; color: #5C574F;">
                  ${temProg ? `${mediaDesloc.toFixed(1)}h` : '-'}
                </td>
                <td style="text-align: center;">
                  <span style="padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; background-color: ${fundoBadge}; color: ${corBadge};">
                    ${statusTexto}
                  </span>
                </td>
              </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>

    ${blocos.calendario ? `
    <!-- GRADE DA PROGRAMAÇÃO SEMANAL -->
    <div style="padding: 0 20px 20px 20px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <h3 style="font-size: 13px; font-weight: bold; color: #23211E; margin: 0;">
          Grade de Programação por Equipe (${equipes.length} equipes)
        </h3>
        <span style="font-size: 11px; color: #6B6660;">
          Horários em hh:mm · Deslocamento médio acumulado
        </span>
      </div>
      <table class="data-table" style="table-layout: fixed; width: 100%; border-collapse: collapse;">
        <thead>
          <tr>
            <th style="text-align: left; width: 110px; padding: 6px 6px;">Equipe / Sup.</th>
            ${dias.map(d => `<th style="text-align: center; width: 11.5%; padding: 6px 2px;">${d.diaSemana}<br><span style="font-weight: normal; font-size: 9px;">${d.label || d.data}</span></th>`).join('')}
            <th style="text-align: right; width: 65px; padding: 6px 4px;">Planejado</th>
            <th style="text-align: right; width: 60px; padding: 6px 4px;">Meta</th>
            <th style="text-align: center; width: 48px; padding: 6px 4px;">% Meta</th>
          </tr>
        </thead>
        <tbody>
          ${equipes.map(eq => {
            const pctMeta = Math.round(eq.pctMeta || 0);
            const totalPlan = eq.totalPlanejado ?? eq.planejadoTotal ?? 0;
            const metaSemanal = eq.metaSemanal || 0;
            const corBorda = !eq.temProgramacao ? '#BFB9B0' : pctMeta >= 100 ? '#17794C' : pctMeta >= 70 ? '#C9A227' : '#C0392E';
            const corBadgeFundoRow = !eq.temProgramacao ? '#F0EDE8' : pctMeta >= 100 ? '#E6F2EA' : pctMeta >= 70 ? '#FBF2DA' : '#F9E4E1';
            const corBadgeTextoRow = !eq.temProgramacao ? '#6B6660' : pctMeta >= 100 ? '#17794C' : pctMeta >= 70 ? '#A06A16' : '#C0392E';

            const mediaJornadaH = eq.mediaJornadaMin ? `${Math.floor(eq.mediaJornadaMin / 60).toString().padStart(2, '0')}:${Math.round(eq.mediaJornadaMin % 60).toString().padStart(2, '0')}` : '';
            const mediaDeslocH = Number(eq.mediaDeslocamentoH || 0).toFixed(1).replace('.', ',');

            return `
            <tr>
              <td style="font-weight: bold; color: #23211E; border-left: 3px solid ${corBorda}; vertical-align: top; padding: 5px 6px; height: 86px; box-sizing: border-box;">
                <span style="font-size: 11.5px; color: #23211E; display: block; white-space: nowrap;">${eq.codigo}</span>
                <span style="font-size: 9px; font-weight: normal; color: #6B6660; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100px;" title="${eq.supervisor || ''}">${eq.supervisor || ''}</span>
                ${eq.temProgramacao ? `
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

                if (!diaInfo || diaInfo.isFolga || diaInfo.folga) {
                  return `
                    <td style="text-align: center; vertical-align: middle; background-color: #F7F6F3; padding: 4px 2px; height: 86px; box-sizing: border-box;">
                      <span style="color: #8C877D; font-size: 9.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                        ${d.diaSemana?.toLowerCase() === 'dom' ? 'Domingo' : 'Folga'}
                      </span>
                    </td>
                  `;
                }

                if (diaInfo.isFeriado) {
                  return `
                    <td style="text-align: center; vertical-align: middle; background-color: #F7F6F3; padding: 4px 2px; height: 86px; box-sizing: border-box;">
                      <span style="color: #8C877D; font-size: 9.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Feriado</span>
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

                const rawPontos = Array.isArray(diaInfo.pontos) ? diaInfo.pontos : [];
                const cleanPontos = cleanPontosList(rawPontos);

                return `
                  <td style="text-align: left; vertical-align: top; background-color: #FFFFFF; padding: 4px 5px; height: 86px; box-sizing: border-box; overflow: hidden;">
                    <!-- Faixa Superior: % e Município -->
                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 2px;">
                      <tr>
                        <td style="text-align: left; padding: 0; white-space: nowrap;">
                          <span style="background-color: ${corBadgeFundo}; color: ${corBadgeTexto}; font-weight: bold; font-family: monospace; font-size: 8.5px; padding: 1px 3px; border-radius: 2px;">
                            ${pctDia > 0 ? `${pctDia}%` : '-'}
                          </span>
                        </td>
                        <td style="text-align: right; padding: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 55px;">
                          <span style="background-color: #EDF4E7; color: #17794C; font-weight: bold; font-size: 8px; padding: 1px 3px; border-radius: 2px; text-transform: uppercase;" title="${municipio}">
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
                      <span style="color: #A39E96;">•</span>
                      <span style="color: #6B6660;">desl ${deslocH}h</span>
                    </div>

                    <!-- Pontos e Vãos -->
                    ${cleanPontos.length > 0 ? `
                      <div style="font-family: monospace; font-size: 8px; color: #8C877D; border-top: 1px solid #F0EDE8; margin-top: 2px; padding-top: 1px; line-height: 1.1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${cleanPontos.join(', ')}">
                        ${cleanPontos.slice(0, 3).join(', ')}${cleanPontos.length > 3 ? ` +${cleanPontos.length - 3}` : ''}
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
                <span style="background-color: ${corBadgeFundoRow}; color: ${corBadgeTextoRow}; font-weight: bold; font-family: monospace; font-size: 9.5px; padding: 2px 4px; border-radius: 3px; display: inline-block;">
                  ${pctMeta}%
                </span>
              </td>
            </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}

    ${blocos.alojamentos && alojamentos && alojamentos.length > 0 ? `
    <!-- ALOJAMENTOS E BASES -->
    <div style="padding: 0 20px 20px 20px;">
      <h3 style="font-size: 13px; font-weight: bold; color: #23211E; margin: 0 0 10px 0;">
        Alojamentos e Bases das Equipes
      </h3>
      <table class="data-table">
        <thead>
          <tr>
            <th style="text-align: left; width: 140px;">Equipe</th>
            <th style="text-align: left;">Município de Atuação</th>
            <th style="text-align: left;">Alojamento / Base Operacional</th>
          </tr>
        </thead>
        <tbody>
          ${alojamentos.map(a => `
            <tr>
              <td style="font-weight: bold; color: #23211E;">${a.equipe}</td>
              <td style="color: #5C574F;">${a.municipio}</td>
              <td style="color: #23211E; font-weight: 500;">${a.alojamento}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}

    ${blocos.observacoes && observacoes && observacoes.length > 0 ? `
    <!-- OBSERVAÇÕES DO PLANEJADOR -->
    <div style="padding: 0 20px 20px 20px;">
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
    <!-- MAPA E DESLOCAMENTOS OPERACIONAIS (NO FINAL DO RELATÓRIO) -->
    <div style="padding: 0 20px 20px 20px;">
      <div style="background-color: #FFFFFF; border: 1px solid #E6E3DD; border-radius: 10px; padding: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <div>
            <strong style="font-size: 13px; color: #23211E; display: block;">
              📍 Mapa e Deslocamentos Operacionais das Equipes
            </strong>
            <span style="font-size: 11px; color: #6B6660;">
              Raios de atendimento, frentes de trabalho e tempos médios em trânsito
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

        <table class="data-table" style="margin-top: 10px;">
          <thead>
            <tr>
              <th style="text-align: left; width: 80px;">Equipe</th>
              <th style="text-align: left; width: 140px;">Supervisor</th>
              <th style="text-align: left;">Municípios de Atuação</th>
              <th style="text-align: center; width: 120px;">Média Deslocamento</th>
              <th style="text-align: center; width: 130px;">Status Deslocamento</th>
            </tr>
          </thead>
          <tbody>
            ${equipes.filter(e => e.temProgramacao).map(e => {
              const munSet = new Set<string>();
              if (e.dias) {
                if (Array.isArray(e.dias)) {
                  e.dias.forEach((d: any) => { if (d && d.municipio && !d.isFolga && !d.isFeriado && d.municipio !== 'FOLGA') munSet.add(d.municipio); });
                } else {
                  Object.values(e.dias).forEach((d: any) => { if (d && d.municipio && !d.isFolga && !d.isFeriado && d.municipio !== 'FOLGA') munSet.add(d.municipio); });
                }
              }
              const munStr = Array.from(munSet).join(', ') || 'BOM JESUS DA LAPA';
              const mediaDesloc = Number(e.mediaDeslocamentoH || 0);

              return `
              <tr>
                <td style="font-weight: bold; color: #23211E;">${e.codigo}</td>
                <td style="color: #5C574F;">${e.supervisor || '-'}</td>
                <td style="color: #23211E; font-weight: 500;">${munStr}</td>
                <td style="text-align: center; font-weight: bold; color: #23211E;">${mediaDesloc.toFixed(1).replace('.', ',')}h</td>
                <td style="text-align: center;">
                  <span style="padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; background-color: ${mediaDesloc <= 2.0 ? '#E6F2EA' : '#FBEBDC'}; color: ${mediaDesloc <= 2.0 ? '#17794C' : '#B4581A'};">
                    ${mediaDesloc <= 2.0 ? 'Dentro da Meta' : 'Atenção > 2,0h'}
                  </span>
                </td>
              </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
      `;
    })() : ''}

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
