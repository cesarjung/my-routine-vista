import React, { useState, useMemo } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Calendar as CalendarIcon,
  Trash2,
  Send,
  Plus,
  Wrench,
  PackageCheck,
  Check,
  RotateCcw,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  PcpPontoItem,
  ServicoBase,
  MaterialPontoBudget,
  MOTIVOS_REPROGRAMACAO_COL_AU,
  ETAPAS_ATIVIDADES_PRE_FECHAMENTO,
  inferEtapaFromServico
} from '@/hooks/usePcpPlanejamentoData';

export interface SituacaoDia {
  forte: string;
  texto: string;
  fundo: string;
  rotulo: string;
}

export function getSituacaoDia(pontosCount: number, tempoTotalHoras: number, pctMeta: number): SituacaoDia {
  if (pontosCount === 0) {
    return { forte: '#BFB9B0', texto: '#8C877E', fundo: '#F0EDE8', rotulo: 'Vazio' };
  }
  if (tempoTotalHoras > 11.5) {
    return { forte: '#C0392E', texto: '#B03028', fundo: '#F9E4E1', rotulo: 'Crítico' };
  }
  if (tempoTotalHoras > 10) {
    return { forte: '#D9782E', texto: '#B4581A', fundo: '#FBEBDC', rotulo: 'Excedido' };
  }
  if (tempoTotalHoras >= 8 && tempoTotalHoras <= 10) {
    if (pctMeta >= 100) {
      return { forte: '#17794C', texto: '#17794C', fundo: '#E6F2EA', rotulo: 'Ótimo' };
    }
    return { forte: '#4E9E63', texto: '#3F8A55', fundo: '#EDF4E7', rotulo: 'Bom' };
  }
  if (tempoTotalHoras >= 6.4 && tempoTotalHoras < 8) {
    return { forte: '#C9A227', texto: '#A06A16', fundo: '#FBF2DA', rotulo: 'Folga' };
  }
  return { forte: '#D9782E', texto: '#B4581A', fundo: '#FBEBDC', rotulo: 'Ociosa' };
}

function formatMinToHours(minutes: number): string {
  if (!minutes || minutes <= 0) return '00:00';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

interface PcpDiaRowProps {
  dia: {
    id: string;
    index: number;
    nomeDia: string;
    dataStr: string;
    dataCompleta: string;
    dateObj: Date;
    isPes?: boolean;
    reprogramar?: boolean;
    motivoReprogramar?: string;
  };
  totalDias: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  viewMode: 'jornada' | 'alojamentos';
  pontosDoDia: string[];
  pontosDisponiveis: string[];
  orcamentoPorPontoMap: Map<string, MaterialPontoBudget[]>;
  getItemsDoPontoNoDia: (diaId: string, pontoLabel: string) => PcpPontoItem[];
  alojamentosDisponiveis: any[];
  metaEquipeDia: number;
  etapaGeralDia: string[];
  isPesDia: boolean;
  isReprogramarDia: boolean;
  motivoReprogramarDia: string;
  filtroLvDoDia: 'COMPLETO' | 'SOMENTE_LV' | 'SEM_LV';
  tempoSaidaBaseMin: number;
  tempoSegurancaMin: number;
  tempoIdaMin: number;
  tempoVoltaMin: number;
  isIdaManual: boolean;
  isVoltaManual: boolean;
  origemAloj: string;
  destinoAloj: string;
  distIdaKm?: number;
  distVoltaKm?: number;
  baseNome?: string;
  isTrocaAloj: boolean;
  filteredServicosBase: ServicoBase[];
  // Handlers
  handleUpdateDiaAlojamento: (diaId: string, tipo: 'origem' | 'destino', alojNome: string) => void;
  handleUpdateDiaTempo: (diaId: string, tipo: 'ida' | 'volta', minutos: number) => void;
  handleUpdateDiaTempoComp: (diaId: string, field: 'saidaBase' | 'seguranca', minutos: number) => void;
  handleUpdateDiaDate: (diaId: string, newDate: Date) => void;
  handleRemoveDia: (diaId: string) => void;
  handleToggleReprogramarDia: (diaId: string) => void;
  handleSelectMotivoReprogramarDia: (diaId: string, motivo: string) => void;
  handleTogglePesDia: (diaId: string) => void;
  handleToggleEtapaNoDia: (diaId: string, etapaName: string) => void;
  handleSetFiltroLvNoDia: (diaId: string, f: 'COMPLETO' | 'SOMENTE_LV' | 'SEM_LV') => void;
  handleTogglePontoNoDia: (diaId: string, pontoLabel: string) => void;
  handleSelectAllPontosNoDia: (diaId: string) => void;
  handleDeselectAllPontosNoDia: (diaId: string) => void;
  handleAddCustomPontoNoDia: (diaId: string, customPontoName: string) => void;
  handleAddAtividadeNoPonto: (diaId: string, pontoLabelTarget: string) => void;
  handleUpdateAtividade: (diaId: string, pontoLabelTarget: string, itemIdOrIndex: string | number, field: keyof PcpPontoItem, value: any) => void;
  handleRemoveAtividade: (diaId: string, pontoLabelTarget: string, itemIdOrIndex: string | number) => void;
  handleEnviarPlanPrincipalDia: (diaId: string) => void;
}

export const PcpDiaRow: React.FC<PcpDiaRowProps> = ({
  dia,
  totalDias,
  isExpanded,
  onToggleExpand,
  viewMode,
  pontosDoDia,
  pontosDisponiveis,
  orcamentoPorPontoMap,
  getItemsDoPontoNoDia,
  alojamentosDisponiveis,
  metaEquipeDia,
  etapaGeralDia,
  isPesDia,
  isReprogramarDia,
  motivoReprogramarDia,
  filtroLvDoDia,
  tempoSaidaBaseMin,
  tempoSegurancaMin,
  tempoIdaMin,
  tempoVoltaMin,
  distIdaKm,
  distVoltaKm,
  baseNome,
  isIdaManual,
  isVoltaManual,
  origemAloj,
  destinoAloj,
  isTrocaAloj,
  filteredServicosBase,
  handleUpdateDiaAlojamento,
  handleUpdateDiaTempo,
  handleUpdateDiaTempoComp,
  handleUpdateDiaDate,
  handleRemoveDia,
  handleToggleReprogramarDia,
  handleSelectMotivoReprogramarDia,
  handleTogglePesDia,
  handleToggleEtapaNoDia,
  handleSetFiltroLvNoDia,
  handleTogglePontoNoDia,
  handleSelectAllPontosNoDia,
  handleDeselectAllPontosNoDia,
  handleAddCustomPontoNoDia,
  handleAddAtividadeNoPonto,
  handleUpdateAtividade,
  handleRemoveAtividade,
  handleEnviarPlanPrincipalDia,
}) => {
  const [customPontoInput, setCustomPontoInput] = useState('');
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  // Cálculos do Dia
  const pontosAtivos = pontosDoDia || [];
  let tempoServicoMin = 0;
  let valorPlanejado = 0;

  pontosAtivos.forEach(p => {
    const items = getItemsDoPontoNoDia(dia.id, p);
    items.forEach(i => {
      if (i.selected) {
        tempoServicoMin += (i.tempoEstimadoMinutos || 0);
        valorPlanejado += (i.valorEstimado || 0);
      }
    });
  });

  const deslocamentoMin = tempoIdaMin + tempoVoltaMin;
  const tempoTotalMin = tempoSaidaBaseMin + tempoIdaMin + tempoSegurancaMin + tempoServicoMin + tempoVoltaMin;
  const tempoTotalHoras = tempoTotalMin / 60;
  const pctMeta = metaEquipeDia > 0 ? Math.round((valorPlanejado / metaEquipeDia) * 100) : 0;
  const situacao = getSituacaoDia(pontosAtivos.length, tempoTotalHoras, pctMeta);

  // Porcentagens para a barra de 0 a 13h (780 min)
  const pctSaida = Math.min(100, (tempoSaidaBaseMin / 780) * 100);
  const pctIda = Math.min(100, (tempoIdaMin / 780) * 100);
  const pctSeg = Math.min(100, (tempoSegurancaMin / 780) * 100);
  const pctServ = Math.min(100, (tempoServicoMin / 780) * 100);
  const pctVolta = Math.min(100, (tempoVoltaMin / 780) * 100);

  const isDeslocamentoAlto = deslocamentoMin > 120; // > 02:00
  const isServicoBaixo = tempoServicoMin < 420 && pontosAtivos.length > 0; // < 07:00

  return (
    <div className="border-b border-[#E6E3DD] transition-colors">
      {/* LINHA FECHADA: VISÃO JORNADA */}
      {viewMode === 'jornada' && (
        <div
          onClick={onToggleExpand}
          className="flex items-center cursor-pointer hover:bg-[#FBF5EC]/50 transition-colors py-3 px-2 text-sm select-none"
          style={{ borderLeft: `4px solid ${situacao.forte}` }}
        >
          {/* Seta de expansão */}
          <div className="w-[30px] flex items-center justify-center text-[#A39E96]">
            {isExpanded ? <ChevronDown className="w-4 h-4 text-[#23211E]" /> : <ChevronRight className="w-4 h-4" />}
          </div>

          {/* Dia e data */}
          <div className="w-[125px] font-semibold text-[#23211E] shrink-0">
            <span className="capitalize">{dia.nomeDia.slice(0, 3)}</span>, {dia.dataStr}
          </div>

          {/* Pontos */}
          <div className="w-[85px] font-mono text-xs text-[#5C574F] shrink-0">
            {pontosAtivos.length === 1 ? '1 ponto' : `${pontosAtivos.length} pontos`}
          </div>

          {/* Ocupação da Jornada (Barra de 0 a 13h) */}
          <div className="flex-1 min-w-[280px] px-3">
            <div className="relative h-[18px] bg-[#F4F2EE] rounded-md overflow-hidden flex shadow-inner">
              {/* Janela Alvo de 8h a 10h */}
              <div
                className="absolute top-0 bottom-0 pointer-events-none"
                style={{
                  left: `${(480 / 780) * 100}%`,
                  width: `${(120 / 780) * 100}%`,
                  backgroundColor: 'rgba(23, 121, 76, 0.15)',
                  borderLeft: '1.5px dashed rgba(23, 121, 76, 0.5)',
                  borderRight: '1.5px dashed rgba(23, 121, 76, 0.5)'
                }}
                title="Janela ideal de jornada: 08:00 a 10:00"
              />

              {/* Segmentos na ordem fixa */}
              {tempoSaidaBaseMin > 0 && (
                <div
                  style={{ width: `${pctSaida}%`, backgroundColor: '#23211E' }}
                  title={`Saída: ${formatMinToHours(tempoSaidaBaseMin)}`}
                />
              )}
              {tempoIdaMin > 0 && (
                <div
                  style={{ width: `${pctIda}%`, backgroundColor: '#E07A1F' }}
                  title={`Ida: ${formatMinToHours(tempoIdaMin)}${distIdaKm ? ` (${distIdaKm} km)` : ''}`}
                />
              )}
              {tempoSegurancaMin > 0 && (
                <div
                  style={{ width: `${pctSeg}%`, backgroundColor: '#A39E96' }}
                  title={`Segurança: ${formatMinToHours(tempoSegurancaMin)}`}
                />
              )}
              {tempoServicoMin > 0 && (
                <div
                  style={{ width: `${pctServ}%`, backgroundColor: '#C0392E' }}
                  title={`Serviço: ${formatMinToHours(tempoServicoMin)}`}
                />
              )}
              {tempoVoltaMin > 0 && (
                <div
                  style={{ width: `${pctVolta}%`, backgroundColor: '#F5BE84' }}
                  title={`Volta: ${formatMinToHours(tempoVoltaMin)}${distVoltaKm ? ` (${distVoltaKm} km)` : ''}`}
                />
              )}
            </div>

            {/* Leituras auxiliares abaixo da barra */}
            <div className="flex items-center gap-4 mt-1.5 text-xs font-mono">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#C0392E' }} />
                <span className="text-[#6B6660]">serviço:</span>
                <strong style={{ color: isServicoBaixo ? '#B03028' : '#23211E' }}>
                  {formatMinToHours(tempoServicoMin)}
                </strong>
                <span className="text-[#A39E96]">mín 07:00</span>
              </span>

              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#E07A1F' }} />
                <span className="text-[#6B6660]">ida e volta:</span>
                <strong style={{ color: isDeslocamentoAlto ? '#B03028' : '#23211E' }}>
                  {formatMinToHours(deslocamentoMin)}
                </strong>
                <span className="text-[#A39E96]">máx 02:00</span>
              </span>
            </div>
          </div>

          {/* Total de Horas */}
          <div className="w-[70px] font-mono font-bold text-right pr-2 shrink-0 text-sm" style={{ color: situacao.texto }}>
            {formatMinToHours(tempoTotalMin)}
          </div>

          {/* Planejado */}
          <div className="w-[110px] font-mono text-right pr-2 font-semibold text-[#23211E] shrink-0 text-sm">
            R$ {valorPlanejado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>

          {/* % Meta */}
          <div className="w-[70px] font-mono font-bold text-right pr-2 shrink-0 text-sm" style={{ color: situacao.texto }}>
            {pctMeta}%
          </div>

          {/* Situação */}
          <div className="w-[90px] text-center shrink-0">
            <span
              className="inline-block px-2.5 py-1 rounded-md text-[11px] font-bold tracking-tight shadow-2xs"
              style={{ backgroundColor: situacao.fundo, color: situacao.texto }}
            >
              {situacao.rotulo}
            </span>
          </div>

          {/* Marcações (REPROG / PES) */}
          <div className="w-[100px] flex items-center justify-center gap-1 shrink-0">
            {isReprogramarDia && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#FBF2DA] text-[#A06A16] border border-[#E8C9A0]">
                REPROG
              </span>
            )}
            {isPesDia && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#E6F2EA] text-[#17794C] border border-[#A0D4B2]">
                PES
              </span>
            )}
          </div>

          {/* Botão de Excluir Dia */}
          <div className="w-[36px] flex items-center justify-center shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleRemoveDia(dia.id);
              }}
              className="text-[#A39E96] hover:text-[#C0392E] p-1.5 rounded-md hover:bg-[#FDF2F0] transition-colors"
              title="Excluir dia de programação"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* LINHA FECHADA: VISÃO ALOJAMENTOS */}
      {viewMode === 'alojamentos' && (
        <div
          className="flex items-center py-2 px-3 text-xs select-none hover:bg-[#FBF5EC]/50 transition-colors gap-2"
          style={{
            borderLeft: `4px solid ${isDeslocamentoAlto ? '#C0392E' : isTrocaAloj ? '#C9A227' : '#E6E3DD'}`
          }}
        >
          {/* Dia */}
          <div className="w-[110px] font-semibold text-[#23211E] text-xs shrink-0">
            <span className="capitalize">{dia.nomeDia.slice(0, 3)}</span>, {dia.dataStr}
          </div>

          {/* Saída (Alojamento de Origem) */}
          <div className="w-[210px] shrink-0">
            <Select
              value={origemAloj}
              onValueChange={val => handleUpdateDiaAlojamento(dia.id, 'origem', val)}
            >
              <SelectTrigger className="h-8 text-xs bg-white border-[#DEDAD3] font-medium px-2.5 truncate">
                <SelectValue placeholder="Selecione alojamento de saída" />
              </SelectTrigger>
              <SelectContent>
                {baseNome && (
                  <SelectItem value={baseNome} className="text-xs font-semibold">
                    {baseNome}
                  </SelectItem>
                )}
                {alojamentosDisponiveis.filter(a => a.nome !== baseNome).map(a => (
                  <SelectItem key={a.id} value={a.nome} className="text-xs">
                    {a.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Ida (tempo hh:mm e km) */}
          <div className="w-[100px] shrink-0">
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="w-full h-8 px-1.5 rounded border border-[#DEDAD3] bg-white hover:bg-[#FBF5EC] transition-colors flex flex-col items-center justify-center cursor-pointer shadow-2xs group"
                  title="Clique para alterar tempo de ida"
                >
                  <div className="flex items-center gap-1">
                    <span className="font-mono font-bold text-xs text-[#23211E]">
                      {formatMinToHours(tempoIdaMin)}
                    </span>
                    {isIdaManual && (
                      <span className="text-[7.5px] px-0.5 bg-[#FBF2DA] text-[#A06A16] font-bold rounded">
                        M
                      </span>
                    )}
                  </div>
                  <span className="text-[9.5px] font-mono text-[#6B6660] leading-none">
                    {distIdaKm !== undefined && distIdaKm > 0 ? `${distIdaKm} km` : '—'}
                  </span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-3 bg-white" align="center">
                <div className="space-y-2 text-xs">
                  <span className="font-bold text-[#23211E] block">Tempo de Ida</span>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      step="5"
                      value={tempoIdaMin}
                      onChange={e => handleUpdateDiaTempo(dia.id, 'ida', parseInt(e.target.value, 10) || 0)}
                      className="h-8 text-xs font-mono font-bold text-center"
                    />
                    <span className="text-xs font-mono text-[#6B6660]">min</span>
                  </div>
                  <span className="text-[11px] font-mono text-[#A39E96] block">Equivale a {formatMinToHours(tempoIdaMin)}</span>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Retorno (Alojamento de Destino) */}
          <div className="w-[210px] shrink-0">
            <Select
              value={destinoAloj}
              onValueChange={val => handleUpdateDiaAlojamento(dia.id, 'destino', val)}
            >
              <SelectTrigger className="h-8 text-xs bg-white border-[#DEDAD3] font-medium px-2.5 truncate">
                <SelectValue placeholder="Selecione alojamento de retorno" />
              </SelectTrigger>
              <SelectContent>
                {baseNome && (
                  <SelectItem value={baseNome} className="text-xs font-semibold">
                    {baseNome}
                  </SelectItem>
                )}
                {alojamentosDisponiveis.filter(a => a.nome !== baseNome).map(a => (
                  <SelectItem key={a.id} value={a.nome} className="text-xs">
                    {a.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Volta (tempo hh:mm e km) */}
          <div className="w-[100px] shrink-0">
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="w-full h-8 px-1.5 rounded border border-[#DEDAD3] bg-white hover:bg-[#FBF5EC] transition-colors flex flex-col items-center justify-center cursor-pointer shadow-2xs group"
                  title="Clique para alterar tempo de volta"
                >
                  <div className="flex items-center gap-1">
                    <span className="font-mono font-bold text-xs text-[#23211E]">
                      {formatMinToHours(tempoVoltaMin)}
                    </span>
                    {isVoltaManual && (
                      <span className="text-[7.5px] px-0.5 bg-[#FBF2DA] text-[#A06A16] font-bold rounded">
                        M
                      </span>
                    )}
                  </div>
                  <span className="text-[9.5px] font-mono text-[#6B6660] leading-none">
                    {distVoltaKm !== undefined && distVoltaKm > 0 ? `${distVoltaKm} km` : '—'}
                  </span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-3 bg-white" align="center">
                <div className="space-y-2 text-xs">
                  <span className="font-bold text-[#23211E] block">Tempo de Volta</span>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      step="5"
                      value={tempoVoltaMin}
                      onChange={e => handleUpdateDiaTempo(dia.id, 'volta', parseInt(e.target.value, 10) || 0)}
                      className="h-8 text-xs font-mono font-bold text-center"
                    />
                    <span className="text-xs font-mono text-[#6B6660]">min</span>
                  </div>
                  <span className="text-[11px] font-mono text-[#A39E96] block">Equivale a {formatMinToHours(tempoVoltaMin)}</span>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Deslocamento Total (hh:mm e km) */}
          <div className="w-[110px] text-center shrink-0 flex flex-col items-center justify-center h-8 bg-[#F7F6F3] rounded border border-[#E6E3DD]">
            <div
              className="font-mono font-bold text-xs"
              style={{ color: isDeslocamentoAlto ? '#B03028' : '#23211E' }}
            >
              {formatMinToHours(deslocamentoMin)}
            </div>
            <div className="text-[9.5px] font-mono text-[#6B6660] leading-none">
              {(distIdaKm || 0) + (distVoltaKm || 0) > 0 ? `${Math.round(((distIdaKm || 0) + (distVoltaKm || 0)) * 10) / 10} km` : '—'}
            </div>
          </div>

          {/* Saída da Base */}
          <div className="w-[90px] shrink-0">
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="w-full h-8 px-1.5 rounded border border-[#DEDAD3] bg-white hover:bg-[#FBF5EC] transition-colors flex flex-col items-center justify-center cursor-pointer shadow-2xs font-mono font-bold text-xs text-[#23211E]"
                  title="Clique para alterar saída da base"
                >
                  <span>{formatMinToHours(tempoSaidaBaseMin)}</span>
                  <span className="text-[9px] font-normal text-[#A39E96] leading-none">{tempoSaidaBaseMin} min</span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-44 p-3 bg-white" align="center">
                <div className="space-y-2 text-xs">
                  <span className="font-bold text-[#23211E] block">Saída da Base</span>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      step="5"
                      value={tempoSaidaBaseMin}
                      onChange={e => handleUpdateDiaTempoComp(dia.id, 'saidaBase', parseInt(e.target.value, 10) || 0)}
                      className="h-8 text-xs font-mono font-bold text-center"
                    />
                    <span className="text-xs font-mono text-[#6B6660]">min</span>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Segurança */}
          <div className="w-[90px] shrink-0">
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="w-full h-8 px-1.5 rounded border border-[#DEDAD3] bg-white hover:bg-[#FBF5EC] transition-colors flex flex-col items-center justify-center cursor-pointer shadow-2xs font-mono font-bold text-xs text-[#23211E]"
                  title="Clique para alterar procedimentos de segurança"
                >
                  <span>{formatMinToHours(tempoSegurancaMin)}</span>
                  <span className="text-[9px] font-normal text-[#A39E96] leading-none">{tempoSegurancaMin} min</span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-44 p-3 bg-white" align="center">
                <div className="space-y-2 text-xs">
                  <span className="font-bold text-[#23211E] block">Segurança</span>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      step="5"
                      value={tempoSegurancaMin}
                      onChange={e => handleUpdateDiaTempoComp(dia.id, 'seguranca', parseInt(e.target.value, 10) || 0)}
                      className="h-8 text-xs font-mono font-bold text-center"
                    />
                    <span className="text-xs font-mono text-[#6B6660]">min</span>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Total Complementar */}
          <div className="w-[100px] text-center shrink-0 flex items-center justify-center h-8 bg-[#F7F6F3] rounded border border-[#E6E3DD] font-mono font-bold text-xs text-[#23211E] shadow-2xs">
            {formatMinToHours(tempoSaidaBaseMin + tempoSegurancaMin + deslocamentoMin)}
          </div>

          {/* Botão de Excluir Dia */}
          <div className="w-[36px] flex items-center justify-center shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleRemoveDia(dia.id);
              }}
              className="text-[#A39E96] hover:text-[#C0392E] p-1.5 rounded-md hover:bg-[#FDF2F0] transition-colors"
              title="Excluir dia de programação"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* CONTAINER EXPANDIDO DO DIA */}
      {isExpanded && (
        <div className="bg-[#FBFAF7] p-4 border-t border-[#E6E3DD] space-y-4 animate-in fade-in-50 duration-200">
          {/* 1. Barra de Configuração do Dia */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#E6E3DD]">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-[#F2F0EC] text-[#23211E] border border-[#DEDAD3]">
                Dia {dia.index} de {totalDias}
              </span>

              {/* Data com Popover de Calendário */}
              <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 px-3 text-xs font-mono bg-white border-[#DEDAD3] gap-1.5 font-semibold">
                    <CalendarIcon className="w-3.5 h-3.5 text-[#5C574F]" />
                    {format(dia.dateObj, "dd/MM/yyyy (EEE)", { locale: ptBR })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-white" align="start">
                  <Calendar
                    mode="single"
                    selected={dia.dateObj}
                    onSelect={d => {
                      if (d) {
                        handleUpdateDiaDate(dia.id, d);
                        setIsDatePickerOpen(false);
                      }
                    }}
                    locale={ptBR}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              {/* Toggle Reprogramar + Motivo */}
              <div className="flex items-center gap-2 ml-1">
                <label className="flex items-center gap-1.5 cursor-pointer select-none text-xs font-medium text-[#23211E]">
                  <input
                    type="checkbox"
                    checked={Boolean(isReprogramarDia)}
                    onChange={() => handleToggleReprogramarDia(dia.id)}
                    className="rounded border-[#DEDAD3] text-[#E07A1F] focus:ring-[#E07A1F] h-4 w-4"
                  />
                  <span>Reprogramar</span>
                </label>

                {isReprogramarDia && (
                  <Select
                    value={motivoReprogramarDia || MOTIVOS_REPROGRAMACAO_COL_AU[0]}
                    onValueChange={val => handleSelectMotivoReprogramarDia(dia.id, val)}
                  >
                    <SelectTrigger className="h-8 text-xs max-w-[220px] bg-white border-[#E8C9A0] text-[#A06A16] font-semibold">
                      <SelectValue placeholder="Selecione motivo" />
                    </SelectTrigger>
                    <SelectContent>
                      {MOTIVOS_REPROGRAMACAO_COL_AU.map(m => (
                        <SelectItem key={m} value={m} className="text-xs">
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Toggle PES */}
              <label className="flex items-center gap-1.5 cursor-pointer select-none text-xs font-medium text-[#23211E] ml-1">
                <input
                  type="checkbox"
                  checked={Boolean(isPesDia)}
                  onChange={() => handleTogglePesDia(dia.id)}
                  className="rounded border-[#DEDAD3] text-[#17794C] focus:ring-[#17794C] h-4 w-4"
                />
                <span>PES</span>
              </label>

              {/* Segmented Filtro LV do Dia */}
              <div className="inline-flex rounded-md border border-[#DEDAD3] bg-[#F2F0EC] p-0.5 text-xs font-semibold ml-1">
                <button
                  type="button"
                  onClick={() => handleSetFiltroLvNoDia(dia.id, 'COMPLETO')}
                  className={`px-2.5 py-1 rounded ${filtroLvDoDia === 'COMPLETO' ? 'bg-white text-[#23211E] shadow-2xs font-bold' : 'text-[#6B6660] hover:text-[#23211E]'}`}
                >
                  Completo
                </button>
                <button
                  type="button"
                  onClick={() => handleSetFiltroLvNoDia(dia.id, 'SOMENTE_LV')}
                  className={`px-2.5 py-1 rounded ${filtroLvDoDia === 'SOMENTE_LV' ? 'bg-white text-[#23211E] shadow-2xs font-bold' : 'text-[#6B6660] hover:text-[#23211E]'}`}
                >
                  Somente LV
                </button>
                <button
                  type="button"
                  onClick={() => handleSetFiltroLvNoDia(dia.id, 'SEM_LV')}
                  className={`px-2.5 py-1 rounded ${filtroLvDoDia === 'SEM_LV' ? 'bg-white text-[#23211E] shadow-2xs font-bold' : 'text-[#6B6660] hover:text-[#23211E]'}`}
                >
                  Sem LV
                </button>
              </div>
            </div>

            {/* Excluir Dia */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleRemoveDia(dia.id)}
              className="h-8 px-2.5 text-xs text-[#A39E96] hover:text-[#C0392E] hover:bg-[#F9E4E1]/50"
              title="Excluir este dia"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>

          {/* 2. Trajeto em 6 Células */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 bg-white p-3 rounded-xl border border-[#E6E3DD] text-xs shadow-2xs">
            <div>
              <span className="text-[10px] text-[#A39E96] uppercase tracking-wider block font-semibold">Saída (ida)</span>
              <strong className="text-[#23211E] text-xs truncate block mt-0.5">{origemAloj || 'Não definido'}</strong>
              <span className="font-mono text-xs text-[#5C574F]">{formatMinToHours(tempoIdaMin)}</span>
            </div>
            <div>
              <span className="text-[10px] text-[#A39E96] uppercase tracking-wider block font-semibold">Retorno (volta)</span>
              <strong className="text-[#23211E] text-xs truncate block mt-0.5">{destinoAloj || 'Não definido'}</strong>
              <span className="font-mono text-xs text-[#5C574F]">{formatMinToHours(tempoVoltaMin)}</span>
            </div>
            <div>
              <span className="text-[10px] text-[#A39E96] uppercase tracking-wider block font-semibold">Deslocamento</span>
              <strong className="font-mono text-sm block mt-0.5" style={{ color: isDeslocamentoAlto ? '#B03028' : '#23211E' }}>
                {formatMinToHours(deslocamentoMin)}
              </strong>
              <span className="text-[10px] text-[#A39E96]">máx 02:00</span>
            </div>
            <div>
              <span className="text-[10px] text-[#A39E96] uppercase tracking-wider block font-semibold">Saída da Base</span>
              <strong className="font-mono text-sm block mt-0.5 text-[#23211E]">{formatMinToHours(tempoSaidaBaseMin)}</strong>
            </div>
            <div>
              <span className="text-[10px] text-[#A39E96] uppercase tracking-wider block font-semibold">Segurança</span>
              <strong className="font-mono text-sm block mt-0.5 text-[#23211E]">{formatMinToHours(tempoSegurancaMin)}</strong>
            </div>
            <div>
              <span className="text-[10px] text-[#A39E96] uppercase tracking-wider block font-semibold">Total Previsto</span>
              <strong className="font-mono text-sm block mt-0.5 text-[#23211E]">{formatMinToHours(tempoTotalMin)}</strong>
            </div>
          </div>

          {/* 3. Seleção de Pontos do Dia (Chips Diretos e Visíveis) */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1 border-t border-[#E6E3DD]">
            <div className="flex flex-wrap items-center gap-1.5 flex-1">
              <span className="text-xs font-bold text-[#5C574F] mr-1">
                Pontos da obra ({pontosDisponiveis.length}):
              </span>

              {/* Chips de todos os pontos disponíveis da obra */}
              {pontosDisponiveis.map(pLabel => {
                const isSelected = pontosAtivos.includes(pLabel);
                return (
                  <button
                    key={pLabel}
                    type="button"
                    onClick={() => handleTogglePontoNoDia(dia.id, pLabel)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono transition-all cursor-pointer shadow-2xs ${
                      isSelected
                        ? 'bg-[#E07A1F] text-white font-bold border border-[#C66512] ring-1 ring-[#E07A1F]/30'
                        : 'bg-white text-[#5C574F] font-medium border border-[#DEDAD3] hover:border-[#E07A1F] hover:bg-[#FBF5EC] hover:text-[#23211E]'
                    }`}
                    title={isSelected ? `Clique para remover ${pLabel} deste dia` : `Clique para incluir ${pLabel} neste dia`}
                  >
                    <span>{pLabel}</span>
                    {isSelected && <Check className="w-3 h-3" />}
                  </button>
                );
              })}

              {/* Ponto Customizado Adicional */}
              <div className="inline-flex items-center gap-1 ml-1.5">
                <Input
                  placeholder="+ Outro ponto..."
                  value={customPontoInput}
                  onChange={e => setCustomPontoInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && customPontoInput.trim()) {
                      handleAddCustomPontoNoDia(dia.id, customPontoInput.trim());
                      setCustomPontoInput('');
                    }
                  }}
                  className="h-7 w-28 text-xs font-mono bg-white border-[#DEDAD3]"
                />
                {customPontoInput.trim() && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      handleAddCustomPontoNoDia(dia.id, customPontoInput.trim());
                      setCustomPontoInput('');
                    }}
                    className="h-7 px-2 text-xs bg-[#E07A1F] text-white hover:bg-[#E07A1F]/90 font-bold"
                  >
                    Add
                  </Button>
                )}
              </div>
            </div>

            {/* Ações Rápidas */}
            <div className="flex items-center gap-2 text-xs text-[#E07A1F] font-semibold shrink-0">
              <button
                type="button"
                onClick={() => handleSelectAllPontosNoDia(dia.id)}
                className="hover:underline text-[11px]"
              >
                Marcar todos
              </button>
              <span className="text-[#DEDAD3]">·</span>
              <button
                type="button"
                onClick={() => handleDeselectAllPontosNoDia(dia.id)}
                className="text-[#A39E96] hover:text-[#C0392E] hover:underline text-[11px]"
              >
                Limpar dia
              </button>
            </div>
          </div>

          {/* 4. Blocos por Ponto e Tabelas de Atividades */}
          {pontosAtivos.length === 0 ? (
            <div className="text-center py-8 bg-white rounded-xl border border-[#E6E3DD] text-[#A39E96] text-xs">
              Nenhum ponto marcado para este dia. Selecione pontos acima para montar a programação.
            </div>
          ) : (
            <div className="space-y-3.5">
              {pontosAtivos.map(pLabel => {
                const itemsDoPonto = getItemsDoPontoNoDia(dia.id, pLabel).filter(item => {
                  const isLv = (item.servico || '').toUpperCase().includes(' LV') || (item.descricaoMaterial || '').toUpperCase().includes(' LV');
                  if (filtroLvDoDia === 'SOMENTE_LV' && !isLv) return false;
                  if (filtroLvDoDia === 'SEM_LV' && isLv) return false;
                  return true;
                });

                const itemsSelecionados = itemsDoPonto.filter(i => i.selected);
                const subMinutos = itemsSelecionados.reduce((acc, i) => acc + (i.tempoEstimadoMinutos || 0), 0);
                const subValor = itemsSelecionados.reduce((acc, i) => acc + (i.valorEstimado || 0), 0);

                return (
                  <div key={pLabel} className="bg-white rounded-xl border border-[#E6E3DD] overflow-hidden shadow-2xs">
                    {/* Cabeçalho do Ponto */}
                    <div className="flex items-center justify-between px-3.5 py-2.5 bg-[#F7F6F3] border-b border-[#E6E3DD]">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono font-bold text-sm text-[#E07A1F]">Ponto {pLabel}</span>
                        <span className="text-xs text-[#6B6660]">
                          {itemsSelecionados.length} {itemsSelecionados.length === 1 ? 'atividade selecionada' : 'atividades selecionadas'}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-xs">
                        <span className="font-mono text-[#5C574F]">Tempo: {formatMinToHours(subMinutos)}</span>
                        <span className="font-mono font-bold text-[#17794C] text-sm">
                          R$ {subValor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAddAtividadeNoPonto(dia.id, pLabel)}
                          className="h-7 px-2.5 text-xs bg-white border-[#DEDAD3] text-[#23211E] gap-1 font-semibold"
                        >
                          <Plus className="w-3.5 h-3.5 text-[#E07A1F]" /> Adicionar atividade
                        </Button>
                      </div>
                    </div>

                    {/* Tabela de Atividades do Ponto */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left" style={{ minWidth: '880px' }}>
                        <thead>
                          <tr className="bg-[#F2F0EC] text-[#5C574F] text-[10px] uppercase tracking-wider border-b border-[#E6E3DD] font-semibold">
                            <th className="w-[36px] p-2.5 text-center">
                              <input
                                type="checkbox"
                                checked={itemsDoPonto.length > 0 && itemsDoPonto.every(i => i.selected)}
                                onChange={e => {
                                  const val = e.target.checked;
                                  itemsDoPonto.forEach(i => handleUpdateAtividade(dia.id, pLabel, i.id, 'selected', val));
                                }}
                                className="rounded border-[#DEDAD3] text-[#E07A1F] focus:ring-[#E07A1F] h-4 w-4"
                              />
                            </th>
                            <th className="p-2.5">Atividade</th>
                            <th className="w-[150px] p-2.5">Etapa</th>
                            <th className="w-[75px] p-2.5 text-center">Previsto</th>
                            <th className="w-[105px] p-2.5 text-center">Programado</th>
                            <th className="w-[95px] p-2.5 text-center">Tempo</th>
                            <th className="w-[100px] p-2.5 text-right">V. Unit.</th>
                            <th className="w-[110px] p-2.5 text-right">Valor</th>
                            <th className="w-[36px] p-2.5 text-right"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E6E3DD]">
                          {itemsDoPonto.map(item => {
                            const isCava = (item.servico || '').toUpperCase().includes('CAVA') ||
                              (item.servico || '').toUpperCase().includes('ESCAVA') ||
                              (item.servico || '').toUpperCase().includes('APILOA') ||
                              (item.descricaoMaterial || '').toUpperCase().includes('CAVA');

                            const isMenorQuePrevisto = item.qtdOrcadaPonto > 0 && item.quantidade < item.qtdOrcadaPonto;
                            const unitPrice = item.valorUnitario !== undefined
                              ? item.valorUnitario
                              : (item.quantidade > 0 ? item.valorEstimado / item.quantidade : 0);

                            return (
                              <tr
                                key={item.id}
                                className={`hover:bg-[#FBF5EC]/30 transition-colors ${!item.selected ? 'opacity-50 bg-[#F7F6F3]/50' : ''}`}
                              >
                                <td className="p-2.5 text-center">
                                  <input
                                    type="checkbox"
                                    checked={item.selected}
                                    onChange={e => handleUpdateAtividade(dia.id, pLabel, item.id, 'selected', e.target.checked)}
                                    className="rounded border-[#DEDAD3] text-[#E07A1F] focus:ring-[#E07A1F] h-4 w-4 cursor-pointer"
                                  />
                                </td>

                                <td className="p-2.5">
                                  <div className="flex flex-col gap-1">
                                    <span className="font-semibold text-xs text-[#23211E]">{item.servico}</span>
                                    {item.codigoMaterial && (
                                      <span className="font-mono text-[10.5px] text-[#A39E96]">{item.codigoMaterial}</span>
                                    )}

                                    {/* Toggle Retroescavadeira para Cavas */}
                                    {isCava && (
                                      <div className="flex items-center gap-2 mt-1 bg-[#FBF5EC] border border-[#E8C9A0] px-2.5 py-1 rounded text-xs w-fit shadow-2xs">
                                        <label className="flex items-center gap-1.5 cursor-pointer select-none text-[#A06A16] font-semibold">
                                          <input
                                            type="checkbox"
                                            checked={Boolean(item.usaRetro)}
                                            onChange={e => handleUpdateAtividade(dia.id, pLabel, item.id, 'usaRetro', e.target.checked)}
                                            className="rounded border-[#E8C9A0] text-[#E07A1F] focus:ring-[#E07A1F] h-3.5 w-3.5 cursor-pointer"
                                          />
                                          <span>Retro</span>
                                        </label>
                                        <div className="flex items-center gap-1 pl-2 border-l border-[#E8C9A0]">
                                          <span className="text-[#A39E96] text-[11px]">+</span>
                                          <input
                                            type="number"
                                            min="0"
                                            step="5"
                                            value={item.tempoRetroMinutos !== undefined ? item.tempoRetroMinutos : 30}
                                            onChange={e => handleUpdateAtividade(dia.id, pLabel, item.id, 'tempoRetroMinutos', parseInt(e.target.value, 10) || 0)}
                                            disabled={!item.usaRetro}
                                            className={`h-5 w-12 px-1 text-xs text-center font-mono font-bold rounded border ${!item.usaRetro ? 'opacity-40 bg-[#F2F0EC] border-[#DEDAD3]' : 'bg-white text-[#A06A16] border-[#E8C9A0]'}`}
                                          />
                                          <span className="text-[#A39E96] text-[11px]">min</span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </td>

                                <td className="p-2.5">
                                  <Select
                                    value={item.etapaPrevista}
                                    onValueChange={val => handleUpdateAtividade(dia.id, pLabel, item.id, 'etapaPrevista', val)}
                                  >
                                    <SelectTrigger className="h-7 text-xs bg-white border-[#DEDAD3]">
                                      <SelectValue placeholder="Etapa" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {ETAPAS_ATIVIDADES_PRE_FECHAMENTO.map(et => (
                                        <SelectItem key={et} value={et} className="text-xs">
                                          {et}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </td>

                                <td className="p-2.5 text-center font-mono text-xs text-[#5C574F]">
                                  {item.qtdOrcadaPonto}
                                </td>

                                <td className="p-2.5 text-center">
                                  <div
                                    className={`inline-flex items-center rounded border px-1.5 py-0.5 ${isMenorQuePrevisto ? 'bg-[#FBF2DA] border-[#E8C9A0]' : 'bg-white border-[#DEDAD3]'}`}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateAtividade(dia.id, pLabel, item.id, 'quantidade', Math.max(1, item.quantidade - 1))}
                                      className="px-1.5 text-[#5C574F] hover:text-[#23211E] font-bold text-sm"
                                    >
                                      −
                                    </button>
                                    <input
                                      type="number"
                                      min="1"
                                      step="1"
                                      value={item.quantidade}
                                      onChange={e => handleUpdateAtividade(dia.id, pLabel, item.id, 'quantidade', parseInt(e.target.value, 10) || 1)}
                                      className="w-10 text-center text-xs font-mono font-bold bg-transparent focus:outline-none"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateAtividade(dia.id, pLabel, item.id, 'quantidade', item.quantidade + 1)}
                                      className="px-1.5 text-[#5C574F] hover:text-[#23211E] font-bold text-sm"
                                    >
                                      +
                                    </button>
                                  </div>
                                </td>

                                <td className="p-2.5 text-center font-mono text-[#5C574F]">
                                  <div className="flex flex-col">
                                    <span className="font-semibold text-xs">{formatMinToHours(item.tempoEstimadoMinutos)}</span>
                                    {item.usaRetro && (
                                      <span className="text-[10px] text-[#A06A16]">
                                        (+{item.tempoRetroMinutos ?? 30}m retro)
                                      </span>
                                    )}
                                  </div>
                                </td>

                                <td className="p-2.5 text-right font-mono text-[#6B6660]">
                                  R$ {unitPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>

                                <td className="p-2.5 text-right font-mono font-semibold text-[#17794C]">
                                  R$ {item.valorEstimado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>

                                <td className="p-2.5 text-right">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveAtividade(dia.id, pLabel, item.id)}
                                    className="text-[#A39E96] hover:text-[#C0392E] transition-colors p-1"
                                    title="Remover atividade"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 5. Rodapé do Dia com Avisos e Botão de Enviar Individual */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-[#E6E3DD]">
            <div className="flex items-center gap-3 text-xs">
              {isDeslocamentoAlto && (
                <span className="text-[#B03028] font-medium flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" /> Deslocamento acima de 2 horas ({formatMinToHours(deslocamentoMin)})
                </span>
              )}
              {tempoTotalHoras < 8 && (
                <span className="text-[#A06A16] font-medium flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" /> Jornada abaixo de 8 horas ({formatMinToHours(tempoTotalMin)})
                </span>
              )}
              {tempoTotalHoras > 10 && (
                <span className="text-[#B03028] font-medium flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" /> Jornada acima de 10 horas ({formatMinToHours(tempoTotalMin)})
                </span>
              )}
            </div>

            <Button
              size="sm"
              onClick={() => handleEnviarPlanPrincipalDia(dia.id)}
              className="h-8 px-3.5 text-xs bg-[#E07A1F] text-white hover:bg-[#E07A1F]/90 gap-1.5 font-bold"
            >
              <Send className="w-3.5 h-3.5" /> Enviar somente este dia
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
