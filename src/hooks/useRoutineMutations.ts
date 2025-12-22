import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Enums } from '@/integrations/supabase/types';

type TaskFrequency = Enums<'task_frequency'>;

interface CreateRoutineData {
  title: string;
  description?: string;
  frequency: TaskFrequency;
}

interface CreateRoutineWithUnitsData extends CreateRoutineData {
  unitIds: string[];
}

interface UpdateRoutineData extends Partial<CreateRoutineData> {
  is_active?: boolean;
}

export const useCreateRoutine = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateRoutineData) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error('Usuário não autenticado');

      const { data: routine, error } = await supabase
        .from('routines')
        .insert({
          title: data.title,
          description: data.description || null,
          frequency: data.frequency,
          created_by: user.id,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;
      return routine;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routines'] });
      toast({
        title: 'Rotina criada',
        description: 'A nova rotina foi criada com sucesso.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao criar rotina',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

export const useCreateRoutineWithUnits = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateRoutineWithUnitsData) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error('Usuário não autenticado');

      // Create the routine
      const { data: routine, error: routineError } = await supabase
        .from('routines')
        .insert({
          title: data.title,
          description: data.description || null,
          frequency: data.frequency,
          created_by: user.id,
          is_active: true,
        })
        .select()
        .single();

      if (routineError) throw routineError;

      // Calculate period dates based on frequency
      const now = new Date();
      let periodStart: Date;
      let periodEnd: Date;

      switch (data.frequency) {
        case 'diaria':
          periodStart = new Date(now.setHours(0, 0, 0, 0));
          periodEnd = new Date(now.setHours(23, 59, 59, 999));
          break;
        case 'semanal':
          const dayOfWeek = now.getDay();
          const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
          periodStart = new Date(now);
          periodStart.setDate(now.getDate() + diffToMonday);
          periodStart.setHours(0, 0, 0, 0);
          periodEnd = new Date(periodStart);
          periodEnd.setDate(periodStart.getDate() + 6);
          periodEnd.setHours(23, 59, 59, 999);
          break;
        case 'quinzenal':
          const dayOfWeek2 = now.getDay();
          const diffToMonday2 = dayOfWeek2 === 0 ? -6 : 1 - dayOfWeek2;
          periodStart = new Date(now);
          periodStart.setDate(now.getDate() + diffToMonday2);
          periodStart.setHours(0, 0, 0, 0);
          periodEnd = new Date(periodStart);
          periodEnd.setDate(periodStart.getDate() + 13);
          periodEnd.setHours(23, 59, 59, 999);
          break;
        case 'mensal':
          periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
          periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
          break;
        default:
          periodStart = new Date(now.setHours(0, 0, 0, 0));
          periodEnd = new Date(now.setHours(23, 59, 59, 999));
      }

      // Create the first period
      const { data: period, error: periodError } = await supabase
        .from('routine_periods')
        .insert({
          routine_id: routine.id,
          period_start: periodStart.toISOString(),
          period_end: periodEnd.toISOString(),
          is_active: true,
        })
        .select()
        .single();

      if (periodError) throw periodError;

      // Create checkins for each selected unit
      if (data.unitIds.length > 0) {
        const checkins = data.unitIds.map((unitId) => ({
          routine_period_id: period.id,
          unit_id: unitId,
        }));

        const { error: checkinsError } = await supabase
          .from('routine_checkins')
          .insert(checkins);

        if (checkinsError) throw checkinsError;
      }

      return routine;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routines'] });
      queryClient.invalidateQueries({ queryKey: ['routine-periods'] });
      queryClient.invalidateQueries({ queryKey: ['current-period-checkins'] });
      toast({
        title: 'Rotina criada',
        description: 'A rotina foi criada com as unidades selecionadas.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao criar rotina',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

export const useUpdateRoutine = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateRoutineData }) => {
      const { data: routine, error } = await supabase
        .from('routines')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return routine;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routines'] });
      toast({
        title: 'Rotina atualizada',
        description: 'A rotina foi atualizada com sucesso.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao atualizar rotina',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

export const useDeleteRoutine = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('routines')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routines'] });
      toast({
        title: 'Rotina removida',
        description: 'A rotina foi desativada com sucesso.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao remover rotina',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};
