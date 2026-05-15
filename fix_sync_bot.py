import re

with open("sync_bot.py", "r", encoding="utf-8") as f:
    content = f.read()

# Replace USED_COLS map
old_used_cols = """            USED_COLS = {
                "Carteira_Planejador": {1, 3, 5, 6, 9, 10, 11, 12, 13, 14, 15, 22, 23, 24, 38, 44, 45, 46, 47},
                "Plan_Principal": {1, 4, 6, 7, 37, 38, 42, 53},
                "Reprogramadas": {1, 4, 6, 7, 37, 38, 42, 53}
            }"""

new_used_cols = """            USED_COLS = {
                "Carteira_Planejador": {1, 3, 5, 6, 8, 9, 10, 11, 12, 13, 14, 15, 22, 23, 24, 32, 38, 44, 45, 46, 47},
                "Plan_Principal": {1, 4, 6, 7, 12, 37, 38, 42, 53},
                "Reprogramadas": {1, 4, 6, 7, 37, 38, 42, 53}
            }"""

new_content = content.replace(old_used_cols, new_used_cols)

with open("sync_bot.py", "w", encoding="utf-8") as f:
    f.write(new_content)

print("Updated sync_bot.py whitelists")
