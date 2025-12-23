import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Tables } from '@/integrations/supabase/types';

export interface SubtaskWithDetails extends Tables<'subtasks'> {
  task?: {
    id: string;
    title: string;
    unit_id: string;
    routine_id: string | null;
    unit?: Tables<'units'> | null;
    routine?: Tables<'routines'> | null;
  } | null;
}

export const useUserSubtasks = () => {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['user-subtasks', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('subtasks')
        .select(`
          *,
          task:tasks(
            id,
            title,
            unit_id,
            routine_id,
            unit:units(*),
            routine:routines(*)
          )
        `)
        .eq('assigned_to', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as SubtaskWithDetails[];
    },
    enabled: !!user?.id,
  });
};

export const useSubtasksForTask = (taskId: string) => {
  return useQuery({
    queryKey: ['subtasks', taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subtasks')
        .select('*')
        .eq('task_id', taskId)
        .order('order_index', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!taskId,
  });
};
