import { useMemo } from 'react';
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

export const RoutineListItem = ({ routine, isSelected, isMultiSelected, onToggleSelect, onClick, onEdit, canEdit, periodDates: propPeriodDates }: RoutineListItemProps) => {
    const periodDates = useMemo(() => {
        if (propPeriodDates) return propPeriodDates;

        const periods = (routine as any)?.routine_periods;
        if (!periods || !Array.isArray(periods) || periods.length === 0) {
            return null;
        }

        const activePeriods = periods.filter((p: any) => p.is_active !== false);
        const targetPeriods = activePeriods.length > 0 ? activePeriods : periods;

        const now = new Date();
        const todayStr = format(now, 'yyyy-MM-dd');

        // 1. Try to find period matching today's date string
        let currentPeriod = targetPeriods.find((p: any) => (p.period_start || '').startsWith(todayStr));

        // 2. Try to find period containing now
        if (!currentPeriod) {
            currentPeriod = targetPeriods.find((p: any) => {
                const start = new Date(p.period_start);
                const end = new Date(p.period_end);
                return now >= start && now <= end;
            });
        }

        // 3. Fallback: closest period to now
        if (!currentPeriod) {
            const sorted = [...targetPeriods].sort((a: any, b: any) => {
                const diffA = Math.abs(new Date(a.period_start).getTime() - now.getTime());
                const diffB = Math.abs(new Date(b.period_start).getTime() - now.getTime());
                return diffA - diffB;
            });
            currentPeriod = sorted[0];
        }

        if (currentPeriod) {
            return {
                period_start: currentPeriod.period_start,
                period_end: currentPeriod.period_end,
            };
        }

        return null;
    }, [propPeriodDates, routine]);

    const formatPeriodLabel = () => {
        if (!periodDates) return null;
        const start = new Date(periodDates.period_start);
        const end = new Date(periodDates.period_end);
        return `${format(start, "dd/MM", { locale: ptBR })} → ${format(end, "dd/MM", { locale: ptBR })}`;
    };

    return (
        <div
            className={cn(
                'w-full text-left p-2 border-b border-border transition-colors group flex items-start gap-3',
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
                        onToggleSelect(routine.id);
                    }}
                    className="mt-0.5 flex-shrink-0"
                >
                    {isMultiSelected ? (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                    ) : (
                        <Circle className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors" />
                    )}
                </button>
            )}

            {!onToggleSelect && (
                <div className="mt-0.5 flex-shrink-0 opacity-0 w-4 h-4" />
            )}

            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                    <h3 className={cn("font-medium text-sm text-foreground truncate", routine.is_active === false && "line-through text-muted-foreground")}>{routine.title}</h3>
                    <div className="flex items-center gap-2 shrink-0">
                        {(() => {
                            const activeStatuses = (routine as any).active_statuses || [(routine as any).status];

                            const getHighestPriorityStatus = (statuses: string[]) => {
                                if (statuses.includes('atrasada')) return 'atrasada';
                                if (statuses.includes('em_andamento')) return 'em_andamento';
                                if (statuses.includes('pendente')) return 'pendente';
                                if (statuses.includes('concluida')) return 'concluida';
                                if (statuses.includes('inativa')) return 'inativa';
                                return statuses[0];
                            };

                            const displayStatus = getHighestPriorityStatus(activeStatuses);

                            return (
                                <>
                                    {displayStatus === 'pendente' && (
                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 text-yellow-600 border-yellow-200 bg-yellow-50 hover:bg-yellow-100">
                                            Pendente
                                        </Badge>
                                    )}
                                    {displayStatus === 'em_andamento' && (
                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 text-orange-600 border-orange-200 bg-orange-50 hover:bg-orange-100">
                                            Em Andamento
                                        </Badge>
                                    )}
                                    {displayStatus === 'atrasada' && (
                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 text-red-600 border-red-200 bg-red-50 hover:bg-red-100">
                                            Atrasada
                                        </Badge>
                                    )}
                                    {displayStatus === 'concluida' && (
                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 text-green-600 border-green-200 bg-green-50 hover:bg-green-100">
                                            Concluída
                                        </Badge>
                                    )}
                                    {displayStatus === 'inativa' && (
                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 text-slate-500 border-slate-200 bg-slate-50">
                                            Inativa
                                        </Badge>
                                    )}
                                </>
                            );
                        })()}
                        <span className="bg-secondary text-secondary-foreground px-1.5 py-0 h-5 flex items-center rounded text-[10px] border border-border">
                            {frequencyLabels[routine.frequency] || routine.frequency}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground">
                    {periodDates ? (
                        <span className="flex items-center gap-1 text-primary">
                            <Clock className="w-3 h-3" />
                            {formatPeriodLabel()}
                        </span>
                    ) : (
                        <span className="flex items-center gap-1 text-muted-foreground/60">
                            <Clock className="w-3 h-3" />
                            Sem período ativo
                        </span>
                    )}

                    {routine.description && (
                        <span className="truncate max-w-[300px] flex items-center gap-1">
                            {routine.description}
                        </span>
                    )}
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
                {canEdit && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onEdit}
                        className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
                    >
                        <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                )}
                <ChevronRight
                    className={cn(
                        'w-4 h-4 text-muted-foreground transition-transform shrink-0',
                        isSelected && 'text-primary'
                    )}
                />
            </div>
        </div>
    );
};
