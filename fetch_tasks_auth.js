async function run() {
    const url = "https://curyufedazpkhtxrwhkn.supabase.co";
    const apiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1cnl1ZmVkYXpwa2h0eHJ3aGtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5NzU5NTIsImV4cCI6MjA4MjU1MTk1Mn0.DGKJPQBmLCTw5YyKwg7LfRQMseeVgXzljD5Z6lCESRs";

    // Login
    const authRes = await fetch(`${url}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: {
            "apikey": apiKey,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            email: "cesar.jung@sirtec.com.br",
            password: "123456"
        })
    });

    if (!authRes.ok) {
        console.error("Login failed:", await authRes.text());
        return;
    }

    const authData = await authRes.json();
    const token = authData.access_token;

    console.log("Login success! Fetching tasks...");

    // Fetch tasks
    const tasksRes = await fetch(`${url}/rest/v1/tasks?title=ilike.*Teste*&select=id,title,start_date,due_date,created_at,parent_task_id&order=created_at.desc&limit=10`, {
        headers: {
            "apikey": apiKey,
            "Authorization": `Bearer ${token}`
        }
    });

    const tasksData = await tasksRes.json();
    console.log(JSON.stringify(tasksData, null, 2));
}

run();
