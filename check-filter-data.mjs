import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data: routines, error } = await supabase
        .from('routines')
        .select(`
      id, title, sector_id,
      sector:sectors(name)
    `)
        .in('title', ['Checkpoint Diário', 'Boletim de Produtividade', 'Check de Disponibilidade']);

    console.log("ROUTINE SECTORS:");
    console.log(JSON.stringify(routines, null, 2));

    // Check why Livramento didn't generate for Check de Disponibilidade
    // Get Livramento unit id
    const { data: units } = await supabase.from('units').select('id, name').ilike('name', '%Livramento%');
    console.log("\nLIVRAMENTO UNIT ID:");
    console.log(units);

    if (units && units.length > 0 && routines) {
        const livramentoId = units[0].id;
        const checkRotina = routines.find(r => r.title === 'Check de Disponibilidade');

        if (checkRotina) {
            // Did Check de Disponibilidade assignees include Livramento?
            const { data: assignees } = await supabase
                .from('routine_assignees')
                .select('user_id, profiles!inner(unit_id)')
                .eq('routine_id', checkRotina.id)
                .eq('profiles.unit_id', livramentoId);

            console.log(`\nAssignees for Check de Disponibilidade in Livramento:`, assignees?.length || 0);
            console.log(assignees);
        }
    }
}

run();
