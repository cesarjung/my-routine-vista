import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export const useRealtimeUpdates = () => {
    const queryClient = useQueryClient();

    useEffect(() => {
        console.log('🔄 Iniciando conexão Realtime...');

        // Canal único ouvindo TUDO no schema public
        const channel = supabase
            .channel('global-db-changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public' },
                (payload) => {
                    console.log('📡 Realtime Event:', payload);

                    // Delay de 1s para evitar leitura de réplica desatualizada (Race Condition)
                    setTimeout(() => {
                        // Atualiazação dos Dashboards (Keys corretas)
                        queryClient.invalidateQueries({ queryKey: ['unit-routine-status'] });
                        queryClient.invalidateQueries({ queryKey: ['responsible-routine-status'] });
                        queryClient.invalidateQueries({ queryKey: ['units-summary'] });
                        queryClient.invalidateQueries({ queryKey: ['overall-stats'] });

                        // Atualização de View de Tarefas e Rotinas
                        queryClient.invalidateQueries({ queryKey: ['tasks'] });
                        queryClient.invalidateQueries({ queryKey: ['routines'] });
                        queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
                        queryClient.invalidateQueries({ queryKey: ['routine-tasks'] });
                        queryClient.invalidateQueries({ queryKey: ['custom-panel-data'] });
                    }, 1000);

                    // Invalidaqueries baseado na tabela alterada
                    if (payload.table) {
                        queryClient.invalidateQueries({ queryKey: [payload.table] });
                        // Mapeamentos específicos (ex: checkins afetam rotinas)
                        if (payload.table === 'routine_checkins') {
                            queryClient.invalidateQueries({ queryKey: ['routines'] });
                            queryClient.invalidateQueries({ queryKey: ['tasks'] });
                        }
                        if (payload.table === 'subtasks') {
                            queryClient.invalidateQueries({ queryKey: ['tasks'] });
                        }
                    }

                    // Atualiazação dos Dashboards (Keys corretas do useDashboardData.ts)
                    queryClient.invalidateQueries({ queryKey: ['unit-routine-status'] });
                    queryClient.invalidateQueries({ queryKey: ['responsible-routine-status'] });
                    queryClient.invalidateQueries({ queryKey: ['units-summary'] });
                    queryClient.invalidateQueries({ queryKey: ['overall-stats'] });

                    // Atualização de View de Tarefas e Rotinas
                    queryClient.invalidateQueries({ queryKey: ['tasks'] });
                    queryClient.invalidateQueries({ queryKey: ['routines'] });
                    queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
                }
            )
            .subscribe((status) => {
                console.log('📡 Status da Conexão:', status);
                if (status === 'SUBSCRIBED') {
                    // toast({
                    //   title: "Conexão Realtime: Ativa",
                    //   description: "Escutando alterações no banco de dados.",
                    //   duration: 3000,
                    // });
                } else if (status === 'CHANNEL_ERROR') {
                    console.error('❌ Erro no canal Realtime.');
                    toast({
                        variant: "destructive",
                        title: "Erro de Conexão",
                        description: "Falha ao conectar no sistema de tempo real.",
                    });
                }
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [queryClient]);
};
