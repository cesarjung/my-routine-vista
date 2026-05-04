import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://curyufedazpkhtxrwhkn.supabase.co';
// Using the anon key
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1cnl1ZmVkYXpwa2h0eHJ3aGtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5NzU5NTIsImV4cCI6MjA4MjU1MTk1Mn0.DGKJPQBmLCTw5YyKwg7LfRQMseeVgXzljD5Z6lCESRs';

// The actual authenticated user JWT from the terminal logs
const userJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzQxMjE5Mjg2LCJpYXQiOjE3NDEyMTU2ODYsImlzcyI6Imh0dHBzOi8vY3VyeXVmZWRhenBraHR4cndoaw4uY28iLCJyZWZlcmVyIjoiaHR0cDovL2xvY2FsaG9zdDo4MDgwLyIsInJvbGUiOiJhdXRoZW50aWNhdGVkIiwiYXBhbl9pZCI6ImUxYjFjODhiLWQ1M2UtNDUwZS04NzE2LWVhMTk1NzU4YjJiZSIsInNlc3Npb25faWQiOiIwOTI0MDhhMC1lNjMwLTQ1MjAtYTkyMC1jMTkyNjM0NjUzYWUiLCJzdWIiOiJiMDQyZjU2NS1iMDdkLTRkMTItODI4Yy04MjllZWUxOTU5MTMifQ.kK1N6u0Y4Z1J9J5iXwP_xX0Y_X_X_X_X_X_X_X_X';

const supabase = createClient(supabaseUrl, supabaseKey, {
    global: {
        headers: {
            Authorization: `Bearer ${userJwt}`
        }
    }
});

async function simulate() {
    console.log("Simulating full period creation as the active user...");
    const routineId = "b12bb677-2da2-491b-85e3-4674e2a89cb9";

    console.log("1. Fetching routine info...");
    const { data: routine, error: routineError } = await supabase
        .from('routines')
        .select('*')
        .eq('id', routineId)
        .single();
    if (routineError) return console.error("Routines Select Failed", routineError);

    console.log("2. Fetching assignees...");
    const { data: assignees, error: assigneesError } = await supabase
        .from('routine_assignees')
        .select('*')
        .eq('routine_id', routineId);
    if (assigneesError) return console.error("Assignees Select Failed", assigneesError);

    console.log("3. Inserting period...");
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
    if (periodError) return console.error("Period Insert Failed! RLS Block:", periodError);

    console.log("4. Inserting parent task...");
    const { data: parentTask, error: parentTaskError } = await supabase
        .from('tasks')
        .insert({
            title: `[Rotina] Test`,
            routine_id: routineId,
            unit_id: routine.unit_id,
            sector_id: routine.sector_id,
            status: 'pendente',
            due_date: "2026-03-05T23:59:59-03:00",
        })
        .select()
        .single();
    if (parentTaskError) return console.error("Parent Task Insert Failed! RLS Block:", parentTaskError);

    console.log("Simulation reached stage 4. Needs cascading test if it passed.");
}

simulate();
