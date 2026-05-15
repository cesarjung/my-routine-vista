import os
import re

hooks_dir = r"c:\Users\Sirtec\my-routine-vista\src\hooks"

for filename in os.listdir(hooks_dir):
    if filename.endswith(".ts"):
        filepath = os.path.join(hooks_dir, filename)
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
            
        # Matches: row.length < 43
        # E.g. !row || row.length < 43
        # Be careful to capture the variable name
        new_content = re.sub(r'(!(\w+)\s*\|\|\s*\2\.length\s*<\s*\d+)', r'!\2 || !Array.isArray(\2)', content)
        
        if new_content != content:
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(new_content)
            print(f"Updated {filename}")
