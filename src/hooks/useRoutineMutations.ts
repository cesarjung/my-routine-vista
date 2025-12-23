import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Enums } from '@/integrations/supabase/types';

type TaskFrequency = Enums<'task_frequency'>;

interface SubtaskData {
  title: string;
  assigned_to: string | null;
}

interface CreateRoutineData {
  title: string;
  description?: string;
  frequency: TaskFrequency;
}

interface CreateRoutineWithUnitsData extends CreateRoutineData {
  unitIds: string[];
  subtasks?: SubtaskData[];
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

      // Create the routine
      const { data: routine, error: routineError } = await supabase
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

      // Get managers for each unit to assign tasks
      const { data: unitManagers } = await supabase
        .from('unit_managers')
        .select('unit_id, user_id')
        .in('unit_id', data.unitIds);

      // Create a map of unit_id -> first manager user_id
      const unitManagerMap = new Map<string, string>();
      unitManagers?.forEach(um => {
        if (!unitManagerMap.has(um.unit_id)) {
          unitManagerMap.set(um.unit_id, um.user_id);
        }
      });

      // Create checkins AND tasks for each selected unit
      if (data.unitIds.length > 0) {
        // Create checkins
        const checkins = data.unitIds.map((unitId) => ({
          routine_period_id: period.id,
          unit_id: unitId,
        }));

        const { error: checkinsError } = await supabase
          .from('routine_checkins')
          .insert(checkins);

        if (checkinsError) throw checkinsError;

        // Create tasks for each unit (so managers see them as pending tasks)
        const tasks = data.unitIds.map((unitId) => ({
          title: `[Rotina] ${routine.title}`,
          description: data.description || `Rotina ${data.frequency}: ${routine.title}`,
          unit_id: unitId,
          routine_id: routine.id,
          assigned_to: unitManagerMap.get(unitId) || null,
          created_by: user.id,
          start_date: periodStart.toISOString(),
          due_date: periodEnd.toISOString(),
          status: 'pendente' as const,
          priority: 2,
        }));

        const { data: createdTasks, error: tasksError } = await supabase
          .from('tasks')
          .insert(tasks)
          .select();

        if (tasksError) throw tasksError;

        // Create subtasks for each created task if subtasks were provided
        if (data.subtasks && data.subtasks.length > 0 && createdTasks) {
          const allSubtasks = createdTasks.flatMap((task, index) => 
            data.subtasks!.map((subtask, subtaskIndex) => ({
              task_id: task.id,
              title: subtask.title,
              assigned_to: subtask.assigned_to,
              order_index: subtaskIndex,
              is_completed: false,
            }))
          );

          const { error: subtasksError } = await supabase
            .from('subtasks')
            .insert(allSubtasks);

          if (subtasksError) throw subtasksError;
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
