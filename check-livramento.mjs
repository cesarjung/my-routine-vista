import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    // Query 1: Settors for routines
    const { data: routines } = await supabase
        .from('routines')
        .select('id, title, sector_id, sector:sectors(name)')
        .in('title', ['Checkpoint Diário', 'Boletim de Produtividade', 'Check de Disponibilidade']);

    console.log("ROTINAS E SEUS SETORES:");
    console.log(JSON.stringify(routines, null, 2));

    // Query 2: Livramento Unit ID
    const { data: units } = await supabase.from('units').select('id, name').ilike('name', '%Livramento%');
    console.log("\nLIVRAMENTO UNIT ID:", units);

    if (units && units.length > 0 && routines) {
        const livramentoId = units[0].id;
        const checkRotina = routines.find(r => r.title === 'Check de Disponibilidade');

        if (checkRotina) {
            // Did Check de Disponibilidade assignees include Livramento?
            const { data: assignees } = await supabase
                .from('routine_assignees')
                .select('user_id, profiles(unit_id, full_name)')
                .eq('routine_id', checkRotina.id);

            const livramentoAssignees = assignees?.filter(a => (a.profiles as any)?.unit_id === livramentoId);

            console.log(`\nTODOS Assignees de Check de Disponibilidade:`, assignees?.length || 0);
            console.log(`Assignees de LIVRAMENTO para essa rotina:`, livramentoAssignees?.length || 0);
            console.log(livramentoAssignees);
        }
    }
}

run();
