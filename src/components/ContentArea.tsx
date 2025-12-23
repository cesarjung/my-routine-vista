import { NavigationContext, ViewMode } from '@/types/navigation';
import { ViewModeToggle } from '@/components/ViewModeToggle';
import { DashboardView } from '@/components/views/DashboardView';
import { TasksView } from '@/components/views/TasksView';
import { RoutinesView } from '@/components/views/RoutinesView';
import { ResponsiblesView } from '@/components/views/ResponsiblesView';
import { SectorUnitsView } from '@/components/views/SectorUnitsView';
import { KanbanView } from '@/components/views/KanbanView';
import { GanttView } from '@/components/views/GanttView';
import { CalendarView } from '@/components/views/CalendarView';
import { SettingsView } from '@/components/views/SettingsView';
import { useSectors } from '@/hooks/useSectors';

interface ContentAreaProps {
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

  const showViewToggle = ['all-sectors', 'my-tasks'].includes(context.type) || 
    (context.type === 'sector' && context.folder !== 'units');

  const renderContent = () => {
    // Views especiais sem toggle
    if (context.type === 'dashboard') return <DashboardView />;
    if (context.type === 'settings') return <SettingsView />;

    // Contextos com toggle de visualização
    const sectorId = context.type === 'sector' ? context.sectorId : undefined;
    const folder = context.type === 'sector' ? context.folder : undefined;
    const frequency = context.type === 'sector' ? context.frequency : undefined;
    const isMyTasks = context.type === 'my-tasks';

    // Unidades view dentro do setor
    if (context.type === 'sector' && folder === 'units' && sectorId) {
      return <SectorUnitsView sectorId={sectorId} />;
    }

    switch (viewMode) {
      case 'list':
        if (folder === 'routines') {
          return <RoutinesView sectorId={sectorId} frequency={frequency} />;
        }
        if (isMyTasks) {
          return <ResponsiblesView />;
        }
        return <TasksView sectorId={sectorId} />;
      case 'kanban':
        return <KanbanView sectorId={sectorId} isMyTasks={isMyTasks} />;
      case 'calendar':
        return <CalendarView sectorId={sectorId} isMyTasks={isMyTasks} />;
      case 'gantt':
        return <GanttView sectorId={sectorId} isMyTasks={isMyTasks} />;
      default:
        return <TasksView sectorId={sectorId} />;
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="px-6 py-4 border-b border-border flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">{getTitle()}</h1>
        {showViewToggle && (
          <ViewModeToggle value={viewMode} onChange={onViewModeChange} />
        )}
      </header>

      {/* Content */}
      <main className="flex-1 p-6 overflow-auto">
        <div className="max-w-7xl mx-auto">
          {renderContent()}
        </div>
      </main>
    </div>
  );
};
