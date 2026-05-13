import React from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSyncPlanejamento } from '@/hooks/usePlanejamentoRaw';

export const SyncIndicator: React.FC = () => {
  const queryClient = useQueryClient();
  const { mutate: syncPlanejamento, isPending: isSyncing } = useSyncPlanejamento();

  // Busca o registro mais recente do banco para saber a data do robô
  const { data, dataUpdatedAt, isRefetching } = useQuery({
    queryKey: ['planejamento_sync_status'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('planejamento_cache')
        .select('updated_at')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    // Recarrega do Supabase a cada 2 minutos automaticamente para manter as telas abertas atualizadas
    refetchInterval: 2 * 60 * 1000,
  });

  const lastBotUpdate = data?.updated_at;
  const lastSystemUpdate = dataUpdatedAt ? new Date(dataUpdatedAt) : null;
  const isSpinning = isRefetching || isSyncing;

  const handleRefresh = () => {
    syncPlanejamento();
    // Força a recarregar todas as tabelas e gráficos da tela atual
    queryClient.invalidateQueries(); 
  };

  return (
    <div className="flex items-center gap-4">
      {lastBotUpdate && (
        <div className="text-right flex flex-col justify-center border-r border-border pr-3">
          <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider leading-none" title="Última vez que o robô do servidor baixou do Google">Base Central</span>
          <span className="text-xs text-foreground font-medium">
            {format(new Date(lastBotUpdate), "dd/MM/yyyy HH:mm", { locale: ptBR })}
          </span>
        </div>
      )}
      {lastSystemUpdate && (
        <div className="text-right flex flex-col justify-center">
          <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider leading-none" title="Última vez que sua tela puxou do banco de dados">Base Sistema</span>
          <span className="text-xs text-foreground font-medium">
            {format(lastSystemUpdate, "dd/MM/yyyy HH:mm", { locale: ptBR })}
          </span>
        </div>
      )}
      <Button 
        variant="outline" 
        size="icon" 
        onClick={handleRefresh} 
        disabled={isSpinning} 
        className="h-8 w-8 shrink-0 ml-1"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${isSpinning ? 'animate-spin text-primary' : ''}`} />
      </Button>
    </div>
  );
};
