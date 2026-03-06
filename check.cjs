const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data: routines } = await supabase
        .from('routines')
        .select('id, title, sector_id, sector:sectors(name)')
        .in('title', ['Checkpoint Diário', 'Boletim de Produtividade', 'Check de Disponibilidade']);

    console.log("===============================");
    console.log("1. ROTINAS E SEUS SETORES NO BANCO:");
    console.log(JSON.stringify(routines, null, 2));

    const { data: units } = await supabase.from('units').select('id, name').ilike('name', '%Livramento%');
    console.log("\n2. LIVRAMENTO UNIT ID:", units);

    if (units && units.length > 0 && routines) {
        const livramentoId = units[0].id;
        const checkRotina = routines.find(r => r.title === 'Check de Disponibilidade');

        if (checkRotina) {
            const { data: assignees } = await supabase
                .from('routine_assignees')
                .select('user_id, profiles!inner(unit_id, full_name)')
                .eq('routine_id', checkRotina.id);

            console.log(`\n3. TODOS Assignees de Check de Disponibilidade (Qtd Total: ${assignees?.length}):`);
            if (assignees) {
                console.log(assignees.slice(0, 3).map(a => `${a.profiles.full_name} (${a.profiles.unit_id})`));
            }

            const livramentoAssignees = assignees?.filter(a => a.profiles?.unit_id === livramentoId);
            console.log(`\n4. Assignees de LIVRAMENTO para essa rotina (Qtd: ${livramentoAssignees?.length || 0}):`);
            console.log(livramentoAssignees);
        }
    }
}

run();
