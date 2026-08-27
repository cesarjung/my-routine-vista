import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Mail,
  Send,
  FileText,
  Clock,
  Settings,
  X,
  Plus,
  CheckCircle2,
  FileDown,
  Download,
  AlertCircle,
  Eye
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarioPlanejamento } from './CalendarioPlanejamento';
import { buildPlanejamentoEmailPayload, generatePlanejamentoEmailHtml, EmailBlocosConfig, PlanejamentoEmailPayload } from '@/lib/planejamentoEmail';
import { obterMapaBase64ParaEmail } from '@/lib/geradorMapaEstatico';
import { EquipeSemanalItem, MetricasSemana } from '@/hooks/usePlanejamentoSemanal';
import { usePlanejamentoEmailSettings } from '@/hooks/usePlanejamentoEmailSettings';

export interface EnvioPlanejamentoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unidadeId: string;
  unidadeNome: string;
  inicioSemana: Date;
  fimSemana: Date;
  diasDaSemana: Date[];
  equipes: EquipeSemanalItem[];
  metricas: MetricasSemana;
  alojamentos: Array<{ equipe: string; municipio: string; alojamento: string }>;
  ultimaAtualizacao?: string | null;
}

export const EnvioPlanejamentoModal: React.FC<EnvioPlanejamentoModalProps> = ({
  open,
  onOpenChange,
  unidadeId,
  unidadeNome,
  inicioSemana,
  fimSemana,
  diasDaSemana,
  equipes,
  metricas,
  alojamentos,
  ultimaAtualizacao,
}) => {
  if (!open) return null;

  const { getUnidadeConfig, getUserSignature, smtpConfig } = usePlanejamentoEmailSettings();
  const [isSending, setIsSending] = useState(false);

  const formatSafeDate = (d: any, fmt: string) => {
    try {
      if (d && !isNaN(new Date(d).getTime())) {
        return format(new Date(d), fmt);
      }
    } catch (e) {}
    return '';
  };

  const [modelo, setModelo] = useState<'completo' | 'resumido'>('completo');
  const [assunto, setAssunto] = useState<string>(() => {
    const d1 = formatSafeDate(inicioSemana, 'dd/MM');
    const d2 = formatSafeDate(fimSemana, 'dd/MM/yyyy');
    return d1 && d2 ? `Programação Semanal PCP · ${unidadeNome} · ${d1} a ${d2}` : `Programação Semanal PCP · ${unidadeNome}`;
  });

  // Destinatários (inicializados a partir das configurações da unidade)
  const initialConfig = getUnidadeConfig(unidadeId);
  const [destinatariosPara, setDestinatariosPara] = useState<string[]>(
    initialConfig.destinatariosPara?.length > 0
      ? initialConfig.destinatariosPara
      : ['planejamento.ba@sirtec.com.br', 'supervisao.operacional@sirtec.com.br']
  );
  const [destinatariosCc, setDestinatariosCc] = useState<string[]>(
    initialConfig.destinatariosCc?.length > 0
      ? initialConfig.destinatariosCc
      : ['gerencia.operacoes@sirtec.com.br']
  );
  const [novoParaInput, setNovoParaInput] = useState('');
  const [novoCcInput, setNovoCcInput] = useState('');
  const [isAddingPara, setIsAddingPara] = useState(false);
  const [isAddingCc, setIsAddingCc] = useState(false);

  // Recarrega destinatários padrão se mudar de unidade
  useEffect(() => {
    if (unidadeId) {
      const uConfig = getUnidadeConfig(unidadeId);
      if (uConfig.destinatariosPara?.length > 0) {
        setDestinatariosPara(uConfig.destinatariosPara);
      }
      if (uConfig.destinatariosCc?.length > 0) {
        setDestinatariosCc(uConfig.destinatariosCc);
      }
    }
  }, [unidadeId, getUnidadeConfig]);

  // Blocos do e-mail
  const [blocos, setBlocos] = useState<EmailBlocosConfig>({
    resumo: true,
    calendario: true,
    disponiveis: true,
    alojamentos: true,
    observacoes: true,
    mapa: true,
  });

  // Configurações de Escopo e Densidade
  const [escopo, setEscopo] = useState<'todas' | 'com_programacao'>('todas');
  const [densidade, setDensidade] = useState<'detalhado' | 'compacto'>('detalhado');

  // Observações e IA
  const [observacoes, setObservacoes] = useState<string[]>([
    'Prioridade para frentes de religamento e atendimento a manutenções emergenciais.',
    'Supervisão atenta à programação de deslocamentos que excedem 2h diárias.',
    'Alinhamento com o almoxarifado para entrega antecipada de cabos e estruturas.'
  ]);

  const [mapPosition, setMapPosition] = useState<{ center: [number, number]; zoom: number }>({
    center: [-13.25501, -43.42314],
    zoom: 9,
  });

  const handleAddPara = () => {
    if (novoParaInput.trim() && novoParaInput.includes('@')) {
      setDestinatariosPara(prev => [...prev, novoParaInput.trim().toLowerCase()]);
      setNovoParaInput('');
      setIsAddingPara(false);
    }
  };

  const handleRemovePara = (email: string) => {
    setDestinatariosPara(prev => prev.filter(e => e !== email));
  };

  const handleAddCc = () => {
    if (novoCcInput.trim() && novoCcInput.includes('@')) {
      setDestinatariosCc(prev => [...prev, novoCcInput.trim().toLowerCase()]);
      setNovoCcInput('');
      setIsAddingCc(false);
    }
  };

  const handleRemoveCc = (email: string) => {
    setDestinatariosCc(prev => prev.filter(e => e !== email));
  };

  // Disparo do Envio Real de E-mail
  const handleEnviarPlanejamento = async () => {
    if (destinatariosPara.length === 0) {
      toast.error('Adicione ao menos um destinatário no campo Para.');
      return;
    }

    setIsSending(true);
    const toastId = toast.loading('Conectando ao servidor SMTP e disparando e-mail...');

    try {
      const userSig = getUserSignature();

      const equipesParaMapa = equipes.filter(e => e.temProgramacao).map(eq => {
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
      });

      const labelPeriodo = `Semana de ${format(inicioSemana, 'dd/MM')} a ${format(fimSemana, 'dd/MM/yyyy')}`;
      const mapaImagemBase64 = await obterMapaBase64ParaEmail(
        equipesParaMapa,
        unidadeNome || 'BOM JESUS DA LAPA'
      );

      const payload: PlanejamentoEmailPayload = {
        unidade: unidadeId,
        unidadeNome,
        semana: {
          inicio: format(inicioSemana, 'yyyy-MM-dd'),
          fim: format(fimSemana, 'yyyy-MM-dd'),
          label: labelPeriodo,
        },
        assunto,
        modelo,
        destinatarios: {
          para: destinatariosPara,
          cc: destinatariosCc,
        },
        blocos,
        densidade,
        escopo,
        resumoExecutivo: {
          texto: `A programação da semana prevê um volume planejado de R$ ${metricas.totalPlanejado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} frente à meta global de R$ ${metricas.totalMeta.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${metricas.aderenciaPeriodo}% de aderência geral com ${metricas.totalEquipesGeral || equipes.length} equipes). Considerando apenas as ${metricas.totalEquipesProgramadas || equipes.filter(e => e.temProgramacao).length} equipes com programação ativa (meta de R$ ${(metricas.metaEquipesProgramadas || metricas.totalMeta).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}), a aderência da produção atinge ${metricas.aderenciaEquipesProgramadas || metricas.aderenciaPeriodo}%. A jornada média estimada por turno é de ${Math.floor(metricas.jornadaMediaMin / 60)}h${metricas.jornadaMediaMin % 60 ? (metricas.jornadaMediaMin % 60) + 'm' : ''} e o deslocamento médio semanal é de ${metricas.deslocamentoMedioH.toFixed(1)}h por turno.`,
          destaques: [
            {
              id: 'd1',
              titulo: 'Aderência Financeira e Metas',
              texto: `Aderência Global: ${metricas.aderenciaPeriodo}% (${metricas.totalEquipesGeral || equipes.length} equipes). Aderência das Equipes Programadas: ${metricas.aderenciaEquipesProgramadas || metricas.aderenciaPeriodo}% (${metricas.totalEquipesProgramadas || equipes.filter(e => e.temProgramacao).length} equipes). ${metricas.equipesAcimaMeta} equipes alcançam ≥100% da meta semanal e ${metricas.equipesAbaixoMeta} equipes permanecem com saldo abaixo.`,
              gravidade: metricas.aderenciaPeriodo >= 100 ? 'otimo' : metricas.aderenciaPeriodo >= 80 ? 'atencao' : 'critico',
            },
            {
              id: 'd2',
              titulo: 'Conformidade da Jornada de Trabalho',
              texto: `${metricas.turnosAbaixo8} turnos apresentam previsão inferior a 08:00 e ${metricas.turnosAcima10} turnos ultrapassam o limite de 10:00.`,
              gravidade: metricas.turnosAcima10 === 0 ? 'bom' : 'atencao',
            },
            {
              id: 'd3',
              titulo: 'Tempo de Deslocamento em Trânsito',
              texto: `${metricas.turnosDentroMetaDesloc} turnos operam dentro da meta de deslocamento e ${metricas.turnosAcima2h} turnos demandam mais de 2,0h de trajeto.`,
              gravidade: metricas.turnosAcima2h === 0 ? 'bom' : 'atencao',
            },
            {
              id: 'd4',
              titulo: 'Uso de Alojamentos e Bases',
              texto: `${alojamentos.length} ${alojamentos.length === 1 ? 'alocação registrada' : 'alocações registradas'} no período (${alojamentos.map(a => a.municipio).filter((v, i, arr) => arr.indexOf(v) === i).join(', ') || 'Base Central'}).`,
              gravidade: 'bom',
            },
          ],
        },
        observacoes,
        metricas: {
          planejado: metricas.totalPlanejado,
          meta: metricas.totalMeta,
          aderencia: metricas.aderenciaPeriodo,
          metaEquipesProgramadas: metricas.metaEquipesProgramadas,
          aderenciaEquipesProgramadas: metricas.aderenciaEquipesProgramadas,
          totalEquipesGeral: metricas.totalEquipesGeral,
          totalEquipesProgramadas: metricas.totalEquipesProgramadas,
          totalEquipesSemProgramacao: metricas.totalEquipesSemProgramacao,
          jornadaMediaMin: metricas.jornadaMediaMin,
          deslocamentoMedioH: metricas.deslocamentoMedioH,
          turnosAbaixo8: metricas.turnosAbaixo8,
          turnosAcima10: metricas.turnosAcima10,
          turnosAcima2h: metricas.turnosAcima2h,
          turnosDentroMetaDesloc: metricas.turnosDentroMetaDesloc,
          equipesAcimaMeta: metricas.equipesAcimaMeta,
          equipesAbaixoMeta: metricas.equipesAbaixoMeta,
        },
        equipes: (escopo === 'com_programacao' ? equipes.filter(e => e.temProgramacao) : equipes) as any,
        dias: diasDaSemana.map(d => ({
          data: format(d, 'yyyy-MM-dd'),
          label: format(d, 'dd/MM'),
          diaSemana: format(d, 'EEE', { locale: ptBR }),
        })),
        alojamentos: alojamentos,
        mapa: {
          center: mapPosition.center,
          zoom: mapPosition.zoom,
          imagemBase64: mapaImagemBase64,
        },
        assinatura: {
          tipo: userSig.tipo,
          conteudo: userSig.tipo === 'html' ? userSig.html : userSig.texto,
        },
      };

      const htmlContent = generatePlanejamentoEmailHtml(payload);

      const response = await fetch('/api/enviar-planejamento-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          smtp: smtpConfig,
          destinatarios: payload.destinatarios,
          assunto: payload.assunto,
          html: htmlContent,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Falha no envio via SMTP.');
      }

      toast.success(result.message || 'E-mail de planejamento enviado com sucesso!', { id: toastId });
      onOpenChange(false);
    } catch (err: any) {
      console.error('[PCP] Erro ao enviar e-mail:', err);
      toast.error(err.message || 'Erro ao conectar ou enviar e-mail.', { id: toastId });
    } finally {
      setIsSending(false);
    }
  };

  const handleSalvarRascunho = () => {
    toast.success('Rascunho de envio salvo com sucesso.');
  };

  const handleBaixarPdf = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1420px] w-[95vw] h-[92vh] max-h-[92vh] flex flex-col p-0 gap-0 bg-[#F7F6F3] border border-[#E6E3DD] overflow-hidden z-[200] print:max-w-none print:w-full print:h-auto print:max-h-none print:border-0 print:shadow-none print:bg-white print:p-0 print:m-0 print:static print:overflow-visible">
        {/* Cabeçalho do Modal (Oculto no PDF / Impressão) */}
        <DialogHeader className="p-3 px-5 border-b border-[#E6E3DD] bg-white flex flex-row items-center justify-between shrink-0 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#E07A1F]/10 border border-[#E07A1F]/20 flex items-center justify-center text-[#E07A1F]">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-[#23211E] flex items-center gap-2">
                Envio do Planejamento Semanal
                <span className="text-xs font-mono font-medium text-[#6B6660] bg-[#F2F0EC] px-2 py-0.5 rounded border border-[#DEDAD3]">
                  {unidadeNome}
                </span>
              </DialogTitle>
              <p className="text-xs text-[#6B6660]">
                Configure os destinatários e blocos para disparar a programação da semana por e-mail.
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Grade 298px | 1fr */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-[298px_1fr] overflow-hidden print:block print:w-full print:overflow-visible">
          {/* PAINEL ESQUERDO: CONFIGURAÇÃO DE ENVIO (Oculto no PDF / Impressão) */}
          <aside className="border-r border-[#E6E3DD] bg-[#FAF8F5] flex flex-col justify-between overflow-y-auto p-4 space-y-4 text-xs print:hidden">
            <div className="space-y-4">
              {/* Modelo: Completo vs Resumido */}
              <div className="space-y-1.5">
                <label className="text-[10.5px] uppercase font-bold tracking-wider text-[#6B6660] block">
                  MODELO DO E-MAIL
                </label>
                <div className="grid grid-cols-2 gap-1.5 bg-[#F2F0EC] p-1 rounded-lg border border-[#DEDAD3]">
                  <button
                    type="button"
                    onClick={() => setModelo('completo')}
                    className={`py-1.5 rounded-md text-xs font-bold transition-all text-center ${
                      modelo === 'completo'
                        ? 'bg-white text-[#23211E] shadow-2xs border border-[#DEDAD3]'
                        : 'text-[#6B6660] hover:text-[#23211E]'
                    }`}
                  >
                    Completo
                  </button>
                  <button
                    type="button"
                    onClick={() => setModelo('resumido')}
                    className={`py-1.5 rounded-md text-xs font-bold transition-all text-center ${
                      modelo === 'resumido'
                        ? 'bg-white text-[#23211E] shadow-2xs border border-[#DEDAD3]'
                        : 'text-[#6B6660] hover:text-[#23211E]'
                    }`}
                  >
                    Resumido
                  </button>
                </div>
              </div>

              {/* Assunto */}
              <div className="space-y-1.5">
                <label className="text-[10.5px] uppercase font-bold tracking-wider text-[#6B6660] block">
                  ASSUNTO
                </label>
                <Input
                  value={assunto}
                  onChange={e => setAssunto(e.target.value)}
                  className="h-8 text-xs bg-white border-[#DEDAD3] text-[#23211E] font-medium"
                />
              </div>

              {/* Destinatários: Para */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10.5px] uppercase font-bold tracking-wider text-[#6B6660]">
                    PARA ({destinatariosPara.length})
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsAddingPara(!isAddingPara)}
                    className="text-[10.5px] font-bold text-[#E07A1F] hover:underline flex items-center gap-0.5"
                  >
                    <Plus className="w-3 h-3" /> Adicionar
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5 p-2 bg-white rounded-lg border border-[#DEDAD3] min-h-[42px] max-h-[90px] overflow-y-auto">
                  {destinatariosPara.map(email => (
                    <span
                      key={email}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#F2F0EC] border border-[#DEDAD3] text-[10.5px] font-mono text-[#23211E]"
                    >
                      <span className="truncate max-w-[170px]">{email}</span>
                      <button
                        type="button"
                        onClick={() => handleRemovePara(email)}
                        className="text-[#6B6660] hover:text-[#B03028]"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {isAddingPara && (
                    <div className="flex items-center gap-1 w-full mt-1">
                      <Input
                        type="email"
                        placeholder="email@sirtec.com.br"
                        value={novoParaInput}
                        onChange={e => setNovoParaInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddPara()}
                        className="h-6 text-[11px] px-1.5 py-0 bg-white"
                        autoFocus
                      />
                      <Button size="sm" onClick={handleAddPara} className="h-6 px-2 text-[10px] font-bold bg-[#E07A1F]">
                        OK
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Destinatários: Em Cópia (Cc) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10.5px] uppercase font-bold tracking-wider text-[#6B6660]">
                    EM CÓPIA (CC) ({destinatariosCc.length})
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsAddingCc(!isAddingCc)}
                    className="text-[10.5px] font-bold text-[#E07A1F] hover:underline flex items-center gap-0.5"
                  >
                    <Plus className="w-3 h-3" /> Adicionar
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5 p-2 bg-white rounded-lg border border-[#DEDAD3] min-h-[42px] max-h-[80px] overflow-y-auto">
                  {destinatariosCc.map(email => (
                    <span
                      key={email}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#F2F0EC] border border-[#DEDAD3] text-[10.5px] font-mono text-[#23211E]"
                    >
                      <span className="truncate max-w-[170px]">{email}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveCc(email)}
                        className="text-[#6B6660] hover:text-[#B03028]"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {isAddingCc && (
                    <div className="flex items-center gap-1 w-full mt-1">
                      <Input
                        type="email"
                        placeholder="email@sirtec.com.br"
                        value={novoCcInput}
                        onChange={e => setNovoCcInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddCc()}
                        className="h-6 text-[11px] px-1.5 py-0 bg-white"
                        autoFocus
                      />
                      <Button size="sm" onClick={handleAddCc} className="h-6 px-2 text-[10px] font-bold bg-[#E07A1F]">
                        OK
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Nota sobre Configurações */}
              <div className="p-2.5 rounded-lg bg-white border border-[#DEDAD3] space-y-1">
                <span className="text-[10.5px] text-[#6B6660] block leading-tight">
                  Lista carregada do cadastro da unidade em Configurações.
                </span>
                <a
                  href="#configuracoes"
                  onClick={e => {
                    e.preventDefault();
                    toast.info('Acesse Configurações → Envio de planejamento para gerenciar remetentes e credenciais.');
                  }}
                  className="text-[11px] font-bold text-[#E07A1F] hover:underline flex items-center gap-1"
                >
                  <Settings className="w-3 h-3" /> Configurações → Envio de planejamento
                </a>
              </div>

              {/* Blocos do e-mail (Switches) */}
              <div className="space-y-2 pt-2 border-t border-[#E6E3DD]">
                <label className="text-[10.5px] uppercase font-bold tracking-wider text-[#6B6660] block">
                  BLOCOS DO E-MAIL
                </label>

                <div className="space-y-2 bg-white p-3 rounded-lg border border-[#DEDAD3]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[#23211E]">Resumo executivo</span>
                    <Switch
                      checked={blocos.resumo}
                      onCheckedChange={v => setBlocos(p => ({ ...p, resumo: v }))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[#23211E]">Calendário por equipe</span>
                    <Switch
                      checked={blocos.calendario}
                      onCheckedChange={v => setBlocos(p => ({ ...p, calendario: v }))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[#23211E]">Alojamentos</span>
                    <Switch
                      checked={blocos.alojamentos}
                      onCheckedChange={v => setBlocos(p => ({ ...p, alojamentos: v }))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[#23211E]">Observações do planejador</span>
                    <Switch
                      checked={blocos.observacoes}
                      onCheckedChange={v => setBlocos(p => ({ ...p, observacoes: v }))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[#23211E]">Mapa de deslocamentos</span>
                    <Switch
                      checked={blocos.mapa}
                      onCheckedChange={v => setBlocos(p => ({ ...p, mapa: v }))}
                    />
                  </div>
                </div>
              </div>

              {/* Envio Automático (Gancho) */}
              <div className="p-3 rounded-lg bg-white border border-[#DEDAD3] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10.5px] uppercase font-bold tracking-wider text-[#6B6660]">
                    ENVIO AUTOMÁTICO
                  </span>
                  <span className="px-2 py-0.5 rounded bg-[#F2F0EC] border border-[#DEDAD3] text-[9.5px] font-bold text-[#A39E96]">
                    Inativo
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-[#23211E] font-medium">
                  <Clock className="w-3.5 h-3.5 text-[#E07A1F]" />
                  <span>Sexta, 07:30</span>
                </div>
                <p className="text-[10px] text-[#A39E96]">
                  Configure o agendamento em Configurações.
                </p>
              </div>
            </div>

            {/* Rodapé Fixo da Coluna Esquerda */}
            <div className="space-y-2 pt-3 border-t border-[#E6E3DD]">
              <Button
                onClick={handleEnviarPlanejamento}
                disabled={isSending}
                className="w-full h-9 text-xs font-bold bg-[#E07A1F] text-white hover:bg-[#E07A1F]/90 gap-1.5 shadow-2xs"
              >
                {isSending ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Enviando e-mail...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" /> Enviar planejamento
                  </>
                )}
              </Button>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  onClick={handleSalvarRascunho}
                  className="h-8 text-xs font-semibold bg-white border-[#DEDAD3] text-[#5C574F] hover:text-[#23211E]"
                >
                  Salvar rascunho
                </Button>
                <Button
                  variant="outline"
                  onClick={handleBaixarPdf}
                  className="h-8 text-xs font-semibold bg-white border-[#DEDAD3] text-[#5C574F] hover:text-[#23211E] gap-1"
                >
                  <FileDown className="w-3.5 h-3.5" /> Baixar PDF
                </Button>
              </div>
            </div>
          </aside>

          {/* PAINEL DIREITO: PRÉVIA DO CORPO DO E-MAIL (CalendarioPlanejamento modo='envio') */}
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-[#F7F6F3] print:p-0 print:m-0 print:overflow-visible print:bg-white print:w-full">
            <CalendarioPlanejamento
              modo="envio"
              unidadeId={unidadeId}
              unidadeNome={unidadeNome}
              inicioSemana={inicioSemana}
              fimSemana={fimSemana}
              diasDaSemana={diasDaSemana}
              equipes={equipes}
              metricas={metricas}
              alojamentos={alojamentos}
              ultimaAtualizacao={ultimaAtualizacao}
              escopo={escopo}
              setEscopo={setEscopo}
              densidade={densidade}
              setDensidade={setDensidade}
              blocos={blocos}
              observacoes={observacoes}
              onUpdateObservacoes={setObservacoes}
              onMapPositionChange={(center, zoom) => setMapPosition({ center, zoom })}
            />
          </main>
        </div>
      </DialogContent>
    </Dialog>
  );
};
