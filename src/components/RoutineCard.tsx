import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, CheckCircle2, Clock, Calendar, Loader2, Play, Building2 } from 'lucide-react';
import { ProgressBar } from './ProgressBar';
import { Button } from './ui/button';
import { 
  useCurrentPeriodCheckins, 
  useCreatePeriodWithCheckins,
  useCompleteCheckin,
  useUndoCheckin
} from '@/hooks/useRoutineCheckins';
import { useUnits } from '@/hooks/useUnits';
import type { Tables } from '@/integrations/supabase/types';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addWeeks } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface RoutineCardProps {
  routine: Tables<'routines'>;
  delay?: number;
}

const frequencyLabels: Record<string, string> = {
  diaria: 'Diária',
  semanal: 'Semanal',
  quinzenal: 'Quinzenal',
  mensal: 'Mensal',
};

const getPeriodDates = (frequency: string): { start: Date; end: Date } => {
  const now = new Date();
  switch (frequency) {
    case 'diaria':
      return { start: startOfDay(now), end: endOfDay(now) };
    case 'semanal':
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    case 'quinzenal':
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(addWeeks(now, 1), { weekStartsOn: 1 }) };
    case 'mensal':
      return { start: startOfMonth(now), end: endOfMonth(now) };
    default:
      return { start: startOfDay(now), end: endOfDay(now) };
  }
};

export const RoutineCard = ({ routine, delay = 0 }: RoutineCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const { data: periodData, isLoading } = useCurrentPeriodCheckins(routine.id);
  const { data: units } = useUnits();
  const createPeriod = useCreatePeriodWithCheckins();
  const completeCheckin = useCompleteCheckin();
  const undoCheckin = useUndoCheckin();

  const checkins = periodData?.period?.routine_checkins || [];
  const completed = checkins.filter(c => c.completed_at !== null).length;
  const total = checkins.length || units?.length || 0;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  const handleStartPeriod = async () => {
    const dates = getPeriodDates(routine.frequency);
    await createPeriod.mutateAsync({
      routineId: routine.id,
      periodStart: dates.start,
      periodEnd: dates.end,
    });
  };

  const handleToggleCheckin = async (checkinId: string, isCompleted: boolean) => {
    if (isCompleted) {
      await undoCheckin.mutateAsync(checkinId);
    } else {
      await completeCheckin.mutateAsync({ checkinId });
    }
  };

  const periodLabel = periodData?.period
    ? `${format(new Date(periodData.period.period_start), "dd/MM", { locale: ptBR })} - ${format(new Date(periodData.period.period_end), "dd/MM", { locale: ptBR })}`
    : null;

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
              {periodLabel && (
                <span className="text-primary font-medium">{periodLabel}</span>
              )}
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
            ) : !periodData?.period ? (
              <div className="text-center py-6">
                <Building2 className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground mb-4">
                  Nenhum período ativo. Inicie um novo período para criar checkins para as unidades.
                </p>
                <Button
                  onClick={handleStartPeriod}
                  disabled={createPeriod.isPending}
                  className="gap-2"
                >
                  {createPeriod.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  Iniciar Período
                </Button>
              </div>
            ) : checkins.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma unidade cadastrada
              </p>
            ) : (
              <div className="space-y-2">
                {checkins.map((checkin) => {
                  const isCompleted = checkin.completed_at !== null;
                  return (
                    <button
                      key={checkin.id}
                      onClick={() => handleToggleCheckin(checkin.id, isCompleted)}
                      disabled={completeCheckin.isPending || undoCheckin.isPending}
                      className={cn(
                        'w-full flex items-center justify-between p-3 rounded-lg border transition-all hover:scale-[1.01]',
                        isCompleted
                          ? 'bg-success/5 border-success/20 hover:bg-success/10'
                          : 'bg-warning/5 border-warning/20 hover:bg-warning/10'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        {isCompleted ? (
                          <CheckCircle2 className="w-5 h-5 text-success" />
                        ) : (
                          <Clock className="w-5 h-5 text-warning" />
                        )}
                        <div className="text-left">
                          <p className="text-sm font-medium text-foreground">
                            {checkin.unit?.name || 'Unidade'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {checkin.unit?.code}
                          </p>
                        </div>
                      </div>
                      <span
                        className={cn(
                          'text-xs font-medium px-2 py-1 rounded-full',
                          isCompleted
                            ? 'bg-success/20 text-success'
                            : 'bg-warning/20 text-warning'
                        )}
                      >
                        {isCompleted ? 'Concluído' : 'Pendente'}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
