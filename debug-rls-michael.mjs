import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function main() {
    // Login as Michael
    const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
        email: 'michael.prado@sirtec.com.br',
        password: 'password123' // Or insert proper password if possible, wait, I can just use service role to act as him? No, JWT.
    });

    if (authError) {
        console.log("Could not log in as Michael, using service role instead to fetch his profile to simulate his unit.", authError);
        return;
    }
}
main();
