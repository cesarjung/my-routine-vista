import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ChevronDown,
  ChevronUp,
  Calendar,
  User,
  Building2,
  RefreshCw,
  CheckCircle2,
  Circle,
  Trash2,
  MoreVertical,
} from 'lucide-react';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

import type { TaskWithDetails } from '@/hooks/useTasks';
import { useToggleSubtask, useDeleteTask, useUpdateTask } from '@/hooks/useTaskMutations';
import type { Enums } from '@/integrations/supabase/types';

const statusConfig: Record<
  Enums<'task_status'>,
  { label: string; className: string }
> = {
  pendente: { label: 'Pendente', className: 'bg-warning/20 text-warning border-warning/30' },
  em_andamento: { label: 'Em Andamento', className: 'bg-primary/20 text-primary border-primary/30' },
  concluida: { label: 'Concluída', className: 'bg-success/20 text-success border-success/30' },
  atrasada: { label: 'Atrasada', className: 'bg-destructive/20 text-destructive border-destructive/30' },
  cancelada: { label: 'Cancelada', className: 'bg-muted text-muted-foreground border-muted' },
};

const priorityConfig: Record<number, { label: string; className: string }> = {
  1: { label: 'Baixa', className: 'text-muted-foreground' },
  2: { label: 'Normal', className: 'text-foreground' },
  3: { label: 'Média', className: 'text-warning' },
  4: { label: 'Alta', className: 'text-orange-500' },
  5: { label: 'Urgente', className: 'text-destructive' },
};

interface TaskListItemProps {
  task: TaskWithDetails;
}

export const TaskListItem = ({ task }: TaskListItemProps) => {
  const [expanded, setExpanded] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const toggleSubtask = useToggleSubtask();
  const deleteTask = useDeleteTask();
  const updateTask = useUpdateTask();

  const completedSubtasks = task.subtasks?.filter((s) => s.is_completed).length || 0;
  const totalSubtasks = task.subtasks?.length || 0;

  const handleToggleSubtask = (subtaskId: string, currentState: boolean | null) => {
    toggleSubtask.mutate({ subtaskId, isCompleted: !currentState });
  };

  const handleStatusChange = (newStatus: Enums<'task_status'>) => {
    updateTask.mutate({
      id: task.id,
      status: newStatus,
      completed_at: newStatus === 'concluida' ? new Date().toISOString() : null,
    });
  };

  const handleDelete = () => {
    deleteTask.mutate(task.id);
    setDeleteDialogOpen(false);
  };

  const priority = task.priority || 1;
  const statusInfo = statusConfig[task.status];
  const priorityInfo = priorityConfig[priority];

  return (
    <>
      <div className="rounded-xl border border-border bg-card p-4 shadow-card transition-all hover:border-primary/30">
        <div className="flex items-start gap-4">
          {/* Status Toggle */}
          <button
            onClick={() =>
              handleStatusChange(task.status === 'concluida' ? 'pendente' : 'concluida')
            }
            className="mt-1 flex-shrink-0"
          >
            {task.status === 'concluida' ? (
              <CheckCircle2 className="h-5 w-5 text-success" />
            ) : (
              <Circle className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors" />
            )}
          </button>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <h3
                  className={cn(
                    'font-medium text-foreground',
                    task.status === 'concluida' && 'line-through text-muted-foreground'
                  )}
                >
                  {task.title}
                </h3>
                {task.description && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {task.description}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge variant="outline" className={statusInfo.className}>
                  {statusInfo.label}
                </Badge>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleStatusChange('pendente')}>
                      Marcar como Pendente
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleStatusChange('em_andamento')}>
                      Marcar como Em Andamento
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleStatusChange('concluida')}>
                      Marcar como Concluída
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setDeleteDialogOpen(true)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Meta Info */}
            <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-muted-foreground">
              {task.unit && (
                <span className="flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" />
                  {task.unit.name}
                </span>
              )}
              {task.due_date && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  {format(new Date(task.due_date), 'dd/MM/yyyy', { locale: ptBR })}
                </span>
              )}
              {task.routine && (
                <span className="flex items-center gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5" />
                  {task.routine.title}
                </span>
              )}
              <span className={cn('flex items-center gap-1.5', priorityInfo.className)}>
                Prioridade: {priorityInfo.label}
              </span>
            </div>

            {/* Subtasks Toggle */}
            {totalSubtasks > 0 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-2 mt-3 text-sm text-primary hover:underline"
              >
                {expanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
                <span>
                  {completedSubtasks}/{totalSubtasks} subtarefas concluídas
                </span>
              </button>
            )}

            {/* Subtasks List */}
            {expanded && task.subtasks && task.subtasks.length > 0 && (
              <div className="mt-3 pl-2 space-y-2 border-l-2 border-border">
                {task.subtasks
                  .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
                  .map((subtask) => (
                    <div key={subtask.id} className="flex items-center gap-2">
                      <Checkbox
                        checked={subtask.is_completed || false}
                        onCheckedChange={() =>
                          handleToggleSubtask(subtask.id, subtask.is_completed)
                        }
                      />
                      <span
                        className={cn(
                          'text-sm',
                          subtask.is_completed && 'line-through text-muted-foreground'
                        )}
                      >
                        {subtask.title}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tarefa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A tarefa e suas subtarefas serão
              excluídas permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
