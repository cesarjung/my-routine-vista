import glob

def refactor_header_scroll(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content
    
    # Check if it has the old structure
    if 'className="flex flex-row flex-nowrap items-end gap-4 overflow-x-auto custom-scrollbar w-full pb-2"' in content:
        # Replace the opening
        content = content.replace(
            'className="flex flex-row flex-nowrap items-end gap-4 overflow-x-auto custom-scrollbar w-full pb-2"',
            'className="w-full overflow-x-auto custom-scrollbar pb-2">\n          <div className="flex flex-row flex-nowrap items-end gap-4 min-w-max"'
        )
        
        # Replace the closing. Usually right before Filtros Ativos or just the end of the header
        # This is tricky because we need to find the right closing div.
        # Since I already fixed CarteiraDashboardView manually, I'll just leave it or do a simpler regex.
        # For now, I won't run this automatically on all files to avoid missing closing divs like I just did,
        # unless I can parse it correctly. Let me skip this since the user's screenshot was only Carteira.
        
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Refactored {filepath}")
    else:
        print(f"No changes for {filepath}")

for f in glob.glob('src/components/views/*View.tsx'):
    if "CarteiraDashboardView" not in f:
        pass # Not doing it automatically to avoid breaking other files' syntax
