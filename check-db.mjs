const url = "https://curyufedazpkhtxrwhkn.supabase.co/rest/v1/routine_checkins?select=id,routine_period_id,notes,created_at,routine_periods(id,period_start),unit_id&notes=not.is.null&order=created_at.desc&limit=20";
const headers = {
    "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1cnl1ZmVkYXpwa2h0eHJ3aGtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5NzU5NTIsImV4cCI6MjA4MjU1MTk1Mn0.DGKJPQBmLCTw5YyKwg7LfRQMseeVgXzljD5Z6lCESRs",
    "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1cnl1ZmVkYXpwa2h0eHJ3aGtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5NzU5NTIsImV4cCI6MjA4MjU1MTk1Mn0.DGKJPQBmLCTw5YyKwg7LfRQMseeVgXzljD5Z6lCESRs"
};

fetch(url, { headers })
    .then(res => res.json())
    .then(data => {
        console.log("Total comments found:", data.length);
        data.forEach(d => {
            console.log(`\nNote: "${d.notes}"`);
            console.log(`Created: ${new Date(d.created_at).toLocaleString()}`);
            console.log(`Period ID: ${d.routine_period_id}`);
            if (d.routine_periods) {
                console.log(`Period Start: ${new Date(d.routine_periods.period_start).toLocaleString()}`);
            }
        });
    })
    .catch(console.error);
