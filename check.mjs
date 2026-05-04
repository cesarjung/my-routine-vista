import { createClient } from 'npm:@supabase/supabase-js';

const SUPABASE_URL = "https://curyufedazpkhtxrwhkn.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1cnl1ZmVkYXpwa2h0eHJ3aGtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5NzU5NTIsImV4cCI6MjA4MjU1MTk1Mn0.DGKJPQBmLCTw5YyKwg7LfRQMseeVgXzljD5Z6lCESRs";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
    const { data, error } = await supabase
        .from('routines')
        .select('id, title, routine_periods(id, period_start, is_active)')
        .ilike('title', '%Check%Disponibilidade%')
        .limit(1);

    if (error) console.error(error);
    else {
        const routine = data[0];
        const periods = routine.routine_periods.filter(p => p.period_start.includes('2026-03'));
        console.log("Periods in March:", JSON.stringify(periods, null, 2));
    }
}
run();
