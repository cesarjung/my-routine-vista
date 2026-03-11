import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function main() {
    const { data: routines } = await supabaseAdmin.from('routines').select('id, title, is_active').limit(5);

    const routineIds = routines.map(r => r.id);

    const { data: activeTasks } = await supabaseAdmin
        .from('tasks')
        .select('routine_id, status')
        .in('routine_id', routineIds);

    console.log("Found active tasks:", activeTasks?.length);

    const tasksByRoutine = activeTasks.reduce((acc, task) => {
        if (!acc[task.routine_id]) acc[task.routine_id] = [];
        acc[task.routine_id].push(task.status);
        return acc;
    }, {});

    console.log("Tasks by routine:", tasksByRoutine);
}
main();
