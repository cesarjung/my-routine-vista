import os
import re

directory = 'src/components/views'
files = [
    'PostesTurnoView.tsx',
    'PlanejadoMetaView.tsx',
    'EtapasView.tsx',
    'DeslocamentoView.tsx',
    'CumprimentoView.tsx',
    'PlanejamentoGanttView.tsx',
    'PlanejamentoEquipesGanttView.tsx',
    'CarteiraDashboardView.tsx',
    'PlanejamentoSemanalView.tsx'
]

for filename in files:
    filepath = os.path.join(directory, filename)
    if not os.path.exists(filepath): continue
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Sort months descending
    content = content.replace('parseMesToDate(a) - parseMesToDate(b)', 'parseMesToDate(b) - parseMesToDate(a)')
    content = content.replace('iA - iB', 'iB - iA')
    content = content.replace('mesesOrder.indexOf(a) - mesesOrder.indexOf(b)', 'mesesOrder.indexOf(b) - mesesOrder.indexOf(a)')

    pattern = r'<div className="flex flex-col justify-center[^>]*">\s*<span className="text-\[10px\] font-bold text-muted-foreground uppercase tracking-wider mb-1">Mês</span>\s*<DropdownMenu.*?</DropdownMenu>\s*</div>'
    
    if re.search(pattern, content, flags=re.DOTALL):
        match = re.search(r'{(mesesUnicos|mesesDisponiveis|meses)\.map\((?:mes|m) => \(', content)
        arr_name = match.group(1) if match else 'mesesDisponiveis'
        
        replacement = f'<FilterSelect label="Mês" options={{{arr_name}.map(m => ({{ value: m, label: m }}))}} selectedValues={{selectedMeses}} onChange={{setSelectedMeses}} searchable={{true}} />'
        content = re.sub(pattern, replacement, content, flags=re.DOTALL)
        
        content = re.sub(r'const \[mesesDropdownOpen, setMesesDropdownOpen\] = useState\(false\);\n?', '', content)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'Updated {filename}')
