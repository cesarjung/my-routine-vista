import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Search,
  Filter,
  Loader2,
  Calendar,
  Plus,
  CheckCircle2,
  Trash2,
  X,
  StickyNote,
  Pencil,
  Clock,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useTasks } from '@/hooks/useTasks';
import { useRoutines, useDeleteRoutines } from '@/hooks/useRoutines';
import { useAllActiveRoutinePeriods } from '@/hooks/useRoutineCheckins';
import type { Tables, Enums } from '@/integrations/supabase/types';
import { RoutineDetailPanel } from '@/components/RoutineDetailPanel';
import { cn } from '@/lib/utils';

import { ViewMode } from '@/types/navigation';
import { KanbanView } from './KanbanView';
import { GanttView } from './GanttView';
import { CalendarView } from './CalendarView';

import { RoutineEditDialog } from '@/components/RoutineEditDialog';
import { BulkRoutineCompletionDialog } from '@/components/BulkRoutineCompletionDialog';
import { useUserRole } from '@/hooks/useUserRole';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NotesList } from '@/components/NotesList';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { RoutineForm } from '@/components/RoutineForm';

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
  hideHeader?: boolean;
  viewMode?: ViewMode;
}

export const RoutinesView = ({
  sectorId,
  frequency,
  hideHeader,
  viewMode = 'list'
}: RoutinesViewProps) => {
  const [activeFrequency, setActiveFrequency] = useState<string>(frequency || 'all');
  const [activeTab, setActiveTab] = useState('routines');

  // Sync activeFrequency with frequency prop from navigation changes
  useEffect(() => {
    if (frequency) {
      setActiveFrequency(frequency);
    } else {
      setActiveFrequency('all');
    }
  }, [frequency]);
  const [search, setSearch] = useState('');
  const [selectedRoutine, setSelectedRoutine] = useState<Tables<'routines'> | null>(null);
  const [editingRoutine, setEditingRoutine] = useState<Tables<'routines'> | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(['pendente']);
  const [activeStatusFilter, setActiveStatusFilter] = useState<string>('active'); // Added state

  const [selectedRoutineIds, setSelectedRoutineIds] = useState<string[]>([]);
  const [isBulkCompleteDialogOpen, setIsBulkCompleteDialogOpen] = useState(false);
  const [selectedRoutineDate, setSelectedRoutineDate] = useState<string | null>(null);

  const { data: userRole } = useUserRole(); // Assuming this hook exists
  const isGestorOrAdmin = userRole === 'admin' || userRole === 'gestor';
  const { data: routines, isLoading } = useRoutines();
  const deleteRoutines = useDeleteRoutines();
  const { data: periodsByRoutine } = useAllActiveRoutinePeriods();
  const { data: allTasks } = useTasks();
  const [hideCompleted, setHideCompleted] = useState(false);

  const allFilteredSelected = routines && routines.length > 0
    ? routines.every((r) => selectedRoutineIds.includes(r.id)) : false;

  const toggleSelectAll = () => {
    if (!routines?.length) return;
    if (allFilteredSelected) setSelectedRoutineIds([]);
    else setSelectedRoutineIds(routines.map(r => r.id));
  };

  const handleToggleSelect = (id: string) => {
    setSelectedRoutineIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

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
    
    const routineTasks = allTasks?.filter(t => t.routine_id === r.id) || [];
    const hasTaskInSector = routineTasks.some(t => t.sector_id === sectorId || t.unit?.sector_id === sectorId);
    
    const matchesSector = !sectorId || (r as any).sector_id === sectorId || hasTaskInSector;
    
    const isCompleted = isRoutineCompleted(r.id);
    const matchesHideCompleted = hideCompleted ? !isCompleted : true;
    
    return matchesFrequency && matchesSector && matchesHideCompleted;
  });

  const renderContent = () => {
    if (viewMode === 'kanban') {
      return <KanbanView sectorId={sectorId} type="routines" hideHeader />;
    }
    if (viewMode === 'gantt') {
      return <GanttView sectorId={sectorId} type="routines" />;
    }
    if (viewMode === 'calendar') {
      return <CalendarView sectorId={sectorId} type="routines" />;
    }

    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (!filteredRoutines || filteredRoutines.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
          <Calendar className="w-12 h-12 mb-4 opacity-20" />
          <p>Nenhuma rotina encontrada</p>
        </div>
      );
    }

    return (
      <div className="flex-1 overflow-y-auto custom-scrollbar bg-card rounded-xl border border-border shadow-sm">
        {filteredRoutines.map((routine) => (
          <RoutineListItem
            key={routine.id}
            routine={routine}
            isSelected={selectedRoutine?.id === routine.id}
            isMultiSelected={selectedRoutineIds.includes(routine.id)}
            onToggleSelect={handleToggleSelect}
            onClick={() => setSelectedRoutine(routine)}
            onEdit={(e) => {
              e.stopPropagation();
              setEditingRoutine(routine);
            }}
            canEdit={isGestorOrAdmin}
            periodDates={periodsByRoutine?.[routine.id] || null}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col">
      {/* Headers or Bulk Actions */}
      {!hideHeader && selectedRoutineIds.length > 0 ? (
          <div className="flex items-center gap-2 p-2 bg-primary/5 border-b border-primary/20 shadow-sm overflow-x-auto shrink-0 min-h-[50px] mb-4 rounded-lg animate-in fade-in slide-in-from-top-1">
            <span className="text-sm font-medium text-primary ml-2 whitespace-nowrap">
              {selectedRoutineIds.length} selecionada{selectedRoutineIds.length !== 1 ? 's' : ''}
            </span>

            <div className="h-5 w-px bg-primary/20 shrink-0 mx-2" />

            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSelectAll}
              className="h-8 text-xs font-medium text-primary hover:text-primary hover:bg-primary/10"
            >
              {allFilteredSelected ? "Deselecionar Tudo" : "Selecionar Tudo"}
            </Button>

            <div className="flex items-center gap-1 ml-auto">
              {isGestorOrAdmin && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-8 text-xs gap-1.5 bg-green-100 text-green-700 hover:bg-green-200 border border-green-200"
                  onClick={() => setIsBulkCompleteDialogOpen(true)}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Concluir
                </Button>
              )}

              <Button
                variant="secondary"
                size="sm"
                className="h-8 text-xs gap-1.5 bg-red-100 text-red-700 hover:bg-red-200 border border-red-200"
                onClick={async () => {
                  try {
                    await deleteRoutines.mutateAsync(selectedRoutineIds);
                    setSelectedRoutineIds([]);
                  } catch (e) {
                    console.error("Bulk delete failed", e);
                  }
                }}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Excluir
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 ml-1 text-muted-foreground hover:text-foreground"
                onClick={() => setSelectedRoutineIds([])}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
      ) : !hideHeader && (
        <div className="w-full flex-col flex h-full gap-4">
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

            <div className="flex items-center gap-2">
              <RoutineForm sectorId={sectorId} />
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
          
          <div className="flex-1 overflow-hidden flex flex-col">
            {renderContent()}
          </div>
        </div>
      )}

      {/* When hideHeader is true, we still need to render content */}
      {hideHeader && (
        <div className="flex-1 overflow-hidden flex flex-col">
          {renderContent()}
        </div>
      )}

      {/* Detail Panel via Sheet */}
      <Sheet open={!!selectedRoutine} onOpenChange={(open) => {
        if (!open) {
          setSelectedRoutine(null);
          setSelectedRoutineDate(null);
        }
      }}>
        <SheetContent className="sm:max-w-xl w-[90vw] p-0" side="right">
          {selectedRoutine && (
            <div className="h-full overflow-y-auto">
              <RoutineDetailPanel
                routine={selectedRoutine}
                onClose={() => {
                  setSelectedRoutine(null);
                  setSelectedRoutineDate(null);
                }}
                contextDate={selectedRoutineDate}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>

      <RoutineEditDialog
        routine={editingRoutine}
        open={!!editingRoutine}
        onOpenChange={(open) => !open && setEditingRoutine(null)}
      />

      <BulkRoutineCompletionDialog
        open={isBulkCompleteDialogOpen}
        onOpenChange={setIsBulkCompleteDialogOpen}
        selectedRoutineIds={selectedRoutineIds}
        onSuccess={() => setSelectedRoutineIds([])}
      />
    </div>
  );
};