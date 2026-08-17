const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = "https://curyufedazpkhtxrwhkn.supabase.co";
const envContent = fs.readFileSync('.env', 'utf8');
const match = envContent.match(/VITE_SUPABASE_PUBLISHABLE_KEY=["']?([^"'\n]+)/);
const key = match ? match[1] : "";

async function main() {
  const supabase = createClient(supabaseUrl, key);
  
  const { data, error } = await supabase
    .from('materiais_por_ponto')
    .select('id,mascara_e_ponto,codigo,updated_at')
    .eq('projeto', '1100821')
    .limit(10);
    
  if (error) console.error("Error:", error);
  else console.log("Rows:", data);
}

main();
