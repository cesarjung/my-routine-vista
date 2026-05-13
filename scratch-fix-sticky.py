import glob

def fix_sticky(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content
    
    # Fix the sticky container
    content = content.replace(
        'className="sticky top-0 z-[100] bg-background border-b border-border space-y-3 pt-4 px-6 pb-4"',
        'className="sticky top-0 z-[100] bg-background border-b border-border space-y-3 pt-4 px-6 pb-4 w-full min-w-0"'
    )
    content = content.replace(
        'className="flex flex-col gap-3 p-4 shrink-0 border-b border-border sticky top-0 z-10 bg-background"',
        'className="flex flex-col gap-3 p-4 shrink-0 border-b border-border sticky top-0 z-10 bg-background w-full min-w-0"'
    )

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Fixed sticky for {filepath}")
    else:
        print(f"No changes for {filepath}")

for f in glob.glob('src/components/views/*View.tsx'):
    fix_sticky(f)
