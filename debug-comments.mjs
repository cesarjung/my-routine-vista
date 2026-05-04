const SUPABASE_URL = "https://curyufedazpkhtxrwhkn.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1cnl1ZmVkYXpwa2h0eHJ3aGtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5NzU5NTIsImV4cCI6MjA4MjU1MTk1Mn0.tXmEQD8jC5rPioA17Y1S2K6bWq971F2xYkU81T0EGE4";

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function debug() {
    const { data: routines } = await supabase.from('routines').select('id, title');

    const routine = routines.find(r => r.title.includes('Disponibilidade') || r.title.includes('Check'));
    if (!routine) {
        console.log('Routines:', routines.map(r => r.title));
        return;
    }

    console.log(`Routine found: ${routine.title} (${routine.id})`);
    const routineId = routine.id;

    const { data: period } = await supabase
        .from('routine_periods')
        .select('*')
        .eq('routine_id', routineId)
        .eq('is_active', true)
        .order('period_start', { ascending: false })
        .limit(1)
        .single();

    if (!period) {
        console.log('Active period not found');
        return;
    }

    console.log(`Period found: ${period.id} (${period.period_start})`);

    const { data: checkins } = await supabase
        .from('routine_checkins')
        .select('id, unit_id, notes, status, assignee_user_id')
        .eq('routine_period_id', period.id);

    console.log(`Checkins found for period: ${checkins.length}`);
    const hasNotes = checkins.filter(c => c.notes);
    console.log(`Checkins with notes: \n`, hasNotes);

    const { data: tasks } = await supabase
        .from('tasks')
        .select('id, title, status, unit_id, due_date')
        .eq('routine_id', routineId)
        .gte('due_date', '2026-03-04T00:00:00Z')
        .lte('due_date', '2026-03-04T23:59:59Z')
        .is('parent_task_id', null);

    if (tasks && tasks.length > 0) {
        const parentTask = tasks[0];
        console.log(`Parent Task: ${parentTask.id}`);

        const { data: childTasks } = await supabase
            .from('tasks')
            .select('id, title, status, unit_id')
            .eq('parent_task_id', parentTask.id);

        console.log(`Child tasks: ${childTasks.length}`);
        const t = childTasks.find(c => c.unit_id === hasNotes[0]?.unit_id);
        console.log("Matching child task for first checkin with note: ", t);
    }
}

debug();
