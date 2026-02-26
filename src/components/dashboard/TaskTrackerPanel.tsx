import { useMemo, useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2, ChevronLeft, ChevronRight, FileSpreadsheet, Check, X as XIcon, Minus, GripVertical, RefreshCw } from 'lucide-react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MultiSelect } from '@/components/ui/multi-select';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useRoutines } from '@/hooks/useRoutines';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useUpdateTask } from '@/hooks/useTaskMutations';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { RoutineDetailPanel } from '@/components/RoutineDetailPanel';
import { TaskHoverCard } from './TaskHoverCard';

interface TaskTrackerPanelProps {
    sectorId?: string | null;
    initialRoutineIds?: string[];
}

interface SortableRoutineRowProps {
    idItem: string;
    children: (props: any) => React.ReactNode;
}

const SortableRoutineRow = ({ idItem, children }: SortableRoutineRowProps) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: idItem });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.8 : 1,
        position: isDragging ? 'relative' as const : 'static' as const,
        zIndex: isDragging ? 50 : 'auto',
    };
    return (
        <tbody ref={setNodeRef} style={style} className={`bg-card ${isDragging ? 'shadow-xl mix-blend-multiply dark:mix-blend-screen scale-[1.01]' : ''}`}>
            {children({ attributes, listeners, isDragging })}
        </tbody>
    );
};

export const TaskTrackerPanel = ({ sectorId, initialRoutineIds = [] }: TaskTrackerPanelProps) => {
    const [selectedRoutineIds, setSelectedRoutineIds] = useState<string[]>(initialRoutineIds);
    const [currentDate, setCurrentDate] = useState<Date>(new Date());
    const [frequencyFilter, setFrequencyFilter] = useState<string>('all');
    const [orderedRoutineIds, setOrderedRoutineIds] = useState<string[]>([]);
    const [selectedRoutineForPanel, setSelectedRoutineForPanel] = useState<{ routine: any; date: Date } | null>(null);
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const { data: role } = useUserRole();
    const updateTaskMutation = useUpdateTask();

    useEffect(() => {
        const savedOrder = localStorage.getItem('tasktracker-routine-order');
        if (savedOrder) {
            try {
                setOrderedRoutineIds(JSON.parse(savedOrder));
            } catch (e) { }
        }
    }, []);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    useEffect(() => {
        const channel = supabase.channel('task-tracker-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
                queryClient.invalidateQueries({ queryKey: ['tracker-tasks'] });
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [queryClient]);

    const { data: routines, isLoading: isLoadingRoutines } = useRoutines();

    const activeRoutines = useMemo(() => {
        const _active = routines?.filter(r => r.is_active !== false) || [];
        if (!sectorId) return _active;
        return _active.filter((r: any) => r.sector_id === sectorId);
    }, [routines, sectorId]);

    // determine which routines to show based on the filter
    const routinesToShow = useMemo(() => {
        let baseRoutines = activeRoutines;

        // Return active if no filter explicitly set
        if (frequencyFilter === 'all' && selectedRoutineIds.length === 0) {
            return baseRoutines;
        }

        const frequencyRoutines = frequencyFilter !== 'all'
            ? baseRoutines.filter(r => r.frequency === frequencyFilter)
            : [];

        const manualRoutines = selectedRoutineIds.length > 0
            ? baseRoutines.filter(r => selectedRoutineIds.includes(r.id))
            : [];

        // Return a union of both filters
        const combined = [...frequencyRoutines, ...manualRoutines];

        // Remove duplicates by ID
        const uniqueValues = Array.from(new Map(combined.map(r => [r.id, r])).values());

        return uniqueValues;
    }, [activeRoutines, selectedRoutineIds, frequencyFilter]);

    const routineIds = useMemo(() => routinesToShow.map(r => r.id), [routinesToShow]);

    // Fetch active units for this sector
    const { data: sectorUnits, isLoading: isLoadingUnits } = useQuery({
        queryKey: ['tracker-units', sectorId],
        queryFn: async () => {
            const { data, error } = await supabase.from('units').select('id, name, code').not('parent_id', 'is', null).order('name');
            if (error) throw error;
            return data;
        }
    });

    const startDate = startOfMonth(currentDate);
    const endDate = endOfMonth(currentDate);

    // Fetch tasks for ALL selected routines for the month
    const { data: tasks, isLoading: isLoadingTasks } = useQuery({
        queryKey: ['tracker-tasks', routineIds, startDate.toISOString()],
        queryFn: async () => {
            if (routineIds.length === 0) return [];
            const { data, error } = await supabase
                .from('tasks')
                .select(`id, status, due_date, unit_id, routine_id, title, description, priority, created_by, assigned_to, completed_at, parent_task_id, unit:units(name), assignees:task_assignees(user_id)`)
                .in('routine_id', routineIds)
                .gte('due_date', startDate.toISOString())
                .lte('due_date', endDate.toISOString());
            if (error) throw error;
            return data;
        },
        enabled: routineIds.length > 0
    });

    const daysInMonth = useMemo(() => eachDayOfInterval({ start: startDate, end: endDate }), [startDate, endDate]);

    const allUnitRows = useMemo(() => {
        if (!sectorUnits) return [];
        const units = [...sectorUnits];
        // always add unassigned just in case
        units.push({ id: 'unassigned', name: 'Sem Unidade', is_active: true });
        return units;
    }, [sectorUnits]);

    const routinesData = useMemo(() => {
        if (!routinesToShow.length || !allUnitRows.length) return [];
        const validTasks = tasks || [];

        return routinesToShow.map(routine => {
            const routineTasks = validTasks.filter(t => t.routine_id === routine.id);

            const taskMap = new Map();
            routineTasks.forEach(task => {
                if (!task.due_date) return;
                const dateKey = format(parseISO(task.due_date), 'yyyy-MM-dd');
                const unitId = task.unit_id || 'unassigned';
                taskMap.set(`${unitId}_${dateKey}`, task);
            });

            // Count rows to adjust rowspan properly, omitting rows if they have entirely no data? 
            // The screenshot shows all units. We keep all units.
            const matrix = allUnitRows.map(unit => {
                const isUnassignedRow = unit.id === 'unassigned';
                const hasAnyTask = daysInMonth.some(day => taskMap.has(`${unit.id}_${format(day, 'yyyy-MM-dd')}`));

                let appliesToUnit = true;
                if (!isUnassignedRow && routine.unit_ids && routine.unit_ids.length > 0) {
                    appliesToUnit = routine.unit_ids.includes(unit.id);
                }

                // If unassigned row, only show if there are unassigned tasks
                if (isUnassignedRow) {
                    appliesToUnit = hasAnyTask;
                }

                const rowData = daysInMonth.map(day => {
                    const dateKey = format(day, 'yyyy-MM-dd');
                    const task = taskMap.get(`${unit.id}_${dateKey}`);

                    if (task) return task;
                    if (appliesToUnit) return 'empty'; // means we should render a '-' (no task that day)
                    return null;
                });
                return { unit, days: rowData, appliesToUnit, hasAnyTask };
            }).filter(row => row.appliesToUnit || row.hasAnyTask);

            const dailyStats = daysInMonth.map(day => {
                const dateKey = format(day, 'yyyy-MM-dd');
                const dayTasks = routineTasks.filter(t => t.due_date && format(parseISO(t.due_date), 'yyyy-MM-dd') === dateKey);
                const total = dayTasks.length;
                const completed = dayTasks.filter(t => t.status === 'concluida').length;
                return { total, completed };
            });

            return { routine, matrix, dailyStats };
        });
    }, [routinesToShow, allUnitRows, tasks, daysInMonth]);

    const canUserAccessTask = (task: any) => {
        if (!user) return false;
        if (role === 'admin' || role === 'gestor') return true;
        if (task.created_by === user.id || task.assigned_to === user.id) return true;
        if (task.assignees && task.assignees.some((a: any) => a.user_id === user.id)) return true;
        return false;
    };

    const handleTaskClick = (task: any, routine: any) => {
        const access = canUserAccessTask(task);
        if (access) {
            setSelectedRoutineForPanel({ routine, date: parseISO(task.due_date) });
        } else {
            console.warn("🚫 Permissão negada para clique na tarefa.");
        }
    };

    const handleReopenTask = async (taskId: string) => {
        await updateTaskMutation.mutateAsync({ id: taskId, status: 'pendente', comment: 'Reaberta através do Rastreador de Tarefas' });
    };

    const sortedRoutinesData = useMemo(() => {
        if (!orderedRoutineIds.length) return routinesData;

        return [...routinesData].sort((a, b) => {
            const indexA = orderedRoutineIds.indexOf(a.routine.id);
            const indexB = orderedRoutineIds.indexOf(b.routine.id);
            if (indexA === -1 && indexB === -1) return 0;
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
        });
    }, [routinesData, orderedRoutineIds]);

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            setOrderedRoutineIds((prev) => {
                const currentIds = sortedRoutinesData.map(r => r.routine.id);
                const activeIndex = currentIds.indexOf(active.id as string);
                const overIndex = currentIds.indexOf(over.id as string);
                const nextOrder = arrayMove(currentIds, activeIndex, overIndex);
                localStorage.setItem('tasktracker-routine-order', JSON.stringify(nextOrder));
                return nextOrder;
            });
        }
    };

    const handlePrevMonth = () => setCurrentDate(prev => subMonths(prev, 1));
    const handleNextMonth = () => setCurrentDate(prev => addMonths(prev, 1));

    const getFilterLabel = () => {
        if (selectedRoutineIds.length === 0) return 'Selecione Rotinas';
        if (selectedRoutineIds.length === activeRoutines.length) return 'Todas as Rotinas';
        if (selectedRoutineIds.length === 1) {
            return activeRoutines.find(r => r.id === selectedRoutineIds[0])?.title || 'Rotina Específica';
        }
        return `${selectedRoutineIds.length} Rotinas Selecionadas`;
    };

    return (
        <Card className="flex flex-col h-[calc(100vh-140px)] min-h-[600px] overflow-hidden border-0 shadow-none">
            <CardHeader className="pb-3 shrink-0 px-2 sm:px-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-4 w-full">
                        <div className="w-[300px]">
                            <MultiSelect
                                options={activeRoutines.map(r => ({ label: r.title, value: r.id }))}
                                selected={selectedRoutineIds}
                                onChange={setSelectedRoutineIds}
                                placeholder="Selecionar Rotinas Manuais..."
                            />
                        </div>

                        <div className="w-[180px]">
                            <select
                                value={frequencyFilter}
                                onChange={(e) => setFrequencyFilter(e.target.value)}
                                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <option value="all">Todas as Frequências</option>
                                <option value="diaria">Diárias</option>
                                <option value="semanal">Semanais</option>
                                <option value="quinzenal">Quinzenais</option>
                                <option value="mensal">Mensais</option>
                            </select>
                        </div>

                        <div className="flex items-center gap-2 bg-secondary/30 rounded-md p-1 border ml-auto">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handlePrevMonth}>
                                <ChevronLeft className="w-4 h-4" />
                            </Button>
                            <span className="font-semibold text-sm min-w-[140px] text-center capitalize">
                                {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
                            </span>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleNextMonth}>
                                <ChevronRight className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0 pb-2 px-0 sm:px-2 flex flex-col">
                {isLoadingUnits || isLoadingTasks ? (
                    <div className="flex-1 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                ) : routinesData.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground border-t border-dashed m-4 rounded-lg">
                        <FileSpreadsheet className="w-12 h-12 mb-4 opacity-20" />
                        <p>Nenhuma rotina correspondente encontrada com calendário neste mês.</p>
                    </div>
                ) : (
                    <div className="flex-1 overflow-auto border custom-scrollbar m-2 shadow-inner bg-card h-full relative">
                        <style dangerouslySetInnerHTML={{
                            __html: `
                            .custom-scrollbar::-webkit-scrollbar { width: 10px; height: 12px; }
                            .custom-scrollbar::-webkit-scrollbar-track { background: hsl(var(--secondary) / 0.5); }
                            .custom-scrollbar::-webkit-scrollbar-thumb { background: hsl(var(--primary) / 0.2); border-radius: 6px; border: 2px solid hsl(var(--secondary) / 0.5); }
                            .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: hsl(var(--primary) / 0.4); }
                            
                            .matrix-table th, .matrix-table td {
                                border-right-width: 1px;
                                border-bottom-width: 1px;
                                border-color: rgba(150, 150, 150, 0.2);
                            }
                            .matrix-table .sticky-col-1 { position: sticky; left: 0; z-index: 20; }
                            .matrix-table .sticky-col-2 { position: sticky; left: 160px; z-index: 20; border-right-width: 2px; border-right-color: rgba(150, 150, 150, 0.4); }
                            
                            /* Maintain headers over sticky cols */
                            .matrix-table thead { position: sticky; top: 0; z-index: 40; }
                            .matrix-table thead .sticky-col-1 { z-index: 50; }
                            .matrix-table thead .sticky-col-2 { z-index: 50; }
                        `}} />
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                            <SortableContext items={sortedRoutinesData.map(r => r.routine.id)} strategy={verticalListSortingStrategy}>
                                <table className="matrix-table w-full text-xs font-sans min-w-max border-separate border-spacing-0">
                                    {/* GLOBAL THEAD FOR DATES */}
                                    <thead className="bg-background shadow-sm">
                                        <tr>
                                            <th className="sticky-col-1 bg-[#f08c16] text-black font-bold p-1 px-2 text-center uppercase text-[10px] w-[160px] min-w-[160px]">
                                                ROTINAS
                                            </th>
                                            <th className="sticky-col-2 bg-[#f08c16] text-black font-bold p-1 text-center uppercase text-[10px] w-[160px] min-w-[160px]">
                                                {/* Blank space */}
                                            </th>
                                            {daysInMonth.map(day => (
                                                <th key={`d-${day.toISOString()}`} className="bg-muted border-b border-[#ddd] text-muted-foreground font-semibold p-1 w-[26px] min-w-[26px] text-center text-[10px]">
                                                    {format(day, 'dd/M')}
                                                </th>
                                            ))}
                                        </tr>
                                        <tr>
                                            <th className="sticky-col-1 bg-[#e2e2e2] dark:bg-muted text-black dark:text-foreground font-bold p-1 px-2 text-center text-[9px] uppercase">
                                                FILTRO C/ {routinesData.length} ROTINA(S)
                                            </th>
                                            <th className="sticky-col-2 bg-[#e2e2e2] dark:bg-muted text-black dark:text-foreground font-bold p-1 px-2 text-center text-[9px] uppercase">
                                            </th>
                                            {daysInMonth.map(day => (
                                                <th key={`w-${day.toISOString()}`} className="bg-[#e2e2e2] dark:bg-secondary/40 text-muted-foreground font-medium p-1 text-center text-[9px] uppercase">
                                                    {format(day, 'EE', { locale: ptBR }).substring(0, 3)}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>

                                    {/* BODY REPEATED PER ROUTINE */}
                                    {sortedRoutinesData.map(({ routine, matrix, dailyStats }, rIndex) => (
                                        <SortableRoutineRow key={routine.id} idItem={routine.id}>
                                            {({ attributes, listeners, isDragging }: any) => (
                                                <>
                                                    {/* Routine Info Header Row */}
                                                    <tr>
                                                        <th className="sticky-col-1 bg-white dark:bg-background text-black dark:text-foreground font-bold p-1.5 text-center text-[10px] uppercase border-t-2 border-[#888] align-top relative">
                                                            <div {...attributes} {...listeners} className="absolute left-1 top-2 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground">
                                                                <GripVertical className="w-4 h-4" />
                                                            </div>
                                                            HORÁRIO
                                                            <div className="text-[9px] font-normal text-muted-foreground mt-0.5 whitespace-nowrap">
                                                                {routine.start_time ? routine.start_time.substring(0, 5) : '00:00'} - {routine.end_time ? routine.end_time.substring(0, 5) : '23:59'}
                                                            </div>
                                                        </th>
                                                        <th className="sticky-col-2 bg-black text-[#f08c16] font-bold p-1.5 text-center whitespace-nowrap text-[11px] border-t-2 border-[#888]">
                                                            {routine.title}
                                                        </th>
                                                        {dailyStats.map((stat, i) => {
                                                            const pct = stat.total > 0 ? Math.round((stat.completed / stat.total) * 100) : null;
                                                            const bgClass = 'bg-[#df7d70] text-black';
                                                            return (
                                                                <th key={`pct-${i}`} className={`font-medium p-1 text-center text-[9px] ${bgClass} border-t-2 border-[#888] align-top`}>
                                                                    <div className="mt-1.5">{pct !== null ? `${pct}%` : '0%'}</div>
                                                                </th>
                                                            );
                                                        })}
                                                    </tr>

                                                    {/* Routine Checkpoint Header Row */}
                                                    <tr>
                                                        <th className="sticky-col-1 bg-white dark:bg-background p-0 m-0 align-middle">
                                                            <div className="text-[10px] font-bold text-muted-foreground uppercase text-center w-full">
                                                                DESCRIÇÃO
                                                            </div>
                                                        </th>
                                                        <th className="sticky-col-2 bg-white dark:bg-background p-0 px-1">
                                                            <div className="bg-[#f08c16] text-black font-bold p-1 px-2 text-left text-[10px] uppercase rounded-sm mx-1 my-1">
                                                                UNIDADES
                                                            </div>
                                                        </th>
                                                        {
                                                            dailyStats.map((stat, i) => {
                                                                const info = dailyStats[i];
                                                                return (
                                                                    <th key={`b-${i}`} className="bg-black border-[#444] border-r border-b p-0.5">
                                                                        {info.total > 0 ? (
                                                                            <div className="text-[9px] text-white text-center font-normal">{Math.round((info.completed / info.total) * 100)}%</div>
                                                                        ) : (
                                                                            <div className="text-[9px] text-[#555] text-center font-normal">-</div>
                                                                        )}
                                                                    </th>
                                                                );
                                                            })
                                                        }
                                                    </tr>

                                                    {/* Routine Units Rows */}
                                                    {matrix.map((row, rowIndex) => (
                                                        <tr key={row.unit.id} className={`hover:bg-accent/30 transition-colors group h-full ${isDragging ? 'bg-background' : ''}`}>
                                                            {rowIndex === 0 && (
                                                                <td rowSpan={matrix.length} className="sticky-col-1 bg-white dark:bg-background p-3 align-middle text-center text-[10px] font-medium group-hover:bg-background border-r-2 border-[#888]">
                                                                    <div className="whitespace-normal break-words mt-1 flex flex-col justify-center h-full min-h-[40px]">
                                                                        {routine.description || 'Acompanhamento da Rotina.'}
                                                                    </div>
                                                                </td>
                                                            )}
                                                            <td className="sticky-col-2 bg-white dark:bg-background p-1 px-2 font-medium text-[10px] whitespace-nowrap overflow-hidden text-ellipsis group-hover:bg-accent/10 border-r-2 border-[#888]" title={row.unit.name}>
                                                                {row.unit.name}
                                                            </td>
                                                            {row.days.map((task, colIndex) => {
                                                                if (task === null) return <td key={colIndex} className="p-0.5 text-center bg-black border-[#222]"></td>;
                                                                if (task === 'empty') return <td key={colIndex} className="p-0.5 text-center text-muted-foreground/30 font-light text-[9px] bg-white dark:bg-card border-dotted border-gray-100">-</td>;

                                                                let displayChar: React.ReactNode = '?';
                                                                let bgClass = '';

                                                                if (task.status === 'concluida') { displayChar = <Check className="w-3.5 h-3.5 stroke-[3]" />; bgClass = 'bg-[#43a047] text-white border-b-2 border-b-[#2e7d32] shadow-sm'; }
                                                                else if (task.status === 'nao_aplicavel') { displayChar = <Check className="w-3.5 h-3.5 stroke-[3]" />; bgClass = 'bg-[#0A3D14] text-white border-b-2 border-b-[#05260A] shadow-sm'; }
                                                                else if (task.status === 'atrasada') { displayChar = <XIcon className="w-3.5 h-3.5 stroke-[3]" />; bgClass = 'bg-[#e53935] text-white border-b-2 border-b-[#c62828] shadow-sm'; }
                                                                else if (task.status === 'cancelada') { displayChar = 'C'; bgClass = 'bg-gray-500 text-white border-b-2 border-b-gray-700 shadow-sm'; }
                                                                else { displayChar = <Minus className="w-3.5 h-3.5 stroke-[3]" />; bgClass = 'bg-[#fb8c00] text-white border-b-2 border-b-[#ef6c00] shadow-sm'; }

                                                                const isAllowed = canUserAccessTask(task);
                                                                const cellContent = (
                                                                    <div
                                                                        onClick={() => handleTaskClick(task, routine)}
                                                                        className={`flex items-center justify-center w-[20px] h-[16px] mx-auto rounded-[2px] ${isAllowed ? 'cursor-pointer hover:opacity-80' : 'cursor-default opacity-90'} transition-opacity ${bgClass}`}
                                                                        title={task.status !== 'concluida' ? `Status: ${task.status}\nRotina: ${routine.title}\nVencimento: ${format(parseISO(task.due_date), 'dd/MM/yyyy')}` : undefined}
                                                                    >
                                                                        {displayChar}
                                                                    </div>
                                                                );

                                                                return (
                                                                    <td key={colIndex} className="p-0">
                                                                        <div className="h-full w-full min-h-[22px] p-0.5 flex items-center justify-center bg-white dark:bg-card hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50 transition-colors">
                                                                            {task.status === 'concluida' ? (
                                                                                <HoverCard openDelay={200} closeDelay={300}>
                                                                                    <HoverCardTrigger asChild>
                                                                                        {cellContent}
                                                                                    </HoverCardTrigger>
                                                                                    <HoverCardContent className="w-80 p-4 z-[100] shadow-xl border-accent" side="top" align="center">
                                                                                        <TaskHoverCard
                                                                                            task={task}
                                                                                            routine={routine}
                                                                                            isAllowed={isAllowed}
                                                                                            handleReopenTask={handleReopenTask}
                                                                                            updateTaskMutationPending={updateTaskMutation.isPending}
                                                                                        />
                                                                                    </HoverCardContent>
                                                                                </HoverCard>
                                                                            ) : cellContent}
                                                                        </div>
                                                                    </td>
                                                                );
                                                            })}
                                                        </tr>
                                                    ))}
                                                    {/* Optional gap between routines */}
                                                    {rIndex < sortedRoutinesData.length - 1 && (
                                                        <tr>
                                                            <td colSpan={daysInMonth.length + 2} className="h-4 bg-muted/20 border-0"></td>
                                                        </tr>
                                                    )}
                                                </>
                                            )}
                                        </SortableRoutineRow>
                                    ))}
                                </table>
                            </SortableContext>
                        </DndContext>
                    </div>
                )}
            </CardContent>

            <Sheet open={!!selectedRoutineForPanel} onOpenChange={(open) => { if (!open) setSelectedRoutineForPanel(null); }}>
                <SheetContent className="sm:max-w-xl w-[90vw] p-0" side="right">
                    {selectedRoutineForPanel && (
                        <div className="h-full overflow-y-auto">
                            <RoutineDetailPanel
                                routine={selectedRoutineForPanel.routine}
                                contextDate={selectedRoutineForPanel.date}
                                onClose={() => setSelectedRoutineForPanel(null)}
                            />
                        </div>
                    )}
                </SheetContent>
            </Sheet>
        </Card>
    );
};
