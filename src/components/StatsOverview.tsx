import { CheckCircle2, Clock, ListTodo, TrendingUp } from 'lucide-react';
import { mockTasks, getAllSubtasks } from '@/data/mockData';
import { cn } from '@/lib/utils';

export const StatsOverview = () => {
  const allSubtasks = getAllSubtasks();
  const completed = allSubtasks.filter((s) => s.status === 'completed').length;
  const pending = allSubtasks.filter((s) => s.status === 'pending').length;
  const total = allSubtasks.length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  const stats = [
    {
      label: 'Total de Rotinas',
      value: mockTasks.length,
      icon: ListTodo,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      label: 'Subtarefas Concluídas',
      value: completed,
      icon: CheckCircle2,
      color: 'text-success',
      bg: 'bg-success/10',
    },
    {
      label: 'Subtarefas Pendentes',
      value: pending,
      icon: Clock,
      color: 'text-warning',
      bg: 'bg-warning/10',
    },
    {
      label: 'Taxa de Conclusão',
      value: `${percentage}%`,
      icon: TrendingUp,
      color: percentage >= 70 ? 'text-success' : percentage >= 40 ? 'text-warning' : 'text-destructive',
      bg: percentage >= 70 ? 'bg-success/10' : percentage >= 40 ? 'bg-warning/10' : 'bg-destructive/10',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.label}
            className="rounded-xl border border-border bg-card p-4 shadow-card animate-slide-up"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="flex items-center gap-3">
              <div className={cn('p-2 rounded-lg', stat.bg)}>
                <Icon className={cn('w-5 h-5', stat.color)} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
