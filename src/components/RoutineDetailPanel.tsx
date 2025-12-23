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
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
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
  useUndoCheckin,
} from '@/hooks/useRoutineCheckins';
import { useUnitManagers } from '@/hooks/useUnitManagers';
import { useProfiles } from '@/hooks/useProfiles';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
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
  
  // Editable fields
  const [title, setTitle] = useState(routine.title);
  const [description, setDescription] = useState(routine.description || '');
  const [frequency, setFrequency] = useState<TaskFrequency>(routine.frequency);

  const { data: periodData, isLoading } = useCurrentPeriodCheckins(routine.id);
  const { data: unitManagers } = useUnitManagers();
  const { data: allProfiles } = useProfiles();
  const createPeriod = useCreatePeriodWithCheckins();
  const completeCheckin = useCompleteCheckin();
  const undoCheckin = useUndoCheckin();
  const deleteRoutine = useDeleteRoutine();
  const updateRoutine = useUpdateRoutine();
  const { isGestorOrAdmin } = useIsGestorOrAdmin();

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

  const checkins = periodData?.period?.routine_checkins || [];
  const completed = checkins.filter((c) => c.completed_at !== null).length;
  const total = checkins.length;

  const handleStartPeriod = async () => {
    const dates = getPeriodDates(routine.frequency);
    await createPeriod.mutateAsync({
      routineId: routine.id,
      periodStart: dates.start,
      periodEnd: dates.end,
    });
  };

  const handleToggleCheckin = async (checkinId: string, isCompleted: boolean) => {
    if (isCompleted) {
      await undoCheckin.mutateAsync(checkinId);
    } else {
      await completeCheckin.mutateAsync({ checkinId });
    }
  };

  const getManagersForUnit = (unitId: string) => {
    return unitManagers?.filter((m) => m.unit_id === unitId) || [];
  };

  const periodLabel = periodData?.period
    ? `${format(new Date(periodData.period.period_start), "dd/MM", { locale: ptBR })} → ${format(new Date(periodData.period.period_end), "dd/MM", { locale: ptBR })}`
    : null;

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
            <Badge
              variant="outline"
              className={cn(
                'ml-auto',
                total > 0 && completed === total
                  ? 'bg-success/20 text-success border-success/30'
                  : 'bg-warning/20 text-warning border-warning/30'
              )}
            >
              {total > 0 && completed === total ? 'CONCLUÍDA' : 'PENDENTE'}
            </Badge>
          </div>

          <div className="flex items-center gap-3">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Responsáveis</span>
            <span className="ml-auto text-muted-foreground">{total} unidades</span>
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
        {isGestorOrAdmin && !isEditing && (
          <Button
            variant="outline"
            size="sm"
            className="mt-4 w-full"
            onClick={() => setIsEditing(true)}
          >
            <Pencil className="h-4 w-4 mr-2" />
            Editar rapidamente
          </Button>
        )}
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
          <span className="text-sm font-medium text-foreground">Subtarefas</span>
          <span className="text-xs text-muted-foreground">
            {completed} / {total}
          </span>
          <div className="ml-auto">
            <ProgressBar completed={completed} total={total} className="w-24 h-1.5" />
          </div>
        </button>

        {isSubtasksExpanded && (
          <div className="border-t border-border">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : !periodData?.period ? (
              <div className="text-center py-12 px-6">
                <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-muted-foreground mb-4">
                  Nenhum período ativo. Inicie um novo período para criar checkins.
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
            ) : checkins.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Nenhuma unidade cadastrada
              </div>
            ) : (
              <div className="divide-y divide-border">
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs text-muted-foreground uppercase tracking-wider bg-secondary/30">
                  <div className="col-span-5">Nome</div>
                  <div className="col-span-3">Responsável</div>
                  <div className="col-span-2">Prioridade</div>
                  <div className="col-span-2">Vencimento</div>
                </div>

                {/* Table Rows */}
                {checkins.map((checkin) => {
                  const isCompleted = checkin.completed_at !== null;
                  const managers = getManagersForUnit(checkin.unit_id);

                  return (
                    <CheckinRow
                      key={checkin.id}
                      checkin={checkin}
                      isCompleted={isCompleted}
                      managers={managers}
                      periodEnd={periodData?.period?.period_end}
                      onToggle={() => handleToggleCheckin(checkin.id, isCompleted)}
                      isToggling={completeCheckin.isPending || undoCheckin.isPending}
                      isGestorOrAdmin={isGestorOrAdmin}
                      allProfiles={allProfiles}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Full Edit Dialog */}
      <RoutineEditDialog
        routine={routine}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />
    </div>
  );
};
