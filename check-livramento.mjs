import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    const { data, error } = await supabase
        .from('routines')
        .select('id, title, routine_periods(id, period_start, period_end, is_active)')
        .ilike('title', '%Check%Disponibilidade%')
        .limit(1);

    if (error) {
        console.error(error);
        return;
    }

    const routine = data[0];
    if (!routine) {
        console.log("Routine not found");
        return;
    }

    console.log("Routine:", routine.title);
    const periods = routine.routine_periods.sort((a, b) => new Date(b.period_start).getTime() - new Date(a.period_start).getTime());

    console.log("\nTop 5 Most Recent Periods (DB RAW):");
    periods.slice(0, 5).forEach(p => {
        console.log(`- ${p.period_start} (Active: ${p.is_active}) ID: ${p.id}`);
    });
}

checkData();
