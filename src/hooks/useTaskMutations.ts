import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { TablesInsert, TablesUpdate } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import { 
  syncTaskToCalendar, 
  updateCalendarEvent, 
  deleteCalendarEvent 
} from '@/services/googleCalendarSync';
import { isWeekendOrHoliday, getNextBusinessDay } from '@/utils/holidays';

export type TaskInsert = TablesInsert<'tasks'>;
export type TaskUpdate = TablesUpdate<'tasks'>;
export type SubtaskInsert = TablesInsert<'subtasks'>;

export interface SubtaskData {
  title: string;
  assigned_to?: string | null;
  assigned_to_ids?: string[]; // Multiple assignees
}

export interface UnitAssignment {
  unitId: string;
  assignedTo: string | null;
  assignedToIds?: string[]; // Multiple assignees per unit
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
  parentAssignedTo?: string | null; // Responsável principal (backwards compatibility)
  parentAssignees?: string[]; // Multiple assignees for parent task
  unitAssignments: UnitAssignment[];
  subtasks?: SubtaskData[];
  // Campos de recorrência
  is_recurring?: boolean;
  recurrence_frequency?: 'diaria' | 'semanal' | 'quinzenal' | 'mensal';
  recurrence_mode?: 'schedule' | 'on_completion';
  // Setor
  sector_id?: string;
  // Ignorar feriados e finais de semana
  skip_weekends_holidays?: boolean;
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

      // Helper function to adjust dates if skip_weekends_holidays is enabled
      const adjustDate = (dateStr: string | null | undefined): string | null => {
        if (!dateStr) return null;
        if (!data.skip_weekends_holidays) return dateStr;
        
        const date = new Date(dateStr);
        if (isWeekendOrHoliday(date)) {
          return getNextBusinessDay(date).toISOString();
        }
        return dateStr;
      };

      const adjustedStartDate = adjustDate(data.start_date);
      const adjustedDueDate = adjustDate(data.due_date);

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
            sector_id: data.sector_id || null,
            assigned_to: data.parentAssignedTo || user.id,
            status: 'pendente',
            priority: data.priority,
            start_date: adjustedStartDate,
            due_date: adjustedDueDate,
            created_by: user.id,
            parent_task_id: null,
            is_recurring: data.is_recurring || false,
            recurrence_frequency: data.is_recurring ? data.recurrence_frequency : null,
            recurrence_mode: data.is_recurring ? data.recurrence_mode : null,
          })
          .select()
          .single();

        if (parentError) throw parentError;

        // Add multiple assignees to task_assignees table
        const parentAssigneeIds = data.parentAssignees && data.parentAssignees.length > 0 
          ? data.parentAssignees 
          : [data.parentAssignedTo || user.id].filter(Boolean);
        
        if (parentAssigneeIds.length > 0) {
          await supabase
            .from('task_assignees')
            .insert(parentAssigneeIds.map(userId => ({ task_id: parentTask.id, user_id: userId })));
        }

        // Criar tarefas filhas para cada unidade com seu responsável
        const childTasks = data.unitAssignments.map((assignment) => ({
          title: data.title,
          description: data.description || null,
          unit_id: assignment.unitId,
          sector_id: data.sector_id || null,
          assigned_to: assignment.assignedTo,
          status: 'pendente' as const,
          priority: data.priority,
          start_date: adjustedStartDate,
          due_date: adjustedDueDate,
          created_by: user.id,
          parent_task_id: parentTask.id,
        }));

        const { data: createdChildTasks, error: childError } = await supabase
          .from('tasks')
          .insert(childTasks)
          .select();

        if (childError) throw childError;

        // Add assignees for each child task
        if (createdChildTasks) {
          for (let i = 0; i < createdChildTasks.length; i++) {
            const childTask = createdChildTasks[i];
            const assignment = data.unitAssignments[i];
            const assigneeIds = assignment.assignedToIds && assignment.assignedToIds.length > 0
              ? assignment.assignedToIds
              : assignment.assignedTo ? [assignment.assignedTo] : [];
            
            if (assigneeIds.length > 0) {
              await supabase
                .from('task_assignees')
                .insert(assigneeIds.map(userId => ({ task_id: childTask.id, user_id: userId })));
            }
          }
        }

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
        // No units selected
        // Admins/Gestores podem criar sem unidade
        // Regular users MUST have a unit_id in their profile
        if (!isAdminOrGestor && !userUnitId) {
          throw new Error('Você precisa estar associado a uma unidade para criar tarefas.');
        }

        const { data: task, error: taskError } = await supabase
          .from('tasks')
          .insert({
            title: data.title,
            description: data.description || null,
            unit_id: userUnitId || null, // null for admins/gestors without unit
            sector_id: data.sector_id || null,
            assigned_to: data.parentAssignedTo || user.id,
            status: 'pendente',
            priority: data.priority,
            start_date: adjustedStartDate,
            due_date: adjustedDueDate,
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
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task-stats'] });
      const hasMultipleUnits = result.childTasks && result.childTasks.length > 0;
      toast.success(hasMultipleUnits ? 'Tarefa criada para todas as unidades!' : 'Tarefa criada com sucesso!');
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
      // First, get the current task to check for google_event_id and recurring info
      const { data: existingTask } = await supabase
        .from('tasks')
        .select('google_event_id, title, description, start_date, due_date, status, is_recurring, recurrence_frequency, recurrence_mode, unit_id, sector_id, assigned_to, created_by, priority, parent_task_id, routine_id')
        .eq('id', id)
        .single();

      const { data, error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // If task is being completed and is linked to a routine, update the routine checkin
      if (
        existingTask?.routine_id &&
        updates.status === 'concluida' &&
        existingTask?.status !== 'concluida' &&
        existingTask?.assigned_to
      ) {
        await updateRoutineCheckinFromTask(existingTask.routine_id, existingTask.assigned_to, 'completed');
      }

      // If task was uncompleted and is linked to a routine, revert the checkin
      if (
        existingTask?.routine_id &&
        existingTask?.status === 'concluida' &&
        updates.status && updates.status !== 'concluida' &&
        existingTask?.assigned_to
      ) {
        await updateRoutineCheckinFromTask(existingTask.routine_id, existingTask.assigned_to, 'pending');
      }

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

      // Handle recurring task completion (on_completion mode)
      if (
        existingTask?.is_recurring &&
        existingTask?.recurrence_mode === 'on_completion' &&
        updates.status === 'concluida' &&
        existingTask?.status !== 'concluida' &&
        existingTask?.start_date &&
        existingTask?.due_date &&
        existingTask?.recurrence_frequency
      ) {
        // Create next instance when task is completed
        await createNextRecurringInstance(existingTask, id);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task-stats'] });
      queryClient.invalidateQueries({ queryKey: ['routine-periods'] });
      queryClient.invalidateQueries({ queryKey: ['current-period-checkins'] });
      toast.success('Tarefa atualizada!');
    },
    onError: (error) => {
      console.error('Error updating task:', error);
      toast.error('Erro ao atualizar tarefa');
    },
  });
};

// Helper function to update routine checkin when a task is completed
async function updateRoutineCheckinFromTask(
  routineId: string,
  assigneeUserId: string,
  status: 'completed' | 'pending' | 'not_completed'
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    // Find the active period for this routine
    const now = new Date().toISOString();
    const { data: activePeriod } = await supabase
      .from('routine_periods')
      .select('id')
      .eq('routine_id', routineId)
      .eq('is_active', true)
      .lte('period_start', now)
      .gte('period_end', now)
      .maybeSingle();

    if (!activePeriod) return;

    // Find the checkin for this user in this period
    const { data: checkin } = await supabase
      .from('routine_checkins')
      .select('id')
      .eq('routine_period_id', activePeriod.id)
      .eq('assignee_user_id', assigneeUserId)
      .maybeSingle();

    if (!checkin) return;

    // Update the checkin status
    if (status === 'pending') {
      await supabase
        .from('routine_checkins')
        .update({
          status: 'pending',
          completed_at: null,
          completed_by: null,
        })
        .eq('id', checkin.id);
    } else {
      await supabase
        .from('routine_checkins')
        .update({
          status,
          completed_at: new Date().toISOString(),
          completed_by: user?.id || assigneeUserId,
        })
        .eq('id', checkin.id);
    }
  } catch (error) {
    console.error('Error updating routine checkin:', error);
  }
}

// Helper function to create next recurring task instance
async function createNextRecurringInstance(
  existingTask: {
    title: string;
    description: string | null;
    start_date: string;
    due_date: string;
    recurrence_frequency: string;
    unit_id: string | null;
    sector_id: string | null;
    assigned_to: string | null;
    created_by: string | null;
    priority: number | null;
    parent_task_id: string | null;
    recurrence_mode: string | null;
  },
  currentTaskId: string
): Promise<void> {
  const startDate = new Date(existingTask.start_date);
  const dueDate = new Date(existingTask.due_date);
  const duration = dueDate.getTime() - startDate.getTime();
  
  // Calculate next start date based on frequency
  const now = new Date();
  const nextStart = new Date(now);
  nextStart.setHours(startDate.getHours(), startDate.getMinutes(), 0, 0);
  
  // If the calculated time has already passed today, start tomorrow
  if (nextStart <= now) {
    nextStart.setDate(nextStart.getDate() + 1);
  }
  
  const nextDue = new Date(nextStart.getTime() + duration);
  
  // Check if instance already exists
  const startOfDay = new Date(nextStart);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(nextStart);
  endOfDay.setHours(23, 59, 59, 999);
  
  const { data: existingInstance } = await supabase
    .from('tasks')
    .select('id')
    .eq('parent_task_id', existingTask.parent_task_id || currentTaskId)
    .gte('start_date', startOfDay.toISOString())
    .lte('start_date', endOfDay.toISOString())
    .limit(1);
  
  if (existingInstance && existingInstance.length > 0) {
    console.log('Next recurring instance already exists');
    return;
  }
  
  // Create new task instance
  const { data: newTask, error } = await supabase
    .from('tasks')
    .insert({
      title: existingTask.title,
      description: existingTask.description,
      unit_id: existingTask.unit_id,
      sector_id: existingTask.sector_id,
      assigned_to: existingTask.assigned_to,
      created_by: existingTask.created_by,
      start_date: nextStart.toISOString(),
      due_date: nextDue.toISOString(),
      priority: existingTask.priority || 1,
      status: 'pendente',
      is_recurring: true,
      recurrence_frequency: existingTask.recurrence_frequency as 'diaria' | 'semanal' | 'quinzenal' | 'mensal',
      recurrence_mode: existingTask.recurrence_mode as 'schedule' | 'on_completion',
      parent_task_id: existingTask.parent_task_id || currentTaskId,
    })
    .select('id')
    .single();
  
  if (error) {
    console.error('Error creating next recurring instance:', error);
    return;
  }
  
  if (newTask) {
    // Copy task assignees
    const { data: assignees } = await supabase
      .from('task_assignees')
      .select('user_id')
      .eq('task_id', currentTaskId);
    
    if (assignees && assignees.length > 0) {
      await supabase
        .from('task_assignees')
        .insert(assignees.map(a => ({ task_id: newTask.id, user_id: a.user_id })));
    }
    
    // Copy subtasks
    const { data: subtasks } = await supabase
      .from('subtasks')
      .select('title, assigned_to, order_index')
      .eq('task_id', currentTaskId);
    
    if (subtasks && subtasks.length > 0) {
      await supabase
        .from('subtasks')
        .insert(subtasks.map(s => ({
          task_id: newTask.id,
          title: s.title,
          assigned_to: s.assigned_to,
          order_index: s.order_index,
          is_completed: false,
        })));
    }
    
    toast.success('Próxima tarefa recorrente criada!');
  }
}

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
