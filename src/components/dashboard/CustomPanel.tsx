import { useState } from 'react';
import { Building2, Users, FolderKanban, Settings, Trash2, CheckCircle2, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardPanel, useDeleteDashboardPanel } from '@/hooks/useDashboardPanels';
import { useIsAdmin } from '@/hooks/useUserRole';
import { useTasks } from '@/hooks/useTasks';
import { PanelFormDialog } from './PanelFormDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from 'date-fns';

const FREQUENCIES = ['diaria', 'semanal', 'quinzenal', 'mensal'] as const;
const FREQUENCY_LABELS: Record<string, string> = {
  diaria: 'D',
  semanal: 'S',
  quinzenal: 'Q',
  mensal: 'M',
};
const FREQUENCY_FULL_LABELS: Record<string, string> = {
  diaria: 'Diária',
  semanal: 'Semanal',
  quinzenal: 'Quinzenal',
  mensal: 'Mensal',
};

interface StatusData {
  completed: number;
  pending: number;
  total: number;
}

const getPeriodDates = (period: string) => {
  const now = new Date();
  switch (period) {
    case 'today':
      return { start: startOfDay(now), end: endOfDay(now) };
    case 'week':
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    case 'month':
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case 'quarter':
      return { start: startOfQuarter(now), end: endOfQuarter(now) };
    case 'year':
      return { start: startOfYear(now), end: endOfYear(now) };
    default:
      return null;
  }
};

const useCustomPanelData = (panel: DashboardPanel) => {
  const { filters } = panel;

  return useQuery({
    queryKey: ['custom-panel-data', panel.id, filters],
    refetchInterval: 5000,
    queryFn: async () => {
      // Get period dates
      const periodDates = getPeriodDates(filters.period || 'all');

      // Build tasks query
      let tasksQuery = supabase.from('tasks').select('id, title, status, unit_id, assigned_to, routine_id, created_at, sector_id');

      if (filters.sector_id) {
        if (Array.isArray(filters.sector_id)) {
          if (filters.sector_id.length > 0) tasksQuery = tasksQuery.in('sector_id', filters.sector_id);
        } else {
          tasksQuery = tasksQuery.eq('sector_id', filters.sector_id);
        }
      }
      if (filters.unit_id) {
        if (Array.isArray(filters.unit_id)) {
          if (filters.unit_id.length > 0) tasksQuery = tasksQuery.in('unit_id', filters.unit_id);
        } else {
          tasksQuery = tasksQuery.eq('unit_id', filters.unit_id);
        }
      }
      if (filters.status && filters.status.length > 0) {
        tasksQuery = tasksQuery.in('status', filters.status as ('pendente' | 'em_andamento' | 'concluida' | 'atrasada' | 'cancelada')[]);
      }
      if (filters.title_filter) {
        tasksQuery = tasksQuery.ilike('title', `%${filters.title_filter}%`);
      }
      if (periodDates) {
        tasksQuery = tasksQuery
          .gte('created_at', periodDates.start.toISOString())
          .lte('created_at', periodDates.end.toISOString());
      }

      const { data: rawTasks, error: tasksError } = await tasksQuery;
      if (tasksError) throw tasksError;

      // Get routines for frequency mapping
      const routineIds = [...new Set(rawTasks?.filter(t => t.routine_id).map(t => t.routine_id) || [])];
      let routinesMap: Record<string, string> = {};

      if (routineIds.length > 0) {
        const { data: routines } = await supabase
          .from('routines')
          .select('id, frequency')
          .in('id', routineIds);

        routinesMap = (routines || []).reduce((acc, r) => {
          acc[r.id] = r.frequency;
          return acc;
        }, {} as Record<string, string>);
      }

      // Filter tasks by frequency if specified
      const tasks = rawTasks?.filter(t => {
        if (!filters.task_frequency || filters.task_frequency.length === 0) return true;
        if (!t.routine_id) return false; // Non-routine tasks don't have frequency
        const freq = routinesMap[t.routine_id];
        return filters.task_frequency.includes(freq);
      });

      // Group data based on group_by
      let results: any[] = [];

      if (filters.group_by === 'unit') {
        let unitsQuery = supabase.from('units').select('id, name');
        if (filters.unit_id) {
          if (Array.isArray(filters.unit_id) && filters.unit_id.length > 0) {
            unitsQuery = unitsQuery.in('id', filters.unit_id);
          } else if (!Array.isArray(filters.unit_id)) {
            unitsQuery = unitsQuery.eq('id', filters.unit_id);
          }
        }
        const { data: units } = await unitsQuery;

        results = (units || []).map(unit => {
          const unitTasks = tasks?.filter(t => t.unit_id === unit.id) || [];
          const frequencies: Record<string, StatusData> = {};

          FREQUENCIES.forEach(f => {
            const freqTasks = unitTasks.filter(t => t.routine_id && routinesMap[t.routine_id] === f);
            frequencies[f] = {
              completed: freqTasks.filter(t => t.status === 'concluida').length,
              pending: freqTasks.filter(t => t.status !== 'concluida' && t.status !== 'cancelada').length,
              total: freqTasks.length
            };
          });

          const totals = {
            completed: unitTasks.filter(t => t.status === 'concluida').length,
            pending: unitTasks.filter(t => t.status !== 'concluida' && t.status !== 'cancelada').length,
            total: unitTasks.length
          };

          return { id: unit.id, name: unit.name, frequencies, totals };
        }).filter(u => u.totals.total > 0);
      } else if (filters.group_by === 'responsible') {
        const { data: profiles } = await supabase.from('profiles').select('id, full_name, email');

        results = (profiles || []).map(profile => {
          const profileTasks = tasks?.filter(t => t.assigned_to === profile.id) || [];
          const frequencies: Record<string, StatusData> = {};

          FREQUENCIES.forEach(f => {
            const freqTasks = profileTasks.filter(t => t.routine_id && routinesMap[t.routine_id] === f);
            frequencies[f] = {
              completed: freqTasks.filter(t => t.status === 'concluida').length,
              pending: freqTasks.filter(t => t.status !== 'concluida' && t.status !== 'cancelada').length,
              total: freqTasks.length
            };
          });

          const totals = {
            completed: profileTasks.filter(t => t.status === 'concluida').length,
            pending: profileTasks.filter(t => t.status !== 'concluida' && t.status !== 'cancelada').length,
            total: profileTasks.length
          };

          return { id: profile.id, name: profile.full_name || profile.email, frequencies, totals };
        }).filter(p => p.totals.total > 0);
      } else if (filters.group_by === 'sector') {
        let sectorsQuery = supabase.from('sectors').select('id, name, color');
        if (filters.sector_id) {
          if (Array.isArray(filters.sector_id) && filters.sector_id.length > 0) {
            sectorsQuery = sectorsQuery.in('id', filters.sector_id);
          } else if (!Array.isArray(filters.sector_id)) {
            sectorsQuery = sectorsQuery.eq('id', filters.sector_id);
          }
        }
        const { data: sectors } = await sectorsQuery;

        // Get tasks with sector
        const { data: tasksWithSector } = await supabase
          .from('tasks')
          .select('id, status, sector_id, routine_id, created_at')
          .not('sector_id', 'is', null);

        results = (sectors || []).map(sector => {
          const sectorTasks = tasksWithSector?.filter(t => t.sector_id === sector.id) || [];
          const frequencies: Record<string, StatusData> = {};

          FREQUENCIES.forEach(f => {
            const freqTasks = sectorTasks.filter(t => t.routine_id && routinesMap[t.routine_id] === f);
            frequencies[f] = {
              completed: freqTasks.filter(t => t.status === 'concluida').length,
              pending: freqTasks.filter(t => t.status !== 'concluida' && t.status !== 'cancelada').length,
              total: freqTasks.length
            };
          });

          const totals = {
            completed: sectorTasks.filter(t => t.status === 'concluida').length,
            pending: sectorTasks.filter(t => t.status !== 'concluida' && t.status !== 'cancelada').length,
            total: sectorTasks.length
          };

          return { id: sector.id, name: sector.name, color: sector.color, frequencies, totals };
        }).filter(s => s.totals.total > 0);
      } else if (filters.group_by === 'task_matrix') {
        let unitsQuery = supabase.from('units').select('id, name, code').order('name');
        if (filters.unit_id) {
          if (Array.isArray(filters.unit_id) && filters.unit_id.length > 0) {
            unitsQuery = unitsQuery.in('id', filters.unit_id);
          } else if (!Array.isArray(filters.unit_id)) {
            unitsQuery = unitsQuery.eq('id', filters.unit_id);
          }
        }
        const { data: units } = await unitsQuery;

        // Group tasks by routine (or title if no routine)
        const routineMap = new Map<string, { id: string, name: string, units: Record<string, any> }>();

        // Pre-fill with routines if we have them in the filtered set
        const distinctRoutineIds = [...new Set(tasks?.map(t => t.routine_id).filter(Boolean))];

        if (distinctRoutineIds.length > 0) {
          const { data: routines } = await supabase
            .from('routines')
            .select('id, title')
            .in('id', distinctRoutineIds as string[]);

          routines?.forEach(r => {
            routineMap.set(r.id, { id: r.id, name: r.title, units: {} });
          });
        }

        // Also handle ad-hoc tasks by grouping by title
        tasks?.forEach(task => {
          let key = task.routine_id || `title:${task.title}`;
          let name = task.title;

          if (task.routine_id && routineMap.has(task.routine_id)) {
            name = routineMap.get(task.routine_id)!.name;
          } else if (!routineMap.has(key)) {
            routineMap.set(key, { id: key, name: name, units: {} });
          }

          const entry = routineMap.get(key)!;
          entry.units[task.unit_id || 'unassigned'] = {
            status: task.status,
            taskId: task.id,
            date: task.created_at
          };
        });

        results = Array.from(routineMap.values());
        return { results, routinesMap, units: units || [] };
      }

      return { results, routinesMap };
    }
  });
};

interface StatusBadgeProps {
  data: StatusData;
  frequency: string;
  onClick?: () => void;
}

const StatusBadge = ({ data, frequency, onClick }: StatusBadgeProps) => {
  if (data.total === 0) {
    return <div className="w-7 h-7 rounded bg-secondary/30 flex items-center justify-center text-muted-foreground text-[10px]">-</div>;
  }

  const percentage = Math.round((data.completed / data.total) * 100);
  const isComplete = percentage === 100;
  const isGood = percentage >= 70;
  const isWarning = percentage >= 40 && percentage < 70;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            onClick={onClick}
            className={cn(
              'w-7 h-7 rounded flex items-center justify-center text-[10px] font-bold transition-transform hover:scale-110',
              onClick && 'cursor-pointer hover:ring-2 hover:ring-primary/50',
              !onClick && 'cursor-default',
              isComplete && 'bg-success/20 text-success',
              isGood && !isComplete && 'bg-emerald-500/20 text-emerald-400',
              isWarning && 'bg-warning/20 text-warning',
              !isGood && !isWarning && 'bg-destructive/20 text-destructive'
            )}
          >
            {isComplete ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : (
              <span>{data.completed}/{data.total}</span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <p className="font-semibold">{FREQUENCY_FULL_LABELS[frequency]}</p>
          <p>{data.completed}/{data.total} ({percentage}%)</p>
          {onClick && <p className="text-muted-foreground">Clique para ver tarefas</p>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const TotalBadge = ({ data }: { data: StatusData }) => {
  if (data.total === 0) return <span className="text-muted-foreground text-xs">-</span>;

  const percentage = Math.round((data.completed / data.total) * 100);
  const isGood = percentage >= 70;
  const isWarning = percentage >= 40 && percentage < 70;

  return (
    <span className={cn(
      'text-xs font-bold',
      isGood ? 'text-success' : isWarning ? 'text-warning' : 'text-destructive'
    )}>
      {percentage}%
    </span>
  );
};

const getGroupIcon = (groupBy: string) => {
  switch (groupBy) {
    case 'unit': return Building2;
    case 'responsible': return Users;
    case 'sector': return FolderKanban;
    default: return Building2;
  }
};

interface TasksDialogState {
  isOpen: boolean;
  title: string;
  entityId: string;
  entityType: 'unit' | 'responsible' | 'sector';
  frequency: string;
}

const STATUS_LABELS: Record<string, string> = {
  pendente: 'Pendente',
  em_andamento: 'Em Andamento',
  concluida: 'Concluída',
  atrasada: 'Atrasada',
  cancelada: 'Cancelada',
};

interface CustomPanelProps {
  panel: DashboardPanel;
}

export const CustomPanel = ({ panel }: CustomPanelProps) => {
  const { data: panelData, isLoading } = useCustomPanelData(panel);
  const { data: allTasks } = useTasks();
  const deletePanel = useDeleteDashboardPanel();
  const { isAdmin } = useIsAdmin();
  const Icon = getGroupIcon(panel.filters.group_by);

  const [tasksDialog, setTasksDialog] = useState<TasksDialogState>({
    isOpen: false,
    title: '',
    entityId: '',
    entityType: 'unit',
    frequency: '',
  });

  const openTasksDialog = (
    entityId: string,
    entityName: string,
    entityType: 'unit' | 'responsible' | 'sector',
    frequency: string
  ) => {
    setTasksDialog({
      isOpen: true,
      title: entityName,
      entityId,
      entityType,
      frequency,
    });
  };

  const closeTasksDialog = () => {
    setTasksDialog(prev => ({ ...prev, isOpen: false }));
  };

  // Filter tasks based on dialog state
  const filteredTasks = allTasks?.filter(task => {
    if (!tasksDialog.isOpen) return false;

    // Filter by entity type
    if (tasksDialog.entityType === 'unit') {
      if (task.unit_id !== tasksDialog.entityId) return false;
    } else if (tasksDialog.entityType === 'responsible') {
      if (task.assigned_to !== tasksDialog.entityId) return false;
    } else if (tasksDialog.entityType === 'sector') {
      if (task.sector_id !== tasksDialog.entityId) return false;
    }

    // Filter by panel's sector if set
    if (panel.filters.sector_id) {
      if (Array.isArray(panel.filters.sector_id)) {
        if (!panel.filters.sector_id.includes(task.sector_id)) return false;
      } else if (task.sector_id !== panel.filters.sector_id) {
        return false;
      }
    }

    // Filter by panel's title filter if set
    if (panel.filters.title_filter && !task.title.toLowerCase().includes(panel.filters.title_filter.toLowerCase())) return false;

    // Filter by frequency (using routine map from panel data)
    if (tasksDialog.frequency && panelData?.routinesMap) {
      if (!task.routine_id) return false;
      const freq = panelData.routinesMap[task.routine_id];
      if (freq !== tasksDialog.frequency) return false;
    }

    return true;
  }) || [];

  // Determine visible frequencies
  const visibleFrequencies = panel.filters.task_frequency && panel.filters.task_frequency.length > 0
    ? FREQUENCIES.filter(f => panel.filters.task_frequency?.includes(f))
    : FREQUENCIES;

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      );
    }

    if (!panelData?.results.length) {
      return <div className="p-4 text-center text-muted-foreground text-xs">Sem dados para os filtros selecionados</div>;
    }

    if (panel.filters.group_by === 'task_matrix') {
      return (
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 bg-card z-10 shadow-sm">
            <tr className="border-b border-border">
              <th className="text-left p-2 font-medium text-muted-foreground min-w-[200px] sticky left-0 bg-card z-20 border-r">Tarefa</th>
              {panelData.units?.map((u: any) => (
                <th key={u.id} className="p-2 text-center font-medium text-muted-foreground min-w-[60px] whitespace-nowrap" title={u.name}>
                  {u.code || u.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {panelData.results.map((row: any) => (
              <tr key={row.id} className="hover:bg-secondary/20">
                <td className="p-2 font-medium text-foreground sticky left-0 bg-card z-10 border-r group-hover:bg-secondary/20 truncate max-w-[200px]" title={row.name}>
                  {row.name}
                </td>
                {panelData.units?.map((u: any) => {
                  const cell = row.units[u.id];
                  return (
                    <td key={u.id} className="p-2 text-center border-l border-border/30">
                      {cell ? (
                        <div className="flex justify-center">
                          {cell.status === 'concluida' ? (
                            <div className="w-6 h-6 rounded-full bg-success/20 text-success flex items-center justify-center">
                              <CheckCircle2 className="w-4 h-4" />
                            </div>
                          ) : (
                            <div className={cn(
                              "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold",
                              cell.status === 'atrasada' ? "bg-destructive/20 text-destructive" :
                                cell.status === 'em_andamento' ? "bg-warning/20 text-warning" :
                                  "bg-secondary text-muted-foreground"
                            )}>
                              {cell.status === 'atrasada' ? '!' : '-'}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground/30 text-[10px]">-</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    return (
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-card z-10">
          <tr className="border-b border-border">
            <th className="text-left p-2 font-medium text-muted-foreground">Nome</th>
            {visibleFrequencies.map(f => <th key={f} className="p-1 text-center font-medium text-muted-foreground min-w-[36px]">{FREQUENCY_LABELS[f]}</th>)}
            <th className="p-2 text-right font-medium text-muted-foreground w-10">%</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {panelData?.results.map((item: { id: string; name: string; frequencies: Record<string, StatusData>; totals: StatusData }) => (
            <tr key={item.id} className="hover:bg-secondary/20">
              <td className="p-2">
                <p className="font-medium text-foreground" title={item.name}>{item.name}</p>
              </td>
              {visibleFrequencies.map(f => (
                <td key={f} className="p-1 text-center">
                  <StatusBadge
                    data={item.frequencies[f]}
                    frequency={f}
                    onClick={item.frequencies[f].total > 0
                      ? () => openTasksDialog(
                        item.id,
                        item.name,
                        panel.filters.group_by as 'unit' | 'responsible' | 'sector',
                        f
                      )
                      : undefined
                    }
                  />
                </td>
              ))}
              <td className="p-2 text-right"><TotalBadge data={item.totals} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <>
      <div
        className="rounded-lg border border-border bg-card overflow-hidden flex flex-col resize"
        style={{
          minHeight: 150,
          minWidth: 280,
          height: 280,
          maxWidth: '100%'
        }}
      >
        <div className="px-3 py-2 border-b border-border flex items-center gap-2 bg-secondary/30 flex-shrink-0">
          <Icon className="w-4 h-4 text-primary" />
          <span className="font-medium text-sm truncate">{panel.title}</span>
          <span className="text-[10px] text-muted-foreground ml-auto">{panelData?.results.length || 0}</span>

          {isAdmin && (
            <div className="flex items-center gap-1 ml-2">
              <PanelFormDialog
                panel={panel}
                trigger={
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <Settings className="w-3 h-3" />
                  </Button>
                }
              />

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive">
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remover painel?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação não pode ser desfeita. O painel "{panel.title}" será removido permanentemente.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deletePanel.mutate(panel.id)}>
                      Remover
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>

        <div className="overflow-auto flex-1">
          {renderContent()}
        </div>
      </div>

      {/* Tasks Dialog */}
      <Dialog open={tasksDialog.isOpen} onOpenChange={(open) => !open && closeTasksDialog()}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon className="w-5 h-5 text-primary" />
              {tasksDialog.title}
              {tasksDialog.frequency && (
                <Badge variant="secondary" className="ml-2">
                  {FREQUENCY_FULL_LABELS[tasksDialog.frequency] || tasksDialog.frequency}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-auto">
            {filteredTasks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma tarefa encontrada
              </div>
            ) : (
              <div className="space-y-2">
                {filteredTasks.map(task => (
                  <div
                    key={task.id}
                    className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{task.title}</p>
                        {task.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                            {task.description}
                          </p>
                        )}
                      </div>
                      <Badge
                        variant={
                          task.status === 'concluida' ? 'default' :
                            task.status === 'atrasada' ? 'destructive' :
                              task.status === 'em_andamento' ? 'secondary' :
                                'outline'
                        }
                        className="shrink-0"
                      >
                        {STATUS_LABELS[task.status] || task.status}
                      </Badge>
                    </div>
                    {task.due_date && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Prazo: {new Date(task.due_date).toLocaleDateString('pt-BR')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
