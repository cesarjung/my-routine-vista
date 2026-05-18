import os

filepath = 'src/components/views/CarteiraMapView.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    code = f.read()

# Add states
if "const [activePopupObra, setActivePopupObra] = useState<CarteiraRow | null>(null);" not in code:
    code = code.replace(
        "const [routeData, setRouteData] = useState<RouteData | null>(null);",
        "const [routeData, setRouteData] = useState<RouteData | null>(null);\n  const [activePopupObra, setActivePopupObra] = useState<CarteiraRow | null>(null);\n  const [activePopupAloj, setActivePopupAloj] = useState<any | null>(null);"
    )

# Alojamentos loop
old_aloj_marker = """
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
              <Popup offset={[0, -10]} className="custom-popup">
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
              </Popup>
            </Marker>
"""

new_aloj_marker = """
            <Marker 
              key={aloj.id} 
              position={[aloj.latitude, aloj.longitude]} 
              icon={createAlojamentoIcon(isBase)}
              eventHandlers={{
                click: (e) => {
                  setActivePopupAloj(aloj);
                  if (measureMode !== 'none') {
                    setMeasurePoints(prev => [...prev, L.latLng(aloj.latitude, aloj.longitude)]);
                  }
                }
              }}
            />
"""

if old_aloj_marker.strip() in code:
    code = code.replace(old_aloj_marker, new_aloj_marker)
else:
    # try a more flexible replace using regex if needed, but manual replace is safer. Let's just do an isolated rewrite if it fails
    pass

# Obras loop
old_obra_marker = """
          <Marker 
            key={obra.id} 
            position={[obra.latitude!, obra.longitude!]} 
            icon={createMarkerIcon(obra.statusExecucao, obra.postesDisponiveis)}
            eventHandlers={{
              click: (e) => {
                if (measureMode !== 'none') {
                  setMeasurePoints(prev => [...prev, L.latLng(obra.latitude!, obra.longitude!)]);
                }
              }
            }}
          >
            <Popup offset={[0, -10]} className="custom-popup">
              <div className="flex flex-col gap-1 p-1 min-w-[200px]">
                <h4 className="font-bold text-sm text-primary mb-1 border-b pb-1 truncate max-w-[250px]" title={`${obra.projeto} - ${obra.titulo}`}>{obra.projeto} - {obra.titulo}</h4>
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-muted-foreground">Status:</span>
                  <span className="font-medium text-foreground">{obra.statusExecucao || 'Não informado'}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-muted-foreground">Postes:</span>
                  <span className="font-medium text-foreground">{obra.postesDisponiveis}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-muted-foreground">Valor:</span>
                  <span className="font-medium text-foreground">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(obra.capacidadeFaturamento)}
                  </span>
                </div>
              </div>
            </Popup>
          </Marker>
"""

new_obra_marker = """
          <Marker 
            key={obra.id} 
            position={[obra.latitude!, obra.longitude!]} 
            icon={createMarkerIcon(obra.statusExecucao, obra.postesDisponiveis)}
            eventHandlers={{
              click: (e) => {
                setActivePopupObra(obra);
                if (measureMode !== 'none') {
                  setMeasurePoints(prev => [...prev, L.latLng(obra.latitude!, obra.longitude!)]);
                }
              }
            }}
          />
"""

if old_obra_marker.strip() in code:
    code = code.replace(old_obra_marker, new_obra_marker)


# Render single popups
single_popups = """
        {activePopupAloj && (
          <Popup position={[activePopupAloj.latitude, activePopupAloj.longitude]} onClose={() => setActivePopupAloj(null)} offset={[0, -10]} className="custom-popup">
            <div className="flex flex-col gap-1 p-1 min-w-[150px]">
              <h4 className="font-bold text-sm text-primary mb-1 border-b pb-1">{activePopupAloj.nome}</h4>
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-muted-foreground">Unidade:</span>
                <span className="font-medium text-foreground">{activePopupAloj.unidadeNome}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-muted-foreground">Capacidade:</span>
                <span className="font-medium text-foreground">{activePopupAloj.capacidade} pessoas</span>
              </div>
            </div>
          </Popup>
        )}

        {activePopupObra && (
          <Popup position={[activePopupObra.latitude!, activePopupObra.longitude!]} onClose={() => setActivePopupObra(null)} offset={[0, -10]} className="custom-popup">
            <div className="flex flex-col gap-1 p-1 min-w-[200px]">
              <h4 className="font-bold text-sm text-primary mb-1 border-b pb-1 truncate max-w-[250px]" title={`${activePopupObra.projeto} - ${activePopupObra.titulo}`}>{activePopupObra.projeto} - {activePopupObra.titulo}</h4>
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-muted-foreground">Status:</span>
                <span className="font-medium text-foreground">{activePopupObra.statusExecucao || 'Não informado'}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-muted-foreground">Postes:</span>
                <span className="font-medium text-foreground">{activePopupObra.postesDisponiveis}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-muted-foreground">Valor:</span>
                <span className="font-medium text-foreground">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(activePopupObra.capacidadeFaturamento)}
                </span>
              </div>
            </div>
          </Popup>
        )}
        </LayerGroup>
"""

if "{activePopupObra && (" not in code:
    code = code.replace("</LayerGroup>", single_popups)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(code)
