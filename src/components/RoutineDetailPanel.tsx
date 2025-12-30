import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  Calendar,
  Users,
  Flag,
  Clock,
  ChevronDown,
  Check,
  Circle,
  Loader2,
  Play,
  RotateCcw,
  Trash2,
  Pencil,
  Plus,
  X,
  MinusCircle,
  MoreVertical,
  Search,
  Filter,
  RefreshCw,
  CheckCircle2,
  MessageSquare,
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { useDeleteRoutine, useUpdateRoutine } from '@/hooks/useRoutineMutations';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './ui/alert-dialog';
import { useIsGestorOrAdmin } from '@/hooks/useUserRole';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Textarea } from './ui/textarea';
import { ProgressBar } from './ProgressBar';
import { RoutineEditDialog } from './RoutineEditDialog';
import { CheckinRow } from './CheckinRow';
import {
  useCurrentPeriodCheckins,
  useCreatePeriodWithCheckins,
  useCompleteCheckin,
  useMarkCheckinNotCompleted,
  useUndoCheckin,
} from '@/hooks/useRoutineCheckins';
import { useRoutineTasks } from '@/hooks/useTasks';
import { useUpdateTask } from '@/hooks/useTaskMutations';
import { useUnitManagers } from '@/hooks/useUnitManagers';
import { useProfiles } from '@/hooks/useProfiles';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import type { Tables, Enums } from '@/integrations/supabase/types';
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addWeeks,
} from 'date-fns';
import { toast } from 'sonner';

interface RoutineDetailPanelProps {
  routine: Tables<'routines'>;
  onClose: () => void;
}

type TaskFrequency = Enums<'task_frequency'>;

const frequencyLabels: Record<string, string> = {
  diaria: 'Diária',
  semanal: 'Semanal',
  quinzenal: 'Quinzenal',
  mensal: 'Mensal',
  anual: 'Anual',
};

const getPeriodDates = (frequency: string): { start: Date; end: Date } => {
  const now = new Date();
  switch (frequency) {
    case 'diaria':
      return { start: startOfDay(now), end: endOfDay(now) };
    case 'semanal':
      return {
        start: startOfWeek(now, { weekStartsOn: 1 }),
        end: endOfWeek(now, { weekStartsOn: 1 }),
      };
    case 'quinzenal':
      return {
        start: startOfWeek(now, { weekStartsOn: 1 }),
        end: endOfWeek(addWeeks(now, 1), { weekStartsOn: 1 }),
      };
    case 'mensal':
      return { start: startOfMonth(now), end: endOfMonth(now) };
    default:
      return { start: startOfDay(now), end: endOfDay(now) };
  }
};

const getInitials = (name: string | null | undefined): string => {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

const avatarColors = [
  'bg-pink-500',
  'bg-purple-500',
  'bg-indigo-500',
  'bg-blue-500',
  'bg-teal-500',
  'bg-green-500',
  'bg-yellow-500',
  'bg-orange-500',
  'bg-red-500',
];

const getAvatarColor = (id: string): string => {
  const index = id.charCodeAt(0) % avatarColors.length;
  return avatarColors[index];
};

export const RoutineDetailPanel = ({
  routine,
  onClose,
}: RoutineDetailPanelProps) => {
  const [isSubtasksExpanded, setIsSubtasksExpanded] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [closeConfirmDialogOpen, setCloseConfirmDialogOpen] = useState(false);
  const [taskStatusDialogOpen, setTaskStatusDialogOpen] = useState(false);
  const [selectedTaskForStatus, setSelectedTaskForStatus] = useState<{ id: string, status: 'concluida' | 'nao_aplicavel' } | null>(null);
  const [taskComment, setTaskComment] = useState('');

  // Editable fields
  const [title, setTitle] = useState(routine.title);
  const [description, setDescription] = useState(routine.description || '');
  const [frequency, setFrequency] = useState<TaskFrequency>(routine.frequency);

  const { user } = useAuth();
  const { data: periodData, isLoading } = useCurrentPeriodCheckins(routine.id);
  const { data: routineTasksData, isLoading: isLoadingTasks } = useRoutineTasks(routine.id);
  const { data: unitManagers } = useUnitManagers();
  const { data: allProfiles } = useProfiles();
  const createPeriod = useCreatePeriodWithCheckins();
  const completeCheckin = useCompleteCheckin();
  const markNotCompleted = useMarkCheckinNotCompleted();
  const undoCheckin = useUndoCheckin();
  const updateTask = useUpdateTask();
  const deleteRoutine = useDeleteRoutine();
  const updateRoutine = useUpdateRoutine();
  const { isGestorOrAdmin } = useIsGestorOrAdmin();

  // Get current user's unit_id
  const userProfile = allProfiles?.find(p => p.id === user?.id);
  const userUnitId = userProfile?.unit_id;

  // Check if user is a manager for a given unit
  const isUserUnitManager = (unitId: string) => {
    return unitManagers?.some(m => m.user_id === user?.id && m.unit_id === unitId) || false;
  };

  // Check if user can edit a task (is gestor/admin, is unit manager, is assigned, or task is in their unit)
  const canEditTask = (task: any) => {
    if (isGestorOrAdmin) return true;
    if (task.unit_id && isUserUnitManager(task.unit_id)) return true;
    if (task.assigned_to === user?.id) return true;
    // Check task_assignees table (through the assignee relation)
    if (task.assignee?.id === user?.id) return true;
    // Allow if user is in the same unit as the task
    if (task.unit_id && task.unit_id === userUnitId) return true;
    return false;
  };

  const handleDeleteRoutine = async () => {
    await deleteRoutine.mutateAsync(routine.id);
    onClose();
  };

  const handleSaveChanges = async () => {
    try {
      await updateRoutine.mutateAsync({
        id: routine.id,
        data: {
          title,
          description: description || null,
          frequency,
        },
      });
      setIsEditing(false);
      toast.success('Rotina atualizada com sucesso!');
    } catch (error) {
      toast.error('Erro ao atualizar rotina');
    }
  };

  const handleCancelEdit = () => {
    setTitle(routine.title);
    setDescription(routine.description || '');
    setFrequency(routine.frequency);
    setIsEditing(false);
  };

  // Use tasks instead of checkins when available
  const childTasks = routineTasksData?.childTasks || [];
  const handleReopenRoutine = async () => {
    if (!routineTasksData?.parentTask) return;

    try {
      await updateTask.mutateAsync({
        id: routineTasksData.parentTask.id,
        status: 'pendente'
      });
      toast.success('Rotina reaberta com sucesso!');
    } catch (error) {
      toast.error('Erro ao reabrir rotina');
    }
  };

  // This variable seems to be intended to check if there's an active parent task for the current routine.
  // However, `tasks` is not defined in the provided context. Assuming it refers to a collection of tasks
  // that would include the parent task for the routine.
  // For now, I'll use `routineTasksData?.parentTask` for status checks.
  const activeParentTasks = routineTasksData?.parentTask &&
    (routineTasksData.parentTask.status === 'pendente' ||
      routineTasksData.parentTask.status === 'em_andamento' ||
      routineTasksData.parentTask.status === 'atrasada');
  const completedTasks = childTasks.filter((t) => t.status === 'concluida').length;
  const naTasks = childTasks.filter((t) => t.status === 'nao_aplicavel').length;
  const totalTasks = childTasks.length;
  const effectiveCompletedTasks = completedTasks + naTasks;

  // Fallback to checkins if no tasks yet
  const checkins = periodData?.period?.routine_checkins || [];
  const completedOrNotCompleted = checkins.filter((c) => c.status === 'completed' || c.status === 'not_completed').length;
  const completedCount = checkins.filter((c) => c.status === 'completed').length;
  const total = totalTasks > 0 ? totalTasks : checkins.length;
  const completed = totalTasks > 0 ? effectiveCompletedTasks : completedCount;

  const handleStartPeriod = async () => {
    const dates = getPeriodDates(routine.frequency);
    await createPeriod.mutateAsync({
      routineId: routine.id,
      periodStart: dates.start,
      periodEnd: dates.end,
    });
  };

  const handleCloseRoutineResolving = async () => {
    // Mark all pending tasks as completed
    const pendingTasks = childTasks.filter((t) => t.status !== 'concluida' && t.status !== 'nao_aplicavel');
    for (const task of pendingTasks) {
      await updateTask.mutateAsync({ id: task.id, status: 'concluida' });
    }
    // Mark parent task as completed if exists
    if (routineTasksData?.parentTask) {
      await updateTask.mutateAsync({ id: routineTasksData.parentTask.id, status: 'concluida' });
    }
    toast.success('Rotina encerrada! Todas as tarefas foram marcadas como concluídas.');
    setCloseConfirmDialogOpen(false);
  };

  const handleCloseRoutineWithoutResolving = async () => {
    // Just mark parent task as completed without changing child tasks
    if (routineTasksData?.parentTask) {
      await updateTask.mutateAsync({ id: routineTasksData.parentTask.id, status: 'concluida' });
    }
    toast.success('Rotina encerrada! Tarefas pendentes mantidas.');
    setCloseConfirmDialogOpen(false);
  };

  const handleToggleCheckin = async (checkinId: string, status: string) => {
    if (status === 'completed' || status === 'not_completed') {
      await undoCheckin.mutateAsync(checkinId);
    } else {
      await completeCheckin.mutateAsync({ checkinId });
    }
  };

  const handleMarkNotCompleted = async (checkinId: string) => {
    await markNotCompleted.mutateAsync({ checkinId });
  };

  const getManagersForUnit = (unitId: string) => {
    return unitManagers?.filter((m) => m.unit_id === unitId) || [];
  };

  const periodLabel = periodData?.period
    ? `${format(new Date(periodData.period.period_start), "dd/MM", { locale: ptBR })} → ${format(new Date(periodData.period.period_end), "dd/MM", { locale: ptBR })}`
    : null;

  // Determine Routine Status
  const isRoutineCompleted = routineTasksData?.parentTask?.status === 'concluida' || (total > 0 && completed === total);
  const isRoutineInProgress = !isRoutineCompleted && (
    routineTasksData?.parentTask?.status === 'em_andamento' ||
    (completed > 0 && total > 0)
  );

  const canEditRoutine = isGestorOrAdmin || isUserUnitManager(routine.unit_id || '');

  return (
    <div className="bg-card border-l border-border h-full flex flex-col overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-start justify-between mb-4">
          {isEditing ? (
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-xl font-semibold"
              placeholder="Título da rotina"
            />
          ) : (
            <h2 className="text-xl font-semibold text-foreground">{routine.title}</h2>
          )}
          <div className="flex items-center gap-2">
            {isGestorOrAdmin && !isEditing && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditDialogOpen(true)}
                  className="text-primary hover:text-primary hover:bg-primary/10"
                  title="Edição completa"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir rotina?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Essa ação não pode ser desfeita. A rotina será desativada permanentemente.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteRoutine}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {deleteRoutine.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'Excluir'
                        )}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
            {isEditing && (
              <>
                <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
                  <X className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveChanges}
                  disabled={updateRoutine.isPending}
                >
                  {updateRoutine.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                </Button>
              </>
            )}
            <Button variant="ghost" size="sm" onClick={onClose}>
              ✕
            </Button>
          </div>
        </div>

        {/* Status Row */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-3">
            <Circle className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Status</span>
            <button
              onClick={() => setCloseConfirmDialogOpen(true)}
              className={cn(
                'ml-auto px-2 py-0.5 text-xs font-medium rounded-full border inline-flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity',
                isRoutineCompleted
                  ? 'bg-success/20 text-success border-success/30'
                  : isRoutineInProgress
                    ? 'bg-primary/20 text-primary border-primary/30'
                    : 'bg-warning/20 text-warning border-warning/30'
              )}
            >
              {isRoutineCompleted ? 'CONCLUÍDA' : isRoutineInProgress ? 'EM ANDAMENTO' : 'PENDENTE'}
              <ChevronDown className="h-3 w-3" />
            </button>

            {/* Close Routine Confirmation Dialog */}
            <AlertDialog open={closeConfirmDialogOpen} onOpenChange={setCloseConfirmDialogOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Encerrar Rotina</AlertDialogTitle>
                  <AlertDialogDescription>
                    {childTasks.filter((t) => t.status !== 'concluida' && t.status !== 'nao_aplicavel').length > 0 ? (
                      <>
                        Existem <strong>{childTasks.filter((t) => t.status !== 'concluida' && t.status !== 'nao_aplicavel').length} tarefa(s) pendente(s)</strong>.
                        Como deseja encerrar esta rotina?
                      </>
                    ) : (
                      'Todas as tarefas já estão concluídas. Deseja encerrar a rotina?'
                    )}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex flex-col sm:flex-col gap-2 sm:space-x-0 w-full">
                  <div className="flex-1" /> {/* Spacer */}
                  <AlertDialogCancel className="mt-0 w-full sm:w-auto">Cancelar</AlertDialogCancel>
                  {childTasks.filter((t) => t.status !== 'concluida' && t.status !== 'nao_aplicavel').length > 0 && (
                    <Button
                      variant="outline"
                      onClick={handleCloseRoutineWithoutResolving}
                      disabled={updateTask.isPending}
                      className="w-full sm:w-auto"
                    >
                      {updateTask.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Encerrar Sem Resolver
                    </Button>
                  )}
                  <Button
                    onClick={handleCloseRoutineResolving}
                    disabled={updateTask.isPending}
                    className="bg-success hover:bg-success/90 w-full sm:w-auto whitespace-nowrap"
                  >
                    {updateTask.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                    {childTasks.filter((t) => t.status !== 'concluida' && t.status !== 'nao_aplicavel').length > 0
                      ? 'Encerrar Resolvendo Todas'
                      : 'Encerrar'}
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          <div className="flex items-center gap-3">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Responsáveis</span>
            <span className="ml-auto text-muted-foreground">{total} pessoas</span>
          </div>

          <div className="flex items-center gap-3">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Período</span>
            {periodLabel ? (
              <span className="ml-auto text-primary font-medium">{periodLabel}</span>
            ) : (
              <span className="ml-auto text-muted-foreground">Não iniciado</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <RotateCcw className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Recorrência</span>
            {isEditing ? (
              <Select value={frequency} onValueChange={(v) => setFrequency(v as TaskFrequency)}>
                <SelectTrigger className="ml-auto w-32 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="diaria">Diária</SelectItem>
                  <SelectItem value="semanal">Semanal</SelectItem>
                  <SelectItem value="quinzenal">Quinzenal</SelectItem>
                  <SelectItem value="mensal">Mensal</SelectItem>
                  <SelectItem value="anual">Anual</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <span className="ml-auto text-foreground">
                {frequencyLabels[routine.frequency]}
              </span>
            )}
          </div>
        </div>

        {/* Quick edit button */}
        {canEditRoutine && !isEditing && (
          isRoutineCompleted ? (
            <Button
              className="mt-4 w-full gap-2 bg-yellow-500 hover:bg-yellow-600 text-white"
              onClick={handleReopenRoutine}
              disabled={updateTask.isPending}
            >
              {updateTask.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Reabrir Rotina
            </Button>
          ) : (
            <Button
              className="mt-4 w-full gap-2 bg-green-600 hover:bg-green-700"
              onClick={() => setCloseConfirmDialogOpen(true)} // Changed to setCloseConfirmDialogOpen
              disabled={updateTask.isPending}
            >
              {updateTask.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Encerrar Rotina
            </Button>
          )
        )}
        {/* Quick Edit Removed */}
      </div>

      {/* Description */}
      <div className="p-6 border-b border-border">
        {isEditing ? (
          <Textarea
            placeholder="Adicione uma descrição..."
            className="resize-none"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        ) : (
          <p className="text-muted-foreground">
            {routine.description || 'Sem descrição'}
          </p>
        )}
      </div>

      {/* Subtasks Section */}
      <div className="flex-1 overflow-auto">
        <button
          onClick={() => setIsSubtasksExpanded(!isSubtasksExpanded)}
          className="w-full p-4 flex items-center gap-2 hover:bg-secondary/30 transition-colors"
        >
          <ChevronDown
            className={cn(
              'w-4 h-4 text-muted-foreground transition-transform',
              !isSubtasksExpanded && '-rotate-90'
            )}
          />
          <span className="text-sm font-medium text-foreground">Tarefas por Responsável</span>
          <span className="text-xs text-muted-foreground">
            {completed} / {total}
          </span>
          <div className="ml-auto">
            <ProgressBar completed={completed} total={total} className="w-24 h-1.5" />
          </div>
        </button>

        {isSubtasksExpanded && (
          <div className="border-t border-border">
            {isLoading || isLoadingTasks ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : !periodData?.period && childTasks.length === 0 ? (
              <div className="text-center py-12 px-6">
                <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-muted-foreground mb-4">
                  Nenhum período ativo. Inicie um novo período para criar tarefas.
                </p>
                <Button
                  onClick={handleStartPeriod}
                  disabled={createPeriod.isPending}
                  className="gap-2"
                >
                  {createPeriod.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  Iniciar Período
                </Button>
              </div>
            ) : childTasks.length > 0 ? (

              <div className="divide-y divide-border">
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs text-muted-foreground uppercase tracking-wider bg-secondary/30">
                  <div className="col-span-5">Nome</div>
                  <div className="col-span-4">Responsável</div>
                  <div className="col-span-3">Vencimento</div>
                </div>

                {/* Task Rows */}
                {childTasks.map((task) => {
                  const isTaskCompleted = task.status === 'concluida';
                  const isTaskNA = task.status === 'nao_aplicavel';
                  const assignee = (task as any).assignee;
                  const userCanEdit = canEditTask(task);

                  // Debuging
                  // console.log('Task:', task.id, assignee?.full_name, assignee?.id); 
                  // console.log('Checkins:', checkins.map(c => ({ id: c.id, user: c.assignee_user_id, notes: c.notes })));

                  // Find associated checkin to get notes

                  // Find associated checkin to get notes - Robust lookup
                  // Find associated checkin to get notes - Robust lookup
                  const assignees = (task as any).assignees as any[];
                  const taskCheckin = checkins.find(c =>
                    // Priority 1: Exact match on assignee_user_id
                    (assignees && assignees.some(a => a.id === c.assignee_user_id)) ||
                    (assignee?.id && c.assignee_user_id === assignee.id) ||
                    // Priority 2: Match on unit_id if checkin has no assignee (legacy/unclaimed)
                    (c.unit_id === task.unit_id && !c.assignee_user_id) ||
                    // Priority 3: Match on unit_id and the task assignee is the one who completed it (fallback)
                    (c.unit_id === task.unit_id && c.completed_by === assignees?.[0]?.id)
                  );
                  const taskComment = taskCheckin?.notes;

                  return (
                    <div
                      key={task.id}
                      className={cn(
                        'grid grid-cols-12 gap-2 px-4 py-1.5 items-center transition-colors hover:bg-secondary/20 group',
                        isTaskCompleted && 'bg-success/5',
                        isTaskNA && 'bg-muted/20'
                      )}
                    >
                      {/* Name with checkboxes */}
                      <div className="col-span-5 flex items-center gap-2">
                        {userCanEdit && (
                          <>
                            {/* Green checkbox for completing */}
                            <button
                              onClick={() => {
                                if (isTaskCompleted) {
                                  updateTask.mutate({ id: task.id, status: 'pendente' });
                                } else {
                                  setSelectedTaskForStatus({ id: task.id, status: 'concluida' });
                                  setTaskComment('');
                                  setTaskStatusDialogOpen(true);
                                }
                              }}
                              disabled={updateTask.isPending}
                              className={cn(
                                'w-5 h-5 rounded border-2 flex items-center justify-center transition-all flex-shrink-0',
                                isTaskCompleted
                                  ? 'bg-success border-success text-white'
                                  : 'border-success/50 hover:border-success hover:bg-success/10'
                              )}
                              title="Concluída"
                            >
                              {isTaskCompleted && <Check className="h-3 w-3" />}
                            </button>

                            {/* Red checkbox for N/A */}
                            <button
                              onClick={() => {
                                if (isTaskNA) {
                                  updateTask.mutate({ id: task.id, status: 'pendente' });
                                } else {
                                  setSelectedTaskForStatus({ id: task.id, status: 'nao_aplicavel' });
                                  setTaskComment('');
                                  setTaskStatusDialogOpen(true);
                                }
                              }}
                              disabled={updateTask.isPending}
                              className={cn(
                                'w-5 h-5 rounded border-2 flex items-center justify-center transition-all flex-shrink-0',
                                isTaskNA
                                  ? 'bg-destructive border-destructive text-white'
                                  : 'border-destructive/50 hover:border-destructive hover:bg-destructive/10'
                              )}
                              title="Não se Aplica"
                            >
                              {isTaskNA && <X className="h-3 w-3" />}
                            </button>
                          </>
                        )}

                        <div className="flex flex-col overflow-hidden">
                          <span
                            className={cn(
                              'font-medium text-sm truncate',
                              (isTaskCompleted || isTaskNA) && 'text-muted-foreground line-through'
                            )}
                          >
                            {(task as any).unit?.name || 'Sem unidade'}
                          </span>
                          {taskComment && (
                            <div className="flex items-start gap-1 mt-1">
                              <MessageSquare className="w-3 h-3 text-blue-500 mt-0.5 flex-shrink-0" />
                              <span className="text-xs text-blue-600 font-medium break-words leading-tight">
                                {taskComment}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Responsible */}
                      <div className="col-span-4 flex items-center gap-1">
                        {(task as any).assignees && (task as any).assignees.length > 0 ? (
                          <div className="flex -space-x-2 overflow-hidden">
                            {(task as any).assignees.slice(0, 3).map((assignee: any) => (
                              <Avatar key={assignee.id} className={cn('h-6 w-6 border-2 border-background', getAvatarColor(assignee.id))} title={assignee.full_name}>
                                <AvatarFallback className="text-[10px] text-white">
                                  {getInitials(assignee.full_name)}
                                </AvatarFallback>
                              </Avatar>
                            ))}
                            {(task as any).assignees.length > 3 && (
                              <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center border-2 border-background text-[10px] font-medium" title={`+${(task as any).assignees.length - 3} outros`}>
                                +{(task as any).assignees.length - 3}
                              </div>
                            )}
                          </div>
                        ) : assignee ? (
                          <div className="flex items-center gap-1">
                            <Avatar className={cn('h-6 w-6', getAvatarColor(assignee.id))}>
                              <AvatarFallback className="text-[10px] text-white">
                                {getInitials(assignee.full_name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm text-muted-foreground truncate">
                              {assignee.full_name || assignee.email}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground truncate">—</span>
                        )}
                        {/* Show name if only one assignee in list mode to keep consistency if needed, but avatar group is better for multi */}
                        {(task as any).assignees && (task as any).assignees.length === 1 && (
                          <span className="text-sm text-muted-foreground truncate ml-1">
                            {(task as any).assignees[0].full_name}
                          </span>
                        )}
                      </div>

                      {/* Due Date */}
                      <div className="col-span-3 flex items-center">
                        {task.due_date ? (
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(task.due_date), 'dd/MM', { locale: ptBR })}
                          </span>
                        ) : periodData?.period?.period_end ? (
                          <span className="text-xs text-muted-foreground" title="Fim do ciclo">
                            {format(new Date(periodData.period.period_end), 'dd/MM', { locale: ptBR })}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : checkins.length > 0 ? (
              <div className="divide-y divide-border">
                {/* Table Header for legacy checkins */}
                <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs text-muted-foreground uppercase tracking-wider bg-secondary/30">
                  <div className="col-span-5">Nome</div>
                  <div className="col-span-3">Responsável</div>
                  <div className="col-span-2">Ações</div>
                  <div className="col-span-2">Vencimento</div>
                </div>

                {/* Checkin Rows */}
                {checkins.map((checkin) => {
                  const isCompleted = checkin.status === 'completed';
                  const managers = getManagersForUnit(checkin.unit_id);

                  return (
                    <CheckinRow
                      key={checkin.id}
                      checkin={checkin}
                      isCompleted={isCompleted}
                      managers={managers}
                      periodEnd={periodData?.period?.period_end}
                      onToggle={() => handleToggleCheckin(checkin.id, checkin.status || 'pending')}
                      onMarkNotCompleted={() => handleMarkNotCompleted(checkin.id)}
                      isToggling={completeCheckin.isPending || undoCheckin.isPending || markNotCompleted.isPending}
                      isGestorOrAdmin={isGestorOrAdmin}
                      allProfiles={allProfiles}
                    />
                  );
                })}
              </div>

            ) : (
              <div className="text-center py-12 text-muted-foreground">
                Nenhum responsável atribuído à rotina
              </div>
            )}
          </div>
        )}
      </div>

      {/* Task Status Dialog with Comment */}
      <Dialog open={taskStatusDialogOpen} onOpenChange={setTaskStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedTaskForStatus?.status === 'concluida' ? 'Concluir Tarefa' : 'Marcar como Não se Aplica'}
            </DialogTitle>
            <DialogDescription>
              Deseja adicionar um comentário a esta ação?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Digite seu comentário (opcional)..."
              value={taskComment}
              onChange={(e) => setTaskComment(e.target.value)}
              className="resize-none"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTaskStatusDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (selectedTaskForStatus) {
                  updateTask.mutate({
                    id: selectedTaskForStatus.id,
                    status: selectedTaskForStatus.status,
                    comment: taskComment
                  });
                  setTaskStatusDialogOpen(false);
                }
              }}
              disabled={updateTask.isPending}
              className={cn(
                selectedTaskForStatus?.status === 'concluida'
                  ? 'bg-success hover:bg-success/90'
                  : 'bg-destructive hover:bg-destructive/90'
              )}
            >
              {updateTask.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : selectedTaskForStatus?.status === 'concluida' ? (
                <Check className="h-4 w-4 mr-2" />
              ) : (
                <X className="h-4 w-4 mr-2" />
              )}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Full Edit Dialog */}
      <RoutineEditDialog
        routine={routine}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />
    </div>
  );
};
