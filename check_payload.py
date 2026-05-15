import os
import json
import urllib.request

SUPABASE_URL = ""
SUPABASE_KEY = ""

with open('.env', 'r', encoding='utf-8') as f:
    for line in f:
        if line.startswith('VITE_SUPABASE_URL='):
            SUPABASE_URL = line.split('=')[1].strip().replace('"', '')
        if line.startswith('VITE_SUPABASE_PUBLISHABLE_KEY='):
            SUPABASE_KEY = line.split('=')[1].strip().replace('"', '')

url = f"{SUPABASE_URL}/rest/v1/planejamento_cache?select=unidade_id,carteira&limit=1"
req = urllib.request.Request(url)
req.add_header("apikey", SUPABASE_KEY)
req.add_header("Authorization", f"Bearer {SUPABASE_KEY}")

try:
    with urllib.request.urlopen(req) as response:
        resp_data = json.loads(response.read().decode())
        if len(resp_data) > 0:
            print("unidade_id:", resp_data[0]['unidade_id'])
            carteira_str = resp_data[0]['carteira']
            carteira = json.loads(carteira_str) if isinstance(carteira_str, str) else carteira_str
            for i in range(6, min(15, len(carteira))):
                row = carteira[i]
                print(f"Row {i} len: {len(row)}")
                if len(row) > 8:
                    print(f"  idx 8 (mes):", repr(row[8]))
                if len(row) > 12:
                    print(f"  idx 12 (proj):", repr(row[12]))
except Exception as e:
    print("Erro:", e)
