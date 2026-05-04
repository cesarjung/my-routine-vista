import { NavigationContext, ViewMode } from '@/types/navigation';
import { ViewModeToggle } from '@/components/ViewModeToggle';
import { DashboardView } from '@/components/views/DashboardView';
import { TasksView } from '@/components/views/TasksView';
import { RoutinesView } from '@/components/views/RoutinesView';
import { MyTasksView } from '@/components/views/MyTasksView';
import { SectorUnitsView } from '@/components/views/SectorUnitsView';
import { KanbanView } from '@/components/views/KanbanView';
import { GanttView } from '@/components/views/GanttView';
import { CalendarView } from '@/components/views/CalendarView';
import { SettingsView } from '@/components/views/SettingsView';
import { useSectors } from '@/hooks/useSectors';
import sirtecLogoHeader from '@/assets/sirtec-logo-header.png';
import { PlanejamentoGanttView } from '@/components/views/PlanejamentoGanttView';
import { PlanejamentoEquipesGanttView } from '@/components/views/PlanejamentoEquipesGanttView';
import { PostesTurnoView } from '@/components/views/PostesTurnoView';
import { DeslocamentoView } from '@/components/views/DeslocamentoView';
import { PlanejadoMetaView } from '@/components/views/PlanejadoMetaView';
import { CumprimentoView } from '@/components/views/CumprimentoView';
import { EtapasView } from '@/components/views/EtapasView';
import { cn } from '@/lib/utils';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export interface ContentAreaProps {
  context: NavigationContext;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

export const ContentArea = ({ context, viewMode, onViewModeChange }: ContentAreaProps) => {
  const { data: sectors = [] } = useSectors();

  const getTitle = () => {
    switch (context.type) {
      case 'dashboard':
        return 'Dashboard';
      case 'all-sectors':
        return 'Todos os Setores';
      case 'my-tasks':
        return 'Minhas Tarefas';
      case 'settings':
        return 'Configurações';
      case 'planejamento':
        if (context.section === 'carteira') return 'Carteira de Planejamento';
        return 'Planejamento';
      case 'planejamento_equipes':
        return 'Equipes de Planejamento';
      case 'poste_turno':
        return 'Média de Postes Planejados por Turno';
      case 'deslocamento':
        return 'Tempo de Deslocamento (Horas)';
      case 'planejado_meta':
        return 'Percentual Planejado x Meta';
      case 'cumprimento_planejamento':
        return 'Cumprimento Planejamento';
      case 'sector': {
        const sector = sectors.find(s => s.id === context.sectorId);
        const sectorName = sector?.name || 'Setor';
        if (context.folder === 'tasks') {
          return `${sectorName} / Tarefas`;
        }
        if (context.folder === 'routines') {
          const freqLabel = context.frequency 
            ? { diaria: 'Diário', semanal: 'Semanais', quinzenal: 'Quinzenais', mensal: 'Mensais', anual: 'Anuais' }[context.frequency]
            : 'Todas';
          return `${sectorName} / Rotinas / ${freqLabel}`;
        }
        if (context.folder === 'units') {
          return `${sectorName} / Unidades`;
        }
        return sectorName;
      }
      default:
        return '';
    }
  };

  const showViewToggle = context.type === 'all-sectors' || 
    (context.type === 'sector' && context.folder !== 'units');

  const renderContent = () => {
    // Views especiais sem toggle
    if (context.type === 'dashboard') return <DashboardView />;
    if (context.type === 'settings') return <SettingsView />;
    if (context.type === 'my-tasks') return <MyTasksView />;
    if (context.type === 'planejamento') {
      if (context.section === 'carteira') return <PlanejamentoGanttView />;
    }
    if (context.type === 'planejamento_equipes') {
      return <PlanejamentoEquipesGanttView />;
    }
    if (context.type === 'poste_turno') {
      return <PostesTurnoView />;
    }
    if (context.type === 'deslocamento') {
      return <DeslocamentoView />;
    }
    if (context.type === 'planejado_meta') {
      return <PlanejadoMetaView />;
    }
    if (context.type === 'cumprimento_planejamento') {
      return <CumprimentoView />;
    }

    if (context.type === 'etapas') {
      return <EtapasView />;
    }

    // Contextos com toggle de visualização
    const sectorId = context.type === 'sector' ? context.sectorId : undefined;
    const folder = context.type === 'sector' ? context.folder : undefined;
    const frequency = context.type === 'sector' ? context.frequency : undefined;

    // Unidades view dentro do setor
    if (context.type === 'sector' && folder === 'units' && sectorId) {
      return <SectorUnitsView sectorId={sectorId} />;
    }

    switch (viewMode) {
      case 'list':
        if (folder === 'routines') {
          return <RoutinesView sectorId={sectorId} frequency={frequency} />;
        }
        return <TasksView sectorId={sectorId} />;
      case 'kanban':
        return <KanbanView sectorId={sectorId} />;
      case 'calendar':
        return <CalendarView sectorId={sectorId} />;
      case 'gantt':
        return <GanttView sectorId={sectorId} />;
      default:
        return <TasksView sectorId={sectorId} />;
    }
  };

  const isDashboard = context.type === 'dashboard';
  const isPlanejamento = context.type === 'planejamento' || context.type === 'planejamento_equipes' || context.type === 'poste_turno' || context.type === 'deslocamento' || context.type === 'planejado_meta' || context.type === 'cumprimento_planejamento' || context.type === 'etapas';

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="px-6 py-4 border-b border-border flex items-center justify-between">
        {isDashboard ? (
          <img src={sirtecLogoHeader} alt="Sirtec" className="h-10 object-contain" />
        ) : (
          <h1 className="text-xl font-semibold text-foreground">{getTitle()}</h1>
        )}
        <div className="flex items-center gap-4">
          {isDashboard && (
            <h1 className="text-lg font-bold text-foreground">Gerenciamento de Rotinas</h1>
          )}
          {showViewToggle && (
            <ViewModeToggle value={viewMode} onChange={onViewModeChange} />
          )}
        </div>
      </header>

      {/* Content */}
      <main className={cn("flex-1 flex flex-col", isPlanejamento ? "p-0 overflow-hidden" : "p-6 overflow-auto")}>
        <div className={cn("mx-auto h-full flex flex-col w-full", isPlanejamento ? "max-w-none" : "max-w-7xl")}>
          <ErrorBoundary>
            {renderContent()}
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
};
// Trigger HMR
