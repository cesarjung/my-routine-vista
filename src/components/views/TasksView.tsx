import { useState } from 'react';
import { Plus, Search, Filter, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TaskForm } from '@/components/TaskForm';
import { TaskListItem } from '@/components/TaskListItem';
import { useTasks } from '@/hooks/useTasks';
import type { Enums } from '@/integrations/supabase/types';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

const statusFilters: { value: string; label: string }[] = [
  { value: 'all', label: 'Todos os Status' },
  { value: 'pendente', label: 'Pendente' },
  { value: 'em_andamento', label: 'Em Andamento' },
  { value: 'concluida', label: 'Concluída' },
  { value: 'atrasada', label: 'Atrasada' },
  { value: 'cancelada', label: 'Cancelada' },
];

const typeFilters = [
  { value: 'all', label: 'Rotinas e Tarefas' },
  { value: 'tasks_only', label: 'Apenas Tarefas' },
  { value: 'routines_only', label: 'Apenas Rotinas' },
];

interface TasksViewProps {
  sectorId?: string;
}

export const TasksView = ({ sectorId }: TasksViewProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [hideCompleted, setHideCompleted] = useState(false);

  const { data: tasks, isLoading } = useTasks();

  const filteredTasks = tasks?.filter((task) => {
    const matchesSearch =
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.description?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' || task.status === statusFilter;

    const matchesSector = !sectorId || (task as any).sector_id === sectorId;
    
    const matchesType = typeFilter === 'all' 
      || (typeFilter === 'tasks_only' && !task.routine_id) 
      || (typeFilter === 'routines_only' && !!task.routine_id);

    const matchesHideCompleted = hideCompleted ? task.status !== 'concluida' : true;

    return matchesSearch && matchesStatus && matchesSector && matchesType && matchesHideCompleted;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1">Tarefas</h1>
          <p className="text-muted-foreground">
            Gerencie e acompanhe todas as tarefas
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Tarefa
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Criar Nova Tarefa</DialogTitle>
            </DialogHeader>
            <TaskForm
              sectorId={sectorId}
              onSuccess={() => setIsDialogOpen(false)}
              onCancel={() => setIsDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar tarefas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {typeFilters.map((filter) => (
                <SelectItem key={filter.value} value={filter.value}>
                  {filter.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusFilters.map((filter) => (
                <SelectItem key={filter.value} value={filter.value}>
                  {filter.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center space-x-2 border rounded-md px-3 border-input bg-background">
            <Switch
              id="hide-completed"
              checked={hideCompleted}
              onCheckedChange={setHideCompleted}
            />
            <Label htmlFor="hide-completed" className="text-sm cursor-pointer whitespace-nowrap">
              Ocultar Concluídas
            </Label>
          </div>
        </div>
      </div>

      {/* Task List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredTasks && filteredTasks.length > 0 ? (
        <div className="flex flex-col border border-border rounded-lg overflow-hidden bg-card">
          {filteredTasks?.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              Nenhuma tarefa encontrada.
            </div>
          ) : (
            filteredTasks?.map((task) => (
              <TaskListItem
                key={task.id}
                task={task as any}
                isMyTasks={false}
              />
            ))
          )}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {searchQuery || statusFilter !== 'all'
              ? 'Nenhuma tarefa encontrada com os filtros aplicados.'
              : 'Nenhuma tarefa cadastrada. Clique em "Nova Tarefa" para começar.'}
          </p>
        </div>
      )}
    </div>
  );
};
