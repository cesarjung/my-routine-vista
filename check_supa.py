import urllib.request, json
env = dict(line.strip().split('=', 1) for line in open('.env') if '=' in line)
url = env['VITE_SUPABASE_URL'].strip('"') + '/rest/v1/planejamento_cache?select=unidade_id,principal'
key = env['VITE_SUPABASE_PUBLISHABLE_KEY'].strip('"')
req = urllib.request.Request(url, headers={'apikey': key, 'Authorization': 'Bearer ' + key})
try:
    res = urllib.request.urlopen(req)
    data = json.loads(res.read().decode())
    print(f"Total records: {len(data)}")
    for row in data:
        p = row['principal']
        if type(p) is str:
            p = json.loads(p)
        print(f"Unidade: {row['unidade_id']} - Rows: {len(p)}")
        if len(p) > 2600:
            print(f"Row 2600 length: {len(p[2600])}")
            print(f"Row 2600: {p[2600][60:68] if len(p[2600]) > 67 else 'Too short'}")
        
        # check LV023
        for r in p:
            if len(r) > 6 and 'LV023' in str(r[6]):
                print(f"Found LV023 in {row['unidade_id']}")
                print(f"Length of row: {len(r)}")
                print(f"Row 64: {r[64] if len(r) > 64 else 'missing'}")
                print(f"Row 67: {r[67] if len(r) > 67 else 'missing'}")
                break
except Exception as e:
    print("Error:", e)
