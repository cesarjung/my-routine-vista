import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Task {
  id: string;
  title: string;
  description: string | null;
  unit_id: string | null;
  sector_id: string | null;
  assigned_to: string | null;
  created_by: string | null;
  start_date: string | null;
  due_date: string | null;
  priority: number | null;
  is_recurring: boolean;
  recurrence_frequency: 'diaria' | 'semanal' | 'quinzenal' | 'mensal' | null;
  recurrence_mode: 'schedule' | 'on_completion' | null;
  parent_task_id: string | null;
  status: string;
  routine_id: string | null;
  // Joins
  routine?: {
    custom_schedule: {
      skipWeekendsHolidays?: boolean;
      monthlyAnchor?: 'date' | 'weekday'; // New field support
    } | null;
  } | null;
  parent_task?: {
    start_date: string | null;
  } | null;
}

// Brazilian National Holidays (Fixed dates)
const FIXED_HOLIDAYS = [
  '01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '12-25',
];

function isBusinessDay(date: Date): boolean {
  const day = date.getDay();
  if (day === 0 || day === 6) return false;

  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  const dateString = `${month}-${d}`;

  return !FIXED_HOLIDAYS.includes(dateString);
}

function getNextBusinessDay(date: Date): Date {
  let nextDate = new Date(date);
  while (!isBusinessDay(nextDate)) {
    nextDate.setDate(nextDate.getDate() + 1);
  }
  return nextDate;
}

// Get the Nth weekday of the month (e.g. 2nd Friday)
function getNthWeekdayOfMonth(date: Date): { nth: number; weekday: number } {
  const day = date.getDate();
  const weekday = date.getDay();
  const nth = Math.ceil(day / 7); // 1st, 2nd, 3rd, 4th, or 5th
  return { nth, weekday };
}

// Get date for the Nth weekday of a specific month
function getDateByNthWeekday(year: number, month: number, nth: number, weekday: number): Date {
  // Start at the 1st of the month
  const targetDate = new Date(year, month, 1);
  const firstDayOfWeek = targetDate.getDay();

  // Calculate days to add to get to the first occurrence of 'weekday'
  let daysToAdd = weekday - firstDayOfWeek;
  if (daysToAdd < 0) daysToAdd += 7;

  targetDate.setDate(1 + daysToAdd + (nth - 1) * 7);

  // Handle case where 5th occurrence doesn't exist (e.g. February), default to last occurrence
  if (targetDate.getMonth() !== month) {
    // Go back one week
    targetDate.setDate(targetDate.getDate() - 7);
  }

  return targetDate;
}

// Calculate next occurrence
function getNextDates(
  currentStart: Date,
  currentDue: Date,
  frequency: string,
  anchorStart: Date | null,
  skipWeekendsHolidays: boolean,
  monthlyAnchor: 'date' | 'weekday' = 'date'
): { nextStart: Date; nextDue: Date } {
  const nextStart = new Date(currentStart);
  const nextDue = new Date(currentDue);
  const duration = currentDue.getTime() - currentStart.getTime();

  // 1. Calculate Next Date based on Frequency
  switch (frequency) {
    case 'diaria': nextStart.setDate(nextStart.getDate() + 1); break;
    case 'semanal': nextStart.setDate(nextStart.getDate() + 7); break;
    case 'quinzenal': nextStart.setDate(nextStart.getDate() + 14); break;
    case 'mensal': nextStart.setMonth(nextStart.getMonth() + 1); break;
    default: nextStart.setDate(nextStart.getDate() + 1);
  }

  // 2. Apply Drift Correction (Anchoring)
  if (anchorStart) {
    if (frequency === 'mensal') {
      if (monthlyAnchor === 'weekday') {
        // "Same Day of Week" mode (e.g. 2nd Friday)
        const { nth, weekday } = getNthWeekdayOfMonth(anchorStart);
        const calculatedDate = getDateByNthWeekday(nextStart.getFullYear(), nextStart.getMonth(), nth, weekday);

        // Preserve time from anchor or current? Anchor time usually.
        calculatedDate.setHours(anchorStart.getHours(), anchorStart.getMinutes(), anchorStart.getSeconds(), anchorStart.getMilliseconds());
        nextStart.setTime(calculatedDate.getTime());

      } else {
        // "Same Date" mode (e.g. 15th) - Default
        const targetDay = anchorStart.getDate();
        const lastDayOfMonth = new Date(nextStart.getFullYear(), nextStart.getMonth() + 1, 0).getDate();

        // Handle end of month (e.g. 31st -> 30th/28th)
        nextStart.setDate(Math.min(targetDay, lastDayOfMonth));
      }
    } else if (frequency === 'semanal' || frequency === 'quinzenal') {
      // Always anchor to Day of Week for weekly/biweekly
      const anchorDay = anchorStart.getDay();
      const currentDay = nextStart.getDay();
      const diff = anchorDay - currentDay;
      if (diff !== 0) {
        nextStart.setDate(nextStart.getDate() + diff);
      }
    }
  }

  // 3. Apply "Move to Next Business Day" Logic
  if (skipWeekendsHolidays) {
    if (!isBusinessDay(nextStart)) {
      const shiftedStart = getNextBusinessDay(nextStart);
      nextStart.setTime(shiftedStart.getTime());
    }
  }

  // Calculate due date
  nextDue.setTime(nextStart.getTime() + duration);

  if (skipWeekendsHolidays) {
    if (!isBusinessDay(nextDue)) {
      const shiftedDue = getNextBusinessDay(nextDue);
      nextDue.setTime(shiftedDue.getTime());
    }
  }

  return { nextStart, nextDue };
}

async function taskInstanceExists(
  supabase: SupabaseClient,
  originalTaskId: string,
  nextStartDate: Date
): Promise<boolean> {
  const startOfDay = new Date(nextStartDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(nextStartDate);
  endOfDay.setHours(23, 59, 59, 999);

  const { data, error } = await supabase
    .from('tasks')
    .select('id')
    .eq('parent_task_id', originalTaskId)
    .gte('start_date', startOfDay.toISOString())
    .lte('start_date', endOfDay.toISOString())
    .limit(1);

  if (error) {
    console.error('Error checking existing task:', error);
    return true;
  }

  return data && data.length > 0;
}

async function createNextInstance(
  supabase: SupabaseClient,
  task: Task,
  nextStart: Date,
  nextDue: Date
): Promise<void> {
  console.log(`Creating next instance for task ${task.id}: ${task.title}`);

  const { data: newTask, error } = await supabase
    .from('tasks')
    .insert({
      title: task.title,
      description: task.description,
      unit_id: task.unit_id,
      sector_id: task.sector_id,
      assigned_to: task.assigned_to,
      created_by: task.created_by,
      start_date: nextStart.toISOString(),
      due_date: nextDue.toISOString(),
      priority: task.priority || 1,
      status: 'pendente',
      is_recurring: true,
      recurrence_frequency: task.recurrence_frequency,
      recurrence_mode: task.recurrence_mode,
      parent_task_id: task.parent_task_id || task.id,
      routine_id: task.routine_id,
    })
    .select('id')
    .single();

  if (error) {
    console.error(`Error creating recurring task instance:`, error);
    throw error;
  }

  const newTaskId = (newTask as { id: string }).id;

  // Copy task assignees
  const { data: assignees } = await supabase
    .from('task_assignees')
    .select('user_id')
    .eq('task_id', task.id);

  if (assignees && assignees.length > 0) {
    await supabase.from('task_assignees').insert(
      (assignees as { user_id: string }[]).map(a => ({
        task_id: newTaskId,
        user_id: a.user_id
      }))
    );
  }

  // Copy subtasks
  const { data: subtasks } = await supabase
    .from('subtasks')
    .select('title, assigned_to, order_index')
    .eq('task_id', task.id);

  if (subtasks && subtasks.length > 0) {
    await supabase.from('subtasks').insert(
      (subtasks as { title: string; assigned_to: string | null; order_index: number }[]).map(s => ({
        task_id: newTaskId,
        title: s.title,
        assigned_to: s.assigned_to,
        order_index: s.order_index,
        is_completed: false,
      }))
    );
  }

  // Recursion for Child Tasks
  const { data: childTasks } = await supabase
    .from('tasks')
    .select('id, title, description, unit_id, sector_id, assigned_to, priority, status')
    .eq('parent_task_id', task.id);

  if (childTasks && childTasks.length > 0) {
    for (const childTask of childTasks) {
      const { data: newChildTask, error: childError } = await supabase
        .from('tasks')
        .insert({
          title: childTask.title,
          description: childTask.description,
          unit_id: childTask.unit_id,
          sector_id: childTask.sector_id,
          assigned_to: childTask.assigned_to,
          created_by: task.created_by,
          start_date: nextStart.toISOString(),
          due_date: nextDue.toISOString(),
          priority: childTask.priority || 1,
          status: 'pendente',
          is_recurring: false,
          parent_task_id: newTaskId,
          routine_id: task.routine_id,
        })
        .select('id')
        .single();

      if (childError) continue;

      const newChildTaskId = newChildTask.id;

      const { data: childAssignees } = await supabase
        .from('task_assignees')
        .select('user_id')
        .eq('task_id', childTask.id);

      if (childAssignees && childAssignees.length > 0) {
        await supabase.from('task_assignees').insert(
          childAssignees.map(a => ({
            task_id: newChildTaskId,
            user_id: a.user_id
          }))
        );
      }
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const now = new Date(); // Use actual processing time

    let processedCount = 0;
    let createdCount = 0;

    // 1. Process "schedule" mode
    const { data: scheduleTasksRaw, error: scheduleError } = await supabase
      .from('tasks')
      .select('*, routine:routines(custom_schedule), parent_task:tasks!parent_task_id(start_date)')
      .eq('is_recurring', true)
      .eq('recurrence_mode', 'schedule')
      .in('status', ['pendente', 'em_andamento', 'concluida']) // Added 'concluida'
      .not('start_date', 'is', null)
      .not('due_date', 'is', null);

    if (scheduleError) throw scheduleError;

    const scheduleTasks = scheduleTasksRaw as unknown as Task[];

    for (const task of scheduleTasks || []) {
      processedCount++;
      const startDate = new Date(task.start_date!);
      const dueDate = new Date(task.due_date!);
      const skipWeekendsHolidays = task.routine?.custom_schedule?.skipWeekendsHolidays === true;
      const monthlyAnchor = task.routine?.custom_schedule?.monthlyAnchor || 'date';
      const anchorStart = task.parent_task?.start_date ? new Date(task.parent_task.start_date) : new Date(startDate);

      const { nextStart, nextDue } = getNextDates(
        startDate,
        dueDate,
        task.recurrence_frequency!,
        anchorStart,
        skipWeekendsHolidays,
        monthlyAnchor
      );

      const createThreshold = new Date(nextStart);
      createThreshold.setDate(createThreshold.getDate() - 1);
      createThreshold.setHours(23, 59, 59, 999);

      // Trigger condition:
      // 1. Time-based: Now is close to next start date
      // 2. Completion-based: Task is already completed (Create next immediately)
      const shouldCreate = (now >= createThreshold) || (task.status === 'concluida');

      if (shouldCreate) {
        const rootId = task.parent_task_id || task.id;
        const exists = await taskInstanceExists(supabase, rootId, nextStart);
        if (!exists) {
          await createNextInstance(supabase, task, nextStart, nextDue);
          createdCount++;
        }
      }
    }

    // 2. Process "on_completion" mode
    const { data: completedTasksRaw, error: completedError } = await supabase
      .from('tasks')
      .select('*, routine:routines(custom_schedule), parent_task:tasks!parent_task_id(start_date)')
      .eq('is_recurring', true)
      .eq('recurrence_mode', 'on_completion')
      .eq('status', 'concluida')
      .not('start_date', 'is', null)
      .not('due_date', 'is', null);

    if (completedError) throw completedError;

    const completedTasks = completedTasksRaw as unknown as Task[];
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    for (const task of completedTasks || []) {
      processedCount++;
      const startDate = new Date(task.start_date!);
      const dueDate = new Date(task.due_date!);
      const skipWeekendsHolidays = task.routine?.custom_schedule?.skipWeekendsHolidays === true;
      const duration = dueDate.getTime() - startDate.getTime();

      const { nextStart, nextDue } = getNextDates(
        today,
        new Date(today.getTime() + duration),
        task.recurrence_frequency!,
        null, // No anchor for on_completion
        skipWeekendsHolidays
      );

      const rootId = task.parent_task_id || task.id;
      const exists = await taskInstanceExists(supabase, rootId, nextStart);
      if (!exists) {
        await createNextInstance(supabase, task, nextStart, nextDue);
        createdCount++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: processedCount, created: createdCount }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
