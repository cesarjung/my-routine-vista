import csv
import urllib.request
import io

url = "https://docs.google.com/spreadsheets/d/1OTHF2ytEOjGgfE49paARXkz9GjaklOQC_UhiXwUjC2E/gviz/tq?tqx=out:csv&sheet=Carteira_Planejador"
try:
    with urllib.request.urlopen(url) as response:
        content = response.read().decode('utf-8')
        f = io.StringIO(content)
        reader = csv.reader(f)
        rows = list(reader)
        print('Total rows:', len(rows))
        print('Header:', rows[5][8] if len(rows)>5 and len(rows[5])>8 else 'N/A')
        print('Row 6:', rows[6][8] if len(rows)>6 and len(rows[6])>8 else 'N/A')
        print('Row 7:', rows[7][8] if len(rows)>7 and len(rows[7])>8 else 'N/A')
        print('Row 8:', rows[8][8] if len(rows)>8 and len(rows[8])>8 else 'N/A')
except Exception as e:
    print("Erro:", e)
