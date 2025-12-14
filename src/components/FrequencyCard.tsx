import { cn } from '@/lib/utils';
import { frequencyLabels, Frequency } from '@/types/routine';
import { Calendar, CalendarDays, CalendarRange, CalendarCheck } from 'lucide-react';

interface FrequencyCardProps {
  frequency: Frequency;
  taskCount: number;
  completed: number;
  pending: number;
  total: number;
  percentage: number;
  delay?: number;
}

const frequencyIcons: Record<Frequency, React.ElementType> = {
  daily: Calendar,
  weekly: CalendarDays,
  biweekly: CalendarRange,
  monthly: CalendarCheck,
};

const frequencyGradients: Record<Frequency, string> = {
  daily: 'from-primary/20 to-blue-600/10',
  weekly: 'from-emerald-500/20 to-teal-600/10',
  biweekly: 'from-amber-500/20 to-orange-600/10',
  monthly: 'from-violet-500/20 to-purple-600/10',
};

const frequencyAccents: Record<Frequency, string> = {
  daily: 'text-primary',
  weekly: 'text-emerald-400',
  biweekly: 'text-amber-400',
  monthly: 'text-violet-400',
};

const frequencyBorders: Record<Frequency, string> = {
  daily: 'border-primary/30',
  weekly: 'border-emerald-500/30',
  biweekly: 'border-amber-500/30',
  monthly: 'border-violet-500/30',
};

export const FrequencyCard = ({
  frequency,
  taskCount,
  completed,
  pending,
  total,
  percentage,
  delay = 0,
}: FrequencyCardProps) => {
  const Icon = frequencyIcons[frequency];

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border bg-card p-6 shadow-card animate-slide-up',
        frequencyBorders[frequency]
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div
        className={cn(
          'absolute inset-0 bg-gradient-to-br opacity-50',
          frequencyGradients[frequency]
        )}
      />

      <div className="relative">
        <div className="flex items-center justify-between mb-4">
          <div className={cn('p-2 rounded-lg bg-background/50', frequencyAccents[frequency])}>
            <Icon className="w-5 h-5" />
          </div>
          <span className="text-xs font-medium text-muted-foreground">
            {taskCount} tarefa{taskCount !== 1 ? 's' : ''}
          </span>
        </div>

        <h3 className="text-lg font-semibold text-foreground mb-1">
          {frequencyLabels[frequency]}
        </h3>

        <div className="flex items-end gap-2 mb-4">
          <span className={cn('text-3xl font-bold', frequencyAccents[frequency])}>
            {percentage}%
          </span>
          <span className="text-sm text-muted-foreground mb-1">concluído</span>
        </div>

        <div className="h-2 bg-background/50 rounded-full overflow-hidden mb-3">
          <div
            className={cn('h-full rounded-full transition-all duration-1000 ease-out', {
              'bg-primary': frequency === 'daily',
              'bg-emerald-500': frequency === 'weekly',
              'bg-amber-500': frequency === 'biweekly',
              'bg-violet-500': frequency === 'monthly',
            })}
            style={{ width: `${percentage}%` }}
          />
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-success">
            <span className="font-medium">{completed}</span> concluídas
          </span>
          <span className="text-warning">
            <span className="font-medium">{pending}</span> pendentes
          </span>
        </div>
      </div>
    </div>
  );
};
