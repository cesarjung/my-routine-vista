import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, CheckCircle2, Clock, Calendar, Loader2 } from 'lucide-react';
import { ProgressBar } from './ProgressBar';
import { useTasks } from '@/hooks/useTasks';
import type { Tables } from '@/integrations/supabase/types';

interface RoutineCardProps {
  routine: Tables<'routines'>;
  delay?: number;
}

const frequencyLabels: Record<string, string> = {
  diaria: 'Diária',
  semanal: 'Semanal',
  quinzenal: 'Quinzenal',
  mensal: 'Mensal',
  anual: 'Anual',
  customizada: 'Customizada',
};

export const RoutineCard = ({ routine, delay = 0 }: RoutineCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const { data: allTasks, isLoading } = useTasks();

  const routineTasks = allTasks?.filter(t => t.routine_id === routine.id) || [];
  const completed = routineTasks.filter(t => t.status === 'concluida').length;
  const total = routineTasks.length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div
      className="rounded-xl border border-border bg-card shadow-card overflow-hidden animate-slide-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-secondary/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold',
              percentage === 100
                ? 'bg-success/20 text-success'
                : percentage >= 50
                ? 'bg-warning/20 text-warning'
                : 'bg-destructive/20 text-destructive'
            )}
          >
            {percentage}%
          </div>
          <div className="text-left">
            <h4 className="font-semibold text-foreground">{routine.title}</h4>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {frequencyLabels[routine.frequency]}
              </span>
              <span className="flex items-center gap-1 text-success">
                <CheckCircle2 className="w-3 h-3" />
                {completed}
              </span>
              <span className="flex items-center gap-1 text-warning">
                <Clock className="w-3 h-3" />
                {total - completed}
              </span>
            </div>
          </div>
        </div>

        <ChevronDown
          className={cn(
            'w-5 h-5 text-muted-foreground transition-transform',
            expanded && 'rotate-180'
          )}
        />
      </button>

      {expanded && (
        <div className="border-t border-border">
          <div className="p-4">
            {routine.description && (
              <p className="text-sm text-muted-foreground mb-4">{routine.description}</p>
            )}
            
            <ProgressBar completed={completed} total={total} className="mb-4" />

            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : routineTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma tarefa gerada para esta rotina
              </p>
            ) : (
              <div className="space-y-2">
                {routineTasks.map((task) => (
                  <div
                    key={task.id}
                    className={cn(
                      'flex items-center justify-between p-3 rounded-lg border transition-colors',
                      task.status === 'concluida'
                        ? 'bg-success/5 border-success/20'
                        : 'bg-warning/5 border-warning/20'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {task.status === 'concluida' ? (
                        <CheckCircle2 className="w-5 h-5 text-success" />
                      ) : (
                        <Clock className="w-5 h-5 text-warning" />
                      )}
                      <div>
                        <p className="text-sm font-medium text-foreground">{task.title}</p>
                        <p className="text-xs text-muted-foreground">{task.unit?.name}</p>
                      </div>
                    </div>
                    <span
                      className={cn(
                        'text-xs font-medium px-2 py-1 rounded-full',
                        task.status === 'concluida'
                          ? 'bg-success/20 text-success'
                          : 'bg-warning/20 text-warning'
                      )}
                    >
                      {task.status === 'concluida' ? 'Concluído' : 'Pendente'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
