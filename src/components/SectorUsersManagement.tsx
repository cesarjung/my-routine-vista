import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useSectors, useSectorMutations } from '@/hooks/useSectors';
import { useSectorUsers, useSectorUserMutations } from '@/hooks/useSectorUsers';
import { useProfiles } from '@/hooks/useProfiles';
import { useIsAdmin } from '@/hooks/useUserRole';
import { Users, UserPlus, Trash2, Shield, Loader2 } from 'lucide-react';

export const SectorUsersManagement = () => {
  const { isAdmin } = useIsAdmin();
  const { data: sectors } = useSectors();
  const { data: profiles } = useProfiles();
  const { addUserToSector, removeUserFromSector } = useSectorUserMutations();
  const { deleteSector } = useSectorMutations();

  const [selectedSectorId, setSelectedSectorId] = useState<string>('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const { data: sectorUsers, isLoading: loadingUsers } = useSectorUsers(selectedSectorId);

  const selectedSector = sectors?.find(s => s.id === selectedSectorId);

  const handleDeleteSector = async () => {
    if (!selectedSectorId) return;
    
    await deleteSector.mutateAsync(selectedSectorId);
    setSelectedSectorId('');
  };

  // Get users not already in the selected sector
  const availableUsers = profiles?.filter(
    profile => !sectorUsers?.some(su => su.user_id === profile.id)
  ) || [];

  const handleAddUser = async () => {
    if (!selectedSectorId || !selectedUserId) return;
    
    await addUserToSector.mutateAsync({
      sectorId: selectedSectorId,
      userId: selectedUserId,
    });
    
    setSelectedUserId('');
    setIsAddDialogOpen(false);
  };

  const handleRemoveUser = async (id: string) => {
    if (!selectedSectorId) return;
    
    await removeUserFromSector.mutateAsync({
      id,
      sectorId: selectedSectorId,
    });
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Usuários por Setor
        </CardTitle>
        <CardDescription>
          Defina quais usuários podem acessar cada setor
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Sector Selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Selecione um Setor</label>
          <Select value={selectedSectorId} onValueChange={setSelectedSectorId}>
            <SelectTrigger>
              <SelectValue placeholder="Escolha um setor" />
            </SelectTrigger>
            <SelectContent>
              {sectors?.map(sector => (
                <SelectItem key={sector.id} value={sector.id}>
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: sector.color || '#6366f1' }} 
                    />
                    {sector.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedSectorId && (
          <>
            {/* Header with Add Button and Delete Sector */}
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-muted-foreground">
                Usuários com acesso
              </h4>
              <div className="flex items-center gap-2">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="destructive" className="gap-2">
                      <Trash2 className="w-4 h-4" />
                      Excluir Setor
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir setor?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Tem certeza que deseja excluir o setor "{selectedSector?.name}"? 
                        Essa ação não pode ser desfeita e removerá todos os acessos de usuários a este setor.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteSector}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {deleteSector.isPending ? 'Excluindo...' : 'Excluir'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" className="gap-2">
                      <UserPlus className="w-4 h-4" />
                      Adicionar Usuário
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Adicionar Usuário ao Setor</DialogTitle>
                      <DialogDescription>
                        Selecione um usuário para dar acesso a este setor
                      </DialogDescription>
                    </DialogHeader>
                    
                    <div className="py-4">
                      <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um usuário" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableUsers.length === 0 ? (
                            <div className="p-2 text-sm text-muted-foreground text-center">
                              Todos os usuários já têm acesso
                            </div>
                          ) : (
                            availableUsers.map(profile => (
                              <SelectItem key={profile.id} value={profile.id}>
                                <div className="flex flex-col">
                                  <span>{profile.full_name || profile.email}</span>
                                  {profile.full_name && (
                                    <span className="text-xs text-muted-foreground">{profile.email}</span>
                                  )}
                                </div>
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                        Cancelar
                      </Button>
                      <Button 
                        onClick={handleAddUser} 
                        disabled={!selectedUserId || addUserToSector.isPending}
                      >
                        {addUserToSector.isPending ? 'Adicionando...' : 'Adicionar'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Users List */}
            {loadingUsers ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            ) : sectorUsers?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Nenhum usuário com acesso a este setor</p>
                <p className="text-xs mt-1">Adicione usuários para que possam visualizar este setor</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sectorUsers?.map(su => (
                  <div 
                    key={su.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">
                          {su.user?.full_name || su.user?.email || 'Usuário'}
                        </p>
                        {su.user?.full_name && (
                          <p className="text-xs text-muted-foreground">{su.user.email}</p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleRemoveUser(su.id)}
                      disabled={removeUserFromSector.isPending}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
