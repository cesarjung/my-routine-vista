import { MapContainer, TileLayer, Marker, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { CarteiraRow } from '@/hooks/useCarteiraDashboardData';

// Fix for default marker icons in Leaflet with React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface CarteiraMapViewProps {
  obras: CarteiraRow[];
}

const STATUS_COLORS: Record<string, string> = {
  'CONCLUÍD': 'bg-green-600',
  'CONCLUID': 'bg-green-600',
  'ENERGIZAD': 'bg-yellow-500',
  'PROGRAMAD': 'bg-blue-500',
  'EM ANDAMENTO': 'bg-purple-500',
  'EXECUÇÃO': 'bg-purple-500',
  'VISTORIAD': 'bg-cyan-500',
  'INAPT': 'bg-red-500',
  'SEM ORÇAMENTO': 'bg-orange-500',
  'default': 'bg-slate-400'
};

const getStatusColor = (s: string) => {
  if (!s) return STATUS_COLORS.default;
  const upperS = s.toUpperCase();
  for (const key in STATUS_COLORS) {
    if (upperS.includes(key)) return STATUS_COLORS[key];
  }
  return STATUS_COLORS.default;
};

const getPostesTextColor = (postes: number) => {
  if (postes <= 10) return '#ffffff'; // White
  if (postes <= 20) return '#67e8f9'; // Cyan-300
  if (postes <= 30) return '#fde047'; // Yellow-300
  if (postes <= 100) return '#fdba74'; // Orange-300
  return '#fca5a5'; // Red-300
};

const createMarkerIcon = (status: string, postes: number) => {
  const colorClass = getStatusColor(status);
  const textColor = getPostesTextColor(postes);
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div class="${colorClass} w-8 h-8 rounded-full border-[2px] border-white shadow-md flex items-center justify-center text-[11px] font-bold leading-none tracking-tighter" style="color: ${textColor}; text-shadow: 1px 1px 3px rgba(0,0,0,0.9);">${postes}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
};

export const CarteiraMapView = ({ obras }: CarteiraMapViewProps) => {
  // Posição padrão (Bahia) se nenhuma obra tiver coordenadas
  const defaultCenter: [number, number] = [-12.9714, -38.5014];
  
  const obrasComCoords = obras.filter(o => o.latitude !== null && o.longitude !== null);
  
  const center = obrasComCoords.length > 0 
    ? [obrasComCoords[0].latitude!, obrasComCoords[0].longitude!] as [number, number]
    : defaultCenter;

  return (
    <div className="w-full h-full min-h-[500px] rounded-xl overflow-hidden border border-border shadow-sm z-0 relative">
      <MapContainer center={center} zoom={6} scrollWheelZoom={true} style={{ height: '100%', width: '100%', zIndex: 1 }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {obrasComCoords.map((obra) => (
          <Marker key={obra.id} position={[obra.latitude!, obra.longitude!]} icon={createMarkerIcon(obra.statusExecucao, obra.postesDisponiveis)}>
            <Tooltip direction="top" offset={[0, -10]} opacity={0.95} className="custom-tooltip">
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
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>
      
      {/* Legenda */}
      <div className="absolute bottom-6 right-6 z-[1000] bg-background/95 backdrop-blur-sm p-3 rounded-lg shadow-md border border-border text-xs">
        <h4 className="font-bold mb-2">Legenda (Status)</h4>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-green-600 border border-white"></div> CONCLUÍDA</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-yellow-500 border border-white"></div> ENERGIZADA</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-500 border border-white"></div> PROGRAMADA</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-purple-500 border border-white"></div> EM ANDAMENTO</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-cyan-500 border border-white"></div> VISTORIADA</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-orange-500 border border-white"></div> SEM ORÇAMENTO</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500 border border-white"></div> INAPTA</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-slate-400 border border-white"></div> OUTROS / S/ INF.</div>
        </div>

        <div className="mt-3 pt-3 border-t border-border">
          <h4 className="font-bold mb-2">Qtd. Postes</h4>
          <div className="space-y-1.5 font-bold tracking-tight">
            <div className="flex items-center gap-2"><span style={{ color: '#ffffff', textShadow: '1px 1px 2px #000' }}>Até 10</span></div>
            <div className="flex items-center gap-2"><span style={{ color: '#67e8f9', textShadow: '1px 1px 2px #000' }}>11 a 20</span></div>
            <div className="flex items-center gap-2"><span style={{ color: '#fde047', textShadow: '1px 1px 2px #000' }}>21 a 30</span></div>
            <div className="flex items-center gap-2"><span style={{ color: '#fdba74', textShadow: '1px 1px 2px #000' }}>31 a 100</span></div>
            <div className="flex items-center gap-2"><span style={{ color: '#fca5a5', textShadow: '1px 1px 2px #000' }}>Acima de 100</span></div>
          </div>
        </div>
      </div>
    </div>
  );
};
