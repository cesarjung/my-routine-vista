import { useState } from 'react';
import { Building2, Users, Loader2, CheckCircle2 } from 'lucide-react';
import { useUnitRoutineStatus, useResponsibleRoutineStatus, useOverallStats } from '@/hooks/useDashboardData';
import { useSectors } from '@/hooks/useSectors';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

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

interface ResizablePanelProps {
  title: string;
  icon: React.ElementType;
  count: number;
  children: React.ReactNode;
  defaultHeight?: number;
  defaultWidth?: string;
}

const ResizablePanel = ({ title, icon: Icon, count, children, defaultHeight = 280, defaultWidth = '100%' }: ResizablePanelProps) => {
  return (
    <div
      className="rounded-lg border border-border bg-card overflow-hidden flex flex-col resize"
      style={{ 
        minHeight: 150, 
        minWidth: 280, 
        height: defaultHeight,
        width: defaultWidth,
        maxWidth: '100%'
      }}
    >
      <div className="px-3 py-2 border-b border-border flex items-center gap-2 bg-secondary/30 flex-shrink-0">
        <Icon className="w-4 h-4 text-primary" />
        <span className="font-medium text-sm">{title}</span>
        <span className="text-[10px] text-muted-foreground ml-auto">{count}</span>
      </div>
      <div className="overflow-auto flex-1">
        {children}
      </div>
    </div>
  );
};

export const DashboardView = () => {
  const [selectedSectorId, setSelectedSectorId] = useState<string | null>(null);
  
  const { data: sectors } = useSectors();
  const { data: statsData } = useOverallStats(selectedSectorId);
  const { data: unitStatus, isLoading: loadingUnits } = useUnitRoutineStatus(selectedSectorId);
  const { data: responsibleStatus, isLoading: loadingResponsibles } = useResponsibleRoutineStatus(selectedSectorId);

  const isLoading = loadingUnits || loadingResponsibles;
  const overallPercentage = statsData?.percentage || 0;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-foreground">Dashboard</h1>
          <div className={cn(
            'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold',
            overallPercentage >= 70 ? 'bg-success/20 text-success' :
            overallPercentage >= 40 ? 'bg-warning/20 text-warning' :
            'bg-destructive/20 text-destructive'
          )}>
            {overallPercentage}%
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Select
            value={selectedSectorId || 'all'}
            onValueChange={(value) => setSelectedSectorId(value === 'all' ? null : value)}
          >
            <SelectTrigger className="h-8 w-[150px] text-xs">
              <SelectValue placeholder="Setor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {sectors?.map(sector => (
                <SelectItem key={sector.id} value={sector.id}>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: sector.color || '#6366f1' }} />
                    {sector.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
        <span><b>D</b>=Diária <b>S</b>=Semanal <b>Q</b>=Quinzenal <b>M</b>=Mensal</span>
        <span className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-success/30" />100%</span>
        <span className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-emerald-500/30" />≥70%</span>
        <span className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-warning/30" />≥40%</span>
        <span className="flex items-center gap-1"><div className="w-2 h-2 rounded bg-destructive/30" />&lt;40%</span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
          {/* Units Panel */}
          <ResizablePanel title="Unidades" icon={Building2} count={unitStatus?.length || 0}>
            {unitStatus?.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground text-xs">Sem dados</div>
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
                  {unitStatus?.map(unit => (
                    <tr key={unit.id} className="hover:bg-secondary/20">
                      <td className="p-2">
                        <p className="font-medium text-foreground truncate max-w-[100px]" title={unit.name}>{unit.name}</p>
                      </td>
                      {FREQUENCIES.map(f => (
                        <td key={f} className="p-1 text-center">
                          <StatusBadge data={unit.frequencies[f]} frequency={f} />
                        </td>
                      ))}
                      <td className="p-2 text-right"><TotalBadge data={unit.totals} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </ResizablePanel>

          {/* Responsibles Panel */}
          <ResizablePanel title="Responsáveis" icon={Users} count={responsibleStatus?.length || 0}>
            {responsibleStatus?.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground text-xs">Sem dados</div>
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
                  {responsibleStatus?.map(person => (
                    <tr key={person.id} className="hover:bg-secondary/20">
                      <td className="p-2">
                        <p className="font-medium text-foreground truncate max-w-[100px]" title={person.name}>{person.name}</p>
                      </td>
                      {FREQUENCIES.map(f => (
                        <td key={f} className="p-1 text-center">
                          <StatusBadge data={person.frequencies[f]} frequency={f} />
                        </td>
                      ))}
                      <td className="p-2 text-right"><TotalBadge data={person.totals} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </ResizablePanel>
        </div>
      )}
    </div>
  );
};
