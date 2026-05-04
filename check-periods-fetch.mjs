const SUPABASE_URL = "https://curyufedazpkhtxrwhkn.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1cnl1ZmVkYXpwa2h0eHJ3aGtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5NzU5NTIsImV4cCI6MjA4MjU1MTk1Mn0.DGKJPQBmLCTw5YyKwg7LfRQMseeVgXzljD5Z6lCESRs";

async function run() {
    const rUrl = `${SUPABASE_URL}/rest/v1/routines?select=id,title&title=ilike.*Check*Disponibilidade*`;
    const rRes = await fetch(rUrl, { headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` } });
    const rData = await rRes.json();
    console.log("Routine:", JSON.stringify(rData));

    if (rData.length > 0) {
        const routineId = rData[0].id;
        const pUrl = `${SUPABASE_URL}/rest/v1/routine_periods?select=id,period_start,period_end&routine_id=eq.${routineId}&order=period_start.desc&limit=5`;
        const pRes = await fetch(pUrl, { headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` } });
        const pData = await pRes.json();
        console.log("Periods from DB:");
        console.log(JSON.stringify(pData, null, 2));

        if (pData.length > 0) {
            const cUrl = `${SUPABASE_URL}/rest/v1/routine_checkins?select=id,unit_id,notes,routine_period_id&routine_period_id=eq.${pData[0].id}`;
            const cRes = await fetch(cUrl, { headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` } });
            const cData = await cRes.json();
            console.log(`Period 0 Checkins (${pData[0].period_start}):`, cData.length, "| Has Notes:", cData.some(c => c.notes));
        }

        if (pData.length > 1) {
            const cUrl = `${SUPABASE_URL}/rest/v1/routine_checkins?select=id,unit_id,notes,routine_period_id&routine_period_id=eq.${pData[1].id}`;
            const cRes = await fetch(cUrl, { headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` } });
            const cData = await cRes.json();
            console.log(`Period 1 Checkins (${pData[1].period_start}):`, cData.length, "| Has Notes:", cData.some(c => c.notes));
        }
    }
}

run().catch(console.error);
