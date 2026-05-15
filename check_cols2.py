import csv
import io

try:
    with open('carteira.csv', 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        rows = list(reader)
        print("Total rows:", len(rows))
        
        # Encontrar o cabeçalho
        header_idx = -1
        for i, row in enumerate(rows[:20]):
            if any('Mês' in c for c in row) or any('MES' in c.upper() for c in row) or any('PROJETO' in c.upper() for c in row):
                header_idx = i
                break
                
        if header_idx != -1:
            header = rows[header_idx]
            print(f"Header at row {header_idx}:")
            for i, col in enumerate(header):
                if col.strip():
                    print(f"  [{i}] {col}")
        else:
            print("Header not found")
            
except Exception as e:
    print("Error:", e)
