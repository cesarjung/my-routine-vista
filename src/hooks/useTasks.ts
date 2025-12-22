import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, Enums } from '@/integrations/supabase/types';

export type Task = Tables<'tasks'>;
export type TaskStatus = Enums<'task_status'>;

export interface TaskWithDetails extends Task {
  routine?: Tables<'routines'> | null;
  unit?: Tables<'units'> | null;
  subtasks?: Tables<'subtasks'>[];
}

export const useTasks = (unitId?: string) => {
  return useQuery({
    queryKey: ['tasks', unitId],
    queryFn: async () => {
      let query = supabase
        .from('tasks')
        .select(`
          *,
          routine:routines(*),
          unit:units(*),
          subtasks(*)
        `)
        .order('due_date', { ascending: true });

      if (unitId) {
        query = query.eq('unit_id', unitId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as TaskWithDetails[];
    },
  });
};

export const useTasksByStatus = (status: TaskStatus) => {
  return useQuery({
    queryKey: ['tasks', 'status', status],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          routine:routines(*),
          unit:units(*),
          subtasks(*)
        `)
        .eq('status', status)
        .order('due_date', { ascending: true });

      if (error) throw error;
      return data as TaskWithDetails[];
    },
  });
};

export const useTaskStats = () => {
  return useQuery({
    queryKey: ['task-stats'],
    queryFn: async () => {
      const { data: tasks, error } = await supabase
        .from('tasks')
        .select('status');

      if (error) throw error;

      const stats = {
        total: tasks?.length || 0,
        pendente: tasks?.filter(t => t.status === 'pendente').length || 0,
        em_andamento: tasks?.filter(t => t.status === 'em_andamento').length || 0,
        concluida: tasks?.filter(t => t.status === 'concluida').length || 0,
        atrasada: tasks?.filter(t => t.status === 'atrasada').length || 0,
      };

      return stats;
    },
  });
};
