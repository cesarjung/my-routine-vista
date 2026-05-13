import glob

def fix_scroll(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content
    
    # Make sure the container handles overflow-x correctly and applies custom-scrollbar
    content = content.replace(
        'className="flex flex-row flex-nowrap items-end gap-4 overflow-x-auto pb-2"',
        'className="flex flex-row flex-nowrap items-end gap-4 overflow-x-auto custom-scrollbar w-full pb-2"'
    )

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Fixed scroll for {filepath}")
    else:
        print(f"No changes for {filepath}")

for f in glob.glob('src/components/views/*View.tsx'):
    fix_scroll(f)
