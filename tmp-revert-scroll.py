import os
import glob

def revert_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content
    
    # Restore top level flex container for filters to nowrap with horizontal scroll
    content = content.replace(
        'className="flex flex-row flex-wrap items-end gap-4 pb-2"',
        'className="flex flex-row flex-nowrap items-end gap-4 overflow-x-auto pb-2"'
    )
    content = content.replace(
        'className="flex flex-wrap items-end gap-4 pb-2"',
        'className="flex flex-nowrap items-end gap-4 overflow-x-auto pb-2"'
    )

    # Restore inner filter row wrapper to nowrap
    content = content.replace(
        'className="flex flex-wrap items-end gap-2 pb-1"',
        'className="flex flex-nowrap items-end gap-2 shrink-0 pb-1"'
    )
    content = content.replace(
        'className="flex flex-wrap items-end gap-2"',
        'className="flex flex-nowrap items-end gap-2 shrink-0"'
    )
    
    # Restore the vertical separator line
    content = content.replace(
        'className="hidden md:block w-px h-10 bg-border shrink-0"',
        'className="w-px h-10 bg-border shrink-0"'
    )

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Reverted {filepath}")
    else:
        print(f"No changes for {filepath}")

for f in glob.glob('src/components/views/*View.tsx'):
    revert_file(f)
