import { useState } from 'react';
import { NavigationContext, ViewMode } from '@/types/navigation';
import { ViewModeToggle } from '@/components/ViewModeToggle';
import { DashboardView } from '@/components/views/DashboardView';
import { TasksView } from './views/TasksView';
import { RoutinesView } from './views/RoutinesView';
import { MyTasksView } from '@/components/views/MyTasksView';
import { SectorUnitsView } from '@/components/views/SectorUnitsView';
import { KanbanView } from './views/KanbanView';
import { GanttView } from './views/GanttView';
import { CalendarView } from './views/CalendarView';
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
import { CarteiraDashboardView } from '@/components/views/CarteiraDashboardView';
import { PlanejamentoSemanalView } from '@/components/views/PlanejamentoSemanalView';
import { cn } from '@/lib/utils';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export interface ContentAreaProps {
  context: NavigationContext;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

export const ContentArea = ({ context, viewMode, onViewModeChange }: ContentAreaProps) => {
  const { data: sectors } = useSectors();

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
        if (context.section === 'carteira_dashboard') return 'Carteira';
        if (context.section === 'carteira') return 'Carteira Planejada';
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

  // Dashboard View
  if (context.type === 'dashboard') {
    return (
      <div className="h-full flex flex-col p-6">
        <header className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
          <div className="flex items-center gap-4">

  const renderContent = () => {
    // Views especiais sem toggle
    if (context.type === 'dashboard') return <DashboardView />;
    if (context.type === 'settings') return <SettingsView />;
    if (context.type === 'my-tasks') return <MyTasksView />;
    if (context.type === 'planejamento') {
      if (context.section === 'carteira_dashboard') return <CarteiraDashboardView />;
      if (context.section === 'carteira') return <PlanejamentoGanttView />;
      return (
        <div className="flex h-full items-center justify-center text-muted-foreground">
          Módulo de Planejamento - Selecione uma seção no menu lateral
        </div>
      );
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
    if (context.type === 'planejamento_semanal') {
      return <PlanejamentoSemanalView />;
    }

  // Settings View
  if (context.type === 'settings') {
    return (
      <div className="h-full flex flex-col p-6">
        <header className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
          <div className="flex items-center gap-4">

            <div>
              <h1 className="text-base font-semibold text-foreground leading-none mb-1">Configurações</h1>
              <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                <span>Sistema</span>
              </div>
            </div>
          </div>
        </header>
        <div className="w-full h-full">
          <SettingsView hideHeader={true} />
        </div>
      </div>
    );
  }

  // My Tasks View
  if (context.type === 'my-tasks') {
    return (
      <div className="h-full flex flex-col p-6">
        <header className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
          <div className="flex items-center gap-4">

  const isDashboard = context.type === 'dashboard';
  const isPlanejamento = context.type === 'planejamento' || context.type === 'planejamento_equipes' || context.type === 'poste_turno' || context.type === 'deslocamento' || context.type === 'planejado_meta' || context.type === 'cumprimento_planejamento' || context.type === 'etapas';

          <div className="flex items-center gap-4">
            <ViewModeToggle value={viewMode} onChange={onViewModeChange} />
          </div>
        </header>
        <div className="w-full h-full">
          <MyTasksView viewMode={viewMode} />
        </div>
      </div>
    );
  }

  // Notes View
  if (context.type === 'notes') {
    return (
      <div className="h-full flex flex-col p-6">
        <header className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
          <div className="flex items-center gap-4">

            <div>
              <h1 className="text-base font-semibold text-foreground leading-none mb-1">Anotações e Quadros</h1>
              <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                <span>Geral</span>
              </div>
            </div>
          </div>
        </header>
        <div className="w-full h-full overflow-hidden">
          <NotesList />
        </div>
      </div>
    );
  }

  // Sector specific view
  if (context.type === 'sector') {
    const { sectorId, folder, frequency } = context;
    const sector = sectors?.find(s => s.id === sectorId);

    const currentSection = sector?.sections?.find(s => s.id === folder || s.type === folder);

    // Handle Dashboard folder specifically
    if (folder === 'dashboard' || currentSection?.type === 'dashboard') {
      return (
        <div className="h-full flex flex-col p-6">
          <header className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
            <div className="flex items-center gap-4">

              <div>
                <h1 className="text-base font-semibold text-foreground leading-none mb-1">
                  {sector?.name}
                </h1>
                <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                  <span>Dashboard</span>
                </div>
              </div>
            </div>
          </header>
          <div className="w-full h-full">
            <DashboardView key={`dashboard-${sectorId}`} forcedSectorId={sectorId} hideHeader={true} />
          </div>
        </div>
      );
    }

    const getTitle = () => {
      if (context.type === 'sector') {
        return sector ? sector.name : 'Setor';
      }
      return 'Gestão CCM';
    };

    const sectionTitle = currentSection ? currentSection.title : (folder === 'routines' ? 'Rotinas' : folder === 'tasks' ? 'Tarefas' : folder === 'notes' ? 'Anotações' : folder);

    const showViewToggle = folder !== 'units';

    return (
      <div className="h-full flex flex-col p-6">
        <header className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
          <div className="flex items-center gap-4">

            <div>
              <h1 className="text-base font-semibold text-foreground leading-none mb-1">
                {getTitle()}
              </h1>
              {sector && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                  <span className="capitalize">{sectionTitle}</span>
                  {frequency && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-muted-foreground/50" />
                      <span className="capitalize">{frequency}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 overflow-x-auto pb-1 md:pb-0">
            {showViewToggle && (
              <ViewModeToggle value={viewMode} onChange={onViewModeChange} />
            )}
          </div>
        </header>

        <div className="w-full h-full">
          {folder === 'units' ? (
            <SectorUnitsView sectorId={sectorId} />
          ) : folder === 'routines' ? (
            <RoutinesView
              sectorId={sectorId}
              frequency={frequency}
              viewMode={viewMode}
            />
          ) : folder === 'notes' ? (
            <NotesList sectorId={sectorId} />
          ) : (
            <TasksView
              sectorId={sectorId}
              sectionId={folder}
              isDefaultTasksSection={currentSection?.type === 'tasks' || folder === 'tasks'}
              viewMode={viewMode}
            />
          )}
        </div>
      </div>
    );
  }

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
