import { useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { DashboardView } from '@/components/views/DashboardView';
import { RoutinesView } from '@/components/views/RoutinesView';
import { ResponsiblesView } from '@/components/views/ResponsiblesView';
import { UnitsView } from '@/components/views/UnitsView';

const Index = () => {
  const [activeView, setActiveView] = useState('dashboard');

  const renderView = () => {
    switch (activeView) {
      case 'dashboard':
        return <DashboardView />;
      case 'routines':
        return <RoutinesView />;
      case 'responsibles':
        return <ResponsiblesView />;
      case 'units':
        return <UnitsView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar activeView={activeView} onViewChange={setActiveView} />
      <main className="flex-1 p-6 overflow-auto">
        <div className="max-w-7xl mx-auto">
          {renderView()}
        </div>
      </main>
    </div>
  );
};

export default Index;
