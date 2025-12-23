import { useState, useEffect, useCallback } from 'react';
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

// Get saved order from localStorage
const getSavedOrder = (userId: string): Record<string, number> | null => {
  try {
    const saved = localStorage.getItem(`${STORAGE_KEY}-${userId}`);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
};

// Save order to localStorage
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
  
  // Build unified panel list with saved order
  const buildPanelList = useCallback((): UnifiedPanel[] => {
    const savedOrder = user ? getSavedOrder(user.id) : null;
    const panels: UnifiedPanel[] = [];
    
    // Add custom panels
    customPanels.forEach(panel => {
      const savedIdx = savedOrder?.[panel.id];
      panels.push({
        type: 'custom',
        panel,
        order: savedIdx ?? panel.order_index ?? 0,
      });
    });
    
    // Add default panels
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
    
    // Sort by order
    return panels.sort((a, b) => a.order - b.order);
  }, [customPanels, user]);

  const [panels, setPanels] = useState<UnifiedPanel[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Initialize panels on mount or when customPanels change (but preserve order)
  useEffect(() => {
    if (!initialized || draggedIndex !== null) {
      setPanels(buildPanelList());
      setInitialized(true);
      return;
    }
    
    // When customPanels change, we need to merge new panels while preserving order
    const currentOrder = panels.map(p => p.type === 'custom' ? p.panel.id : `default-${p.type}`);
    const newPanels = buildPanelList();
    
    // Keep existing order for panels that still exist
    const orderedPanels = newPanels.sort((a, b) => {
      const aKey = a.type === 'custom' ? a.panel.id : `default-${a.type}`;
      const bKey = b.type === 'custom' ? b.panel.id : `default-${b.type}`;
      const aIdx = currentOrder.indexOf(aKey);
      const bIdx = currentOrder.indexOf(bKey);
      
      // New panels go to the end
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

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
    // Set drag image to the current target
    if (e.currentTarget instanceof HTMLElement) {
      e.dataTransfer.setDragImage(e.currentTarget, 50, 50);
    }
    // Use setTimeout to allow the drag to start before updating state
    setTimeout(() => {
      setDraggedIndex(index);
    }, 0);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    
    if (draggedIndex !== null && index !== draggedIndex) {
      setDragOverIndex(index);
    }
  };

  const handleDragEnter = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (draggedIndex !== null && index !== draggedIndex) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only clear if leaving the actual drop zone
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!e.currentTarget.contains(relatedTarget)) {
      setDragOverIndex(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    // Create new order
    const newPanels = [...panels];
    const [movedPanel] = newPanels.splice(draggedIndex, 1);
    newPanels.splice(targetIndex, 0, movedPanel);

    // Update orders
    const updatedPanels = newPanels.map((panel, idx) => ({
      ...panel,
      order: idx,
    }));

    // Update local state immediately
    setPanels(updatedPanels);

    // Save to localStorage
    if (user) {
      saveOrder(user.id, updatedPanels);
    }

    // Persist custom panels to database
    const customPanelUpdates = updatedPanels
      .filter((p): p is UnifiedPanel & { type: 'custom' } => p.type === 'custom')
      .map(p => ({
        id: p.panel.id,
        order_index: p.order,
      }));

    if (customPanelUpdates.length > 0) {
      reorderPanels.mutate(customPanelUpdates);
    }

    setDraggedIndex(null);
    setDragOverIndex(null);
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
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
      {panels.map((panel, index) => (
        <div
          key={getPanelId(panel)}
          draggable
          onDragStart={(e) => handleDragStart(e, index)}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => handleDragOver(e, index)}
          onDragEnter={(e) => handleDragEnter(e, index)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, index)}
          className={cn(
            'relative transition-all duration-200 cursor-grab active:cursor-grabbing',
            draggedIndex === index && 'opacity-40 scale-[0.98]',
            dragOverIndex === index && draggedIndex !== index && 'ring-2 ring-primary ring-offset-2 ring-offset-background rounded-lg scale-[1.02]'
          )}
        >
          {/* Drag Handle - Always visible */}
          <div 
            className={cn(
              "absolute left-0 top-0 bottom-0 w-8 z-10 flex items-center justify-center cursor-grab active:cursor-grabbing bg-gradient-to-r from-muted/80 to-transparent rounded-l-lg opacity-60 hover:opacity-100 transition-opacity",
              draggedIndex !== null && "pointer-events-none"
            )}
          >
            <GripVertical className="w-4 h-4 text-muted-foreground" />
          </div>
          
          {/* Panel with left padding to accommodate grip */}
          <div className={cn(
            "pl-6",
            draggedIndex !== null && "pointer-events-none"
          )}>
            {renderPanelContent(panel)}
          </div>
        </div>
      ))}
    </div>
  );
};
