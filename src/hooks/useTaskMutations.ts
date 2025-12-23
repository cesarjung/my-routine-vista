import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { TablesInsert, TablesUpdate } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import { 
  syncTaskToCalendar, 
  updateCalendarEvent, 
  deleteCalendarEvent 
} from '@/services/googleCalendarSync';

export type TaskInsert = TablesInsert<'tasks'>;
export type TaskUpdate = TablesUpdate<'tasks'>;
export type SubtaskInsert = TablesInsert<'subtasks'>;

export interface SubtaskData {
  title: string;
  assigned_to?: string | null;
}

export interface UnitAssignment {
  unitId: string;
  assignedTo: string | null;
}

export interface CreateTaskData {
  task: TaskInsert;
  subtasks?: SubtaskData[];
}

export interface CreateTaskWithUnitsData {
  title: string;
  description?: string | null;
  priority: number;
  start_date?: string | null;
  due_date?: string | null;
  parentAssignedTo?: string | null; // Responsável da tarefa mãe
  unitAssignments: UnitAssignment[];
  subtasks?: SubtaskData[];
  // Campos de recorrência
  is_recurring?: boolean;
  recurrence_frequency?: 'diaria' | 'semanal' | 'quinzenal' | 'mensal';
  recurrence_mode?: 'schedule' | 'on_completion';
}

export const useCreateTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ task, subtasks }: CreateTaskData) => {
      // Insert task
      const { data: newTask, error: taskError } = await supabase
        .from('tasks')
        .insert(task)
        .select()
        .single();

      if (taskError) throw taskError;

      // Insert subtasks if provided
      if (subtasks && subtasks.length > 0) {
        const subtasksData: SubtaskInsert[] = subtasks.map((subtask, index) => ({
          task_id: newTask.id,
          title: subtask.title,
          assigned_to: subtask.assigned_to || null,
          order_index: index,
        }));

        const { error: subtasksError } = await supabase
          .from('subtasks')
          .insert(subtasksData);

        if (subtasksError) throw subtasksError;
      }

      // Sync to Google Calendar (fire and forget)
      syncTaskToCalendar(
        newTask.id,
        newTask.title,
        newTask.description,
        newTask.start_date,
        newTask.due_date
      ).catch(console.error);

      return newTask;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task-stats'] });
      toast.success('Tarefa criada com sucesso!');
    },
    onError: (error) => {
      console.error('Error creating task:', error);
      toast.error('Erro ao criar tarefa');
    },
  });
};

// Novo hook para criar tarefa mãe + filhas por unidade
export const useCreateTaskWithUnits = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateTaskWithUnitsData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Get the user's unit_id and role
      const { data: profile } = await supabase
        .from('profiles')
        .select('unit_id')
        .eq('id', user.id)
        .single();

      const { data: userRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      const userUnitId = profile?.unit_id;
      const isAdminOrGestor = userRole?.role === 'admin' || userRole?.role === 'gestor';

      // If units were selected, create parent + child tasks
      if (data.unitAssignments.length > 0) {
        // Criar tarefa mãe (usa a primeira unidade como referência)
        const firstUnitId = data.unitAssignments[0].unitId;

        const { data: parentTask, error: parentError } = await supabase
          .from('tasks')
          .insert({
            title: data.title,
            description: data.description || null,
            unit_id: firstUnitId,
            assigned_to: data.parentAssignedTo || user.id,
            status: 'pendente',
            priority: data.priority,
            start_date: data.start_date || null,
            due_date: data.due_date || null,
            created_by: user.id,
            parent_task_id: null,
            is_recurring: data.is_recurring || false,
            recurrence_frequency: data.is_recurring ? data.recurrence_frequency : null,
            recurrence_mode: data.is_recurring ? data.recurrence_mode : null,
          })
          .select()
          .single();

        if (parentError) throw parentError;

        // Criar tarefas filhas para cada unidade com seu responsável
        const childTasks = data.unitAssignments.map((assignment) => ({
          title: data.title,
          description: data.description || null,
          unit_id: assignment.unitId,
          assigned_to: assignment.assignedTo,
          status: 'pendente' as const,
          priority: data.priority,
          start_date: data.start_date || null,
          due_date: data.due_date || null,
          created_by: user.id,
          parent_task_id: parentTask.id,
        }));

        const { data: createdChildTasks, error: childError } = await supabase
          .from('tasks')
          .insert(childTasks)
          .select();

        if (childError) throw childError;

        // Criar subtarefas para cada tarefa filha se houver
        if (data.subtasks && data.subtasks.length > 0 && createdChildTasks) {
          const allSubtasks: SubtaskInsert[] = [];
          
          for (const childTask of createdChildTasks) {
            data.subtasks.forEach((subtask, index) => {
              allSubtasks.push({
                task_id: childTask.id,
                title: subtask.title,
                assigned_to: subtask.assigned_to || null,
                order_index: index,
              });
            });
          }

          if (allSubtasks.length > 0) {
            const { error: subtasksError } = await supabase
              .from('subtasks')
              .insert(allSubtasks);

            if (subtasksError) throw subtasksError;
          }
        }

        // Sync parent task to Google Calendar
        syncTaskToCalendar(
          parentTask.id,
          parentTask.title,
          parentTask.description,
          parentTask.start_date,
          parentTask.due_date
        ).catch(console.error);

        return { parentTask, childTasks: createdChildTasks };
      } else {
        // No units selected - need to use user's own unit
        // Regular users MUST have a unit_id in their profile
        // Admins/Gestores should have selected units in the form (validated there)
        if (!userUnitId) {
          if (isAdminOrGestor) {
            throw new Error('Por favor, selecione pelo menos uma unidade para a tarefa.');
          }
          throw new Error('Você precisa estar associado a uma unidade para criar tarefas.');
        }

        const { data: task, error: taskError } = await supabase
          .from('tasks')
          .insert({
            title: data.title,
            description: data.description || null,
            unit_id: userUnitId,
            assigned_to: data.parentAssignedTo || user.id,
            status: 'pendente',
            priority: data.priority,
            start_date: data.start_date || null,
            due_date: data.due_date || null,
            created_by: user.id,
            parent_task_id: null,
            is_recurring: data.is_recurring || false,
            recurrence_frequency: data.is_recurring ? data.recurrence_frequency : null,
            recurrence_mode: data.is_recurring ? data.recurrence_mode : null,
          })
          .select()
          .single();

        if (taskError) throw taskError;

        // Criar subtarefas se houver
        if (data.subtasks && data.subtasks.length > 0) {
          const subtasksData: SubtaskInsert[] = data.subtasks.map((subtask, index) => ({
            task_id: task.id,
            title: subtask.title,
            assigned_to: subtask.assigned_to || null,
            order_index: index,
          }));

          const { error: subtasksError } = await supabase
            .from('subtasks')
            .insert(subtasksData);

          if (subtasksError) throw subtasksError;
        }

        // Sync to Google Calendar
        syncTaskToCalendar(
          task.id,
          task.title,
          task.description,
          task.start_date,
          task.due_date
        ).catch(console.error);

        return { parentTask: task, childTasks: [] };
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task-stats'] });
      toast.success('Tarefa criada para todas as unidades!');
    },
    onError: (error) => {
      console.error('Error creating task with units:', error);
      toast.error('Erro ao criar tarefa');
    },
  });
};

export const useUpdateTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: TaskUpdate & { id: string }) => {
      // First, get the current task to check for google_event_id
      const { data: existingTask } = await supabase
        .from('tasks')
        .select('google_event_id, title, description, start_date, due_date, status')
        .eq('id', id)
        .single();

      const { data, error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Sync to Google Calendar if connected
      if (existingTask?.google_event_id) {
        updateCalendarEvent(
          existingTask.google_event_id,
          (updates.title as string) || existingTask.title,
          updates.description !== undefined ? updates.description : existingTask.description,
          updates.start_date !== undefined ? updates.start_date : existingTask.start_date,
          updates.due_date !== undefined ? updates.due_date : existingTask.due_date,
          (updates.status as string) || existingTask.status
        ).catch(console.error);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task-stats'] });
      toast.success('Tarefa atualizada!');
    },
    onError: (error) => {
      console.error('Error updating task:', error);
      toast.error('Erro ao atualizar tarefa');
    },
  });
};

export const useDeleteTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskId: string) => {
      // First, get the task to check for google_event_id
      const { data: existingTask } = await supabase
        .from('tasks')
        .select('google_event_id')
        .eq('id', taskId)
        .single();

      const { error } = await supabase.from('tasks').delete().eq('id', taskId);
      if (error) throw error;

      // Delete from Google Calendar if connected
      if (existingTask?.google_event_id) {
        deleteCalendarEvent(existingTask.google_event_id).catch(console.error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task-stats'] });
      toast.success('Tarefa excluída!');
    },
    onError: (error) => {
      console.error('Error deleting task:', error);
      toast.error('Erro ao excluir tarefa');
    },
  });
};

export const useToggleSubtask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ subtaskId, isCompleted }: { subtaskId: string; isCompleted: boolean }) => {
      const { data, error } = await supabase
        .from('subtasks')
        .update({
          is_completed: isCompleted,
          completed_at: isCompleted ? new Date().toISOString() : null,
        })
        .eq('id', subtaskId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
};
