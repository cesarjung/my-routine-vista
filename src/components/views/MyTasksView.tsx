import { useState } from 'react';
import { useTasks } from '@/hooks/useTasks';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useRoutines } from '@/hooks/useRoutines';
import { useAuth } from '@/contexts/AuthContext';
import { useSectors } from '@/hooks/useSectors';
import { cn } from '@/lib/utils';
import {
  Loader2,
  Calendar,
  ClipboardList,
  ChevronDown,
  ChevronRight,
  User,
  Search,
  Plus,
  Filter,
  CheckCircle2,
  Trash2,
  X
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ViewMode } from '@/types/navigation';
import { KanbanView } from './KanbanView';
import { CalendarView } from './CalendarView';
import { GanttView } from './GanttView';
import { TaskEditDialog } from '@/components/TaskEditDialog';
import { TaskForm } from '@/components/TaskForm';
import type { Tables, Enums } from '@/integrations/supabase/types';
import { TaskRowItem } from '@/components/TaskRowItem';
import { RoutineListItem } from '@/components/RoutineListItem';
import { TaskDetailPanel } from '@/components/TaskDetailPanel';
import { RoutineDetailPanel } from '@/components/RoutineDetailPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

type Task = Tables<'tasks'> & {
  unit?: { name: string; code: string } | null;
};

const frequencyLabels: Record<string, string> = {
  diaria: 'Diária',
  semanal: 'Semanal',
  quinzenal: 'Quinzenal',
  mensal: 'Mensal',
  anual: 'Anual',
};

// Config from TasksView for reuse
const statusFilters: {
  value: Enums<'task_status'>;
  label: string;
  chipClass: string;
}[] = [
    { value: 'pendente', label: 'Pendente', chipClass: 'bg-yellow-100 text-yellow-800 border border-yellow-300' },
    { value: 'em_andamento', label: 'Em Andamento', chipClass: 'bg-orange-100 text-orange-800 border border-orange-300' },
    { value: 'concluida', label: 'Concluída', chipClass: 'bg-green-100 text-green-800 border border-green-300' },
    { value: 'atrasada', label: 'Atrasada', chipClass: 'bg-red-100 text-red-800 border border-red-300' },
    { value: 'cancelada', label: 'Cancelada', chipClass: 'bg-slate-100 text-slate-700 border border-slate-300' },
  ];

const frequencies: { value: string; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'diaria', label: 'Diárias' },
  { value: 'semanal', label: 'Semanais' },
  { value: 'quinzenal', label: 'Quinzenais' },
  { value: 'mensal', label: 'Mensais' },

];

export const MyTasksView = ({
  hideHeader,
  viewMode = 'list'
}: {
  hideHeader?: boolean;
  viewMode?: ViewMode;
}) => {
  const { user } = useAuth();
  const { data: tasks, isLoading: tasksLoading } = useTasks();
  const { data: routines, isLoading: routinesLoading } = useRoutines();
  const { data: sectors } = useSectors();

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [frequencyFilter, setFrequencyFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [selectedStatuses, setSelectedStatuses] = useState<Enums<'task_status'>[]>(statusFilters.map((f) => f.value));

  // UI State
  const [expandedSectors, setExpandedSectors] = useState<Set<string>>(new Set(['all']));
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedRoutine, setSelectedRoutine] = useState<Tables<'routines'> | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('tasks');

  // Selection State
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [selectedRoutineIds, setSelectedRoutineIds] = useState<string[]>([]);

  const isLoading = tasksLoading || routinesLoading;

  const handleToggleTaskSelect = (id: string) => {
    setSelectedTaskIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleToggleRoutineSelect = (id: string) => {
    setSelectedRoutineIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleSelectAllTasks = (filteredTasks: Task[]) => {
    if (!filteredTasks.length) return;
    const allSelected = filteredTasks.every(t => selectedTaskIds.includes(t.id));
    if (allSelected) setSelectedTaskIds([]);
    else setSelectedTaskIds(filteredTasks.map(t => t.id));
  };

  const toggleSelectAllRoutines = (filteredRoutines: any[]) => {
    if (!filteredRoutines.length) return;
    const allSelected = filteredRoutines.every(r => selectedRoutineIds.includes(r.id));
    if (allSelected) setSelectedRoutineIds([]);
    else setSelectedRoutineIds(filteredRoutines.map(r => r.id));
  };
  const myTasks = tasks?.filter(task => {
    if (!user?.id) return false;

    // 1. Assignment Check
    let isAssigned = false;
    if (task.assigned_to === user.id) isAssigned = true;
    else if (task.assignees && Array.isArray(task.assignees)) {
      isAssigned = task.assignees.some((a: any) => a.id === user.id);
    }
    if (!isAssigned) return false;

    // 2. Search Filter
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    // 3. Status Filter
    const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.includes(task.status);
    if (!matchesStatus) return false;

    // 4. Frequency Filter
    if (frequencyFilter !== 'all') return false;


    // 5. Priority Filter
    const matchesPriority = priorityFilter === 'all' || task.priority.toString() === priorityFilter;
    if (!matchesPriority) return false;

    return true;
  }) || [];

  // Filter routines created by current user
  const myRoutines = routines?.filter(r => {
    if (r.created_by !== user?.id) return false;

    const matchesSearch = r.title.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    const matchesFrequency = frequencyFilter === 'all' || r.frequency === frequencyFilter;
    if (!matchesFrequency) return false;

    return true;
  }) || [];

  // Group tasks by sector
  const tasksBySector = myTasks.reduce((acc, task) => {
    const sectorId = (task as any).sector_id || 'no-sector';
    if (!acc[sectorId]) acc[sectorId] = [];
    acc[sectorId].push(task);
    return acc;
  }, {} as Record<string, typeof myTasks>);

  // Group routines by sector
  const routinesBySector = myRoutines.reduce((acc, routine) => {
    const sectorId = (routine as any).sector_id || 'no-sector';
    if (!acc[sectorId]) acc[sectorId] = [];
    acc[sectorId].push(routine);
    return acc;
  }, {} as Record<string, typeof myRoutines>);

  const toggleSector = (sectorId: string) => {
    setExpandedSectors(prev => {
      const next = new Set(prev);
      if (next.has(sectorId)) {
        next.delete(sectorId);
      } else {
        next.add(sectorId);
      }
      return next;
    });
  };

  const getSectorName = (sectorId: string) => {
    if (sectorId === 'no-sector') return 'Sem Setor';
    return sectors?.find(s => s.id === sectorId)?.name || 'Setor Desconhecido';
  };

  const getSectorColor = (sectorId: string) => {
    if (sectorId === 'no-sector') return '#6b7280';
    return sectors?.find(s => s.id === sectorId)?.color || '#6366f1';
  };

  const allSectorIds = [...new Set([...Object.keys(tasksBySector), ...Object.keys(routinesBySector)])];

  // Render different views based on viewMode
  const renderTasksContent = () => {
    if (viewMode === 'kanban') return <KanbanView isMyTasks hideHeader />;
    if (viewMode === 'calendar') return <CalendarView isMyTasks />;
    if (viewMode === 'gantt') return <GanttView isMyTasks hideHeader />;

    // Default list view
    if (myTasks.length === 0) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhuma tarefa encontrada</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {allSectorIds.filter(id => tasksBySector[id]?.length > 0).map((sectorId) => {
          const sectorTasks = tasksBySector[sectorId] || [];
          const isExpanded = expandedSectors.has('all') || expandedSectors.has(sectorId);
          const pendingCount = sectorTasks.filter(t => t.status === 'pendente' || t.status === 'em_andamento').length;

          return (
            <div key={sectorId} className="rounded-xl border border-border bg-card overflow-hidden">
              <button
                onClick={() => toggleSector(sectorId)}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-secondary/30 transition-colors"
              >
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                <div
                  className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold text-white"
                  style={{ backgroundColor: getSectorColor(sectorId) }}
                >
                  {getSectorName(sectorId).charAt(0)}
                </div>
                <span className="font-medium flex-1 text-left">{getSectorName(sectorId)}</span>
                <Badge variant="secondary">{sectorTasks.length}</Badge>
                {pendingCount > 0 && (
                  <Badge variant="outline" className="border-warning text-warning">
                    {pendingCount} pendente{pendingCount !== 1 ? 's' : ''}
                  </Badge>
                )}
              </button>

              {isExpanded && (
                <div className="border-t border-border divide-y divide-border">
                  {sectorTasks.map((task) => (
                    <TaskRowItem
                      key={task.id}
                      task={task}
                      isSelected={selectedTask?.id === task.id || selectedTaskIds.includes(task.id)}
                      onToggleSelect={handleToggleTaskSelect}
                      onClick={() => {
                        setSelectedTask(task as Task);
                        setSelectedRoutine(null);
                      }}
                      onStatusChange={async (id, status) => {
                        console.log("Status change requested", id, status);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderRoutinesContent = () => {
    if (myRoutines.length === 0) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhuma rotina atribuída a você</p>
        </div>
      );
    }
    return (
      <div className="space-y-4">
        {allSectorIds.filter(id => routinesBySector[id]?.length > 0).map((sectorId) => {
          const sectorRoutines = routinesBySector[sectorId] || [];
          const isExpanded = expandedSectors.has(sectorId);

          return (
            <div key={sectorId} className="rounded-xl border border-border bg-card overflow-hidden">
              <button
                onClick={() => toggleSector(sectorId)}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-secondary/30 transition-colors"
              >
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                <div
                  className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold text-white"
                  style={{ backgroundColor: getSectorColor(sectorId) }}
                >
                  {getSectorName(sectorId).charAt(0)}
                </div>
                <span className="font-medium flex-1 text-left">{getSectorName(sectorId)}</span>
                <Badge variant="secondary">{sectorRoutines.length}</Badge>
              </button>

              {isExpanded && (
                <div className="border-t border-border divide-y divide-border">
                  {sectorRoutines.map((routine) => (
                    <RoutineListItem
                      key={routine.id}
                      routine={routine}
                      isSelected={selectedRoutine?.id === routine.id}
                      isMultiSelected={selectedRoutineIds.includes(routine.id)}
                      onToggleSelect={handleToggleRoutineSelect}
                      onClick={() => {
                        setSelectedRoutine(routine);
                        setSelectedTask(null);
                      }}
                      onEdit={() => { }}
                      canEdit={false}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }



  const isDetailOpen = !!selectedTask || !!selectedRoutine;

  return (
    <div className="flex h-full">
      <div className="w-full flex flex-col transition-all duration-300">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-1 flex flex-col overflow-hidden">

          {/* Header Container V3 - Single Line Forced */}
          {!hideHeader && ((activeTab === 'tasks' && selectedTaskIds.length > 0) || (activeTab === 'routines' && selectedRoutineIds.length > 0)) ? (
            <div className="flex items-center gap-2 p-2 bg-primary/5 border-b border-primary/20 shadow-sm overflow-x-auto shrink-0 min-h-[50px] mb-4 rounded-lg animate-in fade-in slide-in-from-top-1">
              <span className="text-sm font-medium text-primary ml-2 whitespace-nowrap">
                {activeTab === 'tasks' ? selectedTaskIds.length : selectedRoutineIds.length} selecionado(s)
              </span>

              <div className="h-5 w-px bg-primary/20 shrink-0 mx-2" />

              <Button
                variant="ghost"
                size="sm"
                onClick={() => activeTab === 'tasks' ? toggleSelectAllTasks(myTasks) : toggleSelectAllRoutines(myRoutines)}
                className="h-8 text-xs font-medium text-primary hover:text-primary hover:bg-primary/10"
              >
                Selecionar Tudo
              </Button>

              <div className="flex items-center gap-1 ml-auto">
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-8 text-xs gap-1.5 bg-green-100 text-green-700 hover:bg-green-200 border border-green-200"
                  onClick={() => {
                    if (activeTab === 'tasks') {
                      console.log("Bulk Complete Tasks", selectedTaskIds);
                      setSelectedTaskIds([]);
                    } else {
                      console.log("Bulk Complete Routines", selectedRoutineIds);
                      setSelectedRoutineIds([]);
                    }
                  }}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Concluir
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  className="h-8 text-xs gap-1.5 bg-red-100 text-red-700 hover:bg-red-200 border border-red-200"
                  onClick={() => {
                    if (activeTab === 'tasks') {
                      console.log("Bulk Delete Tasks", selectedTaskIds);
                      setSelectedTaskIds([]);
                    } else {
                      console.log("Bulk Delete Routines", selectedRoutineIds);
                      setSelectedRoutineIds([]);
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
                  onClick={() => {
                    setSelectedTaskIds([]);
                    setSelectedRoutineIds([]);
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ) : !hideHeader && (
            <div className="flex items-center gap-2 p-2 bg-card border-b border-border shadow-sm overflow-x-auto shrink-0 min-h-[50px] no-scrollbar">

              {/* Group 1: Navigation & Search */}
              <div className="flex items-center gap-2 shrink-0">
                <TabsList className="justify-start h-8 bg-secondary/50 p-0.5">
                  <TabsTrigger value="tasks" className="gap-1.5 h-7 text-xs px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                    <ClipboardList className="w-3.5 h-3.5" />
                    Tarefas ({myTasks.length})
                  </TabsTrigger>
                  <TabsTrigger value="routines" className="gap-1.5 h-7 text-xs px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                    <Calendar className="w-3.5 h-3.5" />
                    Rotinas ({myRoutines.length})
                  </TabsTrigger>
                </TabsList>

                <div className="relative w-36 md:w-48 shrink-0">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 bg-background h-8 text-xs w-full"
                  />
                </div>
              </div>

              <div className="h-5 w-px bg-border shrink-0 mx-0.5" />

              {/* Group 2: Frequencies */}
              <div className="flex items-center gap-0.5 bg-secondary/30 p-0.5 rounded-lg border border-border shrink-0">
                {frequencies.map((freq) => (
                  <button
                    key={freq.value}
                    onClick={() => setFrequencyFilter(freq.value)}
                    className={cn(
                      'h-7 px-2.5 rounded-md text-xs font-medium transition-all outline-none whitespace-nowrap',
                      frequencyFilter === freq.value
                        ? 'bg-black text-white shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-black/5'
                    )}
                  >
                    {freq.label}
                  </button>
                ))}
              </div>

              <div className="h-5 w-px bg-border shrink-0 mx-0.5" />

              {/* Group 3: Statuses */}
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedStatuses(selectedStatuses.length > 0 ? [] : statusFilters.map(f => f.value))}
                  className="h-7 px-2 text-xs font-medium text-muted-foreground hover:text-foreground whitespace-nowrap"
                >
                  {selectedStatuses.length === statusFilters.length ? "Limpar" : "Todos"}
                </Button>
                {statusFilters.map((filter) => {
                  const isActive = selectedStatuses.includes(filter.value);
                  return (
                    <button
                      key={filter.value}
                      onClick={() => setSelectedStatuses(prev => prev.includes(filter.value) ? prev.filter(v => v !== filter.value) : [...prev, filter.value])}
                      className={cn(
                        'rounded-full px-2.5 py-0.5 text-xs font-medium border transition-all whitespace-nowrap',
                        isActive ? filter.chipClass : 'bg-muted/50 text-muted-foreground hover:bg-muted border-transparent'
                      )}
                    >
                      {filter.label}
                    </button>
                  );
                })}
              </div>

              {/* Spacer */}
              <div className="flex-1 min-w-2" />

              {/* Group 4: Priority & New */}
              <div className="flex items-center gap-1.5 shrink-0 ml-auto bg-card pl-2 sticky right-0 shadow-[glue_left_shadow]">
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="w-[110px] h-8 text-xs text-muted-foreground bg-background px-2">
                    <SelectValue placeholder="Prioridade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="4">Alta</SelectItem>
                    <SelectItem value="3">Média</SelectItem>
                    <SelectItem value="1">Baixa</SelectItem>
                  </SelectContent>
                </Select>

                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="h-8 gap-1.5 bg-[#F97316] hover:bg-[#EA580C] text-white text-xs px-3">
                      <Plus className="h-3.5 w-3.5" />
                      Nova
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Criar Nova Tarefa</DialogTitle>
                    </DialogHeader>
                    <TaskForm
                      onSuccess={() => setIsCreateDialogOpen(false)}
                      onCancel={() => setIsCreateDialogOpen(false)}
                    />
                  </DialogContent>
                </Dialog>
              </div>

            </div>
          )}

          <TabsContent value="tasks" className="flex-1 overflow-auto p-6 mt-0">
            {renderTasksContent()}
          </TabsContent>

          <TabsContent value="routines" className="flex-1 overflow-auto p-6 mt-0">
            {renderRoutinesContent()}
          </TabsContent>
        </Tabs>
      </div>

      {/* Detail Panel via Sheet */}
      <Sheet open={isDetailOpen} onOpenChange={(open) => {
        if (!open) {
          setSelectedTask(null);
          setSelectedRoutine(null);
        }
      }}>
        <SheetContent className="sm:max-w-xl w-[90vw] p-0" side="right">
          <div className="h-full overflow-y-auto">
            {selectedTask && (
              <TaskDetailPanel
                task={selectedTask}
                onClose={() => setSelectedTask(null)}
              />
            )}
            {selectedRoutine && (
              <RoutineDetailPanel
                routine={selectedRoutine}
                onClose={() => setSelectedRoutine(null)}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>


      {/* Task Edit Dialog (Kept just in case, but primary interaction is Detail Panel) */}
      <TaskEditDialog
        task={selectedTask}
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) setSelectedTask(null);
        }}
      />
    </div >
  );
};
