import { FrequencyCard } from '@/components/FrequencyCard';
import { StatsOverview } from '@/components/StatsOverview';
import { SummaryTable } from '@/components/SummaryTable';
import { getFrequencySummary, getUnitsSummary, getResponsiblesSummary } from '@/data/mockData';
import { Frequency } from '@/types/routine';
import { Building2, Users } from 'lucide-react';

export const DashboardView = () => {
  const frequencySummary = getFrequencySummary();
  const unitsSummary = getUnitsSummary();
  const responsiblesSummary = getResponsiblesSummary();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-1">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral das rotinas e tarefas</p>
      </div>

      <StatsOverview />

      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Rotinas por Frequência</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {frequencySummary.map((summary, index) => (
            <FrequencyCard
              key={summary.frequency}
              frequency={summary.frequency as Frequency}
              taskCount={summary.taskCount}
              completed={summary.completed}
              pending={summary.pending}
              total={summary.total}
              percentage={summary.percentage}
              delay={index * 100}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SummaryTable
          title="Por Unidade"
          icon={Building2}
          items={unitsSummary}
        />
        <SummaryTable
          title="Por Responsável"
          icon={Users}
          items={responsiblesSummary}
        />
      </div>
    </div>
  );
};
