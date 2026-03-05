import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://curyufedazpkhtxrwhkn.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1cnl1ZmVkYXpwa2h0eHJ3aGtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5NzU5NTIsImV4cCI6MjA4MjU1MTk1Mn0.tXmEQD8jC5rPioA17Y1S2K6bWq971F2xYkU81T0EGE4";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function check() {
    const { data: routines } = await supabase.from('routines').select('id, title').ilike('title', '%Disponibilidade%');
    if (!routines || routines.length === 0) return console.log("No routines found");
    const routine = routines[0];
    console.log("Routine:", routine.title, routine.id);

    const { data: units } = await supabase.from('units').select('id, name').ilike('name', '%Guanambi%');
    const unit = units[0];
    console.log("Unit:", unit.name, unit.id);

    // Find the exact task for Guanambi today
    const { data: tasks } = await supabase
        .from('tasks')
        .select('id, due_date, status, parent_task_id')
        .eq('routine_id', routine.id)
        .eq('unit_id', unit.id)
        .order('created_at', { ascending: false })
        .limit(3);

    console.log("\nTasks for Guanambi:", JSON.stringify(tasks, null, 2));

    // If there's a parent task, let's see ALL its children to see if Barreiras is there
    if (tasks && tasks[0] && tasks[0].parent_task_id) {
        const { data: siblings } = await supabase.from('tasks').select('id, unit:units(name), due_date, status').eq('parent_task_id', tasks[0].parent_task_id);
        console.log("\nSiblings (Tasks under same parent):", JSON.stringify(siblings, null, 2));
    }

    // Find recent checkins for this routine + unit
    const { data: checkins } = await supabase
        .from('routine_checkins')
        .select('id, notes, status, routine_period_id, routine_periods(period_start, period_end)')
        .eq('unit_id', unit.id)
        .order('created_at', { ascending: false })
        .limit(5);

    console.log("\nRecent Checkins for Guanambi:");
    console.log(JSON.stringify(checkins, null, 2));
}

check().catch(console.error);
