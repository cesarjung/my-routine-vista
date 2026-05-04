import os
import json
import urllib.request

env = {}
with open('.env', 'r') as f:
    for line in f:
        if '=' in line and not line.startswith('#'):
            k, v = line.strip().split('=', 1)
            env[k] = v.strip('"\'')

url = env.get("VITE_SUPABASE_URL")
key = env.get("VITE_SUPABASE_PUBLISHABLE_KEY")

headers = {
    "apikey": key,
    "Authorization": f"Bearer {key}",
    "Content-Type": "application/json"
}

def get(path):
    req = urllib.request.Request(f"{url}{path}", headers=headers)
    with urllib.request.urlopen(req) as response:
        return json.loads(response.read().decode())

out = []
routines = get("/rest/v1/routines?select=id,title,sector_id,sectors(name)&title=in.(Checkpoint%20Di%C3%A1rio,Boletim%20de%20Produtividade,Check%20de%20Disponibilidade)")
out.append("--- ROTINAS ---")
out.append(json.dumps(routines, indent=2))

units = get("/rest/v1/units?select=id,name")
liv = [u for u in units if 'livramento' in u['name'].lower()]
out.append(f"\n--- LIVRAMENTO (Encontrado: {len(liv)}) ---")
out.append(json.dumps(liv, indent=2))

if liv:
    cdd_id = next((r["id"] for r in routines if r["title"] == "Check de Disponibilidade"), None)
    if cdd_id:
        assignees = get(f"/rest/v1/routine_assignees?select=user_id,profiles(unit_id,full_name)&routine_id=eq.{cdd_id}")
        liv_id = liv[0]['id']
        liv_assignees = [a for a in assignees if a.get('profiles') and a['profiles'].get('unit_id') == liv_id]
        
        out.append(f"\nTotal Assignees for this Routine: {len(assignees)}")
        out.append(f"Livramento Assignees: {len(liv_assignees)}")
        for a in liv_assignees:
            out.append(f" -> {a['profiles']['full_name']}")

with open('debug_out.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(out))
