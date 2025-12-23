import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Enums } from '@/integrations/supabase/types';

export type TaskFrequency = Enums<'task_frequency'>;

const FREQUENCIES: TaskFrequency[] = ['diaria', 'semanal', 'quinzenal', 'mensal'];

export interface FrequencyBreakdown {
  diaria: { completed: number; pending: number; total: number };
  semanal: { completed: number; pending: number; total: number };
  quinzenal: { completed: number; pending: number; total: number };
  mensal: { completed: number; pending: number; total: number };
}

export interface UnitRoutineStatus {
  id: string;
  name: string;
  code: string;
  frequencies: FrequencyBreakdown;
  totals: { completed: number; pending: number; total: number };
}

export interface ResponsibleRoutineStatus {
  id: string;
  name: string;
  email: string;
  frequencies: FrequencyBreakdown;
  totals: { completed: number; pending: number; total: number };
}

const emptyFrequencyBreakdown = (): FrequencyBreakdown => ({
  diaria: { completed: 0, pending: 0, total: 0 },
  semanal: { completed: 0, pending: 0, total: 0 },
  quinzenal: { completed: 0, pending: 0, total: 0 },
  mensal: { completed: 0, pending: 0, total: 0 },
});

export const useUnitRoutineStatus = (sectorId?: string | null) => {
  return useQuery({
    queryKey: ['unit-routine-status', sectorId],
    queryFn: async () => {
      // Get all units with parent_id (actual units, not gerências)
      const { data: units, error: unitsError } = await supabase
        .from('units')
        .select('id, name, code')
        .not('parent_id', 'is', null)
        .order('name');

      if (unitsError) throw unitsError;

      // Get all routines with their frequency
      let routinesQuery = supabase
        .from('routines')
        .select('id, frequency, unit_id')
        .eq('is_active', true);

      if (sectorId) {
        routinesQuery = routinesQuery.eq('sector_id', sectorId);
      }

      const { data: routines } = await routinesQuery;

      // Get all tasks
      let tasksQuery = supabase
        .from('tasks')
        .select('id, status, unit_id, routine_id');

      if (sectorId) {
        tasksQuery = tasksQuery.eq('sector_id', sectorId);
      }

      const { data: tasks } = await tasksQuery;

      // Create a map of routine_id to frequency
      const routineFrequencyMap = new Map<string, TaskFrequency>();
      routines?.forEach(r => {
        if (FREQUENCIES.includes(r.frequency)) {
          routineFrequencyMap.set(r.id, r.frequency);
        }
      });

      // Build unit summaries
      const results: UnitRoutineStatus[] = [];

      for (const unit of units || []) {
        const frequencies = emptyFrequencyBreakdown();
        const totals = { completed: 0, pending: 0, total: 0 };

        const unitTasks = tasks?.filter(t => t.unit_id === unit.id) || [];

        for (const task of unitTasks) {
          const freq = task.routine_id ? routineFrequencyMap.get(task.routine_id) : null;
          
          if (freq && FREQUENCIES.includes(freq)) {
            const isCompleted = task.status === 'concluida';
            
            frequencies[freq].total++;
            frequencies[freq][isCompleted ? 'completed' : 'pending']++;
            
            totals.total++;
            totals[isCompleted ? 'completed' : 'pending']++;
          }
        }

        if (totals.total > 0) {
          results.push({
            id: unit.id,
            name: unit.name,
            code: unit.code,
            frequencies,
            totals,
          });
        }
      }

      return results;
    },
  });
};

export const useResponsibleRoutineStatus = (sectorId?: string | null) => {
  return useQuery({
    queryKey: ['responsible-routine-status', sectorId],
    queryFn: async () => {
      // Get all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .order('full_name');

      if (profilesError) throw profilesError;

      // Get all routines with their frequency
      let routinesQuery = supabase
        .from('routines')
        .select('id, frequency')
        .eq('is_active', true);

      if (sectorId) {
        routinesQuery = routinesQuery.eq('sector_id', sectorId);
      }

      const { data: routines } = await routinesQuery;

      // Get all tasks with assigned_to
      let tasksQuery = supabase
        .from('tasks')
        .select('id, status, assigned_to, routine_id')
        .not('assigned_to', 'is', null);

      if (sectorId) {
        tasksQuery = tasksQuery.eq('sector_id', sectorId);
      }

      const { data: tasks } = await tasksQuery;

      // Create a map of routine_id to frequency
      const routineFrequencyMap = new Map<string, TaskFrequency>();
      routines?.forEach(r => {
        if (FREQUENCIES.includes(r.frequency)) {
          routineFrequencyMap.set(r.id, r.frequency);
        }
      });

      // Build responsible summaries
      const results: ResponsibleRoutineStatus[] = [];

      for (const profile of profiles || []) {
        const frequencies = emptyFrequencyBreakdown();
        const totals = { completed: 0, pending: 0, total: 0 };

        const responsibleTasks = tasks?.filter(t => t.assigned_to === profile.id) || [];

        for (const task of responsibleTasks) {
          const freq = task.routine_id ? routineFrequencyMap.get(task.routine_id) : null;
          
          if (freq && FREQUENCIES.includes(freq)) {
            const isCompleted = task.status === 'concluida';
            
            frequencies[freq].total++;
            frequencies[freq][isCompleted ? 'completed' : 'pending']++;
            
            totals.total++;
            totals[isCompleted ? 'completed' : 'pending']++;
          }
        }

        if (totals.total > 0) {
          results.push({
            id: profile.id,
            name: profile.full_name || profile.email,
            email: profile.email,
            frequencies,
            totals,
          });
        }
      }

      return results;
    },
  });
};

export interface UnitSummary {
  id: string;
  name: string;
  code: string;
  description: string | null;
  completed: number;
  pending: number;
  total: number;
}

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
