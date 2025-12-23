import { useState } from 'react';
import { Building2, Users, Layers, LayoutGrid, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
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
    return <div className="w-10 h-10 rounded-lg bg-secondary/30 flex items-center justify-center text-muted-foreground text-xs">-</div>;
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
              'w-10 h-10 rounded-lg flex flex-col items-center justify-center text-xs font-bold cursor-default transition-transform hover:scale-110',
              isComplete && 'bg-success/20 text-success',
              isGood && !isComplete && 'bg-emerald-500/20 text-emerald-400',
              isWarning && 'bg-warning/20 text-warning',
              !isGood && !isWarning && 'bg-destructive/20 text-destructive'
            )}
          >
            {isComplete ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <>
                <span>{data.completed}</span>
                <span className="text-[10px] opacity-70">/{data.total}</span>
              </>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <p className="font-semibold">{FREQUENCY_FULL_LABELS[frequency]}</p>
          <p>{data.completed} de {data.total} concluídas ({percentage}%)</p>
          {data.pending > 0 && <p className="text-warning">{data.pending} pendentes</p>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const TotalBadge = ({ data }: { data: StatusData }) => {
  if (data.total === 0) {
    return <span className="text-muted-foreground">-</span>;
  }

  const percentage = Math.round((data.completed / data.total) * 100);
  const isGood = percentage >= 70;
  const isWarning = percentage >= 40 && percentage < 70;

  return (
    <div className="flex items-center gap-2">
      <div className="w-12 h-1.5 bg-secondary rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full',
            isGood ? 'bg-success' : isWarning ? 'bg-warning' : 'bg-destructive'
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className={cn(
        'text-sm font-bold min-w-[36px]',
        isGood ? 'text-success' : isWarning ? 'text-warning' : 'text-destructive'
      )}>
        {percentage}%
      </span>
    </div>
  );
};

export const DashboardView = () => {
  const [selectedSectorId, setSelectedSectorId] = useState<string | null>(null);
  
  const { data: sectors, isLoading: loadingSectors } = useSectors();
  const { data: statsData } = useOverallStats(selectedSectorId);
  const { data: unitStatus, isLoading: loadingUnits } = useUnitRoutineStatus(selectedSectorId);
  const { data: responsibleStatus, isLoading: loadingResponsibles } = useResponsibleRoutineStatus(selectedSectorId);

  const selectedSector = sectors?.find(s => s.id === selectedSectorId);
  const isLoading = loadingUnits || loadingResponsibles;

  const overallPercentage = statsData?.percentage || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          
          {/* Overall indicator */}
          <div className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold',
            overallPercentage >= 70 ? 'bg-success/20 text-success' :
            overallPercentage >= 40 ? 'bg-warning/20 text-warning' :
            'bg-destructive/20 text-destructive'
          )}>
            {overallPercentage >= 70 ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
            {overallPercentage}% geral
          </div>
        </div>
        
        {/* Sector filter */}
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-muted-foreground" />
          <Select
            value={selectedSectorId || 'all'}
            onValueChange={(value) => setSelectedSectorId(value === 'all' ? null : value)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Setor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <div className="flex items-center gap-2">
                  <LayoutGrid className="w-4 h-4" />
                  <span>Todos</span>
                </div>
              </SelectItem>
              {sectors?.map(sector => (
                <SelectItem key={sector.id} value={sector.id}>
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: sector.color || '#6366f1' }}
                    />
                    <span>{sector.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="font-medium">Legenda:</span>
        <span><strong>D</strong> = Diária</span>
        <span><strong>S</strong> = Semanal</span>
        <span><strong>Q</strong> = Quinzenal</span>
        <span><strong>M</strong> = Mensal</span>
        <span className="ml-4 flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-success/20" /> 100%
        </span>
        <span className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-emerald-500/20" /> ≥70%
        </span>
        <span className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-warning/20" /> ≥40%
        </span>
        <span className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-destructive/20" /> &lt;40%
        </span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Units Matrix */}
          <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
            <div className="p-4 border-b border-border flex items-center gap-2 bg-secondary/30">
              <Building2 className="w-5 h-5 text-primary" />
              <h2 className="font-semibold text-foreground">Por Unidade</h2>
              <span className="text-xs text-muted-foreground ml-auto">
                {unitStatus?.length || 0} unidades
              </span>
            </div>

            {unitStatus?.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                Nenhuma rotina encontrada
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Unidade</th>
                      {FREQUENCIES.map(freq => (
                        <th key={freq} className="p-3 text-center text-sm font-medium text-muted-foreground w-14">
                          {FREQUENCY_LABELS[freq]}
                        </th>
                      ))}
                      <th className="p-3 text-right text-sm font-medium text-muted-foreground">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {unitStatus?.map((unit, index) => (
                      <tr 
                        key={unit.id} 
                        className="hover:bg-secondary/20 transition-colors animate-fade-in"
                        style={{ animationDelay: `${index * 20}ms` }}
                      >
                        <td className="p-3">
                          <div className="max-w-[180px]">
                            <p className="font-medium text-foreground text-sm truncate">{unit.name}</p>
                            <p className="text-xs text-muted-foreground">{unit.code}</p>
                          </div>
                        </td>
                        {FREQUENCIES.map(freq => (
                          <td key={freq} className="p-2 text-center">
                            <div className="flex justify-center">
                              <StatusBadge data={unit.frequencies[freq]} frequency={freq} />
                            </div>
                          </td>
                        ))}
                        <td className="p-3">
                          <div className="flex justify-end">
                            <TotalBadge data={unit.totals} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Responsibles Matrix */}
          <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
            <div className="p-4 border-b border-border flex items-center gap-2 bg-secondary/30">
              <Users className="w-5 h-5 text-primary" />
              <h2 className="font-semibold text-foreground">Por Responsável</h2>
              <span className="text-xs text-muted-foreground ml-auto">
                {responsibleStatus?.length || 0} pessoas
              </span>
            </div>

            {responsibleStatus?.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                Nenhuma rotina atribuída
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Responsável</th>
                      {FREQUENCIES.map(freq => (
                        <th key={freq} className="p-3 text-center text-sm font-medium text-muted-foreground w-14">
                          {FREQUENCY_LABELS[freq]}
                        </th>
                      ))}
                      <th className="p-3 text-right text-sm font-medium text-muted-foreground">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {responsibleStatus?.map((person, index) => (
                      <tr 
                        key={person.id} 
                        className="hover:bg-secondary/20 transition-colors animate-fade-in"
                        style={{ animationDelay: `${index * 20}ms` }}
                      >
                        <td className="p-3">
                          <div className="max-w-[180px]">
                            <p className="font-medium text-foreground text-sm truncate">{person.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{person.email}</p>
                          </div>
                        </td>
                        {FREQUENCIES.map(freq => (
                          <td key={freq} className="p-2 text-center">
                            <div className="flex justify-center">
                              <StatusBadge data={person.frequencies[freq]} frequency={freq} />
                            </div>
                          </td>
                        ))}
                        <td className="p-3">
                          <div className="flex justify-end">
                            <TotalBadge data={person.totals} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
