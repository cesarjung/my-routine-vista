import { useState } from 'react';
import { RoutineCard } from '@/components/RoutineCard';
import { RoutineForm } from '@/components/RoutineForm';
import { useRoutines } from '@/hooks/useRoutines';
import { cn } from '@/lib/utils';
import { Loader2, Calendar } from 'lucide-react';
import type { Enums } from '@/integrations/supabase/types';

type TaskFrequency = Enums<'task_frequency'>;

const frequencies: { value: TaskFrequency | 'all'; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'diaria', label: 'Diárias' },
  { value: 'semanal', label: 'Semanais' },
  { value: 'quinzenal', label: 'Quinzenais' },
  { value: 'mensal', label: 'Mensais' },
];

export const RoutinesView = () => {
  const [activeFrequency, setActiveFrequency] = useState<TaskFrequency | 'all'>('all');
  const { data: routines, isLoading } = useRoutines();

  const filteredRoutines = activeFrequency === 'all'
    ? routines
    : routines?.filter(r => r.frequency === activeFrequency);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
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
        <div className="space-y-4">
          {filteredRoutines.map((routine, index) => (
            <RoutineCard key={routine.id} routine={routine} delay={index * 100} />
          ))}
        </div>
      )}
    </div>
  );
};
