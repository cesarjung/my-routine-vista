import { useState } from 'react';
import { Building2, Users, CheckCircle2, Clock, ListTodo, TrendingUp } from 'lucide-react';
import { useFrequencySummary, useUnitsSummary, useResponsiblesSummary, useOverallStats } from '@/hooks/useDashboardData';
import { useSectors } from '@/hooks/useSectors';
import {
  DashboardHeader,
  StatCard,
  PerformanceChart,
  FrequencySection,
  EnhancedSummaryTable,
} from '@/components/dashboard';

export const DashboardView = () => {
  const [selectedSectorId, setSelectedSectorId] = useState<string | null>(null);
  
  const { data: sectors, isLoading: loadingSectors } = useSectors();
  const { data: statsData, isLoading: loadingStats } = useOverallStats(selectedSectorId);
  const { data: frequencySummary, isLoading: loadingFrequency } = useFrequencySummary(selectedSectorId);
  const { data: unitsSummary, isLoading: loadingUnits } = useUnitsSummary(selectedSectorId);
  const { data: responsiblesSummary, isLoading: loadingResponsibles } = useResponsiblesSummary(selectedSectorId);

  const stats = [
    {
      label: 'Total de Rotinas',
      value: statsData?.routineCount || 0,
      icon: ListTodo,
      color: 'text-primary',
      bgColor: 'bg-gradient-to-br from-primary/15 to-primary/5',
    },
    {
      label: 'Tarefas Concluídas',
      value: statsData?.completed || 0,
      icon: CheckCircle2,
      color: 'text-success',
      bgColor: 'bg-gradient-to-br from-success/15 to-success/5',
    },
    {
      label: 'Tarefas Pendentes',
      value: statsData?.pending || 0,
      icon: Clock,
      color: 'text-warning',
      bgColor: 'bg-gradient-to-br from-warning/15 to-warning/5',
    },
    {
      label: 'Taxa de Conclusão',
      value: `${statsData?.percentage || 0}%`,
      icon: TrendingUp,
      color: (statsData?.percentage || 0) >= 70 ? 'text-success' : (statsData?.percentage || 0) >= 40 ? 'text-warning' : 'text-destructive',
      bgColor: (statsData?.percentage || 0) >= 70 ? 'bg-gradient-to-br from-success/15 to-success/5' : (statsData?.percentage || 0) >= 40 ? 'bg-gradient-to-br from-warning/15 to-warning/5' : 'bg-gradient-to-br from-destructive/15 to-destructive/5',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header with hero section */}
      <DashboardHeader
        selectedSectorId={selectedSectorId}
        onSectorChange={setSelectedSectorId}
        sectors={sectors}
        loadingSectors={loadingSectors}
        overallPercentage={statsData?.percentage || 0}
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            icon={stat.icon}
            color={stat.color}
            bgColor={stat.bgColor}
            delay={index * 75}
          />
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Performance Chart */}
        <PerformanceChart
          completed={statsData?.completed || 0}
          pending={statsData?.pending || 0}
          className="lg:col-span-1"
        />

        {/* Frequency Section */}
        <div className="lg:col-span-2">
          <FrequencySection
            data={frequencySummary}
            isLoading={loadingFrequency}
          />
        </div>
      </div>

      {/* Summary Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <EnhancedSummaryTable
          title="Por Unidade"
          subtitle="Ranking de desempenho das unidades"
          icon={Building2}
          items={unitsSummary?.map(u => ({
            name: u.name,
            completed: u.completed,
            pending: u.pending,
            total: u.total,
          })) || []}
          isLoading={loadingUnits}
          emptyMessage="Nenhuma unidade encontrada"
        />

        <EnhancedSummaryTable
          title="Por Responsável"
          subtitle="Ranking de desempenho dos responsáveis"
          icon={Users}
          items={responsiblesSummary?.map(r => ({
            name: r.name,
            completed: r.completed,
            pending: r.pending,
            total: r.total,
          })) || []}
          isLoading={loadingResponsibles}
          emptyMessage="Nenhum responsável encontrado"
        />
      </div>
    </div>
  );
};
