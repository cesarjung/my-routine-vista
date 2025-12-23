import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Enums } from '@/integrations/supabase/types';

export type TaskFrequency = Enums<'task_frequency'>;

export interface FrequencySummary {
  frequency: TaskFrequency;
  routineCount: number;
  taskCount: number;
  completed: number;
  pending: number;
  total: number;
  percentage: number;
}

export interface UnitSummary {
  id: string;
  name: string;
  code: string;
  description: string | null;
  completed: number;
  pending: number;
  total: number;
}

export interface ResponsibleSummary {
  id: string;
  name: string;
  email: string;
  completed: number;
  pending: number;
  total: number;
}

export const useFrequencySummary = (sectorId?: string | null) => {
  return useQuery({
    queryKey: ['frequency-summary', sectorId],
    queryFn: async () => {
      const frequencies: TaskFrequency[] = ['diaria', 'semanal', 'quinzenal', 'mensal'];
      const summaries: FrequencySummary[] = [];

      for (const freq of frequencies) {
        // Count routines by frequency
        let routineQuery = supabase
          .from('routines')
          .select('*', { count: 'exact', head: true })
          .eq('frequency', freq)
          .eq('is_active', true);
        
        if (sectorId) {
          routineQuery = routineQuery.eq('sector_id', sectorId);
        }

        const { count: routineCount } = await routineQuery;

        // Get tasks from routines with this frequency
        let routinesQuery = supabase
          .from('routines')
          .select('id')
          .eq('frequency', freq)
          .eq('is_active', true);
        
        if (sectorId) {
          routinesQuery = routinesQuery.eq('sector_id', sectorId);
        }

        const { data: routines } = await routinesQuery;
        const routineIds = routines?.map(r => r.id) || [];
        
        let taskCount = 0;
        let completed = 0;
        let pending = 0;

        if (routineIds.length > 0) {
          let tasksQuery = supabase
            .from('tasks')
            .select('status')
            .in('routine_id', routineIds);
          
          if (sectorId) {
            tasksQuery = tasksQuery.eq('sector_id', sectorId);
          }

          const { data: tasks } = await tasksQuery;

          taskCount = tasks?.length || 0;
          completed = tasks?.filter(t => t.status === 'concluida').length || 0;
          pending = tasks?.filter(t => t.status === 'pendente' || t.status === 'em_andamento').length || 0;
        }

        summaries.push({
          frequency: freq,
          routineCount: routineCount || 0,
          taskCount,
          completed,
          pending,
          total: taskCount,
          percentage: taskCount > 0 ? Math.round((completed / taskCount) * 100) : 0,
        });
      }

      return summaries;
    },
  });
};

export const useUnitsSummary = (sectorId?: string | null) => {
  return useQuery({
    queryKey: ['units-summary', sectorId],
    queryFn: async () => {
      const { data: units, error: unitsError } = await supabase
        .from('units')
        .select('*')
        .order('name');

      if (unitsError) throw unitsError;

      const summaries: UnitSummary[] = [];

      for (const unit of units || []) {
        let tasksQuery = supabase
          .from('tasks')
          .select('status')
          .eq('unit_id', unit.id);
        
        if (sectorId) {
          tasksQuery = tasksQuery.eq('sector_id', sectorId);
        }

        const { data: tasks } = await tasksQuery;

        const completed = tasks?.filter(t => t.status === 'concluida').length || 0;
        const pending = tasks?.filter(t => t.status !== 'concluida').length || 0;
        const total = completed + pending;

        // Only include units that have tasks (for the selected sector if filtered)
        if (total > 0 || !sectorId) {
          summaries.push({
            id: unit.id,
            name: unit.name,
            code: unit.code,
            description: unit.description,
            completed,
            pending,
            total,
          });
        }
      }

      return summaries.filter(s => s.total > 0 || !sectorId);
    },
  });
};

export const useResponsiblesSummary = (sectorId?: string | null) => {
  return useQuery({
    queryKey: ['responsibles-summary', sectorId],
    queryFn: async () => {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .order('full_name');

      if (profilesError) throw profilesError;

      const summaries: ResponsibleSummary[] = [];

      for (const profile of profiles || []) {
        let tasksQuery = supabase
          .from('tasks')
          .select('status')
          .eq('assigned_to', profile.id);
        
        if (sectorId) {
          tasksQuery = tasksQuery.eq('sector_id', sectorId);
        }

        const { data: tasks } = await tasksQuery;

        const completed = tasks?.filter(t => t.status === 'concluida').length || 0;
        const pending = tasks?.filter(t => t.status !== 'concluida').length || 0;
        const total = completed + pending;

        if (total > 0) {
          summaries.push({
            id: profile.id,
            name: profile.full_name || profile.email,
            email: profile.email,
            completed,
            pending,
            total,
          });
        }
      }

      return summaries;
    },
  });
};

export const useOverallStats = (sectorId?: string | null) => {
  return useQuery({
    queryKey: ['overall-stats', sectorId],
    queryFn: async () => {
      let routineQuery = supabase
        .from('routines')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);
      
      if (sectorId) {
        routineQuery = routineQuery.eq('sector_id', sectorId);
      }

      const { count: routineCount } = await routineQuery;

      let tasksQuery = supabase
        .from('tasks')
        .select('status');
      
      if (sectorId) {
        tasksQuery = tasksQuery.eq('sector_id', sectorId);
      }

      const { data: tasks } = await tasksQuery;

      const total = tasks?.length || 0;
      const completed = tasks?.filter(t => t.status === 'concluida').length || 0;
      const pending = tasks?.filter(t => t.status !== 'concluida').length || 0;
      const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

      return {
        routineCount: routineCount || 0,
        taskCount: total,
        completed,
        pending,
        percentage,
      };
    },
  });
};
