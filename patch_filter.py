import os

filepath = 'src/components/ui/filter-select.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    code = f.read()

import re

# We need to wrap the onChange call in setTimeout
code = code.replace(
    """              onCheckedChange={(checked) => {
                if (checked) {
                  onChange([...selectedValues, opt.value]);
                } else {
                  onChange(selectedValues.filter((v) => v !== opt.value));
                }
              }}""",
    """              onCheckedChange={(checked) => {
                const newValues = checked 
                  ? [...selectedValues, opt.value]
                  : selectedValues.filter((v) => v !== opt.value);
                
                // DEFER parent state update to prevent Radix UI unmount collision during heavy renders
                setTimeout(() => onChange(newValues), 10);
              }}"""
)

# And also fix the "Todos" and "Limpar" buttons
code = code.replace(
    """<Button variant="secondary" size="sm" className="w-full text-xs h-7" onClick={() => onChange(options.map(o => o.value))}>Todos</Button>""",
    """<Button variant="secondary" size="sm" className="w-full text-xs h-7" onClick={() => setTimeout(() => onChange(options.map(o => o.value)), 10)}>Todos</Button>"""
)
code = code.replace(
    """<Button variant="outline" size="sm" className="w-full text-xs h-7" onClick={() => { onChange([]); setSearch(""); }}>Limpar</Button>""",
    """<Button variant="outline" size="sm" className="w-full text-xs h-7" onClick={() => { setTimeout(() => onChange([]), 10); setSearch(""); }}>Limpar</Button>"""
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(code)
