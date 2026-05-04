import os
import requests
from dotenv import dotenv_values

config = dotenv_values(".env.local")
url = config.get("VITE_SUPABASE_URL")
key = config.get("VITE_SUPABASE_ANON_KEY")

headers = {
    "apikey": key,
    "Authorization": f"Bearer {key}",
    "Content-Type": "application/json"
}

print("--- SECTORS ---")
res = requests.get(f"{url}/rest/v1/routines?select=id,title,sector_id,sectors(name)&title=in.(Checkpoint%20Di%C3%A1rio,Boletim%20de%20Produtividade,Check%20de%20Disponibilidade)", headers=headers)
routines = res.json()
for r in routines:
    print(f"- {r['title']}: {r.get('sectors')}")

print("\n--- LIVRAMENTO (Check de Disponibilidade) ---")
cdd_id = next((r["id"] for r in routines if r["title"] == "Check de Disponibilidade"), None)

if cdd_id:
    # get livramento unit
    u_res = requests.get(f"{url}/rest/v1/units?select=id,name&name=ilike.*Livramento*", headers=headers)
    liv_unit = u_res.json()[0]
    print("Unit:", liv_unit)
    
    # get assignees for C.d.D. with this unit
    a_res = requests.get(f"{url}/rest/v1/routine_assignees?select=user_id,profiles!inner(unit_id,full_name)&routine_id=eq.{cdd_id}&profiles.unit_id=eq.{liv_unit['id']}", headers=headers)
    assignees = a_res.json()
    print("Assignees:")
    for a in assignees:
        print(f" -> {a['profiles']['full_name']}")
    if len(assignees) == 0:
        print("NO ASSIGNEES FOUND FOR LIVRAMENTO")
        
    print("\nTotal assignees count for Check de Disponibilidade:")
    tot_res = requests.get(f"{url}/rest/v1/routine_assignees?select=user_id,profiles(unit_id,full_name)&routine_id=eq.{cdd_id}", headers=headers)
    print(len(tot_res.json()))
