const { createClient } = require('@supabase/supabase-js');

const url = "https://curyufedazpkhtxrwhkn.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1cnl1ZmVkYXpwa2h0eHJ3aGtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5NzU5NTIsImV4cCI6MjA4MjU1MTk1Mn0.DGKJPQBmLCTw5YyKwg7LfRQMseeVgXzljD5Z6lCESRs";

const supabase = createClient(url, key);

async function run() {
    const { data: unit, error } = await supabase.from('units').select('*').eq('id', '35c3ae18-8488-42ae-9f7f-f7d6ea9fa64a');
    console.log("Unit:", unit);

    const { data: task, error2 } = await supabase.from('tasks').select('id, title, due_date, unit_id, units(name)').eq('id', '76c4cbac-2104-4518-9b64-e4cb6545c4e7');
    console.log("Task:", task);
}
run();
