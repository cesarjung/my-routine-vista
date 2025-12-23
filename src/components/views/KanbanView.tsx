import { useTasks } from '@/hooks/useTasks';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { CheckCircle2, Clock, AlertCircle, Play, Loader2, GripVertical } from 'lucide-react';
import type { Enums } from '@/integrations/supabase/types';

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
];

interface KanbanViewProps {
  sectorId?: string;
  isMyTasks?: boolean;
}

export const KanbanView = ({ sectorId, isMyTasks }: KanbanViewProps) => {
  const { data: tasks, isLoading } = useTasks();
  const { user } = useAuth();

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

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 min-h-[600px]">
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
                  columnTasks.map((task, index) => (
                    <div
                      key={task.id}
                      className="bg-card rounded-lg border border-border p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer group animate-fade-in"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className="flex items-start gap-2">
                        <GripVertical className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
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
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
