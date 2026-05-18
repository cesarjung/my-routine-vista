import os
import re

directory = 'src/components/views'
files = [
    'PostesTurnoView.tsx',
    'PlanejamentoGanttView.tsx',
    'PlanejamentoEquipesGanttView.tsx',
    'PlanejadoMetaView.tsx',
    'EtapasView.tsx',
    'DeslocamentoView.tsx',
    'CumprimentoView.tsx'
]

for filename in files:
    filepath = os.path.join(directory, filename)
    if not os.path.exists(filepath): continue
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if 'FilterSelect' not in content:
        content = content.replace("import { Button } from '@/components/ui/button';", "import { Button } from '@/components/ui/button';\nimport { FilterSelect } from '@/components/ui/filter-select';")
    
    pattern = r'<div className="flex flex-col justify-center min-w-\[100px\]">\s*<span className="text-\[10px\] font-bold text-muted-foreground uppercase tracking-wider mb-1">Projeto</span>\s*<DropdownMenu.*?DropdownMenu>\s*</div>'
    
    if re.search(pattern, content, flags=re.DOTALL):
        content = re.sub(pattern, '<FilterSelect label="Projeto" options={projetosUnicos.map(p => ({ value: p, label: p }))} selectedValues={selectedProjetos} onChange={setSelectedProjetos} searchable={true} />', content, flags=re.DOTALL)
        content = re.sub(r'const \[projetosDropdownOpen, setProjetosDropdownOpen\] = useState\(false\);\n?', '', content)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'Updated {filename}')
    else:
        print(f'Pattern not found in {filename}')
