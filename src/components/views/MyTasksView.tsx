import { useState } from 'react';
import { useTasks } from '@/hooks/useTasks';
import { useRoutines } from '@/hooks/useRoutines';
import { useAuth } from '@/contexts/AuthContext';
import { useSectors } from '@/hooks/useSectors';
import { cn } from '@/lib/utils';
import { 
  CheckCircle2, 
  Clock, 
  User, 
  Loader2, 
  Calendar,
  ClipboardList,
  ChevronDown,
  ChevronRight,
  Building2,
  List,
  Columns3,
  CalendarDays,
  GanttChart
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ViewMode } from '@/types/navigation';
import { KanbanView } from './KanbanView';
import { CalendarView } from './CalendarView';
import { GanttView } from './GanttView';

const statusLabels: Record<string, string> = {
  pendente: 'Pendente',
  em_andamento: 'Em Andamento',
  concluida: 'Concluída',
  atrasada: 'Atrasada',
  cancelada: 'Cancelada',
};

const statusColors: Record<string, string> = {
  pendente: 'bg-warning/10 text-warning border-warning/30',
  em_andamento: 'bg-primary/10 text-primary border-primary/30',
  concluida: 'bg-success/10 text-success border-success/30',
  atrasada: 'bg-destructive/10 text-destructive border-destructive/30',
  cancelada: 'bg-muted text-muted-foreground border-muted',
};

const frequencyLabels: Record<string, string> = {
  diaria: 'Diária',
  semanal: 'Semanal',
  quinzenal: 'Quinzenal',
  mensal: 'Mensal',
  anual: 'Anual',
};

const VIEW_OPTIONS = [
  { value: 'list' as ViewMode, label: 'Lista', icon: List },
  { value: 'kanban' as ViewMode, label: 'Quadro', icon: Columns3 },
  { value: 'calendar' as ViewMode, label: 'Calendário', icon: CalendarDays },
  { value: 'gantt' as ViewMode, label: 'Gantt', icon: GanttChart },
];

export const MyTasksView = () => {
  const { user } = useAuth();
  const { data: tasks, isLoading: tasksLoading } = useTasks();
  const { data: routines, isLoading: routinesLoading } = useRoutines();
  const { data: sectors } = useSectors();
  
  const [expandedSectors, setExpandedSectors] = useState<Set<string>>(new Set(['all']));
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  const isLoading = tasksLoading || routinesLoading;

  // Filter tasks assigned to current user
  const myTasks = tasks?.filter(t => t.assigned_to === user?.id) || [];
  
  // Filter routines created by current user
  const myRoutines = routines?.filter(r => r.created_by === user?.id) || [];

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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1">Minhas Tarefas</h1>
          <p className="text-muted-foreground">Tarefas e rotinas atribuídas a você</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  const allSectorIds = [...new Set([...Object.keys(tasksBySector), ...Object.keys(routinesBySector)])];

  // Render different views based on viewMode
  const renderTasksContent = () => {
    if (viewMode === 'kanban') {
      return <KanbanView isMyTasks />;
    }
    if (viewMode === 'calendar') {
      return <CalendarView isMyTasks />;
    }
    if (viewMode === 'gantt') {
      return <GanttView isMyTasks />;
    }

    // Default list view
    if (myTasks.length === 0) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhuma tarefa atribuída a você</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {allSectorIds.filter(id => tasksBySector[id]?.length > 0).map((sectorId) => {
          const sectorTasks = tasksBySector[sectorId] || [];
          const isExpanded = expandedSectors.has(sectorId);
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
                    <div key={task.id} className="px-4 py-3 flex items-center gap-3 hover:bg-secondary/20 transition-colors">
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        task.status === 'pendente' && "bg-warning",
                        task.status === 'em_andamento' && "bg-primary",
                        task.status === 'concluida' && "bg-success",
                        task.status === 'atrasada' && "bg-destructive"
                      )} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{task.title}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Building2 className="w-3 h-3" />
                          <span>{task.unit?.name}</span>
                          {task.due_date && (
                            <>
                              <span>•</span>
                              <Clock className="w-3 h-3" />
                              <span>{new Date(task.due_date).toLocaleDateString('pt-BR')}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <Badge variant="outline" className={cn("text-xs", statusColors[task.status])}>
                        {statusLabels[task.status]}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1">Minhas Tarefas</h1>
          <p className="text-muted-foreground">
            {myTasks.length} tarefa{myTasks.length !== 1 ? 's' : ''} e {myRoutines.length} rotina{myRoutines.length !== 1 ? 's' : ''} atribuídas a você
          </p>
        </div>
        
        {/* View Mode Toggle */}
        <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as ViewMode)}>
          {VIEW_OPTIONS.map((option) => {
            const Icon = option.icon;
            return (
              <ToggleGroupItem
                key={option.value}
                value={option.value}
                aria-label={option.label}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 text-sm',
                  viewMode === option.value && 'bg-primary/10 text-primary'
                )}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{option.label}</span>
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>
      </div>

      <Tabs defaultValue="tasks" className="w-full">
        <TabsList>
          <TabsTrigger value="tasks" className="gap-2">
            <ClipboardList className="w-4 h-4" />
            Tarefas ({myTasks.length})
          </TabsTrigger>
          <TabsTrigger value="routines" className="gap-2">
            <Calendar className="w-4 h-4" />
            Rotinas ({myRoutines.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="mt-4">
          {renderTasksContent()}
        </TabsContent>

        <TabsContent value="routines" className="mt-4">
          {myRoutines.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma rotina atribuída a você</p>
            </div>
          ) : (
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
                          <div key={routine.id} className="px-4 py-3 flex items-center gap-3 hover:bg-secondary/20 transition-colors">
                            <Calendar className="w-4 h-4 text-primary" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-foreground truncate">{routine.title}</p>
                              {routine.description && (
                                <p className="text-xs text-muted-foreground truncate">{routine.description}</p>
                              )}
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {frequencyLabels[routine.frequency]}
                            </Badge>
                            {routine.is_active ? (
                              <Badge className="bg-success/10 text-success border-success/30 text-xs">Ativa</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">Inativa</Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
