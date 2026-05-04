import json
import urllib.request

env = {}
with open('.env', 'r') as f:
    for line in f:
        if '=' in line and not line.startswith('#'):
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip().strip('"\'')

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
        return json.loads(response.read().decode('utf-8'))

out = []

r_all = get("/rest/v1/routines?select=id,title")
cdd = next((r for r in r_all if r['title'] == 'Check de Disponibilidade'), None)

if not cdd:
    out.append("Rotina não encontrada no array de rotinas completas")
else:
    cdd_id = cdd["id"]
    out.append(f"CDD ID: {cdd_id} - Title: {cdd['title']}")

    tasks_today = get(f"/rest/v1/tasks?select=id,title,unit_id,assigned_to,status,due_date&routine_id=eq.{cdd_id}&due_date=gte.2026-03-05T00:00:00Z&parent_task_id=not.is.null")
    out.append(f"\n--- TASKS 05/03 ({len(tasks_today)}) ---")
    out.append(json.dumps(tasks_today, indent=2))

    tasks_yesterday = get(f"/rest/v1/tasks?select=id,title,unit_id,assigned_to,status,due_date&routine_id=eq.{cdd_id}&due_date=gte.2026-03-04T00:00:00Z&due_date=lt.2026-03-05T00:00:00Z&parent_task_id=not.is.null")
    out.append(f"\n--- TASKS 04/03 ({len(tasks_yesterday)}) ---")
    out.append(json.dumps(tasks_yesterday, indent=2))

    assignees = get(f"/rest/v1/routine_assignees?select=user_id,profiles(unit_id,full_name)&routine_id=eq.{cdd_id}")
    out.append("\n--- ASSIGNEES NATIVOS DE CHECK DE DISPONIBILIDADE ---")
    out.append(json.dumps(assignees, indent=2))

    units = get("/rest/v1/units?select=id,name")
    out.append("\n--- TODAS AS UNIDADES DO DB ---")
    for u in units:
        out.append(f" - {u['id']} | {u['name']}")

with open('debug_tasks.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(out))
