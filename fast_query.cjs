const https = require('https');
const fs = require('fs');

const envFile = fs.readFileSync('.env', 'utf8');
let supabaseUrl = '';
let supabaseKey = '';

envFile.split('\n').forEach(line => {
    if (line.startsWith('VITE_SUPABASE_URL=')) {
        supabaseUrl = line.split('=')[1].trim().replace(/['"]/g, '').replace(/\r$/, '');
    }
    if (line.startsWith('VITE_SUPABASE_PUBLISHABLE_KEY=')) {
        supabaseKey = line.split('=')[1].trim().replace(/['"]/g, '').replace(/\r$/, '');
    }
});

const url = new URL(supabaseUrl + "/rest/v1/tasks?select=id,title,start_date,due_date,parent_task_id,routine_id,unit_id,is_recurring,status,created_at&order=created_at.desc&limit=15");

const options = {
    hostname: url.hostname,
    path: url.pathname + url.search,
    method: 'GET',
    headers: {
        'apikey': supabaseKey,
        'Authorization': 'Bearer ' + supabaseKey
    }
};

const req = https.request(options, res => {
    let data = '';
    res.on('data', chunk => { data += chunk; });
    res.on('end', () => {
        try {
            console.log(JSON.stringify(JSON.parse(data), null, 2));
        } catch (e) {
            console.log(data);
        }
    });
});

req.on('error', error => { console.error(error); });
req.end();
