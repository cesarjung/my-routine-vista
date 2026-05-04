async function run() {
    const apiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1cnl1ZmVkYXpwa2h0eHJ3aGtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5NzU5NTIsImV4cCI6MjA4MjU1MTk1Mn0.DGKJPQBmLCTw5YyKwg7LfRQMseeVgXzljD5Z6lCESRs";
    const url = "https://curyufedazpkhtxrwhkn.supabase.co";

    const authRes = await fetch(url + "/auth/v1/token?grant_type=password", {
        method: "POST",
        headers: { apikey: apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ email: "cesar.jung@sirtec.com.br", password: "123456" })
    });
    const token = (await authRes.json()).access_token;

    const tasksRes = await fetch(url + "/rest/v1/tasks?title=eq.[Rotina] Teste Diário Hoje&select=id,title,start_date,due_date,created_at,parent_task_id&order=created_at.desc&limit=50", {
        headers: { apikey: apiKey, Authorization: "Bearer " + token }
    });
    const data = await tasksRes.json();
    const fs = require('fs');
    fs.writeFileSync('tasks_out_all.json', JSON.stringify(data, null, 2));
}
run();
