const SUPABASE_URL = "https://curyufedazpkhtxrwhkn.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1cnl1ZmVkYXpwa2h0eHJ3aGtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5NzU5NTIsImV4cCI6MjA4MjU1MTk1Mn0.tXmEQD8jC5rPioA17Y1S2K6bWq971F2xYkU81T0EGE4";

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkPeriods() {
    const { data: routines } = await supabase.from('routines').select('id, title').ilike('title', '%Check%Disponibilidade%');
    const routine = routines[0];

    console.log(`Routine: ${routine.title} ID: ${routine.id}`);

    // This is what TrackerPanel passes when clicking today's checkbox for Check de Disponibilidade:
    // Usually the task's due_date is set to the end of the day or midnight. Let's trace it.
    const { data: tasks } = await supabase
        .from('tasks')
        .select('id, due_date')
        .eq('routine_id', routine.id)
        .gte('due_date', '2026-03-04T00:00:00Z')
        .lte('due_date', '2026-03-04T23:59:59Z')
        .limit(1);

    if (tasks.length === 0) return console.log('Tasks not found');
    const taskDueDate = tasks[0].due_date;
    console.log(`Task due_date raw from DB: ${taskDueDate}`);

    // Now simulate useCurrentPeriodCheckins logic EXACTLY as TasksHoverCard does:
    let { data: period, error: periodError } = await supabase
        .from('routine_periods')
        .select('id, period_start, period_end')
        .eq('routine_id', routine.id)
        .lte('period_start', taskDueDate)
        .gte('period_end', taskDueDate)
        .order('period_start', { ascending: false })
        .limit(1)
        .maybeSingle();

    console.log(`Matched Period:`, period);

    if (period) {
        const { data: checkins } = await supabase.from('routine_checkins').select('id, notes, unit_id').eq('routine_period_id', period.id);
        console.log(`Period Checkins: ${checkins.length}, Has Notes: ${checkins.some(c => c.notes)}`);
    }
}
checkPeriods();
