import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import type { Tables, Enums } from '@/integrations/supabase/types';

export type Routine = Tables<'routines'>;
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

      return data as Routine[];
    },
    enabled: !!user?.id,
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
