import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
  AlertTriangle,
  Filter,
  Search,
  ZoomIn,
  ZoomOut,
  Wrench,
  Pencil,
  Loader2,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { useVistoriasBatch } from '@/hooks/useVistoriasBatch';

// Cores cromáticas distintas para trajeto e marcadores de equipes
const CORES_EQUIPES = [
  '#E07A1F', '#1D58B5', '#17794C', '#8E24AA', '#D81B60', 
  '#00897B', '#3949AB', '#F4511E', '#039BE5', '#7CB342', 
  '#C0CA33', '#FB8C00', '#6D4C41', '#546E7A', '#E53935'
];

const PALETA_CARDS_EQUIPES = [
  { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' }, // Azul
  { bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0' }, // Verde
  { bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA' }, // Laranja
  { bg: '#FAF5FF', text: '#7E22CE', border: '#E9D5FF' }, // Roxo
  { bg: '#FDF2F8', text: '#BE185D', border: '#FBCFE8' }, // Rosa
  { bg: '#ECFEFF', text: '#0E7490', border: '#A5F3FC' }, // Ciano
  { bg: '#FEFCE8', text: '#A16207', border: '#FEF08A' }, // Âmbar
  { bg: '#F5F3FF', text: '#6D28D9', border: '#DDD6FE' }, // Índigo
  { bg: '#FFF1F2', text: '#BE123C', border: '#FECDD3' }, // Carmesim
  { bg: '#F0FDFA', text: '#0F766E', border: '#99F6E4' }, // Esmeralda
  { bg: '#EEF2FF', text: '#4338CA', border: '#C7D2FE' }, // Azul Escuro
  { bg: '#FFFBEB', text: '#B45309', border: '#FDE68A' }, // Dourado
];

export function getEstiloCardEquipe(codigo: string) {
  if (!codigo) return PALETA_CARDS_EQUIPES[0];
  let hash = 0;
  for (let i = 0; i < codigo.length; i++) {
    hash = codigo.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PALETA_CARDS_EQUIPES[Math.abs(hash) % PALETA_CARDS_EQUIPES.length];
}

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
  alojamentosOcupacao?: import('@/hooks/usePlanejamentoSemanal').AlojamentoResumoSemanal[];
  temAlertaSobrecarga?: boolean;
  avisoBdConfig?: boolean;
  ultimaAtualizacao?: string | null;
  escopo?: 'todas' | 'com_programacao';
  setEscopo?: (escopo: 'todas' | 'com_programacao') => void;
  densidade?: 'detalhado' | 'compacto';
  setDensidade?: (densidade: 'detalhado' | 'compacto') => void;
  blocos?: {
    resumo: boolean;
    calendario: boolean;
    conclusoes?: boolean;
    vistorias?: boolean;
    disponiveis: boolean;
    alojamentos: boolean;
    observacoes: boolean;
    mapa: boolean;
  };
  obrasConclusoes?: import('@/hooks/usePlanejamentoSemanal').ObraConclusaoItem[];
  onUpdateBloco?: (bloco: string, valor: boolean) => void;
  observacoes?: string[];
  onUpdateObservacoes?: (obs: string[]) => void;
  destaquesIa?: Array<{ id: string; titulo: string; texto: string; gravidade: 'critico' | 'atencao' | 'bom' | 'otimo' }>;
  onUpdateDestaquesIa?: (destaques: any[]) => void;
  resumoIaTexto?: string;
  onUpdateResumoIaTexto?: (txt: string) => void;
  onMapPositionChange?: (center: [number, number], zoom: number) => void;
  onMapDataReady?: (mapData: import('@/components/views/PlanejamentoEquipesMap').ComputedMapData[]) => void;
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
  alojamentosOcupacao = [],
  temAlertaSobrecarga = false,
  obrasConclusoes = [],
  avisoBdConfig = false,
  ultimaAtualizacao,
  escopo = 'todas',
  setEscopo,
  densidade = 'detalhado',
  setDensidade,
  blocos = {
    resumo: true,
    calendario: true,
    conclusoes: true,
    disponiveis: true,
    alojamentos: true,
    observacoes: true,
    mapa: true,
  },
  onUpdateBloco,
  observacoes: initialObservacoes,
  onUpdateObservacoes,
  destaquesIa: initialDestaquesIa,
  onUpdateDestaquesIa,
  resumoIaTexto: initialResumoIaTexto,
  onUpdateResumoIaTexto,
  onMapPositionChange,
  onMapDataReady,
}) => {
  // Estado local de escopo e densidade se não vier controlado externamente
  const [localEscopo, setLocalEscopo] = useState<'todas' | 'com_programacao'>(escopo);
  const [localDensidade, setLocalDensidade] = useState<'detalhado' | 'compacto'>(densidade);
  const activeEscopo = setEscopo ? escopo : localEscopo;
  const activeDensidade = setDensidade ? densidade : localDensidade;
  const handleSetEscopo = setEscopo || setLocalEscopo;
  const handleSetDensidade = setDensidade || setLocalDensidade;

  // Filtros da grade
  const [filtroSupervisor, setFiltroSupervisor] = useState<string>('');
  const [filtroEquipe, setFiltroEquipe] = useState<string>('');
  const [tiposDesmarcados, setTiposDesmarcados] = useState<Set<string>>(new Set());
  const [tipoDropdownAberto, setTipoDropdownAberto] = useState(false);
  const tipoDropdownRef = useRef<HTMLDivElement>(null);
  const [filtroDisponibilidade, setFiltroDisponibilidade] = useState<string>('');
  const [filtroMeta, setFiltroMeta] = useState<string>('');
  const [filtroJornada, setFiltroJornada] = useState<string>('');
  const [filtroDeslocamento, setFiltroDeslocamento] = useState<string>('');
  const [zoomGrade, setZoomGrade] = useState(100);

  // Listas únicas para os selects
  const supervisoresUnicos = useMemo(() => {
    const set = new Set(equipes.map(e => e.supervisor || 'Sem Supervisor'));
    return Array.from(set).sort();
  }, [equipes]);

  const tiposUnicos = useMemo(() => {
    const set = new Set<string>();
    equipes.forEach(e => { if (e.tipoEquipe) set.add(e.tipoEquipe); });
    if (set.size === 0) {
      ['CONSTRUÇÃO', 'H3', 'H5', 'LV', 'MANUTENÇÃO'].forEach(t => set.add(t));
    }
    return Array.from(set).sort();
  }, [equipes]);

  // Fechar dropdown de tipos ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (tipoDropdownRef.current && !tipoDropdownRef.current.contains(e.target as Node)) {
        setTipoDropdownAberto(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleTipo = (tipo: string) => {
    setTiposDesmarcados(prev => {
      const next = new Set(prev);
      if (next.has(tipo)) next.delete(tipo);
      else next.add(tipo);
      return next;
    });
  };

  const selecionarTodosTipos = () => setTiposDesmarcados(new Set());
  const limparTodosTipos = () => setTiposDesmarcados(new Set(tiposUnicos));

  // Force re-render counter (para edições in-place de vistorias)
  const [, setForceRender] = useState(0);

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

  // QueryClient para invalidar cache de alojamentos
  const queryClient = useQueryClient();

  // Estado para Edição de Alojamento / Base
  const [alojamentoEditando, setAlojamentoEditando] = useState<{
    id: string;
    nomeOriginal: string;
    nome: string;
    municipio: string;
    capacidade: number;
    latitude?: number;
    longitude?: number;
  } | null>(null);
  const [salvandoAlojamento, setSalvandoAlojamento] = useState(false);
  const [erroEdicaoAlojamento, setErroEdicaoAlojamento] = useState('');

  const abrirEdicaoAlojamento = (aloj: {
    id: string;
    nome: string;
    municipio?: string;
    capacidade: number;
    latitude?: number;
    longitude?: number;
  }) => {
    setErroEdicaoAlojamento('');
    setAlojamentoEditando({
      id: aloj.id,
      nomeOriginal: aloj.nome,
      nome: aloj.nome,
      municipio: aloj.municipio || '',
      capacidade: aloj.capacidade || 10,
      latitude: aloj.latitude,
      longitude: aloj.longitude,
    });
  };

  const handleSalvarEdicaoAlojamento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alojamentoEditando) return;
    setSalvandoAlojamento(true);
    setErroEdicaoAlojamento('');

    try {
      const nomeTrim = alojamentoEditando.nome.trim();
      const munTrim = (alojamentoEditando.municipio || '').trim();
      const capNum = Number(alojamentoEditando.capacidade) > 0 ? Number(alojamentoEditando.capacidade) : 10;

      if (!nomeTrim) {
        setErroEdicaoAlojamento('O nome do alojamento não pode ficar vazio.');
        setSalvandoAlojamento(false);
        return;
      }

      // 1. Carrega todos os alojamentos globais do Supabase
      const { data, error: fetchErr } = await supabase
        .from('planejamento_cache')
        .select('principal')
        .eq('unidade_id', 'GLOBAL_ALOJAMENTOS')
        .maybeSingle();

      if (fetchErr) throw fetchErr;

      let lista: any[] = [];
      if (data && data.principal) {
        lista = typeof data.principal === 'string' ? JSON.parse(data.principal) : data.principal;
      }
      if (!Array.isArray(lista)) lista = [];

      // Obter unidade atual
      const unidadeObj = UNIDADES_PLANEJAMENTO.find(u => u.id === unidadeId || u.nome === unidadeId);
      const targetUnidadeId = unidadeObj?.id || unidadeId || '';
      const targetUnidadeNome = unidadeObj?.nome || unidadeNome || '';

      // 2. Busca pelo ID ou pelo nome original
      const idx = lista.findIndex(a => 
        (alojamentoEditando.id && a.id === alojamentoEditando.id) || 
        (a.nome && a.nome.trim().toUpperCase() === alojamentoEditando.nomeOriginal.trim().toUpperCase())
      );

      if (idx >= 0) {
        lista[idx] = {
          ...lista[idx],
          nome: nomeTrim,
          municipio: munTrim,
          capacidade: capNum,
          latitude: alojamentoEditando.latitude ?? lista[idx].latitude ?? 0,
          longitude: alojamentoEditando.longitude ?? lista[idx].longitude ?? 0,
          unidadeId: lista[idx].unidadeId || targetUnidadeId,
          unidadeNome: lista[idx].unidadeNome || targetUnidadeNome,
        };
      } else {
        lista.push({
          id: alojamentoEditando.id && !alojamentoEditando.id.startsWith('dinamico-') ? alojamentoEditando.id : crypto.randomUUID(),
          nome: nomeTrim,
          municipio: munTrim,
          capacidade: capNum,
          latitude: alojamentoEditando.latitude ?? 0,
          longitude: alojamentoEditando.longitude ?? 0,
          unidadeId: targetUnidadeId,
          unidadeNome: targetUnidadeNome,
        });
      }

      // 3. Salva de volta no Supabase
      const { error: saveErr } = await supabase
        .from('planejamento_cache')
        .upsert({
          unidade_id: 'GLOBAL_ALOJAMENTOS',
          principal: lista as any,
        }, { onConflict: 'unidade_id' });

      if (saveErr) throw saveErr;

      // 4. Invalida os caches para atualizar toda a tela imediatamente
      await queryClient.invalidateQueries({ queryKey: ['alojamentos_global'] });
      await queryClient.invalidateQueries({ queryKey: ['planejamento_semanal'] });
      setAlojamentoEditando(null);
    } catch (err: any) {
      console.error('Erro ao salvar alojamento:', err);
      setErroEdicaoAlojamento(err.message || 'Erro ao salvar alterações no banco.');
    } finally {
      setSalvandoAlojamento(false);
    }
  };

  // 1. Equipes filtradas pelo escopo + filtros avançados
  const equipesFiltradas = useMemo(() => {
    let filtered = [...equipes];

    // Escopo
    if (activeEscopo === 'com_programacao') {
      filtered = filtered.filter(e => e.temProgramacao);
    }

    // Filtro Supervisor (case-insensitive & trimmed)
    if (filtroSupervisor) {
      const supTarget = filtroSupervisor.trim().toUpperCase();
      filtered = filtered.filter(e => (e.supervisor || 'Sem Supervisor').trim().toUpperCase() === supTarget);
    }

    // Filtro Equipe (busca textual)
    if (filtroEquipe.trim()) {
      const search = filtroEquipe.trim().toUpperCase();
      filtered = filtered.filter(e => e.codigo.toUpperCase().includes(search));
    }

    // Filtro Tipo (multi-select)
    if (tiposDesmarcados.size > 0) {
      filtered = filtered.filter(e => !tiposDesmarcados.has(e.tipoEquipe || 'CONSTRUÇÃO'));
    }

    // Filtro Disponibilidade
    if (filtroDisponibilidade === 'disponiveis') {
      filtered = filtered.filter(e => e.temProgramacao && !Object.values(e.dias || {}).every((d: any) => !d || d.isFolga || d.isFeriado || d.isIndisponivel || d?.etapa?.toUpperCase().includes('EQUIPE PARADA')));
    } else if (filtroDisponibilidade === 'paradas') {
      // Equipes que tem EQUIPE PARADA em algum dia
      filtered = filtered.filter(e => {
        if (!e.dias) return false;
        return Object.values(e.dias).some((d: any) => d?.etapa?.toUpperCase().includes('EQUIPE PARADA'));
      });
    } else if (filtroDisponibilidade === 'sem_programacao') {
      filtered = filtered.filter(e => !e.temProgramacao);
    }

    // Filtro Meta
    if (filtroMeta === 'na_meta') {
      filtered = filtered.filter(e => e.pctMeta >= 100);
    } else if (filtroMeta === 'abaixo') {
      filtered = filtered.filter(e => e.pctMeta < 100);
    }

    // Filtro Jornada
    if (filtroJornada === 'abaixo_8') {
      filtered = filtered.filter(e => e.temProgramacao && e.mediaJornadaMin < 480);
    } else if (filtroJornada === 'acima_10') {
      filtered = filtered.filter(e => e.temProgramacao && e.mediaJornadaMin > 600);
    } else if (filtroJornada === 'na_meta') {
      filtered = filtered.filter(e => e.temProgramacao && e.mediaJornadaMin >= 480 && e.mediaJornadaMin <= 600);
    }

    // Filtro Deslocamento
    if (filtroDeslocamento === 'na_meta') {
      filtered = filtered.filter(e => e.temProgramacao && e.mediaDeslocamentoH <= 2.0);
    } else if (filtroDeslocamento === 'acima') {
      filtered = filtered.filter(e => e.temProgramacao && e.mediaDeslocamentoH > 2.0);
    }

    return filtered;
  }, [equipes, activeEscopo, filtroSupervisor, filtroEquipe, tiposDesmarcados, tiposUnicos, filtroDisponibilidade, filtroMeta, filtroJornada, filtroDeslocamento]);

  // 2. Métricas calculadas dinamicamente com base nas equipes filtradas
  const metricasFiltradas = useMemo(() => {
    let totalPlanejado = 0;
    let totalMeta = 0;
    let totalTurnos = 0;
    let totalJornadaMinutos = 0;
    let totalDeslocamentoMinutos = 0;
    let turnosAbaixo8 = 0;
    let turnosAcima10 = 0;
    let turnosAcima2h = 0;
    let turnosDentroMetaDesloc = 0;
    let equipesAcimaMeta = 0;
    let equipesAbaixoMeta = 0;

    equipesFiltradas.forEach(eq => {
      totalPlanejado += eq.totalPlanejado;
      totalMeta += eq.metaSemanal;

      if (eq.pctMeta >= 100) {
        equipesAcimaMeta += 1;
      } else {
        equipesAbaixoMeta += 1;
      }

      if (eq.dias) {
        Object.values(eq.dias).forEach(prog => {
          if (prog && !prog.isIndisponivel) {
            totalTurnos += 1;
            totalJornadaMinutos += prog.tempoTotalMin;
            totalDeslocamentoMinutos += prog.tempoDeslocamentoMin;

            if (prog.tempoTotalMin < 480) turnosAbaixo8 += 1;
            if (prog.tempoTotalMin > 600) turnosAcima10 += 1;
            if (prog.tempoDeslocamentoMin > 120) turnosAcima2h += 1;
            if (prog.tempoDeslocamentoMin <= 120) turnosDentroMetaDesloc += 1;
          }
        });
      }
    });

    const equipesProgramadas = equipesFiltradas.filter(e => e.temProgramacao);
    const metaEquipesProgramadas = equipesProgramadas.reduce((acc, eq) => acc + eq.metaSemanal, 0);
    const aderenciaPeriodo = totalMeta > 0 ? Math.round((totalPlanejado / totalMeta) * 100) : 0;
    const aderenciaEquipesProgramadas = metaEquipesProgramadas > 0 ? Math.round((totalPlanejado / metaEquipesProgramadas) * 100) : 0;
    const jornadaMediaMin = totalTurnos > 0 ? Math.round(totalJornadaMinutos / totalTurnos) : 0;
    const deslocamentoMedioH = totalTurnos > 0 ? Math.round((totalDeslocamentoMinutos / totalTurnos / 60) * 10) / 10 : 0;

    return {
      totalPlanejado,
      totalMeta,
      aderenciaPeriodo,
      metaEquipesProgramadas,
      aderenciaEquipesProgramadas,
      totalEquipesGeral: equipesFiltradas.length,
      totalEquipesProgramadas: equipesProgramadas.length,
      totalEquipesSemProgramacao: equipesFiltradas.length - equipesProgramadas.length,
      equipesAcimaMeta,
      equipesAbaixoMeta,
      totalTurnos,
      jornadaMediaMin,
      turnosAbaixo8,
      turnosAcima10,
      deslocamentoMedioH,
      turnosAcima2h,
      turnosDentroMetaDesloc,
    };
  }, [equipesFiltradas]);

  // 3. Dados de mapa oficiais filtrados pelas equipes visíveis
  const { data: equipesMapData } = usePlanejamentoEquipesData(unidadeId ? [unidadeId] : []);
  const filteredMapData = useMemo(() => {
    if (!equipesMapData || !Array.isArray(equipesMapData)) return [];
    const equipesPermitidas = new Set(equipesFiltradas.map(e => e.codigo.toUpperCase()));
    return equipesMapData.filter(row => equipesPermitidas.has(row.equipe.toUpperCase()));
  }, [equipesMapData, equipesFiltradas]);

  // 4. Alojamentos filtrados pelas equipes visíveis
  const alojamentosFiltrados = useMemo(() => {
    const codigosVisiveis = new Set(equipesFiltradas.map(e => e.codigo.toUpperCase()));
    return alojamentos.filter(a => codigosVisiveis.has(a.equipe.toUpperCase()));
  }, [alojamentos, equipesFiltradas]);

  // 4.1 Ocupação de alojamentos filtrada pelas equipes visíveis
  const alojamentosOcupacaoFiltrados = useMemo(() => {
    if (!alojamentosOcupacao || alojamentosOcupacao.length === 0) return [];
    const codigosVisiveis = new Set(equipesFiltradas.map(e => e.codigo.toUpperCase()));

    return alojamentosOcupacao.map(aloj => {
      const ocupacaoDias = aloj.ocupacaoDias.map(dia => {
        const equipesDiaFiltradas = dia.equipes.filter(e => codigosVisiveis.has(e.codigo.toUpperCase()));
        const totalPessoas = equipesDiaFiltradas.reduce((acc, e) => acc + (e.numPessoas || 3), 0);
        const totalEquipes = equipesDiaFiltradas.length;
        const cap = aloj.capacidade || 1;
        const pctOcupacao = Math.round((totalPessoas / cap) * 100);
        const isSobrecarregado = totalPessoas > cap;

        return {
          ...dia,
          equipes: equipesDiaFiltradas,
          totalPessoas,
          totalEquipes,
          pctOcupacao,
          isSobrecarregado,
        };
      });

      const picoPessoas = Math.max(0, ...ocupacaoDias.map(d => d.totalPessoas));
      const picoEquipes = Math.max(0, ...ocupacaoDias.map(d => d.totalEquipes));
      const picoPct = aloj.capacidade > 0 ? Math.round((picoPessoas / aloj.capacidade) * 100) : 0;
      const temSobrecarga = ocupacaoDias.some(d => d.isSobrecarregado);

      return {
        ...aloj,
        picoPessoas,
        picoEquipes,
        picoPct,
        temSobrecarga,
        ocupacaoDias,
      };
    }).filter(aloj => aloj.picoPessoas > 0 || (aloj.capacidade > 0 && aloj.id && !aloj.id.startsWith('dinamico-')));
  }, [alojamentosOcupacao, equipesFiltradas]);

  const temAlertaSobrecargaEfetivo = useMemo(() => {
    return alojamentosOcupacaoFiltrados.some(a => a.temSobrecarga);
  }, [alojamentosOcupacaoFiltrados]);

  // 5. Totalizadores diários para a grade (baseado em equipesFiltradas)
  const totalizadoresDiarios = useMemo(() => {
    return diasDaSemana.map(diaData => {
      const dataIso = format(diaData, 'yyyy-MM-dd');
      const diaIso = dataIso;
      let valorDia = 0;
      let equipesCount = 0;
      let totalJornadaMin = 0;
      let totalDeslocMin = 0;

      equipesFiltradas.forEach(eq => {
        const prog = eq.dias?.[diaIso];
        if (prog && !prog.isIndisponivel) {
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
  }, [diasDaSemana, equipesFiltradas]);

  // 6. Resumo de Vistorias por Obra — agrupa obras das equipes filtradas
  const obrasResumo = useMemo(() => {
    const obrasMap = new Map<string, { obra: string; etapas: Set<string>; equipes: Set<string> }>();
    equipesFiltradas.forEach(eq => {
      if (!eq.dias) return;
      Object.values(eq.dias).forEach((prog: any) => {
        if (prog && !prog.isFolga && !prog.isFeriado) {
          if (prog.obras && Array.isArray(prog.obras) && prog.obras.length > 0) {
            prog.obras.forEach((sub: any) => {
              if (sub.obra) {
                const key = sub.obra;
                if (!obrasMap.has(key)) {
                  obrasMap.set(key, { obra: key, etapas: new Set(), equipes: new Set() });
                }
                const entry = obrasMap.get(key)!;
                if (sub.etapa) entry.etapas.add(sub.etapa);
                entry.equipes.add(eq.codigo);
              }
            });
          } else if (prog.obra) {
            const key = prog.obra;
            if (!obrasMap.has(key)) {
              obrasMap.set(key, { obra: key, etapas: new Set(), equipes: new Set() });
            }
            const entry = obrasMap.get(key)!;
            if (prog.etapa) entry.etapas.add(prog.etapa);
            entry.equipes.add(eq.codigo);
          }
        }
      });
    });
    return Array.from(obrasMap.values()).map(o => ({
      obra: o.obra,
      etapas: Array.from(o.etapas),
      equipes: Array.from(o.equipes),
    }));
  }, [equipesFiltradas]);

  // Conclusões de Obras filtradas pelas equipes visíveis
  const conclusoesFiltradas = useMemo(() => {
    if (obrasConclusoes && obrasConclusoes.length > 0) {
      const equipesPermitidas = new Set(equipesFiltradas.map(e => e.codigo.toUpperCase()));
      return obrasConclusoes.filter(c => equipesPermitidas.has(c.equipe.toUpperCase()));
    }
    return [];
  }, [obrasConclusoes, equipesFiltradas]);

  // Busca vistoria real via Supabase para cada obra do período
  const obraIds = useMemo(() => obrasResumo.map(o => o.obra), [obrasResumo]);
  const { data: vistoriasMap } = useVistoriasBatch(obraIds);

  // 7. Agrupa as equipes por supervisor para a grade
  const equipesAgrupadasPorSupervisor = useMemo(() => {
    const map = new Map<string, typeof equipes>();
    equipesFiltradas.forEach(eq => {
      const sup = eq.supervisor || 'Sem Supervisor';
      if (!map.has(sup)) map.set(sup, []);
      map.get(sup)!.push(eq);
    });
    return Array.from(map.entries()).sort((a, b) => {
      if (a[0] === 'Sem Supervisor') return 1;
      if (b[0] === 'Sem Supervisor') return -1;
      return a[0].localeCompare(b[0]);
    });
  }, [equipesFiltradas]);

  // Estado da Leitura da Semana com IA
  const buildDefaultResumoIa = () => {
    const totalEqGeral = metricasFiltradas.totalEquipesGeral;
    const totalEqProg = metricasFiltradas.totalEquipesProgramadas;
    const metaProg = metricasFiltradas.metaEquipesProgramadas || metricasFiltradas.totalMeta;
    const aderProg = metricasFiltradas.aderenciaEquipesProgramadas || metricasFiltradas.aderenciaPeriodo;

    return `A programação da semana prevê um volume planejado de R$ ${metricasFiltradas.totalPlanejado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} frente à meta global de R$ ${metricasFiltradas.totalMeta.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${metricasFiltradas.aderenciaPeriodo}% de aderência geral com ${totalEqGeral} equipes). Considerando apenas as ${totalEqProg} equipes com programação ativa (meta de R$ ${metaProg.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}), a aderência da produção atinge ${aderProg}%. A jornada média estimada por turno é de ${formatMinToHours(metricasFiltradas.jornadaMediaMin)} e o deslocamento médio semanal é de ${metricasFiltradas.deslocamentoMedioH.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}h por turno.`;
  };

  const buildDefaultDestaquesIa = () => {
    const totalEqGeral = metricasFiltradas.totalEquipesGeral;
    const totalEqProg = metricasFiltradas.totalEquipesProgramadas;
    const aderProg = metricasFiltradas.aderenciaEquipesProgramadas || metricasFiltradas.aderenciaPeriodo;

    return [
      {
        id: 'd1',
        titulo: 'Aderência Financeira e Metas',
        texto: `Aderência Global: ${metricasFiltradas.aderenciaPeriodo}% (${totalEqGeral} equipes). Aderência das Equipes Programadas: ${aderProg}% (${totalEqProg} equipes). ${metricasFiltradas.equipesAcimaMeta} equipes alcançam ≥100% da meta semanal e ${metricasFiltradas.equipesAbaixoMeta} equipes permanecem com saldo abaixo.`,
        gravidade: metricasFiltradas.aderenciaPeriodo >= 100 ? 'otimo' : metricasFiltradas.aderenciaPeriodo >= 70 ? 'atencao' : 'critico',
      },
      {
        id: 'd2',
        titulo: 'Conformidade da Jornada de Trabalho',
        texto: `${metricasFiltradas.turnosAbaixo8} turnos apresentam previsão inferior a 08:00 e ${metricasFiltradas.turnosAcima10} turnos ultrapassam o limite de 10:00.`,
        gravidade: metricasFiltradas.turnosAcima10 > 0 ? 'critico' : metricasFiltradas.turnosAbaixo8 > 2 ? 'atencao' : 'bom',
      },
      {
        id: 'd3',
        titulo: 'Tempo de Deslocamento em Trânsito',
        texto: `${metricasFiltradas.turnosDentroMetaDesloc} turnos operam dentro da meta de deslocamento e ${metricasFiltradas.turnosAcima2h} turnos demandam mais de 2,0h de trajeto.`,
        gravidade: metricasFiltradas.turnosAcima2h > 0 ? 'atencao' : 'otimo',
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

  // Recalcula resumo e destaques quando as métricas carregam (evita zeros)
  const prevPlanejadoRef = React.useRef(metricasFiltradas.totalPlanejado);
  React.useEffect(() => {
    if (prevPlanejadoRef.current === 0 && metricasFiltradas.totalPlanejado > 0) {
      if (!initialResumoIaTexto) {
        const novoResumo = buildDefaultResumoIa();
        setResumoIa(novoResumo);
      }
      if (!initialDestaquesIa || initialDestaquesIa.length === 0) {
        setDestaquesIa(buildDefaultDestaquesIa() as any);
      }
    }
    prevPlanejadoRef.current = metricasFiltradas.totalPlanejado;
  }, [metricasFiltradas.totalPlanejado, metricasFiltradas.aderenciaPeriodo]);

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

  const handleAddDestaque = () => {
    const next = [...destaquesIa, { id: `d${Date.now()}`, titulo: '', texto: '', gravidade: 'bom' as const }];
    setDestaquesIa(next);
    if (onUpdateDestaquesIa) onUpdateDestaquesIa(next);
  };

  const handleRemoveDestaque = (idx: number) => {
    const next = destaquesIa.filter((_, i) => i !== idx);
    setDestaquesIa(next);
    if (onUpdateDestaquesIa) onUpdateDestaquesIa(next);
  };

  const handleAddObservacao = () => {
    const next = [...observacoes, ''];
    setObservacoes(next);
    if (onUpdateObservacoes) onUpdateObservacoes(next);
    setTimeout(() => {
      const inputs = document.querySelectorAll<HTMLInputElement>('.obs-topic-input');
      if (inputs[inputs.length - 1]) inputs[inputs.length - 1].focus();
    }, 50);
  };

  const handleRemoveObservacao = (idx: number) => {
    const next = observacoes.filter((_, i) => i !== idx);
    setObservacoes(next.length > 0 ? next : ['']);
    if (onUpdateObservacoes) onUpdateObservacoes(next.length > 0 ? next : ['']);
  };

  /** Renderiza o resumo com valores numéricos em negrito e cores da escala */
  const renderResumoHighlighted = (texto: string) => {
    const parts = texto.split(/(R\$\s*[\d.,]+(?:\.[\d]+)?|[\d.,]+%|[\d]+h[\d]*m?|[\d.,]+h\s)/g);
    return parts.map((part, i) => {
      if (/^R\$/.test(part)) {
        return <strong key={i} className="text-[#1D58B5]">{part}</strong>;
      }
      if (/%$/.test(part)) {
        const val = parseFloat(part.replace(',', '.'));
        const color = val >= 100 ? '#17794C' : val >= 70 ? '#C9A227' : '#C0392E';
        return <strong key={i} style={{ color }}>{part}</strong>;
      }
      if (/\d+h/.test(part)) {
        return <strong key={i} className="text-[#5C574F]">{part}</strong>;
      }
      return <span key={i}>{part}</span>;
    });
  };

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

          <div className="flex items-center sm:items-end gap-3 flex-col sm:flex-row justify-between shrink-0">
            {/* Controle de Zoom no Cabeçalho */}
            <div className="inline-flex items-center gap-1 bg-[#FAF8F5] border border-[#DEDAD3] rounded-lg p-1 shadow-2xs print:hidden">
              <span className="text-[10px] font-bold text-[#6B6660] px-1.5 flex items-center gap-1">
                <Search className="w-3 h-3 text-[#A39E96]" /> Zoom
              </span>
              <button
                type="button"
                onClick={() => setZoomGrade(z => Math.max(60, z - 5))}
                className="p-1 rounded hover:bg-white text-[#5C574F] hover:text-[#23211E] transition-colors border border-transparent hover:border-[#DEDAD3]"
                title="Diminuir Zoom (-5%)"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setZoomGrade(100)}
                className="text-[10.5px] font-mono font-bold text-[#23211E] px-2 py-0.5 rounded hover:bg-white transition-colors border border-transparent hover:border-[#DEDAD3]"
                title="Clique para resetar em 100%"
              >
                {zoomGrade}%
              </button>
              <button
                type="button"
                onClick={() => setZoomGrade(z => Math.min(150, z + 5))}
                className="p-1 rounded hover:bg-white text-[#5C574F] hover:text-[#23211E] transition-colors border border-transparent hover:border-[#DEDAD3]"
                title="Aumentar Zoom (+5%)"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
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
              <span
                className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border"
                style={{
                  backgroundColor: getCorPctPlanejado(metricasFiltradas.aderenciaEquipesProgramadas || metricasFiltradas.aderenciaPeriodo).fundo,
                  color: getCorPctPlanejado(metricasFiltradas.aderenciaEquipesProgramadas || metricasFiltradas.aderenciaPeriodo).texto,
                  borderColor: getCorPctPlanejado(metricasFiltradas.aderenciaEquipesProgramadas || metricasFiltradas.aderenciaPeriodo).texto + '40',
                }}
                title="Aderência calculada sobre as equipes com programação"
              >
                Prog: {metricasFiltradas.aderenciaEquipesProgramadas || metricasFiltradas.aderenciaPeriodo}%
              </span>
            </div>
            <div className="flex items-baseline gap-2 mt-1.5">
              <span
                className="text-2xl font-mono font-bold"
                style={{ color: getCorPctPlanejado(metricasFiltradas.aderenciaPeriodo).texto }}
              >
                {metricasFiltradas.aderenciaPeriodo}%
              </span>
              <span className="text-xs text-[#6B6660] font-mono">aderência ({metricasFiltradas.totalEquipesGeral} eqs)</span>
            </div>
            <p className="text-[11.5px] text-[#6B6660] mt-1 font-mono">
              R$ {metricasFiltradas.totalPlanejado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} de R$ {metricasFiltradas.totalMeta.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            {metricasFiltradas.totalEquipesProgramadas > 0 && metricasFiltradas.totalEquipesProgramadas < metricasFiltradas.totalEquipesGeral && (
              <p className="text-[10.5px] text-[#8C877D] mt-0.5 font-mono">
                Meta {metricasFiltradas.totalEquipesProgramadas} eqs prog.: R$ {metricasFiltradas.metaEquipesProgramadas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-[#E6E3DD] text-[11px] font-medium text-[#6B6660]">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#E6F2EA] text-[#17794C] font-semibold border border-[#A0D4B2]">
              {metricasFiltradas.equipesAcimaMeta} {metricasFiltradas.equipesAcimaMeta === 1 ? 'equipe' : 'equipes'} ≥100%
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#FBEBDC] text-[#B4581A] font-semibold border border-[#F5D3B3]">
              {metricasFiltradas.equipesAbaixoMeta} abaixo
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
              <span className="text-2xl font-mono font-bold" style={{ color: getCorJornada(metricasFiltradas.jornadaMediaMin).texto }}>
                {formatMinToHours(metricasFiltradas.jornadaMediaMin)}
              </span>
              <span className="text-xs text-[#6B6660]">por turno</span>
            </div>
            <p className="text-[11.5px] text-[#6B6660] mt-1">
              Média ponderada por turno programado
            </p>
          </div>

          <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-[#E6E3DD] text-[11px] font-medium text-[#6B6660]">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#FBF2DA] text-[#A06A16] font-semibold border border-[#E8C9A0]">
              {metricasFiltradas.turnosAbaixo8} &lt; 08:00
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#F9E4E1] text-[#B03028] font-semibold border border-[#F2C0B8]">
              {metricasFiltradas.turnosAcima10} &gt; 10:00
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
              <span className="text-2xl font-mono font-bold" style={{ color: getCorDeslocamento(metricasFiltradas.deslocamentoMedioH).texto }}>
                {metricasFiltradas.deslocamentoMedioH.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}h
              </span>
              <span className="text-xs text-[#6B6660]">por turno</span>
            </div>
            <p className="text-[11.5px] text-[#6B6660] mt-1">
              Média acumulada de ida e volta por turno
            </p>
          </div>

          <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-[#E6E3DD] text-[11px] font-medium text-[#6B6660]">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#E6F2EA] text-[#17794C] font-semibold border border-[#A0D4B2]">
              {metricasFiltradas.turnosDentroMetaDesloc} na meta
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#FBEBDC] text-[#B4581A] font-semibold border border-[#F5D3B3]">
              {metricasFiltradas.turnosAcima2h} &gt; 2,0h
            </span>
          </div>
        </div>
      </div>


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
            <div className="flex items-center gap-3 print:hidden">
              <span className="text-[11px] text-[#A06A16] font-medium">
                Enter = novo · Backspace = apagar
              </span>
              <button
                type="button"
                onClick={handleAddObservacao}
                className="flex items-center gap-1 text-[11px] font-bold text-[#E07A1F] hover:text-[#C0671A] transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {observacoes.map((obs, idx) => (
              <div key={idx} className="group flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#E07A1F] mt-2 shrink-0" />
                <input
                  type="text"
                  value={obs}
                  onChange={e => handleObservacaoChange(idx, e.target.value)}
                  onKeyDown={e => handleObservacaoKeyDown(idx, e)}
                  placeholder="Digite uma observação para a semana..."
                  className="obs-topic-input flex-1 bg-transparent text-xs text-[#23211E] font-medium focus:outline-none focus:bg-white/80 px-2 py-1 rounded border border-transparent focus:border-[#E8C9A0] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveObservacao(idx)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-[#A39E96] hover:text-[#C0392E] mt-1 print:hidden"
                  title="Remover observação"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5.3 MAPA DE DESLOCAMENTOS DAS EQUIPES (IDÊNTICO À SEÇÃO EQUIPES) */}
      {blocos.mapa && (
        <div className="bg-white rounded-xl border border-[#E6E3DD] shadow-2xs overflow-hidden">
          <PlanejamentoEquipesMap
            data={filteredMapData}
            dates={diasDaSemana}
            height={760}
            className="w-full min-h-[760px] rounded-none border-0"
            title="Mapa de Trajetos e Deslocamento das Equipes"
            onMapPositionChange={onMapPositionChange}
            onMapDataReady={onMapDataReady}
          />
        </div>
      )}

      {/* 5.4 CALENDÁRIO POR EQUIPE */}
      {blocos.calendario && (
        <div className="bg-white rounded-xl border border-[#E6E3DD] shadow-2xs overflow-hidden">
          {/* Barra de Controles e Filtros do Calendário - Linha Única */}
          <div className="px-3 py-2.5 border-b border-[#E6E3DD] bg-[#FAF8F5] flex items-center gap-2 flex-wrap print:hidden">
            {/* Escopo */}
            <div className="inline-flex rounded-md border border-[#DEDAD3] bg-[#F2F0EC] p-0.5 text-[10px] font-bold">
              <button type="button" onClick={() => handleSetEscopo('todas')}
                className={`px-2 py-1 rounded transition-all ${activeEscopo === 'todas' ? 'bg-white text-[#23211E] shadow-2xs border border-[#DEDAD3]' : 'text-[#6B6660]'}`}
              >Todas ({equipes.length})</button>
              <button type="button" onClick={() => handleSetEscopo('com_programacao')}
                className={`px-2 py-1 rounded transition-all ${activeEscopo === 'com_programacao' ? 'bg-white text-[#23211E] shadow-2xs border border-[#DEDAD3]' : 'text-[#6B6660]'}`}
              >Com Prog.</button>
            </div>

            {/* Densidade */}
            <div className="inline-flex rounded-md border border-[#DEDAD3] bg-[#F2F0EC] p-0.5 text-[10px] font-bold">
              <button type="button" onClick={() => handleSetDensidade('detalhado')}
                className={`px-2 py-1 rounded transition-all ${activeDensidade === 'detalhado' ? 'bg-white text-[#23211E] shadow-2xs border border-[#DEDAD3]' : 'text-[#6B6660]'}`}
              >Det.</button>
              <button type="button" onClick={() => handleSetDensidade('compacto')}
                className={`px-2 py-1 rounded transition-all ${activeDensidade === 'compacto' ? 'bg-white text-[#23211E] shadow-2xs border border-[#DEDAD3]' : 'text-[#6B6660]'}`}
              >Comp.</button>
            </div>

            {/* Zoom */}
            <div className="inline-flex items-center rounded-md border border-[#DEDAD3] bg-[#F2F0EC] p-0.5 gap-0.5">
              <button type="button" onClick={() => setZoomGrade(z => Math.max(60, z - 10))} className="p-0.5 rounded hover:bg-white">
                <ZoomOut className="w-3 h-3 text-[#6B6660]" />
              </button>
              <span className="text-[9px] font-bold text-[#23211E] w-7 text-center">{zoomGrade}%</span>
              <button type="button" onClick={() => setZoomGrade(z => Math.min(150, z + 10))} className="p-0.5 rounded hover:bg-white">
                <ZoomIn className="w-3 h-3 text-[#6B6660]" />
              </button>
            </div>

            <span className="w-px h-5 bg-[#DEDAD3]" />

            {/* Filtro Supervisor */}
            <select value={filtroSupervisor} onChange={e => setFiltroSupervisor(e.target.value)}
              className="text-[10px] font-semibold border border-[#DEDAD3] rounded px-1.5 py-1 bg-white text-[#23211E] focus:outline-none focus:ring-1 focus:ring-[#E07A1F]">
              <option value="">Supervisor</option>
              {supervisoresUnicos.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            {/* Buscar Equipe */}
            <div className="relative">
              <Search className="w-2.5 h-2.5 text-[#A39E96] absolute left-1.5 top-1/2 -translate-y-1/2" />
              <input type="text" value={filtroEquipe} onChange={e => setFiltroEquipe(e.target.value)}
                placeholder="Equipe..."
                className="text-[10px] font-semibold border border-[#DEDAD3] rounded pl-5 pr-1.5 py-1 bg-white text-[#23211E] focus:outline-none focus:ring-1 focus:ring-[#E07A1F] w-[80px]"
              />
            </div>

            {/* Tipo (multi-select dropdown) */}
            <div className="relative" ref={tipoDropdownRef}>
              <button type="button" onClick={() => setTipoDropdownAberto(!tipoDropdownAberto)}
                className={`text-[10px] font-semibold border rounded px-1.5 py-1 bg-white text-[#23211E] focus:outline-none inline-flex items-center gap-1 ${
                  tiposDesmarcados.size > 0 ? 'border-[#E07A1F] ring-1 ring-[#E07A1F]/30' : 'border-[#DEDAD3]'
                }`}>
                Tipos ({tiposUnicos.length - tiposDesmarcados.size}/{tiposUnicos.length})
                <ChevronDown className={`w-3 h-3 transition-transform ${tipoDropdownAberto ? 'rotate-180' : ''}`} />
              </button>
              {tipoDropdownAberto && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-[#DEDAD3] rounded-md shadow-lg z-50 min-w-[180px] py-1">
                  <div className="flex items-center justify-between px-2 py-1 border-b border-[#F2F0EC]">
                    <button type="button" onClick={selecionarTodosTipos} className="text-[9px] font-bold text-[#1D58B5] hover:underline">Todos</button>
                    <button type="button" onClick={limparTodosTipos} className="text-[9px] font-bold text-[#C0392E] hover:underline">Nenhum</button>
                  </div>
                  {tiposUnicos.map(tipo => (
                    <label key={tipo} className="flex items-center gap-2 px-2 py-1 hover:bg-[#FAF8F5] cursor-pointer">
                      <input type="checkbox" checked={!tiposDesmarcados.has(tipo)} onChange={() => toggleTipo(tipo)}
                        className="w-3 h-3 rounded border-[#DEDAD3] text-[#E07A1F] focus:ring-[#E07A1F] accent-[#E07A1F]" />
                      <span className="text-[10px] font-semibold text-[#23211E]">{tipo}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Disponibilidade */}
            <select value={filtroDisponibilidade} onChange={e => setFiltroDisponibilidade(e.target.value)}
              className="text-[10px] font-semibold border border-[#DEDAD3] rounded px-1.5 py-1 bg-white text-[#23211E] focus:outline-none focus:ring-1 focus:ring-[#E07A1F]">
              <option value="">Disponibilidade</option>
              <option value="disponiveis">Disponíveis</option>
              <option value="paradas">Equipes Paradas</option>
              <option value="sem_programacao">Sem Programação</option>
            </select>

            {/* Meta */}
            <select value={filtroMeta} onChange={e => setFiltroMeta(e.target.value)}
              className="text-[10px] font-semibold border border-[#DEDAD3] rounded px-1.5 py-1 bg-white text-[#23211E] focus:outline-none focus:ring-1 focus:ring-[#E07A1F]">
              <option value="">Meta</option>
              <option value="na_meta">Na Meta (≥100%)</option>
              <option value="abaixo">Abaixo (&lt;100%)</option>
            </select>

            {/* Jornada */}
            <select value={filtroJornada} onChange={e => setFiltroJornada(e.target.value)}
              className="text-[10px] font-semibold border border-[#DEDAD3] rounded px-1.5 py-1 bg-white text-[#23211E] focus:outline-none focus:ring-1 focus:ring-[#E07A1F]">
              <option value="">Jornada</option>
              <option value="na_meta">Na Meta (8-10h)</option>
              <option value="abaixo_8">Abaixo (&lt;8h)</option>
              <option value="acima_10">Acima (&gt;10h)</option>
            </select>

            {/* Deslocamento */}
            <select value={filtroDeslocamento} onChange={e => setFiltroDeslocamento(e.target.value)}
              className="text-[10px] font-semibold border border-[#DEDAD3] rounded px-1.5 py-1 bg-white text-[#23211E] focus:outline-none focus:ring-1 focus:ring-[#E07A1F]">
              <option value="">Deslocamento</option>
              <option value="na_meta">Na Meta (≤2h)</option>
              <option value="acima">Acima (&gt;2h)</option>
            </select>

            {/* Limpar */}
            {(filtroSupervisor || filtroEquipe || tiposDesmarcados.size > 0 || filtroDisponibilidade || filtroMeta || filtroJornada || filtroDeslocamento) && (
              <button type="button"
                onClick={() => { setFiltroSupervisor(''); setFiltroEquipe(''); setTiposDesmarcados(new Set()); setFiltroDisponibilidade(''); setFiltroMeta(''); setFiltroJornada(''); setFiltroDeslocamento(''); }}
                className="inline-flex items-center gap-0.5 px-1.5 py-1 rounded text-[10px] font-bold text-[#C0392E] hover:bg-[#F9E4E1]">
                <X className="w-3 h-3" /> Limpar
              </button>
            )}

            {/* Contador */}
            <span className="text-[9px] font-bold text-[#A39E96] ml-auto">
              {equipesFiltradas.length}/{equipes.length}
            </span>
          </div>


          {/* Grade do Calendário */}
          <div className="overflow-x-auto">
            <div style={{ minWidth: `${Math.max(880, 105 + diasDaSemana.length * 140 + 400)}px`, transform: `scale(${zoomGrade / 100})`, transformOrigin: 'top left', width: `${10000 / zoomGrade}%` }}>
              {/* Cabeçalho da Grade */}
              <div
                className="bg-[#F2F0EC] border-b border-[#E6E3DD] text-[10px] uppercase font-bold text-[#5C574F] tracking-wider py-2 px-3 items-center grid calendario-grid-row"
                style={{
                  gridTemplateColumns: `105px repeat(${diasDaSemana.length}, minmax(140px, 1fr)) 72px 68px 40px 84px 48px 88px`,
                  ['--dias-count' as any]: diasDaSemana.length,
                }}
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
                <div className="text-right pr-1.5">Planejado</div>
                <div className="text-right pr-1.5">Meta</div>
                <div className="text-center">%</div>
                <div className="text-center">Status Prod.</div>
                <div className="text-center">Desloc.</div>
                <div className="text-center">Status Desloc.</div>
              </div>

              {/* Linhas das Equipes */}
              <div className="divide-y divide-[#E6E3DD]">
                {equipesFiltradas.length === 0 ? (
                  <div className="p-8 text-center text-xs text-[#6B6660]">
                    Nenhuma equipe encontrada para o filtro selecionado.
                  </div>
                ) : (
                  equipesAgrupadasPorSupervisor.map(([supervisor, groupEquipes]) => {
                    // Calcular totais do supervisor
                    const supTotalPlanejado = groupEquipes.reduce((s, e) => s + e.totalPlanejado, 0);
                    const supTotalMeta = groupEquipes.reduce((s, e) => s + e.metaSemanal, 0);
                    const supPctMeta = supTotalMeta > 0 ? Math.round((supTotalPlanejado / supTotalMeta) * 100) : 0;
                    const equipesComProg = groupEquipes.filter(e => e.temProgramacao);
                    const supMediaDesloc = equipesComProg.length > 0
                      ? Math.round(equipesComProg.reduce((s, e) => s + e.mediaDeslocamentoH, 0) / equipesComProg.length * 10) / 10
                      : 0;

                    // Status badges do supervisor
                    const supCorBadge = supPctMeta >= 100 ? 'text-[#17794C] bg-[#E6F2EA] border border-[#A0D4B2]' : supPctMeta >= 70 ? 'text-[#A06A16] bg-[#FBF2DA] border border-[#E8C9A0]' : 'text-[#C0392E] bg-[#F9E4E1] border border-[#F2C0B8]';
                    const supStatusTexto = supPctMeta >= 100 ? 'Meta Atingida' : supPctMeta >= 70 ? 'Atenção' : 'Abaixo Meta';
                    const supCorDesloc = supMediaDesloc <= 2.0 ? 'text-[#17794C] bg-[#E6F2EA] border border-[#A0D4B2]' : 'text-[#B4581A] bg-[#FBEBDC] border border-[#F5D3B3]';
                    const supTextoDesloc = supMediaDesloc <= 2.0 ? 'Dentro da Meta' : 'Atenção > 2,0h';

                    return (
                      <React.Fragment key={supervisor}>
                        {/* Header do Supervisor na Grade com Totais */}
                        <div
                          className="bg-[#FAF8F5] border-y border-[#E6E3DD] text-xs font-bold text-[#5C574F] py-2 px-3 items-center grid calendario-grid-row"
                          style={{
                            gridTemplateColumns: `105px repeat(${diasDaSemana.length}, minmax(140px, 1fr)) 72px 68px 40px 84px 48px 88px`,
                            ['--dias-count' as any]: diasDaSemana.length,
                          }}
                        >
                          <div className="col-span-1 flex items-center gap-1 text-[10.5px] select-none" style={{ gridColumn: `1 / span ${1 + diasDaSemana.length}` }}>
                            <span>👤 Supervisor: {supervisor} ({groupEquipes.length} {groupEquipes.length === 1 ? 'equipe' : 'equipes'})</span>
                          </div>
                          <div className="text-right pr-1.5 font-mono text-[10px] text-[#17794C]">
                            R$ {supTotalPlanejado.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </div>
                          <div className="text-right pr-1.5 font-mono text-[10px] text-[#6B6660]">
                            R$ {supTotalMeta.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </div>
                          <div className="text-center">
                            <span
                              className="inline-block px-1 py-0.5 rounded text-[9px] font-bold font-mono"
                              style={{
                                backgroundColor: getCorPctPlanejado(supPctMeta).fundo,
                                color: getCorPctPlanejado(supPctMeta).texto,
                              }}
                            >
                              {supPctMeta}%
                            </span>
                          </div>
                          <div className="text-center">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[8.5px] font-bold whitespace-nowrap ${supCorBadge}`}>
                              {supStatusTexto}
                            </span>
                          </div>
                          <div className="text-center font-bold text-[#23211E] font-mono text-[10px]">
                            {equipesComProg.length > 0 ? `${supMediaDesloc.toFixed(1).replace('.', ',')}h` : '-'}
                          </div>
                          <div className="text-center">
                            {equipesComProg.length > 0 ? (
                              <span className={`inline-block px-1.5 py-0.5 rounded text-[8.5px] font-bold whitespace-nowrap ${supCorDesloc}`}>
                                {supTextoDesloc}
                              </span>
                            ) : '-'}
                          </div>
                        </div>
                        {groupEquipes.map(eq => {
                          const corFaixa = getCorPctPlanejado(eq.pctMeta).texto;
                          const pctMeta = Math.round(eq.pctMeta || 0);
                          const temProg = eq.temProgramacao;
                          const mediaDesloc = Number(eq.mediaDeslocamentoH || 0);

                          // Status Produção badges
                          const corBadge = !temProg ? 'text-[#6B6660] bg-[#F0EDE8]' : pctMeta >= 100 ? 'text-[#17794C] bg-[#E6F2EA] border border-[#A0D4B2]' : pctMeta >= 70 ? 'text-[#A06A16] bg-[#FBF2DA] border border-[#E8C9A0]' : 'text-[#C0392E] bg-[#F9E4E1] border border-[#F2C0B8]';
                          const statusTexto = !temProg ? 'Sem Progr.' : pctMeta >= 100 ? 'Meta Atingida' : pctMeta >= 70 ? 'Atenção' : 'Abaixo Meta';

                          // Status Deslocamento badges
                          const corDesloc = !temProg ? 'text-[#6B6660] bg-[#F0EDE8]' : mediaDesloc <= 2.0 ? 'text-[#17794C] bg-[#E6F2EA] border border-[#A0D4B2]' : 'text-[#B4581A] bg-[#FBEBDC] border border-[#F5D3B3]';
                          const textoDesloc = !temProg ? '-' : mediaDesloc <= 2.0 ? 'Dentro Meta' : 'Atenção > 2,0h';

                          return (
                            <div
                              key={eq.codigo}
                              className="px-3 py-2.5 items-center hover:bg-[#FAF8F5] transition-colors text-xs grid calendario-grid-row"
                              style={{
                                gridTemplateColumns: `105px repeat(${diasDaSemana.length}, minmax(140px, 1fr)) 72px 68px 40px 84px 48px 88px`,
                                borderLeft: `3px solid ${temProg ? corFaixa : '#BFB9B0'}`,
                                ['--dias-count' as any]: diasDaSemana.length,
                              }}
                            >
                              {/* Coluna Equipe */}
                              <div className="flex flex-col justify-center pl-0.5 leading-tight gap-0.5 min-w-0 pr-1">
                                <div className="flex items-center gap-1 flex-wrap">
                                  <span className="font-bold text-xs text-[#23211E] tracking-tight">{eq.codigo}</span>
                                  {eq.tipoEquipe && (
                                    <span
                                      className={`px-1 py-0.2 rounded text-[7.5px] font-black uppercase tracking-wider border shrink-0 ${
                                        eq.tipoEquipe.includes('H5') || eq.tipoEquipe.includes('L5')
                                          ? 'bg-purple-100 text-purple-800 border-purple-300'
                                          : eq.tipoEquipe.includes('LV')
                                            ? 'bg-amber-100 text-amber-800 border-amber-300'
                                            : 'bg-blue-100 text-blue-800 border-blue-300'
                                      }`}
                                      title={`${eq.tipoEquipe} · ${eq.numPessoas || 3} integrantes`}
                                    >
                                      {eq.tipoEquipe}·{eq.numPessoas || 3}p
                                    </span>
                                  )}
                                </div>
                                <span className="text-[9.5px] text-[#6B6660] truncate" title={eq.supervisor}>
                                  {eq.supervisor}
                                </span>
                                {temProg && (
                                  <span className="text-[8.5px] font-mono text-[#8C877D]">
                                    {formatMinToHours(eq.mediaJornadaMin)} · {mediaDesloc.toFixed(1).replace('.', ',')}h
                                  </span>
                                )}
                              </div>

                              {/* Células de Dias */}
                              {diasDaSemana.map((diaData) => {
                                const diaIso = format(diaData, 'yyyy-MM-dd');
                                const prog = eq.dias?.[diaIso];

                                if (!prog) {
                                  return (
                                    <div
                                      key={diaIso}
                                      className="mx-1 h-[150px] rounded-md border border-[#E6E3DD]/60 bg-[#FAF8F5] flex flex-col items-center justify-center p-1"
                                    >
                                      {diaData.getDay() === 0 && (
                                        <span className="text-[10px] font-bold text-[#A39E96] uppercase tracking-wider">
                                          Domingo
                                        </span>
                                      )}
                                    </div>
                                  );
                                }

                                if (prog.isFolga) {
                                  return (
                                    <div
                                      key={diaIso}
                                      className="mx-1 h-[150px] rounded-md border border-[#E6E3DD]/60 bg-[#FAF8F5] flex flex-col items-center justify-center p-1"
                                    >
                                      <span className="text-[10px] font-bold text-[#A39E96] uppercase tracking-wider">
                                        Folga
                                      </span>
                                    </div>
                                  );
                                }

                                if (prog.isFeriado) {
                                  return (
                                    <div
                                      key={diaIso}
                                      className="mx-1 h-[150px] rounded-md border border-[#E6E3DD]/60 bg-[#FAF8F5] flex flex-col items-center justify-center p-1"
                                    >
                                      <span className="text-[10px] font-bold text-[#A39E96] uppercase tracking-wider">
                                        Feriado
                                      </span>
                                    </div>
                                  );
                                }

                                if (prog.isIndisponivel) {
                                  return (
                                    <div
                                      key={diaIso}
                                      className="mx-1 h-[150px] rounded-md border border-[#E6E3DD]/60 bg-[#F2F0EC] flex flex-col items-center justify-center p-1"
                                    >
                                      <span className="text-[10px] font-bold text-[#A39E96] uppercase tracking-wider">
                                        Indisponível
                                      </span>
                                    </div>
                                  );
                                }

                                const pct = prog.pctMetaDia;
                                const isAbaixoMeta = pct < 100;
                                const isSuperMeta = pct >= 200;
                                const corPct = getCorPctPlanejado(pct);

                                return (
                                  <div
                                    key={diaIso}
                                    className={`mx-1 h-[150px] rounded-md border p-1.5 flex flex-col justify-between transition-shadow hover:shadow-xs relative ${
                                      isSuperMeta
                                        ? 'border-[#7CB342] bg-[#F9FCF5]'
                                        : isAbaixoMeta
                                          ? 'border-[#E6E3DD] bg-white'
                                          : 'border-[#A0D4B2] bg-[#F5FAF7]'
                                    }`}
                                  >
                                    {/* Topo do Card */}
                                    <div className="flex items-center justify-between text-[9px] gap-1">
                                      <span
                                        className="font-mono font-bold px-1 py-0.2 rounded border"
                                        style={{
                                          backgroundColor: corPct.fundo,
                                          color: corPct.texto,
                                          borderColor: corPct.texto + '40',
                                        }}
                                      >
                                        {pct > 0 ? `${pct}%` : '-'}
                                      </span>

                                      {prog.alojamento && (
                                        <span
                                          className="text-[8px] font-medium text-[#6B6660] bg-[#FAF8F5] border border-[#E6E3DD] px-1 py-0.2 rounded truncate max-w-[75px]"
                                          title={`Alojamento: ${prog.alojamento}`}
                                        >
                                          {prog.alojamento}
                                        </span>
                                      )}
                                    </div>

                                    {/* Meio: Obras / Etapas */}
                                    <div className="my-auto space-y-1 overflow-hidden">
                                      {prog.obras && prog.obras.length > 0 ? (
                                        prog.obras.slice(0, 2).map((sub, sIdx) => {
                                          const isObraParada = sub.etapa?.toUpperCase().includes('EQUIPE PARADA');
                                          return (
                                            <div
                                              key={sIdx}
                                              className={`text-[9.5px] leading-tight ${
                                                isObraParada ? 'bg-amber-50 border border-amber-300 p-0.5 rounded' : ''
                                              }`}
                                            >
                                              <span
                                                className={`font-bold block truncate ${
                                                  isObraParada ? 'text-amber-800' : 'text-[#23211E]'
                                                }`}
                                                title={sub.etapa}
                                              >
                                                {sub.etapa}
                                              </span>
                                              <span className="font-mono text-[8.5px] text-[#6B6660] block truncate">
                                                {sub.obra}
                                              </span>
                                            </div>
                                          );
                                        })
                                      ) : (
                                        <div className="text-[9.5px] leading-tight">
                                          <span
                                            className={`font-bold block truncate ${
                                              prog.etapa?.toUpperCase().includes('EQUIPE PARADA')
                                                ? 'text-amber-800 bg-amber-50 border border-amber-300 p-0.5 rounded'
                                                : 'text-[#23211E]'
                                            }`}
                                            title={prog.etapa}
                                          >
                                            {prog.etapa || '-'}
                                          </span>
                                          {prog.obra && (
                                            <span className="font-mono text-[8.5px] text-[#6B6660] block truncate">
                                              {prog.obra}
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </div>

                                    {/* Rodapé do Card */}
                                    <div className="flex items-center justify-between text-[9px] pt-1 border-t border-[#F2F0EC]">
                                      <span className="flex items-center gap-1 font-mono text-[#5C574F]">
                                        <span className="w-1.5 h-1.5 rounded-full bg-[#17794C]" />
                                        {formatMinToHours(prog.tempoTotalMin)}
                                      </span>

                                      <span
                                        className="flex items-center gap-0.5 font-mono text-[8.5px]"
                                        style={{ color: getCorDeslocamento(prog.tempoDeslocamentoMin / 60).texto }}
                                      >
                                        <span
                                          className="w-1.5 h-1.5 rounded-full"
                                          style={{ backgroundColor: getCorDeslocamento(prog.tempoDeslocamentoMin / 60).texto }}
                                        />
                                        desl {(prog.tempoDeslocamentoMin / 60).toFixed(1).replace('.', ',')}h
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}

                              {/* Coluna Planejado */}
                              <div className="text-right pr-1 font-mono font-bold text-[9.5px] text-[#17794C] leading-tight">
                                R${eq.totalPlanejado.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                              </div>

                              {/* Coluna Meta */}
                              <div className="text-right pr-1 font-mono text-[9.5px] text-[#6B6660] leading-tight">
                                R${eq.metaSemanal.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                              </div>

                              {/* Coluna % Meta */}
                              <div className="text-center">
                                <span
                                  className="inline-block px-1 py-0.5 rounded text-[9px] font-bold font-mono"
                                  style={{
                                    backgroundColor: getCorPctPlanejado(eq.pctMeta).fundo,
                                    color: getCorPctPlanejado(eq.pctMeta).texto,
                                  }}
                                >
                                  {eq.pctMeta}%
                                </span>
                              </div>

                              {/* Coluna Status Produção */}
                              <div className="text-center">
                                <span className={`inline-block px-1.5 py-0.5 rounded text-[8.5px] font-bold whitespace-nowrap ${corBadge}`}>
                                  {statusTexto}
                                </span>
                              </div>

                              {/* Coluna Média Deslocamento */}
                              <div className="text-center font-bold text-[9.5px] text-[#23211E] font-mono">
                                {temProg ? `${mediaDesloc.toFixed(1).replace('.', ',')}h` : '-'}
                              </div>

                              {/* Coluna Status Deslocamento */}
                              <div className="text-center">
                                {temProg ? (
                                  <span className={`inline-block px-1.5 py-0.5 rounded text-[8.5px] font-bold whitespace-nowrap ${corDesloc}`}>
                                    {textoDesloc}
                                  </span>
                                ) : '-'}
                              </div>
                            </div>
                          );
                        })}
                      </React.Fragment>
                    );
                  })
                )}
              </div>

              {/* Linha de Totais do Período */}
              <div
                className="bg-[#FAF8F5] border-t-2 border-[#DEDAD3] text-xs font-bold py-2.5 px-3 items-center grid text-[#23211E]"
                style={{ gridTemplateColumns: `105px repeat(${diasDaSemana.length}, minmax(140px, 1fr)) 72px 68px 40px 84px 48px 88px` }}
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

                <div className="text-right pr-1.5 text-[#23211E] font-mono text-xs">
                  R$ {metricasFiltradas.totalPlanejado.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>

                <div className="text-right pr-1.5 text-[#6B6660] font-mono text-[10px]">
                  R$ {metricasFiltradas.totalMeta.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>

                <div className="text-center">
                  <span
                    className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold font-mono"
                    style={{
                      backgroundColor: getCorPctPlanejado(metricasFiltradas.aderenciaPeriodo).fundo,
                      color: getCorPctPlanejado(metricasFiltradas.aderenciaPeriodo).texto,
                    }}
                  >
                    {metricasFiltradas.aderenciaPeriodo}%
                  </span>
                </div>

                {/* Status Produção */}
                <div className="text-center">
                  {(() => {
                    const pctGeral = metricasFiltradas.aderenciaPeriodo;
                    const corBadgeGeral = pctGeral >= 100 ? 'text-[#17794C] bg-[#E6F2EA] border border-[#A0D4B2]' : pctGeral >= 70 ? 'text-[#A06A16] bg-[#FBF2DA] border border-[#E8C9A0]' : 'text-[#C0392E] bg-[#F9E4E1] border border-[#F2C0B8]';
                    const statusTextoGeral = pctGeral >= 100 ? 'Meta Atingida' : pctGeral >= 70 ? 'Atenção' : 'Abaixo Meta';
                    return (
                      <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold ${corBadgeGeral}`}>
                        {statusTextoGeral}
                      </span>
                    );
                  })()}
                </div>

                {/* Média Deslocamento */}
                <div className="text-center font-bold text-[#23211E] font-mono">
                  {metricasFiltradas.deslocamentoMedioH.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}h
                </div>

                {/* Status Deslocamento */}
                <div className="text-center">
                  {(() => {
                    const deslocGeral = metricasFiltradas.deslocamentoMedioH;
                    const corDeslocGeral = deslocGeral <= 2.0 ? 'text-[#17794C] bg-[#E6F2EA] border border-[#A0D4B2]' : 'text-[#B4581A] bg-[#FBEBDC] border border-[#F5D3B3]';
                    const textoDeslocGeral = deslocGeral <= 2.0 ? 'Dentro Meta' : 'Atenção > 2,0h';
                    return (
                      <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold ${corDeslocGeral}`}>
                        {textoDeslocGeral}
                      </span>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5.4.5 QUADRO DE CONCLUSÕES DE OBRAS */}
      {blocos.conclusoes !== false && conclusoesFiltradas.length > 0 && (
        <div className="bg-white rounded-xl border border-[#E6E3DD] p-4 sm:p-5 shadow-2xs space-y-3.5 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E6E3DD] pb-2.5">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#E07A1F]" />
              <h3 className="text-sm font-bold text-[#23211E]">
                Planejado Conclusão de Obras ({conclusoesFiltradas.length})
              </h3>
            </div>
            <span className="text-[11px] text-[#6B6660]">
              Semana de {format(inicioSemana, 'dd/MM')} até {format(fimSemana, 'dd/MM')} · Obras com etapa Conclusão ou Desligamento/Conclusão
            </span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-[#E6E3DD]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#FAF8F5] border-b border-[#E6E3DD] text-[10px] uppercase font-bold text-[#5C574F] tracking-wider">
                  <th className="py-2.5 px-3 text-center w-[14%]">Data</th>
                  <th className="py-2.5 px-3 text-left w-[24%]">Supervisor Equipe</th>
                  <th className="py-2.5 px-3 text-left w-[18%]">Projeto</th>
                  <th className="py-2.5 px-3 text-center w-[24%]">Tipo</th>
                  <th className="py-2.5 px-3 text-right w-[20%]">Valor Obra</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0EDE8]">
                {conclusoesFiltradas.map((c, idx) => (
                  <tr key={`${c.data}_${c.equipe}_${c.projeto}_${idx}`} className="hover:bg-[#FAF8F5] transition-colors">
                    <td className="py-2.5 px-3 text-center text-xs font-medium text-[#23211E]">
                      {c.data}
                    </td>
                    <td className="py-2.5 px-3 text-left font-semibold text-xs text-[#23211E] uppercase">
                      {c.supervisorEquipe}
                    </td>
                    <td className="py-2.5 px-3 text-left font-mono font-bold text-xs text-[#E07A1F]">
                      {c.projeto}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        c.tipo.includes('DESLIG')
                          ? 'bg-[#FBF2DA] text-[#A06A16] border border-[#E8C9A0]'
                          : 'bg-[#E6F2EA] text-[#17794C] border border-[#A0D4B2]'
                      }`}>
                        {c.tipo}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-xs text-[#23211E] whitespace-nowrap">
                      {c.valorObra > 0 ? `R$ ${c.valorObra.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-[#FAF8F5] border-t-2 border-[#DEDAD3] font-bold text-xs text-[#23211E]">
                  <td colSpan={4} className="py-2.5 px-3 text-right uppercase text-[10px] text-[#5C574F] tracking-wider">
                    Total ({conclusoesFiltradas.length} {conclusoesFiltradas.length === 1 ? 'obra' : 'obras'}):
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-xs text-[#17794C] whitespace-nowrap">
                    R$ {conclusoesFiltradas.reduce((acc, c) => acc + (c.valorObra || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* 5.5 ANÁLISE DE VISTORIA POR OBRA */}
      {blocos.vistorias !== false && obrasResumo.length > 0 && (
        <div className="bg-white rounded-xl border border-[#E6E3DD] p-4 sm:p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-[#E6E3DD] pb-2.5">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-[#E07A1F]" />
              <h3 className="text-sm font-bold text-[#23211E]">
                Análise de Vistoria por Obra ({obrasResumo.length})
              </h3>
            </div>
            <span className="text-[11px] text-[#6B6660]">
              Dados da vistoria analisados por IA
            </span>
          </div>

          <div style={{ columnCount: 2, columnGap: '12px' }}>
            {(() => {
              // Ordenar: Vermelho > Laranja > Verde > Sem vistoria
              const riskOrder = (obra: typeof obrasResumo[0]) => {
                const r = vistoriasMap?.[obra.obra];
                if (!r) return 4; // Sem vistoria - último
                if (r.classificacao === 'Vermelho') return 1;
                if (r.classificacao === 'Laranja') return 2;
                return 3; // Verde
              };
              const sorted = [...obrasResumo].sort((a, b) => riskOrder(a) - riskOrder(b));

              return sorted.map((obra) => {
                const risk = vistoriasMap?.[obra.obra];
                const isVermelho = risk?.classificacao === 'Vermelho';
                const isSemVistoria = !risk;
                const cardBorderClass = isVermelho
                  ? 'border-2 border-[#C0392E]'
                  : isSemVistoria
                    ? 'border-2 border-[#3C3833]'
                    : risk?.classificacao === 'Laranja'
                      ? 'border-2 border-[#E8C9A0]'
                      : 'border border-[#E6E3DD]';
                return (
                  <div key={obra.obra} className={`p-3 rounded-lg bg-[#FBFAF7] space-y-2 mb-3 ${cardBorderClass}`} style={{ breakInside: 'avoid', WebkitColumnBreakInside: 'avoid' as any }}>
                    {/* Header: obra + badge de risco */}
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <span className="font-bold text-xs text-[#23211E] block truncate" title={obra.obra}>{obra.obra}</span>
                        <span className="text-[10px] text-[#6B6660]">
                          {obra.equipes.join(', ')} · {obra.etapas.join(', ')}
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ml-2 ${
                        isVermelho
                          ? 'bg-[#C0392E] text-white border border-[#A93226]'
                          : isSemVistoria
                            ? 'bg-[#3C3833] text-white'
                            : risk?.classificacao === 'Laranja'
                              ? 'bg-[#FBF2DA] text-[#A06A16] border border-[#E8C9A0]'
                              : 'bg-[#E6F2EA] text-[#17794C] border border-[#A0D4B2]'
                      }`}>
                        {risk ? `Risco ${risk.classificacao}` : 'Sem vistoria'}
                      </span>
                    </div>

                    {/* Pontos detalhados da vistoria - editáveis */}
                    <div className="space-y-1.5">
                      {risk?.pontosDetalhados && risk.pontosDetalhados.length > 0 ? (
                        risk.pontosDetalhados.map((pt, pIdx) => {
                          const isCritico = Boolean(pt.isCritico);
                          const inputClassId = `vistoria-input-${obra.obra.replace(/[^a-zA-Z0-9]/g, '_')}`;
                          return (
                            <div
                              key={pIdx}
                              className={`group p-1.5 rounded-lg text-[11px] leading-snug flex items-center gap-1.5 transition-all shadow-2xs ${
                                isCritico
                                  ? 'bg-[#C0392E] text-white border border-[#A93226]'
                                  : 'bg-white border border-[#E6E3DD] text-[#23211E] hover:border-[#DEDAD3]'
                              }`}
                            >
                              {/* Ícone com Toggle de Gravidade (Crítico / Normal) */}
                              <button
                                type="button"
                                onClick={() => {
                                  pt.isCritico = !pt.isCritico;
                                  pt.icone = pt.isCritico ? '🔴' : '📌';
                                  setForceRender(v => v + 1);
                                }}
                                className="text-xs shrink-0 cursor-pointer hover:scale-115 transition-transform print:hidden"
                                title={pt.isCritico ? 'Tópico Crítico (clique para alternar para Normal)' : 'Tópico Normal (clique para alternar para Crítico)'}
                              >
                                {pt.icone || (isCritico ? '🔴' : '📌')}
                              </button>

                              {/* Categoria do Tópico (Ex: ACESSO, PODAS, SEGURANÇA) */}
                              <div className="flex items-center shrink-0">
                                <span className={`text-[9px] font-bold ${isCritico ? 'text-red-200' : 'text-[#8A857D]'}`}>[</span>
                                <input
                                  type="text"
                                  value={pt.categoria || ''}
                                  onChange={e => {
                                    pt.categoria = e.target.value.toUpperCase();
                                    setForceRender(v => v + 1);
                                  }}
                                  placeholder="GERAL"
                                  className={`text-[9px] uppercase tracking-wider font-bold w-16 sm:w-20 bg-transparent border-none px-0.5 text-center focus:outline-none focus:bg-black/5 rounded ${
                                    isCritico ? 'text-red-100 placeholder:text-red-300' : 'text-[#8A857D] placeholder:text-[#A39E96]'
                                  }`}
                                  title="Categoria do tópico (ex: SEGURANÇA, ACESSO, PODAS, GERAL)"
                                />
                                <span className={`text-[9px] font-bold ${isCritico ? 'text-red-200' : 'text-[#8A857D]'}`}>]</span>
                              </div>

                              {/* Campo de Texto Principal do Tópico */}
                              <input
                                type="text"
                                value={pt.texto || ''}
                                onChange={e => {
                                  pt.texto = e.target.value;
                                  setForceRender(v => v + 1);
                                }}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    if (!risk.pontosDetalhados) risk.pontosDetalhados = [];
                                    risk.pontosDetalhados.splice(pIdx + 1, 0, {
                                      categoria: pt.categoria || 'GERAL',
                                      icone: '📌',
                                      texto: '',
                                      isCritico: false,
                                    });
                                    setForceRender(v => v + 1);
                                    setTimeout(() => {
                                      const inputs = document.querySelectorAll<HTMLInputElement>(`.${inputClassId}`);
                                      if (inputs[pIdx + 1]) inputs[pIdx + 1].focus();
                                    }, 50);
                                  } else if (e.key === 'Backspace' && pt.texto === '' && risk.pontosDetalhados.length > 1) {
                                    e.preventDefault();
                                    risk.pontosDetalhados.splice(pIdx, 1);
                                    setForceRender(v => v + 1);
                                    setTimeout(() => {
                                      const inputs = document.querySelectorAll<HTMLInputElement>(`.${inputClassId}`);
                                      const prevIdx = Math.max(0, pIdx - 1);
                                      if (inputs[prevIdx]) inputs[prevIdx].focus();
                                    }, 50);
                                  }
                                }}
                                placeholder="Descreva a observação ou impeditivo da obra..."
                                className={`${inputClassId} flex-1 min-w-0 bg-transparent text-[10.5px] leading-snug px-1.5 py-0.5 rounded border border-transparent focus:outline-none focus:bg-black/5 focus:border-black/10 transition-colors ${
                                  isCritico ? 'text-white placeholder:text-red-200 font-bold' : 'text-[#23211E] placeholder:text-[#A39E96]'
                                }`}
                              />

                              {/* Botão de Excluir Tópico */}
                              <button
                                type="button"
                                onClick={() => {
                                  if (risk?.pontosDetalhados) {
                                    risk.pontosDetalhados.splice(pIdx, 1);
                                    setForceRender(v => v + 1);
                                  }
                                }}
                                className={`opacity-0 group-hover:opacity-100 transition-opacity shrink-0 cursor-pointer print:hidden ${
                                  isCritico ? 'text-red-200 hover:text-white' : 'text-[#A39E96] hover:text-[#C0392E]'
                                }`}
                                title="Remover tópico"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-[10.5px] text-[#A39E96] italic py-1">
                          {risk ? 'Nenhum impeditivo registrado. Clique em + Tópico abaixo para incluir.' : 'Vistoria não realizada para esta obra. Clique em + Tópico abaixo para incluir observações.'}
                        </div>
                      )}
                    </div>

                    {/* Botão + para adicionar tópico */}
                    <button
                      type="button"
                      onClick={() => {
                        const inputClassId = `vistoria-input-${obra.obra.replace(/[^a-zA-Z0-9]/g, '_')}`;
                        if (!risk) {
                          if (vistoriasMap) {
                            (vistoriasMap as any)[obra.obra] = {
                              classificacao: 'Verde',
                              pontosDetalhados: [],
                            };
                          }
                        }
                        const currentRisk = vistoriasMap?.[obra.obra] || risk;
                        if (currentRisk) {
                          if (!currentRisk.pontosDetalhados) currentRisk.pontosDetalhados = [];
                          currentRisk.pontosDetalhados.push({
                            categoria: 'GERAL',
                            icone: '📌',
                            texto: '',
                            isCritico: false,
                          });
                          setForceRender(v => v + 1);
                          setTimeout(() => {
                            const inputs = document.querySelectorAll<HTMLInputElement>(`.${inputClassId}`);
                            if (inputs.length > 0) {
                              const lastInput = inputs[inputs.length - 1];
                              lastInput.focus();
                            }
                          }, 50);
                        }
                      }}
                      className="flex items-center gap-1 text-[11px] font-bold text-[#E07A1F] hover:text-[#C0671A] transition-colors print:hidden px-1.5 py-1 rounded hover:bg-[#E07A1F]/10 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Tópico
                    </button>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {/* 5.6 RESUMO DE OCUPAÇÃO DE ALOJAMENTOS */}
      {blocos.alojamentos && alojamentosOcupacaoFiltrados.length > 0 && (() => {
        // Estatísticas para o Header e Footer
        const totalVagasFaltando = alojamentosOcupacaoFiltrados.reduce((acc, a) => {
          return acc + (a.picoPessoas > a.capacidade ? a.picoPessoas - a.capacidade : 0);
        }, 0);

        const totalAlojComFalta = alojamentosOcupacaoFiltrados.filter(a => a.picoPessoas > a.capacidade).length;

        const picoGeralSemana = Math.max(0, ...alojamentosOcupacaoFiltrados.map(a => a.picoPessoas));

        const totaisPorDia = diasDaSemana.map(diaData => {
          const dataIso = format(diaData, 'yyyy-MM-dd');
          const equipesNoDia = new Set<string>();
          let locaisNoDia = 0;

          alojamentosOcupacaoFiltrados.forEach(aloj => {
            const diaEntry = aloj.ocupacaoDias.find(d => d.dataIso === dataIso);
            if (diaEntry && diaEntry.totalPessoas > 0) {
              locaisNoDia += 1;
              diaEntry.equipes.forEach(e => equipesNoDia.add(e.codigo));
            }
          });

          return {
            dataIso,
            totalEquipes: equipesNoDia.size,
            totalLocais: locaisNoDia,
          };
        });

        const getStatusLinha = (aloj: (typeof alojamentosOcupacaoFiltrados)[0]) => {
          if (aloj.temSobrecarga || aloj.picoPessoas > aloj.capacidade) return { border: '#DC2626', bg: 'bg-rose-50/20' };
          if (aloj.picoPct >= 85) return { border: '#D97706', bg: 'bg-transparent' };
          if (aloj.picoPct >= 40) return { border: '#047857', bg: 'bg-transparent' };
          return { border: '#22C55E', bg: 'bg-transparent' };
        };

        const getStatusDia = (totalPessoas: number, capacidade: number) => {
          if (totalPessoas === 0) {
            return {
              corBarra: '#E7E5E4',
              corTexto: '#A8A29E',
              isVazio: true,
            };
          }
          const cap = capacidade || 1;
          const pct = Math.round((totalPessoas / cap) * 100);
          if (totalPessoas > cap) {
            return {
              corBarra: '#DC2626',
              corTexto: '#DC2626',
              isVazio: false,
              pct,
            };
          }
          if (pct >= 85) {
            return {
              corBarra: '#D97706',
              corTexto: '#D97706',
              isVazio: false,
              pct,
            };
          }
          if (pct >= 40) {
            return {
              corBarra: '#047857',
              corTexto: '#047857',
              isVazio: false,
              pct,
            };
          }
          return {
            corBarra: '#22C55E',
            corTexto: '#15803D',
            isVazio: false,
            pct,
          };
        };

        return (
          <div className="bg-[#FAF9F5] rounded-xl border border-[#E6E3DD] p-4 sm:p-5 shadow-2xs space-y-3.5">
            {/* Cabeçalho do Bloco */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-1 h-5 bg-[#E07A1F] rounded-full inline-block" />
                <h3 className="text-base font-bold text-[#1C1917]">
                  Alojamentos e Bases ({alojamentosOcupacaoFiltrados.length})
                </h3>
              </div>

              {totalVagasFaltando > 0 ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#FEF2F2] text-[#991B1B] border border-[#FCA5A5]/60 text-xs font-bold tracking-tight">
                  Faltam {totalVagasFaltando} {totalVagasFaltando === 1 ? 'vaga' : 'vagas'} em {totalAlojComFalta} {totalAlojComFalta === 1 ? 'alojamento' : 'alojamentos'}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0] text-xs font-semibold">
                  Capacidade Adequada
                </span>
              )}
            </div>

            {/* Tabela Estruturada */}
            <div className="overflow-x-auto rounded-xl border border-[#E6E3DD] bg-white shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#FAF8F5] border-b border-[#E6E3DD] text-[10px] uppercase font-bold text-[#78716C] tracking-wider">
                    <th className="py-2.5 px-3 text-left min-w-[140px]">ALOJAMENTO</th>
                    {diasDaSemana.map((diaData, idx) => (
                      <th key={idx} className="py-2.5 px-2 text-left min-w-[110px]">
                        <span className="font-black text-[#1C1917] text-[10.5px]">{format(diaData, 'EEE', { locale: ptBR }).toUpperCase()}</span>{' '}
                        <span className="font-mono text-[9.5px] text-[#78716C] font-normal">{format(diaData, 'dd/MM')}</span>
                      </th>
                    ))}
                    <th className="py-2.5 px-3 text-right w-[85px] tracking-wider">PICO</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0EDE8]">
                  {alojamentosOcupacaoFiltrados.map((aloj) => {
                    const statusLinha = getStatusLinha(aloj);
                    const cap = aloj.capacidade || 1;

                    return (
                      <tr
                        key={aloj.id}
                        className={`hover:bg-[#FAF8F5]/80 transition-colors ${statusLinha.bg}`}
                        style={{ borderLeft: `4px solid ${statusLinha.border}` }}
                      >
                        {/* Nome do Alojamento */}
                        <td className="py-3 px-3 text-left align-top">
                          <div className="leading-tight space-y-0.5">
                            <div className="flex items-center gap-1.5 group">
                              <span className="font-bold text-xs text-[#1C1917] block">{aloj.nome}</span>
                              <button
                                type="button"
                                onClick={() => abrirEdicaoAlojamento(aloj)}
                                className="p-1 rounded text-[#A8A29E] hover:text-[#E07A1F] hover:bg-[#E07A1F]/10 transition-all opacity-80 group-hover:opacity-100 cursor-pointer print:hidden"
                                title="Editar dados deste alojamento/base"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                            </div>
                            <span className="text-[10.5px] text-[#78716C] font-medium block">
                              {aloj.capacidade} {aloj.capacidade === 1 ? 'vaga' : 'vagas'}
                              {aloj.municipio && aloj.municipio.toUpperCase() !== aloj.nome.toUpperCase() && (
                                <span className="text-[#A39E96]"> · {aloj.municipio}</span>
                              )}
                            </span>
                          </div>
                        </td>

                        {/* Dias da Semana */}
                        {aloj.ocupacaoDias.map((dia) => {
                          const statusDia = getStatusDia(dia.totalPessoas, aloj.capacidade);

                          return (
                            <td key={dia.dataIso} className="py-3 px-2 text-left align-top">
                              {statusDia.isVazio ? (
                                <div className="flex items-center justify-between gap-1 max-w-[90px] pt-0.5">
                                  <div className="w-14 h-1 bg-[#E7E5E4] rounded-full" />
                                  <span className="text-[#A8A29E] text-xs font-mono">-</span>
                                </div>
                              ) : (
                                <div className="space-y-1.5 max-w-[120px]">
                                  {/* Barra de Progresso + Headcount */}
                                  <div className="flex items-center justify-between gap-1.5">
                                    <div className="w-14 sm:w-16 h-1.5 bg-[#F5F2EC] rounded-full overflow-hidden shrink-0">
                                      <div
                                        className="h-full rounded-full transition-all"
                                        style={{
                                          width: `${Math.min(100, Math.max(15, (dia.totalPessoas / cap) * 100))}%`,
                                          backgroundColor: statusDia.corBarra,
                                        }}
                                      />
                                    </div>
                                    <span
                                      className="font-mono font-bold text-[10.5px] shrink-0"
                                      style={{ color: statusDia.corTexto }}
                                    >
                                      {dia.totalPessoas}p
                                    </span>
                                  </div>

                                  {/* Códigos das Equipes em Grid/Inline Monospace */}
                                  <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-left pt-0.5">
                                    {dia.equipes.map((e, idx) => (
                                      <span
                                        key={idx}
                                        className="text-[10px] font-mono font-medium text-[#44403C] hover:text-[#E07A1F] cursor-default whitespace-nowrap"
                                        title={`Equipe ${e.codigo} (${e.tipoEquipe} · ${e.numPessoas}p)\nSupervisor: ${e.supervisor || '-'}\nObra: ${e.obra || '-'}`}
                                      >
                                        {e.codigo}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </td>
                          );
                        })}

                        {/* Pico / Faltam Vagas */}
                        <td className="py-3 px-3 text-right align-top whitespace-nowrap">
                          <div className="flex flex-col items-end gap-1">
                            <span
                              className="font-mono font-bold text-xs"
                              style={{ color: statusLinha.border }}
                            >
                              {aloj.picoPessoas}/{aloj.capacidade}
                            </span>
                            {aloj.picoPessoas > aloj.capacidade ? (
                              <span className="inline-block px-1.5 py-0.5 rounded bg-[#FEE2E2] text-[#991B1B] text-[9.5px] font-bold">
                                faltam {aloj.picoPessoas - aloj.capacidade}
                              </span>
                            ) : (
                              <span
                                className={`inline-block px-1.5 py-0.5 rounded text-[9.5px] font-bold ${
                                  aloj.picoPct >= 85
                                    ? 'bg-[#FEF3C7] text-[#92400E]'
                                    : 'bg-[#ECFDF5] text-[#065F46]'
                                }`}
                              >
                                {aloj.picoPct}%
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {/* Linha de Totais */}
                  <tr className="bg-[#FAF8F5] border-t-2 border-[#E6E3DD] font-bold">
                    <td className="py-2.5 px-3 text-left text-[11px] font-bold text-[#44403C] uppercase tracking-wider">
                      TOTAL
                    </td>
                    {totaisPorDia.map((tot, idx) => (
                      <td key={idx} className="py-2.5 px-2 text-left align-middle whitespace-nowrap">
                        {tot.totalEquipes > 0 ? (
                          <div className="text-[10.5px] text-[#1C1917] font-sans">
                            <strong>{tot.totalEquipes}</strong> <span className="text-[#78716C] font-normal text-[9.5px]">eq</span>{' '}
                            <strong>{tot.totalLocais}</strong> <span className="text-[#78716C] font-normal text-[9.5px]">locais</span>
                          </div>
                        ) : (
                          <span className="text-[#A8A29E] font-mono text-xs">-</span>
                        )}
                      </td>
                    ))}
                    <td className="py-2.5 px-3 text-right text-xs font-mono font-bold text-[#1C1917]">
                      {picoGeralSemana}p
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Legenda e Nota do Rodapé */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 text-[10px] text-[#78716C]">
              <div className="flex items-center gap-3.5 flex-wrap">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#22C55E]" />
                  até 40%
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#047857]" />
                  40–85%
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#D97706]" />
                  85–100%
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#DC2626]" />
                  sem cama
                </span>
              </div>

              <span className="italic">
                Equipes distintas alojadas no dia; a mesma equipe pode ter mais de um local reservado.
              </span>
            </div>

            {/* Modal de Edição de Alojamento */}
            <Dialog open={!!alojamentoEditando} onOpenChange={(open) => !open && setAlojamentoEditando(null)}>
              <DialogContent className="sm:max-w-[440px] bg-white border border-[#E6E3DD] p-5 shadow-lg">
                <DialogHeader className="border-b border-[#E6E3DD] pb-3">
                  <DialogTitle className="text-sm font-bold text-[#1C1917] flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-[#E07A1F]" />
                    Editar Alojamento / Base
                  </DialogTitle>
                </DialogHeader>

                {alojamentoEditando && (
                  <form onSubmit={handleSalvarEdicaoAlojamento} className="space-y-3.5 pt-2">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-[#5C574F] uppercase tracking-wider block">
                        Nome do Local
                      </label>
                      <input
                        type="text"
                        value={alojamentoEditando.nome}
                        onChange={(e) => setAlojamentoEditando({ ...alojamentoEditando, nome: e.target.value })}
                        required
                        placeholder="Ex: Alojamento Coribe Centro"
                        className="w-full bg-[#FAF8F5] border border-[#DEDAD3] rounded-lg h-9 px-3 text-xs font-semibold text-[#1C1917] focus:outline-none focus:ring-1 focus:ring-[#E07A1F]"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-[#5C574F] uppercase tracking-wider block">
                          Capacidade (Vagas)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="500"
                          value={alojamentoEditando.capacidade}
                          onChange={(e) => setAlojamentoEditando({ ...alojamentoEditando, capacidade: parseInt(e.target.value, 10) || 0 })}
                          required
                          className="w-full bg-[#FAF8F5] border border-[#DEDAD3] rounded-lg h-9 px-3 text-xs font-bold font-mono text-[#1C1917] focus:outline-none focus:ring-1 focus:ring-[#E07A1F]"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-[#5C574F] uppercase tracking-wider block">
                          Município / Cidade
                        </label>
                        <input
                          type="text"
                          value={alojamentoEditando.municipio}
                          onChange={(e) => setAlojamentoEditando({ ...alojamentoEditando, municipio: e.target.value })}
                          placeholder="Ex: CORIBE"
                          className="w-full bg-[#FAF8F5] border border-[#DEDAD3] rounded-lg h-9 px-3 text-xs font-semibold text-[#1C1917] focus:outline-none focus:ring-1 focus:ring-[#E07A1F]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-[#78716C] uppercase tracking-wider block">
                          Latitude (Opcional)
                        </label>
                        <input
                          type="number"
                          step="any"
                          value={alojamentoEditando.latitude ?? ''}
                          onChange={(e) => setAlojamentoEditando({ ...alojamentoEditando, latitude: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                          placeholder="-13.4000"
                          className="w-full bg-[#FAF8F5] border border-[#DEDAD3] rounded-lg h-8 px-2.5 text-xs font-mono text-[#1C1917] focus:outline-none focus:ring-1 focus:ring-[#E07A1F]"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-semibold text-[#78716C] uppercase tracking-wider block">
                          Longitude (Opcional)
                        </label>
                        <input
                          type="number"
                          step="any"
                          value={alojamentoEditando.longitude ?? ''}
                          onChange={(e) => setAlojamentoEditando({ ...alojamentoEditando, longitude: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                          placeholder="-44.1833"
                          className="w-full bg-[#FAF8F5] border border-[#DEDAD3] rounded-lg h-8 px-2.5 text-xs font-mono text-[#1C1917] focus:outline-none focus:ring-1 focus:ring-[#E07A1F]"
                        />
                      </div>
                    </div>

                    {erroEdicaoAlojamento && (
                      <div className="p-2 bg-rose-50 border border-rose-200 rounded text-xs text-rose-700 font-medium">
                        {erroEdicaoAlojamento}
                      </div>
                    )}

                    <DialogFooter className="pt-3 border-t border-[#E6E3DD] gap-2 flex items-center justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setAlojamentoEditando(null)}
                        disabled={salvandoAlojamento}
                        className="h-8 text-xs font-bold"
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="submit"
                        disabled={salvandoAlojamento}
                        className="h-8 text-xs font-bold bg-[#E07A1F] hover:bg-[#C0671A] text-white"
                      >
                        {salvandoAlojamento ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                            Salvando...
                          </>
                        ) : (
                          'Salvar Alterações'
                        )}
                      </Button>
                    </DialogFooter>
                  </form>
                )}
              </DialogContent>
            </Dialog>
          </div>
        );
      })()}

      {/* 5.9 RESUMO EXECUTIVO DO PERÍODO */}
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

          {/* Parágrafo de Resumo com valores destacados */}
          <p className="text-xs text-[#3C3833] leading-relaxed">
            {renderResumoHighlighted(resumoIa)}
          </p>

          {/* Destaques com trilho colorido por gravidade (Editáveis inline + Adicionar/Remover) */}
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
                  className="group p-2.5 rounded-lg bg-[#FBFAF7] border border-[#E6E3DD] text-xs space-y-1 relative"
                  style={{ borderLeft: `3.5px solid ${corGravidade}` }}
                >
                  <button
                    type="button"
                    onClick={() => handleRemoveDestaque(idx)}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-[#A39E96] hover:text-[#C0392E] print:hidden"
                    title="Remover destaque"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <input
                    type="text"
                    value={d.titulo}
                    onChange={e => handleDestaqueChange(idx, 'titulo', e.target.value)}
                    className="w-full font-bold text-[#23211E] bg-transparent focus:outline-none focus:bg-white/80 rounded px-1 pr-6"
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

            {/* Botão Adicionar Destaque */}
            <button
              type="button"
              onClick={handleAddDestaque}
              className="flex items-center gap-1.5 text-[11px] font-semibold text-[#E07A1F] hover:text-[#C0671A] transition-colors print:hidden px-1 py-1"
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar consideração
            </button>
          </div>

          <p className="text-[10.5px] text-[#A39E96] italic pt-1 print:hidden">
            Texto gerado a partir dos dados do planejamento. Revise antes de enviar.
          </p>
        </div>
      )}
    </div>
  );
};
