import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://curyufedazpkhtxrwhkn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1cnl1ZmVkYXpwa2h0eHJ3aGtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5NzU5NTIsImV4cCI6MjA4MjU1MTk1Mn0.DGKJPQBmLCTw5YyKwg7LfRQMseeVgXzljD5Z6lCESRs';
const supabase = createClient(supabaseUrl, supabaseKey);

async function simulateCreatePeriod() {
    console.log("Starting full trace simulation...");
    const routineId = "b12bb677-2da2-491b-85e3-4674e2a89cb9";

    const { data: period, error: periodError } = await supabase
        .from('routine_periods')
        .insert({
            routine_id: routineId,
            period_start: "2026-03-05T00:00:00-03:00",
            period_end: "2026-03-05T23:59:59-03:00",
            is_active: true,
        })
        .select()
        .single();

    if (periodError) {
        process.stdout.write("ERROR_START\n");
        process.stdout.write(periodError.message + "\n");
        process.stdout.write(periodError.details + "\n");
        process.stdout.write(periodError.hint + "\n");
        process.stdout.write(periodError.code + "\n");
        process.stdout.write("ERROR_END\n");
    } else {
        console.log("SUCCESS!", period.id);
    }
}

simulateCreatePeriod();
