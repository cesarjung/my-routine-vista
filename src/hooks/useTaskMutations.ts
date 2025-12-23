import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { TablesInsert, TablesUpdate } from '@/integrations/supabase/types';
import { toast } from 'sonner';

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

      // Criar tarefa mãe (sem unit_id específico, usa a primeira unidade como referência)
      const firstUnitId = data.unitAssignments[0]?.unitId;
      if (!firstUnitId) throw new Error('Nenhuma unidade selecionada');

      const { data: parentTask, error: parentError } = await supabase
        .from('tasks')
        .insert({
          title: data.title,
          description: data.description || null,
          unit_id: firstUnitId, // Necessário pelo schema, usa primeira unidade
          assigned_to: data.parentAssignedTo || user.id, // Responsável definido ou gestor atual
          status: 'pendente',
          priority: data.priority,
          start_date: data.start_date || null,
          due_date: data.due_date || null,
          created_by: user.id,
          parent_task_id: null, // Esta é a tarefa mãe
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
        parent_task_id: parentTask.id, // Link com a tarefa mãe
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

      return { parentTask, childTasks: createdChildTasks };
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
      const { data, error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
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
      const { error } = await supabase.from('tasks').delete().eq('id', taskId);
      if (error) throw error;
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
