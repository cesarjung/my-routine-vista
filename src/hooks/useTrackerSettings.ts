import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface TrackerSettings {
    id?: string;
    sector_id: string;
    filters: { routines: string[]; frequencies: string[] };
    layouts: Record<string, { x: number; y: number; width: number; height: number }>;
}

export function useTrackerSettings(sectorId?: string) {
    const queryClient = useQueryClient();

    // Buscar configurações globais (para o setor selecionado)
    const {
        data: settings,
        isLoading,
        error,
        refetch,
    } = useQuery({
        queryKey: ['tracker_settings', sectorId],
        queryFn: async () => {
            if (!sectorId) return null;

            const { data, error } = await supabase
                .from('tracker_settings')
                .select('*')
                .eq('sector_id', sectorId)
                .maybeSingle();

            if (error) {
                console.error('Error fetching tracker settings:', error);
                throw error;
            }

            // Se não existir, retornamos a estrutura vazia default, mas validada.
            if (!data) return null;

            // Conversão segura do JSONB.
            return {
                id: data.id,
                sector_id: data.sector_id,
                filters: typeof data.filters === 'string' ? JSON.parse(data.filters) : data.filters || { routines: [], frequencies: [] },
                layouts: typeof data.layouts === 'string' ? JSON.parse(data.layouts) : data.layouts || {},
            } as TrackerSettings;
        },
        enabled: !!sectorId,
        staleTime: 1000 * 60 * 5, // Cache de 5min
    });

    // Mutação para Salvar configurações (Somente autorizados: admin, gestor ou se o RLS permitir)
    const saveSettings = useMutation({
        mutationFn: async (newSettings: TrackerSettings) => {
            if (!newSettings.sector_id) return null;

            const { data, error } = await supabase
                .from('tracker_settings')
                .upsert(
                    {
                        sector_id: newSettings.sector_id,
                        filters: newSettings.filters,
                        layouts: newSettings.layouts,
                    },
                    { onConflict: 'sector_id' }
                )
                .select()
                .single();

            if (error) {
                console.error('Erro ao salvar as configurações globais do Rastreador:', error);
                throw error;
            }

            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tracker_settings', sectorId] });
            toast.success('Configuração da Tela salva com sucesso.');
        },
        onError: (e: any) => {
            console.error(e);
            toast.error(`Erro ao salvar Vista: ${e.message || String(e)}`);
        },
    });

    return {
        settings,
        isLoading,
        error,
        saveSettings,
        refetch,
    };
}
