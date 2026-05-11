require('dotenv').config({ path: 'c:/Users/Sirtec/my-routine-vista/.env' });
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('planejamento_cache').select('unidade_id, data').limit(1);
  if (error) {
    console.error(error);
    return;
  }
  if (data && data.length > 0) {
    const carteira = data[0].data;
    console.log(`Unidade: ${data[0].unidade_id}`);
    console.log('Headers:');
    console.log(carteira[0].slice(20, 26)); // Should include W and X
    console.log('Row 1:');
    console.log(carteira[1].slice(20, 26));
    console.log('Row 2:');
    console.log(carteira[2].slice(20, 26));
  } else {
    console.log('No data');
  }
}
check();
