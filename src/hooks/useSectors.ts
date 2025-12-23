import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Sector {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const useSectors = () => {
  return useQuery({
    queryKey: ['sectors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sectors')
        .select('*')
        .order('name');

      if (error) throw error;
      return data as Sector[];
    },
  });
};

export const useSectorMutations = () => {
  const queryClient = useQueryClient();

  const createSector = useMutation({
    mutationFn: async (sector: { name: string; description?: string; color?: string; icon?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('sectors')
        .insert({
          name: sector.name,
          description: sector.description || null,
          color: sector.color || '#6366f1',
          icon: sector.icon || 'folder',
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sectors'] });
      toast.success('Setor criado com sucesso!');
    },
    onError: (error) => {
      console.error('Erro ao criar setor:', error);
      toast.error('Erro ao criar setor');
    },
  });

  const updateSector = useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; description?: string; color?: string; icon?: string }) => {
      const { data, error } = await supabase
        .from('sectors')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sectors'] });
      toast.success('Setor atualizado com sucesso!');
    },
    onError: (error) => {
      console.error('Erro ao atualizar setor:', error);
      toast.error('Erro ao atualizar setor');
    },
  });

  const deleteSector = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('sectors')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sectors'] });
      toast.success('Setor excluído com sucesso!');
    },
    onError: (error) => {
      console.error('Erro ao excluir setor:', error);
      toast.error('Erro ao excluir setor');
    },
  });

  return { createSector, updateSector, deleteSector };
};
