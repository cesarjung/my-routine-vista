import { useState } from 'react';
import { 
  ChevronRight, 
  ChevronDown, 
  ChevronLeft,
  Plus, 
  Folder, 
  FolderOpen,
  ClipboardList, 
  Calendar,
  LayoutDashboard,
  Building2,
  Settings,
  LogOut,
  Users
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useSectors, useSectorMutations, Sector } from '@/hooks/useSectors';
import { useIsAdmin } from '@/hooks/useUserRole';
import { NavigationContext, ViewMode } from '@/types/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import sirtecLogo from '@/assets/sirtec-logo-transparent.png';

interface SectorSidebarProps {
  context: NavigationContext;
  onNavigate: (context: NavigationContext) => void;
  collapsed: boolean;
  onCollapseChange: (collapsed: boolean) => void;
}

const FREQUENCIES = [
  { id: 'diaria', label: 'Diário' },
  { id: 'semanal', label: 'Semanais' },
  { id: 'quinzenal', label: 'Quinzenais' },
  { id: 'mensal', label: 'Mensais' },
  { id: 'anual', label: 'Anuais' },
];

export const SectorSidebar = ({ context, onNavigate, collapsed, onCollapseChange }: SectorSidebarProps) => {
  const { user, signOut } = useAuth();
  const { data: sectors = [], isLoading } = useSectors();
  const { createSector } = useSectorMutations();
  const { isAdmin } = useIsAdmin();
  
  const [expandedSectors, setExpandedSectors] = useState<Set<string>>(new Set());
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [expandedRoutineFreqs, setExpandedRoutineFreqs] = useState<Set<string>>(new Set());
  const [newSectorName, setNewSectorName] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const toggleSector = (sectorId: string) => {
    const newExpanded = new Set(expandedSectors);
    if (newExpanded.has(sectorId)) {
      newExpanded.delete(sectorId);
    } else {
      newExpanded.add(sectorId);
    }
    setExpandedSectors(newExpanded);
  };

  const toggleFolder = (key: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedFolders(newExpanded);
  };

  const toggleRoutineFreq = (key: string) => {
    const newExpanded = new Set(expandedRoutineFreqs);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedRoutineFreqs(newExpanded);
  };

  const handleCreateSector = async () => {
    if (!newSectorName.trim()) return;
    await createSector.mutateAsync({ name: newSectorName.trim() });
    setNewSectorName('');
    setIsDialogOpen(false);
  };

  const isActive = (ctx: NavigationContext) => {
    if (ctx.type !== context.type) return false;
    if (ctx.type === 'sector' && context.type === 'sector') {
      return ctx.sectorId === context.sectorId && 
             ctx.folder === context.folder && 
             ctx.frequency === context.frequency;
    }
    return true;
  };

  const renderSectorItem = (sector: Sector) => {
    const isExpanded = expandedSectors.has(sector.id);
    const routinesKey = `${sector.id}-routines`;
    const isRoutinesExpanded = expandedFolders.has(routinesKey);

    return (
      <div key={sector.id} className="ml-2">
        <button
          onClick={() => toggleSector(sector.id)}
          className={cn(
            'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors',
            'text-sidebar-foreground hover:bg-sidebar-accent/50'
          )}
        >
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          <div 
            className="w-5 h-5 rounded flex items-center justify-center text-xs font-bold"
            style={{ backgroundColor: sector.color || '#6366f1' }}
          >
            {sector.name.charAt(0).toUpperCase()}
          </div>
          {!collapsed && <span className="truncate">{sector.name}</span>}
        </button>

        {isExpanded && !collapsed && (
          <div className="ml-4 space-y-0.5">
            {/* Tarefas - clicável direto */}
            <button
              onClick={() => onNavigate({ type: 'sector', sectorId: sector.id, folder: 'tasks' })}
              className={cn(
                'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors',
                context.type === 'sector' && context.sectorId === sector.id && context.folder === 'tasks'
                  ? 'bg-sidebar-accent text-sidebar-primary'
                  : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
              )}
            >
              <ClipboardList className="w-4 h-4" />
              <span>Tarefas</span>
            </button>

            {/* Rotinas - clicável com dropdown para frequências */}
            <div className="relative">
              <div className="flex items-center">
                <button
                  onClick={() => onNavigate({ type: 'sector', sectorId: sector.id, folder: 'routines' })}
                  className={cn(
                    'flex-1 flex items-center gap-2 px-2 py-1.5 rounded-l-md text-sm transition-colors',
                    context.type === 'sector' && context.sectorId === sector.id && context.folder === 'routines'
                      ? 'bg-sidebar-accent text-sidebar-primary'
                      : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                  )}
                >
                  <Calendar className="w-4 h-4" />
                  <span>Rotinas</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFolder(routinesKey);
                  }}
                  className={cn(
                    'px-1.5 py-1.5 rounded-r-md text-sm transition-colors',
                    isRoutinesExpanded
                      ? 'bg-sidebar-accent text-sidebar-primary'
                      : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                  )}
                >
                  {isRoutinesExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </button>
              </div>

              {isRoutinesExpanded && (
                <div className="ml-4 mt-0.5 space-y-0.5">
                  {FREQUENCIES.map((freq) => (
                    <button
                      key={freq.id}
                      onClick={() => onNavigate({ type: 'sector', sectorId: sector.id, folder: 'routines', frequency: freq.id })}
                      className={cn(
                        'w-full flex items-center gap-2 px-2 py-1 rounded-md text-xs transition-colors',
                        context.type === 'sector' && context.sectorId === sector.id && context.folder === 'routines' && context.frequency === freq.id
                          ? 'bg-sidebar-accent text-sidebar-primary'
                          : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                      )}
                    >
                      <Calendar className="w-3 h-3" />
                      <span>{freq.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Unidades */}
            <button
              onClick={() => onNavigate({ type: 'sector', sectorId: sector.id, folder: 'units' })}
              className={cn(
                'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors',
                isActive({ type: 'sector', sectorId: sector.id, folder: 'units' })
                  ? 'bg-sidebar-accent text-sidebar-primary'
                  : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
              )}
            >
              <Building2 className="w-4 h-4" />
              <span>Unidades</span>
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <aside
      className={cn(
        'h-screen bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Header */}
      <div className="px-3 pb-2 border-b border-sidebar-border relative">
        {!collapsed ? (
          <div className="flex flex-col">
            <img src={sirtecLogo} alt="Sirtec" className="h-20 w-20 object-contain -mt-1" />
            <span className="text-base font-semibold text-sidebar-foreground text-center">Gestão CCM</span>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <img src={sirtecLogo} alt="Sirtec" className="h-10 w-10 object-contain" />
          </div>
        )}
        <button
          onClick={() => onCollapseChange(!collapsed)}
          className="absolute top-2 right-2 p-1.5 rounded-md hover:bg-sidebar-accent text-muted-foreground hover:text-sidebar-foreground transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {/* Dashboard */}
        <button
          onClick={() => onNavigate({ type: 'dashboard' })}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
            context.type === 'dashboard'
              ? 'bg-sidebar-accent text-sidebar-primary shadow-glow'
              : 'text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
          )}
        >
          <LayoutDashboard className={cn('w-5 h-5 flex-shrink-0', context.type === 'dashboard' && 'text-primary')} />
          {!collapsed && <span className="font-medium">Dashboard</span>}
        </button>

        {/* Setores header */}
        {!collapsed && (
          <div className="flex items-center justify-between px-3 pt-4 pb-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Setores</span>
            {isAdmin && (
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <button className="p-1 rounded hover:bg-sidebar-accent text-muted-foreground hover:text-sidebar-foreground">
                    <Plus className="w-4 h-4" />
                  </button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Criar novo setor</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <Input
                      placeholder="Nome do setor"
                      value={newSectorName}
                      onChange={(e) => setNewSectorName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCreateSector()}
                    />
                    <Button onClick={handleCreateSector} disabled={!newSectorName.trim()}>
                      Criar Setor
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        )}

        {/* Minhas Tarefas */}
        <button
          onClick={() => onNavigate({ type: 'my-tasks' })}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200',
            context.type === 'my-tasks'
              ? 'bg-sidebar-accent text-sidebar-primary'
              : 'text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
          )}
        >
          <Users className="w-4 h-4" />
          {!collapsed && <span className="text-sm">Minhas Tarefas</span>}
        </button>

        {/* Todos os setores */}
        <button
          onClick={() => onNavigate({ type: 'all-sectors' })}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200',
            context.type === 'all-sectors'
              ? 'bg-sidebar-accent text-sidebar-primary'
              : 'text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
          )}
        >
          <Folder className="w-4 h-4" />
          {!collapsed && <span className="text-sm">Todos os setores</span>}
        </button>

        {/* Sectors list */}
        {isLoading ? (
          <div className="px-3 py-2 text-sm text-muted-foreground">Carregando...</div>
        ) : (
          <div className="space-y-0.5">
            {sectors.map(renderSectorItem)}
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-sidebar-border space-y-1">
        {!collapsed && user && (
          <div className="px-3 py-2 text-sm text-muted-foreground truncate">
            {user.email}
          </div>
        )}
        
        <button
          onClick={() => onNavigate({ type: 'settings' })}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
            context.type === 'settings'
              ? 'bg-sidebar-accent text-sidebar-primary shadow-glow'
              : 'text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
          )}
        >
          <Settings className={cn('w-5 h-5 flex-shrink-0', context.type === 'settings' && 'text-primary')} />
          {!collapsed && <span className="font-medium">Configurações</span>}
        </button>
        
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span className="font-medium">Sair</span>}
        </button>
      </div>
    </aside>
  );
};
