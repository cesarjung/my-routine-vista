import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Check, Flag, Calendar, Pencil, X } from 'lucide-react';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Button } from './ui/button';
import { MultiAssigneeSelect } from './MultiAssigneeSelect';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';

interface Manager {
  id: string;
  user_id: string;
  unit_id: string;
  profile?: {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url?: string | null;
  } | null;
}

interface CheckinRowProps {
  checkin: {
    id: string;
    unit_id: string;
    completed_at: string | null;
    completed_by: string | null;
    unit?: { id: string; name: string; code: string } | null;
  };
  isCompleted: boolean;
  managers: Manager[];
  periodEnd?: string | null;
  onToggle: () => void;
  isToggling: boolean;
  isGestorOrAdmin: boolean;
  allProfiles?: Tables<'profiles'>[];
}

const getInitials = (name: string | null | undefined): string => {
  if (!name) return '?';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

const avatarColors = [
  'bg-pink-500',
  'bg-purple-500',
  'bg-indigo-500',
  'bg-blue-500',
  'bg-teal-500',
  'bg-green-500',
  'bg-yellow-500',
  'bg-orange-500',
  'bg-red-500',
];

const getAvatarColor = (id: string): string => {
  const index = id.charCodeAt(0) % avatarColors.length;
  return avatarColors[index];
};

export const CheckinRow = ({
  checkin,
  isCompleted,
  managers,
  periodEnd,
  onToggle,
  isToggling,
  isGestorOrAdmin,
  allProfiles = [],
}: CheckinRowProps) => {
  const [isEditingResponsible, setIsEditingResponsible] = useState(false);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>(
    managers.map(m => m.user_id)
  );
  const queryClient = useQueryClient();

  // Get profiles for this unit
  const profilesForUnit = allProfiles.filter(
    p => p.unit_id === checkin.unit_id || managers.some(m => m.user_id === p.id)
  );

  const updateUnitManagersMutation = useMutation({
    mutationFn: async (newAssigneeIds: string[]) => {
      // Remove existing managers for this unit
      const { error: deleteError } = await supabase
        .from('unit_managers')
        .delete()
        .eq('unit_id', checkin.unit_id);
      
      if (deleteError) throw deleteError;

      // Insert new managers
      if (newAssigneeIds.length > 0) {
        const { error: insertError } = await supabase
          .from('unit_managers')
          .insert(
            newAssigneeIds.map(userId => ({
              unit_id: checkin.unit_id,
              user_id: userId,
            }))
          );
        
        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unit-managers'] });
      queryClient.invalidateQueries({ queryKey: ['routine-checkins'] });
      toast.success('Responsáveis atualizados!');
      setIsEditingResponsible(false);
    },
    onError: () => {
      toast.error('Erro ao atualizar responsáveis');
    },
  });

  const handleSaveResponsibles = () => {
    updateUnitManagersMutation.mutate(selectedAssignees);
  };

  return (
    <div
      className={cn(
        'grid grid-cols-12 gap-2 px-4 py-3 items-center transition-colors hover:bg-secondary/20',
        isCompleted && 'bg-success/5'
      )}
    >
      {/* Name with checkbox */}
      <div className="col-span-5 flex items-center gap-3">
        <button
          onClick={onToggle}
          disabled={isToggling}
          className={cn(
            'w-5 h-5 rounded border-2 flex items-center justify-center transition-all',
            isCompleted
              ? 'bg-success border-success text-success-foreground'
              : 'border-muted-foreground/50 hover:border-primary'
          )}
        >
          {isCompleted && <Check className="w-3 h-3" />}
        </button>
        <span
          className={cn(
            'font-medium text-sm',
            isCompleted
              ? 'text-muted-foreground line-through'
              : 'text-foreground'
          )}
        >
          {checkin.unit?.name || 'Unidade'}
        </span>
      </div>

      {/* Responsáveis (Avatars) */}
      <div className="col-span-3 flex items-center gap-1">
        {isEditingResponsible ? (
          <div className="flex items-center gap-1 flex-1">
            <div className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
              <MultiAssigneeSelect
                profiles={profilesForUnit.length > 0 ? profilesForUnit : allProfiles}
                selectedIds={selectedAssignees}
                onChange={setSelectedAssignees}
                placeholder="Selecionar..."
              />
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={handleSaveResponsibles}
              disabled={updateUnitManagersMutation.isPending}
            >
              <Check className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={() => {
                setSelectedAssignees(managers.map(m => m.user_id));
                setIsEditingResponsible(false);
              }}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            {managers.length > 0 ? (
              <div className="flex -space-x-2">
                {managers.slice(0, 3).map((manager) => (
                  <Avatar
                    key={manager.id}
                    className={cn(
                      'w-7 h-7 border-2 border-card',
                      getAvatarColor(manager.user_id)
                    )}
                    title={manager.profile?.full_name || manager.profile?.email}
                  >
                    <AvatarFallback className="text-xs text-white bg-transparent">
                      {getInitials(manager.profile?.full_name || manager.profile?.email)}
                    </AvatarFallback>
                  </Avatar>
                ))}
                {managers.length > 3 && (
                  <Avatar className="w-7 h-7 border-2 border-card bg-secondary">
                    <AvatarFallback className="text-xs text-muted-foreground bg-transparent">
                      +{managers.length - 3}
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">—</span>
            )}
            {isGestorOrAdmin && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 hover:opacity-100"
                onClick={() => setIsEditingResponsible(true)}
              >
                <Pencil className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Prioridade */}
      <div className="col-span-2 flex items-center">
        <Flag className="w-4 h-4 text-muted-foreground/50" />
      </div>

      {/* Vencimento */}
      <div className="col-span-2 flex items-center">
        {periodEnd ? (
          <span className="text-xs text-muted-foreground">
            {format(new Date(periodEnd), 'dd/MM', { locale: ptBR })}
          </span>
        ) : (
          <Calendar className="w-4 h-4 text-muted-foreground/50" />
        )}
      </div>
    </div>
  );
};
