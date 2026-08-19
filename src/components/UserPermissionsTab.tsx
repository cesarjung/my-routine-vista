import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Shield, Save, Loader2, Lock } from 'lucide-react';
import { useProfiles } from '@/hooks/useProfiles';
import { useIsAdmin } from '@/hooks/useUserRole';
import { useModulePermissions, useUpdateModulePermissions } from '@/hooks/useModulePermissions';
import { useAdminUpdatePassword } from '@/hooks/useAdminUpdatePassword';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

export const PLANEJAMENTO_SECTIONS = [
  { id: 'alojamentos', label: 'Alojamentos e Bases' },
  { id: 'carteira_dashboard', label: 'Carteira' },
  { id: 'carteira', label: 'Carteira Planejada' },
  { id: 'cumprimento_planejamento', label: 'Cumprimento Plan.' },
  { id: 'deslocamento', label: 'Deslocamento' },
  { id: 'planejamento_equipes', label: 'Equipes' },
  { id: 'etapas', label: 'Etapas' },
  { id: 'lancamentos_servicos', label: 'Lançamentos de Serviços' },
  { id: 'planejado_meta', label: 'Planejado x Meta' },
  { id: 'planejamento_semanal', label: 'Planejamento Semanal' },
  { id: 'poste_turno', label: 'Poste/Turno' }
];

export const ALMOXARIFADO_SECTIONS = [
  { id: 'planejamento_envios', label: 'Envios' },
  { id: 'planejamento_materiais', label: 'Materiais' }
];

export const PCP_SECTIONS = [
  { id: 'pcp_planejamento', label: 'Planejamento' },
  { id: 'pcp_planej_auto', label: 'Planej. Automático' }
];

export const CONFIGURACOES_SECTIONS = [
  { id: 'config_users', label: 'Criar Usuário' },
  { id: 'config_sectors', label: 'Espaços' },
  { id: 'config_integrations', label: 'Integrações' },
  { id: 'config_permissions', label: 'Permissões' },
  { id: 'config_passwords', label: 'Senhas' },
  { id: 'config_units', label: 'Unidades' },
  { id: 'config_list', label: 'Usuários' }
];

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Administrador' },
  { value: 'gestor', label: 'Gestor' },
  { value: 'usuario', label: 'Usuário / Operador' },
  { value: 'leitor', label: 'Leitor / Consulta' }
];

const ROLE_PRESETS: Record<string, { planejamento: string[]; almoxarifado: string[]; pcp: string[]; configuracoes: string[] }> = {
  admin: {
    planejamento: PLANEJAMENTO_SECTIONS.map(s => s.id),
    almoxarifado: ALMOXARIFADO_SECTIONS.map(s => s.id),
    pcp: PCP_SECTIONS.map(s => s.id),
    configuracoes: CONFIGURACOES_SECTIONS.map(s => s.id)
  },
  gestor: {
    planejamento: PLANEJAMENTO_SECTIONS.map(s => s.id),
    almoxarifado: ALMOXARIFADO_SECTIONS.map(s => s.id),
    pcp: PCP_SECTIONS.map(s => s.id),
    configuracoes: ['config_units', 'config_integrations', 'config_list']
  },
  usuario: {
    planejamento: [
      'carteira_dashboard',
      'carteira',
      'lancamentos_servicos',
      'planejamento_equipes',
      'planejamento_semanal'
    ],
    almoxarifado: ['planejamento_envios', 'planejamento_materiais'],
    pcp: ['pcp_planejamento'],
    configuracoes: ['config_integrations']
  },
  leitor: {
    planejamento: [
      'carteira_dashboard',
      'carteira',
      'cumprimento_planejamento',
      'planejado_meta'
    ],
    almoxarifado: [],
    pcp: [],
    configuracoes: []
  }
};

export const UserPermissionsTab = () => {
  const queryClient = useQueryClient();
  const { isAdmin, isLoading: isLoadingAdmin } = useIsAdmin();
  const { data: profiles = [], refetch: refetchProfiles } = useProfiles();
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<string>('usuario');
  const [newPassword, setNewPassword] = useState<string>('');
  const [planejamentoPermissions, setPlanejamentoPermissions] = useState<string[]>([]);
  const [almoxarifadoPermissions, setAlmoxarifadoPermissions] = useState<string[]>([]);
  const [pcpPermissions, setPcpPermissions] = useState<string[]>([]);
  const [configuracoesPermissions, setConfiguracoesPermissions] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const { data: planData, isLoading: isLoadingPlan } = useModulePermissions('PLANEJAMENTO', selectedUserId);
  const { data: almoxData, isLoading: isLoadingAlmox } = useModulePermissions('ALMOXARIFADO', selectedUserId);
  const { data: pcpData, isLoading: isLoadingPcp } = useModulePermissions('PCP', selectedUserId);
  const { data: configData, isLoading: isLoadingConfig } = useModulePermissions('CONFIGURACOES', selectedUserId);
  const updatePermissions = useUpdateModulePermissions();
  const updatePasswordMutation = useAdminUpdatePassword();

  const selectedProfile = profiles.find(p => p.id === selectedUserId);

  useEffect(() => {
    if (selectedUserId && selectedProfile) {
      const userRole = selectedProfile.role || 'usuario';
      setSelectedRole(userRole);
      setNewPassword('');

      if (planData && Array.isArray(planData.permissions)) {
        setPlanejamentoPermissions(planData.permissions);
      } else {
        setPlanejamentoPermissions(ROLE_PRESETS[userRole]?.planejamento || ROLE_PRESETS.usuario.planejamento);
      }

      if (almoxData && Array.isArray(almoxData.permissions)) {
        setAlmoxarifadoPermissions(almoxData.permissions);
      } else {
        setAlmoxarifadoPermissions(ROLE_PRESETS[userRole]?.almoxarifado || ROLE_PRESETS.usuario.almoxarifado);
      }

      if (pcpData && Array.isArray(pcpData.permissions)) {
        setPcpPermissions(pcpData.permissions);
      } else {
        setPcpPermissions(ROLE_PRESETS[userRole]?.pcp || ROLE_PRESETS.usuario.pcp);
      }

      if (configData && Array.isArray(configData.permissions)) {
        setConfiguracoesPermissions(configData.permissions);
      } else {
        setConfiguracoesPermissions(ROLE_PRESETS[userRole]?.configuracoes || ROLE_PRESETS.usuario.configuracoes);
      }
    } else if (!selectedUserId) {
      setSelectedRole('usuario');
      setNewPassword('');
      setPlanejamentoPermissions([]);
      setAlmoxarifadoPermissions([]);
      setPcpPermissions([]);
      setConfiguracoesPermissions([]);
    }
  }, [selectedUserId, selectedProfile, planData, almoxData, pcpData, configData]);

  const handleRoleChange = (newRole: string) => {
    setSelectedRole(newRole);
    const preset = ROLE_PRESETS[newRole] || ROLE_PRESETS.usuario;
    setPlanejamentoPermissions(preset.planejamento);
    setAlmoxarifadoPermissions(preset.almoxarifado);
    setPcpPermissions(preset.pcp);
    setConfiguracoesPermissions(preset.configuracoes);
    const roleLabel = ROLE_OPTIONS.find(r => r.value === newRole)?.label || newRole;
    toast.info(`Permissões preenchidas automaticamente para o nível: ${roleLabel}`);
  };

  const togglePlanejamentoItem = (id: string) => {
    setPlanejamentoPermissions(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleAlmoxarifadoItem = (id: string) => {
    setAlmoxarifadoPermissions(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const togglePcpItem = (id: string) => {
    setPcpPermissions(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleConfiguracoesItem = (id: string) => {
    setConfiguracoesPermissions(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const isAllPlanejamentoChecked = PLANEJAMENTO_SECTIONS.length > 0 &&
    PLANEJAMENTO_SECTIONS.every(s => planejamentoPermissions.includes(s.id));

  const toggleAllPlanejamento = () => {
    if (isAllPlanejamentoChecked) {
      setPlanejamentoPermissions([]);
    } else {
      setPlanejamentoPermissions(PLANEJAMENTO_SECTIONS.map(s => s.id));
    }
  };

  const isAllAlmoxarifadoChecked = ALMOXARIFADO_SECTIONS.length > 0 &&
    ALMOXARIFADO_SECTIONS.every(s => almoxarifadoPermissions.includes(s.id));

  const toggleAllAlmoxarifado = () => {
    if (isAllAlmoxarifadoChecked) {
      setAlmoxarifadoPermissions([]);
    } else {
      setAlmoxarifadoPermissions(ALMOXARIFADO_SECTIONS.map(s => s.id));
    }
  };

  const isAllPcpChecked = PCP_SECTIONS.length > 0 &&
    PCP_SECTIONS.every(s => pcpPermissions.includes(s.id));

  const toggleAllPcp = () => {
    if (isAllPcpChecked) {
      setPcpPermissions([]);
    } else {
      setPcpPermissions(PCP_SECTIONS.map(s => s.id));
    }
  };

  const isAllConfiguracoesChecked = CONFIGURACOES_SECTIONS.length > 0 &&
    CONFIGURACOES_SECTIONS.every(s => configuracoesPermissions.includes(s.id));

  const toggleAllConfiguracoes = () => {
    if (isAllConfiguracoesChecked) {
      setConfiguracoesPermissions([]);
    } else {
      setConfiguracoesPermissions(CONFIGURACOES_SECTIONS.map(s => s.id));
    }
  };

  const handleSave = async () => {
    if (!selectedUserId) {
      toast.error('Selecione um usuário primeiro.');
      return;
    }

    if (newPassword && newPassword.length < 6) {
      toast.error('A senha deve conter no mínimo 6 caracteres.');
      return;
    }

    setIsSaving(true);
    try {
      // 1. Atualizar Função / Role
      await supabase.from('profiles').update({ role: selectedRole as any }).eq('id', selectedUserId);
      await supabase.from('user_roles').update({ role: selectedRole as any }).eq('user_id', selectedUserId);

      // 2. Atualizar Permissões do Módulo Planejamento
      await updatePermissions.mutateAsync({
        userId: selectedUserId,
        moduleName: 'PLANEJAMENTO',
        permissions: planejamentoPermissions
      });

      // 3. Atualizar Permissões do Módulo Almoxarifado
      await updatePermissions.mutateAsync({
        userId: selectedUserId,
        moduleName: 'ALMOXARIFADO',
        permissions: almoxarifadoPermissions
      });

      // 4. Atualizar Permissões do Módulo PCP
      await updatePermissions.mutateAsync({
        userId: selectedUserId,
        moduleName: 'PCP',
        permissions: pcpPermissions
      });

      // 5. Atualizar Permissões do Módulo Configurações
      await updatePermissions.mutateAsync({
        userId: selectedUserId,
        moduleName: 'CONFIGURACOES',
        permissions: configuracoesPermissions
      });

      // 6. Atualizar Senha se preenchida
      if (newPassword.trim()) {
        await updatePasswordMutation.mutateAsync({
          userId: selectedUserId,
          newPassword: newPassword.trim()
        });
        setNewPassword('');
      }

      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.invalidateQueries({ queryKey: ['user-role', selectedUserId] });
      queryClient.invalidateQueries({ queryKey: ['module_permissions'] });
      refetchProfiles();

      toast.success('Configurações de acessos salvas com sucesso!');
    } catch (error: any) {
      console.error('Erro ao salvar configurações de acesso:', error);
      toast.error(error.message || 'Erro ao salvar configurações.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoadingAdmin) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <Card className="border border-destructive/20 max-w-xl mx-auto my-8 shadow-sm">
        <CardHeader className="text-center">
          <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto mb-2">
            <Lock className="w-6 h-6" />
          </div>
          <CardTitle className="text-lg font-bold text-destructive">Acesso Restrito</CardTitle>
          <CardDescription>
            Somente administradores possuem permissão para acessar e alterar as configurações de acessos dos usuários.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="w-full space-y-6">
      <Card className="border shadow-sm">
        <CardHeader className="text-center md:text-left">
          <CardTitle className="flex items-center gap-2 text-lg font-bold">
            <Shield className="w-5 h-5 text-primary" />
            Configurações de Acessos
          </CardTitle>
          <CardDescription>
            Gerencie usuários, funções, senhas e liberações por módulo do sistema.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          
          {/* Tabela de Configurações Superiores (Usuário, Função, Senha) - Alinhada à esquerda */}
          <div className="max-w-3xl border rounded-md overflow-hidden bg-card shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-3 border-b bg-muted/40 divide-y md:divide-y-0 md:divide-x border-border">
              <div className="p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground text-left">Usuário</div>
              <div className="p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground text-left">Função</div>
              <div className="p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground text-left">Senha</div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border p-2 gap-2 md:gap-0 items-center">
              {/* Campo Usuário */}
              <div className="p-2">
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione um usuário..." />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles.map(user => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.full_name || user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Campo Função */}
              <div className="p-2">
                <Select
                  value={selectedRole}
                  onValueChange={handleRoleChange}
                  disabled={!selectedUserId}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione a função..." />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map(role => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Campo Senha */}
              <div className="p-2">
                <Input
                  type="password"
                  placeholder={selectedUserId ? "Nova senha (opcional)" : "Selecione um usuário"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={!selectedUserId}
                />
              </div>
            </div>
          </div>

          {/* Seção Módulo - SEMPRE VISÍVEL */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-base font-bold text-foreground tracking-tight">Modulo</h3>
              {!selectedUserId && (
                <span className="text-xs text-muted-foreground italic">
                  * Selecione um usuário acima para alterar as liberações dos módulos.
                </span>
              )}
            </div>

            {/* Módulos posicionados lado a lado em flex-wrap */}
            <div className="flex flex-wrap gap-6 items-start">
              {/* Módulo PLANEJAMENTO */}
              <div className="flex-1 min-w-[280px] max-w-sm border rounded-md overflow-hidden shadow-sm bg-card">
                {/* Header do Módulo */}
                <div className="bg-neutral-800 text-white px-4 py-2.5 flex items-center justify-between">
                  <span className="font-bold text-xs uppercase tracking-wider">PLANEJAMENTO</span>
                  <Checkbox
                    checked={isAllPlanejamentoChecked}
                    onCheckedChange={toggleAllPlanejamento}
                    disabled={!selectedUserId}
                    className="bg-white border-white data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                  />
                </div>
                {/* Lista de Seções */}
                <div className="divide-y divide-border">
                  {PLANEJAMENTO_SECTIONS.map(section => {
                    const isChecked = planejamentoPermissions.includes(section.id);
                    return (
                      <div
                        key={section.id}
                        onClick={() => selectedUserId && togglePlanejamentoItem(section.id)}
                        className={`flex items-center justify-between px-4 py-2.5 transition-colors ${
                          selectedUserId ? 'hover:bg-muted/50 cursor-pointer' : 'opacity-60 cursor-not-allowed'
                        }`}
                      >
                        <span className="text-sm font-medium text-foreground">{section.label}</span>
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => selectedUserId && togglePlanejamentoItem(section.id)}
                          disabled={!selectedUserId}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Módulo ALMOXARIFADO */}
              <div className="flex-1 min-w-[280px] max-w-sm border rounded-md overflow-hidden shadow-sm bg-card">
                {/* Header do Módulo */}
                <div className="bg-neutral-800 text-white px-4 py-2.5 flex items-center justify-between">
                  <span className="font-bold text-xs uppercase tracking-wider">ALMOXARIFADO</span>
                  <Checkbox
                    checked={isAllAlmoxarifadoChecked}
                    onCheckedChange={toggleAllAlmoxarifado}
                    disabled={!selectedUserId}
                    className="bg-white border-white data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                  />
                </div>
                {/* Lista de Seções */}
                <div className="divide-y divide-border">
                  {ALMOXARIFADO_SECTIONS.map(section => {
                    const isChecked = almoxarifadoPermissions.includes(section.id);
                    return (
                      <div
                        key={section.id}
                        onClick={() => selectedUserId && toggleAlmoxarifadoItem(section.id)}
                        className={`flex items-center justify-between px-4 py-2.5 transition-colors ${
                          selectedUserId ? 'hover:bg-muted/50 cursor-pointer' : 'opacity-60 cursor-not-allowed'
                        }`}
                      >
                        <span className="text-sm font-medium text-foreground">{section.label}</span>
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => selectedUserId && toggleAlmoxarifadoItem(section.id)}
                          disabled={!selectedUserId}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Módulo PCP */}
              <div className="flex-1 min-w-[280px] max-w-sm border rounded-md overflow-hidden shadow-sm bg-card">
                {/* Header do Módulo */}
                <div className="bg-neutral-800 text-white px-4 py-2.5 flex items-center justify-between">
                  <span className="font-bold text-xs uppercase tracking-wider">MÓDULO PCP</span>
                  <Checkbox
                    checked={isAllPcpChecked}
                    onCheckedChange={toggleAllPcp}
                    disabled={!selectedUserId}
                    className="bg-white border-white data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                  />
                </div>
                {/* Lista de Seções */}
                <div className="divide-y divide-border">
                  {PCP_SECTIONS.map(section => {
                    const isChecked = pcpPermissions.includes(section.id);
                    return (
                      <div
                        key={section.id}
                        onClick={() => selectedUserId && togglePcpItem(section.id)}
                        className={`flex items-center justify-between px-4 py-2.5 transition-colors ${
                          selectedUserId ? 'hover:bg-muted/50 cursor-pointer' : 'opacity-60 cursor-not-allowed'
                        }`}
                      >
                        <span className="text-sm font-medium text-foreground">{section.label}</span>
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => selectedUserId && togglePcpItem(section.id)}
                          disabled={!selectedUserId}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Módulo CONFIGURAÇÕES */}
              <div className="flex-1 min-w-[280px] max-w-sm border rounded-md overflow-hidden shadow-sm bg-card">
                {/* Header do Módulo */}
                <div className="bg-neutral-800 text-white px-4 py-2.5 flex items-center justify-between">
                  <span className="font-bold text-xs uppercase tracking-wider">CONFIGURAÇÕES</span>
                  <Checkbox
                    checked={isAllConfiguracoesChecked}
                    onCheckedChange={toggleAllConfiguracoes}
                    disabled={!selectedUserId}
                    className="bg-white border-white data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                  />
                </div>
                {/* Lista de Seções */}
                <div className="divide-y divide-border">
                  {CONFIGURACOES_SECTIONS.map(section => {
                    const isChecked = configuracoesPermissions.includes(section.id);
                    return (
                      <div
                        key={section.id}
                        onClick={() => selectedUserId && toggleConfiguracoesItem(section.id)}
                        className={`flex items-center justify-between px-4 py-2.5 transition-colors ${
                          selectedUserId ? 'hover:bg-muted/50 cursor-pointer' : 'opacity-60 cursor-not-allowed'
                        }`}
                      >
                        <span className="text-sm font-medium text-foreground">{section.label}</span>
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => selectedUserId && toggleConfiguracoesItem(section.id)}
                          disabled={!selectedUserId}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Botão Salvar */}
            <div className="flex justify-end pt-4 border-t mt-6">
              <Button
                onClick={handleSave}
                disabled={!selectedUserId || isSaving || isLoadingPlan || isLoadingAlmox || isLoadingConfig}
                className="w-full md:w-auto min-w-[160px] gap-2"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Salvar Configurações
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};



