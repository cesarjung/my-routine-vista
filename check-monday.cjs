const { createClient } = require('@supabase/supabase-js');

const url = "https://curyufedazpkhtxrwhkn.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1cnl1ZmVkYXpwa2h0eHJ3aGtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5NzU5NTIsImV4cCI6MjA4MjU1MTk1Mn0.DGKJPQBmLCTw5YyKwg7LfRQMseeVgXzljD5Z6lCESRs";

const supabase = createClient(url, key);

async function dumpFilters() {
    let tasksQuery = supabase.from('tasks').select('id, title, status, unit_id, due_date, routine_id');

    // Filter for Monday, March 9th local Brazil time
    tasksQuery = tasksQuery
        .gte('due_date', '2026-03-09T00:00:00-03:00')
        .lte('due_date', '2026-03-09T23:59:59-03:00')
        .eq('unit_id', '35c3ae18-8488-42ae-9f7f-f7d6ea9fa64a'); // Barreiras

    tasksQuery = tasksQuery.limit(50);
    const { data: tasks, error } = await tasksQuery;

    if (error) console.error('Query error:', error);
    console.log('Final Barreiras tasks length for MONDAY:', tasks?.length);
    if (tasks && tasks.length > 0) {
        tasks.forEach(t => {
            console.log(`Title: ${t.title} | Due: ${t.due_date} | Routine: ${t.routine_id} | Status: ${t.status}`);
        });
    }
}
dumpFilters();
