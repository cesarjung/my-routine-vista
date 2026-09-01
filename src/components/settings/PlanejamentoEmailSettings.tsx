import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Mail,
  Server,
  Lock,
  Plus,
  X,
  Info,
  CheckCircle2,
  Building2,
  Send,
  Eye,
  EyeOff,
  PenTool,
  Phone,
  Briefcase,
  User,
  Sparkles,
  Code2,
  Copy,
  Save,
} from 'lucide-react';
import { UNIDADES_PLANEJAMENTO, UnidadePlanejamento } from '@/constants/unidades';
import {
  usePlanejamentoEmailSettings,
  SmtpConfig,
  UserSignatureConfig,
  generateOfficialHtmlSignature,
  generateOfficialTextSignature,
  DEFAULT_SMTP_CONFIG,
} from '@/hooks/usePlanejamentoEmailSettings';
import { useAuth } from '@/contexts/AuthContext';
import { useProfiles } from '@/hooks/useProfiles';
import { useUnits } from '@/hooks/useUnits';
import { useUnitManagers } from '@/hooks/useUnitManagers';
import { useUserRole } from '@/hooks/useUserRole';

interface PlanejamentoEmailSettingsProps {
  isAdmin?: boolean;
  isGestor?: boolean;
  userUnitId?: string | null;
  userManagedUnits?: string[];
  userId?: string;
}

export const PlanejamentoEmailSettings: React.FC<PlanejamentoEmailSettingsProps> = ({
  isAdmin = false,
  isGestor = false,
  userUnitId,
  userManagedUnits = [],
  userId,
}) => {
  const { user } = useAuth();
  const activeUserId = userId || user?.id;
  const { data: profiles } = useProfiles();
  const currentProfile = profiles?.find(p => p.id === activeUserId);

  const {
    config,
    saveSmtpConfig,
    saveUnidadeConfig,
    getUnidadeConfig,
    getUserSignature,
    saveUserSignature,
  } = usePlanejamentoEmailSettings();

  const { data: units } = useUnits();
  const { data: unitManagers } = useUnitManagers();
  const { data: userRole } = useUserRole();

  const isGestorOrAdmin = isAdmin || isGestor || userRole === 'admin' || userRole === 'gestor' || currentProfile?.role === 'admin' || currentProfile?.role === 'gestor';
  const canManageAllUnits = isGestorOrAdmin;

  const normalizeUnitText = (str: string) =>
    (str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .trim();

  // 1. Filtrar unidades estritamente conforme permissão do usuário logado
  const allowedUnits: UnidadePlanejamento[] = useMemo(() => {
    // Gestor ou Administrador: tem acesso a TODAS as unidades
    if (isGestorOrAdmin) {
      return UNIDADES_PLANEJAMENTO;
    }

    // Usuário comum: apenas unidades associadas explicitamente no perfil ou em unit_managers
    const userUnitIds = new Set<string>();
    if (currentProfile?.unit_id) userUnitIds.add(currentProfile.unit_id);
    if (userUnitId) userUnitIds.add(userUnitId);
    
    if (userManagedUnits && userManagedUnits.length > 0) {
      userManagedUnits.forEach(id => userUnitIds.add(id));
    }
    if (unitManagers && activeUserId) {
      unitManagers.filter(m => m.user_id === activeUserId).forEach(m => userUnitIds.add(m.unit_id));
    }

    // Mapeia os UUIDs da tabela units ou strings para os nomes normalizados
    const allowedNamesNormalized = new Set<string>();
    userUnitIds.forEach(idOrName => {
      if (!idOrName) return;
      const foundInUnitsTable = units?.find(
        u => u.id === idOrName || normalizeUnitText(u.name) === normalizeUnitText(idOrName)
      );
      if (foundInUnitsTable) {
        allowedNamesNormalized.add(normalizeUnitText(foundInUnitsTable.name));
      }
      allowedNamesNormalized.add(normalizeUnitText(idOrName));
    });

    // Filtra as UNIDADES_PLANEJAMENTO que batem por ID ou por Nome normalizado
    const allowed = UNIDADES_PLANEJAMENTO.filter(u => {
      const uNomeNorm = normalizeUnitText(u.nome);
      const matchName = allowedNamesNormalized.has(uNomeNorm);
      const matchId = userUnitIds.has(u.id);
      return matchName || matchId;
    });

    // Retorna as unidades autorizadas (se ainda carregando ou nenhuma, retorna vazio ou primeira se gestor)
    return allowed;
  }, [isGestorOrAdmin, currentProfile?.unit_id, userUnitId, userManagedUnits, unitManagers, activeUserId, units]);

  // Unidade atualmente selecionada no dropdown
  const [selectedUnidadeId, setSelectedUnidadeId] = useState<string>(
    allowedUnits[0]?.id || UNIDADES_PLANEJAMENTO[0]?.id
  );

  // Garantir que selectedUnidadeId permaneça válido dentro das allowedUnits
  useEffect(() => {
    if (allowedUnits.length > 0 && !allowedUnits.some(u => u.id === selectedUnidadeId)) {
      setSelectedUnidadeId(allowedUnits[0].id);
    }
  }, [allowedUnits, selectedUnidadeId]);

  // ════════════════════════════════════════════════════════════════
  // 1. ESTADOS DA ASSINATURA INDIVIDUAL
  // ════════════════════════════════════════════════════════════════
  const initialSig = getUserSignature(activeUserId, currentProfile);
  const [sigNome, setSigNome] = useState(initialSig.nome || currentProfile?.full_name || 'Sirtec PCP');
  const [sigCargo, setSigCargo] = useState(initialSig.cargo || 'Planejamento Operacional - PCP');
  const [sigCelular, setSigCelular] = useState(initialSig.celular || '(77) 99999-9999');
  const [sigTipo, setSigTipo] = useState<'html' | 'texto'>(initialSig.tipo || 'html');
  const [showHtmlCode, setShowHtmlCode] = useState(false);
  const [isSavingSignature, setIsSavingSignature] = useState(false);

  // Sincroniza campos quando o usuário logado mudar
  useEffect(() => {
    const s = getUserSignature(activeUserId, currentProfile);
    setSigNome(s.nome || currentProfile?.full_name || 'Sirtec PCP');
    setSigCargo(s.cargo || 'Planejamento Operacional - PCP');
    setSigCelular(s.celular || '(77) 99999-9999');
    setSigTipo(s.tipo || 'html');
  }, [activeUserId, currentProfile, getUserSignature]);

  // HTML e texto gerados em tempo real a partir dos 3 campos
  const previewHtml = useMemo(() => {
    return generateOfficialHtmlSignature(sigNome, sigCargo, sigCelular);
  }, [sigNome, sigCargo, sigCelular]);

  const previewTexto = useMemo(() => {
    return generateOfficialTextSignature(sigNome, sigCargo, sigCelular);
  }, [sigNome, sigCargo, sigCelular]);

  const handleSaveSignature = () => {
    if (!sigNome.trim()) {
      toast.error('Informe seu Nome para a assinatura.');
      return;
    }
    setIsSavingSignature(true);
    saveUserSignature({
      tipo: sigTipo,
      nome: sigNome.trim(),
      cargo: sigCargo.trim(),
      celular: sigCelular.trim(),
      html: previewHtml,
      texto: previewTexto,
    }, activeUserId);

    setTimeout(() => {
      setIsSavingSignature(false);
      toast.success('Assinatura salva com sucesso para o seu usuário!');
    }, 200);
  };

  const handleCopyHtml = () => {
    navigator.clipboard.writeText(previewHtml);
    toast.success('Código HTML copiado para a área de transferência!');
  };

  // ════════════════════════════════════════════════════════════════
  // 2. ESTADOS DO SERVIDOR SMTP
  // ════════════════════════════════════════════════════════════════
  const [smtpForm, setSmtpForm] = useState<SmtpConfig>(config.smtp || DEFAULT_SMTP_CONFIG);
  const [showPassword, setShowPassword] = useState(false);
  const [isSavingSmtp, setIsSavingSmtp] = useState(false);

  useEffect(() => {
    setSmtpForm(config.smtp || DEFAULT_SMTP_CONFIG);
  }, [config.smtp]);

  const handleSaveSmtp = () => {
    if (!canManageAllUnits) {
      toast.error('Apenas Administradores e Gestores podem alterar as configurações do Servidor SMTP.');
      return;
    }
    if (!smtpForm.host || !smtpForm.user) {
      toast.error('Preencha o servidor e usuário do e-mail.');
      return;
    }
    setIsSavingSmtp(true);
    saveSmtpConfig(smtpForm);
    setTimeout(() => {
      setIsSavingSmtp(false);
      toast.success('Configurações SMTP salvas com sucesso!');
    }, 200);
  };

  // ════════════════════════════════════════════════════════════════
  // 3. ESTADOS DOS DESTINATÁRIOS POR UNIDADE (POR USUÁRIO)
  // ════════════════════════════════════════════════════════════════
  const [destPara, setDestPara] = useState<string[]>([]);
  const [destCc, setDestCc] = useState<string[]>([]);
  const [assuntoTemplate, setAssuntoTemplate] = useState<string>('');
  const [novoPara, setNovoPara] = useState<string>('');
  const [novoCc, setNovoCc] = useState<string>('');
  const [isSavingUnidade, setIsSavingUnidade] = useState(false);

  useEffect(() => {
    if (selectedUnidadeId) {
      const uConfig = getUnidadeConfig(selectedUnidadeId, activeUserId);
      setDestPara(uConfig.destinatariosPara || []);
      setDestCc(uConfig.destinatariosCc || []);
      setAssuntoTemplate(uConfig.assuntoTemplate || 'Programação Semanal PCP · {unidade} · {periodo}');
    }
  }, [selectedUnidadeId, activeUserId, getUnidadeConfig]);

  const handleAddPara = () => {
    const email = novoPara.trim().toLowerCase();
    if (!email) return;
    if (!email.includes('@') || !email.includes('.')) {
      toast.error('Digite um endereço de e-mail válido.');
      return;
    }
    if (destPara.includes(email)) {
      toast.info('Este e-mail já está na lista.');
      return;
    }
    setDestPara(prev => [...prev, email]);
    setNovoPara('');
  };

  const handleAddCc = () => {
    const email = novoCc.trim().toLowerCase();
    if (!email) return;
    if (!email.includes('@') || !email.includes('.')) {
      toast.error('Digite um endereço de e-mail válido.');
      return;
    }
    if (destCc.includes(email)) {
      toast.info('Este e-mail já está em cópia.');
      return;
    }
    setDestCc(prev => [...prev, email]);
    setNovoCc('');
  };

  const handleRemovePara = (email: string) => {
    setDestPara(prev => prev.filter(e => e !== email));
  };

  const handleRemoveCc = (email: string) => {
    setDestCc(prev => prev.filter(e => e !== email));
  };

  const handleSaveUnidade = () => {
    if (!selectedUnidadeId) return;
    setIsSavingUnidade(true);
    saveUnidadeConfig(
      selectedUnidadeId,
      {
        destinatariosPara: destPara,
        destinatariosCc: destCc,
        assuntoTemplate: assuntoTemplate.trim(),
      },
      activeUserId
    );
    setTimeout(() => {
      setIsSavingUnidade(false);
      const unitObj = UNIDADES_PLANEJAMENTO.find(u => u.id === selectedUnidadeId);
      toast.success(`Destinatários salvos para seu usuário na unidade ${unitObj?.nome || ''}!`);
    }, 200);
  };

  // ════════════════════════════════════════════════════════════════
  // 4. SALVAR TODAS AS CONFIGURAÇÕES DE UMA SÓ VEZ
  // ════════════════════════════════════════════════════════════════
  const [isSavingAll, setIsSavingAll] = useState(false);

  const handleSaveAll = () => {
    setIsSavingAll(true);

    // 1. Salva assinatura
    saveUserSignature({
      tipo: sigTipo,
      nome: sigNome.trim(),
      cargo: sigCargo.trim(),
      celular: sigCelular.trim(),
      html: previewHtml,
      texto: previewTexto,
    }, activeUserId);

    // 2. Salva SMTP se for Admin/Gestor
    if (canManageAllUnits && smtpForm.host && smtpForm.user) {
      saveSmtpConfig(smtpForm);
    }

    // 3. Salva unidade ativa
    if (selectedUnidadeId) {
      saveUnidadeConfig(
        selectedUnidadeId,
        {
          destinatariosPara: destPara,
          destinatariosCc: destCc,
          assuntoTemplate: assuntoTemplate.trim(),
        },
        activeUserId
      );
    }

    setTimeout(() => {
      setIsSavingAll(false);
      toast.success('Todas as configurações de envio foram salvas com sucesso!');
    }, 300);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-20">
      {/* Header com identificação do usuário logado */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 rounded-xl border bg-card shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-[#1E293B] text-white shadow-sm">
            <Mail className="w-6 h-6 text-[#E07A1F]" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              Configurações de Envio de Planejamento
              <Badge variant="outline" className="text-xs bg-[#E07A1F]/10 text-[#E07A1F] border-[#E07A1F]/30">
                PCP Operacional
              </Badge>
            </h2>
            <p className="text-xs text-muted-foreground">
              Configure sua assinatura corporativa, servidor de e-mail e os destinatários específicos para suas unidades autorizadas.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-muted/80 px-3 py-1.5 rounded-lg border text-xs">
          <User className="w-4 h-4 text-muted-foreground" />
          <span className="text-muted-foreground">Usuário ativo:</span>
          <span className="font-semibold text-foreground">
            {currentProfile?.full_name || user?.email || 'Usuário'}
          </span>
          {canManageAllUnits ? (
            <Badge className="bg-emerald-600 text-white text-[10px] h-5">Administrador / Gestor</Badge>
          ) : (
            <Badge variant="secondary" className="text-[10px] h-5">Operador</Badge>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* 1. ASSINATURA DE E-MAIL (COM CAMPOS E PREVIEW EM TEMPO REAL)   */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <Card className="border shadow-sm bg-card">
        <CardHeader className="pb-3 border-b bg-muted/30">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <PenTool className="w-5 h-5 text-[#E07A1F]" />
              <div>
                <CardTitle className="text-base font-bold">Assinatura Corporativa de E-mail</CardTitle>
                <CardDescription className="text-xs">
                  O layout visual segue o padrão institucional Sirtec. Preencha seus dados para atualizar sua assinatura automaticamente.
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5 font-medium border-border"
                onClick={() => setShowHtmlCode(!showHtmlCode)}
              >
                <Code2 className="w-3.5 h-3.5" />
                {showHtmlCode ? 'Ocultar HTML' : 'Ver Código HTML'}
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-8 bg-[#E07A1F] hover:bg-[#C96815] text-white font-semibold text-xs gap-1.5 shadow-sm"
                onClick={handleSaveSignature}
                disabled={isSavingSignature}
              >
                <Save className="w-3.5 h-3.5" />
                {isSavingSignature ? 'Salvando...' : 'Salvar Assinatura'}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-5 space-y-5">
          {/* Campos de Dados da Assinatura */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-[#E07A1F]" />
                Nome Completo *
              </Label>
              <Input
                placeholder="Ex: Cesar Jung"
                value={sigNome}
                onChange={(e) => setSigNome(e.target.value)}
                className="h-9 text-sm bg-background"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-[#E07A1F]" />
                Cargo / Função *
              </Label>
              <Input
                placeholder="Ex: Coordenador de PCP - CCM"
                value={sigCargo}
                onChange={(e) => setSigCargo(e.target.value)}
                className="h-9 text-sm bg-background"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-[#E07A1F]" />
                Celular / WhatsApp *
              </Label>
              <Input
                placeholder="Ex: (55) 99708-7985"
                value={sigCelular}
                onChange={(e) => setSigCelular(e.target.value)}
                className="h-9 text-sm bg-background"
              />
            </div>
          </div>

          {/* Visualizador de Código HTML (Opcional) */}
          {showHtmlCode && (
            <div className="p-3 bg-muted/40 rounded-lg border space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                <span>Código HTML Oficial (Gerado Automaticamente)</span>
                <Button variant="ghost" size="sm" className="h-6 text-[11px] gap-1" onClick={handleCopyHtml}>
                  <Copy className="w-3 h-3" />
                  Copiar HTML
                </Button>
              </div>
              <pre className="text-[11px] font-mono bg-background p-3 rounded border overflow-x-auto max-h-36 whitespace-pre-wrap text-muted-foreground">
                {previewHtml}
              </pre>
            </div>
          )}

          {/* Pré-visualização Visual Realista da Assinatura */}
          <div className="p-4 rounded-xl border bg-white shadow-xs">
            <div className="flex items-center justify-between pb-2 mb-3 border-b text-[11px] font-semibold text-slate-500">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#E07A1F]" />
                Pré-visualização da Assinatura no E-mail
              </span>
              <Badge variant="outline" className="text-[10px] text-emerald-700 bg-emerald-50 border-emerald-200">
                Padrão Institucional Sirtec
              </Badge>
            </div>

            <div
              className="prose prose-sm max-w-none text-slate-900"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>
        </CardContent>
      </Card>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* 2. SERVIDOR DE ENVIO SMTP (PADRÃO SIRTEC · BLOQUEADO P/ COMUM) */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <Card className="border shadow-sm bg-card">
        <CardHeader className="pb-3 border-b bg-muted/30">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Server className="w-5 h-5 text-[#E07A1F]" />
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  Servidor de Envio (SMTP)
                  <Badge variant="outline" className="text-[11px] bg-slate-100 text-slate-800 border-slate-300">
                    smtp.sirtec.com.br : 587 · STARTTLS
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs">
                  {canManageAllUnits
                    ? 'Configuração corporativa global do servidor de disparo de e-mails.'
                    : 'Servidor corporativo padrão configurado e gerenciado por Administradores e Gestores.'}
                </CardDescription>
              </div>
            </div>

            {canManageAllUnits ? (
              <Button
                type="button"
                size="sm"
                className="h-8 bg-[#1E293B] hover:bg-[#0F172A] text-white font-semibold text-xs gap-1.5 shadow-sm"
                onClick={handleSaveSmtp}
                disabled={isSavingSmtp}
              >
                <Save className="w-3.5 h-3.5" />
                {isSavingSmtp ? 'Salvando...' : 'Salvar Servidor SMTP'}
              </Button>
            ) : (
              <Badge variant="secondary" className="flex items-center gap-1.5 text-xs py-1 px-2.5 bg-muted">
                <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                Configuração Protegida
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="pt-5 space-y-4">
          {!canManageAllUnits && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-xs flex items-center gap-2.5">
              <Info className="w-4 h-4 text-blue-600 shrink-0" />
              <span>
                O envio utiliza o servidor padrão <b>smtp.sirtec.com.br (Porta 587 com STARTTLS)</b>. Apenas Administradores e Gestores possuem permissão para alterar esses parâmetros.
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Servidor SMTP (Host)</Label>
              <Input
                value={smtpForm.host}
                onChange={(e) => setSmtpForm(prev => ({ ...prev, host: e.target.value }))}
                disabled={!canManageAllUnits}
                placeholder="smtp.sirtec.com.br"
                className="h-9 text-sm disabled:opacity-80 disabled:bg-muted/50 bg-background"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Porta</Label>
              <Input
                type="number"
                value={smtpForm.port}
                onChange={(e) => setSmtpForm(prev => ({ ...prev, port: parseInt(e.target.value, 10) || 587 }))}
                disabled={!canManageAllUnits}
                className="h-9 text-sm disabled:opacity-80 disabled:bg-muted/50 bg-background"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Criptografia / Segurança</Label>
              <Select
                value={smtpForm.secure}
                onValueChange={(val: any) => setSmtpForm(prev => ({ ...prev, secure: val }))}
                disabled={!canManageAllUnits}
              >
                <SelectTrigger className="h-9 text-sm disabled:opacity-80 disabled:bg-muted/50 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tls">STARTTLS (Porta 587 - Padrão)</SelectItem>
                  <SelectItem value="ssl">SSL / TLS Direto (Porta 465)</SelectItem>
                  <SelectItem value="none">Nenhuma (Porta 25)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Nome do Remetente</Label>
              <Input
                value={smtpForm.senderName}
                onChange={(e) => setSmtpForm(prev => ({ ...prev, senderName: e.target.value }))}
                disabled={!canManageAllUnits}
                placeholder="Sirtec PCP · Planejamento"
                className="h-9 text-sm disabled:opacity-80 disabled:bg-muted/50 bg-background"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs font-semibold">E-mail do Remetente / Usuário SMTP</Label>
              <Input
                type="email"
                value={smtpForm.user}
                onChange={(e) => setSmtpForm(prev => ({ ...prev, user: e.target.value, fromEmail: e.target.value }))}
                disabled={!canManageAllUnits}
                placeholder="planejamento.ba@sirtec.com.br"
                className="h-9 text-sm disabled:opacity-80 disabled:bg-muted/50 bg-background"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs font-semibold">Senha / Senha de Aplicativo</Label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={smtpForm.password || ''}
                  onChange={(e) => setSmtpForm(prev => ({ ...prev, password: e.target.value }))}
                  disabled={!canManageAllUnits}
                  placeholder="••••••••••••"
                  className="h-9 text-sm pr-10 disabled:opacity-80 disabled:bg-muted/50 bg-background"
                />
                {canManageAllUnits && (
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* 3. DESTINATÁRIOS POR UNIDADE (INDIVIDUAL POR USUÁRIO + UNIDADE)*/}
      {/* ════════════════════════════════════════════════════════════════ */}
      <Card className="border shadow-sm bg-card">
        <CardHeader className="pb-3 border-b bg-muted/30">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#E07A1F]" />
              <div>
                <CardTitle className="text-base font-bold">Destinatários por Unidade</CardTitle>
                <CardDescription className="text-xs">
                  Configuração salva individualmente para o seu login. Cada usuário mantém seus destinatários para a unidade selecionada.
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="w-full md:w-64">
                <Select value={selectedUnidadeId} onValueChange={setSelectedUnidadeId}>
                  <SelectTrigger className="h-9 text-xs font-semibold bg-background border-border shadow-xs">
                    <SelectValue placeholder="Selecione a Unidade" />
                  </SelectTrigger>
                  <SelectContent>
                    {allowedUnits.map(u => (
                      <SelectItem key={u.id} value={u.id} className="text-xs font-medium">
                        {u.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                type="button"
                size="sm"
                className="h-9 bg-[#E07A1F] hover:bg-[#C96815] text-white font-semibold text-xs gap-1.5 whitespace-nowrap shadow-sm"
                onClick={handleSaveUnidade}
                disabled={isSavingUnidade || !selectedUnidadeId}
              >
                <Save className="w-3.5 h-3.5" />
                {isSavingUnidade ? 'Salvando...' : 'Salvar Unidade'}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-5 space-y-5">
          {/* Alerta de Escopo de Usuário */}
          <div className="p-3 bg-muted/50 rounded-lg border text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span className="text-muted-foreground">
                Editando lista de envio de <b>{currentProfile?.full_name || user?.email || 'Seu Usuário'}</b> para a unidade <b>{allowedUnits.find(u => u.id === selectedUnidadeId)?.nome || selectedUnidadeId}</b>.
              </span>
            </div>
            <Badge variant="outline" className="text-[10px] bg-background">
              Multi-usuário Ativo
            </Badge>
          </div>

          {/* Destinatários PARA */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold flex items-center gap-2">
              <span>Destinatários Principais (Para)</span>
              <Badge variant="secondary" className="text-[10px] h-4 font-normal">
                {destPara.length} {destPara.length === 1 ? 'e-mail' : 'e-mails'}
              </Badge>
            </Label>
            
            <div className="flex flex-wrap gap-1.5 p-2.5 rounded-lg border bg-background min-h-[44px]">
              {destPara.length === 0 ? (
                <span className="text-xs text-muted-foreground italic self-center px-1">
                  Nenhum destinatário principal adicionado.
                </span>
              ) : (
                destPara.map(email => (
                  <Badge
                    key={email}
                    variant="secondary"
                    className="gap-1.5 py-1 px-2.5 text-xs bg-[#E07A1F]/10 text-foreground hover:bg-[#E07A1F]/20 border border-[#E07A1F]/30"
                  >
                    <span>{email}</span>
                    <button
                      type="button"
                      onClick={() => handleRemovePara(email)}
                      className="text-muted-foreground hover:text-red-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))
              )}
            </div>

            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="Adicionar e-mail para envio principal (ex: supervisor@sirtec.com.br)"
                value={novoPara}
                onChange={(e) => setNovoPara(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddPara())}
                className="h-9 text-xs bg-background"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddPara}
                className="h-9 text-xs gap-1 font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar
              </Button>
            </div>
          </div>

          {/* Destinatários CC (Em Cópia) */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold flex items-center gap-2">
              <span>Destinatários em Cópia (Cc)</span>
              <Badge variant="secondary" className="text-[10px] h-4 font-normal">
                {destCc.length} {destCc.length === 1 ? 'e-mail' : 'e-mails'}
              </Badge>
            </Label>
            
            <div className="flex flex-wrap gap-1.5 p-2.5 rounded-lg border bg-background min-h-[44px]">
              {destCc.length === 0 ? (
                <span className="text-xs text-muted-foreground italic self-center px-1">
                  Nenhum destinatário em cópia adicionado.
                </span>
              ) : (
                destCc.map(email => (
                  <Badge
                    key={email}
                    variant="secondary"
                    className="gap-1.5 py-1 px-2.5 text-xs bg-muted text-foreground hover:bg-muted/80 border"
                  >
                    <span>{email}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveCc(email)}
                      className="text-muted-foreground hover:text-red-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))
              )}
            </div>

            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="Adicionar e-mail em cópia (ex: gerencia@sirtec.com.br)"
                value={novoCc}
                onChange={(e) => setNovoCc(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCc())}
                className="h-9 text-xs bg-background"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddCc}
                className="h-9 text-xs gap-1 font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar
              </Button>
            </div>
          </div>

          {/* Modelo de Assunto */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Modelo de Assunto do E-mail</Label>
            <Input
              value={assuntoTemplate}
              onChange={(e) => setAssuntoTemplate(e.target.value)}
              placeholder="Programação Semanal PCP · {unidade} · {periodo}"
              className="h-9 text-xs bg-background"
            />
            <p className="text-[11px] text-muted-foreground">
              Variáveis disponíveis: <code className="bg-muted px-1 py-0.5 rounded text-[10px]">{'{unidade}'}</code> e <code className="bg-muted px-1 py-0.5 rounded text-[10px]">{'{periodo}'}</code>.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ════════════════════════════════════════════════════════════════ */}
      {/* 4. BARRA DE AÇÃO FIXA / DESTAQUE: SALVAR TODAS AS CONFIGURAÇÕES  */}
      {/* ════════════════════════════════════════════════════════════════ */}
      <div className="p-4 rounded-xl border bg-card shadow-md flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[#E07A1F]/10 text-[#E07A1F]">
            <Save className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-foreground">Salvar Todas as Configurações de Envio</h4>
            <p className="text-xs text-muted-foreground">
              Grava sua assinatura, o servidor SMTP e os destinatários da unidade atual de uma só vez.
            </p>
          </div>
        </div>

        <Button
          type="button"
          onClick={handleSaveAll}
          disabled={isSavingAll}
          className="w-full sm:w-auto h-11 px-8 bg-[#E07A1F] hover:bg-[#C96815] text-white font-bold text-sm shadow-md gap-2 cursor-pointer"
        >
          <CheckCircle2 className="w-4 h-4" />
          {isSavingAll ? 'Salvando Configurações...' : 'Salvar Todas as Configurações'}
        </Button>
      </div>
    </div>
  );
};
