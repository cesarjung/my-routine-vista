import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Types for the new tables (not yet in generated types)
interface RoutinePeriod {
  id: string;
  routine_id: string;
  period_start: string;
  period_end: string;
  is_active: boolean;
  created_at: string;
}

interface RoutineCheckin {
  id: string;
  routine_period_id: string;
  unit_id: string;
  completed_by: string | null;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
}

interface RoutineCheckinWithUnit extends RoutineCheckin {
  unit?: {
    id: string;
    name: string;
    code: string;
  };
  completed_by_profile?: {
    id: string;
    full_name: string | null;
    email: string;
  };
}

interface RoutinePeriodWithCheckins extends RoutinePeriod {
  routine_checkins: RoutineCheckinWithUnit[];
}

export const useRoutinePeriods = (routineId?: string) => {
  return useQuery({
    queryKey: ['routine-periods', routineId],
    queryFn: async () => {
      let query = supabase
        .from('routine_periods')
        .select(`
          *,
          routine_checkins (
            *,
            unit:units (id, name, code)
          )
        `)
        .eq('is_active', true)
        .order('period_start', { ascending: false });

      if (routineId) {
        query = query.eq('routine_id', routineId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as RoutinePeriodWithCheckins[];
    },
    enabled: !!routineId,
  });
};

// Hook to get all active periods for all routines (for the list view)
export const useAllActiveRoutinePeriods = () => {
  return useQuery({
    queryKey: ['all-active-routine-periods'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('routine_periods')
        .select('routine_id, period_start, period_end')
        .eq('is_active', true)
        .order('period_start', { ascending: false });

      if (error) throw error;
      
      // Create a map of routine_id to its active period
      const periodsByRoutine = new Map<string, { period_start: string; period_end: string }>();
      data?.forEach(period => {
        if (!periodsByRoutine.has(period.routine_id)) {
          periodsByRoutine.set(period.routine_id, {
            period_start: period.period_start,
            period_end: period.period_end,
          });
        }
      });
      
      return periodsByRoutine;
    },
  });
};

export const useCurrentPeriodCheckins = (routineId: string) => {
  return useQuery({
    queryKey: ['current-period-checkins', routineId],
    queryFn: async () => {
      // Get or create the current period for this routine
      const { data: routine, error: routineError } = await supabase
        .from('routines')
        .select('frequency')
        .eq('id', routineId)
        .single();

      if (routineError) throw routineError;

      // Check if there's an active period for today
      const now = new Date().toISOString();
      let { data: period, error: periodError } = await supabase
        .from('routine_periods')
        .select(`
          *,
          routine_checkins (
            *,
            unit:units (id, name, code)
          )
        `)
        .eq('routine_id', routineId)
        .eq('is_active', true)
        .lte('period_start', now)
        .gte('period_end', now)
        .maybeSingle();

      if (periodError) throw periodError;

      return {
        period: period as RoutinePeriodWithCheckins | null,
        frequency: routine.frequency,
      };
    },
    enabled: !!routineId,
  });
};

export const useCreatePeriodWithCheckins = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ routineId, periodStart, periodEnd }: { 
      routineId: string; 
      periodStart: Date; 
      periodEnd: Date;
    }) => {
      // Get all units
      const { data: units, error: unitsError } = await supabase
        .from('units')
        .select('id');

      if (unitsError) throw unitsError;

      // Create the period
      const { data: period, error: periodError } = await supabase
        .from('routine_periods')
        .insert({
          routine_id: routineId,
          period_start: periodStart.toISOString(),
          period_end: periodEnd.toISOString(),
          is_active: true,
        })
        .select()
        .single();

      if (periodError) throw periodError;

      // Create checkins for each unit
      if (units && units.length > 0) {
        const checkins = units.map(unit => ({
          routine_period_id: period.id,
          unit_id: unit.id,
        }));

        const { error: checkinsError } = await supabase
          .from('routine_checkins')
          .insert(checkins);

        if (checkinsError) throw checkinsError;
      }

      return period;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routine-periods'] });
      queryClient.invalidateQueries({ queryKey: ['current-period-checkins'] });
      toast({
        title: 'Período criado',
        description: 'Novo período de rotina criado com checkins para todas as unidades.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao criar período',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

export const useCompleteCheckin = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ checkinId, notes }: { checkinId: string; notes?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .from('routine_checkins')
        .update({
          completed_by: user.id,
          completed_at: new Date().toISOString(),
          notes: notes || null,
        })
        .eq('id', checkinId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routine-periods'] });
      queryClient.invalidateQueries({ queryKey: ['current-period-checkins'] });
      queryClient.invalidateQueries({ queryKey: ['routines'] });
      toast({
        title: 'Check-in concluído',
        description: 'O checkin foi marcado como concluído.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao completar checkin',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};

export const useUndoCheckin = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (checkinId: string) => {
      const { data, error } = await supabase
        .from('routine_checkins')
        .update({
          completed_by: null,
          completed_at: null,
          notes: null,
        })
        .eq('id', checkinId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routine-periods'] });
      queryClient.invalidateQueries({ queryKey: ['current-period-checkins'] });
      queryClient.invalidateQueries({ queryKey: ['routines'] });
      toast({
        title: 'Check-in desfeito',
        description: 'O checkin foi desmarcado.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao desfazer checkin',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
};
