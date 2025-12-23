import { Building2, Users, FolderKanban, Settings, Trash2, CheckCircle2, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardPanel, useDeleteDashboardPanel } from '@/hooks/useDashboardPanels';
import { useIsAdmin } from '@/hooks/useUserRole';
import { PanelFormDialog } from './PanelFormDialog';
import { Button } from '@/components/ui/button';
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
    queryFn: async () => {
      // Get period dates
      const periodDates = getPeriodDates(filters.period || 'all');

      // Build tasks query
      let tasksQuery = supabase.from('tasks').select('id, status, unit_id, assigned_to, routine_id, created_at');
      
      if (filters.sector_id) {
        tasksQuery = tasksQuery.eq('sector_id', filters.sector_id);
      }
      if (filters.unit_id) {
        tasksQuery = tasksQuery.eq('unit_id', filters.unit_id);
      }
      if (filters.status && filters.status.length > 0) {
        tasksQuery = tasksQuery.in('status', filters.status as ('pendente' | 'em_andamento' | 'concluida' | 'atrasada' | 'cancelada')[]);
      }
      if (periodDates) {
        tasksQuery = tasksQuery
          .gte('created_at', periodDates.start.toISOString())
          .lte('created_at', periodDates.end.toISOString());
      }

      const { data: tasks, error: tasksError } = await tasksQuery;
      if (tasksError) throw tasksError;

      // Get routines for frequency mapping
      const routineIds = [...new Set(tasks?.filter(t => t.routine_id).map(t => t.routine_id) || [])];
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

      // Group data based on group_by
      if (filters.group_by === 'unit') {
        const { data: units } = await supabase.from('units').select('id, name');
        
        return (units || []).map(unit => {
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
      }

      if (filters.group_by === 'responsible') {
        const { data: profiles } = await supabase.from('profiles').select('id, full_name, email');
        
        return (profiles || []).map(profile => {
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
      }

      if (filters.group_by === 'sector') {
        const { data: sectors } = await supabase.from('sectors').select('id, name, color');
        
        // Get tasks with sector
        const { data: tasksWithSector } = await supabase
          .from('tasks')
          .select('id, status, sector_id, routine_id, created_at')
          .not('sector_id', 'is', null);

        return (sectors || []).map(sector => {
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
      }

      return [];
    }
  });
};

const StatusBadge = ({ data, frequency }: { data: StatusData; frequency: string }) => {
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
            className={cn(
              'w-7 h-7 rounded flex items-center justify-center text-[10px] font-bold cursor-default transition-transform hover:scale-110',
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

interface CustomPanelProps {
  panel: DashboardPanel;
}

export const CustomPanel = ({ panel }: CustomPanelProps) => {
  const { data, isLoading } = useCustomPanelData(panel);
  const deletePanel = useDeleteDashboardPanel();
  const { isAdmin } = useIsAdmin();
  const Icon = getGroupIcon(panel.filters.group_by);

  return (
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
        <span className="text-[10px] text-muted-foreground ml-auto">{data?.length || 0}</span>
        
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
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : data?.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-xs">Sem dados para os filtros selecionados</div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-card z-10">
              <tr className="border-b border-border">
                <th className="text-left p-2 font-medium text-muted-foreground">Nome</th>
                {FREQUENCIES.map(f => <th key={f} className="p-1 text-center font-medium text-muted-foreground w-9">{FREQUENCY_LABELS[f]}</th>)}
                <th className="p-2 text-right font-medium text-muted-foreground w-10">%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {data?.map((item: { id: string; name: string; frequencies: Record<string, StatusData>; totals: StatusData }) => (
                <tr key={item.id} className="hover:bg-secondary/20">
                  <td className="p-2">
                    <p className="font-medium text-foreground" title={item.name}>{item.name}</p>
                  </td>
                  {FREQUENCIES.map(f => (
                    <td key={f} className="p-1 text-center">
                      <StatusBadge data={item.frequencies[f]} frequency={f} />
                    </td>
                  ))}
                  <td className="p-2 text-right"><TotalBadge data={item.totals} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
