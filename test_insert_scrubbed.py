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

def generate_scrubbed_dummy(rows, cols, whitelist):
    data = []
    data.append([f"Col{i}" for i in range(cols)])
    for _ in range(rows):
        row = ["" for _ in range(cols)]
        if cols > 1:
            row[1] = "TestData"
            
        for i in range(len(row)):
            if i not in whitelist:
                row[i] = ""
                
        last_non_empty = -1
        for i in range(len(row) - 1, -1, -1):
            if str(row[i]).strip():
                last_non_empty = i
                break
        if last_non_empty >= 0:
            data.append(row[:last_non_empty + 1])
    return data

payload = {
    "unidade_id": "TESTE_123",
    "carteira": generate_scrubbed_dummy(5000, 50, {1, 3, 5, 6, 9, 10, 11, 12, 13, 14, 15, 22, 23, 24, 38, 44, 45, 46, 47}),
    "principal": generate_scrubbed_dummy(5000, 50, {1, 4, 6, 7, 37, 38, 42, 53}),
    "bd_metas": {
        "bd_metas": generate_scrubbed_dummy(100, 10, {0, 1, 2}),
        "base_curva": generate_scrubbed_dummy(100, 10, {0, 1, 2}),
        "bd_config": generate_scrubbed_dummy(100, 100, {0, 1, 2})
    },
    "reprogramadas": generate_scrubbed_dummy(2000, 50, {1, 4, 6, 7, 37, 38, 42, 53}),
    "updated_at": "2026-05-13T12:00:00Z"
}

payload_size = len(json.dumps(payload))
print(f"Scrubbed Payload Size: {payload_size / 1024:.2f} KB")

print("Deleting old...")
requests.delete(f"{url}?unidade_id=eq.TESTE_123", headers=headers)

print("Inserting scrubbed payload...")
t0 = time.time()
res = requests.post(url, headers=headers, json=payload, timeout=60)
t1 = time.time()
print(f"Status: {res.status_code}")
print(f"Time: {t1 - t0:.2f}s")
print(res.text)
