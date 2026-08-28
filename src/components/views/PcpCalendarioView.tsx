import React, { useState } from 'react';
import {
  Calendar as CalendarIcon,
  RefreshCw,
  FileDown,
  Building2,
  ChevronLeft,
  ChevronRight,
  Info,
  Clock,
  Layers,
  Send
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { UNIDADES_PLANEJAMENTO } from '@/constants/unidades';
import { usePlanejamentoSemanal } from '@/hooks/usePlanejamentoSemanal';
import { CalendarioPlanejamento } from '@/components/pcp/CalendarioPlanejamento';
import { EnvioPlanejamentoModal } from '@/components/pcp/EnvioPlanejamentoModal';
import { EmailBlocosConfig } from '@/lib/planejamentoEmail';
import type { ComputedMapData } from '@/components/views/PlanejamentoEquipesMap';

export const PcpCalendarioView: React.FC = () => {
  const [selectedUnidadeId, setSelectedUnidadeId] = useState<string>(
    UNIDADES_PLANEJAMENTO[1]?.id || UNIDADES_PLANEJAMENTO[0]?.id || ''
  );
  
  // Período Inicial e Final
  const [dataInicioStr, setDataInicioStr] = useState<string>(
    format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
  );
  const [dataFimStr, setDataFimStr] = useState<string>(
    format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
  );

  // Modal de Envio de Planejamento por E-mail
  const [isEnvioModalOpen, setIsEnvioModalOpen] = useState(false);
  // Dados GPS reais das equipes para o mapa do e-mail (capturados via PlanejamentoEquipesMap)
  const [mapDataGps, setMapDataGps] = useState<ComputedMapData[]>([]);

  const {
    inicioSemana,
    fimSemana,
    diasDaSemana,
    isLoading,
    isRefetching,
    error,
    syncFromSheets,
    equipes,
    metricas,
    alojamentos,
    avisoBdConfig,
    ultimaAtualizacao,
  } = usePlanejamentoSemanal({
    unidadeId: selectedUnidadeId,
    dataInicio: dataInicioStr,
    dataFim: dataFimStr,
  });

  const selectedUnidadeObj = UNIDADES_PLANEJAMENTO.find(u => u.id === selectedUnidadeId);
  const unidadeNome = selectedUnidadeObj?.nome || 'BOM JESUS DA LAPA';

  // Configurações da prévia
  const [escopo, setEscopo] = useState<'todas' | 'com_programacao'>('todas');
  const [densidade, setDensidade] = useState<'detalhado' | 'compacto'>('detalhado');
  const [blocos, setBlocos] = useState<EmailBlocosConfig>({
    resumo: true,
    calendario: true,
    vistorias: true,
    disponiveis: true,
    alojamentos: true,
    observacoes: true,
    mapa: true,
  });

  const handleSemanaAnterior = () => {
    const curStart = new Date(dataInicioStr);
    const prevStart = subWeeks(curStart, 1);
    const prevEnd = endOfWeek(prevStart, { weekStartsOn: 1 });
    setDataInicioStr(format(prevStart, 'yyyy-MM-dd'));
    setDataFimStr(format(prevEnd, 'yyyy-MM-dd'));
  };

  const handleProximaSemana = () => {
    const curStart = new Date(dataInicioStr);
    const nextStart = addWeeks(curStart, 1);
    const nextEnd = endOfWeek(nextStart, { weekStartsOn: 1 });
    setDataInicioStr(format(nextStart, 'yyyy-MM-dd'));
    setDataFimStr(format(nextEnd, 'yyyy-MM-dd'));
  };

  const handleSemanaAtual = () => {
    const now = new Date();
    setDataInicioStr(format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
    setDataFimStr(format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  };

  const handleMesAtual = () => {
    const now = new Date();
    setDataInicioStr(format(startOfMonth(now), 'yyyy-MM-dd'));
    setDataFimStr(format(endOfMonth(now), 'yyyy-MM-dd'));
  };

  const handleBaixarPdf = () => {
    window.print();
  };

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6 w-full min-h-screen bg-[#F7F6F3] text-[#23211E] font-sans antialiased">
      {/* 1. HEADER FIXO DA SEÇÃO CALENDÁRIO */}
      <header className="bg-white rounded-xl border border-[#E6E3DD] p-4 shadow-2xs space-y-3 print:hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Título e Módulo */}
          <div className="flex items-center gap-3">
            <div className="w-[3.5px] h-8 bg-gradient-to-b from-[#E07A1F] to-[#E07A1F]/30 rounded-full shrink-0" />
            <div>
              <span className="text-[11px] uppercase tracking-[0.12em] font-mono text-[#A39E96] block leading-none font-semibold">
                MÓDULO PCP · PROGRAMAÇÃO OPERACIONAL
              </span>
              <h1 className="text-[18px] font-bold text-[#23211E] leading-tight mt-1 flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-[#E07A1F]" />
                Calendário de Planejamento do Período
              </h1>
            </div>
          </div>

          {/* Controles de Dados: Unidade, Período, Carregar Sheets, PDF e Envio */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Seletor de Unidade */}
            <Select value={selectedUnidadeId} onValueChange={setSelectedUnidadeId}>
              <SelectTrigger className="h-[32px] px-3 text-xs bg-[#FAF8F5] border-[#DEDAD3] text-[#23211E] font-semibold flex items-center gap-1.5 w-auto">
                <Building2 className="w-3.5 h-3.5 text-[#E07A1F]" />
                <span>{selectedUnidadeObj?.nome || 'Selecione a Unidade'}</span>
              </SelectTrigger>
              <SelectContent>
                {UNIDADES_PLANEJAMENTO.map(u => (
                  <SelectItem key={u.id} value={u.id} className="text-xs font-semibold">
                    {u.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Filtro de Período Personalizado (Início e Fim) */}
            <div className="flex items-center gap-1.5 bg-[#FAF8F5] px-2 py-1 rounded-lg border border-[#DEDAD3] text-xs">
              <span className="text-[10.5px] uppercase font-bold text-[#6B6660]">De:</span>
              <input
                type="date"
                value={dataInicioStr}
                onChange={e => setDataInicioStr(e.target.value)}
                className="h-6 px-1.5 text-xs rounded border border-[#DEDAD3] bg-white font-mono text-[#23211E]"
              />
              <span className="text-[10.5px] uppercase font-bold text-[#6B6660]">Até:</span>
              <input
                type="date"
                value={dataFimStr}
                onChange={e => setDataFimStr(e.target.value)}
                className="h-6 px-1.5 text-xs rounded border border-[#DEDAD3] bg-white font-mono text-[#23211E]"
              />
            </div>

            {/* Navegador Rápido de Semanas / Atalhos */}
            <div className="inline-flex items-center rounded-lg border border-[#DEDAD3] bg-[#FAF8F5] h-[32px] p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={handleSemanaAnterior}
                className="px-2 h-full text-[#6B6660] hover:text-[#23211E] font-bold"
                title="Semana anterior"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleSemanaAtual}
                className="px-2 text-xs font-mono font-bold text-[#23211E] hover:bg-white rounded transition-colors"
                title="Ir para semana atual"
              >
                Esta semana
              </button>
              <button
                type="button"
                onClick={handleMesAtual}
                className="px-2 text-xs font-mono font-bold text-[#6B6660] hover:bg-white rounded transition-colors"
                title="Ver mês completo"
              >
                Mês
              </button>
              <button
                type="button"
                onClick={handleProximaSemana}
                className="px-2 h-full text-[#6B6660] hover:text-[#23211E] font-bold"
                title="Próxima semana"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Botão Carregar do Sheets */}
            <Button
              variant="outline"
              size="sm"
              onClick={syncFromSheets}
              disabled={isLoading || isRefetching}
              className="h-[32px] px-3 text-xs font-semibold bg-white border-[#DEDAD3] text-[#23211E] hover:bg-[#FBF5EC] hover:border-[#E8C9A0] shadow-2xs gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#5C574F] ${isLoading || isRefetching ? 'animate-spin' : ''}`} />
              <span>Sincronizar Sheets</span>
            </Button>

            {/* Baixar PDF */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleBaixarPdf}
              className="h-[32px] px-3 text-xs font-semibold bg-white border-[#DEDAD3] text-[#23211E] hover:bg-[#FBF5EC] shadow-2xs gap-1.5"
            >
              <FileDown className="w-3.5 h-3.5 text-[#E07A1F]" />
              <span>PDF</span>
            </Button>

            {/* Botão Enviar Planejamento por E-mail */}
            <Button
              size="sm"
              onClick={() => setIsEnvioModalOpen(true)}
              className="h-[32px] px-3.5 text-xs font-bold bg-[#E07A1F] text-white hover:bg-[#E07A1F]/90 shadow-2xs gap-1.5 ml-1"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Enviar planejamento</span>
            </Button>
          </div>
        </div>

        {/* Linha Inferior: Indicador de Carga e Interruptores de Blocos */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-2.5 border-t border-[#E6E3DD] text-xs">
          {/* Indicador de última carga */}
          <div className="flex items-center gap-2 text-[11px] text-[#6B6660]">
            <Clock className="w-3.5 h-3.5 text-[#A39E96]" />
            <span>
              {ultimaAtualizacao
                ? `Última sincronização: ${format(new Date(ultimaAtualizacao), 'dd/MM/yyyy às HH:mm')}`
                : 'Sincronização em tempo real'}
            </span>
            <span className="text-[#A39E96]">·</span>
            <span className="font-mono font-semibold text-[#23211E]">
              {diasDaSemana.length} {diasDaSemana.length === 1 ? 'dia' : 'dias'} no período ({format(inicioSemana, 'dd/MM')} a {format(fimSemana, 'dd/MM/yyyy')})
            </span>
          </div>

          {/* Painel de Blocos do e-mail (Switches rápidos) */}
          <div className="flex items-center gap-3 flex-wrap text-[11px] font-medium text-[#5C574F]">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#A39E96]">
              BLOCOS:
            </span>

            <label className="flex items-center gap-1.5 cursor-pointer">
              <Switch
                checked={blocos.mapa}
                onCheckedChange={v => setBlocos(p => ({ ...p, mapa: v }))}
                className="scale-75"
              />
              <span>Mapa</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer">
              <Switch
                checked={blocos.calendario}
                onCheckedChange={v => setBlocos(p => ({ ...p, calendario: v }))}
                className="scale-75"
              />
              <span>Grade</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer">
              <Switch
                checked={blocos.vistorias !== false}
                onCheckedChange={v => setBlocos(p => ({ ...p, vistorias: v }))}
                className="scale-75"
              />
              <span>Vistorias</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer">
              <Switch
                checked={blocos.alojamentos}
                onCheckedChange={v => setBlocos(p => ({ ...p, alojamentos: v }))}
                className="scale-75"
              />
              <span>Alojamentos</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer">
              <Switch
                checked={blocos.observacoes}
                onCheckedChange={v => setBlocos(p => ({ ...p, observacoes: v }))}
                className="scale-75"
              />
              <span>Observações</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer">
              <Switch
                checked={blocos.resumo}
                onCheckedChange={v => setBlocos(p => ({ ...p, resumo: v }))}
                className="scale-75"
              />
              <span>Resumo Executivo</span>
            </label>
          </div>
        </div>
      </header>

      {/* 2. O CORPO: COMPONENTE COMPARTILHADO (modo='previa') */}
      <main className="space-y-4">
        <CalendarioPlanejamento
          modo="previa"
          unidadeId={selectedUnidadeId}
          unidadeNome={unidadeNome}
          inicioSemana={inicioSemana}
          fimSemana={fimSemana}
          diasDaSemana={diasDaSemana}
          equipes={equipes}
          metricas={metricas}
          alojamentos={alojamentos}
          avisoBdConfig={avisoBdConfig}
          ultimaAtualizacao={ultimaAtualizacao}
          escopo={escopo}
          setEscopo={setEscopo}
          densidade={densidade}
          setDensidade={setDensidade}
          blocos={blocos}
          onMapDataReady={setMapDataGps}
        />
      </main>

      {/* 3. MODAL DE CONFIGURAÇÃO E DISPARO DE E-MAIL */}
      <EnvioPlanejamentoModal
        open={isEnvioModalOpen}
        onOpenChange={setIsEnvioModalOpen}
        unidadeId={selectedUnidadeId}
        unidadeNome={unidadeNome}
        inicioSemana={inicioSemana}
        fimSemana={fimSemana}
        diasDaSemana={diasDaSemana}
        equipes={equipes}
        metricas={metricas}
        alojamentos={alojamentos}
        ultimaAtualizacao={ultimaAtualizacao}
        mapDataGps={mapDataGps}
      />
    </div>
  );
};
