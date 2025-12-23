import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Enums } from '@/integrations/supabase/types';

type TaskFrequency = Enums<'task_frequency'>;

interface UnitAssignment {
  unitId: string;
  assignedTo: string | null;
}

type RecurrenceMode = 'schedule' | 'on_completion';

interface CreateRoutineData {
  title: string;
  description?: string;
  frequency: TaskFrequency;
  recurrenceMode?: RecurrenceMode;
}

interface CreateRoutineWithUnitsData extends CreateRoutineData {
  unitAssignments: UnitAssignment[];
  parentAssignedTo?: string | null; // Responsável da rotina/tarefa mãe
}

interface UpdateRoutineData extends Partial<CreateRoutineData> {
  is_active?: boolean;
}

export const useCreateRoutine = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateRoutineData) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error('Usuário não autenticado');

      const { data: routine, error } = await supabase
        .from('routines')
        .insert({
          title: data.title,
          description: data.description || null,
          frequency: data.frequency,
          created_by: user.id,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;
      return routine;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routines'] });
      toast({
        title: 'Rotina criada',
        description: 'A nova rotina foi criada com sucesso.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao criar rotina',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

export const useCreateRoutineWithUnits = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateRoutineWithUnitsData) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error('Usuário não autenticado');

      // Get the user's unit_id and role
      const { data: profile } = await supabase
        .from('profiles')
        .select('unit_id')
        .eq('id', user.id)
        .single();

      const { data: userRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      const userUnitId = profile?.unit_id;
      const isAdminOrGestor = userRole?.role === 'admin' || userRole?.role === 'gestor';

      // Create the routine (without unit_id - it's optional)
      const { data: routine, error: routineError } = await supabase
        .from('routines')
        .insert({
          title: data.title,
          description: data.description || null,
          frequency: data.frequency,
          recurrence_mode: data.recurrenceMode || 'schedule',
          created_by: user.id,
          is_active: true,
          // unit_id is optional - only set if there's a single unit assignment
          unit_id: data.unitAssignments.length === 1 ? data.unitAssignments[0].unitId : null,
        })
        .select()
        .single();

      if (routineError) throw routineError;

      // Calculate period dates based on frequency
      const now = new Date();
      let periodStart: Date;
      let periodEnd: Date;

      switch (data.frequency) {
        case 'diaria':
          periodStart = new Date(now.setHours(0, 0, 0, 0));
          periodEnd = new Date(now.setHours(23, 59, 59, 999));
          break;
        case 'semanal':
          const dayOfWeek = now.getDay();
          const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
          periodStart = new Date(now);
          periodStart.setDate(now.getDate() + diffToMonday);
          periodStart.setHours(0, 0, 0, 0);
          periodEnd = new Date(periodStart);
          periodEnd.setDate(periodStart.getDate() + 6);
          periodEnd.setHours(23, 59, 59, 999);
          break;
        case 'quinzenal':
          const dayOfWeek2 = now.getDay();
          const diffToMonday2 = dayOfWeek2 === 0 ? -6 : 1 - dayOfWeek2;
          periodStart = new Date(now);
          periodStart.setDate(now.getDate() + diffToMonday2);
          periodStart.setHours(0, 0, 0, 0);
          periodEnd = new Date(periodStart);
          periodEnd.setDate(periodStart.getDate() + 13);
          periodEnd.setHours(23, 59, 59, 999);
          break;
        case 'mensal':
          periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
          periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
          break;
        default:
          periodStart = new Date(now.setHours(0, 0, 0, 0));
          periodEnd = new Date(now.setHours(23, 59, 59, 999));
      }

      // Create the first period
      const { data: period, error: periodError } = await supabase
        .from('routine_periods')
        .insert({
          routine_id: routine.id,
          period_start: periodStart.toISOString(),
          period_end: periodEnd.toISOString(),
          is_active: true,
        })
        .select()
        .single();

      if (periodError) throw periodError;

      // Extract unit IDs from assignments
      const unitIds = data.unitAssignments.map(a => a.unitId);

      // Create a map of unit_id -> assigned_to from user selection
      const unitAssigneeMap = new Map<string, string | null>();
      data.unitAssignments.forEach(a => {
        unitAssigneeMap.set(a.unitId, a.assignedTo);
      });

      // If units were selected, create checkins and tasks for each unit
      if (unitIds.length > 0) {
        // Create checkins
        const checkins = unitIds.map((unitId) => ({
          routine_period_id: period.id,
          unit_id: unitId,
        }));

        const { error: checkinsError } = await supabase
          .from('routine_checkins')
          .insert(checkins);

        if (checkinsError) throw checkinsError;

        // Criar tarefa mãe (para gestores acompanharem o progresso geral)
        const firstUnitId = unitIds[0];
        const { data: parentTask, error: parentTaskError } = await supabase
          .from('tasks')
          .insert({
            title: `[Rotina] ${routine.title}`,
            description: data.description || `Rotina ${data.frequency}: ${routine.title}`,
            unit_id: firstUnitId,
            routine_id: routine.id,
            assigned_to: data.parentAssignedTo || user.id,
            created_by: user.id,
            start_date: periodStart.toISOString(),
            due_date: periodEnd.toISOString(),
            status: 'pendente' as const,
            priority: 2,
            parent_task_id: null,
          })
          .select()
          .single();

        if (parentTaskError) throw parentTaskError;

        // Create tasks filhas for each unit with the selected responsible
        const childTasks = unitIds.map((unitId) => ({
          title: `[Rotina] ${routine.title}`,
          description: data.description || `Rotina ${data.frequency}: ${routine.title}`,
          unit_id: unitId,
          routine_id: routine.id,
          assigned_to: unitAssigneeMap.get(unitId) || null,
          created_by: user.id,
          start_date: periodStart.toISOString(),
          due_date: periodEnd.toISOString(),
          status: 'pendente' as const,
          priority: 2,
          parent_task_id: parentTask.id,
        }));

        const { error: tasksError } = await supabase
          .from('tasks')
          .insert(childTasks);

        if (tasksError) throw tasksError;
      } else {
        // No units selected
        // Admins/Gestores podem criar sem unidade
        // Regular users MUST have a unit_id in their profile
        if (!isAdminOrGestor && !userUnitId) {
          throw new Error('Você precisa estar associado a uma unidade para criar rotinas.');
        }

        const { error: taskError } = await supabase
          .from('tasks')
          .insert({
            title: `[Rotina] ${routine.title}`,
            description: data.description || `Rotina ${data.frequency}: ${routine.title}`,
            unit_id: userUnitId || null, // null for admins/gestors without unit
            routine_id: routine.id,
            assigned_to: data.parentAssignedTo || user.id,
            created_by: user.id,
            start_date: periodStart.toISOString(),
            due_date: periodEnd.toISOString(),
            status: 'pendente' as const,
            priority: 2,
            parent_task_id: null,
          });

        if (taskError) throw taskError;

        // Create a checkin for the user's unit only if they have one
        if (userUnitId) {
          const { error: checkinError } = await supabase
            .from('routine_checkins')
            .insert({
              routine_period_id: period.id,
              unit_id: userUnitId,
            });

          if (checkinError) throw checkinError;
        }
      }

      return routine;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routines'] });
      queryClient.invalidateQueries({ queryKey: ['routine-periods'] });
      queryClient.invalidateQueries({ queryKey: ['current-period-checkins'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['user-subtasks'] });
      toast({
        title: 'Rotina criada',
        description: 'A rotina foi criada com tarefas e subtarefas para cada unidade.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao criar rotina',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

export const useUpdateRoutine = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateRoutineData }) => {
      const { data: routine, error } = await supabase
        .from('routines')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return routine;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routines'] });
      toast({
        title: 'Rotina atualizada',
        description: 'A rotina foi atualizada com sucesso.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao atualizar rotina',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

export const useDeleteRoutine = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('routines')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routines'] });
      toast({
        title: 'Rotina removida',
        description: 'A rotina foi desativada com sucesso.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao remover rotina',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};
