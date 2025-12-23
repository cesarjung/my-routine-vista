import { useState, useEffect, useCallback, useRef } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragMoveEvent,
  useDraggable,
  DragOverlay,
  Modifier,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { DashboardPanel, useReorderDashboardPanels } from '@/hooks/useDashboardPanels';
import { CustomPanel } from './CustomPanel';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

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

const STORAGE_KEY = 'dashboard-panel-positions';

const getSavedPositions = (userId: string): Record<string, { x: number; y: number }> | null => {
  try {
    const saved = localStorage.getItem(`${STORAGE_KEY}-${userId}`);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
};

const savePositions = (userId: string, panels: UnifiedPanel[]) => {
  const positionsMap: Record<string, { x: number; y: number }> = {};
  panels.forEach((panel) => {
    positionsMap[panel.id] = panel.position;
  });
  localStorage.setItem(`${STORAGE_KEY}-${userId}`, JSON.stringify(positionsMap));
};

// Draggable Panel Component
interface DraggablePanelProps {
  panel: UnifiedPanel;
  renderContent: () => React.ReactNode;
  onPositionChange: (id: string, position: { x: number; y: number }) => void;
}

const DraggablePanel = ({ panel, renderContent }: DraggablePanelProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({ id: panel.id });

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
        {...attributes}
        {...listeners}
        className="absolute left-0 top-0 bottom-0 w-8 z-10 flex items-center justify-center cursor-grab active:cursor-grabbing bg-gradient-to-r from-muted/80 to-transparent rounded-l-lg opacity-60 hover:opacity-100 transition-opacity touch-none"
      >
        <GripVertical className="w-4 h-4 text-muted-foreground" />
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
  const reorderPanels = useReorderDashboardPanels();
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [containerHeight, setContainerHeight] = useState(600);

  // Calculate initial grid positions
  const getInitialPosition = (index: number, savedPos?: { x: number; y: number }) => {
    if (savedPos) return savedPos;
    
    const col = index % 2;
    const row = Math.floor(index / 2);
    const panelWidth = 50; // 50% width
    const panelHeight = 300;
    const gap = 16;
    
    return {
      x: col * (panelWidth + gap),
      y: row * (panelHeight + gap),
    };
  };

  const buildPanelList = useCallback((): UnifiedPanel[] => {
    const savedPositions = user ? getSavedPositions(user.id) : null;
    const panels: UnifiedPanel[] = [];
    let index = 0;
    
    customPanels.forEach(panel => {
      panels.push({
        id: panel.id,
        type: 'custom',
        panel,
        position: getInitialPosition(index, savedPositions?.[panel.id]),
      });
      index++;
    });
    
    panels.push({
      id: 'default-units',
      type: 'units',
      position: getInitialPosition(index, savedPositions?.['default-units']),
    });
    index++;
    
    panels.push({
      id: 'default-responsibles',
      type: 'responsibles',
      position: getInitialPosition(index, savedPositions?.['default-responsibles']),
    });
    
    return panels;
  }, [customPanels, user]);

  const [panels, setPanels] = useState<UnifiedPanel[]>([]);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!initialized) {
      setPanels(buildPanelList());
      setInitialized(true);
      return;
    }
    
    if (activeId !== null) return;
    
    // Merge new panels while preserving existing positions
    const currentPositions: Record<string, { x: number; y: number }> = {};
    panels.forEach(p => {
      currentPositions[p.id] = p.position;
    });
    
    const newPanels = buildPanelList().map(p => ({
      ...p,
      position: currentPositions[p.id] || p.position,
    }));
    
    setPanels(newPanels);
  }, [customPanels, user]);

  // Update container height based on panel positions
  useEffect(() => {
    const maxY = Math.max(...panels.map(p => p.position.y + 300), 600);
    setContainerHeight(maxY + 50);
  }, [panels]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, delta } = event;
    setActiveId(null);

    if (!delta) return;

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

    if (user) {
      savePositions(user.id, newPanels);
    }
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

  if (panels.length === 0) return null;

  return (
    <DndContext
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div 
        ref={containerRef}
        className="relative w-full"
        style={{ minHeight: containerHeight }}
      >
        {panels.map((panel) => (
          <DraggablePanel
            key={panel.id}
            panel={panel}
            renderContent={() => renderPanelContent(panel)}
            onPositionChange={(id, position) => {
              setPanels(prev => prev.map(p => 
                p.id === id ? { ...p, position } : p
              ));
            }}
          />
        ))}
      </div>
      
      <DragOverlay>
        {activePanel && (
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
