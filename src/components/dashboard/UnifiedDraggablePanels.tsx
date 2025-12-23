import { useState, useEffect, useCallback } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  useDraggable,
  DragOverlay,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardPanel, useReorderDashboardPanels } from '@/hooks/useDashboardPanels';
import { CustomPanel } from './CustomPanel';
import { GripVertical, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useIsAdmin } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Types for unified panel system
export type UnifiedPanel = {
  id: string;
  type: 'custom' | 'units' | 'responsibles';
  panel?: DashboardPanel;
  position: { x: number; y: number };
};

interface UnifiedDraggablePanelsProps {
  customPanels: DashboardPanel[];
  renderUnitsPanel: () => React.ReactNode;
  renderResponsiblesPanel: () => React.ReactNode;
}

// Hook to fetch dashboard layout from database
const useDashboardLayout = () => {
  return useQuery({
    queryKey: ['dashboard-layout'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dashboard_layout')
        .select('*');
      
      if (error) throw error;
      return data;
    },
    // Refetch periodically to get updates from admin
    refetchInterval: 30000, // Every 30 seconds
    staleTime: 10000, // Consider stale after 10 seconds
  });
};

// Hook to save dashboard layout
const useSaveDashboardLayout = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (panels: UnifiedPanel[]) => {
      if (!user) throw new Error('User not authenticated');

      // Upsert each panel position
      for (const panel of panels) {
        const { error } = await supabase
          .from('dashboard_layout')
          .upsert({
            panel_id: panel.id,
            position_x: Math.round(panel.position.x),
            position_y: Math.round(panel.position.y),
            updated_by: user.id,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'panel_id' });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-layout'] });
      toast.success('Layout do dashboard salvo para todos os usuários');
    },
    onError: (error) => {
      toast.error('Erro ao salvar layout: ' + error.message);
    },
  });
};

// Draggable Panel Component
interface DraggablePanelProps {
  panel: UnifiedPanel;
  renderContent: () => React.ReactNode;
  canDrag: boolean;
}

const DraggablePanel = ({ panel, renderContent, canDrag }: DraggablePanelProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({ 
    id: panel.id,
    disabled: !canDrag,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    left: panel.position.x,
    top: panel.position.y,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'absolute transition-shadow duration-200 w-[calc(50%-0.5rem)] min-w-[300px]',
        isDragging && 'opacity-50 z-50 shadow-2xl'
      )}
    >
      {/* Drag Handle */}
      <div 
        {...(canDrag ? { ...attributes, ...listeners } : {})}
        className={cn(
          "absolute left-0 top-0 bottom-0 w-8 z-10 flex items-center justify-center bg-gradient-to-r from-muted/80 to-transparent rounded-l-lg transition-opacity touch-none",
          canDrag 
            ? "cursor-grab active:cursor-grabbing opacity-60 hover:opacity-100" 
            : "cursor-not-allowed opacity-40"
        )}
        title={canDrag ? "Arraste para reposicionar" : "Somente administradores podem reorganizar"}
      >
        {canDrag ? (
          <GripVertical className="w-4 h-4 text-muted-foreground" />
        ) : (
          <Lock className="w-3 h-3 text-muted-foreground" />
        )}
      </div>
      
      <div className="pl-6">
        {renderContent()}
      </div>
    </div>
  );
};

// Drag Overlay Component  
const DragOverlayContent = ({ panel, renderUnitsPanel, renderResponsiblesPanel }: {
  panel: UnifiedPanel;
  renderUnitsPanel: () => React.ReactNode;
  renderResponsiblesPanel: () => React.ReactNode;
}) => {
  const renderContent = () => {
    switch (panel.type) {
      case 'custom':
        return panel.panel ? <CustomPanel panel={panel.panel} /> : null;
      case 'units':
        return renderUnitsPanel();
      case 'responsibles':
        return renderResponsiblesPanel();
    }
  };

  return (
    <div className="relative opacity-90 shadow-2xl rounded-lg w-[calc(50vw-2rem)] min-w-[300px] max-w-[600px]">
      <div className="absolute left-0 top-0 bottom-0 w-8 z-10 flex items-center justify-center cursor-grabbing bg-gradient-to-r from-muted/80 to-transparent rounded-l-lg">
        <GripVertical className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="pl-6">
        {renderContent()}
      </div>
    </div>
  );
};

export const UnifiedDraggablePanels = ({
  customPanels,
  renderUnitsPanel,
  renderResponsiblesPanel,
}: UnifiedDraggablePanelsProps) => {
  const { user } = useAuth();
  const { isAdmin, isLoading: isLoadingRole } = useIsAdmin();
  const { data: savedLayout, isLoading: isLoadingLayout } = useDashboardLayout();
  const saveLayout = useSaveDashboardLayout();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [containerHeight, setContainerHeight] = useState(600);

  // Calculate initial grid positions
  const getInitialPosition = (index: number) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const colWidth = 50; // percentage
    const panelHeight = 300;
    const gap = 16;
    
    return {
      x: col * (colWidth + gap),
      y: row * (panelHeight + gap),
    };
  };

  const buildPanelList = useCallback((): UnifiedPanel[] => {
    const layoutMap: Record<string, { x: number; y: number }> = {};
    savedLayout?.forEach(item => {
      layoutMap[item.panel_id] = { x: item.position_x, y: item.position_y };
    });

    const panels: UnifiedPanel[] = [];
    let index = 0;
    
    customPanels.forEach(panel => {
      panels.push({
        id: panel.id,
        type: 'custom',
        panel,
        position: layoutMap[panel.id] || getInitialPosition(index),
      });
      index++;
    });
    
    panels.push({
      id: 'default-units',
      type: 'units',
      position: layoutMap['default-units'] || getInitialPosition(index),
    });
    index++;
    
    panels.push({
      id: 'default-responsibles',
      type: 'responsibles',
      position: layoutMap['default-responsibles'] || getInitialPosition(index),
    });
    
    return panels;
  }, [customPanels, savedLayout]);

  const [panels, setPanels] = useState<UnifiedPanel[]>([]);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (isLoadingLayout) return;
    
    if (!initialized) {
      setPanels(buildPanelList());
      setInitialized(true);
      return;
    }
    
    if (activeId !== null) return;
    
    // Merge new panels while preserving existing positions from DB
    setPanels(buildPanelList());
  }, [customPanels, savedLayout, isLoadingLayout]);

  // Update container height based on panel positions
  useEffect(() => {
    if (panels.length === 0) return;
    const maxY = Math.max(...panels.map(p => p.position.y + 300), 600);
    setContainerHeight(maxY + 50);
  }, [panels]);

  const handleDragStart = (event: DragStartEvent) => {
    if (!isAdmin) return;
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, delta } = event;
    setActiveId(null);

    if (!isAdmin || !delta) return;

    const panelIndex = panels.findIndex(p => p.id === active.id);
    if (panelIndex === -1) return;

    const panel = panels[panelIndex];
    const newPosition = {
      x: Math.max(0, panel.position.x + delta.x),
      y: Math.max(0, panel.position.y + delta.y),
    };

    const newPanels = [...panels];
    newPanels[panelIndex] = {
      ...panel,
      position: newPosition,
    };

    setPanels(newPanels);

    // Save to database (admin only - RLS will enforce this)
    saveLayout.mutate(newPanels);
  };

  const renderPanelContent = (panel: UnifiedPanel) => {
    switch (panel.type) {
      case 'custom':
        return panel.panel ? <CustomPanel panel={panel.panel} /> : null;
      case 'units':
        return renderUnitsPanel();
      case 'responsibles':
        return renderResponsiblesPanel();
    }
  };

  const activePanel = activeId ? panels.find(p => p.id === activeId) : null;

  if (panels.length === 0 || isLoadingLayout || isLoadingRole) return null;

  return (
    <DndContext
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {!isAdmin && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2 bg-muted/30 px-3 py-1.5 rounded-md w-fit">
          <Lock className="w-3 h-3" />
          <span>Layout definido pelo administrador</span>
        </div>
      )}
      
      <div 
        className="relative w-full"
        style={{ minHeight: containerHeight }}
      >
        {panels.map((panel) => (
          <DraggablePanel
            key={panel.id}
            panel={panel}
            renderContent={() => renderPanelContent(panel)}
            canDrag={isAdmin}
          />
        ))}
      </div>
      
      <DragOverlay>
        {activePanel && isAdmin && (
          <DragOverlayContent
            panel={activePanel}
            renderUnitsPanel={renderUnitsPanel}
            renderResponsiblesPanel={renderResponsiblesPanel}
          />
        )}
      </DragOverlay>
    </DndContext>
  );
};
