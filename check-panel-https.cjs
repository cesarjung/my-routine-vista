const https = require('https');
const fs = require('fs');

const envLocal = fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf8') : '';
const env = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : '';

const pullVal = (str, key) => {
    const match = str.match(new RegExp(`${key}=([^\\r\\n]+)`));
    return match ? match[1].trim().replace(/^"/, '').replace(/"$/, '') : null;
};

const url = pullVal(envLocal, 'VITE_SUPABASE_URL') || pullVal(env, 'VITE_SUPABASE_URL');
const key = pullVal(envLocal, 'VITE_SUPABASE_ANON_KEY') || pullVal(env, 'VITE_SUPABASE_ANON_KEY');
const host = url.replace('https://', '');

const options = {
    hostname: host,
    port: 443,
    path: `/rest/v1/dashboard_panels?select=id,title,filters&title=eq.Rotinas%20Diárias`,
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
        const panels = JSON.parse(data);
        console.log(JSON.stringify(panels, null, 2));
    });
});
req.on('error', (e) => console.error(e));
req.end();
