import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Pencil, Clock, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { Tables } from '@/integrations/supabase/types';

import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Circle } from 'lucide-react';

interface RoutineListItemProps {
    routine: Tables<'routines'>;
    isSelected: boolean;
    isMultiSelected?: boolean;
    onToggleSelect?: (id: string) => void;
    onClick: () => void;
    onEdit: (e: React.MouseEvent) => void;
    canEdit: boolean;
    periodDates?: { period_start: string; period_end: string } | null;
    status?: 'pendente' | 'concluida' | 'inativa';
}

const frequencyLabels: Record<string, string> = {
    diaria: 'Diária',
    semanal: 'Semanal',
    quinzenal: 'Quinzenal',
    mensal: 'Mensal',
    anual: 'Anual',
};

export const RoutineListItem = ({ routine, isSelected, isMultiSelected, onToggleSelect, onClick, onEdit, canEdit, periodDates }: RoutineListItemProps) => {
    const formatPeriodLabel = () => {
        if (!periodDates) return null;
        const start = new Date(periodDates.period_start);
        const end = new Date(periodDates.period_end);
        return `${format(start, "dd/MM HH:mm", { locale: ptBR })} → ${format(end, "dd/MM HH:mm", { locale: ptBR })}`;
    };

    return (
        <div
            className={cn(
                'w-full text-left p-4 border-b border-border transition-colors group flex items-start gap-4',
                isSelected ? 'bg-primary/10' : 'hover:bg-secondary/50',
                onClick && 'cursor-pointer'
            )}
            onClick={(e) => {
                if ((e.target as HTMLElement).closest('button')) return;
                onClick();
            }}
        >
            {/* Selection Circle */}
            {onToggleSelect && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggleSelect(routine.id);
                    }}
                    className="mt-1 flex-shrink-0"
                >
                    {isMultiSelected ? (
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                    ) : (
                        <Circle className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors" />
                    )}
                </button>
            )}

            {!onToggleSelect && (
                <div className="mt-1 flex-shrink-0 opacity-0 w-5 h-5" />
            )}

            <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                    <h4 className={cn("font-medium text-foreground truncate", routine.is_active === false && "line-through text-muted-foreground")}>{routine.title}</h4>
                    <div className="flex items-center gap-2">
                        {(routine as any).status === 'pendente' && (
                            <Badge variant="outline" className="text-yellow-600 border-yellow-200 bg-yellow-50 hover:bg-yellow-100">
                                Pendente
                            </Badge>
                        )}
                        {(routine as any).status === 'concluida' && (
                            <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 hover:bg-green-100">
                                Concluída
                            </Badge>
                        )}
                        {(routine as any).status === 'inativa' && (
                            <Badge variant="outline" className="text-slate-500 border-slate-200 bg-slate-50">
                                Inativa
                            </Badge>
                        )}
                        <span className="bg-secondary text-secondary-foreground px-2 py-0.5 rounded text-xs border border-border">
                            {frequencyLabels[routine.frequency] || routine.frequency}
                        </span>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
                    {periodDates ? (
                        <span className="flex items-center gap-1.5 text-primary">
                            <Clock className="w-3.5 h-3.5" />
                            {formatPeriodLabel()}
                        </span>
                    ) : (
                        <span className="flex items-center gap-1.5 text-muted-foreground/60">
                            <Clock className="w-3.5 h-3.5" />
                            Sem período ativo
                        </span>
                    )}

                    {routine.description && (
                        <span className="truncate max-w-[300px] flex items-center gap-1.5">
                            {routine.description}
                        </span>
                    )}
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
                {canEdit && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onEdit}
                        className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
                    >
                        <Pencil className="w-4 h-4 text-muted-foreground" />
                    </Button>
                )}
                <ChevronRight
                    className={cn(
                        'w-5 h-5 text-muted-foreground transition-transform shrink-0',
                        isSelected && 'text-primary'
                    )}
                />
            </div>
        </div>
    );
};
