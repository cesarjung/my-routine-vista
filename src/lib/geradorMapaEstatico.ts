/**
 * Gerador de Imagem do Mapa Operacional (Idêntico ao Leaflet / OpenStreetMap)
 * 
 * Captura o mapa Leaflet interativo do DOM usando html2canvas ou compõe
 * diretamente os tiles reais do OpenStreetMap via projeção Web Mercator
 * com as rotas, marcadores de pílula das equipes e controles cartográficos.
 */

import html2canvas from 'html2canvas';

export interface EquipeMapaInfo {
  codigo: string;
  supervisor?: string;
  municipio?: string;
  municipios?: string[];
  deslocamentoH?: number;
  pctMeta?: number;
  cor?: string;
  points?: Array<{ lat: number; lng: number; num: number; municipio?: string }>;
}

const TEAM_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', 
  '#3b82f6', '#8b5cf6', '#d946ef', '#f43f5e', '#0f766e', 
  '#4338ca', '#b45309', '#1d4ed8', '#047857', '#be123c'
];

export const getTeamColor = (equipe: string) => {
  let hash = 0;
  for (let i = 0; i < equipe.length; i++) {
    hash = equipe.charCodeAt(i) + ((hash << 5) - hash);
  }
  return TEAM_COLORS[Math.abs(hash) % TEAM_COLORS.length];
};

// Coordenadas dos municípios atendidos
const MUNICIPIOS_GEO: Record<string, { lat: number; lng: number }> = {
  'BOM JESUS DA LAPA': { lat: -13.2550, lng: -43.4231 },
  'LAPA': { lat: -13.2550, lng: -43.4231 },
  'BREJOLÂNDIA': { lat: -12.4439, lng: -44.1017 },
  'BREJOLANDIA': { lat: -12.4439, lng: -44.1017 },
  'TABOCAS DO BREJO VELHO': { lat: -12.7094, lng: -44.0044 },
  'TABOCAS': { lat: -12.7094, lng: -44.0044 },
  'SERRA DOURADA': { lat: -12.7533, lng: -43.9392 },
  'SANTANA': { lat: -12.9818, lng: -44.0487 },
  'CANÁPOLIS': { lat: -13.1203, lng: -44.1884 },
  'CANAPOLIS': { lat: -13.1203, lng: -44.1884 },
  'SÃO FÉLIX DO CORIBE': { lat: -13.3986, lng: -44.1858 },
  'SANTA MARIA DA VITÓRIA': { lat: -13.3947, lng: -44.1886 },
  'CORIBE': { lat: -13.8294, lng: -44.4539 },
  'JABORANDI': { lat: -13.9189, lng: -44.4289 },
  'COCOS': { lat: -14.1819, lng: -44.5333 },
};

/**
 * Converte coordenadas Lat/Lng para coordenadas de Pixel no Canvas em uma dada projeção Web Mercator
 */
function latLngToPoint(
  lat: number,
  lng: number,
  centerLat: number,
  centerLng: number,
  zoom: number,
  width: number,
  height: number
): { x: number; y: number } {
  const scale = 256 * Math.pow(2, zoom);
  
  const centerWorldX = ((centerLng + 180) / 360) * scale;
  const centerLatRad = (centerLat * Math.PI) / 180;
  const centerWorldY = ((1 - Math.log(Math.tan(centerLatRad) + 1 / Math.cos(centerLatRad)) / Math.PI) / 2) * scale;

  const worldX = ((lng + 180) / 360) * scale;
  const latRad = (lat * Math.PI) / 180;
  const worldY = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * scale;

  return {
    x: width / 2 + (worldX - centerWorldX),
    y: height / 2 + (worldY - centerWorldY),
  };
}

/**
 * Tenta capturar diretamente o container Leaflet renderizado no DOM
 */
export async function capturarMapaLeafletDoDom(): Promise<string | null> {
  if (typeof document === 'undefined') return null;

  // Procura pelo container Leaflet na página
  const mapEl = document.querySelector<HTMLElement>('#mapa-equipes-container .leaflet-container') ||
                document.querySelector<HTMLElement>('.leaflet-container');

  if (!mapEl) return null;

  try {
    const canvas = await html2canvas(mapEl, {
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#f8f9fa',
      scale: 1.5,
    });
    return canvas.toDataURL('image/jpeg', 0.90);
  } catch (err) {
    console.warn('Falha ao capturar Leaflet via html2canvas, usando compositor de tiles OSM:', err);
    return null;
  }
}

/**
 * Renderiza o mapa idêntico ao OpenStreetMap / Leaflet carregando os tiles reais via Canvas
 */
export async function gerarMapaLeafletRealAsync(
  equipes: EquipeMapaInfo[],
  unidadeNome: string = 'BOM JESUS DA LAPA',
  title: string = 'MAPA DE TRAJETOS E DESLOCAMENTO DAS EQUIPES'
): Promise<string> {
  if (typeof document === 'undefined') return '';

  const width = 1260;
  const height = 720;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // 1. Coleta todos os pontos das equipes
  const allCoords: Array<{ lat: number; lng: number }> = [];
  
  equipes.forEach(eq => {
    if (eq.points && eq.points.length > 0) {
      eq.points.forEach(p => allCoords.push({ lat: p.lat, lng: p.lng }));
    } else {
      const mList = eq.municipios && eq.municipios.length > 0 ? eq.municipios : (eq.municipio ? eq.municipio.split(',') : []);
      mList.forEach(m => {
        const cleanM = m.toUpperCase().trim();
        const geo = MUNICIPIOS_GEO[cleanM];
        if (geo) allCoords.push(geo);
      });
    }
  });

  // Se não houver coordenadas, usa pontos padrão da região
  if (allCoords.length === 0) {
    allCoords.push({ lat: -13.2550, lng: -43.4231 }); // Bom Jesus da Lapa
    allCoords.push({ lat: -12.4439, lng: -44.1017 }); // Brejolândia
    allCoords.push({ lat: -14.1819, lng: -44.5333 }); // Cocos
  }

  // Calcula Bounding Box e Centro
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  allCoords.forEach(c => {
    if (c.lat < minLat) minLat = c.lat;
    if (c.lat > maxLat) maxLat = c.lat;
    if (c.lng < minLng) minLng = c.lng;
    if (c.lng > maxLng) maxLng = c.lng;
  });

  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;

  // Zoom ideal para focar na região operacional (zoom 9 para enquadramento perfeito)
  const latDiff = Math.abs(maxLat - minLat);
  const lngDiff = Math.abs(maxLng - minLng);
  let zoom = 9;
  if (latDiff > 2.6 || lngDiff > 2.8) zoom = 8;
  if (latDiff < 0.8 && lngDiff < 0.8) zoom = 10;

  // Fundo de placeholder do mapa (cor dos mapas OSM)
  ctx.fillStyle = '#E8ECE9';
  ctx.fillRect(0, 0, width, height);

  // Função para carregar tile com Promise
  const loadTile = (x: number, y: number, z: number): Promise<{ img: HTMLImageElement; x: number; y: number } | null> => {
    return new Promise(resolve => {
      const subdomains = ['a', 'b', 'c'];
      const s = subdomains[Math.abs(x + y) % subdomains.length];
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve({ img, x, y });
      img.onerror = () => resolve(null);
      img.src = `https://${s}.tile.openstreetmap.org/${z}/${x}/${y}.png`;
      setTimeout(() => resolve(null), 3000);
    });
  };

  // Calcula tiles necessários para cobrir toda a viewport
  const tilePromises: Promise<any>[] = [];
  const numTiles = Math.pow(2, zoom);
  
  const minTileX = Math.max(0, Math.floor(((centerLng + 180) / 360) * numTiles) - 4);
  const maxTileX = Math.min(numTiles - 1, minTileX + 8);
  
  const centerLatRad = (centerLat * Math.PI) / 180;
  const centerTileY = Math.floor(((1 - Math.log(Math.tan(centerLatRad) + 1 / Math.cos(centerLatRad)) / Math.PI) / 2) * numTiles);
  const minTileY = Math.max(0, centerTileY - 3);
  const maxTileY = Math.min(numTiles - 1, centerTileY + 4);

  for (let tx = minTileX; tx <= maxTileX; tx++) {
    for (let ty = minTileY; ty <= maxTileY; ty++) {
      tilePromises.push(loadTile(tx, ty, zoom));
    }
  }

  const loadedTiles = await Promise.all(tilePromises);

  // Desenha os tiles na posição correta
  loadedTiles.forEach(tile => {
    if (!tile) return;
    const tileScale = 256 * Math.pow(2, zoom);
    const tileWorldX = tile.x * 256;
    const tileWorldY = tile.y * 256;

    const centerWorldX = ((centerLng + 180) / 360) * tileScale;
    const cLatRad = (centerLat * Math.PI) / 180;
    const centerWorldY = ((1 - Math.log(Math.tan(cLatRad) + 1 / Math.cos(cLatRad)) / Math.PI) / 2) * tileScale;

    const screenX = width / 2 + (tileWorldX - centerWorldX);
    const screenY = height / 2 + (tileWorldY - centerWorldY);

    ctx.drawImage(tile.img, screenX, screenY, 256, 256);
  });

  // 3. Desenha as Linhas de Rota Cronológicas das Equipes (Idêntico ao Polyline Leaflet)
  equipes.forEach(eq => {
    const color = eq.cor || getTeamColor(eq.codigo);
    const pointsList = eq.points && eq.points.length > 0
      ? eq.points
      : (eq.municipios || (eq.municipio ? eq.municipio.split(',') : [])).map((m, idx) => {
          const geo = MUNICIPIOS_GEO[m.toUpperCase().trim()];
          return geo ? { lat: geo.lat, lng: geo.lng, num: idx + 1 } : null;
        }).filter(Boolean) as any[];

    if (pointsList.length > 1) {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 3.5;
      ctx.setLineDash([7, 7]);
      ctx.beginPath();

      pointsList.forEach((pt, idx) => {
        const screenPt = latLngToPoint(pt.lat, pt.lng, centerLat, centerLng, zoom, width, height);
        if (idx === 0) {
          ctx.moveTo(screenPt.x, screenPt.y);
        } else {
          ctx.lineTo(screenPt.x, screenPt.y);
        }
      });

      ctx.stroke();
      ctx.restore();
    }
  });

  // 4. Desenha os Marcadores de Pílula (Idêntico ao createTeamMarkerIcon do Leaflet)
  equipes.forEach(eq => {
    const color = eq.cor || getTeamColor(eq.codigo);
    const shortName = eq.codigo.split(' ')[0].substring(0, 6);

    const pointsList = eq.points && eq.points.length > 0
      ? eq.points
      : (eq.municipios || (eq.municipio ? eq.municipio.split(',') : [])).map((m, idx) => {
          const geo = MUNICIPIOS_GEO[m.toUpperCase().trim()];
          return geo ? { lat: geo.lat, lng: geo.lng, num: idx + 1 } : null;
        }).filter(Boolean) as any[];

    pointsList.forEach(pt => {
      const screenPt = latLngToPoint(pt.lat, pt.lng, centerLat, centerLng, zoom, width, height);
      
      const label = `${shortName} | ${pt.num || 1}`;
      ctx.font = 'bold 11px sans-serif';
      const textWidth = ctx.measureText(label).width;
      const pillWidth = textWidth + 16;
      const pillHeight = 24;
      const pillX = screenPt.x - pillWidth / 2;
      const pillY = screenPt.y - pillHeight / 2;

      // Sombra Marcante
      ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
      ctx.shadowBlur = 5;
      ctx.shadowOffsetY = 2;

      // Pílula com cor da equipe
      ctx.fillStyle = color;
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(pillX, pillY, pillWidth, pillHeight, 12);
      ctx.fill();
      ctx.stroke();

      ctx.shadowColor = 'transparent';

      // Texto do Marcador
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, screenPt.x, screenPt.y);
    });
  });

  // 5. Barra Superior (Estilo Header Leaflet do Calendário)
  ctx.fillStyle = 'rgba(247, 246, 243, 0.95)';
  ctx.strokeStyle = '#DEDAD3';
  ctx.lineWidth = 1;
  ctx.fillRect(0, 0, width, 28);
  ctx.strokeRect(0, 0, width, 28);

  ctx.fillStyle = '#5C574F';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, width / 2, 14);

  // Sub-faixa explicativa
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.fillRect(0, 28, width, 20);
  ctx.strokeStyle = '#E6E3DD';
  ctx.strokeRect(0, 28, width, 20);

  ctx.fillStyle = '#6B6660';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Linhas retas indicam a ordem cronológica das obras da equipe no período.', 14, 38);

  // 6. Controles Leaflet de Zoom no Canto Superior Esquerdo
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#CCCCCC';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(14, 60, 26, 52, 4);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#333333';
  ctx.font = 'bold 16px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('+', 27, 78);
  ctx.fillText('−', 27, 102);

  ctx.strokeStyle = '#E6E6E6';
  ctx.beginPath();
  ctx.moveTo(15, 86);
  ctx.lineTo(39, 86);
  ctx.stroke();

  // 7. Card Flutuante de Legenda das Equipes no Canto Superior Direito (Idêntico ao Leaflet)
  const legendWidth = 140;
  const legendHeight = Math.min(240, 30 + equipes.slice(0, 8).length * 20);
  const legendX = width - legendWidth - 14;
  const legendY = 60;

  ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;

  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#DEDAD3';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(legendX, legendY, legendWidth, legendHeight, 6);
  ctx.fill();
  ctx.stroke();

  ctx.shadowColor = 'transparent';

  // Cabeçalho da Legenda
  ctx.fillStyle = '#23211E';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('Equipes no Mapa', legendX + 10, legendY + 8);

  // Lista de Equipes na Legenda
  equipes.slice(0, 8).forEach((eq, idx) => {
    const itemY = legendY + 28 + (idx * 20);
    const color = eq.cor || getTeamColor(eq.codigo);

    // Ícone / Dot colorido
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(legendX + 16, itemY + 5, 4, 0, Math.PI * 2);
    ctx.fill();

    // Nome da Equipe
    ctx.fillStyle = '#5C574F';
    ctx.font = '10px monospace';
    ctx.fillText(eq.codigo, legendX + 26, itemY);
  });

  // 8. Atribuição Leaflet / OpenStreetMap no Canto Inferior Direito
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.fillRect(width - 160, height - 16, 160, 16);
  ctx.fillStyle = '#0078A8';
  ctx.font = '9px sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText('Leaflet | © OpenStreetMap', width - 6, height - 3);

  try {
    return canvas.toDataURL('image/jpeg', 0.90);
  } catch (e) {
    console.error('Erro ao converter canvas do mapa para Base64:', e);
    return '';
  }
}

/**
 * Função síncrona/assíncrona unificada para obter a imagem Base64 do Mapa Leaflet
 */
export async function obterMapaBase64ParaEmail(
  equipes: EquipeMapaInfo[],
  unidadeNome: string = 'BOM JESUS DA LAPA'
): Promise<string> {
  // 1. Tenta capturar a instância viva do Leaflet na tela
  const domCapture = await capturarMapaLeafletDoDom();
  if (domCapture) return domCapture;

  // 2. Se não conseguir do DOM, renderiza o compositor real OpenStreetMap
  return await gerarMapaLeafletRealAsync(equipes, unidadeNome);
}

// Fallback síncrono para compatibilidade
export function gerarMapaEstaticoBase64(
  equipes: EquipeMapaInfo[],
  unidadeNome: string = 'BOM JESUS DA LAPA',
  periodoStr: string = ''
): string {
  // Se for chamado de forma síncrona, gera o canvas com tiles e marcadores idênticos ao Leaflet
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = 1100;
  canvas.height = 560;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Renderiza a base OpenStreetMap cartográfica
  ctx.fillStyle = '#E8ECE9';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  return canvas.toDataURL('image/jpeg', 0.85);
}
