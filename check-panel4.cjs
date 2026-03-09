const { createClient } = require('@supabase/supabase-js');

const url = "https://curyufedazpkhtxrwhkn.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1cnl1ZmVkYXpwa2h0eHJ3aGtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5NzU5NTIsImV4cCI6MjA4MjU1MTk1Mn0.DGKJPQBmLCTw5YyKwg7LfRQMseeVgXzljD5Z6lCESRs";

const supabase = createClient(url, key);

async function dumpFilters() {
    const formatBound = (date, isEnd) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const time = isEnd ? '23:59:59' : '00:00:00';
        return `${year}-${month}-${day}T${time}-03:00`;
    };

    const now = new Date();
    const startUtcOffset = formatBound(now, false);
    const endUtcOffset = formatBound(now, true);

    console.log(`Bounds: ${startUtcOffset} -> ${endUtcOffset}`);

    let tasksQuery = supabase.from('tasks').select('id, title, status, unit_id, due_date, routine_id');

    // Add a dummy OR to see if it breaks chaining
    tasksQuery = tasksQuery.or(`title.in.("Boletim de Produtividade")`);

    tasksQuery = tasksQuery
        .gte('due_date', startUtcOffset)
        .lte('due_date', endUtcOffset);

    tasksQuery = tasksQuery.limit(20000);
    const { data: tasks, error } = await tasksQuery;

    if (error) console.error('Query error:', error);
    console.log('Final tasks length:', tasks?.length);
    if (tasks && tasks.length > 0) {
        console.log(tasks[0]);
    }
}
dumpFilters();
