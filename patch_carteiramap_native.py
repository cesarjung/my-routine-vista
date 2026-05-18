import os

filepath = 'src/components/views/CarteiraMapView.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    code = f.read()

import_statement = "import { NativeMarkers } from './NativeMarkers';\n"
if "import { NativeMarkers }" not in code:
    code = code.replace("import { CarteiraRow } from '@/hooks/useCarteiraDashboardData';", "import { CarteiraRow } from '@/hooks/useCarteiraDashboardData';\n" + import_statement)


old_markers = """        <LayerGroup>
        {alojamentosAtivos.map((aloj) => {
          const isBase = aloj.nome.toLowerCase().includes('base');
          return (
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
          );
        })}

        {obrasComCoords.slice(0, 300).map((obra) => (
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
        ))}"""

new_markers = """        <NativeMarkers 
          obras={obrasComCoords}
          alojamentos={alojamentosAtivos}
          createMarkerIcon={createMarkerIcon}
          createAlojamentoIcon={createAlojamentoIcon}
          onObraClick={(obra) => {
            setActivePopupObra(obra);
            if (measureMode !== 'none') {
              setMeasurePoints(prev => [...prev, L.latLng(obra.latitude!, obra.longitude!)]);
            }
          }}
          onAlojClick={(aloj) => {
            setActivePopupAloj(aloj);
            if (measureMode !== 'none') {
              setMeasurePoints(prev => [...prev, L.latLng(aloj.latitude, aloj.longitude)]);
            }
          }}
        />"""

if old_markers in code:
    code = code.replace(old_markers, new_markers)
else:
    print("Could not find old markers block. Searching via split...")
    parts = code.split("<LayerGroup>")
    if len(parts) > 1:
        rest = parts[1].split("{activePopupAloj && (")
        if len(rest) > 1:
            code = parts[0] + "<LayerGroup>\n" + new_markers + "\n        {activePopupAloj && (" + rest[1]

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(code)
