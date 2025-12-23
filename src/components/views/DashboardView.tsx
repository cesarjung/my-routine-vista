import { useState } from 'react';
import { FrequencyCard } from '@/components/FrequencyCard';
import { StatsOverview } from '@/components/StatsOverview';
import { SummaryTable } from '@/components/SummaryTable';
import { useFrequencySummary, useUnitsSummary, useResponsiblesSummary } from '@/hooks/useDashboardData';
import { useSectors } from '@/hooks/useSectors';
import { Building2, Users, Loader2, LayoutGrid, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

const frequencyLabelsMap: Record<string, string> = {
  diaria: 'Diárias',
  semanal: 'Semanais',
  quinzenal: 'Quinzenais',
  mensal: 'Mensais',
};

export const DashboardView = () => {
  const [selectedSectorId, setSelectedSectorId] = useState<string | null>(null);
  
  const { data: sectors, isLoading: loadingSectors } = useSectors();
  const { data: frequencySummary, isLoading: loadingFrequency } = useFrequencySummary(selectedSectorId);
  const { data: unitsSummary, isLoading: loadingUnits } = useUnitsSummary(selectedSectorId);
  const { data: responsiblesSummary, isLoading: loadingResponsibles } = useResponsiblesSummary(selectedSectorId);

  const selectedSector = sectors?.find(s => s.id === selectedSectorId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1 flex items-center gap-2">
            Dashboard
            {selectedSector && (
              <Badge 
                variant="secondary" 
                className="ml-2"
                style={{ 
                  backgroundColor: `${selectedSector.color}20`,
                  color: selectedSector.color,
                  borderColor: selectedSector.color
                }}
              >
                {selectedSector.name}
              </Badge>
            )}
          </h1>
          <p className="text-muted-foreground">
            {selectedSector 
              ? `Visão do setor ${selectedSector.name}` 
              : 'Visão geral de todos os setores'}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-muted-foreground" />
          <Select
            value={selectedSectorId || 'all'}
            onValueChange={(value) => setSelectedSectorId(value === 'all' ? null : value)}
          >
            <SelectTrigger className="w-[200px]">
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

      <StatsOverview sectorId={selectedSectorId} />

      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Rotinas por Frequência</h2>
        {loadingFrequency ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {frequencySummary?.map((summary, index) => (
              <FrequencyCard
                key={summary.frequency}
                frequency={summary.frequency}
                label={frequencyLabelsMap[summary.frequency]}
                taskCount={summary.routineCount}
                completed={summary.completed}
                pending={summary.pending}
                total={summary.total}
                percentage={summary.percentage}
                delay={index * 100}
              />
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {loadingUnits ? (
          <div className="rounded-xl border border-border bg-card p-6 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <SummaryTable
            title="Por Unidade"
            icon={Building2}
            items={unitsSummary?.map(u => ({
              name: u.name,
              completed: u.completed,
              pending: u.pending,
              total: u.total,
            })) || []}
          />
        )}
        {loadingResponsibles ? (
          <div className="rounded-xl border border-border bg-card p-6 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <SummaryTable
            title="Por Responsável"
            icon={Users}
            items={responsiblesSummary?.map(r => ({
              name: r.name,
              completed: r.completed,
              pending: r.pending,
              total: r.total,
            })) || []}
          />
        )}
      </div>
    </div>
  );
};
