const { createClient } = require('@supabase/supabase-js');

const url = "https://curyufedazpkhtxrwhkn.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1cnl1ZmVkYXpwa2h0eHJ3aGtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5NzU5NTIsImV4cCI6MjA4MjU1MTk1Mn0.DGKJPQBmLCTw5YyKwg7LfRQMseeVgXzljD5Z6lCESRs";

const supabase = createClient(url, key);

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

async function run() {
    console.log(`Querying from ${startUtcOffset} to ${endUtcOffset}`);
    const { data, error } = await supabase
        .from('tasks')
        .select('id, title, status, unit_id, due_date, units(name)')
        .gte('due_date', startUtcOffset)
        .lte('due_date', endUtcOffset);

    if (error) {
        console.error('API Error:', error);
        return;
    }

    console.log('Total tasks for Hoje:', Object.keys(data).length);

    if (data && data.length > 0) {
        const barreiras = data.filter(t => t.units && t.units.name === 'Barreiras');
        console.log('Barreiras count:', barreiras.length);
        barreiras.slice(0, 10).forEach(t => console.log(' ->', t.title, '| ID:', t.id));
    } else {
        console.log('API returned literally 0 tasks.');
    }
}
run();
