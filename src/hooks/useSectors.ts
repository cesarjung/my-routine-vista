import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SectorSection {
  id: string;
  sector_id: string;
  title: string;
  type: string;
  order_index: number;
}

export interface Sector {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  sections?: SectorSection[];
}

export const useSectors = () => {
  return useQuery({
    queryKey: ['sectors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sectors')
        .select('*, sections:sector_sections(*)')
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

export const useSectionMutations = () => {
  const queryClient = useQueryClient();

  const createSection = useMutation({
    mutationFn: async (section: { sector_id: string; title: string; type: string; order_index?: number }) => {
      const { data, error } = await supabase
        .from('sector_sections')
        .insert(section)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sectors'] });
      toast.success('Seção criada!');
    },
    onError: (error) => {
      console.error('Erro ao criar seção:', error);
      toast.error('Erro ao criar seção');
    }
  });

  const deleteSection = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('sector_sections')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sectors'] });
      toast.success('Seção removida!');
    },
    onError: (error) => {
      console.error('Erro ao remover seção:', error);
      toast.error('Erro ao remover seção');
    }
  });

  return { createSection, deleteSection };
};
