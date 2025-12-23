import { useState, useEffect, useRef } from 'react';
import { useTasks } from '@/hooks/useTasks';
import { useAuth } from '@/contexts/AuthContext';
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';
import { cn } from '@/lib/utils';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { 
  format, 
  startOfWeek, 
  endOfWeek, 
  addWeeks, 
  subWeeks, 
  eachDayOfInterval, 
  isSameDay, 
  isToday,
  addDays,
  parseISO,
  differenceInMinutes,
  startOfDay,
  isSameWeek
} from 'date-fns';
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

interface CalendarItem {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  isAllDay: boolean;
  type: 'task' | 'google';
  status?: string;
}

const HOUR_HEIGHT = 48; // pixels per hour
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export const CalendarView = ({ sectorId, isMyTasks }: CalendarViewProps) => {
  const { data: tasks, isLoading } = useTasks();
  const { user } = useAuth();
  const { isConnected, fetchEvents } = useGoogleCalendar();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [googleEvents, setGoogleEvents] = useState<GoogleCalendarEvent[]>([]);
  const [isLoadingGoogleEvents, setIsLoadingGoogleEvents] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Scroll to current time on mount
  useEffect(() => {
    if (scrollRef.current) {
      const now = new Date();
      const scrollPosition = (now.getHours() - 1) * HOUR_HEIGHT;
      scrollRef.current.scrollTop = Math.max(0, scrollPosition);
    }
  }, []);

  // Fetch Google Calendar events
  useEffect(() => {
    if (isMyTasks && isConnected) {
      const fetchGoogleEvents = async () => {
        setIsLoadingGoogleEvents(true);
        try {
          const events = await fetchEvents(
            weekStart.toISOString(),
            weekEnd.toISOString()
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
  }, [isMyTasks, isConnected, currentDate]);

  const goToToday = () => setCurrentDate(new Date());
  const goToPrevWeek = () => setCurrentDate(subWeeks(currentDate, 1));
  const goToNextWeek = () => setCurrentDate(addWeeks(currentDate, 1));

  // Get all items for a specific day
  const getItemsForDay = (date: Date): CalendarItem[] => {
    const items: CalendarItem[] = [];

    // Add tasks
    tasks?.forEach(task => {
      if (!task.due_date) return;
      const matchesSector = !sectorId || (task as any).sector_id === sectorId;
      const matchesUser = !isMyTasks || task.assigned_to === user?.id;
      
      if (matchesSector && matchesUser && isSameDay(new Date(task.due_date), date)) {
        const dueDate = new Date(task.due_date);
        // Tasks without specific time are treated as all-day or at the due time
        const isAllDay = dueDate.getHours() === 0 && dueDate.getMinutes() === 0;
        
        items.push({
          id: task.id,
          title: task.title,
          startDate: dueDate,
          endDate: new Date(dueDate.getTime() + 60 * 60 * 1000), // 1 hour duration
          isAllDay,
          type: 'task',
          status: task.status
        });
      }
    });

    // Add Google events (only in My Tasks view)
    if (isMyTasks) {
      googleEvents.forEach(event => {
        const startDate = new Date(event.startDate);
        const endDate = new Date(event.endDate);
        
        if (isSameDay(startDate, date)) {
          // Check if it's an all-day event
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
    const duration = Math.max(endMinutes - startMinutes, 30); // Minimum 30 min display

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

  const isThisWeek = isSameWeek(currentDate, new Date(), { weekStartsOn: 0 });

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
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-1">Calendário</h1>
        <p className="text-muted-foreground">Visualize tarefas organizadas por data</p>
      </div>

      {/* Navigation Header */}
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
          <Button variant="ghost" size="icon" onClick={goToPrevWeek}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={goToNextWeek}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <h2 className="text-lg font-semibold text-foreground capitalize">
          {format(currentDate, 'MMMM \'de\' yyyy', { locale: ptBR })}
        </h2>
      </div>

      {/* Calendar Container */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {/* Week Header */}
        <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border">
          <div className="p-2 text-xs text-muted-foreground text-center border-r border-border">
            GMT-03
          </div>
          {weekDays.map((day) => {
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
        <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border min-h-[40px]">
          <div className="p-1 text-xs text-muted-foreground text-right pr-2 border-r border-border" />
          {weekDays.map((day) => {
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
                      "text-xs px-2 py-1 rounded text-white truncate",
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
          <div className="grid grid-cols-[60px_repeat(7,1fr)]">
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
            {weekDays.map((day, dayIndex) => {
              const dayItems = getItemsForDay(day).filter(item => !item.isAllDay);
              const isCurrentDay = isToday(day);

              return (
                <div
                  key={day.toISOString()}
                  className="relative border-r border-border last:border-r-0"
                >
                  {/* Hour lines */}
                  {HOURS.map((hour) => (
                    <div
                      key={hour}
                      className="border-b border-border"
                      style={{ height: HOUR_HEIGHT }}
                    />
                  ))}

                  {/* Current time indicator */}
                  {isCurrentDay && (
                    <div
                      className="absolute left-0 right-0 z-20 flex items-center"
                      style={{ top: getCurrentTimePosition() }}
                    >
                      <div className="w-3 h-3 rounded-full bg-red-500 -ml-1.5" />
                      <div className="flex-1 h-0.5 bg-red-500" />
                    </div>
                  )}

                  {/* Events */}
                  {dayItems.map((item, itemIndex) => {
                    const { top, height } = getEventPosition(item);
                    const timeStr = format(item.startDate, 'HH:mm');
                    const endTimeStr = format(item.endDate, 'HH:mm');

                    return (
                      <div
                        key={item.id}
                        className={cn(
                          "absolute left-1 right-1 rounded-sm px-2 py-1 text-white text-xs overflow-hidden cursor-pointer border-l-4 z-10",
                          getItemColor(item)
                        )}
                        style={{ 
                          top: top + 1,
                          height: height - 2,
                          // Offset overlapping events
                          marginLeft: itemIndex > 0 ? `${(itemIndex % 2) * 40}%` : 0,
                          width: itemIndex > 0 ? '60%' : undefined
                        }}
                        title={`${item.title} (${timeStr} - ${endTimeStr})`}
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
