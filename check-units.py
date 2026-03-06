import os
import json
import urllib.request

env = {}
with open('.env', 'r') as f:
    for line in f:
        if '=' in line and not line.startswith('#'):
            k, v = line.strip().split('=', 1)
            env[k.strip()] = v.strip('"\'')

url = env.get("VITE_SUPABASE_URL")
key = env.get("VITE_SUPABASE_PUBLISHABLE_KEY")

req = urllib.request.Request(f"{url}/rest/v1/units?select=id,name", headers={
    "apikey": key,
    "Authorization": f"Bearer {key}",
    "Content-Type": "application/json"
})

with urllib.request.urlopen(req) as response:
    units = json.loads(response.read().decode())
    print("ALL UNITS:")
    for u in units:
        print(f" - {u['name']}")
