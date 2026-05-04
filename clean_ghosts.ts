import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://curyufedazpkhtxrwhkn.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1cnl1ZmVkYXpwa2h0eHJ3aGtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5NzU5NTIsImV4cCI6MjA4MjU1MTk1Mn0.DGKJPQBmLCTw5YyKwg7LfRQMseeVgXzljD5Z6lCESRs'
const supabase = createClient(supabaseUrl, supabaseKey)

async function cleanGhosts() {
    console.log('Searching for "teste com anexos" tasks...');

    const { data: tasks, error } = await supabase
        .from('tasks')
        .select('id, title, start_date, parent_task_id, status')
        .ilike('title', '%teste com anexos%')
        .order('start_date', { ascending: true });

    if (error) {
        console.error('Error fetching:', error);
        return;
    }

    console.log(`Found ${tasks?.length} tasks.`);
    if (tasks) {
        tasks.forEach(t => console.log(`${t.start_date} - ${t.status} - ID: ${t.id} - Parent: ${t.parent_task_id}`));

        const ids = tasks.map(t => t.id);
        if (ids.length > 0) {
            console.log('Deleting all...');
            const { error: delError } = await supabase
                .from('tasks')
                .delete()
                .in('id', ids);

            if (delError) console.error('Delete failed:', delError);
            else console.log('Deleted successfully.');
        }
    }
}

cleanGhosts();
