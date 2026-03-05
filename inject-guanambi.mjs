import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://curyufedazpkhtxrwhkn.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1cnl1ZmVkYXpwa2h0eHJ3aGtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5NzU5NTIsImV4cCI6MjA4MjU1MTk1Mn0.tXmEQD8jC5rPioA17Y1S2K6bWq971F2xYkU81T0EGE4";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function inject() {
    const { data: routines } = await supabase.from('routines').select('id, title').ilike('title', '%Disponibilidade%');
    const routine = routines[0];

    const { data: units } = await supabase.from('units').select('id, name').ilike('name', '%Guanambi%');
    const unit = units[0];

    // Let's get the active period that encompasses today's date
    const now = new Date().toISOString();

    // Find the exact task for Guanambi today
    const { data: tasks } = await supabase
        .from('tasks')
        .select('id, due_date')
        .eq('routine_id', routine.id)
        .eq('unit_id', unit.id)
        .order('created_at', { ascending: false })
        .limit(1);

    const dueDate = tasks[0].due_date;

    const { data: period } = await supabase
        .from('routine_periods')
        .select('id, period_start, period_end')
        .eq('routine_id', routine.id)
        .lte('period_start', dueDate)
        .gte('period_end', dueDate)
        .limit(1)
        .maybeSingle();

    if (!period) return console.log("No period found for task due date:", dueDate);

    // Find checkin
    const { data: checkin } = await supabase
        .from('routine_checkins')
        .select('id, notes')
        .eq('routine_period_id', period.id)
        .eq('unit_id', unit.id)
        .maybeSingle();

    if (!checkin) return console.log("No checkin found for Guanambi in period", period.id);

    console.log("Writing comment to checkin:", checkin.id);

    const { error } = await supabase
        .from('routine_checkins')
        .update({ notes: "TESTE VIA BANCO (NÃO DEVE SUMIR)" })
        .eq('id', checkin.id);

    if (error) console.error("Error writing:", error);
    else console.log("SUCCESS! Written 'TESTE VIA BANCO' to Guanambi.");
}

inject().catch(console.error);
