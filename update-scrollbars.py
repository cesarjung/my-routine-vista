import os

def replace_in_file(filepath, old, new):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if old in content:
        content = content.replace(old, new)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {filepath}")
    else:
        print(f"String not found in {filepath}")

# 1. PlanejamentoGanttView
replace_in_file(
    "src/components/views/PlanejamentoGanttView.tsx",
    'className="flex flex-row flex-nowrap items-end gap-6 overflow-x-auto no-scrollbar-custom"',
    'className="flex flex-row flex-nowrap items-end gap-6 overflow-x-auto custom-scrollbar pb-2"'
)
replace_in_file(
    "src/components/views/PlanejamentoGanttView.tsx",
    'className="flex flex-nowrap items-center gap-2 overflow-x-auto no-scrollbar-custom pb-1"',
    'className="flex flex-nowrap items-center gap-2 overflow-x-auto custom-scrollbar pb-1"'
)
replace_in_file(
    "src/components/views/PlanejamentoGanttView.tsx",
    'className="flex-1 overflow-auto relative flex no-scrollbar-custom"',
    'className="flex-1 overflow-auto relative flex custom-scrollbar"'
)

# 2. PlanejamentoEquipesGanttView
replace_in_file(
    "src/components/views/PlanejamentoEquipesGanttView.tsx",
    'className="px-6 py-3 bg-background border-b border-border flex flex-row flex-nowrap gap-4 items-end overflow-x-auto no-scrollbar-custom"',
    'className="px-6 py-3 bg-background border-b border-border flex flex-row flex-nowrap gap-4 items-end overflow-x-auto custom-scrollbar pb-2"'
)
replace_in_file(
    "src/components/views/PlanejamentoEquipesGanttView.tsx",
    'className="flex-1 overflow-auto relative flex no-scrollbar-custom"',
    'className="flex-1 overflow-auto relative flex custom-scrollbar"'
)

# 3. CarteiraDashboardView main container
replace_in_file(
    "src/components/views/CarteiraDashboardView.tsx",
    'className="flex flex-col h-full overflow-auto bg-background custom-scrollbar relative"',
    'className="flex flex-col h-full w-full bg-background overflow-y-auto overflow-x-hidden custom-scrollbar relative"'
)

# 4. MyTasksView has no-scrollbar
replace_in_file(
    "src/components/views/MyTasksView.tsx",
    'className="flex items-center gap-2 w-full overflow-x-auto no-scrollbar"',
    'className="flex items-center gap-2 w-full overflow-x-auto custom-scrollbar pb-2"'
)
