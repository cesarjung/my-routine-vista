const SUPABASE_URL = "https://curyufedazpkhtxrwhkn.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1cnl1ZmVkYXpwa2h0eHJ3aGtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5NzU5NTIsImV4cCI6MjA4MjU1MTk1Mn0.DGKJPQBmLCTw5YyKwg7LfRQMseeVgXzljD5Z6lCESRs";

async function run() {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/tasks?is_recurring=eq.true&parent_task_id=is.null&select=id,title,start_date,due_date`, {
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
        }
    });

    const data = await res.json();
    console.log('Parent recurring tasks count:', data.length);
    if (data.length > 0) {
        console.log(JSON.stringify(data.slice(0, 3), null, 2));
    }
}

run();
