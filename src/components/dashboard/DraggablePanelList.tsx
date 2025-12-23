import { useState, useRef } from 'react';
import { DashboardPanel, useReorderDashboardPanels } from '@/hooks/useDashboardPanels';
import { CustomPanel } from './CustomPanel';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DraggablePanelListProps {
  panels: DashboardPanel[];
}

export const DraggablePanelList = ({ panels }: DraggablePanelListProps) => {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const reorderPanels = useReorderDashboardPanels();
  const dragStartIndex = useRef<number | null>(null);

  const handleDragStart = (e: React.DragEvent, panelId: string, index: number) => {
    setDraggedId(panelId);
    dragStartIndex.current = index;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', panelId);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
    dragStartIndex.current = null;
  };

  const handleDragOver = (e: React.DragEvent, panelId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (panelId !== draggedId) {
      setDragOverId(panelId);
    }
  };

  const handleDragLeave = () => {
    setDragOverId(null);
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    
    if (dragStartIndex.current === null || dragStartIndex.current === targetIndex) {
      handleDragEnd();
      return;
    }

    // Create new order
    const newPanels = [...panels];
    const [movedPanel] = newPanels.splice(dragStartIndex.current, 1);
    newPanels.splice(targetIndex, 0, movedPanel);

    // Update order indexes
    const updates = newPanels.map((panel, index) => ({
      id: panel.id,
      order_index: index
    }));

    reorderPanels.mutate(updates);
    handleDragEnd();
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
      {panels.map((panel, index) => (
        <div
          key={panel.id}
          draggable
          onDragStart={(e) => handleDragStart(e, panel.id, index)}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => handleDragOver(e, panel.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, index)}
          className={cn(
            'relative group transition-all duration-200',
            draggedId === panel.id && 'opacity-50 scale-95',
            dragOverId === panel.id && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
          )}
        >
          {/* Drag Handle Overlay */}
          <div className="absolute left-0 top-0 bottom-0 w-8 z-10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing bg-gradient-to-r from-secondary/50 to-transparent rounded-l-lg">
            <GripVertical className="w-4 h-4 text-muted-foreground" />
          </div>
          
          <CustomPanel panel={panel} />
        </div>
      ))}
    </div>
  );
};
