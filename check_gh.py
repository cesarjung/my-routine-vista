import urllib.request
import json
req = urllib.request.Request('https://api.github.com/repos/cesarjung/my-routine-vista/actions/runs?per_page=5', headers={'User-Agent': 'Mozilla/5.0'})
data = json.loads(urllib.request.urlopen(req).read().decode('utf-8'))
for r in data.get('workflow_runs', []):
    print(f"Run {r['id']}: {r['name']} - {r['status']} - {r['conclusion']} - {r['created_at']}")
