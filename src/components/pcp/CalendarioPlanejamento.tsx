import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Sparkles,
  MapPin,
  Calendar as CalendarIcon,
  RefreshCw,
  Building2,
  Navigation,
  Layers,
  ChevronDown,
  Info,
  Clock,
  Eye,
  FileDown,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UNIDADES_PLANEJAMENTO } from '@/constants/unidades';
import {
  EquipeSemanalItem,
  DiaProgramacaoItem,
  MetricasSemana,
  getCorPctPlanejado,
  getCorJornada,
  getCorDeslocamento,
  formatMinToHours,
  COR_REGUA
} from '@/hooks/usePlanejamentoSemanal';
import { usePlanejamentoEquipesData } from '@/hooks/usePlanejamentoEquipesData';
import { PlanejamentoEquipesMap } from '@/components/views/PlanejamentoEquipesMap';

// Cores cromáticas distintas para trajeto e marcadores de equipes
const CORES_EQUIPES = [
  '#E07A1F', '#1D58B5', '#17794C', '#8E24AA', '#D81B60', 
  '#00897B', '#3949AB', '#F4511E', '#039BE5', '#7CB342', 
  '#C0CA33', '#FB8C00', '#6D4C41', '#546E7A', '#E53935'
];

export function getCorEquipe(equipe: string): string {
  let hash = 0;
  for (let i = 0; i < equipe.length; i++) {
    hash = equipe.charCodeAt(i) + ((hash << 5) - hash);
  }
  return CORES_EQUIPES[Math.abs(hash) % CORES_EQUIPES.length];
}

// Coordenadas aproximadas de municípios frequentes na Bahia / Sirtec
const COORDENADAS_MUNICIPIOS: Record<string, [number, number]> = {
  'BOM JESUS DA LAPA': [-13.25501, -43.42314],
  'BARREIRAS': [-12.14863, -44.99781],
  'GUANAMBI': [-14.22332, -42.78143],
  'IBOTIRAMA': [-12.18531, -43.22062],
  'JEQUIÉ': [-13.85750, -40.08390],
  'JEQUIE': [-13.85750, -40.08390],
  'VITÓRIA DA CONQUISTA': [-14.86610, -40.83940],
  'VITORIA DA CONQUISTA': [-14.86610, -40.83940],
  'ITAPETINGA': [-15.24860, -40.24780],
  'RIACHO DE SANTANA': [-13.6091, -42.9387],
  'MACAÚBAS': [-13.0189, -42.6987],
  'MACAUBAS': [-13.0189, -42.6987],
  'BOQUIRA': [-12.8258, -42.7303],
  'IGAPORÃ': [-13.7547, -42.7119],
  'IGAPORA': [-13.7547, -42.7119],
  'CAETITÉ': [-14.0694, -42.4853],
  'CAETITE': [-14.0694, -42.4853],
  'PALMAS DE MONTE ALTO': [-14.2678, -43.1628],
  'SERRA DO RAMALHO': [-13.3012, -43.5134],
  'PARATINGA': [-12.6881, -43.1844],
  'SÍTIO DO MATO': [-13.0833, -43.4667],
  'SITIO DO MATO': [-13.0833, -43.4667],
  'CARINHANHA': [-14.3047, -43.7650],
  'MALHADA': [-14.3389, -43.7744],
  'MUQUÉM DO SÃO FRANCISCO': [-12.0678, -43.5511],
  'MUQUEM DO SAO FRANCISCO': [-12.0678, -43.5511],
  'OLIVEIRA DOS BREJINHOS': [-12.3169, -42.8964],
  'SANTA MARIA DA VITÓRIA': [-13.3947, -44.1956],
  'SÃO FÉLIX DO CORIBE': [-13.4000, -44.1833],
  'CORRENTINA': [-13.3433, -44.6369],
  'LUÍS EDUARDO MAGALHÃES': [-12.0967, -45.7958],
  'LUIS EDUARDO MAGALHAES': [-12.0967, -45.7958],
};

function getMunicipioCoords(municipio: string, fallbackCoords: [number, number]): [number, number] {
  if (!municipio) return fallbackCoords;
  const mClean = municipio.toUpperCase().trim();
  if (COORDENADAS_MUNICIPIOS[mClean]) {
    return COORDENADAS_MUNICIPIOS[mClean];
  }
  // Se não encontrar exato, busca por inclusão
  const foundKey = Object.keys(COORDENADAS_MUNICIPIOS).find(k => mClean.includes(k) || k.includes(mClean));
  if (foundKey) return COORDENADAS_MUNICIPIOS[foundKey];

  // Gera leve dispersão estável a partir do nome se não cadastrado
  let hash = 0;
  for (let i = 0; i < mClean.length; i++) hash = mClean.charCodeAt(i) + ((hash << 5) - hash);
  const jitterLat = ((Math.abs(hash) % 100) - 50) * 0.005;
  const jitterLng = (((Math.abs(hash) >> 2) % 100) - 50) * 0.005;
  return [fallbackCoords[0] + jitterLat, fallbackCoords[1] + jitterLng];
}

// Subcomponente controlador de eventos e enquadramento do mapa
function MapController({
  municipiosCoords,
  fallbackCoords,
  isUserAdjusted,
  setIsUserAdjusted,
  onMapPositionChange,
  targetView,
  setTargetView,
}: {
  municipiosCoords: [number, number][];
  fallbackCoords: [number, number];
  isUserAdjusted: boolean;
  setIsUserAdjusted: (val: boolean) => void;
  onMapPositionChange?: (center: [number, number], zoom: number) => void;
  targetView: { center: [number, number]; zoom: number } | null;
  setTargetView: (val: any) => void;
}) {
  const map = useMap();
  const isAutoAdjustingRef = useRef(false);

  // Invalida tamanho para garantir renderização correta
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 200);
    return () => clearTimeout(t);
  }, [map]);

  // Enquadramento automático inicial ou quando solicitado
  useEffect(() => {
    if (targetView) {
      isAutoAdjustingRef.current = true;
      map.setView(targetView.center, targetView.zoom, { animate: true });
      setTimeout(() => {
        isAutoAdjustingRef.current = false;
        setTargetView(null);
      }, 500);
      return;
    }

    if (!isUserAdjusted && municipiosCoords.length > 0) {
      isAutoAdjustingRef.current = true;
      const bounds = L.latLngBounds(municipiosCoords);
      map.fitBounds(bounds, {
        paddingTopLeft: [40, 80],
        paddingBottomRight: [40, 40],
        maxZoom: 12,
      });
      setTimeout(() => {
        isAutoAdjustingRef.current = false;
      }, 500);
    }
  }, [municipiosCoords, isUserAdjusted, targetView, map, setTargetView]);

  useMapEvents({
    dragend: () => {
      if (!isAutoAdjustingRef.current) {
        setIsUserAdjusted(true);
        const center = map.getCenter();
        if (onMapPositionChange) {
          onMapPositionChange([center.lat, center.lng], map.getZoom());
        }
      }
    },
    zoomend: () => {
      if (!isAutoAdjustingRef.current) {
        setIsUserAdjusted(true);
        const center = map.getCenter();
        if (onMapPositionChange) {
          onMapPositionChange([center.lat, center.lng], map.getZoom());
        }
      }
    },
  });

  return null;
}

export interface CalendarioPlanejamentoProps {
  modo: 'previa' | 'envio';
  unidadeId: string;
  unidadeNome: string;
  inicioSemana: Date;
  fimSemana: Date;
  diasDaSemana: Date[];
  equipes: EquipeSemanalItem[];
  metricas: MetricasSemana;
  alojamentos: Array<{ equipe: string; municipio: string; alojamento: string }>;
  avisoBdConfig?: boolean;
  ultimaAtualizacao?: string | null;
  escopo?: 'todas' | 'com_programacao';
  setEscopo?: (escopo: 'todas' | 'com_programacao') => void;
  densidade?: 'detalhado' | 'compacto';
  setDensidade?: (densidade: 'detalhado' | 'compacto') => void;
  blocos?: {
    resumo: boolean;
    calendario: boolean;
    disponiveis: boolean;
    alojamentos: boolean;
    observacoes: boolean;
    mapa: boolean;
  };
  onUpdateBloco?: (bloco: string, valor: boolean) => void;
  observacoes?: string[];
  onUpdateObservacoes?: (obs: string[]) => void;
  destaquesIa?: Array<{ id: string; titulo: string; texto: string; gravidade: 'critico' | 'atencao' | 'bom' | 'otimo' }>;
  onUpdateDestaquesIa?: (destaques: any[]) => void;
  resumoIaTexto?: string;
  onUpdateResumoIaTexto?: (txt: string) => void;
  onMapPositionChange?: (center: [number, number], zoom: number) => void;
}

export const CalendarioPlanejamento: React.FC<CalendarioPlanejamentoProps> = ({
  modo,
  unidadeId,
  unidadeNome = 'BOM JESUS DA LAPA',
  inicioSemana = new Date(),
  fimSemana = new Date(),
  diasDaSemana = [],
  equipes = [],
  metricas = {
    totalPlanejado: 0,
    totalMeta: 0,
    aderenciaPeriodo: 0,
    equipesAcimaMeta: 0,
    equipesAbaixoMeta: 0,
    totalTurnos: 0,
    jornadaMediaMin: 0,
    turnosAbaixo8: 0,
    turnosAcima10: 0,
    deslocamentoMedioH: 0,
    turnosAcima2h: 0,
    turnosDentroMetaDesloc: 0,
  },
  alojamentos = [],
  avisoBdConfig = false,
  ultimaAtualizacao,
  escopo = 'todas',
  setEscopo,
  densidade = 'detalhado',
  setDensidade,
  blocos = {
    resumo: true,
    calendario: true,
    disponiveis: true,
    alojamentos: true,
    observacoes: true,
    mapa: true,
  },
  observacoes: initialObservacoes,
  onUpdateObservacoes,
  destaquesIa: initialDestaquesIa,
  onUpdateDestaquesIa,
  resumoIaTexto: initialResumoIaTexto,
  onUpdateResumoIaTexto,
  onMapPositionChange,
}) => {
  // Estado local de escopo e densidade se não vier controlado externamente
  const [localEscopo, setLocalEscopo] = useState<'todas' | 'com_programacao'>(escopo);
  const [localDensidade, setLocalDensidade] = useState<'detalhado' | 'compacto'>(densidade);
  const activeEscopo = setEscopo ? escopo : localEscopo;
  const activeDensidade = setDensidade ? densidade : localDensidade;
  const handleSetEscopo = setEscopo || setLocalEscopo;
  const handleSetDensidade = setDensidade || setLocalDensidade;

  // Estado das observações do planejador (editáveis inline)
  const [observacoes, setObservacoes] = useState<string[]>(
    initialObservacoes && initialObservacoes.length > 0
      ? initialObservacoes
      : [
          'Prioridade para frentes de religamento e atendimento a manutenções emergenciais.',
          'Supervisão atenta à programação de deslocamentos que excedem 2h diárias.',
          'Alinhamento com o almoxarifado para entrega antecipada de cabos e estruturas.'
        ]
  );

  const handleObservacaoChange = (idx: number, text: string) => {
    const next = [...observacoes];
    next[idx] = text;
    setObservacoes(next);
    if (onUpdateObservacoes) onUpdateObservacoes(next);
  };

  const handleObservacaoKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const next = [...observacoes];
      next.splice(idx + 1, 0, '');
      setObservacoes(next);
      if (onUpdateObservacoes) onUpdateObservacoes(next);
      setTimeout(() => {
        const inputs = document.querySelectorAll<HTMLInputElement>('.obs-topic-input');
        if (inputs[idx + 1]) inputs[idx + 1].focus();
      }, 50);
    } else if (e.key === 'Backspace' && observacoes[idx] === '' && observacoes.length > 1) {
      e.preventDefault();
      const next = observacoes.filter((_, i) => i !== idx);
      setObservacoes(next);
      if (onUpdateObservacoes) onUpdateObservacoes(next);
      setTimeout(() => {
        const inputs = document.querySelectorAll<HTMLInputElement>('.obs-topic-input');
        const prevIdx = Math.max(0, idx - 1);
        if (inputs[prevIdx]) inputs[prevIdx].focus();
      }, 50);
    }
  };

  // Estado da Leitura da Semana com IA
  const buildDefaultResumoIa = () => {
    const totalEqGeral = metricas.totalEquipesGeral || equipes.length;
    const totalEqProg = metricas.totalEquipesProgramadas || equipes.filter(e => e.temProgramacao).length;
    const metaProg = metricas.metaEquipesProgramadas || metricas.totalMeta;
    const aderProg = metricas.aderenciaEquipesProgramadas || metricas.aderenciaPeriodo;

    return `A programação da semana prevê um volume planejado de R$ ${metricas.totalPlanejado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} frente à meta global de R$ ${metricas.totalMeta.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${metricas.aderenciaPeriodo}% de aderência geral com ${totalEqGeral} equipes). Considerando apenas as ${totalEqProg} equipes com programação ativa (meta de R$ ${metaProg.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}), a aderência da produção atinge ${aderProg}%. A jornada média estimada por turno é de ${formatMinToHours(metricas.jornadaMediaMin)} e o deslocamento médio semanal é de ${metricas.deslocamentoMedioH.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}h por turno.`;
  };

  const buildDefaultDestaquesIa = () => {
    const totalEqGeral = metricas.totalEquipesGeral || equipes.length;
    const totalEqProg = metricas.totalEquipesProgramadas || equipes.filter(e => e.temProgramacao).length;
    const aderProg = metricas.aderenciaEquipesProgramadas || metricas.aderenciaPeriodo;

    return [
      {
        id: 'd1',
        titulo: 'Aderência Financeira e Metas',
        texto: `Aderência Global: ${metricas.aderenciaPeriodo}% (${totalEqGeral} equipes). Aderência das Equipes Programadas: ${aderProg}% (${totalEqProg} equipes). ${metricas.equipesAcimaMeta} equipes alcançam ≥100% da meta semanal e ${metricas.equipesAbaixoMeta} equipes permanecem com saldo abaixo.`,
        gravidade: metricas.aderenciaPeriodo >= 100 ? 'otimo' : metricas.aderenciaPeriodo >= 70 ? 'atencao' : 'critico',
      },
      {
        id: 'd2',
        titulo: 'Conformidade da Jornada de Trabalho',
        texto: `${metricas.turnosAbaixo8} turnos apresentam previsão inferior a 08:00 e ${metricas.turnosAcima10} turnos ultrapassam o limite de 10:00.`,
        gravidade: metricas.turnosAcima10 > 0 ? 'critico' : metricas.turnosAbaixo8 > 2 ? 'atencao' : 'bom',
      },
      {
        id: 'd3',
        titulo: 'Tempo de Deslocamento em Trânsito',
        texto: `${metricas.turnosDentroMetaDesloc} turnos operam dentro da meta de deslocamento e ${metricas.turnosAcima2h} turnos demandam mais de 2,0h de trajeto.`,
        gravidade: metricas.turnosAcima2h > 0 ? 'atencao' : 'otimo',
      },
    ];
  };

  const [resumoIa, setResumoIa] = useState<string>(
    initialResumoIaTexto || buildDefaultResumoIa()
  );

  const [destaquesIa, setDestaquesIa] = useState(
    initialDestaquesIa && initialDestaquesIa.length > 0
      ? initialDestaquesIa
      : buildDefaultDestaquesIa()
  );

  // Recalcula resumo IA quando as métricas mudam
  const handleRegerarIa = () => {
    const novoResumo = buildDefaultResumoIa();
    const novosDestaques = buildDefaultDestaquesIa();
    setResumoIa(novoResumo);
    setDestaquesIa(novosDestaques as any);
    if (onUpdateResumoIaTexto) onUpdateResumoIaTexto(novoResumo);
    if (onUpdateDestaquesIa) onUpdateDestaquesIa(novosDestaques);
  };

  const handleDestaqueChange = (idx: number, field: 'titulo' | 'texto', val: string) => {
    const next = [...destaquesIa];
    next[idx] = { ...next[idx], [field]: val };
    setDestaquesIa(next);
    if (onUpdateDestaquesIa) onUpdateDestaquesIa(next);
  };

  // Equipes filtradas pelo escopo
  const equipesFiltradas = useMemo(() => {
    if (activeEscopo === 'com_programacao') {
      return equipes.filter(e => e.temProgramacao);
    }
    return equipes;
  }, [equipes, activeEscopo]);

  // Totalizadores diários para a grade
  const totalizadoresDiarios = useMemo(() => {
    return diasDaSemana.map(diaData => {
      const dataIso = format(diaData, 'yyyy-MM-dd');
      const diaIso = dataIso;
      let valorDia = 0;
      let equipesCount = 0;
      let totalJornadaMin = 0;
      let totalDeslocMin = 0;

      equipes.forEach(eq => {
        const prog = eq.dias?.[diaIso];
        if (prog) {
          valorDia += prog.valorPlanejado;
          equipesCount += 1;
          totalJornadaMin += prog.tempoTotalMin;
          totalDeslocMin += prog.tempoDeslocamentoMin;
        }
      });

      return {
        dataIso,
        valorDia,
        equipesCount,
        mediaJornadaMin: equipesCount > 0 ? Math.round(totalJornadaMin / equipesCount) : 0,
        mediaDeslocH: equipesCount > 0 ? Math.round((totalDeslocMin / equipesCount / 60) * 10) / 10 : 0,
      };
    });
  }, [diasDaSemana, equipes]);

  // Dados oficiais de mapa com coordenadas reais dos projetos (Idêntico à seção Equipes)
  const { data: equipesMapData } = usePlanejamentoEquipesData(unidadeId ? [unidadeId] : []);

  return (
    <div className="w-full bg-[#F7F6F3] text-[#23211E] font-sans antialiased space-y-4">
      {/* 5.1 CABEÇALHO */}
      <div className="bg-white rounded-xl border border-[#E6E3DD] p-4 sm:p-5 shadow-2xs border-b-[3px] border-b-[#E07A1F]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-[10px] uppercase tracking-[0.15em] font-mono text-[#A39E96] block leading-none font-bold">
              PROGRAMAÇÃO SEMANAL
            </span>
            <h2 className="text-[19px] font-bold text-[#23211E] mt-1 leading-tight">
              {unidadeNome || 'UNIDADE OPERACIONAL'}
            </h2>
            <p className="text-[11px] text-[#6B6660] mt-0.5">
              Gerado em {format(new Date(), 'dd/MM/yyyy')} às {format(new Date(), 'HH:mm')} · dados da Plan_Principal
            </p>
          </div>

          <div className="text-right shrink-0">
            <span className="text-[11px] uppercase tracking-wider text-[#A39E96] font-semibold block">
              PERÍODO DA SEMANA
            </span>
            <span className="font-mono font-bold text-sm text-[#23211E] block mt-0.5">
              Semana de {format(inicioSemana, 'dd/MM')} a {format(fimSemana, 'dd/MM/yyyy')}
            </span>
            {avisoBdConfig && (
              <span className="inline-flex items-center gap-1 text-[10px] text-[#B4581A] bg-[#FBEBDC] px-2 py-0.5 rounded mt-1 font-medium">
                <Info className="w-3 h-3" /> Universo de equipes lido da Plan_Principal
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 5.2 TRÊS CARDS DE KPIS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {/* Card 1: Planejado x Meta */}
        <div className="bg-white rounded-xl border border-[#E6E3DD] p-4 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#6B6660]">
                Planejado x meta do período
              </span>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#EDF4E7] text-[#17794C] border border-[#CCE3B8]" title="Aderência calculada sobre as equipes com programação">
                Prog: {metricas.aderenciaEquipesProgramadas || metricas.aderenciaPeriodo}%
              </span>
            </div>
            <div className="flex items-baseline gap-2 mt-1.5">
              <span className="text-2xl font-mono font-bold text-[#23211E]">
                {metricas.aderenciaPeriodo}%
              </span>
              <span className="text-xs text-[#6B6660] font-mono">aderência global ({metricas.totalEquipesGeral || equipes.length} eqs)</span>
            </div>
            <p className="text-[11.5px] text-[#6B6660] mt-1 font-mono">
              R$ {metricas.totalPlanejado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} de R$ {metricas.totalMeta.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            {metricas.totalEquipesProgramadas > 0 && metricas.totalEquipesProgramadas < (metricas.totalEquipesGeral || equipes.length) && (
              <p className="text-[10.5px] text-[#8C877D] mt-0.5 font-mono">
                Meta {metricas.totalEquipesProgramadas} eqs prog.: R$ {metricas.metaEquipesProgramadas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-[#E6E3DD] text-[11px] font-medium text-[#6B6660]">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#E6F2EA] text-[#17794C] font-semibold border border-[#A0D4B2]">
              {metricas.equipesAcimaMeta} {metricas.equipesAcimaMeta === 1 ? 'equipe' : 'equipes'} ≥100%
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#FBEBDC] text-[#B4581A] font-semibold border border-[#F5D3B3]">
              {metricas.equipesAbaixoMeta} abaixo
            </span>
          </div>
        </div>

        {/* Card 2: Jornada Média */}
        <div className="bg-white rounded-xl border border-[#E6E3DD] p-4 shadow-2xs flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-bold text-[#6B6660] block">
              Jornada média das equipes
            </span>
            <div className="flex items-baseline gap-2 mt-1.5">
              <span className="text-2xl font-mono font-bold text-[#23211E]">
                {formatMinToHours(metricas.jornadaMediaMin)}
              </span>
              <span className="text-xs text-[#6B6660]">por turno</span>
            </div>
            <p className="text-[11.5px] text-[#6B6660] mt-1">
              Média ponderada por turno programado
            </p>
          </div>

          <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-[#E6E3DD] text-[11px] font-medium text-[#6B6660]">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#FBF2DA] text-[#A06A16] font-semibold border border-[#E8C9A0]">
              {metricas.turnosAbaixo8} &lt; 08:00
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#F9E4E1] text-[#B03028] font-semibold border border-[#F2C0B8]">
              {metricas.turnosAcima10} &gt; 10:00
            </span>
          </div>
        </div>

        {/* Card 3: Deslocamento Médio */}
        <div className="bg-white rounded-xl border border-[#E6E3DD] p-4 shadow-2xs flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-bold text-[#6B6660] block">
              Deslocamento médio na semana
            </span>
            <div className="flex items-baseline gap-2 mt-1.5">
              <span className="text-2xl font-mono font-bold text-[#23211E]">
                {metricas.deslocamentoMedioH.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}h
              </span>
              <span className="text-xs text-[#6B6660]">por turno</span>
            </div>
            <p className="text-[11.5px] text-[#6B6660] mt-1">
              Média acumulada de ida e volta por turno
            </p>
          </div>

          <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-[#E6E3DD] text-[11px] font-medium text-[#6B6660]">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#E6F2EA] text-[#17794C] font-semibold border border-[#A0D4B2]">
              {metricas.turnosDentroMetaDesloc} na meta
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#FBEBDC] text-[#B4581A] font-semibold border border-[#F5D3B3]">
              {metricas.turnosAcima2h} &gt; 2,0h
            </span>
          </div>
        </div>
      </div>

      {/* 5.3 RESUMO EXECUTIVO DO PERÍODO */}
      {blocos.resumo && (
        <div className="bg-white rounded-xl border border-[#E6E3DD] p-4 sm:p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-[#E6E3DD] pb-2.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#E07A1F]/10 text-[#E07A1F] text-xs font-bold border border-[#E07A1F]/20">
                <Sparkles className="w-3.5 h-3.5" /> Síntese Operacional
              </span>
              <h3 className="text-sm font-bold text-[#23211E]">
                Resumo Executivo do Período
              </h3>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleRegerarIa}
              className="h-7 px-2.5 text-xs font-semibold bg-white border-[#DEDAD3] text-[#5C574F] hover:text-[#23211E] gap-1 print:hidden"
            >
              <RefreshCw className="w-3 h-3" /> Atualizar síntese
            </Button>
          </div>

          {/* Parágrafo de Resumo */}
          <p className="text-xs text-[#3C3833] leading-relaxed">
            {resumoIa}
          </p>

          {/* 3 Destaques com trilho colorido por gravidade (Editáveis inline) */}
          <div className="space-y-2 pt-1">
            {destaquesIa.map((d, idx) => {
              const corGravidade =
                d.gravidade === 'critico'
                  ? '#C0392E'
                  : d.gravidade === 'atencao'
                    ? '#C9A227'
                    : d.gravidade === 'otimo'
                      ? '#17794C'
                      : '#4E9E63';

              return (
                <div
                  key={d.id || idx}
                  className="p-2.5 rounded-lg bg-[#FBFAF7] border border-[#E6E3DD] text-xs space-y-1"
                  style={{ borderLeft: `3.5px solid ${corGravidade}` }}
                >
                  <input
                    type="text"
                    value={d.titulo}
                    onChange={e => handleDestaqueChange(idx, 'titulo', e.target.value)}
                    className="w-full font-bold text-[#23211E] bg-transparent focus:outline-none focus:bg-white/80 rounded px-1"
                    placeholder="Título do destaque..."
                  />
                  <input
                    type="text"
                    value={d.texto}
                    onChange={e => handleDestaqueChange(idx, 'texto', e.target.value)}
                    className="w-full text-[#5C574F] bg-transparent focus:outline-none focus:bg-white/80 rounded px-1 text-[11.5px]"
                    placeholder="Descrição do destaque..."
                  />
                </div>
              );
            })}
          </div>

          <p className="text-[10.5px] text-[#A39E96] italic pt-1 print:hidden">
            Texto gerado a partir dos dados do planejamento. Revise antes de enviar.
          </p>
        </div>
      )}

      {/* 5.4 CALENDÁRIO POR EQUIPE */}
      {blocos.calendario && (
        <div className="bg-white rounded-xl border border-[#E6E3DD] shadow-2xs overflow-hidden">
          {/* Faixa de Controles do Calendário: Escopo e Densidade */}
          <div className="p-3 px-4 border-b border-[#E6E3DD] bg-[#FAF8F5] flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
            <div className="flex items-center gap-4 flex-wrap">
              {/* Escopo do Calendário */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#A39E96]">
                  ESCOPO
                </span>
                <div className="inline-flex rounded-lg border border-[#DEDAD3] bg-[#F2F0EC] p-0.5 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => handleSetEscopo('todas')}
                    className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                      activeEscopo === 'todas'
                        ? 'bg-white text-[#23211E] shadow-2xs border border-[#DEDAD3]'
                        : 'text-[#6B6660] hover:text-[#23211E]'
                    }`}
                  >
                    Todas as equipes ({equipes.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetEscopo('com_programacao')}
                    className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                      activeEscopo === 'com_programacao'
                        ? 'bg-white text-[#23211E] shadow-2xs border border-[#DEDAD3]'
                        : 'text-[#6B6660] hover:text-[#23211E]'
                    }`}
                  >
                    Somente com programação ({equipes.filter(e => e.temProgramacao).length})
                  </button>
                </div>
              </div>

              {/* Densidade das Células */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#A39E96]">
                  DENSIDADE
                </span>
                <div className="inline-flex rounded-lg border border-[#DEDAD3] bg-[#F2F0EC] p-0.5 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => handleSetDensidade('detalhado')}
                    className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                      activeDensidade === 'detalhado'
                        ? 'bg-white text-[#23211E] shadow-2xs border border-[#DEDAD3]'
                        : 'text-[#6B6660] hover:text-[#23211E]'
                    }`}
                  >
                    Detalhado
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetDensidade('compacto')}
                    className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                      activeDensidade === 'compacto'
                        ? 'bg-white text-[#23211E] shadow-2xs border border-[#DEDAD3]'
                        : 'text-[#6B6660] hover:text-[#23211E]'
                    }`}
                  >
                    Compacto
                  </button>
                </div>
              </div>
            </div>

            {/* Legenda Resumida */}
            <div className="hidden lg:flex items-center gap-3 text-[10.5px] text-[#6B6660]">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#17794C]" /> ≥100%
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#C9A227]" /> Atenção
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#C0392E]" /> Crítico
              </span>
            </div>
          </div>

          {/* Grade do Calendário */}
          <div className="overflow-x-auto">
            <div style={{ minWidth: `${Math.max(900, 110 + diasDaSemana.length * 115 + 178)}px` }}>
              {/* Cabeçalho da Grade */}
              <div
                className="bg-[#F2F0EC] border-b border-[#E6E3DD] text-[10px] uppercase font-bold text-[#5C574F] tracking-wider py-2 px-3 items-center grid"
                style={{ gridTemplateColumns: `110px repeat(${diasDaSemana.length}, minmax(115px, 1fr)) 68px 62px 48px` }}
              >
                <div>Equipe</div>
                {diasDaSemana.map((diaData, idx) => {
                  const isDom = diaData.getDay() === 0;
                  return (
                    <div key={idx} className={`text-center ${isDom ? 'opacity-60' : ''}`}>
                      <span className="block font-bold text-[#23211E] text-xs">
                        {format(diaData, 'EEE', { locale: ptBR })}
                      </span>
                      <span className="font-mono text-[10px] text-[#6B6660]">
                        {format(diaData, 'dd/MM')}
                      </span>
                    </div>
                  );
                })}
                <div className="text-right pr-2">Planejado</div>
                <div className="text-right pr-2">Meta</div>
                <div className="text-center">%</div>
              </div>

              {/* Linhas das Equipes */}
              <div className="divide-y divide-[#E6E3DD]">
                {equipesFiltradas.length === 0 ? (
                  <div className="p-8 text-center text-xs text-[#6B6660]">
                    Nenhuma equipe encontrada para o filtro selecionado.
                  </div>
                ) : (
                  equipesFiltradas.map(eq => {
                    const corFaixa = getCorPctPlanejado(eq.pctMeta).texto;

                    return (
                      <div
                        key={eq.codigo}
                        className="px-3 py-2.5 items-center hover:bg-[#FAF8F5] transition-colors text-xs grid"
                        style={{
                          gridTemplateColumns: `110px repeat(${diasDaSemana.length}, minmax(115px, 1fr)) 68px 62px 48px`,
                          borderLeft: `3px solid ${eq.temProgramacao ? corFaixa : '#BFB9B0'}`
                        }}
                      >
                        {/* Coluna Equipe */}
                        <div className="flex flex-col justify-center pl-1 leading-tight">
                          <span className="font-bold text-xs text-[#23211E]">{eq.codigo}</span>
                          <span className="text-[10px] text-[#6B6660] truncate" title={eq.supervisor}>
                            {eq.supervisor}
                          </span>
                          {eq.temProgramacao && (
                            <span className="text-[9px] font-mono text-[#8C877D] mt-0.5">
                              {formatMinToHours(eq.mediaJornadaMin)} · {eq.mediaDeslocamentoH.toFixed(1).replace('.', ',')}h
                            </span>
                          )}
                        </div>

                        {/* Células de Dias */}
                        {diasDaSemana.map((diaData) => {
                          const diaIso = format(diaData, 'yyyy-MM-dd');
                          const prog = eq.dias?.[diaIso];

                          if (!prog || prog.isFolga) {
                            return (
                              <div
                                key={diaIso}
                                className="mx-1 h-20 rounded-md border border-[#E6E3DD]/60 bg-[#FAF8F5] flex flex-col items-center justify-center p-1"
                              >
                                <span className="text-[10px] font-bold text-[#A39E96] uppercase tracking-wider">
                                  {diaData.getDay() === 0 ? 'Domingo' : 'Folga'}
                                </span>
                              </div>
                            );
                          }

                          if (prog.isFeriado) {
                            return (
                              <div
                                key={diaIso}
                                className="mx-1 h-20 rounded-md border border-[#E6E3DD]/60 bg-[#FAF8F5] flex flex-col items-center justify-center p-1"
                              >
                                <span className="text-[10px] font-bold text-[#A39E96] uppercase tracking-wider">
                                  Feriado
                                </span>
                              </div>
                            );
                          }

                          const corPct = getCorPctPlanejado(prog.pctMetaDia);
                          const corDotJornada =
                            prog.tempoTotalMin > 600
                              ? '#C0392E'
                              : prog.tempoTotalMin >= 450
                                ? '#17794C'
                                : '#C9A227';

                          return (
                            <div
                              key={diaIso}
                              className="mx-1 h-20 rounded-md border border-[#E6E3DD] bg-white p-1.5 flex flex-col justify-between shadow-2xs hover:border-[#DEDAD3] transition-colors"
                            >
                              {/* Faixa Superior: % Meta Diária e Município */}
                              <div className="flex items-center justify-between gap-1">
                                <span
                                  className="px-1.5 py-0.2 rounded text-[9.5px] font-mono font-bold"
                                  style={{ backgroundColor: corPct.fundo, color: corPct.texto }}
                                >
                                  {prog.pctMetaDia > 0 ? `${prog.pctMetaDia}%` : '-'}
                                </span>
                                <span className="px-1.5 py-0.2 rounded bg-[#EDF4E7] text-[#17794C] text-[9px] font-bold uppercase truncate max-w-[65px]" title={prog.municipio}>
                                  {prog.municipio}
                                </span>
                              </div>

                              {/* Etapa e Obra */}
                              <div className="leading-tight my-0.5">
                                <span className="font-bold text-[10px] text-[#23211E] uppercase line-clamp-1 block" title={prog.etapa}>
                                  {prog.etapa}
                                </span>
                                <span className="font-mono text-[9px] text-[#6B6660] truncate block" title={prog.obra}>
                                  {prog.obra}
                                </span>
                              </div>

                              {/* Saturação (Jornada) e Deslocamento */}
                              <div className="flex items-center justify-between font-mono text-[9.5px] text-[#5C574F] pt-0.5 border-t border-[#F2F0EC]">
                                <div className="flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: corDotJornada }} />
                                  <span className="font-bold text-[#23211E]">{formatMinToHours(prog.tempoTotalMin)}</span>
                                </div>
                                <span className="text-[9px] text-[#6B6660]">
                                  desl {(prog.tempoDeslocamentoMin / 60).toFixed(1).replace('.', ',')}h
                                </span>
                              </div>

                              {/* Pontos / Vãos (se houver e couber) */}
                              {activeDensidade === 'detalhado' && prog.pontos && prog.pontos.length > 0 && (
                                <div className="text-[8.5px] font-mono text-[#8C877D] truncate pt-0.5" title={prog.pontos.join(', ')}>
                                  {prog.pontos.slice(0, 2).join(', ')}{prog.pontos.length > 2 ? ` +${prog.pontos.length - 2}` : ''}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Coluna Planejado */}
                        <div className="text-right pr-2 font-mono font-bold text-xs text-[#17794C]">
                          R$ {eq.totalPlanejado.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </div>

                        {/* Coluna Meta */}
                        <div className="text-right pr-2 font-mono text-[10px] text-[#6B6660]">
                          R$ {eq.metaSemanal.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </div>

                        {/* Coluna % Meta */}
                        <div className="text-center">
                          <span
                            className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold font-mono"
                            style={{
                              backgroundColor: getCorPctPlanejado(eq.pctMeta).fundo,
                              color: getCorPctPlanejado(eq.pctMeta).texto,
                            }}
                          >
                            {eq.pctMeta}%
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Linha de Totais do Período */}
              <div
                className="bg-[#FAF8F5] border-t-2 border-[#DEDAD3] text-xs font-bold py-2.5 px-3 items-center grid text-[#23211E]"
                style={{ gridTemplateColumns: `110px repeat(${diasDaSemana.length}, minmax(115px, 1fr)) 68px 62px 48px` }}
              >
                <div className="pl-1 uppercase tracking-wider text-[11px] text-[#5C574F]">
                  Total Geral
                </div>

                {totalizadoresDiarios.map((tot, idx) => (
                  <div key={idx} className="text-center font-mono">
                    <span className="text-xs text-[#17794C] block">
                      R$ {tot.valorDia.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                    <span className="text-[10px] text-[#6B6660] font-sans font-medium block">
                      {tot.equipesCount} {tot.equipesCount === 1 ? 'eq.' : 'eqs.'} · {formatMinToHours(tot.mediaJornadaMin)}
                    </span>
                  </div>
                ))}

                <div className="text-right pr-2 text-[#23211E] font-mono text-xs">
                  R$ {metricas.totalPlanejado.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>

                <div className="text-right pr-2 text-[#6B6660] font-mono text-[10px]">
                  R$ {metricas.totalMeta.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>

                <div className="text-center">
                  <span
                    className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold font-mono"
                    style={{
                      backgroundColor: getCorPctPlanejado(metricas.aderenciaPeriodo).fundo,
                      color: getCorPctPlanejado(metricas.aderenciaPeriodo).texto,
                    }}
                  >
                    {metricas.aderenciaPeriodo}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5.6 ALOJAMENTOS */}
      {blocos.alojamentos && alojamentos.length > 0 && (
        <div className="bg-white rounded-xl border border-[#E6E3DD] p-4 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-[#E6E3DD] pb-2.5">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#E07A1F]" />
              <h3 className="text-sm font-bold text-[#23211E]">
                Alojamentos e Bases das Equipes ({alojamentos.length} equipes)
              </h3>
            </div>
            <span className="text-[11px] text-[#6B6660]">
              Consolidado de municípios e bases no período
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border border-[#E6E3DD] rounded-lg overflow-hidden">
              <thead className="bg-[#FAF8F5] text-[#6B6660] font-semibold border-b border-[#E6E3DD]">
                <tr>
                  <th className="p-2.5 pl-3 w-28">Equipe</th>
                  <th className="p-2.5 w-40">Supervisor</th>
                  <th className="p-2.5">Municípios de Atuação</th>
                  <th className="p-2.5">Alojamento / Base Operacional</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0EDE8]">
                {alojamentos.map((aloj, idx) => (
                  <tr key={idx} className="hover:bg-[#FAF8F5]/50 transition-colors">
                    <td className="p-2.5 pl-3 font-bold font-mono text-[#23211E]">{aloj.equipe}</td>
                    <td className="p-2.5 text-[#5C574F]">{aloj.supervisor || '-'}</td>
                    <td className="p-2.5 font-medium text-[#23211E]">{aloj.municipio}</td>
                    <td className="p-2.5 text-[#5C574F]">{aloj.alojamento}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5.7 OBSERVAÇÕES DO PLANEJADOR (Editáveis inline) */}
      {blocos.observacoes && (
        <div className="bg-[#FBF5EC] rounded-xl border border-[#E8C9A0] p-4 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-[#E8C9A0]/60 pb-2">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-[#E07A1F]" />
              <h3 className="text-sm font-bold text-[#23211E]">
                Observações do Planejador
              </h3>
            </div>
            <span className="text-[11px] text-[#A06A16] font-medium print:hidden">
              Pressione Enter para novo tópico · Backspace para apagar
            </span>
          </div>

          <div className="space-y-2">
            {observacoes.map((obs, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#E07A1F] mt-2 shrink-0" />
                <input
                  type="text"
                  value={obs}
                  onChange={e => handleObservacaoChange(idx, e.target.value)}
                  onKeyDown={e => handleObservacaoKeyDown(idx, e)}
                  placeholder="Digite uma observação para a semana..."
                  className="obs-topic-input flex-1 bg-transparent text-xs text-[#23211E] font-medium focus:outline-none focus:bg-white/80 px-2 py-1 rounded border border-transparent focus:border-[#E8C9A0] transition-colors"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5.8 MAPA DE DESLOCAMENTOS DAS EQUIPES (IDÊNTICO À SEÇÃO EQUIPES) */}
      {blocos.mapa && (
        <div className="bg-white rounded-xl border border-[#E6E3DD] shadow-2xs overflow-hidden">
          <PlanejamentoEquipesMap
            data={equipesMapData || []}
            dates={diasDaSemana}
            height={760}
            className="w-full min-h-[760px] rounded-none border-0"
            title="Mapa de Trajetos e Deslocamento das Equipes"
            onMapPositionChange={onMapPositionChange}
          />
        </div>
      )}
    </div>
  );
};
