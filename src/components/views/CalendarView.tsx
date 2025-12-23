import { useState, useEffect, useRef } from 'react';
import { useTasks } from '@/hooks/useTasks';
import { useAuth } from '@/contexts/AuthContext';
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';
import { cn } from '@/lib/utils';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';
import { TaskEditDialog } from '@/components/TaskEditDialog';

type Task = Tables<'tasks'> & {
  unit?: { name: string; code: string } | null;
};
import { 
  format, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth,
  endOfMonth,
  addWeeks, 
  subWeeks,
  addMonths,
  subMonths,
  addDays,
  subDays,
  eachDayOfInterval, 
  isSameDay, 
  isToday,
  isSameMonth,
  isSameWeek,
  differenceInMinutes
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

interface GoogleCalendarEvent {
  id: string;
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
}

interface CalendarViewProps {
  sectorId?: string;
  isMyTasks?: boolean;
}

interface CalendarItem {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  isAllDay: boolean;
  type: 'task' | 'google';
  status?: string;
}

type ViewMode = 'day' | 'week' | 'month';

const HOUR_HEIGHT = 48;
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export const CalendarView = ({ sectorId, isMyTasks }: CalendarViewProps) => {
  const { data: tasks, isLoading } = useTasks();
  const { user } = useAuth();
  const { isConnected, fetchEvents } = useGoogleCalendar();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [googleEvents, setGoogleEvents] = useState<GoogleCalendarEvent[]>([]);
  const [isLoadingGoogleEvents, setIsLoadingGoogleEvents] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const handleEditTask = (taskId: string) => {
    const task = tasks?.find(t => t.id === taskId);
    if (task) {
      setEditingTask(task as Task);
      setEditDialogOpen(true);
    }
  };

  // Calculate date ranges based on view mode
  const getDateRange = () => {
    switch (viewMode) {
      case 'day':
        return { start: currentDate, end: currentDate };
      case 'week':
        return { 
          start: startOfWeek(currentDate, { weekStartsOn: 0 }), 
          end: endOfWeek(currentDate, { weekStartsOn: 0 }) 
        };
      case 'month':
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(currentDate);
        return { 
          start: startOfWeek(monthStart, { weekStartsOn: 0 }), 
          end: endOfWeek(monthEnd, { weekStartsOn: 0 }) 
        };
    }
  };

  const { start: rangeStart, end: rangeEnd } = getDateRange();
  const daysToShow = viewMode === 'day' 
    ? [currentDate] 
    : eachDayOfInterval({ start: rangeStart, end: rangeEnd });

  // Scroll to current time on mount (for day/week views)
  useEffect(() => {
    if (scrollRef.current && viewMode !== 'month') {
      const now = new Date();
      const scrollPosition = (now.getHours() - 1) * HOUR_HEIGHT;
      scrollRef.current.scrollTop = Math.max(0, scrollPosition);
    }
  }, [viewMode]);

  // Fetch Google Calendar events
  useEffect(() => {
    if (isMyTasks && isConnected) {
      const fetchGoogleEvents = async () => {
        setIsLoadingGoogleEvents(true);
        try {
          const events = await fetchEvents(
            rangeStart.toISOString(),
            rangeEnd.toISOString()
          );
          setGoogleEvents(events);
        } catch (error) {
          console.error('Error fetching Google Calendar events:', error);
        } finally {
          setIsLoadingGoogleEvents(false);
        }
      };
      fetchGoogleEvents();
    } else {
      setGoogleEvents([]);
    }
  }, [isMyTasks, isConnected, currentDate, viewMode]);

  const goToToday = () => setCurrentDate(new Date());
  
  const goToPrev = () => {
    switch (viewMode) {
      case 'day': setCurrentDate(subDays(currentDate, 1)); break;
      case 'week': setCurrentDate(subWeeks(currentDate, 1)); break;
      case 'month': setCurrentDate(subMonths(currentDate, 1)); break;
    }
  };
  
  const goToNext = () => {
    switch (viewMode) {
      case 'day': setCurrentDate(addDays(currentDate, 1)); break;
      case 'week': setCurrentDate(addWeeks(currentDate, 1)); break;
      case 'month': setCurrentDate(addMonths(currentDate, 1)); break;
    }
  };

  const getItemsForDay = (date: Date): CalendarItem[] => {
    const items: CalendarItem[] = [];

    tasks?.forEach(task => {
      if (!task.due_date) return;
      const matchesSector = !sectorId || (task as any).sector_id === sectorId;
      const matchesUser = !isMyTasks || task.assigned_to === user?.id;
      
      if (matchesSector && matchesUser && isSameDay(new Date(task.due_date), date)) {
        const dueDate = new Date(task.due_date);
        const isAllDay = dueDate.getHours() === 0 && dueDate.getMinutes() === 0;
        
        items.push({
          id: task.id,
          title: task.title,
          startDate: dueDate,
          endDate: new Date(dueDate.getTime() + 60 * 60 * 1000),
          isAllDay,
          type: 'task',
          status: task.status
        });
      }
    });

    if (isMyTasks) {
      googleEvents.forEach(event => {
        const startDate = new Date(event.startDate);
        const endDate = new Date(event.endDate);
        
        if (isSameDay(startDate, date)) {
          const isAllDay = startDate.getHours() === 0 && 
                          startDate.getMinutes() === 0 && 
                          (differenceInMinutes(endDate, startDate) >= 1440 || endDate.getHours() === 0);
          
          items.push({
            id: event.id,
            title: event.title,
            startDate,
            endDate,
            isAllDay,
            type: 'google'
          });
        }
      });
    }

    return items;
  };

  const getEventPosition = (item: CalendarItem) => {
    const startMinutes = item.startDate.getHours() * 60 + item.startDate.getMinutes();
    const endMinutes = item.endDate.getHours() * 60 + item.endDate.getMinutes();
    const duration = Math.max(endMinutes - startMinutes, 30);

    const top = (startMinutes / 60) * HOUR_HEIGHT;
    const height = (duration / 60) * HOUR_HEIGHT;

    return { top, height: Math.max(height, 20) };
  };

  const getItemColor = (item: CalendarItem) => {
    if (item.type === 'google') {
      return 'bg-blue-500 border-blue-600';
    }
    
    const statusColors: Record<string, string> = {
      pendente: 'bg-amber-500 border-amber-600',
      em_andamento: 'bg-orange-600 border-orange-700',
      concluida: 'bg-emerald-500 border-emerald-600',
      atrasada: 'bg-red-500 border-red-600',
    };
    
    return statusColors[item.status || 'pendente'] || statusColors.pendente;
  };

  const getCurrentTimePosition = () => {
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    return (minutes / 60) * HOUR_HEIGHT;
  };

  const getHeaderTitle = () => {
    switch (viewMode) {
      case 'day':
        return format(currentDate, "d 'de' MMMM 'de' yyyy", { locale: ptBR });
      case 'week':
      case 'month':
        return format(currentDate, "MMMM 'de' yyyy", { locale: ptBR });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1">Calendário</h1>
          <p className="text-muted-foreground">Visualize tarefas por data</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  // Month View Component
  const MonthView = () => {
    const weeks: Date[][] = [];
    for (let i = 0; i < daysToShow.length; i += 7) {
      weeks.push(daysToShow.slice(i, i + 7));
    }

    return (
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {/* Week Header */}
        <div className="grid grid-cols-7 bg-muted/30">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => (
            <div
              key={day}
              className="py-3 text-center text-sm font-medium text-muted-foreground border-b border-border"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Weeks */}
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-7">
            {week.map((day) => {
              const dayItems = getItemsForDay(day);
              const isCurrentDay = isToday(day);
              const isInCurrentMonth = isSameMonth(day, currentDate);

              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    'min-h-[100px] border-b border-r border-border last:border-r-0 p-1',
                    !isInCurrentMonth && 'bg-muted/20',
                    isCurrentDay && 'bg-primary/5'
                  )}
                >
                  <div className="flex items-start justify-between mb-1">
                    <span
                      className={cn(
                        'text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full',
                        isCurrentDay && 'bg-primary text-primary-foreground',
                        !isInCurrentMonth && 'text-muted-foreground/50'
                      )}
                    >
                      {format(day, 'd')}
                    </span>
                    {dayItems.length > 0 && (
                      <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {dayItems.length}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1">
                    {dayItems.slice(0, 3).map((item) => (
                      <div
                        key={item.id}
                        className={cn(
                          'text-xs px-1.5 py-0.5 rounded truncate text-white cursor-pointer hover:opacity-80',
                          getItemColor(item)
                        )}
                        title={item.title}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (item.type === 'task') {
                            handleEditTask(item.id);
                          }
                        }}
                      >
                        {item.title}
                      </div>
                    ))}
                    {dayItems.length > 3 && (
                      <div className="text-xs text-muted-foreground px-1">
                        +{dayItems.length - 3} mais
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  // Day/Week View Component (Time Grid)
  const TimeGridView = () => {
    const gridCols = viewMode === 'day' ? 'grid-cols-[60px_1fr]' : 'grid-cols-[60px_repeat(7,1fr)]';

    return (
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {/* Header */}
        <div className={cn('grid border-b border-border', gridCols)}>
          <div className="p-2 text-xs text-muted-foreground text-center border-r border-border">
            GMT-03
          </div>
          {daysToShow.map((day) => {
            const isCurrentDay = isToday(day);
            return (
              <div
                key={day.toISOString()}
                className="p-2 text-center border-r border-border last:border-r-0"
              >
                <div className={cn(
                  "text-xs uppercase font-medium",
                  isCurrentDay ? "text-primary" : "text-muted-foreground"
                )}>
                  {format(day, 'EEE', { locale: ptBR })}.
                </div>
                <div className={cn(
                  "text-xl font-medium mt-1",
                  isCurrentDay && "w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto"
                )}>
                  {format(day, 'd')}
                </div>
              </div>
            );
          })}
        </div>

        {/* All-day events row */}
        <div className={cn('grid border-b border-border min-h-[40px]', gridCols)}>
          <div className="p-1 text-xs text-muted-foreground text-right pr-2 border-r border-border" />
          {daysToShow.map((day) => {
            const allDayItems = getItemsForDay(day).filter(item => item.isAllDay);
            return (
              <div
                key={`allday-${day.toISOString()}`}
                className="p-1 border-r border-border last:border-r-0 space-y-1"
              >
                {allDayItems.slice(0, 2).map((item) => (
                  <div
                    key={item.id}
                    className={cn(
                      'text-xs px-2 py-1 rounded text-white truncate',
                      getItemColor(item)
                    )}
                    title={item.title}
                  >
                    {item.title}
                  </div>
                ))}
                {allDayItems.length > 2 && (
                  <div className="text-xs text-muted-foreground px-1">
                    +{allDayItems.length - 2} mais
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Time Grid */}
        <div 
          ref={scrollRef}
          className="overflow-y-auto max-h-[600px] relative"
        >
          <div className={cn('grid', gridCols)}>
            {/* Hours Column */}
            <div className="relative">
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="border-r border-border relative"
                  style={{ height: HOUR_HEIGHT }}
                >
                  <span className="absolute -top-2 right-2 text-xs text-muted-foreground">
                    {hour.toString().padStart(2, '0')}:00
                  </span>
                </div>
              ))}
            </div>

            {/* Day Columns */}
            {daysToShow.map((day) => {
              const dayItems = getItemsForDay(day).filter(item => !item.isAllDay);
              const isCurrentDay = isToday(day);

              return (
                <div
                  key={day.toISOString()}
                  className="relative border-r border-border last:border-r-0"
                >
                  {HOURS.map((hour) => (
                    <div
                      key={hour}
                      className="border-b border-border"
                      style={{ height: HOUR_HEIGHT }}
                    />
                  ))}

                  {isCurrentDay && (
                    <div
                      className="absolute left-0 right-0 z-20 flex items-center"
                      style={{ top: getCurrentTimePosition() }}
                    >
                      <div className="w-3 h-3 rounded-full bg-red-500 -ml-1.5" />
                      <div className="flex-1 h-0.5 bg-red-500" />
                    </div>
                  )}

                  {dayItems.map((item, itemIndex) => {
                    const { top, height } = getEventPosition(item);
                    const timeStr = format(item.startDate, 'HH:mm');
                    const endTimeStr = format(item.endDate, 'HH:mm');

                    return (
                      <div
                        key={item.id}
                        className={cn(
                          'absolute left-1 right-1 rounded-sm px-2 py-1 text-white text-xs overflow-hidden cursor-pointer border-l-4 z-10 hover:opacity-90',
                          getItemColor(item)
                        )}
                        style={{ 
                          top: top + 1,
                          height: height - 2,
                          marginLeft: itemIndex > 0 ? `${(itemIndex % 2) * 40}%` : 0,
                          width: itemIndex > 0 ? '60%' : undefined
                        }}
                        title={`${item.title} (${timeStr} - ${endTimeStr})`}
                        onClick={() => {
                          if (item.type === 'task') {
                            handleEditTask(item.id);
                          }
                        }}
                      >
                        <div className="font-medium truncate">{item.title}</div>
                        {height > 30 && (
                          <div className="text-white/80 truncate">
                            {timeStr} - {endTimeStr}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {!isMyTasks && (
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1">Calendário</h1>
          <p className="text-muted-foreground">Visualize tarefas organizadas por data</p>
        </div>
      )}

      {/* Navigation Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={goToToday}
            className="font-medium"
          >
            Hoje
          </Button>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={goToPrev}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={goToNext}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <h2 className="text-lg font-semibold text-foreground capitalize">
            {getHeaderTitle()}
          </h2>
        </div>

        {/* View Mode Toggle */}
        <ToggleGroup 
          type="single" 
          value={viewMode} 
          onValueChange={(value) => value && setViewMode(value as ViewMode)}
          className="border rounded-lg"
        >
          <ToggleGroupItem value="day" className="px-4">
            Dia
          </ToggleGroupItem>
          <ToggleGroupItem value="week" className="px-4">
            Semana
          </ToggleGroupItem>
          <ToggleGroupItem value="month" className="px-4">
            Mês
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Calendar View */}
      {viewMode === 'month' ? <MonthView /> : <TimeGridView />}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-amber-500" />
          <span className="text-muted-foreground">Pendente</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-orange-600" />
          <span className="text-muted-foreground">Em Andamento</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-emerald-500" />
          <span className="text-muted-foreground">Concluída</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-red-500" />
          <span className="text-muted-foreground">Atrasada</span>
        </div>
        {isMyTasks && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-blue-500" />
            <span className="text-muted-foreground">Google Calendar</span>
          </div>
        )}
      </div>

      <TaskEditDialog
        task={editingTask}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />
    </div>
  );
};
