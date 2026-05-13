import os
import re
import glob

def fix_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content
    
    # Fix top level flex container for filters
    content = content.replace(
        'className="flex flex-row flex-nowrap items-end gap-4 overflow-x-auto no-scrollbar-custom"',
        'className="flex flex-row flex-wrap items-end gap-4 pb-2"'
    )
    # Some might not have flex-row
    content = content.replace(
        'className="flex flex-nowrap items-end gap-4 overflow-x-auto no-scrollbar-custom"',
        'className="flex flex-wrap items-end gap-4 pb-2"'
    )

    # Fix inner filter row wrapper
    content = content.replace(
        'className="flex flex-nowrap items-end gap-2 shrink-0 pb-1"',
        'className="flex flex-wrap items-end gap-2 pb-1"'
    )
    content = content.replace(
        'className="flex flex-nowrap items-end gap-2 shrink-0"',
        'className="flex flex-wrap items-end gap-2"'
    )
    
    # Hide the vertical separator line on very small screens since they will wrap
    content = content.replace(
        'className="w-px h-10 bg-border shrink-0"',
        'className="hidden md:block w-px h-10 bg-border shrink-0"'
    )

    # Fix grids
    # Usually: grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4
    content = re.sub(
        r'grid-cols-1\s+md:grid-cols-2\s+lg:grid-cols-3\s+xl:grid-cols-4',
        'grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4',
        content
    )
    
    # Some places might have gap-4 mb-8 etc.
    
    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Fixed {filepath}")
    else:
        print(f"No changes for {filepath}")

for f in glob.glob('src/components/views/*View.tsx'):
    fix_file(f)
