import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useUnits } from '@/hooks/useUnits';
import { useProfiles, Profile } from '@/hooks/useProfiles';
import { useCanManageUsers, useIsAdmin } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { User, Building2, UserPlus, Shield, ShieldX, Pencil } from 'lucide-react';

type AppRole = 'admin' | 'gestor' | 'usuario';

interface UserWithRole extends Profile {
  role?: AppRole;
}

export const SettingsView = () => {
  const { canManageUsers, isLoading: isLoadingRole } = useCanManageUsers();
  const { isAdmin } = useIsAdmin();
  const { user } = useAuth();
  const { data: units } = useUnits();
  const { data: profiles, refetch: refetchProfiles } = useProfiles();
  
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserUnit, setNewUserUnit] = useState('');
  const [newUserRole, setNewUserRole] = useState<AppRole>('usuario');
  const [isCreating, setIsCreating] = useState(false);

  // Edit user state
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
  const [editName, setEditName] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [editRole, setEditRole] = useState<AppRole>('usuario');
  const [isUpdating, setIsUpdating] = useState(false);

  const openEditDialog = async (profile: Profile) => {
    setEditingUser(profile);
    setEditName(profile.full_name || '');
    setEditUnit(profile.unit_id || '');
    
    // Fetch user role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', profile.id)
      .maybeSingle();
    
    setEditRole((roleData?.role as AppRole) || 'usuario');
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;

    setIsUpdating(true);
    try {
      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ 
          full_name: editName.trim(), 
          unit_id: editUnit || null 
        })
        .eq('id', editingUser.id);

      if (profileError) throw profileError;

      // Update role (only admins can change roles)
      if (isAdmin) {
        const { error: roleError } = await supabase
          .from('user_roles')
          .update({ role: editRole })
          .eq('user_id', editingUser.id);

        if (roleError) throw roleError;

        // Handle unit_managers based on role
        if (editRole === 'gestor' && editUnit) {
          // Add to unit_managers if gestor
          const { data: existingManager } = await supabase
            .from('unit_managers')
            .select('id')
            .eq('user_id', editingUser.id)
            .eq('unit_id', editUnit)
            .maybeSingle();

          if (!existingManager) {
            await supabase
              .from('unit_managers')
              .insert({ user_id: editingUser.id, unit_id: editUnit });
          }
        } else if (editRole !== 'gestor') {
          // Remove from unit_managers if not gestor
          await supabase
            .from('unit_managers')
            .delete()
            .eq('user_id', editingUser.id);
        }
      }

      toast({
        title: 'Usuário atualizado',
        description: `${editName} foi atualizado com sucesso.`,
      });

      setEditingUser(null);
      refetchProfiles();
    } catch (error: any) {
      console.error('Error updating user:', error);
      toast({
        title: 'Erro ao atualizar usuário',
        description: error.message || 'Tente novamente',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCreateUser = async () => {
    if (!newUserEmail || !newUserName || !newUserPassword) {
      toast({
        title: 'Erro',
        description: 'Preencha todos os campos obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);
    try {
      // Create user via Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newUserEmail,
        password: newUserPassword,
        options: {
          data: {
            full_name: newUserName,
          },
        },
      });

      if (authError) throw authError;

      if (authData.user) {
        // Update profile with unit
        if (newUserUnit) {
          await supabase
            .from('profiles')
            .update({ unit_id: newUserUnit, full_name: newUserName })
            .eq('id', authData.user.id);
        }

        // Set role if not default
        if (newUserRole !== 'usuario') {
          await supabase
            .from('user_roles')
            .update({ role: newUserRole })
            .eq('user_id', authData.user.id);
        }

        // If gestor, add to unit_managers
        if (newUserRole === 'gestor' && newUserUnit) {
          await supabase
            .from('unit_managers')
            .insert({ user_id: authData.user.id, unit_id: newUserUnit });
        }

        toast({
          title: 'Usuário criado',
          description: `${newUserName} foi cadastrado com sucesso.`,
        });

        // Reset form
        setNewUserEmail('');
        setNewUserName('');
        setNewUserPassword('');
        setNewUserUnit('');
        setNewUserRole('usuario');
        refetchProfiles();
      }
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast({
        title: 'Erro ao criar usuário',
        description: error.message || 'Tente novamente',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  // Show loading while checking permissions
  if (isLoadingRole) {
    return (
      <div className="p-6 flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  // Restrict access to admins and gestors only
  if (!canManageUsers) {
    return (
      <div className="p-6 flex flex-col items-center justify-center gap-4 min-h-[400px]">
        <ShieldX className="w-16 h-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold text-foreground">Acesso Restrito</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Apenas administradores e gestores podem gerenciar usuários.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground">Gerencie usuários, unidades e permissões</p>
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <UserPlus className="w-4 h-4" />
            Criar Usuário
          </TabsTrigger>
          <TabsTrigger value="list" className="flex items-center gap-2">
            <User className="w-4 h-4" />
            Usuários
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="w-5 h-5" />
                Cadastrar Novo Usuário
              </CardTitle>
              <CardDescription>
                Adicione novos colaboradores ao sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome Completo *</Label>
                  <Input
                    id="name"
                    placeholder="Nome do usuário"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="email@exemplo.com"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha *</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unit">Unidade</Label>
                  <Select value={newUserUnit} onValueChange={setNewUserUnit}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma unidade" />
                    </SelectTrigger>
                    <SelectContent>
                      {units?.map((unit) => (
                        <SelectItem key={unit.id} value={unit.id}>
                          {unit.name} ({unit.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Função</Label>
                  <Select value={newUserRole} onValueChange={(v) => setNewUserRole(v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="usuario">Usuário</SelectItem>
                      <SelectItem value="gestor">Gestor</SelectItem>
                      <SelectItem value="admin">Administrador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleCreateUser} disabled={isCreating}>
                {isCreating ? 'Criando...' : 'Criar Usuário'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="list">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Usuários Cadastrados
              </CardTitle>
              <CardDescription>
                Lista de todos os usuários do sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {profiles?.map((profile) => (
                  <div
                    key={profile.id}
                    onClick={() => openEditDialog(profile)}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{profile.full_name || profile.email}</p>
                        <p className="text-sm text-muted-foreground">{profile.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {units?.find(u => u.id === profile.unit_id) && (
                        <span className="text-xs bg-secondary px-2 py-1 rounded">
                          {units.find(u => u.id === profile.unit_id)?.code}
                        </span>
                      )}
                      <Pencil className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                ))}
                {(!profiles || profiles.length === 0) && (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum usuário cadastrado
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit User Dialog */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>
              Altere os dados do usuário {editingUser?.email}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nome Completo</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-unit">Unidade</Label>
              <Select value={editUnit} onValueChange={setEditUnit}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma unidade" />
                </SelectTrigger>
                <SelectContent>
                  {units?.map((unit) => (
                    <SelectItem key={unit.id} value={unit.id}>
                      {unit.name} ({unit.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {isAdmin && (
              <div className="space-y-2">
                <Label htmlFor="edit-role">Função</Label>
                <Select value={editRole} onValueChange={(v) => setEditRole(v as AppRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="usuario">Usuário</SelectItem>
                    <SelectItem value="gestor">Gestor</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateUser} disabled={isUpdating}>
              {isUpdating ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
