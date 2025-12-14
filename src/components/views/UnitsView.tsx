import { getUnitsSummary, mockTasks } from '@/data/mockData';
import { ProgressBar } from '@/components/ProgressBar';
import { CheckCircle2, Clock, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { frequencyLabels, Frequency } from '@/types/routine';

export const UnitsView = () => {
  const unitsSummary = getUnitsSummary();

  const getUnitTasks = (unitName: string) => {
    const tasks: { taskTitle: string; frequency: Frequency; responsible: string; status: 'completed' | 'pending' }[] = [];
    
    mockTasks.forEach((task) => {
      task.subtasks.forEach((subtask) => {
        if (subtask.unit === unitName) {
          tasks.push({
            taskTitle: task.title,
            frequency: task.frequency,
            responsible: subtask.responsible,
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
        <h1 className="text-2xl font-bold text-foreground mb-1">Unidades</h1>
        <p className="text-muted-foreground">Acompanhe o progresso de cada unidade</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {unitsSummary.map((unit, index) => {
          const percentage = unit.total > 0
            ? Math.round((unit.completed / unit.total) * 100)
            : 0;
          const tasks = getUnitTasks(unit.name);

          return (
            <div
              key={unit.name}
              className="rounded-xl border border-border bg-card shadow-card overflow-hidden animate-slide-up"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="p-4 border-b border-border">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">{unit.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {unit.total} tarefa{unit.total !== 1 ? 's' : ''}
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

                <ProgressBar completed={unit.completed} total={unit.total} />

                <div className="flex justify-between mt-2 text-xs">
                  <span className="flex items-center gap-1 text-success">
                    <CheckCircle2 className="w-3 h-3" />
                    {unit.completed} concluídas
                  </span>
                  <span className="flex items-center gap-1 text-warning">
                    <Clock className="w-3 h-3" />
                    {unit.pending} pendentes
                  </span>
                </div>
              </div>

              <div className="max-h-64 overflow-y-auto">
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
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{frequencyLabels[task.frequency]}</span>
                        <span>•</span>
                        <span>{task.responsible}</span>
                      </div>
                    </div>
                    {task.status === 'completed' ? (
                      <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                    ) : (
                      <Clock className="w-4 h-4 text-warning flex-shrink-0" />
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
