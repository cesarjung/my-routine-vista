import json

def generate_dummy_data(rows, cols):
    data = []
    data.append([f"Col{i}" for i in range(cols)])
    for _ in range(rows):
        row = ["" for _ in range(cols)]
        if cols > 1:
            row[1] = "TestData"
        data.append(row)
    return data

dummy = generate_dummy_data(5000, 50)
print(f"Raw dummy length (1 sheet): {len(json.dumps(dummy))} bytes")

# Scrubber logic
cleaned_data = []
whitelist = {1, 3, 5, 6, 9, 10, 11, 12, 13, 14, 15, 22, 23, 24, 38, 44, 45, 46, 47}
for row_idx, row in enumerate(dummy):
    if whitelist and row_idx > 0:
        for i in range(len(row)):
            if i not in whitelist:
                row[i] = ""
    
    last_non_empty = -1
    for i in range(len(row) - 1, -1, -1):
        if str(row[i]).strip():
            last_non_empty = i
            break
            
    if last_non_empty >= 0:
        cleaned_data.append(row[:last_non_empty + 1])

print(f"Scrubbed dummy length (1 sheet): {len(json.dumps(cleaned_data))} bytes")
