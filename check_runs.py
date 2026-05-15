import json
import codecs

try:
    with codecs.open('github_runs.json', 'r', encoding='utf-16le') as f:
        d = json.load(f)
        runs = [(r['name'], r['status'], r['conclusion'], r['head_commit']['message'], r['updated_at']) for r in d['workflow_runs']]
        for r in runs:
            print(r)
except Exception as e:
    print("Error:", e)
