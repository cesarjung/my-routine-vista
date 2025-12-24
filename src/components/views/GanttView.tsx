import { useMemo, useState } from 'react';
import { useTasks } from '@/hooks/useTasks';
import { useUpdateTask } from '@/hooks/useTaskMutations';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Loader2, ChevronLeft, ChevronRight, Pencil, Check, MinusCircle, MoreVertical, Circle, Play } from 'lucide-react';
import { format, differenceInDays, startOfDay, addDays, subDays, max, min } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import type { Tables, Enums } from '@/integrations/supabase/types';
import { TaskEditDialog } from '@/components/TaskEditDialog';
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

interface GanttViewProps {
  sectorId?: string;
  isMyTasks?: boolean;
}

export const GanttView = ({ sectorId, isMyTasks }: GanttViewProps) => {
  const { data: tasks, isLoading } = useTasks();
  const updateTask = useUpdateTask();
  const { user } = useAuth();
  const [viewStart, setViewStart] = useState(() => subDays(new Date(), 7));
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

  const daysToShow = 30;
  const dayWidth = 40;

  const dates = useMemo(() => {
    return Array.from({ length: daysToShow }, (_, i) => addDays(viewStart, i));
  }, [viewStart]);

  const tasksWithDates = useMemo(() => {
    return tasks?.filter(t => {
      const matchesSector = !sectorId || (t as any).sector_id === sectorId;
      const matchesUser = !isMyTasks || t.assigned_to === user?.id;
      return t.due_date && matchesSector && matchesUser;
    }) || [];
  }, [tasks, sectorId, isMyTasks, user?.id]);

  const getTaskPosition = (task: typeof tasksWithDates[0]) => {
    if (!task.due_date) return null;

    const dueDate = startOfDay(new Date(task.due_date));
    const startDate = task.start_date ? startOfDay(new Date(task.start_date)) : subDays(dueDate, 2);
    
    const daysDiff = differenceInDays(startDate, viewStart);
    const duration = differenceInDays(dueDate, startDate) + 1;

    return {
      left: Math.max(0, daysDiff) * dayWidth,
      width: Math.max(duration, 1) * dayWidth,
      isVisible: daysDiff + duration > 0 && daysDiff < daysToShow,
    };
  };

  const statusColors: Record<string, string> = {
    pendente: 'bg-warning',
    em_andamento: 'bg-primary',
    concluida: 'bg-success',
    atrasada: 'bg-destructive',
    nao_aplicavel: 'bg-muted',
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1">Gantt</h1>
          <p className="text-muted-foreground">Timeline de tarefas</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  const today = startOfDay(new Date());
  const todayPosition = differenceInDays(today, viewStart) * dayWidth;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1">Gantt</h1>
          <p className="text-muted-foreground">Visualize a timeline de tarefas</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewStart(subDays(viewStart, 7))}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewStart(subDays(new Date(), 7))}
          >
            Hoje
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewStart(addDays(viewStart, 7))}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex">
            {/* Task Names Column */}
            <div className="min-w-[240px] border-r border-border flex-shrink-0">
              <div className="h-14 bg-secondary/50 border-b border-border p-3 font-medium text-foreground">
                Tarefa
              </div>
              {tasksWithDates.map((task, index) => {
                const isCompleted = task.status === 'concluida';
                const isNA = task.status === 'nao_aplicavel';
                
                return (
                  <div
                    key={task.id}
                    className="h-12 border-b border-border px-3 flex items-center gap-2 group cursor-pointer hover:bg-secondary/30"
                    style={{ animationDelay: `${index * 30}ms` }}
                    onClick={() => handleEditTask(task as Task)}
                  >
                    {/* Quick checkbox */}
                    <button
                      onClick={(e) => handleStatusChange(task.id, isCompleted ? 'pendente' : 'concluida', e)}
                      className={cn(
                        'w-5 h-5 rounded border-2 flex items-center justify-center transition-all flex-shrink-0',
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
                    
                    <div className="truncate flex-1">
                      <p className={cn(
                        "text-sm font-medium text-foreground truncate",
                        isCompleted && "line-through text-muted-foreground"
                      )}>{task.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{task.unit?.name}</p>
                    </div>
                    
                    {/* More options */}
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
                        <DropdownMenuItem onClick={(e) => handleStatusChange(task.id, 'concluida', e as any)}>
                          <Check className="h-4 w-4 mr-2 text-success" />
                          Concluída
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => handleStatusChange(task.id, 'pendente', e as any)}>
                          <Circle className="h-4 w-4 mr-2 text-warning" />
                          Pendente
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => handleStatusChange(task.id, 'nao_aplicavel', e as any)}>
                          <MinusCircle className="h-4 w-4 mr-2 text-muted-foreground" />
                          Não se Aplica
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })}
            </div>

          {/* Timeline */}
          <div className="overflow-x-auto flex-1">
            <div style={{ width: daysToShow * dayWidth }}>
              {/* Date Headers */}
              <div className="h-14 bg-secondary/50 border-b border-border flex relative">
                {dates.map((date, index) => {
                  const isCurrentDay = differenceInDays(date, today) === 0;
                  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                  
                  return (
                    <div
                      key={date.toISOString()}
                      className={cn(
                        'flex-shrink-0 border-r border-border flex flex-col items-center justify-center text-xs',
                        isWeekend && 'bg-secondary/30',
                        isCurrentDay && 'bg-primary/10'
                      )}
                      style={{ width: dayWidth }}
                    >
                      <span className="text-muted-foreground">
                        {format(date, 'EEE', { locale: ptBR })}
                      </span>
                      <span className={cn(
                        'font-medium',
                        isCurrentDay ? 'text-primary' : 'text-foreground'
                      )}>
                        {format(date, 'd')}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Task Bars */}
              <div className="relative">
                {/* Today Line */}
                {todayPosition >= 0 && todayPosition < daysToShow * dayWidth && (
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-primary z-10"
                    style={{ left: todayPosition + dayWidth / 2 }}
                  />
                )}

                {tasksWithDates.map((task, index) => {
                  const position = getTaskPosition(task);
                  if (!position?.isVisible) {
                    return (
                      <div key={task.id} className="h-12 border-b border-border" />
                    );
                  }

                  return (
                    <div
                      key={task.id}
                      className="h-12 border-b border-border relative flex items-center"
                    >
                      {/* Background grid */}
                      <div className="absolute inset-0 flex">
                        {dates.map((date) => {
                          const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                          return (
                            <div
                              key={date.toISOString()}
                              className={cn(
                                'flex-shrink-0 border-r border-border/50',
                                isWeekend && 'bg-secondary/20'
                              )}
                              style={{ width: dayWidth }}
                            />
                          );
                        })}
                      </div>

                      {/* Task Bar */}
                      <div
                        className={cn(
                          'absolute h-6 rounded-md shadow-sm flex items-center px-2 text-xs text-white font-medium truncate animate-fade-in z-10',
                          statusColors[task.status]
                        )}
                        style={{
                          left: position.left,
                          width: position.width - 4,
                          animationDelay: `${index * 50}ms`,
                        }}
                        title={`${task.title} - ${task.due_date ? format(new Date(task.due_date), 'dd/MM', { locale: ptBR }) : ''}`}
                      >
                        {position.width > 80 && task.title}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-warning" />
          <span className="text-muted-foreground">Pendente</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-primary" />
          <span className="text-muted-foreground">Em Andamento</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-success" />
          <span className="text-muted-foreground">Concluída</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-destructive" />
          <span className="text-muted-foreground">Atrasada</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-muted" />
          <span className="text-muted-foreground">N/A</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-0.5 h-4 bg-primary" />
          <span className="text-muted-foreground">Hoje</span>
        </div>
      </div>

      <TaskEditDialog
        task={editingTask}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />
    </div>
  );
};
