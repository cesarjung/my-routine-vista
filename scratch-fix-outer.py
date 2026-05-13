import glob
import re

def fix_outer_scroll(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content
    
    # Force the main container to not scroll horizontally, forcing the inner elements to scroll
    content = content.replace(
        'className="flex flex-col h-full overflow-auto bg-background custom-scrollbar relative"',
        'className="flex flex-col h-full overflow-y-auto overflow-x-hidden bg-background custom-scrollbar relative"'
    )
    # Also handle CumprimentoView and others if they use w-full overflow-auto
    content = content.replace(
        'className="flex flex-col h-full w-full bg-background overflow-auto custom-scrollbar relative"',
        'className="flex flex-col h-full w-full bg-background overflow-y-auto overflow-x-hidden custom-scrollbar relative"'
    )

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Fixed outer scroll for {filepath}")
    else:
        print(f"No changes for {filepath}")

for f in glob.glob('src/components/views/*View.tsx'):
    fix_outer_scroll(f)
