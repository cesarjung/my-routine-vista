const SUPABASE_URL = "https://curyufedazpkhtxrwhkn.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1cnl1ZmVkYXpwa2h0eHJ3aGtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5NzU5NTIsImV4cCI6MjA4MjU1MTk1Mn0.DGKJPQBmLCTw5YyKwg7LfRQMseeVgXzljD5Z6lCESRs";

async function run() {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/process_recurring_tasks`, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
        }
    });

    const text = await res.text();
    console.log('Status:', res.status);
    console.log('Response:', text);
}

run();
