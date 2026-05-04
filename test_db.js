const url = process.env.VITE_SUPABASE_URL + "/rest/v1/tasks?title=ilike.*Teste%20Di%C3%A1rio%20Hoje*&select=id,title,start_date,due_date,parent_task_id,routine_id,is_recurring,recurrence_mode,recurrence_frequency,status,created_at,unit_id";
fetch(url, {
    headers: {
        "apikey": process.env.VITE_SUPABASE_ANON_KEY,
        "Authorization": "Bearer " + process.env.VITE_SUPABASE_ANON_KEY
    }
})
    .then(r => r.json())
    .then(data => console.log(JSON.stringify(data, null, 2)))
    .catch(console.error);
