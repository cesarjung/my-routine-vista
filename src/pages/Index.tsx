import { useState } from 'react';
import { SectorSidebar } from '@/components/SectorSidebar';
import { ContentArea } from '@/components/ContentArea';
import { NavigationContext, ViewMode } from '@/types/navigation';

const Index = () => {
  const [context, setContext] = useState<NavigationContext>({ type: 'dashboard' });
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen bg-background w-full overflow-hidden">
      <SectorSidebar 
        context={context} 
        onNavigate={setContext} 
        collapsed={collapsed}
        onCollapseChange={setCollapsed}
      />
      <ContentArea 
        context={context} 
        viewMode={viewMode} 
        onViewModeChange={setViewMode} 
      />
    </div>
  );
};

export default Index;
