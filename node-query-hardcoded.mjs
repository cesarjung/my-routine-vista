const SUPABASE_URL = "https://curyufedazpkhtxrwhkn.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1cnl1ZmVkYXpwa2h0eHJ3aGtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5NzU5NTIsImV4cCI6MjA4MjU1MTk1Mn0.DGKJPQBmLCTw5YyKwg7LfRQMseeVgXzljD5Z6lCESRs";

async function run() {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/tasks?title=ilike.*Check%20de%20Disponibilidade*&due_date=gte.2026-03-04T00:00:00&due_date=lt.2026-03-05T00:00:00&select=id,title,status,due_date,is_recurring,parent_task_id,routine_id,created_at&limit=1000`, {
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
        }
    });

    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
}

run();
