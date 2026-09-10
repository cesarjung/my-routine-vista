import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useProfiles } from '@/hooks/useProfiles';
import { useIsGestorOrAdmin, useIsAdmin } from '@/hooks/useUserRole';
import { reportesService, ReporteItem, ReporteStatus, ReportePrioridade } from '@/services/reportes';
import {
  Bug,
  Plus,
  Search,
  Filter,
  Clock,
  CheckCircle2,
  AlertCircle,
  Paperclip,
  Image as ImageIcon,
  ExternalLink,
  Download,
  Trash2,
  MessageSquare,
  MessageCircle,
  Send,
  Hash,
  User,
  ShieldCheck,
  RefreshCw,
  X,
  UploadCloud,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const ReportesView = () => {
  const { user } = useAuth();
  const { data: profiles = [] } = useProfiles();
  const { isGestorOrAdmin } = useIsGestorOrAdmin();
  const { isAdmin } = useIsAdmin();

  // Current logged in user profile
  const myProfile = useMemo(() => {
    return profiles.find((p) => p.id === user?.id);
  }, [profiles, user?.id]);

  const loggedUserName = myProfile?.full_name || (user?.user_metadata?.full_name as string) || user?.email?.split('@')[0] || 'Usuário';
  const loggedUserEmail = user?.email || '';

  // Data state
  const [reportes, setReportes] = useState<ReporteItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | ReporteStatus>('todos');
  const [mostrarResolvidos, setMostrarResolvidos] = useState(true);

  // Dialogs
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);
  const [isResponseDialogOpen, setIsResponseDialogOpen] = useState(false);
  const [selectedReportForResponse, setSelectedReportForResponse] = useState<ReporteItem | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  // New report form state
  const [newTitulo, setNewTitulo] = useState('');
  const [newDescricao, setNewDescricao] = useState('');
  const [newCategoria, setNewCategoria] = useState('Interface / Visual');
  const [newPrioridade, setNewPrioridade] = useState<ReportePrioridade>('media');
  const [anexoFile, setAnexoFile] = useState<{
    name: string;
    type: string;
    base64: string;
    previewUrl: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Management response form state
  const [manageStatus, setManageStatus] = useState<ReporteStatus>('em_andamento');
  const [manageResposta, setManageResposta] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Chat & Interações state
  const [chatInputs, setChatInputs] = useState<Record<string, string>>({});
  const [openChats, setOpenChats] = useState<Record<string, boolean>>({});
  const [sendingChatId, setSendingChatId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load reportes
  const loadData = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      const data = await reportesService.list();
      setReportes(data);
    } catch (err) {
      console.error('Erro ao carregar reportes:', err);
      toast.error('Não foi possível carregar a lista de reportes.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Listen for paste (Ctrl+V) when modal is open to easily attach screenshots
  useEffect(() => {
    if (!isNewDialogOpen) return;

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            handleFileSelect(file);
            toast.info('Print colado da área de transferência com sucesso!');
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isNewDialogOpen]);

  const handleFileSelect = (file: File) => {
    if (file.size > 15 * 1024 * 1024) {
      toast.error('O arquivo é muito grande. O limite máximo é de 15MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setAnexoFile({
        name: file.name || `print_${Date.now()}.png`,
        type: file.type || 'image/png',
        base64,
        previewUrl: base64,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleCreateReporte = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDescricao.trim()) {
      toast.error('Por favor, informe a descrição do erro identificado.');
      return;
    }

    setIsSubmitting(true);
    try {
      await reportesService.create({
        titulo: newTitulo.trim() || 'Reporte de Erro',
        descricao: newDescricao.trim(),
        categoria: newCategoria,
        prioridade: newPrioridade,
        usuario_id: user?.id || 'anon',
        usuario_nome: loggedUserName,
        usuario_email: loggedUserEmail,
        anexo_base64: anexoFile?.base64,
        anexo_nome: anexoFile?.name,
        anexo_tipo: anexoFile?.type,
      });

      toast.success('Reporte enviado com sucesso! A equipe técnica foi notificada.');
      setIsNewDialogOpen(false);
      // Reset form
      setNewTitulo('');
      setNewDescricao('');
      setNewCategoria('Interface / Visual');
      setNewPrioridade('media');
      setAnexoFile(null);

      // Reload
      await loadData(false);
    } catch (err: any) {
      console.error('Erro ao enviar reporte:', err);
      toast.error(err.message || 'Erro ao enviar reporte.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open manage/response dialog
  const handleOpenResponseDialog = (item: ReporteItem) => {
    setSelectedReportForResponse(item);
    setManageStatus(item.status);
    setManageResposta(item.resposta || '');
    setIsResponseDialogOpen(true);
  };

  // Submit status/response update (Managers/Admins)
  const handleUpdateStatusAndResponse = async () => {
    if (!selectedReportForResponse) return;

    setIsUpdatingStatus(true);
    try {
      const updated = await reportesService.update({
        id: selectedReportForResponse.id,
        status: manageStatus,
        resposta: manageResposta.trim() || undefined,
        respondido_por_id: user?.id,
        respondido_por_nome: loggedUserName,
      });

      toast.success(`Reporte atualizado para "${manageStatus === 'resolvido' ? 'Resolvido' : manageStatus === 'em_andamento' ? 'Em andamento' : 'Pendente'}"!`);
      setIsResponseDialogOpen(false);
      setSelectedReportForResponse(null);

      // Update in state
      setReportes((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch (err: any) {
      console.error('Erro ao atualizar status:', err);
      toast.error(err.message || 'Falha ao atualizar o reporte.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Direct quick status change for managers
  const handleQuickStatusChange = async (item: ReporteItem, newStatus: ReporteStatus) => {
    try {
      const updated = await reportesService.update({
        id: item.id,
        status: newStatus,
        respondido_por_id: user?.id,
        respondido_por_nome: loggedUserName,
      });
      toast.success(`Status alterado para "${newStatus === 'resolvido' ? 'Resolvido' : newStatus === 'em_andamento' ? 'Em andamento' : 'Pendente'}" por ${loggedUserName}!`);
      setReportes((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch (err: any) {
      toast.error('Erro ao alterar status.');
    }
  };

  // Delete reporte
  const handleDeleteReporte = async (id: string) => {
    if (!window.confirm('Tem certeza de que deseja remover este reporte?')) return;
    try {
      await reportesService.delete(id);
      setReportes((prev) => prev.filter((r) => r.id !== id));
      toast.success('Reporte removido.');
    } catch (err) {
      toast.error('Erro ao excluir reporte.');
    }
  };

  // Toggle chat expansion
  const toggleChat = (id: string) => {
    setOpenChats((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Enviar mensagem no chat do chamado
  const handleSendMessage = async (reporte: ReporteItem) => {
    const text = (chatInputs[reporte.id] || '').trim();
    if (!text) return;

    // Verificar se o usuário logado tem permissão para interagir (autor ou gestor/admin)
    const isAuthor =
      user?.id === reporte.usuario_id ||
      (user?.email && reporte.usuario_email && user.email.toLowerCase() === reporte.usuario_email.toLowerCase());

    if (!isAuthor && !isGestorOrAdmin) {
      toast.error('Apenas o solicitante do chamado e administradores/gestores podem interagir.');
      return;
    }

    setSendingChatId(reporte.id);
    try {
      const userRole = isAdmin ? 'admin' : isGestorOrAdmin ? 'gestor' : 'usuario';
      const updated = await reportesService.addMessage(reporte.id, {
        usuario_id: user?.id || 'anon',
        usuario_nome: loggedUserName,
        usuario_role: userRole,
        mensagem: text,
      });

      // Atualiza o reporte no estado local
      setReportes((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      // Limpa o input
      setChatInputs((prev) => ({ ...prev, [reporte.id]: '' }));
      // Garante que o chat fica aberto
      setOpenChats((prev) => ({ ...prev, [reporte.id]: true }));
      toast.success('Mensagem enviada no chamado!');
    } catch (err: any) {
      console.error('Erro ao enviar mensagem no chat:', err);
      toast.error(err.message || 'Erro ao enviar mensagem.');
    } finally {
      setSendingChatId(null);
    }
  };

  // Metrics
  const metrics = useMemo(() => {
    const total = reportes.length;
    const pendentes = reportes.filter((r) => r.status === 'pendente').length;
    const emAndamento = reportes.filter((r) => r.status === 'em_andamento').length;
    const resolvidos = reportes.filter((r) => r.status === 'resolvido').length;
    return { total, pendentes, emAndamento, resolvidos };
  }, [reportes]);

  // Filtered list
  const filteredReportes = useMemo(() => {
    return reportes.filter((r) => {
      // Se "mostrarResolvidos" estiver desmarcado, esconde os resolvidos a não ser que o filtro ativo seja 'resolvido'
      if (!mostrarResolvidos && r.status === 'resolvido' && statusFilter !== 'resolvido') {
        return false;
      }
      const matchesStatus = statusFilter === 'todos' ? true : r.status === statusFilter;
      const query = searchQuery.toLowerCase().trim();
      const numQuery = query.replace('#', '').trim();
      const matchesSearch =
        !query ||
        r.titulo.toLowerCase().includes(query) ||
        r.descricao.toLowerCase().includes(query) ||
        r.usuario_nome.toLowerCase().includes(query) ||
        (r.numero && (r.numero.toString() === numQuery || `#${r.numero}`.includes(query))) ||
        (r.categoria && r.categoria.toLowerCase().includes(query)) ||
        (r.respondido_por_nome && r.respondido_por_nome.toLowerCase().includes(query)) ||
        (r.mensagens && r.mensagens.some((m) => m.mensagem.toLowerCase().includes(query) || m.usuario_nome.toLowerCase().includes(query)));
      return matchesStatus && matchesSearch;
    });
  }, [reportes, statusFilter, searchQuery, mostrarResolvidos]);

  return (
    <div className="space-y-6 pb-12 animate-in fade-in-50 duration-200">
      {/* Top Banner & Action Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-6 rounded-xl border shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Bug className="w-5 h-5 text-primary" />
              Central de Reportes de Erros
            </h2>
            <Badge variant="outline" className="text-xs bg-muted/50 font-normal">
              Suporte & Qualidade
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Espaço para identificação e acompanhamento de bugs e melhorias no aplicativo.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setIsRefreshing(true);
              loadData(false);
            }}
            disabled={isRefreshing}
            className="h-9 gap-2"
          >
            <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
            Atualizar
          </Button>

          <Button
            onClick={() => setIsNewDialogOpen(true)}
            className="h-9 gap-2 shadow-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Reportar Erro
          </Button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total */}
        <Card
          onClick={() => setStatusFilter('todos')}
          className={cn(
            "border shadow-sm cursor-pointer transition-all hover:border-primary/50",
            statusFilter === 'todos' && "ring-1 ring-primary/40 bg-primary/[0.02]"
          )}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Reportes</CardTitle>
            <Bug className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{metrics.total}</div>
            <p className="text-xs text-muted-foreground mt-1">Registros totais no sistema</p>
          </CardContent>
        </Card>

        {/* Pendentes */}
        <Card
          onClick={() => setStatusFilter('pendente')}
          className={cn(
            "border shadow-sm border-amber-200/50 dark:border-amber-900/30 bg-amber-50/20 dark:bg-amber-950/10 cursor-pointer transition-all hover:border-amber-400/70",
            statusFilter === 'pendente' && "ring-1 ring-amber-500/50"
          )}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-amber-700 dark:text-amber-400">Pendentes</CardTitle>
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">{metrics.pendentes}</div>
            <p className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-1">Aguardando avaliação da gestão</p>
          </CardContent>
        </Card>

        {/* Em Andamento */}
        <Card
          onClick={() => setStatusFilter('em_andamento')}
          className={cn(
            "border shadow-sm border-blue-200/50 dark:border-blue-900/30 bg-blue-50/20 dark:bg-blue-950/10 cursor-pointer transition-all hover:border-blue-400/70",
            statusFilter === 'em_andamento' && "ring-1 ring-blue-500/50"
          )}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-400">Em Andamento</CardTitle>
            <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">{metrics.emAndamento}</div>
            <p className="text-xs text-blue-600/80 dark:text-blue-400/80 mt-1">Sendo analisados ou corrigidos</p>
          </CardContent>
        </Card>

        {/* Resolvidos */}
        <Card
          onClick={() => {
            setStatusFilter('resolvido');
            setMostrarResolvidos(true);
          }}
          className={cn(
            "border shadow-sm border-emerald-200/50 dark:border-emerald-900/30 bg-emerald-50/20 dark:bg-emerald-950/10 cursor-pointer transition-all hover:border-emerald-400/70",
            statusFilter === 'resolvido' && "ring-1 ring-emerald-500/50"
          )}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Resolvidos</CardTitle>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{metrics.resolvidos}</div>
            <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 mt-1">Erros solucionados</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Status Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-lg border w-fit overflow-x-auto">
          <button
            onClick={() => setStatusFilter('todos')}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap',
              statusFilter === 'todos'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Todos ({metrics.total})
          </button>
          <button
            onClick={() => setStatusFilter('pendente')}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap',
              statusFilter === 'pendente'
                ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 shadow-sm font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Pendentes ({metrics.pendentes})
          </button>
          <button
            onClick={() => setStatusFilter('em_andamento')}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap',
              statusFilter === 'em_andamento'
                ? 'bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 shadow-sm font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Em Andamento ({metrics.emAndamento})
          </button>
          <button
            onClick={() => {
              setStatusFilter('resolvido');
              setMostrarResolvidos(true);
            }}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap',
              statusFilter === 'resolvido'
                ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 shadow-sm font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Resolvidos ({metrics.resolvidos})
          </button>
        </div>

        {/* Right Controls: Switch Mostrar Resolvidos + Search */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Switch Mostrar Resolvidos */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-card rounded-lg border shadow-sm h-9">
            <Switch
              id="toggle-resolvidos"
              checked={mostrarResolvidos}
              onCheckedChange={setMostrarResolvidos}
            />
            <label
              htmlFor="toggle-resolvidos"
              className="text-xs font-medium cursor-pointer select-none text-foreground flex items-center gap-1.5 whitespace-nowrap"
            >
              <CheckCircle2 className={cn("w-3.5 h-3.5", mostrarResolvidos ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")} />
              <span>Mostrar resolvidos</span>
            </label>
          </div>

          {/* Search */}
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar reporte ou usuário..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Reports List */}
      {isLoading ? (
        <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-6 h-6 animate-spin text-primary" />
          <span className="text-sm font-medium">Carregando reportes...</span>
        </div>
      ) : filteredReportes.length === 0 ? (
        <div className="p-12 text-center border rounded-xl bg-card/50 flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <Bug className="w-6 h-6" />
          </div>
          <h3 className="font-semibold text-base text-foreground">Nenhum reporte encontrado</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            {searchQuery
              ? 'Nenhum resultado corresponde aos termos da busca.'
              : statusFilter !== 'todos'
              ? `Não há reportes com o status "${statusFilter}".`
              : 'Nenhum erro foi reportado até o momento. Caso encontre alguma falha, clique no botão "Reportar Erro".'}
          </p>
          <Button onClick={() => setIsNewDialogOpen(true)} variant="outline" size="sm" className="mt-2 gap-2">
            <Plus className="w-4 h-4" />
            Criar Primeiro Reporte
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredReportes.map((reporte) => {
            const isImageAttachment =
              reporte.anexo_tipo?.startsWith('image/') ||
              reporte.anexo_nome?.match(/\.(png|jpe?g|gif|webp|bmp)$/i) ||
              reporte.anexo_url?.startsWith('data:image/');

            return (
              <Card
                key={reporte.id}
                className={cn(
                  'border transition-all duration-200 hover:shadow-md relative overflow-hidden',
                  reporte.status === 'resolvido' && 'border-emerald-200/70 dark:border-emerald-900/40 bg-emerald-50/5 dark:bg-emerald-950/5',
                  reporte.status === 'em_andamento' && 'border-blue-200/70 dark:border-blue-900/40 bg-blue-50/5 dark:bg-blue-950/5'
                )}
              >
                {/* Status indicator bar on left */}
                <div
                  className={cn(
                    'absolute left-0 top-0 bottom-0 w-1.5',
                    reporte.status === 'pendente' && 'bg-amber-500',
                    reporte.status === 'em_andamento' && 'bg-blue-500',
                    reporte.status === 'resolvido' && 'bg-emerald-500'
                  )}
                />

                <CardContent className="p-5 pl-6">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    {/* Main info */}
                    <div className="space-y-3 flex-1">
                      {/* Tags & Header */}
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Ticket Number Badge */}
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/25 font-bold text-xs gap-1">
                          <Hash className="w-3 h-3 text-primary" />
                          Chamado #{reporte.numero || '?'}
                        </Badge>

                        {/* Status Badge */}
                        {reporte.status === 'pendente' && (
                          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 border-amber-300/40 gap-1.5 font-semibold text-xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            Pendente
                          </Badge>
                        )}
                        {reporte.status === 'em_andamento' && (
                          <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 hover:bg-blue-500/20 border-blue-300/40 gap-1.5 font-semibold text-xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            Em andamento
                          </Badge>
                        )}
                        {reporte.status === 'resolvido' && (
                          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 border-emerald-300/40 gap-1.5 font-semibold text-xs">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Resolvido
                          </Badge>
                        )}

                        {/* Category */}
                        {reporte.categoria && (
                          <Badge variant="outline" className="text-xs text-muted-foreground font-normal">
                            {reporte.categoria}
                          </Badge>
                        )}

                        {/* Date */}
                        <span className="text-xs text-muted-foreground">
                          {reporte.created_at
                            ? format(new Date(reporte.created_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })
                            : ''}
                        </span>
                      </div>

                      {/* Title */}
                      <h4 className="text-base font-semibold text-foreground tracking-tight flex items-center gap-1.5">
                        <span className="text-primary font-bold">#{reporte.numero || ''}</span>
                        <span>{reporte.titulo}</span>
                      </h4>

                      {/* Description */}
                      <p className="text-sm text-foreground/90 whitespace-pre-line leading-relaxed bg-muted/20 p-3 rounded-lg border border-border/40">
                        {reporte.descricao}
                      </p>

                      {/* Attachment preview / download */}
                      {reporte.anexo_url && (
                        <div className="pt-1">
                          <div className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
                            <Paperclip className="w-3.5 h-3.5" />
                            Print / Arquivo Anexo:
                          </div>

                          {isImageAttachment ? (
                            <div className="flex items-center gap-3">
                              <div
                                onClick={() => setPreviewImageUrl(reporte.anexo_url)}
                                className="relative group cursor-pointer border rounded-lg overflow-hidden max-w-xs max-h-48 bg-black/5 hover:opacity-95 transition-all shadow-sm"
                              >
                                <img
                                  src={reporte.anexo_url}
                                  alt={reporte.anexo_nome || 'Print do erro'}
                                  className="w-full object-cover max-h-40"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-medium gap-1.5">
                                  <ImageIcon className="w-4 h-4" />
                                  Clique para ampliar
                                </div>
                              </div>
                              <a
                                href={reporte.anexo_url}
                                download={reporte.anexo_nome || 'anexo_erro.png'}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                              >
                                <Download className="w-3.5 h-3.5" />
                                Baixar
                              </a>
                            </div>
                          ) : (
                            <a
                              href={reporte.anexo_url}
                              download={reporte.anexo_nome || 'anexo'}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 p-2 rounded-md border bg-card hover:bg-muted text-xs font-medium text-foreground transition-colors"
                            >
                              <Paperclip className="w-4 h-4 text-primary" />
                              <span>{reporte.anexo_nome || 'Baixar arquivo anexo'}</span>
                              <Download className="w-3.5 h-3.5 text-muted-foreground ml-2" />
                            </a>
                          )}
                        </div>
                      )}

                      {/* Author Info */}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                        <User className="w-3.5 h-3.5 text-primary" />
                        <span>
                          Reportado por: <strong className="text-foreground font-medium">{reporte.usuario_nome}</strong>
                          {reporte.usuario_email && <span className="opacity-70 ml-1">({reporte.usuario_email})</span>}
                        </span>
                      </div>

                      {/* Management Response Box (if responded/updated) */}
                      {(reporte.resposta || reporte.respondido_por_nome) && (
                        <div className="mt-3 p-3.5 rounded-lg border border-primary/20 bg-primary/5 space-y-1.5">
                          <div className="flex items-center justify-between text-xs font-semibold text-primary">
                            <span className="flex items-center gap-1.5">
                              <ShieldCheck className="w-4 h-4" />
                              Parecer da Gestão / Resposta Técnica:
                            </span>
                            {reporte.respondido_em && (
                              <span className="text-xs text-muted-foreground font-normal">
                                {format(new Date(reporte.respondido_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                              </span>
                            )}
                          </div>

                          {reporte.resposta && (
                            <p className="text-xs text-foreground/90 leading-relaxed font-normal whitespace-pre-line">
                              {reporte.resposta}
                            </p>
                          )}

                          {reporte.respondido_por_nome && (
                            <div className="text-[11px] text-muted-foreground pt-0.5">
                              Responsável pelo atendimento:{' '}
                              <span className="font-semibold text-foreground">{reporte.respondido_por_nome}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Management Actions (Visible to Gestores and Admins) */}
                    <div className="flex flex-col items-end gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-border/50">
                      {isGestorOrAdmin ? (
                        <div className="flex flex-col sm:flex-row lg:flex-col gap-2 w-full sm:w-auto">
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleOpenResponseDialog(reporte)}
                            className="h-8 text-xs gap-1.5"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            Gerenciar / Responder
                          </Button>

                          {/* Quick change buttons */}
                          <div className="flex items-center gap-1">
                            {reporte.status !== 'em_andamento' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleQuickStatusChange(reporte, 'em_andamento')}
                                className="h-7 text-[11px] px-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50"
                                title="Marcar como Em andamento"
                              >
                                Em andamento
                              </Button>
                            )}

                            {reporte.status !== 'resolvido' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleQuickStatusChange(reporte, 'resolvido')}
                                className="h-7 text-[11px] px-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
                                title="Marcar como Resolvido"
                              >
                                Resolvido
                              </Button>
                            )}

                            {reporte.status !== 'pendente' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleQuickStatusChange(reporte, 'pendente')}
                                className="h-7 text-[11px] px-2 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/50"
                                title="Voltar para Pendente"
                              >
                                Pendente
                              </Button>
                            )}

                            {isAdmin && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteReporte(reporte.id)}
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                title="Excluir reporte"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ) : (
                        /* Regular user info */
                        <div className="text-right">
                          <span className="text-[11px] text-muted-foreground block">
                            Status atual: <strong className="text-foreground capitalize">{reporte.status.replace('_', ' ')}</strong>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Seção de Interação / Chat entre Solicitante e Gestão */}
                  {(() => {
                    const isAuthor =
                      user?.id === reporte.usuario_id ||
                      (user?.email && reporte.usuario_email && user.email.toLowerCase() === reporte.usuario_email.toLowerCase());
                    const canChat = isAuthor || isGestorOrAdmin;
                    const mensagens = reporte.mensagens || [];
                    const isChatOpen = !!openChats[reporte.id] || mensagens.length > 0;

                    return (
                      <div className="mt-4 pt-4 border-t border-border/60">
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => toggleChat(reporte.id)}
                            className="flex items-center gap-2 text-xs font-semibold text-foreground hover:text-primary transition-colors cursor-pointer group py-1"
                          >
                            <div className="w-6 h-6 rounded-full bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center text-primary transition-colors">
                              <MessageCircle className="w-3.5 h-3.5" />
                            </div>
                            <span>Interações & Chat do Chamado</span>
                            {mensagens.length > 0 ? (
                              <Badge variant="secondary" className="text-[11px] px-1.5 py-0 font-bold bg-primary/15 text-primary border-primary/20">
                                {mensagens.length} {mensagens.length === 1 ? 'mensagem' : 'mensagens'}
                              </Badge>
                            ) : (
                              <span className="text-[11px] text-muted-foreground font-normal">
                                (Sem mensagens)
                              </span>
                            )}
                            {isChatOpen ? (
                              <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                            )}
                          </button>

                          {!isChatOpen && canChat && mensagens.length === 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleChat(reporte.id)}
                              className="h-7 text-xs gap-1 text-primary hover:text-primary hover:bg-primary/10"
                            >
                              <MessageCircle className="w-3 h-3" />
                              Escrever mensagem
                            </Button>
                          )}
                        </div>

                        {/* Conteúdo do Chat Expandido */}
                        {isChatOpen && (
                          <div className="mt-3 space-y-3 bg-muted/20 p-3.5 rounded-lg border border-border/40 animate-in fade-in-50 duration-200">
                            {/* Histórico de Mensagens */}
                            {mensagens.length > 0 ? (
                              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                                {mensagens.map((msg) => {
                                  const isMe =
                                    msg.usuario_id === user?.id ||
                                    (user?.email && msg.usuario_nome?.toLowerCase().includes(user.email.split('@')[0].toLowerCase()));
                                  const isManagement = msg.usuario_role === 'admin' || msg.usuario_role === 'gestor';

                                  return (
                                    <div
                                      key={msg.id}
                                      className={cn(
                                        'flex flex-col text-xs rounded-lg p-2.5 max-w-[92%] sm:max-w-[80%]',
                                        isMe
                                          ? 'ml-auto bg-primary text-primary-foreground shadow-sm'
                                          : isManagement
                                          ? 'mr-auto bg-blue-50 dark:bg-blue-950/40 border border-blue-200/50 dark:border-blue-900/40 text-foreground'
                                          : 'mr-auto bg-card border text-foreground'
                                      )}
                                    >
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className={cn('font-semibold truncate', isMe ? 'text-primary-foreground' : 'text-foreground')}>
                                          {msg.usuario_nome}
                                        </span>
                                        {isManagement ? (
                                          <span
                                            className={cn(
                                              'text-[10px] px-1.5 py-0.2 rounded-full font-medium',
                                              isMe
                                                ? 'bg-white/20 text-white'
                                                : 'bg-blue-500/15 text-blue-700 dark:text-blue-400'
                                            )}
                                          >
                                            {msg.usuario_role === 'admin' ? 'Admin' : 'Gestão'}
                                          </span>
                                        ) : (
                                          <span
                                            className={cn(
                                              'text-[10px] px-1.5 py-0.2 rounded-full font-medium',
                                              isMe ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'
                                            )}
                                          >
                                            Solicitante
                                          </span>
                                        )}
                                        <span
                                          className={cn(
                                            'text-[10px] ml-auto opacity-75',
                                            isMe ? 'text-primary-foreground/80' : 'text-muted-foreground'
                                          )}
                                        >
                                          {msg.created_at
                                            ? format(new Date(msg.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })
                                            : ''}
                                        </span>
                                      </div>
                                      <div className={cn('whitespace-pre-line leading-relaxed break-words', isMe ? 'text-primary-foreground/95' : 'text-foreground/90')}>
                                        {msg.mensagem}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="text-center py-2 text-xs text-muted-foreground">
                                Nenhuma interação registrada ainda. Use o campo abaixo para dialogar com {isGestorOrAdmin ? 'o solicitante' : 'a equipe de suporte'}.
                              </div>
                            )}

                            {/* Caixa de Envio */}
                            {canChat ? (
                              <div className="flex items-end gap-2 pt-1 border-t border-border/40">
                                <Textarea
                                  placeholder={`Escreva uma mensagem como ${loggedUserName}... (Pressione Enter para enviar)`}
                                  value={chatInputs[reporte.id] || ''}
                                  onChange={(e) => setChatInputs((prev) => ({ ...prev, [reporte.id]: e.target.value }))}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                      e.preventDefault();
                                      handleSendMessage(reporte);
                                    }
                                  }}
                                  rows={2}
                                  className="text-xs resize-none min-h-[42px] bg-background"
                                />
                                <Button
                                  size="sm"
                                  onClick={() => handleSendMessage(reporte)}
                                  disabled={!chatInputs[reporte.id]?.trim() || sendingChatId === reporte.id}
                                  className="h-10 px-3 shrink-0 gap-1.5 text-xs font-semibold shadow-sm"
                                >
                                  {sendingChatId === reporte.id ? (
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <>
                                      <Send className="w-3.5 h-3.5" />
                                      <span className="hidden sm:inline">Enviar</span>
                                    </>
                                  )}
                                </Button>
                              </div>
                            ) : (
                              <div className="text-[11px] text-muted-foreground bg-muted/40 p-2 rounded text-center">
                                Apenas o solicitante deste chamado e a equipe de gestão podem interagir por mensagens.
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* DIALOG: NOVO REPORTE */}
      <Dialog open={isNewDialogOpen} onOpenChange={setIsNewDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Bug className="w-5 h-5 text-primary" />
              Reportar um Erro
            </DialogTitle>
            <DialogDescription>
              Descreva a falha que você encontrou para que nossa equipe técnica possa reproduzir e corrigir.
            </DialogDescription>
          </DialogHeader>

          {/* User identification badge */}
          <div className="p-3 bg-muted/40 rounded-lg border text-xs flex items-center gap-2 text-muted-foreground">
            <User className="w-4 h-4 text-primary shrink-0" />
            <div>
              Reportando como: <strong className="text-foreground">{loggedUserName}</strong>
              {loggedUserEmail && <span className="opacity-80"> ({loggedUserEmail})</span>}
            </div>
          </div>

          <form onSubmit={handleCreateReporte} className="space-y-4 pt-2">
            {/* Titulo */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Título / Resumo do Problema</label>
              <Input
                placeholder="Ex: Erro ao carregar o mapa da Carteira"
                value={newTitulo}
                onChange={(e) => setNewTitulo(e.target.value)}
                className="text-sm"
              />
            </div>

            {/* Categoria e Prioridade */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Módulo / Categoria</label>
                <Select value={newCategoria} onValueChange={setNewCategoria}>
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Interface / Visual">Interface / Visual</SelectItem>
                    <SelectItem value="Tarefas / Rotinas">Tarefas / Rotinas</SelectItem>
                    <SelectItem value="Planejamento de Rota">Planejamento de Rota</SelectItem>
                    <SelectItem value="Equipes / Deslocamento">Equipes / Deslocamento</SelectItem>
                    <SelectItem value="PCP / Programação">PCP / Programação</SelectItem>
                    <SelectItem value="Almoxarifado / Envios">Almoxarifado / Envios</SelectItem>
                    <SelectItem value="Lentidão / Desempenho">Lentidão / Desempenho</SelectItem>
                    <SelectItem value="Erro ao Salvar">Erro ao Salvar</SelectItem>
                    <SelectItem value="Outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Prioridade</label>
                <Select value={newPrioridade} onValueChange={(val: any) => setNewPrioridade(val)}>
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa (Pequeno ajuste visual)</SelectItem>
                    <SelectItem value="media">Média (Não impede o uso)</SelectItem>
                    <SelectItem value="alta">Alta (Prejudica o trabalho)</SelectItem>
                    <SelectItem value="urgente">Urgente (Sistema travado)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Descricao */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span>Descrição detalhada do erro *</span>
                <span className="text-[11px] text-muted-foreground font-normal">Obrigatório</span>
              </label>
              <Textarea
                placeholder="Explique detalhadamente o que aconteceu, qual botão clicou ou qual mensagem de erro apareceu na tela..."
                value={newDescricao}
                onChange={(e) => setNewDescricao(e.target.value)}
                rows={4}
                required
                className="text-sm resize-none"
              />
            </div>

            {/* Anexo de Print ou Arquivo */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Paperclip className="w-3.5 h-3.5 text-primary" />
                  Salvar Print ou Arquivo
                </span>
                <span className="text-[11px] text-primary/80 font-normal">Dica: Você pode dar Ctrl+V de um print aqui!</span>
              </label>

              {anexoFile ? (
                <div className="flex items-center justify-between p-3 border rounded-lg bg-card text-xs">
                  <div className="flex items-center gap-2 overflow-hidden">
                    {anexoFile.type.startsWith('image/') ? (
                      <img
                        src={anexoFile.previewUrl}
                        alt="Preview"
                        className="w-10 h-10 object-cover rounded border shrink-0"
                      />
                    ) : (
                      <Paperclip className="w-6 h-6 text-primary shrink-0" />
                    )}
                    <span className="truncate font-medium">{anexoFile.name}</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setAnexoFile(null)}
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 hover:bg-primary/5 rounded-lg p-5 text-center cursor-pointer transition-colors space-y-1.5"
                >
                  <UploadCloud className="w-6 h-6 text-muted-foreground mx-auto" />
                  <div className="text-xs font-medium text-foreground">
                    Clique para selecionar um arquivo ou imagem
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Formatos aceitos: PNG, JPG, JPEG, GIF, PDF (máx. 15MB) ou cole o print com Ctrl+V.
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileSelect(file);
                      e.target.value = '';
                    }}
                  />
                </div>
              )}
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsNewDialogOpen(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting} className="gap-2">
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Bug className="w-4 h-4" />
                    Enviar Reporte
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG: GERENCIAR / RESPONDER REPORTE (GESTORES E ADMINS) */}
      <Dialog open={isResponseDialogOpen} onOpenChange={setIsResponseDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="w-5 h-5 text-primary" />
              <span>Gerenciar Chamado #{selectedReportForResponse?.numero || ''}</span>
            </DialogTitle>
            <DialogDescription>
              Atualize o status deste chamado e deixe uma resposta técnica para o usuário.
            </DialogDescription>
          </DialogHeader>

          {selectedReportForResponse && (
            <div className="space-y-4 pt-2">
              <div className="p-3 bg-muted/40 rounded-lg text-xs space-y-1">
                <div className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                  <span className="text-primary font-bold">#{selectedReportForResponse.numero || ''}</span>
                  <span>{selectedReportForResponse.titulo}</span>
                </div>
                <div className="text-muted-foreground line-clamp-2">{selectedReportForResponse.descricao}</div>
                <div className="text-muted-foreground pt-1">
                  Aberto por: <strong className="text-foreground">{selectedReportForResponse.usuario_nome}</strong>
                </div>
              </div>

              {/* Status Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Status do Atendimento</label>
                <Select value={manageStatus} onValueChange={(val: any) => setManageStatus(val)}>
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="em_andamento">Em andamento</SelectItem>
                    <SelectItem value="resolvido">Resolvido</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Resposta do Gestor */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Resposta / Parecer Técnico do Gestor
                </label>
                <Textarea
                  placeholder="Ex: Identificamos que o erro ocorria devido a um formato de data incorreto. Já foi aplicada a correção na versão atual."
                  value={manageResposta}
                  onChange={(e) => setManageResposta(e.target.value)}
                  rows={4}
                  className="text-sm resize-none"
                />
                <span className="text-[11px] text-muted-foreground">
                  Esta resposta ficará gravada no nome de: <strong className="text-foreground">{loggedUserName}</strong>
                </span>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsResponseDialogOpen(false)}
                  disabled={isUpdatingStatus}
                >
                  Cancelar
                </Button>
                <Button onClick={handleUpdateStatusAndResponse} disabled={isUpdatingStatus} className="gap-2">
                  {isUpdatingStatus ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Salvar Alterações
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL LIGHTBOX PARA AMPLIAR IMAGEM DO PRINT */}
      <Dialog open={!!previewImageUrl} onOpenChange={(open) => !open && setPreviewImageUrl(null)}>
        <DialogContent className="max-w-4xl p-2 bg-black/90 border-none">
          <div className="relative flex flex-col items-center justify-center p-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPreviewImageUrl(null)}
              className="absolute top-2 right-2 text-white hover:bg-white/20 h-8 w-8 p-0 rounded-full"
            >
              <X className="w-5 h-5" />
            </Button>
            {previewImageUrl && (
              <img
                src={previewImageUrl}
                alt="Print ampliado"
                className="max-h-[85vh] w-auto max-w-full rounded object-contain shadow-2xl"
              />
            )}
            <div className="mt-2 text-center">
              <a
                href={previewImageUrl || '#'}
                download="print_erro.png"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-white/80 hover:text-white hover:underline bg-white/10 px-3 py-1.5 rounded-full"
              >
                <Download className="w-3.5 h-3.5" />
                Baixar imagem em tamanho original
              </a>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
