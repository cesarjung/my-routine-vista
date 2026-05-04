const { createClient } = require('@supabase/supabase-js');

const url = "https://curyufedazpkhtxrwhkn.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1cnl1ZmVkYXpwa2h0eHJ3aGtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5NzU5NTIsImV4cCI6MjA4MjU1MTk1Mn0.DGKJPQBmLCTw5YyKwg7LfRQMseeVgXzljD5Z6lCESRs";

const supabase = createClient(url, key);

async function dumpFilters() {
    const { data: panels } = await supabase.from('dashboard_panels').select('id, title, filters').eq('title', 'Rotinas Diárias').limit(1);
    if (!panels || panels.length === 0) return console.log('not found');

    const filters = panels[0].filters;
    console.log('Filters DB:', JSON.stringify(filters, null, 2));

    let tasksQuery = supabase.from('tasks').select('id, title, status, unit_id, due_date, routine_id');

    if (filters.sector_id) {
        if (Array.isArray(filters.sector_id)) {
            const validSectors = filters.sector_id.filter(id => id && id.toLowerCase() !== 'todos os setores' && id.toLowerCase() !== 'selecionar todos');
            if (validSectors.length > 0) tasksQuery = tasksQuery.in('sector_id', validSectors);
        } else if (filters.sector_id.toLowerCase() !== 'todos os setores' && filters.sector_id.toLowerCase() !== 'selecionar todos') {
            tasksQuery = tasksQuery.eq('sector_id', filters.sector_id);
        }
    }
    if (filters.unit_id) {
        if (Array.isArray(filters.unit_id)) {
            const validUnits = filters.unit_id.filter(id => id && id.toLowerCase() !== 'todas as unidades' && id.toLowerCase() !== 'selecionar todos');
            if (validUnits.length > 0) tasksQuery = tasksQuery.in('unit_id', validUnits);
        } else if (filters.unit_id.toLowerCase() !== 'todas as unidades' && filters.unit_id.toLowerCase() !== 'selecionar todos') {
            tasksQuery = tasksQuery.eq('unit_id', filters.unit_id);
        }
    }
    if (filters.status && filters.status.length > 0) {
        tasksQuery = tasksQuery.in('status', filters.status);
    }

    let matchedRoutineIds = [];
    if (filters.title_filter) {
        if (Array.isArray(filters.title_filter) && filters.title_filter.length > 0) {
            const validTitles = filters.title_filter.filter(t => t && t.toLowerCase() !== 'todas as rotinas' && t.toLowerCase() !== 'selecionar todos');

            if (validTitles.length > 0) {
                const { data: matchedRoutines } = await supabase
                    .from('routines')
                    .select('id')
                    .in('title', validTitles);

                if (matchedRoutines && matchedRoutines.length > 0) {
                    matchedRoutineIds = matchedRoutines.map(r => r.id);
                    const titlesStr = validTitles.map(t => `"${t}"`).join();
                    const routinesStr = matchedRoutineIds.map(id => `"${id}"`).join();
                    tasksQuery = tasksQuery.or(`title.in.(${titlesStr}),routine_id.in.(${routinesStr})`);
                } else {
                    tasksQuery = tasksQuery.in('title', validTitles);
                }
            }
        }
    }

    const formatBound = (date, isEnd) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const time = isEnd ? '23:59:59' : '00:00:00';
        return `${year}-${month}-${day}T${time}-03:00`;
    };

    const now = new Date();
    const startUtcOffset = formatBound(now, false);
    const endUtcOffset = formatBound(now, true);

    console.log(`Bounds: ${startUtcOffset} -> ${endUtcOffset}`);

    tasksQuery = tasksQuery
        .gte('due_date', startUtcOffset)
        .lte('due_date', endUtcOffset);

    tasksQuery = tasksQuery.limit(20000);
    const { data: tasks, error } = await tasksQuery;

    if (error) console.error('Query error:', error);
    console.log('Final tasks length:', tasks?.length);
    if (tasks && tasks.length > 0) {
        console.log(tasks[0]);
    }
}
dumpFilters();
