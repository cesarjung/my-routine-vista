import { useResponsiblesSummary } from '@/hooks/useDashboardData';
import { useTasks } from '@/hooks/useTasks';
import { ProgressBar } from '@/components/ProgressBar';
import { CheckCircle2, Clock, User, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export const ResponsiblesView = () => {
  const { data: responsiblesSummary, isLoading: loadingResponsibles } = useResponsiblesSummary();
  const { data: allTasks, isLoading: loadingTasks } = useTasks();

  const isLoading = loadingResponsibles || loadingTasks;

  const getResponsibleTasks = (userId: string) => {
    return allTasks?.filter(task => task.assigned_to === userId) || [];
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1">Responsáveis</h1>
          <p className="text-muted-foreground">Acompanhe o desempenho de cada colaborador</p>
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
        <h1 className="text-2xl font-bold text-foreground mb-1">Responsáveis</h1>
        <p className="text-muted-foreground">Acompanhe o desempenho de cada colaborador</p>
      </div>

      {(!responsiblesSummary || responsiblesSummary.length === 0) ? (
        <div className="text-center py-12 text-muted-foreground">
          <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhum responsável com tarefas atribuídas</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {responsiblesSummary.map((responsible, index) => {
            const percentage = responsible.total > 0
              ? Math.round((responsible.completed / responsible.total) * 100)
              : 0;
            const tasks = getResponsibleTasks(responsible.id);

            return (
              <div
                key={responsible.id}
                className="rounded-xl border border-border bg-card shadow-card overflow-hidden animate-slide-up"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="p-4 border-b border-border">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground">{responsible.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        {responsible.total} tarefa{responsible.total !== 1 ? 's' : ''} atribuída{responsible.total !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'text-xl font-bold',
                        percentage >= 70 ? 'text-success' : percentage >= 40 ? 'text-warning' : 'text-destructive'
                      )}
                    >
                      {percentage}%
                    </span>
                  </div>

                  <ProgressBar completed={responsible.completed} total={responsible.total} />

                  <div className="flex justify-between mt-2 text-xs">
                    <span className="flex items-center gap-1 text-success">
                      <CheckCircle2 className="w-3 h-3" />
                      {responsible.completed} concluídas
                    </span>
                    <span className="flex items-center gap-1 text-warning">
                      <Clock className="w-3 h-3" />
                      {responsible.pending} pendentes
                    </span>
                  </div>
                </div>

                <div className="max-h-48 overflow-y-auto">
                  {tasks.length === 0 ? (
                    <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                      Nenhuma tarefa atribuída
                    </div>
                  ) : (
                    tasks.map((task) => (
                      <div
                        key={task.id}
                        className={cn(
                          'px-4 py-2 border-b border-border last:border-0 flex items-center justify-between',
                          task.status === 'concluida' ? 'bg-success/5' : 'bg-warning/5'
                        )}
                      >
                        <div>
                          <p className="text-sm text-foreground">{task.title}</p>
                          <p className="text-xs text-muted-foreground">{task.unit?.name}</p>
                        </div>
                        {task.status === 'concluida' ? (
                          <CheckCircle2 className="w-4 h-4 text-success" />
                        ) : (
                          <Clock className="w-4 h-4 text-warning" />
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
