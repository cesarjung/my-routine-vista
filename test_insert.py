import os
import time
import json
import requests
from dotenv import load_dotenv

load_dotenv()
supabase_url = os.environ.get('VITE_SUPABASE_URL')
supabase_key = os.environ.get('VITE_SUPABASE_PUBLISHABLE_KEY')

url = f"{supabase_url}/rest/v1/planejamento_cache"
headers = {
    "apikey": supabase_key,
    "Authorization": f"Bearer {supabase_key}",
    "Content-Type": "application/json"
}

def generate_dummy_data(rows, cols):
    data = []
    # Header
    data.append([f"Col{i}" for i in range(cols)])
    # Rows
    for _ in range(rows):
        row = ["" for _ in range(cols)]
        if cols > 1:
            row[1] = "TestData"
        data.append(row)
    return data

payload = {
    "unidade_id": "TESTE_123",
    "carteira": json.dumps(generate_dummy_data(5000, 50)),
    "principal": json.dumps(generate_dummy_data(5000, 50)),
    "bd_metas": json.dumps({
        "bd_metas": generate_dummy_data(100, 10),
        "base_curva": generate_dummy_data(100, 10),
        "bd_config": generate_dummy_data(100, 100)
    }),
    "reprogramadas": json.dumps(generate_dummy_data(2000, 50)),
    "updated_at": "2026-05-13T12:00:00Z"
}

payload_size = len(json.dumps(payload))
print(f"Payload Size: {payload_size / 1024 / 1024:.2f} MB")

print("Deleting old...")
requests.delete(f"{url}?unidade_id=eq.TESTE_123", headers=headers)

print("Inserting...")
t0 = time.time()
res = requests.post(url, headers=headers, json=payload, timeout=120)
t1 = time.time()
print(f"Status: {res.status_code}")
print(f"Time: {t1 - t0:.2f}s")
print(res.text)
