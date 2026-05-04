const https = require('https');
const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL="(.*?)"/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY="(.*?)"/);
const host = urlMatch[1].trim().replace('https://', '');
const key = keyMatch[1].trim();

const now = new Date();
const formatBound = (date, isEnd) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const time = isEnd ? '23:59:59' : '00:00:00';
    return `${year}-${month}-${day}T${time}-03:00`;
};
const startUtcOffset = formatBound(now, false);
const endUtcOffset = formatBound(now, true);

const options = {
    hostname: host,
    port: 443,
    path: `/rest/v1/tasks?select=id,title,unit_id,routine_id,due_date,start_date,parent_task_id,status,units(name),routines(title,frequency)&due_date=gte.${startUtcOffset}&due_date=lte.${endUtcOffset}`,
    method: 'GET',
    headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
    }
};

const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (d) => data += d);
    res.on('end', () => {
        const tasks = JSON.parse(data);
        fs.writeFileSync('debug_tasks.txt', JSON.stringify(tasks, null, 2));
        console.log(`Saved ${tasks.length} tasks to debug_tasks.txt`);
    });
});
req.on('error', (e) => console.error(e));
req.end();
