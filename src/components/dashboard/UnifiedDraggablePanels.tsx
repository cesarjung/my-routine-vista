import { useState, useEffect } from 'react';
import { DashboardPanel, useReorderDashboardPanels } from '@/hooks/useDashboardPanels';
import { CustomPanel } from './CustomPanel';
import { GripVertical, Building2, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

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

const DEFAULT_PANELS_ORDER = {
  units: 1000,
  responsibles: 1001,
};

export const UnifiedDraggablePanels = ({
  customPanels,
  renderUnitsPanel,
  renderResponsiblesPanel,
}: UnifiedDraggablePanelsProps) => {
  // Build unified panel list
  const buildPanelList = (): UnifiedPanel[] => {
    const panels: UnifiedPanel[] = [];
    
    // Add custom panels
    customPanels.forEach(panel => {
      panels.push({
        type: 'custom',
        panel,
        order: panel.order_index ?? 0,
      });
    });
    
    // Add default panels (will be at the end by default)
    panels.push({ type: 'units', order: DEFAULT_PANELS_ORDER.units });
    panels.push({ type: 'responsibles', order: DEFAULT_PANELS_ORDER.responsibles });
    
    // Sort by order
    return panels.sort((a, b) => a.order - b.order);
  };

  const [panels, setPanels] = useState<UnifiedPanel[]>(buildPanelList);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const reorderPanels = useReorderDashboardPanels();

  // Sync with prop changes when not dragging
  useEffect(() => {
    if (draggedIndex === null) {
      setPanels(buildPanelList());
    }
  }, [customPanels]);

  const getPanelId = (panel: UnifiedPanel): string => {
    if (panel.type === 'custom') return panel.panel.id;
    return `default-${panel.type}`;
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
    
    setTimeout(() => {
      const element = e.target as HTMLElement;
      element.style.opacity = '0.5';
    }, 0);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    const element = e.target as HTMLElement;
    element.style.opacity = '1';
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (index !== draggedIndex && draggedIndex !== null) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    
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

    setPanels(updatedPanels);

    // Only persist custom panels to database
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

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
      {panels.map((panel, index) => (
        <div
          key={getPanelId(panel)}
          draggable
          onDragStart={(e) => handleDragStart(e, index)}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => handleDragOver(e, index)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, index)}
          className={cn(
            'relative group transition-all duration-200 cursor-grab active:cursor-grabbing',
            draggedIndex === index && 'opacity-50 scale-[0.98]',
            dragOverIndex === index && draggedIndex !== index && 'ring-2 ring-primary ring-offset-2 ring-offset-background rounded-lg'
          )}
        >
          {/* Drag Handle - Always visible */}
          <div className="absolute left-0 top-0 bottom-0 w-8 z-10 flex items-center justify-center cursor-grab active:cursor-grabbing bg-gradient-to-r from-muted/80 to-transparent rounded-l-lg opacity-60 hover:opacity-100 transition-opacity">
            <GripVertical className="w-4 h-4 text-muted-foreground" />
          </div>
          
          {/* Panel with left padding to accommodate grip */}
          <div className="pl-6">
            {renderPanelContent(panel)}
          </div>
        </div>
      ))}
    </div>
  );
};
