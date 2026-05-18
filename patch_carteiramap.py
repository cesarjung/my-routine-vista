import os

filepath = 'src/components/views/CarteiraMapView.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    code = f.read()

# Add useAlojamentos import
if "import { useAlojamentos }" not in code:
    code = code.replace("import { CarteiraRow } from '@/hooks/useCarteiraDashboardData';", "import { CarteiraRow } from '@/hooks/useCarteiraDashboardData';\nimport { useAlojamentos } from '@/hooks/useAlojamentos';")

# Add icons logic
icon_logic = """
const createAlojamentoIcon = (isBase: boolean) => {
  const bgColor = isBase ? 'bg-blue-600' : 'bg-green-600';
  const svgIcon = isBase 
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-building-2 text-white"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/></svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-home text-white"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;
  
  return L.divIcon({
    className: 'custom-alojamento-icon',
    html: `<div class="${bgColor} w-8 h-8 rounded-full border-2 border-white shadow-lg flex items-center justify-center">${svgIcon}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
};
"""

if "createAlojamentoIcon" not in code:
    code = code.replace("type MeasureMode", icon_logic + "\ntype MeasureMode")

# Add hook call
if "const { alojamentos } = useAlojamentos();" not in code:
    code = code.replace("const [measureMode, setMeasureMode]", "const { alojamentos } = useAlojamentos();\n  const [measureMode, setMeasureMode]")

# Filter alojamentos
filter_logic = """
  // Extract unique Unidade Nomes from current filtered obras
  const unidadesNoMapa = Array.from(new Set(obras.map(o => o.unidadeNome))).filter(Boolean);
  
  // Only show alojamentos that belong to the filtered units
  const alojamentosAtivos = alojamentos.filter(a => unidadesNoMapa.includes(a.unidadeNome));
"""
if "alojamentosAtivos" not in code:
    code = code.replace("const straightDistance", filter_logic + "\n  const straightDistance")

# Render alojamentos
render_logic = """
        {alojamentosAtivos.map((aloj) => {
          const isBase = aloj.nome.toLowerCase().includes('base');
          return (
            <Marker 
              key={aloj.id} 
              position={[aloj.latitude, aloj.longitude]} 
              icon={createAlojamentoIcon(isBase)}
              eventHandlers={{
                click: (e) => {
                  if (measureMode !== 'none') {
                    setMeasurePoints(prev => [...prev, L.latLng(aloj.latitude, aloj.longitude)]);
                  }
                }
              }}
            >
              <Tooltip direction="top" offset={[0, -10]} opacity={0.95} className="custom-tooltip">
                <div className="flex flex-col gap-1 p-1 min-w-[150px]">
                  <h4 className="font-bold text-sm text-primary mb-1 border-b pb-1">{aloj.nome}</h4>
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-muted-foreground">Unidade:</span>
                    <span className="font-medium text-foreground">{aloj.unidadeNome}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-muted-foreground">Capacidade:</span>
                    <span className="font-medium text-foreground">{aloj.capacidade} pessoas</span>
                  </div>
                </div>
              </Tooltip>
            </Marker>
          );
        })}

"""
if "alojamentosAtivos.map" not in code:
    code = code.replace("{obrasComCoords.slice(0, 300).map((obra)", render_logic + "        {obrasComCoords.slice(0, 300).map((obra)")

# Add legend for alojamentos
legend_logic = """
          <div className="mt-3 pt-3 border-t border-border">
            <h4 className="font-bold mb-2">Locais e Bases</h4>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-green-600 border border-white flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-white"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></div>
                Alojamentos
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-blue-600 border border-white flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-white"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/></svg></div>
                Bases / Indústria
              </div>
            </div>
          </div>
"""
if "Locais e Bases" not in code:
    code = code.replace("</div>\n        </div>\n      </div>\n    </div>", "</div>\n        </div>\n" + legend_logic + "      </div>\n    </div>")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(code)
