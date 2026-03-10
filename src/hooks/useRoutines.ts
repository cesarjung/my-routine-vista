import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import type { Tables, Enums } from '@/integrations/supabase/types';

export type Routine = Tables<'routines'> & {
  status?: 'pendente' | 'em_andamento' | 'concluida' | 'atrasada' | 'cancelada' | 'inativa';
};
export type TaskFrequency = Enums<'task_frequency'>;

export const useRoutines = (unitId?: string) => {
  const { user } = useAuth();
  const { data: role } = useUserRole();

  return useQuery({
    queryKey: ['routines', unitId, user?.id, role],
    queryFn: async () => {
      let query = supabase
        .from('routines')
        .select('*, routine_periods(id, period_start, period_end, is_active)')
        .eq('is_active', true)
        .order('title');

      if (unitId) {
        query = query.eq('unit_id', unitId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Se usuário não é admin/gestor, filtrar para mostrar apenas rotinas relevantes
      if (role === 'usuario' && user?.id) {
        // Buscar unit_id do usuário
        const { data: profile } = await supabase
          .from('profiles')
          .select('unit_id')
          .eq('id', user.id)
          .single();

        const userUnitId = profile?.unit_id;

        // Buscar rotinas atribuídas ao usuário diretamente na rotina
        const { data: routineAssignees } = await supabase
          .from('routine_assignees')
          .select('routine_id')
          .eq('user_id', user.id);

        const assignedRoutineIds = new Set(routineAssignees?.map(ra => ra.routine_id) || []);

        // NOVO: Buscar rotinas das quais o usuário é responsável por uma TAREFA específica
        const { data: taskAssignees } = await supabase
          .from('task_assignees')
          .select('task:tasks(routine_id)')
          .eq('user_id', user.id);

        if (taskAssignees && taskAssignees.length > 0) {
          taskAssignees.forEach((ta: any) => {
            if (ta.task && ta.task.routine_id) {
              assignedRoutineIds.add(ta.task.routine_id);
            }
          });
        }

        // NOVO 2: Buscar rotinas das quais o usuário é responsável via coluna assigned_to legado nas tasks
        const { data: directTasks } = await supabase
          .from('tasks')
          .select('routine_id')
          .eq('assigned_to', user.id);

        if (directTasks && directTasks.length > 0) {
          directTasks.forEach((t: any) => {
            if (t.routine_id) {
              assignedRoutineIds.add(t.routine_id);
            }
          });
        }

        // Buscar rotinas que têm checkins para a unidade do usuário
        let routinesWithUserUnitCheckins = new Set<string>();
        if (userUnitId) {
          const { data: checkins } = await supabase
            .from('routine_checkins')
            .select('routine_period_id')
            .eq('unit_id', userUnitId);

          if (checkins && checkins.length > 0) {
            const periodIds = checkins.map(c => c.routine_period_id);
            const { data: periods } = await supabase
              .from('routine_periods')
              .select('routine_id')
              .in('id', periodIds);

            routinesWithUserUnitCheckins = new Set(periods?.map(p => p.routine_id) || []);
          }
        }

        const routinesToCalculateStatus = (data as Routine[]).filter(routine => {
          // Mostrar se o usuário está na tabela routine_assignees ou task_assignees
          if (assignedRoutineIds.has(routine.id)) return true;
          // Mostrar se a rotina é da unidade do usuário
          if (userUnitId && routine.unit_id === userUnitId) return true;
          // Mostrar se existe um checkin para a unidade do usuário nesta rotina
          if (routinesWithUserUnitCheckins.has(routine.id)) return true;
          return false;
        });

        const routineIds = routinesToCalculateStatus.map(r => r.id);

        if (routineIds.length === 0) return routinesToCalculateStatus;

        // Fetch active parent tasks (Tarefas Mães) to determine routine status accurately
        const { data: activeTasks } = await supabase
          .from('tasks')
          .select('routine_id, status')
          .in('routine_id', routineIds)
          .is('parent_task_id', null);

        // Create a map of routine_id to its most relevant status
        const routineStatusMap = new Map<string, Routine['status']>();

        if (activeTasks) {
          // Group tasks by routine
          const tasksByRoutine = activeTasks.reduce((acc, task) => {
            if (!acc[task.routine_id]) acc[task.routine_id] = [];
            acc[task.routine_id].push(task.status);
            return acc;
          }, {} as Record<string, string[]>);

          // Determine priority status
          Object.entries(tasksByRoutine).forEach(([routineId, statuses]: [string, string[]]) => {
            if (statuses.includes('atrasada')) {
              routineStatusMap.set(routineId, 'atrasada');
            } else if (statuses.includes('em_andamento')) {
              routineStatusMap.set(routineId, 'em_andamento');
            } else if (statuses.includes('pendente')) {
              routineStatusMap.set(routineId, 'pendente');
            } else if (statuses.every(s => s === 'concluida' || s === 'cancelada' || s === 'nao_aplicavel')) {
              routineStatusMap.set(routineId, 'concluida');
            } else {
              routineStatusMap.set(routineId, 'pendente');
            }
          });
        }

        const routinesWithStatus = routinesToCalculateStatus.map(r => ({
          ...r,
          status: !r.is_active
            ? 'inativa'
            : (routineStatusMap.get(r.id) || 'concluida')
        })) as Routine[];

        return routinesWithStatus;
      }

      // ----------------------------------------------------------------------
      // If role is ADMIN or GESTOR (Bypass Visibility Filtering)
      // ----------------------------------------------------------------------

      const routines = data as Routine[];
      const routineIds = routines.map(r => r.id);

      if (routineIds.length === 0) return routines;

      // Fetch active parent tasks (Tarefas Mães) to determine routine status accurately
      const { data: activeTasks } = await supabase
        .from('tasks')
        .select('routine_id, status')
        .in('routine_id', routineIds)
        .is('parent_task_id', null);

      // Create a map of routine_id to its most relevant status
      const routineStatusMap = new Map<string, Routine['status']>();

      if (activeTasks) {
        // Group tasks by routine
        const tasksByRoutine = activeTasks.reduce((acc, task) => {
          if (!acc[task.routine_id]) acc[task.routine_id] = [];
          acc[task.routine_id].push(task.status);
          return acc;
        }, {} as Record<string, string[]>);

        // Determine priority status
        Object.entries(tasksByRoutine).forEach(([routineId, statuses]: [string, string[]]) => {
          if (statuses.includes('atrasada')) {
            routineStatusMap.set(routineId, 'atrasada');
          } else if (statuses.includes('em_andamento')) {
            routineStatusMap.set(routineId, 'em_andamento');
          } else if (statuses.includes('pendente')) {
            routineStatusMap.set(routineId, 'pendente');
          } else if (statuses.every(s => s === 'concluida' || s === 'cancelada' || s === 'nao_aplicavel')) {
            routineStatusMap.set(routineId, 'concluida');
          } else {
            routineStatusMap.set(routineId, 'pendente');
          }
        });
      }

      const routinesWithStatus = routines.map(r => ({
        ...r,
        status: !r.is_active
          ? 'inativa'
          : (routineStatusMap.get(r.id) || 'concluida')
      })) as Routine[];

      return routinesWithStatus;
    },
    enabled: !!user?.id,
  });
};

export const useDeleteRoutines = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (routineIds: string[]) => {
      const { error } = await supabase
        .from('routines')
        .delete()
        .in('id', routineIds);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routines'] });
    },
  });
};

export const useRoutinesByFrequency = (frequency: TaskFrequency) => {
  const { user } = useAuth();
  const { data: role } = useUserRole();

  return useQuery({
    queryKey: ['routines', 'frequency', frequency, user?.id, role],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('routines')
        .select('*')
        .eq('frequency', frequency)
        .eq('is_active', true)
        .order('title');

      if (error) throw error;

      // Se usuário não é admin/gestor, filtrar
      if (role === 'usuario' && user?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('unit_id')
          .eq('id', user.id)
          .single();

        const userUnitId = profile?.unit_id;

        const { data: routineAssignees } = await supabase
          .from('routine_assignees')
          .select('routine_id')
          .eq('user_id', user.id);

        const assignedRoutineIds = new Set(routineAssignees?.map(ra => ra.routine_id) || []);

        // Buscar rotinas que têm checkins para a unidade do usuário
        let routinesWithUserUnitCheckins = new Set<string>();
        if (userUnitId) {
          const { data: checkins } = await supabase
            .from('routine_checkins')
            .select('routine_period_id')
            .eq('unit_id', userUnitId);

          if (checkins && checkins.length > 0) {
            const periodIds = checkins.map(c => c.routine_period_id);
            const { data: periods } = await supabase
              .from('routine_periods')
              .select('routine_id')
              .in('id', periodIds);

            routinesWithUserUnitCheckins = new Set(periods?.map(p => p.routine_id) || []);
          }
        }

        return (data as Routine[]).filter(routine => {
          if (assignedRoutineIds.has(routine.id)) return true;
          if (userUnitId && routine.unit_id === userUnitId) return true;
          if (routinesWithUserUnitCheckins.has(routine.id)) return true;
          return false;
        });
      }

      return data as Routine[];
    },
    enabled: !!user?.id,
  });
};
