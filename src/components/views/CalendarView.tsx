import { useMemo, useState, useEffect } from 'react';
import { useTasks } from '@/hooks/useTasks';
import { useAuth } from '@/contexts/AuthContext';
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';
import { cn } from '@/lib/utils';
import { Loader2, ExternalLink, ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, addMonths, subMonths, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';

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

export const CalendarView = ({ sectorId, isMyTasks }: CalendarViewProps) => {
  const { data: tasks, isLoading } = useTasks();
  const { user } = useAuth();
  const { isConnected, fetchEvents } = useGoogleCalendar();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [googleEvents, setGoogleEvents] = useState<GoogleCalendarEvent[]>([]);
  const [isLoadingGoogleEvents, setIsLoadingGoogleEvents] = useState(false);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  
  // Get the full calendar grid (including days from prev/next month to fill weeks)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Fetch Google Calendar events when in My Tasks view and connected
  useEffect(() => {
    if (isMyTasks && isConnected) {
      const fetchGoogleEvents = async () => {
        setIsLoadingGoogleEvents(true);
        try {
          const events = await fetchEvents(
            calendarStart.toISOString(),
            calendarEnd.toISOString()
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
  }, [isMyTasks, isConnected, currentMonth]);

  const getTasksForDay = (date: Date) => {
    return tasks?.filter(task => {
      if (!task.due_date) return false;
      const matchesSector = !sectorId || (task as any).sector_id === sectorId;
      const matchesUser = !isMyTasks || task.assigned_to === user?.id;
      return isSameDay(new Date(task.due_date), date) && matchesSector && matchesUser;
    }) || [];
  };

  const getGoogleEventsForDay = (date: Date) => {
    return googleEvents.filter(event => {
      const eventStart = new Date(event.startDate);
      return isSameDay(eventStart, date);
    });
  };

  const getEventTime = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, 'HH:mm');
  };

  const statusColors: Record<string, { bg: string; text: string }> = {
    pendente: { bg: 'bg-amber-500', text: 'text-white' },
    em_andamento: { bg: 'bg-orange-600', text: 'text-white' },
    concluida: { bg: 'bg-emerald-500', text: 'text-white' },
    atrasada: { bg: 'bg-red-500', text: 'text-white' },
  };

  const toggleDayExpanded = (dayKey: string) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(dayKey)) {
        next.delete(dayKey);
      } else {
        next.add(dayKey);
      }
      return next;
    });
  };

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentMonth.getMonth();
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-1">Calendário</h1>
        <p className="text-muted-foreground">Visualize tarefas organizadas por data</p>
      </div>

      {/* Month Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <h2 className="text-xl font-semibold text-foreground capitalize">
          {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
        </h2>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Calendar Grid */}
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

        {/* Days Grid */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, index) => {
            const dayKey = day.toISOString();
            const dayTasks = getTasksForDay(day);
            const dayGoogleEvents = isMyTasks ? getGoogleEventsForDay(day) : [];
            const allItems = [...dayTasks.map(t => ({ type: 'task' as const, data: t })), ...dayGoogleEvents.map(e => ({ type: 'google' as const, data: e }))];
            const totalItems = allItems.length;
            const isCurrentDay = isToday(day);
            const isExpanded = expandedDays.has(dayKey);
            const maxVisible = 2;
            const hiddenCount = Math.max(0, totalItems - maxVisible);
            const isInCurrentMonth = isCurrentMonth(day);

            return (
              <div
                key={dayKey}
                className={cn(
                  'min-h-[120px] border-b border-r border-border transition-colors relative',
                  !isInCurrentMonth && 'bg-muted/20',
                  isCurrentDay && 'bg-primary/5'
                )}
              >
                {/* Day Header */}
                <div className="flex items-start justify-between p-2">
                  <div
                    className={cn(
                      'text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full',
                      isCurrentDay && 'bg-primary text-primary-foreground',
                      !isInCurrentMonth && 'text-muted-foreground/50'
                    )}
                  >
                    {format(day, 'd')}
                  </div>
                  {totalItems > 0 && (
                    <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {totalItems}
                    </span>
                  )}
                </div>

                {/* Events Container */}
                <div className="px-1 pb-2 space-y-1">
                  {allItems.slice(0, isExpanded ? undefined : maxVisible).map((item, idx) => {
                    if (item.type === 'task') {
                      const task = item.data;
                      const colors = statusColors[task.status] || statusColors.pendente;
                      return (
                        <div
                          key={`task-${task.id}`}
                          className={cn(
                            'text-xs px-2 py-1 rounded-sm truncate cursor-pointer flex items-center gap-1',
                            colors.bg,
                            colors.text
                          )}
                          title={task.title}
                        >
                          <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-70" />
                          <span className="truncate">{task.title}</span>
                        </div>
                      );
                    } else {
                      const event = item.data;
                      const time = getEventTime(event.startDate);
                      return (
                        <div
                          key={`google-${event.id}`}
                          className="text-xs px-2 py-1 rounded-sm truncate cursor-pointer bg-blue-500 text-white flex items-center gap-1"
                          title={`${time} - ${event.title}`}
                        >
                          <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-70" />
                          <span className="truncate">{time !== '00:00' ? `${time} - ` : ''}{event.title}</span>
                        </div>
                      );
                    }
                  })}

                  {/* Expand/Collapse Button */}
                  {hiddenCount > 0 && !isExpanded && (
                    <button
                      onClick={() => toggleDayExpanded(dayKey)}
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 px-1"
                    >
                      <ChevronDown className="w-3 h-3" />
                      +{hiddenCount} mais
                    </button>
                  )}
                  {isExpanded && totalItems > maxVisible && (
                    <button
                      onClick={() => toggleDayExpanded(dayKey)}
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 px-1"
                    >
                      <ChevronUp className="w-3 h-3" />
                      menos
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

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
    </div>
  );
};
