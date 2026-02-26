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
import { NotesList } from '@/components/NotesList';
import sirtecLogo from '@/assets/sirtec-logo-transparent.png';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface ContentAreaProps {
  context: NavigationContext;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

export const ContentArea = ({ context, viewMode, onViewModeChange }: ContentAreaProps) => {
  const { data: sectors } = useSectors();

  // Global Filter State - REMOVED ->

  // Dashboard View
  if (context.type === 'dashboard') {
    return (
      <div className="h-full flex flex-col p-6">
        <header className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
          <div className="flex items-center gap-4">

            <div>
              <h1 className="text-base font-semibold text-foreground leading-none mb-1">Dashboard Geral</h1>
              <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                <span>Visão Geral</span>
              </div>
            </div>
          </div>
        </header>
        <div className="w-full h-full">
          <DashboardView hideHeader={true} />
        </div>
      </div>
    );
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

            <div>
              <h1 className="text-base font-semibold text-foreground leading-none mb-1">Minhas Tarefas</h1>
              <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                <span>Lista de Tarefas</span>
              </div>
            </div>
          </div>

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
            <DashboardView forcedSectorId={sectorId} hideHeader={true} />
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

  return null;
};
