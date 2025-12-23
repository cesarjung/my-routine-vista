import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Json } from '@/integrations/supabase/types';

export interface PanelFilters {
  sector_id?: string | null;
  unit_id?: string | null;
  status?: string[];
  period?: 'today' | 'week' | 'month' | 'quarter' | 'year' | 'all';
  group_by: 'unit' | 'responsible' | 'sector';
}

export interface DashboardPanel {
  id: string;
  user_id: string;
  title: string;
  panel_type: string;
  filters: PanelFilters;
  display_config: Record<string, unknown>;
  order_index: number;
  created_at: string;
  updated_at: string;
}

const defaultFilters: PanelFilters = {
  group_by: 'unit'
};

export const useDashboardPanels = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['dashboard-panels', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('dashboard_panels')
        .select('*')
        .eq('user_id', user.id)
        .order('order_index', { ascending: true });

      if (error) throw error;
      
      return (data || []).map(panel => ({
        ...panel,
        filters: { ...defaultFilters, ...(panel.filters as unknown as Partial<PanelFilters>) } as PanelFilters,
        display_config: (panel.display_config || {}) as Record<string, unknown>
      })) as DashboardPanel[];
    },
    enabled: !!user
  });
};

export const useCreateDashboardPanel = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (panel: Omit<DashboardPanel, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
      if (!user) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .from('dashboard_panels')
        .insert({
          user_id: user.id,
          title: panel.title,
          panel_type: panel.panel_type,
          filters: panel.filters as unknown as Json,
          display_config: panel.display_config as unknown as Json,
          order_index: panel.order_index
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-panels'] });
      toast.success('Painel criado com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao criar painel: ' + error.message);
    }
  });
};

export const useUpdateDashboardPanel = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, filters, display_config, ...updates }: Partial<DashboardPanel> & { id: string }) => {
      const updateData: Record<string, unknown> = { ...updates };
      if (filters) updateData.filters = filters as unknown as Json;
      if (display_config) updateData.display_config = display_config as unknown as Json;
      
      const { data, error } = await supabase
        .from('dashboard_panels')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-panels'] });
      toast.success('Painel atualizado');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar painel: ' + error.message);
    }
  });
};

export const useDeleteDashboardPanel = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('dashboard_panels')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-panels'] });
      toast.success('Painel removido');
    },
    onError: (error) => {
      toast.error('Erro ao remover painel: ' + error.message);
    }
  });
};

export const useReorderDashboardPanels = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (panels: { id: string; order_index: number }[]) => {
      // Update all panels in parallel
      const updates = panels.map(panel => 
        supabase
          .from('dashboard_panels')
          .update({ order_index: panel.order_index })
          .eq('id', panel.id)
      );

      const results = await Promise.all(updates);
      const errors = results.filter(r => r.error);
      
      if (errors.length > 0) {
        throw new Error('Erro ao reordenar painéis');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-panels'] });
    },
    onError: (error) => {
      toast.error('Erro ao reordenar painéis: ' + error.message);
    }
  });
};
