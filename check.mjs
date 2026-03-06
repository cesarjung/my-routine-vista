import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data: routines } = await supabase
        .from('routines')
        .select('id, title, sector_id, sector:sectors(id, name)')
        .in('title', ['Checkpoint Diário', 'Boletim de Produtividade', 'Check de Disponibilidade']);

    console.log("ROTINAS E SEUS SETORES:");
    console.log(JSON.stringify(routines, null, 2));

    const { data: units } = await supabase.from('units').select('id, name').ilike('name', '%Livramento%');
    console.log("\nLIVRAMENTO UNIT ID:", units);

    if (units && units.length > 0 && routines) {
        const livramentoId = units[0].id;
        const checkRotina = routines.find(r => r.title === 'Check de Disponibilidade');

        if (checkRotina) {
            const { data: assignees } = await supabase
                .from('routine_assignees')
                .select('user_id, profiles!inner(unit_id, full_name)')
                .eq('routine_id', checkRotina.id);

            console.log(`\nTODOS Assignees de Check de Disponibilidade:`);
            console.log(assignees?.map(a => `${a.profiles.full_name} (${a.profiles.unit_id})`).slice(0, 5));

            const livramentoAssignees = assignees?.filter(a => (a.profiles as any)?.unit_id === livramentoId);
            console.log(`\nAssignees de LIVRAMENTO para essa rotina (Qtd: ${livramentoAssignees?.length || 0}):`);
            console.log(livramentoAssignees);
        }
    }
}

run();
