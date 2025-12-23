import { useState } from 'react';
import { Building2, Users, Layers, LayoutGrid, Loader2, CheckCircle2, Clock } from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const FREQUENCY_LABELS: Record<string, string> = {
  diaria: 'Diária',
  semanal: 'Semanal',
  quinzenal: 'Quinzenal',
  mensal: 'Mensal',
};

const FREQUENCY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  diaria: { bg: 'bg-sky-500/10', text: 'text-sky-400', border: 'border-sky-500/30' },
  semanal: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  quinzenal: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  mensal: { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/30' },
};

interface StatusCellProps {
  completed: number;
  pending: number;
  total: number;
  frequency: string;
}

const StatusCell = ({ completed, pending, total, frequency }: StatusCellProps) => {
  if (total === 0) {
    return <span className="text-muted-foreground text-sm">-</span>;
  }

  const colors = FREQUENCY_COLORS[frequency];
  const percentage = Math.round((completed / total) * 100);

  return (
    <div className="flex flex-col items-center gap-1">
      <div className={cn('flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium', colors.bg, colors.text)}>
        <CheckCircle2 className="w-3 h-3" />
        <span>{completed}</span>
        <span className="text-muted-foreground">/</span>
        <span>{total}</span>
      </div>
      {pending > 0 && (
        <div className="flex items-center gap-1 text-xs text-warning">
          <Clock className="w-3 h-3" />
          <span>{pending} pend.</span>
        </div>
      )}
    </div>
  );
};

interface TotalsCellProps {
  completed: number;
  pending: number;
  total: number;
}

const TotalsCell = ({ completed, pending, total }: TotalsCellProps) => {
  if (total === 0) {
    return <span className="text-muted-foreground">-</span>;
  }

  const percentage = Math.round((completed / total) * 100);
  const statusColor = percentage >= 70 ? 'text-success' : percentage >= 40 ? 'text-warning' : 'text-destructive';
  const statusBg = percentage >= 70 ? 'bg-success' : percentage >= 40 ? 'bg-warning' : 'bg-destructive';

  return (
    <div className="flex flex-col items-end gap-1">
      <span className={cn('text-lg font-bold', statusColor)}>{percentage}%</span>
      <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
        <div 
          className={cn('h-full rounded-full', statusBg)} 
          style={{ width: `${percentage}%` }} 
        />
      </div>
      <span className="text-xs text-muted-foreground">{completed}/{total}</span>
    </div>
  );
};

export const DashboardView = () => {
  const [selectedSectorId, setSelectedSectorId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'units' | 'responsibles'>('units');
  
  const { data: sectors, isLoading: loadingSectors } = useSectors();
  const { data: statsData } = useOverallStats(selectedSectorId);
  const { data: unitStatus, isLoading: loadingUnits } = useUnitRoutineStatus(selectedSectorId);
  const { data: responsibleStatus, isLoading: loadingResponsibles } = useResponsibleRoutineStatus(selectedSectorId);

  const selectedSector = sectors?.find(s => s.id === selectedSectorId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Dashboard de Rotinas
          </h1>
          <p className="text-muted-foreground text-sm">
            {selectedSector 
              ? `Visualizando rotinas do setor ${selectedSector.name}` 
              : 'Visão geral de todas as rotinas'}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Quick stats */}
          <div className="hidden md:flex items-center gap-4 px-4 py-2 rounded-lg bg-card border border-border">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-success" />
              <span className="text-sm">
                <span className="font-bold text-success">{statsData?.completed || 0}</span>
                <span className="text-muted-foreground"> concluídas</span>
              </span>
            </div>
            <div className="w-px h-4 bg-border" />
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-warning" />
              <span className="text-sm">
                <span className="font-bold text-warning">{statsData?.pending || 0}</span>
                <span className="text-muted-foreground"> pendentes</span>
              </span>
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
                <SelectValue placeholder="Selecionar setor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <div className="flex items-center gap-2">
                    <LayoutGrid className="w-4 h-4" />
                    <span>Todos os Setores</span>
                  </div>
                </SelectItem>
                {loadingSectors ? (
                  <div className="p-2 flex items-center justify-center">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                ) : (
                  sectors?.map(sector => (
                    <SelectItem key={sector.id} value={sector.id}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: sector.color || '#6366f1' }}
                        />
                        <span>{sector.name}</span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'units' | 'responsibles')}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="units" className="flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Por Unidade
          </TabsTrigger>
          <TabsTrigger value="responsibles" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Por Responsável
          </TabsTrigger>
        </TabsList>

        {/* Table Header - Frequency labels */}
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          {Object.entries(FREQUENCY_LABELS).map(([key, label]) => (
            <div 
              key={key}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium border',
                FREQUENCY_COLORS[key].bg,
                FREQUENCY_COLORS[key].text,
                FREQUENCY_COLORS[key].border
              )}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Units Tab */}
        <TabsContent value="units" className="mt-4">
          {loadingUnits ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : unitStatus?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhuma rotina encontrada para as unidades.
            </div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-secondary/50">
                      <th className="text-left p-4 font-semibold text-foreground">Unidade</th>
                      <th className="text-center p-4 font-semibold text-foreground">Diária</th>
                      <th className="text-center p-4 font-semibold text-foreground">Semanal</th>
                      <th className="text-center p-4 font-semibold text-foreground">Quinzenal</th>
                      <th className="text-center p-4 font-semibold text-foreground">Mensal</th>
                      <th className="text-right p-4 font-semibold text-foreground">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {unitStatus?.map((unit, index) => (
                      <tr 
                        key={unit.id} 
                        className="hover:bg-secondary/30 transition-colors animate-fade-in"
                        style={{ animationDelay: `${index * 30}ms` }}
                      >
                        <td className="p-4">
                          <div>
                            <p className="font-medium text-foreground">{unit.name}</p>
                            <p className="text-xs text-muted-foreground">{unit.code}</p>
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <StatusCell {...unit.frequencies.diaria} frequency="diaria" />
                        </td>
                        <td className="p-4 text-center">
                          <StatusCell {...unit.frequencies.semanal} frequency="semanal" />
                        </td>
                        <td className="p-4 text-center">
                          <StatusCell {...unit.frequencies.quinzenal} frequency="quinzenal" />
                        </td>
                        <td className="p-4 text-center">
                          <StatusCell {...unit.frequencies.mensal} frequency="mensal" />
                        </td>
                        <td className="p-4">
                          <TotalsCell {...unit.totals} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Responsibles Tab */}
        <TabsContent value="responsibles" className="mt-4">
          {loadingResponsibles ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : responsibleStatus?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhuma rotina atribuída a responsáveis.
            </div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-secondary/50">
                      <th className="text-left p-4 font-semibold text-foreground">Responsável</th>
                      <th className="text-center p-4 font-semibold text-foreground">Diária</th>
                      <th className="text-center p-4 font-semibold text-foreground">Semanal</th>
                      <th className="text-center p-4 font-semibold text-foreground">Quinzenal</th>
                      <th className="text-center p-4 font-semibold text-foreground">Mensal</th>
                      <th className="text-right p-4 font-semibold text-foreground">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {responsibleStatus?.map((person, index) => (
                      <tr 
                        key={person.id} 
                        className="hover:bg-secondary/30 transition-colors animate-fade-in"
                        style={{ animationDelay: `${index * 30}ms` }}
                      >
                        <td className="p-4">
                          <div>
                            <p className="font-medium text-foreground">{person.name}</p>
                            <p className="text-xs text-muted-foreground">{person.email}</p>
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <StatusCell {...person.frequencies.diaria} frequency="diaria" />
                        </td>
                        <td className="p-4 text-center">
                          <StatusCell {...person.frequencies.semanal} frequency="semanal" />
                        </td>
                        <td className="p-4 text-center">
                          <StatusCell {...person.frequencies.quinzenal} frequency="quinzenal" />
                        </td>
                        <td className="p-4 text-center">
                          <StatusCell {...person.frequencies.mensal} frequency="mensal" />
                        </td>
                        <td className="p-4">
                          <TotalsCell {...person.totals} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
