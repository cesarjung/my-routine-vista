const headers = {
    "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1cnl1ZmVkYXpwa2h0eHJ3aGtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5NzU5NTIsImV4cCI6MjA4MjU1MTk1Mn0.DGKJPQBmLCTw5YyKwg7LfRQMseeVgXzljD5Z6lCESRs",
    "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1cnl1ZmVkYXpwa2h0eHJ3aGtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5NzU5NTIsImV4cCI6MjA4MjU1MTk1Mn0.DGKJPQBmLCTw5YyKwg7LfRQMseeVgXzljD5Z6lCESRs"
};

async function check() {
    const url1 = "https://curyufedazpkhtxrwhkn.supabase.co/rest/v1/routines?select=id,title";
    const res1 = await fetch(url1, { headers });
    const routines = await res1.json();

    for (const r of routines) {
        const url2 = `https://curyufedazpkhtxrwhkn.supabase.co/rest/v1/routine_assignees?routine_id=eq.${r.id}&select=user_id`;
        const res2 = await fetch(url2, { headers });
        const assignees = await res2.json();
        console.log(`Routine: "${r.title}" -> Assignees: ${assignees.length}`);
    }
}

check().catch(console.error);
