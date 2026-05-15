import csv

try:
    with open('carteira.csv', 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        rows = list(reader)
        print("Total rows:", len(rows))
        for i in range(5, min(10, len(rows))):
            print(f"Row {i}:")
            for j, val in enumerate(rows[i]):
                if val.strip() and val.strip() != '-':
                    print(f"  [{j}] {val}")
except Exception as e:
    print("Error:", e)
