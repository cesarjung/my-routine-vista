import { FrequencyCard } from '@/components/FrequencyCard';
import { StatsOverview } from '@/components/StatsOverview';
import { SummaryTable } from '@/components/SummaryTable';
import { useFrequencySummary, useUnitsSummary, useResponsiblesSummary } from '@/hooks/useDashboardData';
import { Building2, Users, Loader2 } from 'lucide-react';

const frequencyLabelsMap: Record<string, string> = {
  diaria: 'Diárias',
  semanal: 'Semanais',
  quinzenal: 'Quinzenais',
  mensal: 'Mensais',
};

export const DashboardView = () => {
  const { data: frequencySummary, isLoading: loadingFrequency } = useFrequencySummary();
  const { data: unitsSummary, isLoading: loadingUnits } = useUnitsSummary();
  const { data: responsiblesSummary, isLoading: loadingResponsibles } = useResponsiblesSummary();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-1">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral das rotinas e tarefas</p>
      </div>

      <StatsOverview />

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
