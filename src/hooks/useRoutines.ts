import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import type { Tables, Enums } from '@/integrations/supabase/types';

export type Routine = Tables<'routines'> & {
  status?: 'pendente' | 'em_andamento' | 'concluida' | 'atrasada' | 'cancelada' | 'inativa';
  active_statuses?: string[];
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
        .order('title');

      if (unitId) {
        query = query.eq('unit_id', unitId);
      }

      const { data, error } = await query;

      if (error) throw error;

      const routines = (data || []) as Routine[];
      const routineIds = routines.map(r => r.id);

      if (routineIds.length === 0) return routines;

      // Fetch active tasks to determine routine status accurately
      const todayStr = new Date().toISOString().substring(0, 10);

      const { data: activeTasks } = await supabase
        .from('tasks')
        .select('routine_id, status, due_date')
        .in('routine_id', routineIds)
        .lte('due_date', `${todayStr}T23:59:59.999Z`);

      // Create a map of routine_id to its most relevant status
      const routineStatusMap = new Map<string, Routine['status']>();
      const routineActiveStatusesMap = new Map<string, string[]>();

      if (activeTasks) {
        // Group tasks by routine
        const tasksByRoutine = activeTasks.reduce((acc, task) => {
          if (!acc[task.routine_id]) acc[task.routine_id] = [];

          let effectiveStatus = task.status;
          if (effectiveStatus === 'pendente' && task.due_date) {
            const taskDate = task.due_date.substring(0, 10);
            if (taskDate < todayStr) {
              effectiveStatus = 'atrasada';
            }
          }
          acc[task.routine_id].push(effectiveStatus);
          return acc;
        }, {} as Record<string, string[]>);

        // Determine priority status and active statuses
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

          const uniqueStatuses = Array.from(new Set(statuses));
          if (uniqueStatuses.every(s => s === 'concluida' || s === 'cancelada' || s === 'nao_aplicavel')) {
            routineActiveStatusesMap.set(routineId, ['concluida']);
          } else {
            const active = uniqueStatuses.filter(s => s !== 'concluida' && s !== 'cancelada' && s !== 'nao_aplicavel');
            routineActiveStatusesMap.set(routineId, active.length ? active : ['concluida']);
          }
        });
      }

      const routinesWithStatus = routines.map(r => ({
        ...r,
        status: !r.is_active
          ? 'inativa'
          : (routineStatusMap.get(r.id) || 'pendente'),
        active_statuses: !r.is_active
          ? ['inativa']
          : (routineActiveStatusesMap.get(r.id) || ['pendente'])
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
      const chunkSize = 100;
      for (let i = 0; i < routineIds.length; i += chunkSize) {
        const chunk = routineIds.slice(i, i + chunkSize);
        
        // 1. Soft-delete routines
        const { error: updateError } = await supabase
          .from('routines')
          .update({ is_active: false })
          .in('id', chunk);

        if (updateError) throw updateError;
        
        // 2. Cascade delete all pending future tasks for these routines
        const { error: tasksError } = await supabase
          .from('tasks')
          .delete()
          .in('routine_id', chunk)
          .eq('status', 'pendente');
          
        if (tasksError) {
           console.error("Erro ao deletar tarefas futuras das rotinas:", tasksError);
        }

        // 3. Cascade delete all future periods for these routines
        const today = new Date().toISOString();
        const { error: periodsError } = await supabase
          .from('routine_periods')
          .delete()
          .in('routine_id', chunk)
          .gte('start_date', today);
          
        if (periodsError) {
           console.error("Erro ao deletar períodos futuros das rotinas:", periodsError);
        }
      }
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
        .order('title');

      if (error) throw error;

      const routines = (data || []) as Routine[];
      const normalizeFreq = (f?: string): string => {
        if (!f) return 'diaria';
        const norm = f.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (norm.startsWith('diar')) return 'diaria';
        if (norm.startsWith('seman')) return 'semanal';
        if (norm.startsWith('quinz')) return 'quinzenal';
        if (norm.startsWith('mens')) return 'mensal';
        return norm;
      };

      const targetFreq = normalizeFreq(frequency);
      return routines.filter(r => normalizeFreq(r.frequency) === targetFreq);
    },
    enabled: !!user?.id,
  });
};
