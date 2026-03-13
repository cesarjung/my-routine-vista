// Temporary file to query raw counts via Supabase in the console if needed.
import { supabase } from './src/integrations/supabase/client';

async function testMemory() {
    console.log("Fetching all tasks...");
    const start = performance.now();

    // Simulate what the admin or regular user fetches
    const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          routine:routines(*),
          unit:units(*),
          subtasks(*)
        `)
        .order('due_date', { ascending: true });

    const end = performance.now();
    console.log(`Fetched ${data?.length} tasks in ${end - start}ms`);

    // Check sizes
    const jsonString = JSON.stringify(data);
    const sizeInMB = (new Blob([jsonString]).size / (1024 * 1024)).toFixed(2);
    console.log(`Approximate payload size: ${sizeInMB} MB`);
}

testMemory();
