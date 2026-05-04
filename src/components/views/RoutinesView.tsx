import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { RoutineForm } from '@/components/RoutineForm';
import { RoutineDetailPanel } from '@/components/RoutineDetailPanel';
import { RoutineEditDialog } from '@/components/RoutineEditDialog';
import { useRoutines } from '@/hooks/useRoutines';
import { useRoutinePeriods, useAllActiveRoutinePeriods } from '@/hooks/useRoutineCheckins';
import { useIsGestorOrAdmin } from '@/hooks/useUserRole';
import { cn } from '@/lib/utils';
import { Loader2, Calendar, ChevronRight, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useTasks } from '@/hooks/useTasks';
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
  periodDates?: { period_start: string; period_end: string } | null;
}

const RoutineListItem = ({ routine, isSelected, onClick, onEdit, canEdit, periodDates }: RoutineListItemProps) => {
  const formatPeriodLabel = () => {
    if (!periodDates) return null;
    const start = new Date(periodDates.period_start);
    const end = new Date(periodDates.period_end);
    return `${format(start, "dd/MM HH:mm", { locale: ptBR })} → ${format(end, "dd/MM HH:mm", { locale: ptBR })}`;
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left py-2.5 px-4 border-b border-border transition-colors group last:border-b-0',
        isSelected ? 'bg-primary/10' : 'hover:bg-muted/50'
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h4 className="font-medium text-sm text-foreground truncate">{routine.title}</h4>
          </div>
          
          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap mt-1">
            <span className="bg-orange-100 text-orange-700 px-1.5 py-0 text-[10px] uppercase font-bold tracking-tight rounded-sm">
              {frequencyLabels[routine.frequency]}
            </span>
            {periodDates ? (
              <span className="flex items-center bg-slate-100 text-slate-700 px-1.5 py-0 text-[10px] font-medium rounded-sm">
                <Clock className="w-3 h-3 mr-1" />
                {formatPeriodLabel()}
              </span>
            ) : (
              <span className="flex items-center bg-slate-100 text-slate-500 px-1.5 py-0 text-[10px] font-medium rounded-sm">
                <Clock className="w-3 h-3 mr-1" />
                Sem período ativo
              </span>
            )}
            {routine.description && (
              <span className="truncate max-w-[200px] text-[10px] text-muted-foreground ml-1">{routine.description}</span>
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
  const { data: periodsByRoutine } = useAllActiveRoutinePeriods();
  const { data: allTasks } = useTasks();
  const [hideCompleted, setHideCompleted] = useState(false);

  const isRoutineCompleted = (routineId: string) => {
    if (!allTasks) return false;
    // Pega a tarefa pai mais recente desta rotina
    const parentTask = allTasks
      .filter(t => t.routine_id === routineId && !t.parent_task_id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
    
    if (parentTask) {
      return parentTask.status === 'concluida';
    }
    
    // Se não tiver tarefa pai, checa as filhas da rotina
    const childTasks = allTasks.filter(t => t.routine_id === routineId && t.parent_task_id);
    if (childTasks.length > 0) {
      return childTasks.every(t => t.status === 'concluida' || t.status === 'nao_aplicavel');
    }
    
    return false;
  };

  const filteredRoutines = routines?.filter(r => {
    const matchesFrequency = activeFrequency === 'all' || r.frequency === activeFrequency;
    const matchesSector = !sectorId || (r as any).sector_id === sectorId;
    const isCompleted = isRoutineCompleted(r.id);
    const matchesHideCompleted = hideCompleted ? !isCompleted : true;
    
    return matchesFrequency && matchesSector && matchesHideCompleted;
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

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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

            <div className="flex items-center space-x-2 border rounded-md px-3 py-1.5 border-input bg-background w-fit">
              <Switch
                id="hide-completed-routines"
                checked={hideCompleted}
                onCheckedChange={setHideCompleted}
              />
              <Label htmlFor="hide-completed-routines" className="text-sm cursor-pointer whitespace-nowrap">
                Ocultar Concluídas
              </Label>
            </div>
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
                  periodDates={periodsByRoutine?.get(routine.id) || null}
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