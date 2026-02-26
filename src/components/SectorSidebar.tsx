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
  Users,
  StickyNote,
  Trash2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useSectors, useSectorMutations, useSectionMutations, Sector, SectorSection } from '@/hooks/useSectors';
import { useSectorUserMutations } from '@/hooks/useSectorUsers';
import { useProfiles } from '@/hooks/useProfiles';
import { useIsAdmin, useIsGestorOrAdmin } from '@/hooks/useUserRole';
import { NavigationContext, ViewMode } from '@/types/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { MultiAssigneeSelect } from '@/components/MultiAssigneeSelect';
import { SectorSettingsDialog } from '@/components/SectorSettingsDialog';
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
  const { createSector, deleteSector } = useSectorMutations();
  const { createSection, deleteSection } = useSectionMutations();
  const { addUserToSector } = useSectorUserMutations();
  const { data: profiles = [] } = useProfiles();
  const { isAdmin } = useIsAdmin();
  const { isGestorOrAdmin } = useIsGestorOrAdmin();

  const [expandedSectors, setExpandedSectors] = useState<Set<string>>(new Set());
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [expandedRoutineFreqs, setExpandedRoutineFreqs] = useState<Set<string>>(new Set());
  const [isRotinasExpanded, setIsRotinasExpanded] = useState(true);
  const [newSectorName, setNewSectorName] = useState('');
  const [isNewSectorPrivate, setIsNewSectorPrivate] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Section Creation State
  const [activeSectorIdForSection, setActiveSectorIdForSection] = useState<string | null>(null);
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [isSectionDialogOpen, setIsSectionDialogOpen] = useState(false);

  // Sector Settings State
  const [activeConfigSectorId, setActiveConfigSectorId] = useState<string | null>(null);
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);

  // Sector Deletion State
  const [sectorToDelete, setSectorToDelete] = useState<Sector | null>(null);

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

    // Create the sector
    const newSector = await createSector.mutateAsync({ name: newSectorName.trim(), is_private: isNewSectorPrivate });

    // If private and users are selected, add them
    if (newSector && isNewSectorPrivate && selectedUsers.length > 0) {
      // Create an array of promises for adding users
      const addPromises = selectedUsers.map(userId =>
        addUserToSector.mutateAsync({
          sectorId: newSector.id,
          userId: userId
        })
      );

      try {
        await Promise.all(addPromises);
      } catch (err) {
        console.error("Erro ao adicionar alguns usuários ao novo espaço:", err);
      }
    }

    setNewSectorName('');
    setIsNewSectorPrivate(false);
    setSelectedUsers([]);
    setIsDialogOpen(false);
  };

  const handleCreateSection = async () => {
    if (!activeSectorIdForSection || !newSectionTitle.trim()) return;

    // Default to 'custom_tasks' type for new custom sections
    await createSection.mutateAsync({
      sector_id: activeSectorIdForSection,
      title: newSectionTitle.trim(),
      type: 'custom_tasks',
      order_index: 99 // Append to end
    });

    setNewSectionTitle('');
    setIsSectionDialogOpen(false);
    setActiveSectorIdForSection(null);
  };

  const handleDeleteSection = async (e: React.MouseEvent, sectionId: string) => {
    e.stopPropagation();
    if (confirm('Tem certeza que deseja excluir esta seção?')) {
      await deleteSection.mutateAsync(sectionId);
    }
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

    // Fallback if sections haven't loaded yet or query is cached without them
    const sections = sector.sections?.sort((a, b) => a.order_index - b.order_index) || [
      { id: 'dashboard', sector_id: sector.id, title: 'Dashboard', type: 'dashboard', order_index: 0 },
      { id: 'tasks', sector_id: sector.id, title: 'Tarefas', type: 'tasks', order_index: 1 },
      { id: 'routines', sector_id: sector.id, title: 'Rotinas', type: 'routines', order_index: 2 },
      { id: 'units', sector_id: sector.id, title: 'Unidades', type: 'units', order_index: 3 },
    ];

    return (
      <div key={sector.id} className="ml-2">
        <div className="flex items-center gap-1 w-full pr-2 group/sector">
          <button
            onClick={() => toggleSector(sector.id)}
            className={cn(
              'flex-1 flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors',
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

          {/* Settings Button */}
          {(isGestorOrAdmin || sector.created_by === user?.id) && !collapsed && (
            <div className="flex opacity-0 group-hover/sector:opacity-100 transition-opacity ml-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveConfigSectorId(sector.id);
                  setIsConfigDialogOpen(true);
                }}
                className="p-1 hover:bg-sidebar-accent rounded text-muted-foreground hover:text-white"
                title="Configurações do Espaço"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSectorToDelete(sector);
                }}
                className="p-1 hover:bg-destructive/20 rounded text-muted-foreground hover:text-destructive"
                title="Excluir Espaço"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Add Section Button */}
          {isAdmin && !collapsed && (
            <button
              onClick={() => {
                setActiveSectorIdForSection(sector.id);
                setIsSectionDialogOpen(true);
              }}
              className="opacity-0 group-hover/sector:opacity-100 p-1 hover:bg-sidebar-accent rounded text-muted-foreground hover:text-white transition-opacity"
              title="Adicionar Seção"
            >
              <Plus className="w-3 h-3" />
            </button>
          )}
        </div>

        {isExpanded && !collapsed && (
          <div className="ml-4 space-y-0.5 border-l border-sidebar-border/50 pl-1 mt-0.5">
            {/* Atalho Fixo Anotações do Espaço */}
            <div className="relative group/section">
              <button
                onClick={() => onNavigate({ type: 'sector', sectorId: sector.id, folder: 'notes' })}
                className={cn(
                  'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors',
                  context.type === 'sector' && context.sectorId === sector.id && context.folder === 'notes'
                    ? 'bg-sidebar-accent text-white font-medium'
                    : 'text-gray-300 hover:bg-sidebar-accent/50 hover:text-white'
                )}
              >
                <StickyNote className="w-3.5 h-3.5" />
                <span>Anotações e Quadros</span>
              </button>
            </div>

            {sections.map(section => {
              // Special handling for Routines
              if (section.type === 'routines') {
                return (
                  <div key={section.id} className="relative group/section">
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
                        <span>{section.title}</span>
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

                      {isAdmin && (
                        <button
                          onClick={(e) => handleDeleteSection(e, section.id)}
                          className="ml-1 p-0.5 text-gray-500 hover:text-destructive transition-colors"
                          title="Excluir seção"
                        >
                          <LogOut className="w-3 h-3 rotate-180" />
                        </button>
                      )}
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
                );
              }

              // Generic Handling
              let Icon = ClipboardList;
              if (section.type === 'dashboard') Icon = LayoutDashboard;
              if (section.type === 'units') Icon = Building2;
              if (section.type === 'custom_tasks') Icon = ClipboardList;

              const isCustom = !['dashboard', 'tasks', 'routines', 'units'].includes(section.id); // Check if it's a legacy default ID

              return (
                <div key={section.id} className="flex items-center group/section">
                  <button
                    onClick={() => onNavigate({
                      type: 'sector',
                      sectorId: sector.id,
                      folder: isCustom ? section.id : section.type // Use ID for custom, type for legacy defaults mapping 
                    })}
                    className={cn(
                      'flex-1 flex items-center gap-2 px-2 py-1 rounded-md text-xs transition-colors',
                      context.type === 'sector' && context.sectorId === sector.id && context.folder === (isCustom ? section.id : section.type)
                        ? 'bg-sidebar-accent text-white font-medium'
                        : 'text-gray-300 hover:bg-sidebar-accent/50 hover:text-white'
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{section.title}</span>
                  </button>
                  {isAdmin && (
                    <button
                      onClick={(e) => handleDeleteSection(e, section.id)}
                      className="ml-1 p-0.5 text-gray-500 hover:text-destructive transition-colors"
                      title="Excluir seção"
                    >
                      <LogOut className="w-3 h-3 rotate-180" />
                    </button>
                  )}
                </div>
              );
            })}
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

          {/* Anotações e Quadros */}
          <button
            onClick={() => onNavigate({ type: 'notes' })}
            className={cn(
              'w-full flex items-center gap-3 px-2 py-1.5 rounded-md transition-all duration-200',
              context.type === 'notes'
                ? 'bg-sidebar-accent text-white font-medium'
                : 'text-gray-300 hover:text-white hover:bg-sidebar-accent/50'
            )}
            title={collapsed ? "Anotações" : undefined}
          >
            <StickyNote className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span className="text-sm">Anotações</span>}
          </button>

          {/* Separator for Sectors */}
          {!collapsed && (
            <div className="flex items-center justify-between px-2 pt-3 pb-1">
              <span className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-widest pl-1">
                ESPAÇOS
              </span>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <button className="p-0.5 rounded hover:bg-sidebar-accent text-muted-foreground hover:text-sidebar-foreground transition-colors" title="Criar novo espaço">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Criar novo espaço</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <Input
                      placeholder="Nome do espaço"
                      value={newSectorName}
                      onChange={(e) => setNewSectorName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCreateSector()}
                    />
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="private-sector"
                          checked={isNewSectorPrivate}
                          onCheckedChange={setIsNewSectorPrivate}
                        />
                        <Label htmlFor="private-sector" className="text-sm font-normal">
                          Espaço Privado / Personalizado
                        </Label>
                      </div>

                      {/* Members Select (Only show if private) */}
                      {isNewSectorPrivate && (
                        <div className="space-y-2 pt-2 border-t border-border mt-2">
                          <Label className="text-xs text-muted-foreground">Compartilhar com (opcional)</Label>
                          <MultiAssigneeSelect
                            profiles={profiles}
                            selectedIds={selectedUsers}
                            onChange={setSelectedUsers}
                            placeholder="Selecione membros para convidar"
                          />
                          <p className="text-[10px] text-muted-foreground">
                            Os usuários selecionados poderão ver este espaço. (Admins/master sempre podem ver).
                          </p>
                        </div>
                      )}
                    </div>
                    <Button onClick={handleCreateSector} disabled={!newSectorName.trim()}>
                      Criar Espaço
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}

          {/* Espaços list */}
          {isLoading ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">Carregando...</div>
          ) : (
            <div className="space-y-4">
              {/* Públicos */}
              <div className="space-y-0.5">
                {sectors.filter(s => !s.is_private).map(renderSectorItem)}
              </div>

              {/* Privados do Usuário */}
              {sectors.filter(s => s.is_private).length > 0 && (
                <div className="pt-2 border-t border-sidebar-border/50">
                  {!collapsed && (
                    <div className="px-2 mb-1">
                      <span className="text-[10px] font-semibold text-indigo-400 uppercase tracking-widest pl-1">
                        Meus Espaços Privados
                      </span>
                    </div>
                  )}
                  <div className="space-y-0.5">
                    {sectors.filter(s => s.is_private).map(renderSectorItem)}
                  </div>
                </div>
              )}
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

      {/* Dialog for Creating New Section */}
      <Dialog open={isSectionDialogOpen} onOpenChange={setIsSectionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Seção</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <Input
              placeholder="Nome da seção"
              value={newSectionTitle}
              onChange={(e) => setNewSectionTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateSection()}
            />
            <Button onClick={handleCreateSection} disabled={!newSectionTitle.trim()}>
              Criar Seção
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog for Sector Settings */}
      <SectorSettingsDialog
        sectorId={activeConfigSectorId}
        open={isConfigDialogOpen}
        onOpenChange={setIsConfigDialogOpen}
        isAdmin={isAdmin}
        isGestorOrAdmin={isGestorOrAdmin}
        currentUserId={user?.id}
      />

      {/* Dialog for Sector Deletion */}
      <AlertDialog open={!!sectorToDelete} onOpenChange={(open) => !open && setSectorToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir espaço?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Excluirá "{sectorToDelete?.name}" e todas as tarefas e rotinas associadas a ele.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-white"
              onClick={async () => {
                if (sectorToDelete) {
                  await deleteSector.mutateAsync(sectorToDelete.id);
                  setSectorToDelete(null);
                }
              }}
            >
              Sim, Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
};
