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
}

// Calculate next occurrence based on frequency
function getNextDates(startDate: Date, dueDate: Date, frequency: string): { nextStart: Date; nextDue: Date } {
  const nextStart = new Date(startDate);
  const nextDue = new Date(dueDate);

  const duration = dueDate.getTime() - startDate.getTime();

  switch (frequency) {
    case 'diaria':
      nextStart.setDate(nextStart.getDate() + 1);
      break;
    case 'semanal':
      nextStart.setDate(nextStart.getDate() + 7);
      break;
    case 'quinzenal':
      nextStart.setDate(nextStart.getDate() + 14);
      break;
    case 'mensal':
      nextStart.setMonth(nextStart.getMonth() + 1);
      break;
    default:
      nextStart.setDate(nextStart.getDate() + 1);
  }

  // Calculate due date maintaining the same duration
  nextDue.setTime(nextStart.getTime() + duration);

  return { nextStart, nextDue };
}

// Check if a task instance already exists for the given date
async function taskInstanceExists(
  supabase: SupabaseClient,
  originalTaskId: string,
  nextStartDate: Date
): Promise<boolean> {
  const startOfDay = new Date(nextStartDate);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(nextStartDate);
  endOfDay.setHours(23, 59, 59, 999);

  // Check if there's already a task with the same parent_task_id for this date range
  const { data, error } = await supabase
    .from('tasks')
    .select('id')
    .eq('parent_task_id', originalTaskId)
    .gte('start_date', startOfDay.toISOString())
    .lte('start_date', endOfDay.toISOString())
    .limit(1);

  if (error) {
    console.error('Error checking existing task:', error);
    return true; // Assume exists to prevent duplicates
  }

  return data && data.length > 0;
}

// Create next recurring task instance
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
      parent_task_id: task.parent_task_id || task.id, // Keep reference to original
    })
    .select('id')
    .single();

  if (error) {
    console.error(`Error creating recurring task instance:`, error);
    throw error;
  }

  const newTaskId = (newTask as { id: string }).id;
  console.log(`Created new task instance: ${newTaskId}`);

  // Copy task assignees
  const { data: assignees } = await supabase
    .from('task_assignees')
    .select('user_id')
    .eq('task_id', task.id);

  if (assignees && assignees.length > 0) {
    const assigneeInserts = (assignees as { user_id: string }[]).map(a => ({
      task_id: newTaskId,
      user_id: a.user_id
    }));
    await supabase.from('task_assignees').insert(assigneeInserts);
  }

  // Copy subtasks
  const { data: subtasks } = await supabase
    .from('subtasks')
    .select('title, assigned_to, order_index')
    .eq('task_id', task.id);

  if (subtasks && subtasks.length > 0) {
    const subtaskInserts = (subtasks as { title: string; assigned_to: string | null; order_index: number }[]).map(s => ({
      task_id: newTaskId,
      title: s.title,
      assigned_to: s.assigned_to,
      order_index: s.order_index,
      is_completed: false,
    }));
    await supabase.from('subtasks').insert(subtaskInserts);
  }

  // --- RECURSION FOR CHILD TASKS (Unit Tasks in Routines) ---
  const { data: childTasks } = await supabase
    .from('tasks')
    .select('id, title, description, unit_id, sector_id, assigned_to, priority, status')
    .eq('parent_task_id', task.id);

  if (childTasks && childTasks.length > 0) {
    console.log(`Found ${childTasks.length} child tasks to recur...`);

    for (const childTask of childTasks) {
      // Create new Child Task linked to NEW Parent
      const { data: newChildTask, error: childError } = await supabase
        .from('tasks')
        .insert({
          title: childTask.title,
          description: childTask.description,
          unit_id: childTask.unit_id,
          sector_id: childTask.sector_id,
          assigned_to: childTask.assigned_to, // SNAPSHOT: Persist the Manual Assignment from Last Period!
          created_by: task.created_by, // Keep original creator context
          start_date: nextStart.toISOString(),
          due_date: nextDue.toISOString(),
          priority: childTask.priority || 1,
          status: 'pendente',
          is_recurring: false, // Child tasks don't recur independently, they follow Parent
          parent_task_id: newTaskId, // Link to NEW Parent
        })
        .select('id')
        .single();

      if (childError) {
        console.error(`Error creating recurring child task:`, childError);
        continue;
      }

      const newChildTaskId = newChildTask.id;

      // Copy Child Task Assignees (Multi-assignees)
      const { data: childAssignees } = await supabase
        .from('task_assignees')
        .select('user_id')
        .eq('task_id', childTask.id);

      if (childAssignees && childAssignees.length > 0) {
        const childAssigneeInserts = childAssignees.map(a => ({
          task_id: newChildTaskId,
          user_id: a.user_id
        }));
        await supabase.from('task_assignees').insert(childAssigneeInserts);
      }
    }
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Processing recurring tasks...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let processedCount = 0;
    let createdCount = 0;

    // 1. Process "schedule" mode tasks
    // Find recurring tasks where the next occurrence should be created (one day before due date)
    console.log('Processing schedule mode tasks...');

    const { data: scheduleTasks, error: scheduleError } = await supabase
      .from('tasks')
      .select('*')
      .eq('is_recurring', true)
      .eq('recurrence_mode', 'schedule')
      .in('status', ['pendente', 'em_andamento'])
      .not('start_date', 'is', null)
      .not('due_date', 'is', null);

    if (scheduleError) {
      console.error('Error fetching schedule tasks:', scheduleError);
      throw scheduleError;
    }

    console.log(`Found ${scheduleTasks?.length || 0} schedule mode recurring tasks`);

    for (const task of (scheduleTasks as Task[]) || []) {
      processedCount++;

      const startDate = new Date(task.start_date!);
      const dueDate = new Date(task.due_date!);

      // Calculate next occurrence
      const { nextStart, nextDue } = getNextDates(startDate, dueDate, task.recurrence_frequency!);

      // For schedule mode, create next task one day before the next start date
      const createThreshold = new Date(nextStart);
      createThreshold.setDate(createThreshold.getDate() - 1);
      createThreshold.setHours(23, 59, 59, 999);

      // If we're past the threshold, check if instance exists and create if not
      if (now >= createThreshold) {
        const exists = await taskInstanceExists(supabase, task.parent_task_id || task.id, nextStart);

        if (!exists) {
          await createNextInstance(supabase, task, nextStart, nextDue);
          createdCount++;
        }
      }
    }

    // 2. Process "on_completion" mode tasks
    console.log('Processing on_completion mode tasks...');

    const { data: completedTasks, error: completedError } = await supabase
      .from('tasks')
      .select('*')
      .eq('is_recurring', true)
      .eq('recurrence_mode', 'on_completion')
      .eq('status', 'concluida')
      .not('start_date', 'is', null)
      .not('due_date', 'is', null);

    if (completedError) {
      console.error('Error fetching completed tasks:', completedError);
      throw completedError;
    }

    console.log(`Found ${completedTasks?.length || 0} on_completion mode completed tasks`);

    for (const task of (completedTasks as Task[]) || []) {
      processedCount++;

      const startDate = new Date(task.start_date!);
      const dueDate = new Date(task.due_date!);

      // Calculate next occurrence starting from today/tomorrow
      const { nextStart, nextDue } = getNextDates(today, new Date(today.getTime() + (dueDate.getTime() - startDate.getTime())), task.recurrence_frequency!);

      // Check if next instance exists
      const exists = await taskInstanceExists(supabase, task.parent_task_id || task.id, nextStart);

      if (!exists) {
        await createNextInstance(supabase, task, nextStart, nextDue);
        createdCount++;
      }
    }

    console.log(`Processed ${processedCount} tasks, created ${createdCount} new instances`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedCount,
        created: createdCount,
        timestamp: now.toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    const error = err as Error;
    console.error('Error processing recurring tasks:', error);

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
