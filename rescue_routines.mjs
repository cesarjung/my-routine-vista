import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const env = fs.readFileSync('.env', 'utf-8');
const urlMatch = env.match(/VITE_SUPABASE_URL="?(.*?)"?(?:\r?\n|$)/);
const keyMatch = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY="?(.*?)"?(?:\r?\n|$)/);

const SUPABASE_URL = urlMatch[1].trim();
const SUPABASE_KEY = keyMatch[1].trim();

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
    console.log("Fetching all active routines...");
    const { data: routines, error: routinesError } = await supabase
        .from('routines')
        .select(`
      id, title, description, frequency, recurrence_mode, created_by, sector_id,
      routine_assignees(user_id)
    `)
        .eq('is_active', true);

    if (routinesError) throw routinesError;

    console.log(`Found ${routines.length} active routines.`);

    const todayStart = new Date('2026-03-04T00:00:00.000-03:00');
    const todayEnd = new Date('2026-03-04T23:59:59.999-03:00');

    for (const r of routines) {
        // Check if a parent task already exists
        const { data: existingParents } = await supabase
            .from('tasks')
            .select('id')
            .eq('routine_id', r.id)
            .is('parent_task_id', null)
            .eq('is_recurring', true);

        if (existingParents && existingParents.length > 0) {
            console.log(`Routine ${r.title} already has a parent task. Skipping.`);
            continue;
        }

        console.log(`Recreating root task for ${r.title}...`);

        // Create Root Task
        const { data: parentTask, error: parentErr } = await supabase
            .from('tasks')
            .insert({
                title: `[Rotina] ${r.title}`,
                description: r.description || `Rotina ${r.frequency}: ${r.title}`,
                routine_id: r.id,
                sector_id: r.sector_id,
                created_by: r.created_by,
                start_date: todayStart.toISOString(),
                due_date: todayEnd.toISOString(),
                status: 'pendente',
                priority: 2,
                parent_task_id: null,
                is_recurring: true,
                recurrence_frequency: r.frequency,
                recurrence_mode: r.recurrence_mode || 'schedule'
            })
            .select().single();

        if (parentErr) {
            console.error('Error creating parent:', parentErr);
            continue;
        }

        // Restore assignees for parent
        const assignees = r.routine_assignees.map(a => a.user_id);
        if (assignees.length > 0) {
            await supabase.from('task_assignees').insert(
                assignees.map(uId => ({ task_id: parentTask.id, user_id: uId }))
            );
        }

        // Find the routine_period for today to get units
        const { data: periods } = await supabase
            .from('routine_periods')
            .select('id, routine_checkins(unit_id, assignee_user_id)')
            .eq('routine_id', r.id)
            .eq('is_active', true)
            .gte('period_end', todayStart.toISOString())
            .lte('period_start', todayEnd.toISOString());

        if (periods && periods.length > 0) {
            const activePeriod = periods[0];
            const checkins = activePeriod.routine_checkins || [];

            console.log(`  Found ${checkins.length} checkins for today. Recreating child tasks...`);

            for (const checkin of checkins) {
                const { data: childTask, error: childErr } = await supabase
                    .from('tasks')
                    .insert({
                        title: `[Rotina] ${r.title}`,
                        description: r.description || `Rotina ${r.frequency}: ${r.title}`,
                        unit_id: checkin.unit_id,
                        sector_id: r.sector_id,
                        routine_id: r.id,
                        assigned_to: checkin.assignee_user_id || assignees[0] || null,
                        created_by: r.created_by,
                        start_date: todayStart.toISOString(),
                        due_date: todayEnd.toISOString(),
                        status: 'pendente',
                        priority: 2,
                        parent_task_id: parentTask.id,
                        is_recurring: false
                    })
                    .select().single();

                if (childErr) {
                    console.error('  Error creating child:', childErr);
                    continue;
                }

                // Child assignees
                if (checkin.assignee_user_id) {
                    await supabase.from('task_assignees').insert({ task_id: childTask.id, user_id: checkin.assignee_user_id });
                } else if (assignees.length > 0) {
                    await supabase.from('task_assignees').insert(
                        assignees.map(uId => ({ task_id: childTask.id, user_id: uId }))
                    );
                }
            }
        } else {
            console.log(`  No active periods found for today for ${r.title}`);
        }
    }
    console.log("Recovery complete!");
}

run();
