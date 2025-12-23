import { useState, useEffect, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DashboardPanel, useReorderDashboardPanels } from '@/hooks/useDashboardPanels';
import { CustomPanel } from './CustomPanel';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

// Types for unified panel system
export type UnifiedPanel = 
  | { type: 'custom'; panel: DashboardPanel; order: number }
  | { type: 'units'; order: number }
  | { type: 'responsibles'; order: number };

interface UnifiedDraggablePanelsProps {
  customPanels: DashboardPanel[];
  renderUnitsPanel: () => React.ReactNode;
  renderResponsiblesPanel: () => React.ReactNode;
}

const STORAGE_KEY = 'dashboard-panel-order';

const getSavedOrder = (userId: string): Record<string, number> | null => {
  try {
    const saved = localStorage.getItem(`${STORAGE_KEY}-${userId}`);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
};

const saveOrder = (userId: string, panels: UnifiedPanel[]) => {
  const orderMap: Record<string, number> = {};
  panels.forEach((panel, idx) => {
    const key = panel.type === 'custom' ? panel.panel.id : `default-${panel.type}`;
    orderMap[key] = idx;
  });
  localStorage.setItem(`${STORAGE_KEY}-${userId}`, JSON.stringify(orderMap));
};

const getPanelId = (panel: UnifiedPanel): string => {
  if (panel.type === 'custom') return panel.panel.id;
  return `default-${panel.type}`;
};

// Sortable Panel Item Component
interface SortablePanelProps {
  panel: UnifiedPanel;
  renderContent: () => React.ReactNode;
  isDragging?: boolean;
}

const SortablePanel = ({ panel, renderContent, isDragging }: SortablePanelProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: getPanelId(panel) });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative transition-shadow duration-200',
        (isSortableDragging || isDragging) && 'opacity-50 z-50 shadow-2xl'
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
        return <CustomPanel panel={panel.panel} />;
      case 'units':
        return renderUnitsPanel();
      case 'responsibles':
        return renderResponsiblesPanel();
    }
  };

  return (
    <div className="relative opacity-90 shadow-2xl rounded-lg">
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
  const [activeId, setActiveId] = useState<string | null>(null);
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const buildPanelList = useCallback((): UnifiedPanel[] => {
    const savedOrder = user ? getSavedOrder(user.id) : null;
    const panels: UnifiedPanel[] = [];
    
    customPanels.forEach(panel => {
      const savedIdx = savedOrder?.[panel.id];
      panels.push({
        type: 'custom',
        panel,
        order: savedIdx ?? panel.order_index ?? 0,
      });
    });
    
    const unitsOrder = savedOrder?.['default-units'];
    const responsiblesOrder = savedOrder?.['default-responsibles'];
    
    panels.push({ 
      type: 'units', 
      order: unitsOrder ?? (customPanels.length > 0 ? customPanels.length : 0)
    });
    panels.push({ 
      type: 'responsibles', 
      order: responsiblesOrder ?? (customPanels.length > 0 ? customPanels.length + 1 : 1)
    });
    
    return panels.sort((a, b) => a.order - b.order);
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
    
    const currentOrder = panels.map(p => getPanelId(p));
    const newPanels = buildPanelList();
    
    const orderedPanels = newPanels.sort((a, b) => {
      const aKey = getPanelId(a);
      const bKey = getPanelId(b);
      const aIdx = currentOrder.indexOf(aKey);
      const bIdx = currentOrder.indexOf(bKey);
      
      if (aIdx === -1 && bIdx === -1) return 0;
      if (aIdx === -1) return 1;
      if (bIdx === -1) return -1;
      
      return aIdx - bIdx;
    });
    
    setPanels(orderedPanels);
  }, [customPanels, user]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    const oldIndex = panels.findIndex(p => getPanelId(p) === active.id);
    const newIndex = panels.findIndex(p => getPanelId(p) === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const newPanels = arrayMove(panels, oldIndex, newIndex);
    const updatedPanels = newPanels.map((panel, idx) => ({
      ...panel,
      order: idx,
    }));

    setPanels(updatedPanels);

    if (user) {
      saveOrder(user.id, updatedPanels);
    }

    const customPanelUpdates = updatedPanels
      .filter((p): p is UnifiedPanel & { type: 'custom' } => p.type === 'custom')
      .map(p => ({
        id: p.panel.id,
        order_index: p.order,
      }));

    if (customPanelUpdates.length > 0) {
      reorderPanels.mutate(customPanelUpdates);
    }
  };

  const renderPanelContent = (panel: UnifiedPanel) => {
    switch (panel.type) {
      case 'custom':
        return <CustomPanel panel={panel.panel} />;
      case 'units':
        return renderUnitsPanel();
      case 'responsibles':
        return renderResponsiblesPanel();
    }
  };

  const activePanel = activeId ? panels.find(p => getPanelId(p) === activeId) : null;

  if (panels.length === 0) return null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={panels.map(p => getPanelId(p))} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
          {panels.map((panel) => (
            <SortablePanel
              key={getPanelId(panel)}
              panel={panel}
              renderContent={() => renderPanelContent(panel)}
              isDragging={activeId === getPanelId(panel)}
            />
          ))}
        </div>
      </SortableContext>
      
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
