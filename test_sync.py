def test_logic():
    whitelist = {1, 3, 5, 6, 8, 9, 10, 11, 12, 13, 14, 15, 22, 23, 24, 32, 38, 44, 45, 46, 47}
    # Mock row with 50 elements, index 8 is '01/05/2026', index 12 is 'B-1139214'
    row = [f"val{i}" for i in range(50)]
    row[8] = "01/05/2026"
    row[12] = "B-1139214"
    
    # 1. Truncate
    row = row[:50]
    
    # 2. Whitelist zero out
    for i in range(len(row)):
        if i not in whitelist:
            row[i] = ""
            
    # 3. Strip trailing
    last_non_empty = -1
    for i in range(len(row) - 1, -1, -1):
        if str(row[i]).strip():
            last_non_empty = i
            break
            
    cleaned_row = row[:last_non_empty + 1] if last_non_empty >= 0 else []
    
    print("Cleaned row len:", len(cleaned_row))
    if len(cleaned_row) > 8:
        print("Index 8:", cleaned_row[8])
    if len(cleaned_row) > 12:
        print("Index 12:", cleaned_row[12])

test_logic()
