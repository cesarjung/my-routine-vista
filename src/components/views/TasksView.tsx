import { useState } from 'react';
import {
  Plus,
  Search,
  Filter,
  Loader2,
  Calendar,
  ClipboardList,
  CheckCircle2,
  Trash2,
  X
} from 'lucide-react';
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
import { useTasks, useDeleteTasks, useBulkUpdateTasks } from '@/hooks/useTasks';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from 'sonner';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { TaskForm } from '@/components/TaskForm';
import { cn } from '@/lib/utils';
import type { Enums } from '@/integrations/supabase/types';
import { TaskDetailPanel } from '@/components/TaskDetailPanel';
import { RoutineDetailPanel } from '@/components/RoutineDetailPanel';
import { TaskRowItem } from '@/components/TaskRowItem';
import { ViewMode } from '@/types/navigation';
import { KanbanView } from './KanbanView';
import { GanttView } from './GanttView';
import { CalendarView } from './CalendarView';

// --- CONFIGURATION ARRAYS ---

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

// Local Frequency constant
const frequencies = [
  { value: 'all', label: 'Todas' },
  { value: 'diaria', label: 'Diárias' },
  { value: 'semanal', label: 'Semanais' },
  { value: 'quinzenal', label: 'Quinzenais' },
  { value: 'mensal', label: 'Mensais' },
];

interface TasksViewProps {
  sectorId?: string;
  sectionId?: string; // New prop
  isDefaultTasksSection?: boolean;
  hideHeader?: boolean;
  viewMode?: ViewMode;
}

export const TasksView = ({
  sectorId,
  sectionId,
  isDefaultTasksSection,
  hideHeader,
  viewMode = 'list'
}: TasksViewProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [activeFrequency, setActiveFrequency] = useState<string>('all');
  const [activeStatusFilter, setActiveStatusFilter] = useState<string>('active');
  const [selectedStatuses, setSelectedStatuses] = useState<Enums<'task_status'>[]>(statusFilters.map((f) => f.value));
  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  const [selectedRoutine, setSelectedRoutine] = useState<any | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);

  const { user } = useAuth();
  const { data: role } = useUserRole();
  const isGestorOrAdmin = role === 'admin' || role === 'gestor';

  const { data: tasks, isLoading } = useTasks();
  const deleteTasks = useDeleteTasks();
  const bulkUpdateTasks = useBulkUpdateTasks();

  const handleToggleSelect = (id: string) => {
    setSelectedTaskIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleDelete = (id: string) => {
    // console.log('Delete', id);
  };

  const handleStatusChange = (id: string, status: any) => {
    // console.log('Status', id, status);
  };

  const filteredTasks = tasks?.filter((task) => {
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.includes(task.status);
    const matchesSector = !sectorId || task.sector_id === sectorId;

    // Filter by Section ID
    const matchesSection = !sectionId || isDefaultTasksSection
      ? (!sectionId || (task as any).section_id === null || (task as any).section_id === 'tasks' || (task as any).section_id === sectorId || (task as any).section_id === sectionId)
      : (task as any).section_id === sectionId;

    const matchesPriority = priorityFilter === 'all' || task.priority.toString() === priorityFilter;

    // Check specific frequency from routine if available
    const routineFrequency = task.routine?.frequency;
    const matchesFrequency = activeFrequency === 'all' || routineFrequency === activeFrequency;

    // Check routine active status
    const matchesActiveStatus = activeStatusFilter === 'all'
      ? true
      : activeStatusFilter === 'active'
        ? (task.routine?.is_active !== false) // Treat null routine (ad-hoc) as active? Or strictly routine-based? Ad-hoc tasks don't have is_active. Let's assume active unless routine is false.
        : (task.routine?.is_active === false);

    // Show only "Main" items: Standalone Tasks or Routine Parents (Containers)
    // Hide Routine Child Tasks (Subtasks) from the main list
    const isRoutineSubtask = task.routine_id && task.parent_task_id;

    if (task.title.toLowerCase().includes("teste tarefa")) {
      console.log("DEBUG TESTE TAREFA:", {
        title: task.title,
        sectionId: sectionId,
        taskSectionId: (task as any).section_id,
        matchesSearch,
        matchesStatus,
        matchesSector,
        matchesSection,
        matchesPriority,
        matchesFrequency,
        matchesActiveStatus,
        isRoutineSubtask,
      });
    }

    return matchesSearch && matchesStatus && matchesSector && matchesSection && matchesPriority && matchesFrequency && matchesActiveStatus && !isRoutineSubtask;
  }) || [];

  const allFilteredSelected = filteredTasks && filteredTasks.length > 0
    ? filteredTasks.every((task) => selectedTaskIds.includes(task.id)) : false;

  const toggleSelectAll = () => {
    if (!filteredTasks?.length) return;
    if (allFilteredSelected) setSelectedTaskIds([]);
    else setSelectedTaskIds(filteredTasks.map(t => t.id));
  };

  const renderContent = () => {
    if (viewMode === 'kanban') return <KanbanView sectorId={sectorId} hideHeader />;
    if (viewMode === 'gantt') return <GanttView sectorId={sectorId} hideHeader />;
    if (viewMode === 'calendar') return <CalendarView sectorId={sectorId} hideHeader />; // Calendar check hideHeader internally

    // List View
    if (isLoading) {
      return <div className="flex justify-center py-12"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;
    }

    if (!filteredTasks?.length) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Calendar className="h-12 w-12 mb-4 opacity-20" />
          <p className="text-lg font-medium">Nenhuma tarefa encontrada</p>
          <p className="text-sm max-w-[250px] text-center mt-2">
            Crie tarefas para começar a organizar seu trabalho
          </p>
        </div>
      );
    }

    return (
      <div>
        {filteredTasks.map(task => (
          <TaskRowItem
            key={task.id}
            task={task}
            isSelected={selectedTask?.id === task.id || selectedTaskIds.includes(task.id)}
            onToggleSelect={handleToggleSelect}
            onDelete={handleDelete}
            onStatusChange={handleStatusChange}
            onClick={() => {
              if (task.routine_id && task.routine) {
                setSelectedRoutine(task.routine);
                setSelectedTask(null);
              } else {
                setSelectedTask(task);
                setSelectedRoutine(null);
              }
            }}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="flex h-full">
      <div className="w-full flex flex-col transition-all duration-300">

        {/* Header Container V3 - Multi-line Local Layout */}
        {!hideHeader && selectedTaskIds.length > 0 ? (
          <div className="flex items-center gap-2 p-2 bg-primary/5 border-b border-primary/20 shadow-sm overflow-x-auto shrink-0 min-h-[50px] mb-4 rounded-lg animate-in fade-in slide-in-from-top-1">
            <span className="text-sm font-medium text-primary ml-2 whitespace-nowrap">
              {selectedTaskIds.length} selecionado{selectedTaskIds.length !== 1 ? 's' : ''}
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
              <Button
                variant="secondary"
                size="sm"
                className="h-8 text-xs gap-1.5 bg-green-100 text-green-700 hover:bg-green-200 border border-green-200"
                onClick={async () => {
                  try {
                    // Permission Check
                    if (!isGestorOrAdmin) {
                      const tasksToComplete = tasks?.filter(t => selectedTaskIds.includes(t.id));
                      const forbiddenTask = tasksToComplete?.find(t => {
                        const isAssigned = t.assigned_to === user?.id || t.assignees?.some((a: any) => a.id === user?.id);
                        return !isAssigned;
                      });

                      if (forbiddenTask) {
                        toast.error("Você só pode concluir tarefas nas quais é responsável.");
                        return;
                      }
                    }

                    await bulkUpdateTasks.mutateAsync({ taskIds: selectedTaskIds, status: 'concluida' });
                    setSelectedTaskIds([]);
                  } catch (e) {
                    console.error("Bulk complete failed", e);
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
                onClick={async () => {
                  try {
                    await deleteTasks.mutateAsync(selectedTaskIds);
                    setSelectedTaskIds([]);
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
                onClick={() => setSelectedTaskIds([])}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ) : !hideHeader && (
          <div className="flex flex-col gap-2 p-2 bg-card border-b border-border shadow-sm mb-4 rounded-lg">

            {/* ROW 1: Search (Small) + Frequency + New */}
            <div className="flex items-center gap-2 w-full overflow-x-auto no-scrollbar">
              {/* Search - Condensed */}
              <div className="relative w-[180px] shrink-0">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 bg-background h-8 text-xs w-full"
                />
              </div>

              {/* Frequency Filters - Right next to search */}
              <div className="flex items-center gap-0.5 bg-secondary/30 p-0.5 rounded-lg border border-border shrink-0">
                {frequencies.map((freq) => (
                  <button
                    key={freq.value}
                    onClick={() => setActiveFrequency(freq.value)}
                    className={cn(
                      'h-7 px-2.5 rounded-md text-xs font-medium transition-all outline-none whitespace-nowrap',
                      activeFrequency === freq.value
                        ? 'bg-black text-white shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-black/5'
                    )}
                  >
                    {freq.label}
                  </button>
                ))}
              </div>

              {/* Spacer */}
              <div className="flex-1" />

              {/* New Task Button */}
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="h-8 gap-1.5 bg-[#F97316] hover:bg-[#EA580C] text-white text-xs px-3 whitespace-nowrap shrink-0">
                    <Plus className="h-3.5 w-3.5" />
                    Nova Tarefa
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Criar Nova Tarefa</DialogTitle>
                  </DialogHeader>
                  <TaskForm
                    sectorId={sectorId}
                    sectionId={sectionId}
                    onSuccess={() => setIsDialogOpen(false)}
                    onCancel={() => setIsDialogOpen(false)}
                  />
                </DialogContent>
              </Dialog>
            </div>

            {/* ROW 2: Status + Priority + Active Filter */}
            <div className="flex items-center gap-2 w-full overflow-x-auto no-scrollbar">

              {/* Status Chips */}
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

              {/* Active Status Filter */}
              <Select value={activeStatusFilter} onValueChange={setActiveStatusFilter}>
                <SelectTrigger className="w-[100px] h-8 text-xs text-muted-foreground bg-background px-2 shrink-0">
                  <SelectValue placeholder="Situação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativos</SelectItem>
                  <SelectItem value="inactive">Inativos</SelectItem>
                  <SelectItem value="all">Todos</SelectItem>
                </SelectContent>
              </Select>

              {/* Priority */}
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-[110px] h-8 text-xs text-muted-foreground bg-background px-2 shrink-0">
                  <SelectValue placeholder="Prioridade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="4">Alta</SelectItem>
                  <SelectItem value="3">Média</SelectItem>
                  <SelectItem value="1">Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-auto rounded-xl">
          {renderContent()}
        </div>
      </div>

      {/* Detail Panel via Sheet */}
      <Sheet open={!!selectedTask || !!selectedRoutine} onOpenChange={(open) => {
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
                contextDate={selectedTask?.due_date || undefined}
                onClose={() => {
                  setSelectedRoutine(null);
                  setSelectedTask(null);
                }}
                onSelectTask={(task) => {
                  setSelectedRoutine(null);
                  setSelectedTask(task);
                }}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};
