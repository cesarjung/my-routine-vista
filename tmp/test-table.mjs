const headers = {
    "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1cnl1ZmVkYXpwa2h0eHJ3aGtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5NzU5NTIsImV4cCI6MjA4MjU1MTk1Mn0.DGKJPQBmLCTw5YyKwg7LfRQMseeVgXzljD5Z6lCESRs",
    "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1cnl1ZmVkYXpwa2h0eHJ3aGtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5NzU5NTIsImV4cCI6MjA4MjU1MTk1Mn0.DGKJPQBmLCTw5YyKwg7LfRQMseeVgXzljD5Z6lCESRs"
};

async function check() {
    try {
        const res = await fetch("https://curyufedazpkhtxrwhkn.supabase.co/rest/v1/routine_assignees?select=*", { headers });
        console.log("routine_assignees Status:", res.status);
        const text = await res.text();
        console.log("Response:", text.substring(0, 100));
    } catch (e) { console.error("Error 1", e); }

    try {
        const res2 = await fetch("https://curyufedazpkhtxrwhkn.supabase.co/rest/v1/routine_checkins?select=*", { headers });
        console.log("routine_checkins Status:", res2.status);
        const text2 = await res2.text();
        console.log("Response 2:", text2.substring(0, 100));
    } catch (e) { console.error("Error 2", e); }
}

check();
