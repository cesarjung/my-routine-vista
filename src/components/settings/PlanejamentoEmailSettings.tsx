import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import {
  Mail,
  Server,
  Shield,
  ShieldAlert,
  Lock,
  Eye,
  EyeOff,
  Plus,
  X,
  Info,
  CheckCircle2,
  Building2,
  Send,
  HelpCircle,
  Users,
  FileCode,
  Sparkles,
  PenTool,
  RotateCcw
} from 'lucide-react';
import { UNIDADES_PLANEJAMENTO, UnidadePlanejamento } from '@/constants/unidades';
import {
  usePlanejamentoEmailSettings,
  SmtpConfig,
  UnidadeEmailConfig,
  UserSignatureConfig,
  DEFAULT_SMTP_CONFIG,
  DEFAULT_THUNDERBIRD_HTML_SIGNATURE,
  DEFAULT_TEXT_SIGNATURE,
  DEFAULT_USER_SIGNATURE
} from '@/hooks/usePlanejamentoEmailSettings';

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
  const {
    config,
    saveSmtpConfig,
    saveUnidadeConfig,
    getUnidadeConfig,
    getUserSignature,
    saveUserSignature,
  } = usePlanejamentoEmailSettings();

  const canManageAllUnits = isAdmin || isGestor;

  // Determinar unidades acessíveis pelo usuário
  const allowedUnits: UnidadePlanejamento[] = React.useMemo(() => {
    if (canManageAllUnits) {
      return UNIDADES_PLANEJAMENTO;
    }
    // Usuário nível comum: apenas unidades atribuídas a si
    const allowed = UNIDADES_PLANEJAMENTO.filter(u => {
      const matchId = u.id === userUnitId || userManagedUnits.includes(u.id);
      const matchName = userUnitId && u.nome.toLowerCase().includes(userUnitId.toLowerCase());
      return matchId || matchName;
    });

    // Se nenhuma bateu explicitamente, permite a primeira unidade ou todas em modo leitura
    return allowed.length > 0 ? allowed : [UNIDADES_PLANEJAMENTO[0]];
  }, [canManageAllUnits, userUnitId, userManagedUnits]);

  // Unidade atualmente selecionada para edição de destinatários
  const [selectedUnidadeId, setSelectedUnidadeId] = useState<string>(
    allowedUnits[0]?.id || UNIDADES_PLANEJAMENTO[0]?.id
  );

  // Estados locais do SMTP
  const [smtpForm, setSmtpForm] = useState<SmtpConfig>(config.smtp);
  const [showPassword, setShowPassword] = useState(false);
  const [isSavingSmtp, setIsSavingSmtp] = useState(false);

  // Estados locais da Unidade Selecionada
  const [destPara, setDestPara] = useState<string[]>([]);
  const [destCc, setDestCc] = useState<string[]>([]);
  const [assuntoTemplate, setAssuntoTemplate] = useState<string>('');
  const [novoPara, setNovoPara] = useState<string>('');
  const [novoCc, setNovoCc] = useState<string>('');
  const [isSavingUnidade, setIsSavingUnidade] = useState(false);

  // Estados locais da Assinatura do Usuário
  const [signatureForm, setSignatureForm] = useState<UserSignatureConfig>(() => getUserSignature(userId));
  const [isSavingSignature, setIsSavingSignature] = useState(false);

  // Sincroniza formulário SMTP quando a configuração carregar
  useEffect(() => {
    setSmtpForm(config.smtp);
  }, [config.smtp]);

  // Sincroniza assinatura quando o usuário mudar
  useEffect(() => {
    setSignatureForm(getUserSignature(userId));
  }, [userId, getUserSignature]);

  // Sincroniza dados da unidade quando a unidade selecionada mudar
  useEffect(() => {
    if (selectedUnidadeId) {
      const uConfig = getUnidadeConfig(selectedUnidadeId);
      setDestPara(uConfig.destinatariosPara || []);
      setDestCc(uConfig.destinatariosCc || []);
      setAssuntoTemplate(uConfig.assuntoTemplate || 'Programação Semanal PCP · {unidade} · {periodo}');
    }
  }, [selectedUnidadeId, getUnidadeConfig]);

  // Adicionar destinatário Para
  const handleAddPara = () => {
    const email = novoPara.trim().toLowerCase();
    if (!email) return;
    if (!email.includes('@') || !email.includes('.')) {
      toast({
        title: 'E-mail inválido',
        description: 'Digite um endereço de e-mail válido.',
        variant: 'destructive',
      });
      return;
    }
    if (destPara.includes(email)) {
      toast({ title: 'Atenção', description: 'Este e-mail já está na lista.' });
      return;
    }
    setDestPara(prev => [...prev, email]);
    setNovoPara('');
  };

  // Adicionar destinatário Cc (Em Cópia)
  const handleAddCc = () => {
    const email = novoCc.trim().toLowerCase();
    if (!email) return;
    if (!email.includes('@') || !email.includes('.')) {
      toast({
        title: 'E-mail inválido',
        description: 'Digite um endereço de e-mail válido.',
        variant: 'destructive',
      });
      return;
    }
    if (destCc.includes(email)) {
      toast({ title: 'Atenção', description: 'Este e-mail já está em cópia.' });
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

  // Salvar SMTP
  const handleSaveSmtp = () => {
    if (!canManageAllUnits) {
      toast({
        title: 'Acesso restrito',
        description: 'Apenas Gestores e Administradores podem alterar o servidor SMTP.',
        variant: 'destructive',
      });
      return;
    }

    if (!smtpForm.host || !smtpForm.user) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha o servidor e usuário do e-mail.',
        variant: 'destructive',
      });
      return;
    }

    setIsSavingSmtp(true);
    saveSmtpConfig(smtpForm);
    setTimeout(() => {
      setIsSavingSmtp(false);
      toast({
        title: 'Configurações salvas',
        description: 'Servidor de envio e remetente atualizados com sucesso.',
      });
    }, 400);
  };

  // Salvar Destinatários da Unidade
  const handleSaveUnidade = () => {
    if (!selectedUnidadeId) return;

    setIsSavingUnidade(true);
    saveUnidadeConfig(selectedUnidadeId, {
      destinatariosPara: destPara,
      destinatariosCc: destCc,
      assuntoTemplate,
    });

    setTimeout(() => {
      setIsSavingUnidade(false);
      const unitObj = UNIDADES_PLANEJAMENTO.find(u => u.id === selectedUnidadeId);
      toast({
        title: 'Destinatários atualizados',
        description: `Lista padrão da unidade ${unitObj?.nome || ''} salva com sucesso.`,
      });
    }, 400);
  };

  // Salvar Assinatura do Usuário
  const handleSaveSignature = () => {
    setIsSavingSignature(true);
    saveUserSignature(signatureForm, userId);
    setTimeout(() => {
      setIsSavingSignature(false);
      toast({
        title: 'Assinatura salva',
        description: 'Sua assinatura de e-mail personalizada foi atualizada com sucesso.',
      });
    }, 350);
  };

  // Carregar Modelo Thunderbird padrão
  const handleCarregarThunderbirdHtml = () => {
    setSignatureForm(prev => ({
      ...prev,
      tipo: 'html',
      html: DEFAULT_THUNDERBIRD_HTML_SIGNATURE,
    }));
    toast({
      title: 'Modelo carregado',
      description: 'O padrão HTML corporativo (Thunderbird/Sirtec) foi inserido com sucesso.',
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. GUIA E ORIENTAÇÕES DE CONFIGURAÇÃO */}
      <Card className="border-[#E07A1F]/30 bg-gradient-to-r from-[#FAF8F5] to-white shadow-2xs">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base font-bold flex items-center gap-2 text-[#23211E]">
              <HelpCircle className="w-5 h-5 text-[#E07A1F]" />
              Guia de Configuração e Envio de E-mails
            </CardTitle>
            <Badge variant="outline" className="bg-[#E07A1F]/10 text-[#E07A1F] border-[#E07A1F]/20 font-mono text-xs">
              {canManageAllUnits ? 'Acesso Total (Admin/Gestor)' : 'Acesso da Unidade Atribuída'}
            </Badge>
          </div>
          <CardDescription className="text-xs text-[#5C574F]">
            Orientações completas sobre o funcionamento do envio automático de planejamento semanal por e-mail.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-xs text-[#5C574F] leading-relaxed border-t border-[#E6E3DD] pt-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3 bg-white rounded-lg border border-[#E6E3DD] space-y-1">
              <span className="font-bold text-[#23211E] flex items-center gap-1.5 text-xs">
                <Server className="w-3.5 h-3.5 text-[#E07A1F]" />
                1. Servidor e Remetente (SMTP)
              </span>
              <p className="text-[11.5px] text-[#6B6660]">
                Configuração da conta corporativa que envia os comunicados (ex: Microsoft 365 · <code>smtp.office365.com</code>, porta <code>587</code> com TLS).
              </p>
            </div>

            <div className="p-3 bg-white rounded-lg border border-[#E6E3DD] space-y-1">
              <span className="font-bold text-[#23211E] flex items-center gap-1.5 text-xs">
                <Users className="w-3.5 h-3.5 text-[#17794C]" />
                2. Destinatários e "Em Cópia" (Cc)
              </span>
              <p className="text-[11.5px] text-[#6B6660]">
                <strong>Para:</strong> supervisores e líderes operacionais da base.<br />
                <strong>Em cópia (Cc):</strong> gerência, coordenação e planejamento.
              </p>
            </div>

            <div className="p-3 bg-white rounded-lg border border-[#E6E3DD] space-y-1">
              <span className="font-bold text-[#23211E] flex items-center gap-1.5 text-xs">
                <Shield className="w-3.5 h-3.5 text-[#B4581A]" />
                3. Permissões de Acesso
              </span>
              <p className="text-[11.5px] text-[#6B6660]">
                <strong>Gestores e Administradores:</strong> configuram qualquer unidade e servidor.<br />
                <strong>Usuários:</strong> configuram apenas as unidades atribuídas.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 2. CONFIGURAÇÃO DE SERVIDOR DE E-MAIL (SMTP) */}
        <Card className="shadow-2xs">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold flex items-center gap-2 text-[#23211E]">
                <Server className="w-4 h-4 text-[#E07A1F]" />
                Servidor de Envio e Remetente
              </CardTitle>
              {!canManageAllUnits && (
                <Badge variant="secondary" className="text-[10px]">
                  Somente Leitura
                </Badge>
              )}
            </div>
            <CardDescription className="text-xs">
              Credenciais e parâmetros de conexão para disparo de e-mails corporativos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3.5">
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Servidor SMTP (Host)</Label>
                <Input
                  value={smtpForm.host}
                  onChange={e => setSmtpForm(p => ({ ...p, host: e.target.value }))}
                  disabled={!canManageAllUnits}
                  placeholder="smtp.office365.com"
                  className="h-8 text-xs bg-white"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Porta</Label>
                <Input
                  type="number"
                  value={smtpForm.port}
                  onChange={e => setSmtpForm(p => ({ ...p, port: parseInt(e.target.value) || 587 }))}
                  disabled={!canManageAllUnits}
                  placeholder="587"
                  className="h-8 text-xs bg-white font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Segurança / Criptografia</Label>
                <Select
                  value={smtpForm.secure}
                  onValueChange={(v: 'tls' | 'ssl' | 'none') => setSmtpForm(p => ({ ...p, secure: v }))}
                  disabled={!canManageAllUnits}
                >
                  <SelectTrigger className="h-8 text-xs bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tls">STARTTLS / TLS (Porta 587)</SelectItem>
                    <SelectItem value="ssl">SSL (Porta 465)</SelectItem>
                    <SelectItem value="none">Nenhum (Porta 25)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Nome de Exibição (From Name)</Label>
                <Input
                  value={smtpForm.senderName}
                  onChange={e => setSmtpForm(p => ({ ...p, senderName: e.target.value }))}
                  disabled={!canManageAllUnits}
                  placeholder="Sirtec PCP · Planejamento"
                  className="h-8 text-xs bg-white"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">E-mail do Remetente (Usuário de Autenticação)</Label>
              <Input
                type="email"
                value={smtpForm.user}
                onChange={e => setSmtpForm(p => ({ ...p, user: e.target.value, fromEmail: e.target.value }))}
                disabled={!canManageAllUnits}
                placeholder="planejamento.ba@sirtec.com.br"
                className="h-8 text-xs bg-white font-mono"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Senha de Acesso / Token de Aplicativo</Label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={smtpForm.password || ''}
                  onChange={e => setSmtpForm(p => ({ ...p, password: e.target.value }))}
                  disabled={!canManageAllUnits}
                  placeholder={canManageAllUnits ? 'Digite a senha ou token de app...' : '••••••••••••'}
                  className="h-8 text-xs bg-white pr-9 font-mono"
                />
                {canManageAllUnits && (
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground pt-0.5">
                Para contas Microsoft 365 corporativas com MFA, utilize uma <strong>Senha de Aplicativo</strong>.
              </p>
            </div>

            {canManageAllUnits && (
              <div className="pt-2 flex justify-end">
                <Button
                  size="sm"
                  onClick={handleSaveSmtp}
                  disabled={isSavingSmtp}
                  className="h-8 text-xs font-bold bg-[#E07A1F] text-white hover:bg-[#E07A1F]/90 shadow-2xs gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {isSavingSmtp ? 'Salvando...' : 'Salvar Configurações SMTP'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 3. DESTINATÁRIOS PADRÃO POR UNIDADE */}
        <Card className="shadow-2xs">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold flex items-center gap-2 text-[#23211E]">
                <Mail className="w-4 h-4 text-[#E07A1F]" />
                Destinatários Padrão da Unidade
              </CardTitle>
              <Building2 className="w-4 h-4 text-muted-foreground" />
            </div>
            <CardDescription className="text-xs">
              Defina quem receberá automaticamente a programação semanal de cada base operacional.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3.5">
            {/* Seletor de Unidade Operacional */}
            <div className="space-y-1">
              <Label className="text-xs font-bold text-[#23211E]">Selecione a Unidade Operacional</Label>
              <Select value={selectedUnidadeId} onValueChange={setSelectedUnidadeId}>
                <SelectTrigger className="h-8 text-xs bg-white font-semibold">
                  <SelectValue placeholder="Selecione a unidade" />
                </SelectTrigger>
                <SelectContent>
                  {allowedUnits.map(u => (
                    <SelectItem key={u.id} value={u.id} className="text-xs font-semibold">
                      {u.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Campo Destinatários Principais (Para) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#23211E] flex items-center justify-between">
                <span>Destinatários Principais ("Para")</span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {destPara.length} {destPara.length === 1 ? 'e-mail' : 'e-mails'}
                </span>
              </Label>

              <div className="flex gap-1.5">
                <Input
                  type="email"
                  value={novoPara}
                  onChange={e => setNovoPara(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddPara())}
                  placeholder="adicionar.email@sirtec.com.br"
                  className="h-8 text-xs bg-white font-mono"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAddPara}
                  className="h-8 px-2.5 text-xs bg-white border-[#DEDAD3] text-[#E07A1F] font-bold shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" /> Adicionar
                </Button>
              </div>

              {/* Lista de chips Para */}
              <div className="flex flex-wrap gap-1.5 p-2 bg-[#FAF8F5] rounded-lg border border-[#E6E3DD] min-h-[46px] max-h-[100px] overflow-y-auto">
                {destPara.length === 0 ? (
                  <span className="text-[11px] text-muted-foreground italic">Nenhum e-mail adicionado</span>
                ) : (
                  destPara.map(email => (
                    <span
                      key={email}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white border border-[#DEDAD3] text-[11px] font-mono text-[#23211E] shadow-2xs"
                    >
                      <span className="truncate max-w-[200px]">{email}</span>
                      <button
                        type="button"
                        onClick={() => handleRemovePara(email)}
                        className="text-[#6B6660] hover:text-[#B03028] ml-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* Campo Em Cópia (Cc) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#23211E] flex items-center justify-between">
                <span>Em Cópia ("Cc")</span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {destCc.length} {destCc.length === 1 ? 'e-mail' : 'e-mails'}
                </span>
              </Label>

              <div className="flex gap-1.5">
                <Input
                  type="email"
                  value={novoCc}
                  onChange={e => setNovoCc(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddCc())}
                  placeholder="coordenacao.gerencia@sirtec.com.br"
                  className="h-8 text-xs bg-white font-mono"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAddCc}
                  className="h-8 px-2.5 text-xs bg-white border-[#DEDAD3] text-[#E07A1F] font-bold shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" /> Adicionar
                </Button>
              </div>

              {/* Lista de chips Cc */}
              <div className="flex flex-wrap gap-1.5 p-2 bg-[#FAF8F5] rounded-lg border border-[#E6E3DD] min-h-[46px] max-h-[100px] overflow-y-auto">
                {destCc.length === 0 ? (
                  <span className="text-[11px] text-muted-foreground italic">Nenhum e-mail em cópia</span>
                ) : (
                  destCc.map(email => (
                    <span
                      key={email}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white border border-[#DEDAD3] text-[11px] font-mono text-[#23211E] shadow-2xs"
                    >
                      <span className="truncate max-w-[200px]">{email}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveCc(email)}
                        className="text-[#6B6660] hover:text-[#B03028] ml-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* Modelo de Assunto */}
            <div className="space-y-1">
              <Label className="text-xs">Modelo Padrão de Assunto</Label>
              <Input
                value={assuntoTemplate}
                onChange={e => setAssuntoTemplate(e.target.value)}
                placeholder="Programação Semanal PCP · {unidade} · {periodo}"
                className="h-8 text-xs bg-white font-mono"
              />
              <p className="text-[10.5px] text-muted-foreground">
                Tags disponíveis: <code>{'{unidade}'}</code>, <code>{'{periodo}'}</code>, <code>{'{inicio}'}</code>, <code>{'{fim}'}</code>
              </p>
            </div>

            <div className="pt-2 flex justify-end">
              <Button
                size="sm"
                onClick={handleSaveUnidade}
                disabled={isSavingUnidade}
                className="h-8 text-xs font-bold bg-[#E07A1F] text-white hover:bg-[#E07A1F]/90 shadow-2xs gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {isSavingUnidade ? 'Salvando...' : 'Salvar Destinatários da Unidade'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 4. ASSINATURA DE E-MAIL DO USUÁRIO (HTML / TEXTO LIVRE) */}
      <Card className="shadow-2xs border-[#E6E3DD]">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base font-bold flex items-center gap-2 text-[#23211E]">
              <PenTool className="w-4 h-4 text-[#E07A1F]" />
              Minha Assinatura de E-mail (PCP)
            </CardTitle>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-[#FAF8F5] px-3 py-1 rounded-lg border border-[#DEDAD3]">
                <Label htmlFor="switch-html" className="text-xs font-bold text-[#23211E] cursor-pointer">
                  Usar HTML
                </Label>
                <Switch
                  id="switch-html"
                  checked={signatureForm.tipo === 'html'}
                  onCheckedChange={checked =>
                    setSignatureForm(p => ({ ...p, tipo: checked ? 'html' : 'texto' }))
                  }
                />
              </div>

              {signatureForm.tipo === 'html' && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCarregarThunderbirdHtml}
                  className="h-8 px-2.5 text-xs font-semibold bg-white border-[#DEDAD3] text-[#5C574F] hover:text-[#23211E] gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-[#E07A1F]" />
                  Carregar Padrão Thunderbird
                </Button>
              )}
            </div>
          </div>
          <CardDescription className="text-xs">
            Esta assinatura será inserida automaticamente ao final dos comunicados e relatórios de planejamento enviados por você.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Editor de Conteúdo */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold flex items-center justify-between">
                <span>{signatureForm.tipo === 'html' ? 'Código HTML da Assinatura' : 'Texto Livre da Assinatura'}</span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {signatureForm.tipo === 'html' ? 'HTML Personalizado' : 'Texto simples'}
                </span>
              </Label>

              {signatureForm.tipo === 'html' ? (
                <Textarea
                  value={signatureForm.html}
                  onChange={e => setSignatureForm(p => ({ ...p, html: e.target.value }))}
                  placeholder="Cole seu código HTML aqui..."
                  className="font-mono text-xs h-[180px] bg-white leading-relaxed resize-y"
                />
              ) : (
                <Textarea
                  value={signatureForm.texto}
                  onChange={e => setSignatureForm(p => ({ ...p, texto: e.target.value }))}
                  placeholder="Digite seu nome, cargo, telefone e informações de contato..."
                  className="text-xs h-[180px] bg-white leading-relaxed resize-y"
                />
              )}
            </div>

            {/* Prévia Visual em Tempo Real */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-[#5C574F]">
                Prévia da Assinatura no E-mail
              </Label>
              <div className="h-[180px] overflow-y-auto p-3.5 bg-[#FAF8F5] rounded-lg border border-[#E6E3DD] text-xs">
                {signatureForm.tipo === 'html' ? (
                  <div
                    dangerouslySetInnerHTML={{ __html: signatureForm.html || '<span class="text-muted-foreground italic">Nenhuma assinatura HTML informada</span>' }}
                  />
                ) : (
                  <div className="whitespace-pre-line text-[#23211E] font-sans">
                    {signatureForm.texto || <span className="text-muted-foreground italic">Nenhuma assinatura de texto informada</span>}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <Button
              size="sm"
              onClick={handleSaveSignature}
              disabled={isSavingSignature}
              className="h-8 text-xs font-bold bg-[#E07A1F] text-white hover:bg-[#E07A1F]/90 shadow-2xs gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {isSavingSignature ? 'Salvando...' : 'Salvar Minha Assinatura'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
