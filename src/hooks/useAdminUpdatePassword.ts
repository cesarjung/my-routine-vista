import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UpdatePasswordParams {
  userId: string;
  newPassword: string;
}

export const useAdminUpdatePassword = () => {
  return useMutation({
    mutationFn: async ({ userId, newPassword }: UpdatePasswordParams) => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Não autenticado');
      }

      const response = await supabase.functions.invoke('admin-update-password', {
        body: { userId, newPassword },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Erro ao atualizar senha');
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      return response.data;
    },
    onSuccess: () => {
      toast.success('Senha atualizada com sucesso');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao atualizar senha');
    },
  });
};
