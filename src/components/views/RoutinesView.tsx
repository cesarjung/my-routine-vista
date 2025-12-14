import { useState } from 'react';
import { TaskCard } from '@/components/TaskCard';
import { getTasksByFrequency } from '@/data/mockData';
import { Frequency, frequencyLabels } from '@/types/routine';
import { cn } from '@/lib/utils';

const frequencies: Frequency[] = ['daily', 'weekly', 'biweekly', 'monthly'];

export const RoutinesView = () => {
  const [activeFrequency, setActiveFrequency] = useState<Frequency>('daily');
  const tasks = getTasksByFrequency(activeFrequency);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-1">Rotinas</h1>
        <p className="text-muted-foreground">Gerencie suas tarefas por frequência</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {frequencies.map((freq) => (
          <button
            key={freq}
            onClick={() => setActiveFrequency(freq)}
            className={cn(
              'px-4 py-2 rounded-lg font-medium text-sm transition-all',
              activeFrequency === freq
                ? 'bg-primary text-primary-foreground shadow-glow'
                : 'bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80'
            )}
          >
            {frequencyLabels[freq]}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {tasks.map((task, index) => (
          <TaskCard key={task.id} task={task} delay={index * 100} />
        ))}
      </div>
    </div>
  );
};
