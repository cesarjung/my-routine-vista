import { getResponsiblesSummary, mockTasks } from '@/data/mockData';
import { ProgressBar } from '@/components/ProgressBar';
import { CheckCircle2, Clock, User } from 'lucide-react';
import { cn } from '@/lib/utils';

export const ResponsiblesView = () => {
  const responsiblesSummary = getResponsiblesSummary();

  const getResponsibleTasks = (responsibleName: string) => {
    const tasks: { taskTitle: string; unit: string; status: 'completed' | 'pending' }[] = [];
    
    mockTasks.forEach((task) => {
      task.subtasks.forEach((subtask) => {
        if (subtask.responsible === responsibleName) {
          tasks.push({
            taskTitle: task.title,
            unit: subtask.unit,
            status: subtask.status,
          });
        }
      });
    });

    return tasks;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-1">Responsáveis</h1>
        <p className="text-muted-foreground">Acompanhe o desempenho de cada colaborador</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {responsiblesSummary.map((responsible, index) => {
          const percentage = responsible.total > 0
            ? Math.round((responsible.completed / responsible.total) * 100)
            : 0;
          const tasks = getResponsibleTasks(responsible.name);

          return (
            <div
              key={responsible.name}
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
                {tasks.map((task, taskIndex) => (
                  <div
                    key={taskIndex}
                    className={cn(
                      'px-4 py-2 border-b border-border last:border-0 flex items-center justify-between',
                      task.status === 'completed' ? 'bg-success/5' : 'bg-warning/5'
                    )}
                  >
                    <div>
                      <p className="text-sm text-foreground">{task.taskTitle}</p>
                      <p className="text-xs text-muted-foreground">{task.unit}</p>
                    </div>
                    {task.status === 'completed' ? (
                      <CheckCircle2 className="w-4 h-4 text-success" />
                    ) : (
                      <Clock className="w-4 h-4 text-warning" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
