import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://curyufedazpkhtxrwhkn.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1cnl1ZmVkYXpwa2h0eHJ3aGtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5NzU5NTIsImV4cCI6MjA4MjU1MTk1Mn0.tXmEQD8jC5rPioA17Y1S2K6bWq971F2xYkU81T0EGE4";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function check() {
    const { data: routines } = await supabase.from('routines').select('id').ilike('title', '%Check%Disponibilidade%');
    const rId = routines[0].id;

    // Find ALL checkins with notes
    const { data: checkins } = await supabase
        .from('routine_checkins')
        .select('id, notes, routine_period_id, status, unit_id')
        .not('notes', 'is', null)
        .order('id', { ascending: false })
        .limit(10);

    console.log("Checkins with notes:", JSON.stringify(checkins, null, 2));
}

check().catch(console.error);
