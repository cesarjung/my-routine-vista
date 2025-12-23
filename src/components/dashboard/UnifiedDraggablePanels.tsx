import { useState, useEffect, useCallback, useRef } from 'react';
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

export const UnifiedDraggablePanels = ({
  customPanels,
  renderUnitsPanel,
  renderResponsiblesPanel,
}: UnifiedDraggablePanelsProps) => {
  const { user } = useAuth();
  const reorderPanels = useReorderDashboardPanels();
  const containerRef = useRef<HTMLDivElement>(null);
  
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
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!initialized) {
      setPanels(buildPanelList());
      setInitialized(true);
      return;
    }
    
    if (draggedIndex !== null) return;
    
    const currentOrder = panels.map(p => p.type === 'custom' ? p.panel.id : `default-${p.type}`);
    const newPanels = buildPanelList();
    
    const orderedPanels = newPanels.sort((a, b) => {
      const aKey = a.type === 'custom' ? a.panel.id : `default-${a.type}`;
      const bKey = b.type === 'custom' ? b.panel.id : `default-${b.type}`;
      const aIdx = currentOrder.indexOf(aKey);
      const bIdx = currentOrder.indexOf(bKey);
      
      if (aIdx === -1 && bIdx === -1) return 0;
      if (aIdx === -1) return 1;
      if (bIdx === -1) return -1;
      
      return aIdx - bIdx;
    });
    
    setPanels(orderedPanels);
  }, [customPanels, user]);

  const getPanelId = (panel: UnifiedPanel): string => {
    if (panel.type === 'custom') return panel.panel.id;
    return `default-${panel.type}`;
  };

  const handleMovePanel = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;

    const newPanels = [...panels];
    const [movedPanel] = newPanels.splice(fromIndex, 1);
    newPanels.splice(toIndex, 0, movedPanel);

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

  if (panels.length === 0) return null;

  return (
    <div ref={containerRef} className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
      {panels.map((panel, index) => (
        <div
          key={getPanelId(panel)}
          className={cn(
            'relative transition-all duration-200',
            draggedIndex === index && 'opacity-50 scale-[0.98] z-50',
            hoverIndex === index && draggedIndex !== null && draggedIndex !== index && 
              'ring-2 ring-primary ring-offset-2 ring-offset-background rounded-lg'
          )}
          onMouseEnter={() => {
            if (draggedIndex !== null && draggedIndex !== index) {
              setHoverIndex(index);
            }
          }}
          onMouseLeave={() => setHoverIndex(null)}
          onMouseUp={() => {
            if (draggedIndex !== null && draggedIndex !== index) {
              handleMovePanel(draggedIndex, index);
            }
            setDraggedIndex(null);
            setHoverIndex(null);
          }}
        >
          {/* Drag Handle */}
          <div 
            className="absolute left-0 top-0 bottom-0 w-8 z-10 flex items-center justify-center cursor-grab active:cursor-grabbing bg-gradient-to-r from-muted/80 to-transparent rounded-l-lg opacity-60 hover:opacity-100 transition-opacity select-none"
            onMouseDown={(e) => {
              e.preventDefault();
              setDraggedIndex(index);
              
              const handleMouseUp = () => {
                setDraggedIndex(null);
                setHoverIndex(null);
                document.removeEventListener('mouseup', handleMouseUp);
              };
              document.addEventListener('mouseup', handleMouseUp);
            }}
          >
            <GripVertical className="w-4 h-4 text-muted-foreground pointer-events-none" />
          </div>
          
          <div className="pl-6">
            {renderPanelContent(panel)}
          </div>
        </div>
      ))}
    </div>
  );
};
