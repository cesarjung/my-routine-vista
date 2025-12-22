import { useState } from 'react';
import { RoutineForm } from '@/components/RoutineForm';
import { RoutineDetailPanel } from '@/components/RoutineDetailPanel';
import { useRoutines } from '@/hooks/useRoutines';
import { useCurrentPeriodCheckins } from '@/hooks/useRoutineCheckins';
import { cn } from '@/lib/utils';
import { Loader2, Calendar, ChevronRight, CheckCircle2, Clock } from 'lucide-react';
import { ProgressBar } from '@/components/ProgressBar';
import type { Tables, Enums } from '@/integrations/supabase/types';

type TaskFrequency = Enums<'task_frequency'>;

const frequencies: { value: TaskFrequency | 'all'; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'diaria', label: 'Diárias' },
  { value: 'semanal', label: 'Semanais' },
  { value: 'quinzenal', label: 'Quinzenais' },
  { value: 'mensal', label: 'Mensais' },
];

const frequencyLabels: Record<string, string> = {
  diaria: 'Diária',
  semanal: 'Semanal',
  quinzenal: 'Quinzenal',
  mensal: 'Mensal',
  anual: 'Anual',
};

interface RoutineListItemProps {
  routine: Tables<'routines'>;
  isSelected: boolean;
  onClick: () => void;
}

const RoutineListItem = ({ routine, isSelected, onClick }: RoutineListItemProps) => {
  const { data: periodData } = useCurrentPeriodCheckins(routine.id);
  
  const checkins = periodData?.period?.routine_checkins || [];
  const completed = checkins.filter(c => c.completed_at !== null).length;
  const total = checkins.length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left p-4 border-b border-border transition-colors group',
        isSelected ? 'bg-primary/10' : 'hover:bg-secondary/50'
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <div
              className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0',
                percentage === 100
                  ? 'bg-success/20 text-success'
                  : percentage >= 50
                  ? 'bg-warning/20 text-warning'
                  : 'bg-destructive/20 text-destructive'
              )}
            >
              {percentage}%
            </div>
            <h4 className="font-medium text-foreground truncate">{routine.title}</h4>
          </div>
          
          <div className="flex items-center gap-4 text-xs text-muted-foreground pl-11">
            <span className="bg-secondary px-2 py-0.5 rounded">
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

        <ChevronRight
          className={cn(
            'w-5 h-5 text-muted-foreground transition-transform shrink-0',
            isSelected && 'text-primary'
          )}
        />
      </div>

      {total > 0 && (
        <div className="mt-3 pl-11">
          <ProgressBar completed={completed} total={total} className="h-1.5" />
        </div>
      )}
    </button>
  );
};

export const RoutinesView = () => {
  const [activeFrequency, setActiveFrequency] = useState<TaskFrequency | 'all'>('all');
  const [selectedRoutine, setSelectedRoutine] = useState<Tables<'routines'> | null>(null);
  const { data: routines, isLoading } = useRoutines();

  const filteredRoutines = activeFrequency === 'all'
    ? routines
    : routines?.filter(r => r.frequency === activeFrequency);

  return (
    <div className="flex h-full">
      {/* Left Panel - List */}
      <div className={cn(
        'flex flex-col border-r border-border transition-all',
        selectedRoutine ? 'w-1/2' : 'w-full'
      )}>
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-1">Rotinas</h1>
              <p className="text-muted-foreground">Gerencie rotinas com checkins por unidade</p>
            </div>
            <RoutineForm />
          </div>

          <div className="flex flex-wrap gap-2">
            {frequencies.map((freq) => (
              <button
                key={freq.value}
                onClick={() => setActiveFrequency(freq.value)}
                className={cn(
                  'px-4 py-2 rounded-lg font-medium text-sm transition-all',
                  activeFrequency === freq.value
                    ? 'bg-primary text-primary-foreground shadow-glow'
                    : 'bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80'
                )}
              >
                {freq.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (!filteredRoutines || filteredRoutines.length === 0) ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma rotina encontrada</p>
              <p className="text-sm mt-2">Crie rotinas para começar a gerenciar checkins por unidade</p>
            </div>
          ) : (
            <div>
              {filteredRoutines.map((routine) => (
                <RoutineListItem
                  key={routine.id}
                  routine={routine}
                  isSelected={selectedRoutine?.id === routine.id}
                  onClick={() => setSelectedRoutine(routine)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Detail */}
      {selectedRoutine && (
        <div className="w-1/2">
          <RoutineDetailPanel
            routine={selectedRoutine}
            onClose={() => setSelectedRoutine(null)}
          />
        </div>
      )}
    </div>
  );
};
