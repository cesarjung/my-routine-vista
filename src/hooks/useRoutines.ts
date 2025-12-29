import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import type { Tables, Enums } from '@/integrations/supabase/types';

export type Routine = Tables<'routines'> & {
  status?: 'pendente' | 'concluida' | 'inativa';
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
        .select('*')
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

        // Buscar rotinas atribuídas ao usuário
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
          // Mostrar se o usuário está na tabela routine_assignees
          if (assignedRoutineIds.has(routine.id)) return true;
          // Mostrar se a rotina é da unidade do usuário
          if (userUnitId && routine.unit_id === userUnitId) return true;
          // Mostrar se existe um checkin para a unidade do usuário nesta rotina
          if (routinesWithUserUnitCheckins.has(routine.id)) return true;
          return false;
        });
      }

      // Calculate status for each routine
      const routines = data as Routine[];
      const routineIds = routines.map(r => r.id);

      if (routineIds.length === 0) return routines;

      // Fetch active parent tasks (Tarefas Mães) that are NOT concluded
      const { data: activeTasks } = await supabase
        .from('tasks')
        .select('routine_id')
        .in('routine_id', routineIds)
        .is('parent_task_id', null)
        .neq('status', 'concluida')
        .neq('status', 'cancelada'); // Assuming cancelada is also "done" for the queue

      const activeRoutineIds = new Set(activeTasks?.map(t => t.routine_id));

      const routinesWithStatus = routines.map(r => ({
        ...r,
        status: !r.is_active
          ? 'inativa'
          : (activeRoutineIds.has(r.id) ? 'pendente' : 'concluida')
      })) as Routine[]; // Cast to ensure TS is happy

      // Filter logic for non-admin users (Copied from existing logic but applied to new list)
      if (role === 'usuario' && user?.id) {
        // ... (Keep existing filtering logic but use 'routinesWithStatus')
        // To avoid re-writing the huge block, I will return here if admin, and let the existing block handle filtering if user.
        // Wait, the existing block uses `(data as Routine[])`. I should apply filtering to `routinesWithStatus`.
      }

      // Let's refactor slightly to avoid code duplication if possible, or just insert the logic.
      // The existing code returns at the end.

      let finalRoutines = routinesWithStatus;

      if (role === 'usuario' && user?.id) {
        // ... (existing helper queries) ...
        const { data: profile } = await supabase.from('profiles').select('unit_id').eq('id', user.id).single();
        const userUnitId = profile?.unit_id;
        const { data: routineAssignees } = await supabase.from('routine_assignees').select('routine_id').eq('user_id', user.id);
        const assignedRoutineIds = new Set(routineAssignees?.map(ra => ra.routine_id) || []);

        // ... (checkins logic) ...
        let routinesWithUserUnitCheckins = new Set<string>();
        if (userUnitId) { // ... existing logic ...
          const { data: checkins } = await supabase.from('routine_checkins').select('routine_period_id').eq('unit_id', userUnitId);
          if (checkins && checkins.length > 0) {
            const periodIds = checkins.map(c => c.routine_period_id);
            const { data: periods } = await supabase.from('routine_periods').select('routine_id').in('id', periodIds);
            routinesWithUserUnitCheckins = new Set(periods?.map(p => p.routine_id) || []);
          }
        }

        finalRoutines = finalRoutines.filter(routine => {
          if (assignedRoutineIds.has(routine.id)) return true;
          if (userUnitId && routine.unit_id === userUnitId) return true;
          if (routinesWithUserUnitCheckins.has(routine.id)) return true;
          return false;
        });
      }

      return finalRoutines;
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
