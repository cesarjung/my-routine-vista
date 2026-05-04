const { createClient } = require('@supabase/supabase-js');

const url = "https://curyufedazpkhtxrwhkn.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1cnl1ZmVkYXpwa2h0eHJ3aGtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5NzU5NTIsImV4cCI6MjA4MjU1MTk1Mn0.DGKJPQBmLCTw5YyKwg7LfRQMseeVgXzljD5Z6lCESRs";

const supabase = createClient(url, key);

async function dumpFilters() {
    // Query ALL tasks without ANY due_date filters
    let tasksQuery = supabase.from('tasks').select('id, title, status, unit_id, due_date, routine_id, units!inner(name)');

    // Just filter for Barreiras to avoid downloading 100k tasks
    tasksQuery = tasksQuery.eq('units.name', 'Barreiras');

    tasksQuery = tasksQuery.limit(50);
    const { data: tasks, error } = await tasksQuery;

    if (error) console.error('Query error:', error);
    console.log('Final Barreiras tasks length:', tasks?.length);
    if (tasks && tasks.length > 0) {
        tasks.slice(0, 15).forEach(t => {
            console.log(`Title: ${t.title} | Due: ${t.due_date}`);
        });
    }
}
dumpFilters();
