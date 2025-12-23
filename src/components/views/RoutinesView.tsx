import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { RoutineForm } from '@/components/RoutineForm';
import { RoutineDetailPanel } from '@/components/RoutineDetailPanel';
import { RoutineEditDialog } from '@/components/RoutineEditDialog';
import { useRoutines } from '@/hooks/useRoutines';
import { useIsGestorOrAdmin } from '@/hooks/useUserRole';
import { cn } from '@/lib/utils';
import { Loader2, Calendar, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  onEdit: (e: React.MouseEvent) => void;
  canEdit: boolean;
}

const RoutineListItem = ({ routine, isSelected, onClick, onEdit, canEdit }: RoutineListItemProps) => {
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
            <h4 className="font-medium text-foreground truncate">{routine.title}</h4>
          </div>
          
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="bg-secondary px-2 py-0.5 rounded">
              {frequencyLabels[routine.frequency]}
            </span>
            {routine.description && (
              <span className="truncate max-w-[200px]">{routine.description}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canEdit && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onEdit}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Pencil className="w-4 h-4" />
            </Button>
          )}
          <ChevronRight
            className={cn(
              'w-5 h-5 text-muted-foreground transition-transform shrink-0',
              isSelected && 'text-primary'
            )}
          />
        </div>
      </div>
    </button>
  );
};

interface RoutinesViewProps {
  sectorId?: string;
  frequency?: string;
}

export const RoutinesView = ({ sectorId, frequency }: RoutinesViewProps) => {
  const [activeFrequency, setActiveFrequency] = useState<TaskFrequency | 'all'>(
    (frequency as TaskFrequency) || 'all'
  );
  const [selectedRoutine, setSelectedRoutine] = useState<Tables<'routines'> | null>(null);
  const [editingRoutine, setEditingRoutine] = useState<Tables<'routines'> | null>(null);
  const { isGestorOrAdmin } = useIsGestorOrAdmin();
  const { data: routines, isLoading } = useRoutines();

  const filteredRoutines = routines?.filter(r => {
    const matchesFrequency = activeFrequency === 'all' || r.frequency === activeFrequency;
    const matchesSector = !sectorId || (r as any).sector_id === sectorId;
    return matchesFrequency && matchesSector;
  });

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
            <RoutineForm sectorId={sectorId} />
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
                  onEdit={(e) => {
                    e.stopPropagation();
                    setEditingRoutine(routine);
                  }}
                  canEdit={isGestorOrAdmin}
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

      <RoutineEditDialog
        routine={editingRoutine}
        open={!!editingRoutine}
        onOpenChange={(open) => !open && setEditingRoutine(null)}
      />
    </div>
  );
};