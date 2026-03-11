import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data, error } = await supabase
        .from('routines')
        .select('id, title, routine_periods(id, period_start, period_end, is_active)')
        .ilike('title', '%Check de Disponibilidade%')
        .limit(1);

    if (error) console.error(error);
    else {
        const routine = data[0];
        if (!routine) return console.log("Routine not found");
        console.log("Routine:", routine.title);

        // Sort periods by date descending
        const periods = routine.routine_periods.sort((a, b) => new Date(b.period_start).getTime() - new Date(a.period_start).getTime());

        console.log("Total periods:", periods.length);
        console.log("Most recent 5 periods:");
        console.log(JSON.stringify(periods.slice(0, 5), null, 2));

        const today = new Date().toISOString().substring(0, 10);
        const todayPeriod = periods.find(p => p.period_start === today);
        console.log("\nPeriod for today (" + today + "):", todayPeriod || "NOT FOUND");
    }
}

check();
