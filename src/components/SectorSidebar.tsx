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
  const [isRotinasExpanded, setIsRotinasExpanded] = useState(true);
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
            'text-gray-200 hover:bg-sidebar-accent/50 hover:text-white'
          )}
        >
          {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          <div
            className="w-4 h-4 rounded flex items-center justify-center text-[10px] font-bold"
            style={{ backgroundColor: sector.color || '#6366f1' }}
          >
            {sector.name.charAt(0).toUpperCase()}
          </div>
          {!collapsed && <span className="truncate text-sm">{sector.name}</span>}
        </button>

        {isExpanded && !collapsed && (
          <div className="ml-4 space-y-0.5 border-l border-sidebar-border/50 pl-1 mt-0.5">
            {/* Dashboard Setor */}
            <button
              onClick={() => onNavigate({ type: 'sector', sectorId: sector.id, folder: 'dashboard' })}
              className={cn(
                'w-full flex items-center gap-2 px-2 py-1 rounded-md text-xs transition-colors',
                context.type === 'sector' && context.sectorId === sector.id && context.folder === 'dashboard'
                  ? 'bg-sidebar-accent text-white font-medium'
                  : 'text-gray-300 hover:bg-sidebar-accent/50 hover:text-white'
              )}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </button>

            {/* Tarefas - clicável direto */}
            <button
              onClick={() => onNavigate({ type: 'sector', sectorId: sector.id, folder: 'tasks' })}
              className={cn(
                'w-full flex items-center gap-2 px-2 py-1 rounded-md text-xs transition-colors',
                context.type === 'sector' && context.sectorId === sector.id && context.folder === 'tasks'
                  ? 'bg-sidebar-accent text-white font-medium'
                  : 'text-gray-300 hover:bg-sidebar-accent/50 hover:text-white'
              )}
            >
              <ClipboardList className="w-3.5 h-3.5" />
              <span>Tarefas</span>
            </button>

            {/* Rotinas - clicável com dropdown para frequências */}
            <div className="relative">
              <div className="flex items-center">
                <button
                  onClick={() => onNavigate({ type: 'sector', sectorId: sector.id, folder: 'routines' })}
                  className={cn(
                    'flex-1 flex items-center gap-2 px-2 py-1 rounded-l-md text-xs transition-colors',
                    context.type === 'sector' && context.sectorId === sector.id && context.folder === 'routines'
                      ? 'bg-sidebar-accent text-white font-medium'
                      : 'text-gray-300 hover:bg-sidebar-accent/50 hover:text-white'
                  )}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Rotinas</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFolder(routinesKey);
                  }}
                  className={cn(
                    'px-1 py-1 rounded-r-md text-xs transition-colors',
                    isRoutinesExpanded
                      ? 'bg-sidebar-accent text-white'
                      : 'text-gray-300 hover:bg-sidebar-accent/50 hover:text-white'
                  )}
                >
                  {isRoutinesExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </button>
              </div>

              {isRoutinesExpanded && (
                <div className="ml-3 mt-0.5 space-y-0.5 border-l border-sidebar-border/30 pl-1">
                  {FREQUENCIES.map((freq) => (
                    <button
                      key={freq.id}
                      onClick={() => onNavigate({ type: 'sector', sectorId: sector.id, folder: 'routines', frequency: freq.id })}
                      className={cn(
                        'w-full flex items-center gap-2 px-2 py-0.5 rounded-md text-[11px] transition-colors',
                        context.type === 'sector' && context.sectorId === sector.id && context.folder === 'routines' && context.frequency === freq.id
                          ? 'bg-sidebar-accent text-white font-medium'
                          : 'text-gray-300 hover:bg-sidebar-accent/50 hover:text-white'
                      )}
                    >
                      <span className="w-1 h-1 rounded-full bg-current opacity-50" />
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
                'w-full flex items-center gap-2 px-2 py-1 rounded-md text-xs transition-colors',
                isActive({ type: 'sector', sectorId: sector.id, folder: 'units' })
                  ? 'bg-sidebar-accent text-white font-medium'
                  : 'text-gray-300 hover:bg-sidebar-accent/50 hover:text-white'
              )}
            >
              <Building2 className="w-3.5 h-3.5" />
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
        'min-h-screen flex-shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300',
        collapsed ? 'w-16' : 'w-60' // Reduced width slightly
      )}
    >
      {/* Header */}
      <div className="px-3 pb-3 pt-4 border-b border-sidebar-border relative">
        {!collapsed ? (
          <div className="flex items-center gap-3 px-2">
            <img src={sirtecLogo} alt="Sirtec" className="h-16 w-16 object-contain" />
            <span className="text-sm font-medium text-white truncate">Gestão CCM</span>
          </div>
        ) : (
          <div className="flex justify-center">
            <img src={sirtecLogo} alt="Sirtec" className="h-10 w-10 object-contain" />
          </div>
        )}
        <button
          onClick={() => onCollapseChange(!collapsed)}
          className="absolute top-3 right-2 p-1 rounded-md hover:bg-sidebar-accent text-gray-400 hover:text-white transition-colors"
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Navigation - flex-1 to fill space, no overflow scroll */}
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto custom-scrollbar">
        {/* ROTINAS Section Header (Collapsible) */}
        <button
          onClick={() => setIsRotinasExpanded(!isRotinasExpanded)}
          className={cn(
            "w-full flex items-center justify-between px-2 py-1.5 mb-1 rounded-md transition-colors hover:bg-sidebar-accent/50 group select-none",
            collapsed && "justify-center"
          )}
        >
          <div className="flex items-center gap-2">
            {!collapsed && (
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider group-hover:text-white transition-colors">
                ROTINAS
              </span>
            )}
          </div>
          {!collapsed && (
            <ChevronDown className={cn("w-3.5 h-3.5 text-gray-400 transition-transform duration-200", !isRotinasExpanded && "-rotate-90")} />
          )}
        </button>

        {/* ROTINAS Content */}
        <div className={cn(
          "space-y-0.5 overflow-hidden transition-all duration-300 ease-in-out",
          !isRotinasExpanded ? "max-h-0 opacity-0" : "max-h-[1000px] opacity-100"
        )}>

          {/* Dashboard Global */}
          <button
            onClick={() => onNavigate({ type: 'dashboard' })}
            className={cn(
              'w-full flex items-center gap-3 px-2 py-1.5 rounded-md transition-all duration-200',
              context.type === 'dashboard'
                ? 'bg-sidebar-accent text-white shadow-sm font-medium'
                : 'text-gray-300 hover:text-white hover:bg-sidebar-accent/50'
            )}
            title={collapsed ? "Dashboard" : undefined}
          >
            <LayoutDashboard className={cn('w-4 h-4 flex-shrink-0', context.type === 'dashboard' && 'text-white')} />
            {!collapsed && <span className="text-sm">Dashboard</span>}
          </button>

          {/* Minhas Tarefas */}
          <button
            onClick={() => onNavigate({ type: 'my-tasks' })}
            className={cn(
              'w-full flex items-center gap-3 px-2 py-1.5 rounded-md transition-all duration-200',
              context.type === 'my-tasks'
                ? 'bg-sidebar-accent text-white font-medium'
                : 'text-gray-300 hover:text-white hover:bg-sidebar-accent/50'
            )}
            title={collapsed ? "Minhas Tarefas" : undefined}
          >
            <Users className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span className="text-sm">Minhas Tarefas</span>}
          </button>

          {/* Separator for Sectors */}
          {!collapsed && (
            <div className="flex items-center justify-between px-2 pt-3 pb-1">
              <span className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-widest pl-1">
                SETORES
              </span>
              {isAdmin && (
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <button className="p-0.5 rounded hover:bg-sidebar-accent text-muted-foreground hover:text-sidebar-foreground transition-colors">
                      <Plus className="w-3.5 h-3.5" />
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

          {/* Sectors list */}
          {isLoading ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">Carregando...</div>
          ) : (
            <div className="space-y-0.5">
              {sectors.map(renderSectorItem)}
            </div>
          )}
        </div>
      </nav>

      {/* Footer - always at bottom with mt-auto */}
      <div className="mt-auto p-2 border-t border-sidebar-border space-y-0.5 bg-sidebar">
        {!collapsed && user && (
          <div className="px-2 py-1.5 text-xs text-muted-foreground truncate opacity-70 mb-1">
            {user.email}
          </div>
        )}

        <button
          onClick={() => onNavigate({ type: 'settings' })}
          className={cn(
            'w-full flex items-center gap-3 px-2 py-1.5 rounded-md transition-colors',
            context.type === 'settings'
              ? 'bg-sidebar-accent text-sidebar-primary font-medium'
              : 'text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
          )}
          title={collapsed ? "Configurações" : undefined}
        >
          <Settings className={cn('w-4 h-4 flex-shrink-0', context.type === 'settings' && 'text-primary')} />
          {!collapsed && <span className="text-sm">Configurações</span>}
        </button>

        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-2 py-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          title={collapsed ? "Sair" : undefined}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span className="text-sm">Sair</span>}
        </button>
      </div>
    </aside>
  );
};
