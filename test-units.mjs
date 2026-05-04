import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE config");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data: routines, error } = await supabase
        .from('routines')
        .select('id, title, frequency')
        .ilike('title', '%Faturamento%')
        .order('created_at', { ascending: false })
        .limit(2);

    if (error) {
        console.error('Error fetching routines:', error);
        return;
    }

    if (!routines || routines.length === 0) {
        console.log('No routines found');
        return;
    }

    for (const r of routines) {
        const { data: tasks, error: taskError } = await supabase
            .from('tasks')
            .select('id, unit_id')
            .eq('routine_id', r.id)
            .not('parent_task_id', 'is', null);

        if (taskError) {
            console.error('Error fetching tasks for routine', r.title, taskError);
            continue;
        }

        if (tasks && tasks.length > 0) {
            const units = [...new Set(tasks.map(t => t.unit_id))];
            console.log(r.title + ' -> ' + units.length + ' units generated tasks.');

            if (units.length > 0 && units[0] !== null) {
                const { data: unitData } = await supabase
                    .from('units')
                    .select('name')
                    .in('id', units.filter(Boolean));

                console.log('Units:', unitData?.map(u => u.name).join(', '));
            } else {
                console.log('Units array is null or empty');
            }
        } else {
            console.log(r.title + ' -> 0 units');
        }
    }
}

check();
