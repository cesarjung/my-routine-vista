import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import type { Tables, Enums } from '@/integrations/supabase/types';

export type Task = Tables<'tasks'>;
export type TaskStatus = Enums<'task_status'>;

export interface TaskWithDetails extends Task {
  routine?: Tables<'routines'> | null;
  unit?: Tables<'units'> | null;
  subtasks?: Tables<'subtasks'>[];
}

export const useTasks = (unitId?: string) => {
  const { user } = useAuth();
  const { data: role } = useUserRole();

  return useQuery({
    queryKey: ['tasks', unitId, user?.id, role],
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

      // Se usuário não é admin/gestor, filtrar para mostrar apenas suas tarefas ou tarefas da sua unidade
      if (role === 'usuario' && user?.id) {
        // Buscar unit_id do usuário
        const { data: profile } = await supabase
          .from('profiles')
          .select('unit_id')
          .eq('id', user.id)
          .single();
        
        const userUnitId = profile?.unit_id;

        // Buscar tarefas atribuídas ao usuário
        const { data: taskAssignees } = await supabase
          .from('task_assignees')
          .select('task_id')
          .eq('user_id', user.id);

        const assignedTaskIds = new Set(taskAssignees?.map(ta => ta.task_id) || []);

        return (data as TaskWithDetails[]).filter(task => {
          // Mostrar se o usuário é o assigned_to
          if (task.assigned_to === user.id) return true;
          // Mostrar se o usuário está na tabela task_assignees
          if (assignedTaskIds.has(task.id)) return true;
          // Mostrar se a tarefa é da unidade do usuário
          if (userUnitId && task.unit_id === userUnitId) return true;
          return false;
        });
      }

      return data as TaskWithDetails[];
    },
    enabled: !!user?.id,
  });
};

export const useTasksByStatus = (status: TaskStatus) => {
  const { user } = useAuth();
  const { data: role } = useUserRole();

  return useQuery({
    queryKey: ['tasks', 'status', status, user?.id, role],
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

      // Se usuário não é admin/gestor, filtrar
      if (role === 'usuario' && user?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('unit_id')
          .eq('id', user.id)
          .single();
        
        const userUnitId = profile?.unit_id;

        const { data: taskAssignees } = await supabase
          .from('task_assignees')
          .select('task_id')
          .eq('user_id', user.id);

        const assignedTaskIds = new Set(taskAssignees?.map(ta => ta.task_id) || []);

        return (data as TaskWithDetails[]).filter(task => {
          if (task.assigned_to === user.id) return true;
          if (assignedTaskIds.has(task.id)) return true;
          if (userUnitId && task.unit_id === userUnitId) return true;
          return false;
        });
      }

      return data as TaskWithDetails[];
    },
    enabled: !!user?.id,
  });
};

export const useTaskStats = () => {
  const { user } = useAuth();
  const { data: role } = useUserRole();

  return useQuery({
    queryKey: ['task-stats', user?.id, role],
    queryFn: async () => {
      const { data: allTasks, error } = await supabase
        .from('tasks')
        .select('id, status, assigned_to, unit_id');

      if (error) throw error;

      let tasks = allTasks;

      // Se usuário não é admin/gestor, filtrar
      if (role === 'usuario' && user?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('unit_id')
          .eq('id', user.id)
          .single();
        
        const userUnitId = profile?.unit_id;

        const { data: taskAssignees } = await supabase
          .from('task_assignees')
          .select('task_id')
          .eq('user_id', user.id);

        const assignedTaskIds = new Set(taskAssignees?.map(ta => ta.task_id) || []);

        tasks = allTasks?.filter(task => {
          if (task.assigned_to === user.id) return true;
          if (assignedTaskIds.has(task.id)) return true;
          if (userUnitId && task.unit_id === userUnitId) return true;
          return false;
        }) || [];
      }

      const stats = {
        total: tasks?.length || 0,
        pendente: tasks?.filter(t => t.status === 'pendente').length || 0,
        em_andamento: tasks?.filter(t => t.status === 'em_andamento').length || 0,
        concluida: tasks?.filter(t => t.status === 'concluida').length || 0,
        atrasada: tasks?.filter(t => t.status === 'atrasada').length || 0,
      };

      return stats;
    },
    enabled: !!user?.id,
  });
};

// Hook to get tasks linked to a specific routine
export const useRoutineTasks = (routineId: string) => {
  return useQuery({
    queryKey: ['routine-tasks', routineId],
    queryFn: async () => {
      // Get parent task for this routine
      const { data: parentTask, error: parentError } = await supabase
        .from('tasks')
        .select(`
          *,
          unit:units(id, name, code)
        `)
        .eq('routine_id', routineId)
        .is('parent_task_id', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (parentError) throw parentError;
      if (!parentTask) return { parentTask: null, childTasks: [] };

      // Get child tasks
      const { data: childTasks, error: childError } = await supabase
        .from('tasks')
        .select(`
          *,
          unit:units(id, name, code),
          assignee:profiles!tasks_assigned_to_fkey(id, full_name, email)
        `)
        .eq('parent_task_id', parentTask.id)
        .order('created_at', { ascending: true });

      if (childError) throw childError;

      return {
        parentTask,
        childTasks: childTasks || [],
      };
    },
    enabled: !!routineId,
  });
};
