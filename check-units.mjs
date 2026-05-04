import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = urlMatch[1].trim();
const supabaseKey = keyMatch[1].trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data: routines, error } = await supabase
        .from('routines')
        .select('id, title, frequency')
        .order('created_at', { ascending: false })
        .limit(2);

    if (error) {
        console.error('Error fetching routines:', error);
        return;
    }

    if (!routines) {
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

            const { data: unitData } = await supabase
                .from('units')
                .select('name')
                .in('id', units);

            console.log('Units:', unitData.map(u => u.name).join(', '));
        } else {
            console.log(r.title + ' -> 0 units');
        }
    }
}

check();
