import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, Enums } from '@/integrations/supabase/types';

export type Routine = Tables<'routines'>;
export type TaskFrequency = Enums<'task_frequency'>;

export const useRoutines = (unitId?: string) => {
  return useQuery({
    queryKey: ['routines', unitId],
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
      return data as Routine[];
    },
  });
};

export const useRoutinesByFrequency = (frequency: TaskFrequency) => {
  return useQuery({
    queryKey: ['routines', 'frequency', frequency],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('routines')
        .select('*')
        .eq('frequency', frequency)
        .eq('is_active', true)
        .order('title');

      if (error) throw error;
      return data as Routine[];
    },
  });
};
