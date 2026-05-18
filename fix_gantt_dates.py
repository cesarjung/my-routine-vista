import os
import re

directory = 'src/components/views'

for filename in ['PlanejamentoGanttView.tsx', 'PlanejamentoEquipesGanttView.tsx']:
    filepath = os.path.join(directory, filename)
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Search for mesesDisponiveis useMemo
    pattern = r'const mesesDisponiveis = useMemo\(\(\) => \{.*?(?:return Array\.from\(meses\)(?:\.sort\(\))?;).*?\}, \[data\]\);'
    
    match = re.search(pattern, content, flags=re.DOTALL)
    if match:
        original_block = match.group(0)
        
        replacement = """const mesesDisponiveis = useMemo(() => {
    if (!data) return [];
    const meses = new Set<string>();
    data.forEach(row => {
"""
        if filename == 'PlanejamentoGanttView.tsx':
            replacement += """      if (row.mesFiltro && row.mesFiltro !== '-') {
        const parts = row.mesFiltro.split(',').map(m => m.trim());
        parts.forEach(p => meses.add(p));
      }"""
        else:
            replacement += """      row.atividadesDiarias.forEach(ativ => {
        const mesAno = format(ativ.dataParsed, 'MMM/yy', { locale: ptBR }).toUpperCase();
        meses.add(mesAno);
      });"""

        replacement += """
    });
    
    const parseMesToDate = (m: string) => {
      try {
        const cleanStr = m.replace('/', ' ');
        return parse(cleanStr, 'MMM yy', new Date(), { locale: ptBR }).getTime();
      } catch (e) {
        return 0;
      }
    };

    return Array.from(meses).sort((a, b) => parseMesToDate(b) - parseMesToDate(a));
  }, [data]);"""
        
        content = content.replace(original_block, replacement)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'Fixed {filename}')
    else:
        print(f'Pattern not found in {filename}')
