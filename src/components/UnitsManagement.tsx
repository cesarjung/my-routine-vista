import { useState } from 'react';
import { useUnits } from '@/hooks/useUnits';
import { useIsAdmin } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { 
  Building2, 
  ChevronRight, 
  ChevronDown, 
  Plus, 
  Pencil, 
  Trash2,
  FolderTree,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Unit {
  id: string;
  name: string;
  code: string;
  description: string | null;
  parent_id: string | null;
}

export const UnitsManagement = () => {
  const { data: units, isLoading, refetch } = useUnits();
  const { isAdmin } = useIsAdmin();
  
  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form state
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formParentId, setFormParentId] = useState<string>('');

  // Get units with parent_id from raw data
  const unitsWithHierarchy = (units as Unit[]) || [];
  
  // Separate gerências (parent_id = null) and unidades (has parent_id)
  const gerencias = unitsWithHierarchy.filter(u => !u.parent_id);
  
  const getChildUnits = (parentId: string) => {
    return unitsWithHierarchy.filter(u => u.parent_id === parentId);
  };

  const toggleExpand = (unitId: string) => {
    setExpandedUnits(prev => {
      const next = new Set(prev);
      if (next.has(unitId)) {
        next.delete(unitId);
      } else {
        next.add(unitId);
      }
      return next;
    });
  };

  const openCreateDialog = (parentId?: string) => {
    setFormName('');
    setFormCode('');
    setFormDescription('');
    setFormParentId(parentId || '');
    setIsCreateOpen(true);
  };

  const openEditDialog = (unit: Unit) => {
    setSelectedUnit(unit);
    setFormName(unit.name);
    setFormCode(unit.code);
    setFormDescription(unit.description || '');
    setFormParentId(unit.parent_id || '');
    setIsEditOpen(true);
  };

  const openDeleteDialog = (unit: Unit) => {
    setSelectedUnit(unit);
    setIsDeleteOpen(true);
  };

  const handleCreate = async () => {
    if (!formName.trim() || !formCode.trim()) {
      toast.error('Nome e código são obrigatórios');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('units')
        .insert({
          name: formName.trim(),
          code: formCode.trim().toUpperCase(),
          description: formDescription.trim() || null,
          parent_id: formParentId || null,
        });

      if (error) throw error;

      toast.success(formParentId ? 'Unidade criada com sucesso!' : 'Gerência criada com sucesso!');
      setIsCreateOpen(false);
      refetch();
    } catch (error: any) {
      console.error('Error creating unit:', error);
      toast.error(error.message || 'Erro ao criar');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedUnit || !formName.trim() || !formCode.trim()) {
      toast.error('Nome e código são obrigatórios');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('units')
        .update({
          name: formName.trim(),
          code: formCode.trim().toUpperCase(),
          description: formDescription.trim() || null,
          parent_id: formParentId || null,
        })
        .eq('id', selectedUnit.id);

      if (error) throw error;

      toast.success('Atualizado com sucesso!');
      setIsEditOpen(false);
      setSelectedUnit(null);
      refetch();
    } catch (error: any) {
      console.error('Error updating unit:', error);
      toast.error(error.message || 'Erro ao atualizar');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedUnit) return;

    setIsSubmitting(true);
    try {
      // Check if has children
      const children = getChildUnits(selectedUnit.id);
      if (children.length > 0) {
        toast.error('Não é possível excluir uma gerência com unidades vinculadas');
        return;
      }

      const { error } = await supabase
        .from('units')
        .delete()
        .eq('id', selectedUnit.id);

      if (error) throw error;

      toast.success('Excluído com sucesso!');
      setIsDeleteOpen(false);
      setSelectedUnit(null);
      refetch();
    } catch (error: any) {
      console.error('Error deleting unit:', error);
      toast.error(error.message || 'Erro ao excluir');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderUnitItem = (unit: Unit, isGerencia: boolean = false) => {
    const children = getChildUnits(unit.id);
    const hasChildren = children.length > 0;
    const isExpanded = expandedUnits.has(unit.id);

    return (
      <div key={unit.id} className={cn("animate-fade-in", !isGerencia && "ml-6")}>
        <div 
          className={cn(
            "flex items-center gap-2 p-3 rounded-lg border transition-colors",
            isGerencia 
              ? "bg-primary/5 border-primary/20 hover:bg-primary/10" 
              : "bg-card border-border hover:bg-secondary/30"
          )}
        >
          {isGerencia && hasChildren ? (
            <button onClick={() => toggleExpand(unit.id)} className="p-1">
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          ) : (
            <div className="w-6" />
          )}
          
          <div className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center",
            isGerencia ? "bg-primary/20" : "bg-secondary"
          )}>
            {isGerencia ? <FolderTree className="w-4 h-4 text-primary" /> : <Building2 className="w-4 h-4 text-muted-foreground" />}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium truncate">{unit.name}</span>
              <span className="text-xs bg-secondary px-1.5 py-0.5 rounded text-muted-foreground">{unit.code}</span>
            </div>
            {unit.description && (
              <p className="text-xs text-muted-foreground truncate">{unit.description}</p>
            )}
          </div>

          {isAdmin && (
            <div className="flex items-center gap-1">
              {isGerencia && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 w-8 p-0"
                  onClick={() => openCreateDialog(unit.id)}
                  title="Adicionar unidade"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              )}
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 w-8 p-0"
                onClick={() => openEditDialog(unit)}
              >
                <Pencil className="w-4 h-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                onClick={() => openDeleteDialog(unit)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

        {isGerencia && isExpanded && hasChildren && (
          <div className="mt-2 space-y-2">
            {children.map(child => renderUnitItem(child, false))}
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Gerências e Unidades
            </CardTitle>
            <CardDescription>
              Estrutura hierárquica de gerências e unidades
            </CardDescription>
          </div>
          {isAdmin && (
            <Button onClick={() => openCreateDialog()} className="gap-2">
              <Plus className="w-4 h-4" />
              Nova Gerência
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {gerencias.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FolderTree className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma gerência cadastrada</p>
            {isAdmin && (
              <Button variant="outline" className="mt-4" onClick={() => openCreateDialog()}>
                Criar primeira gerência
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {gerencias.map(gerencia => renderUnitItem(gerencia, true))}
          </div>
        )}
      </CardContent>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {formParentId ? 'Adicionar Unidade' : 'Criar Nova Gerência'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                placeholder={formParentId ? "Nome da unidade" : "Nome da gerência"}
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Código *</Label>
              <Input
                placeholder="Ex: BRU, GER-OESTE"
                value={formCode}
                onChange={(e) => setFormCode(e.target.value.toUpperCase())}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input
                placeholder="Descrição opcional"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>

            {!formParentId && (
              <div className="space-y-2">
                <Label>Gerência (opcional)</Label>
                <Select value={formParentId} onValueChange={setFormParentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sem gerência (é uma gerência)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhuma (é uma gerência)</SelectItem>
                    {gerencias.map(g => (
                      <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={isSubmitting}>
              {isSubmitting ? 'Criando...' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar {selectedUnit?.parent_id ? 'Unidade' : 'Gerência'}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Código *</Label>
              <Input
                value={formCode}
                onChange={(e) => setFormCode(e.target.value.toUpperCase())}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Gerência</Label>
              <Select value={formParentId} onValueChange={setFormParentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sem gerência (é uma gerência)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhuma (é uma gerência)</SelectItem>
                  {gerencias.filter(g => g.id !== selectedUnit?.id).map(g => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancelar</Button>
            <Button onClick={handleUpdate} disabled={isSubmitting}>
              {isSubmitting ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{selectedUnit?.name}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isSubmitting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
