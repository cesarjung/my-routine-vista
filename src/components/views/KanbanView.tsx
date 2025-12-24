import { useState } from 'react';
import { useTasks } from '@/hooks/useTasks';
import { useUpdateTask } from '@/hooks/useTaskMutations';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { CheckCircle2, Clock, AlertCircle, Play, Loader2, GripVertical, Pencil, MinusCircle, Check, Circle, MoreVertical } from 'lucide-react';
import type { Enums, Tables } from '@/integrations/supabase/types';
import { TaskEditDialog } from '@/components/TaskEditDialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type Task = Tables<'tasks'> & {
  unit?: { name: string; code: string } | null;
};

type TaskStatus = Enums<'task_status'>;

interface Column {
  id: TaskStatus;
  title: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

const columns: Column[] = [
  { id: 'pendente', title: 'Pendentes', icon: Clock, color: 'text-warning', bgColor: 'bg-warning/10' },
  { id: 'em_andamento', title: 'Em Andamento', icon: Play, color: 'text-primary', bgColor: 'bg-primary/10' },
  { id: 'concluida', title: 'Concluídas', icon: CheckCircle2, color: 'text-success', bgColor: 'bg-success/10' },
  { id: 'atrasada', title: 'Atrasadas', icon: AlertCircle, color: 'text-destructive', bgColor: 'bg-destructive/10' },
  { id: 'nao_aplicavel', title: 'N/A', icon: MinusCircle, color: 'text-muted-foreground', bgColor: 'bg-secondary' },
];

interface KanbanViewProps {
  sectorId?: string;
  isMyTasks?: boolean;
}

export const KanbanView = ({ sectorId, isMyTasks }: KanbanViewProps) => {
  const { data: tasks, isLoading } = useTasks();
  const { user } = useAuth();
  const updateTask = useUpdateTask();
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setEditDialogOpen(true);
  };

  const handleStatusChange = (taskId: string, newStatus: TaskStatus, e: React.MouseEvent) => {
    e.stopPropagation();
    updateTask.mutate({
      id: taskId,
      status: newStatus,
      completed_at: newStatus === 'concluida' ? new Date().toISOString() : null,
    });
  };

  const getTasksByStatus = (status: TaskStatus) => {
    return tasks?.filter(t => {
      const matchesSector = !sectorId || (t as any).sector_id === sectorId;
      const matchesUser = !isMyTasks || t.assigned_to === user?.id;
      return t.status === status && matchesSector && matchesUser;
    }) || [];
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1">Kanban</h1>
          <p className="text-muted-foreground">Visualize tarefas por status</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-1">Kanban</h1>
        <p className="text-muted-foreground">Visualize e gerencie tarefas por status</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 min-h-[600px]">
        {columns.map((column) => {
          const columnTasks = getTasksByStatus(column.id);
          const Icon = column.icon;

          return (
            <div
              key={column.id}
              className="rounded-xl border border-border bg-card/50 flex flex-col"
            >
              {/* Column Header */}
              <div className={cn('p-4 rounded-t-xl border-b border-border', column.bgColor)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className={cn('w-5 h-5', column.color)} />
                    <h3 className="font-semibold text-foreground">{column.title}</h3>
                  </div>
                  <span className={cn('text-sm font-bold px-2 py-0.5 rounded-full', column.bgColor, column.color)}>
                    {columnTasks.length}
                  </span>
                </div>
              </div>

              {/* Column Tasks */}
              <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[500px]">
                {columnTasks.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    Nenhuma tarefa
                  </div>
                ) : (
                  columnTasks.map((task, index) => {
                    const isCompleted = task.status === 'concluida';
                    const isNA = task.status === 'nao_aplicavel';
                    
                    return (
                      <div
                        key={task.id}
                        className="bg-card rounded-lg border border-border p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer group animate-fade-in"
                        style={{ animationDelay: `${index * 50}ms` }}
                        onClick={() => handleEditTask(task as Task)}
                      >
                        <div className="flex items-start gap-2">
                          {/* Quick completion checkbox */}
                          <button
                            onClick={(e) => handleStatusChange(task.id, isCompleted ? 'pendente' : 'concluida', e)}
                            className={cn(
                              'w-5 h-5 rounded border-2 flex items-center justify-center transition-all flex-shrink-0 mt-0.5',
                              isCompleted 
                                ? 'bg-success border-success text-success-foreground' 
                                : isNA
                                ? 'bg-muted border-muted-foreground/30'
                                : 'border-muted-foreground/40 hover:border-success hover:bg-success/10'
                            )}
                            title={isCompleted ? 'Marcar como pendente' : 'Marcar como concluída'}
                          >
                            {isCompleted && <Check className="h-3 w-3" />}
                            {isNA && <MinusCircle className="h-3 w-3 text-muted-foreground" />}
                          </button>
                          
                          <div className="flex-1 min-w-0">
                            <p className={cn(
                              "text-sm font-medium text-foreground truncate",
                              isCompleted && "line-through text-muted-foreground"
                            )}>
                              {task.title}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded">
                                {task.unit?.name}
                              </span>
                            </div>
                            {task.due_date && (
                              <p className="text-xs text-muted-foreground mt-2">
                                📅 {new Date(task.due_date).toLocaleDateString('pt-BR')}
                              </p>
                            )}
                          </div>
                          
                          {/* More options dropdown */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleStatusChange(task.id, 'concluida', e as any); }}>
                                <Check className="h-4 w-4 mr-2 text-success" />
                                Concluída
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleStatusChange(task.id, 'pendente', e as any); }}>
                                <Circle className="h-4 w-4 mr-2 text-warning" />
                                Pendente
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleStatusChange(task.id, 'em_andamento', e as any); }}>
                                <Play className="h-4 w-4 mr-2 text-primary" />
                                Em Andamento
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleStatusChange(task.id, 'nao_aplicavel', e as any); }}>
                                <MinusCircle className="h-4 w-4 mr-2 text-muted-foreground" />
                                Não se Aplica
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      <TaskEditDialog
        task={editingTask}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />
    </div>
  );
};
