/**
 * Gerador de Imagem do Mapa Operacional (Idêntico ao Leaflet / OpenStreetMap)
 * 
 * Captura o mapa Leaflet interativo do DOM usando html2canvas ou compõe
 * diretamente os tiles reais do OpenStreetMap via projeção Web Mercator
 * com as rotas, marcadores de pílula das equipes e controles cartográficos.
 */

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
 * Converte coordenadas lat/lng para pixel no canvas usando projeção Web Mercator
 */
function latLngToPixel(
  lat: number, lng: number,
  centerLat: number, centerLng: number,
  zoom: number,
  canvasW: number, canvasH: number
): { x: number; y: number } {
  const tileSize = 256;
  const scale = tileSize * Math.pow(2, zoom);

  const worldX = (lng + 180) / 360 * scale;
  const latRad = lat * Math.PI / 180;
  const worldY = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * scale;

  const cLng = centerLng;
  const cLat = centerLat;
  const cWorldX = (cLng + 180) / 360 * scale;
  const cLatRad = cLat * Math.PI / 180;
  const cWorldY = (1 - Math.log(Math.tan(cLatRad) + 1 / Math.cos(cLatRad)) / Math.PI) / 2 * scale;

  return {
    x: canvasW / 2 + (worldX - cWorldX),
    y: canvasH / 2 + (worldY - cWorldY),
  };
}

/**
 * Renderiza o mapa idêntico ao Leaflet / OpenStreetMap com tiles reais
 * Zoom FIXO em 9 (igual ao Leaflet com fitBounds da região operacional)
 */
export async function gerarMapaLeafletRealAsync(
  equipes: EquipeMapaInfo[],
  unidadeNome: string = 'BOM JESUS DA LAPA',
  title: string = 'MAPA DE TRAJETOS E DESLOCAMENTO DAS EQUIPES'
): Promise<string> {
  if (typeof document === 'undefined') return '';

  // Canvas grande para o e-mail – mesma proporção do Leaflet na tela
  const CANVAS_W = 1440;
  const CANVAS_H = 820;
  const TILE_SIZE = 256;

  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // 1. Coleta todos os pontos ativos das equipes
  const allCoords: Array<{ lat: number; lng: number }> = [];
  equipes.forEach(eq => {
    if (eq.points && eq.points.length > 0) {
      eq.points.forEach(p => allCoords.push({ lat: p.lat, lng: p.lng }));
    } else {
      const mList = eq.municipios?.length ? eq.municipios : (eq.municipio ? eq.municipio.split(',') : []);
      mList.forEach(m => {
        const geo = MUNICIPIOS_GEO[m.toUpperCase().trim()];
        if (geo) allCoords.push(geo);
      });
    }
  });

  // Filtra apenas coords de municípios operacionais (exclui a base Bom Jesus que puxa o centro p/ Leste)
  const BASE_LNG = -43.4231;
  const operacionalCoords = allCoords.filter(c => c.lng < BASE_LNG - 0.1);
  const coordsParaCentro = operacionalCoords.length > 0 ? operacionalCoords : allCoords;

  // Bounding box real dos pontos
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  if (coordsParaCentro.length > 0) {
    coordsParaCentro.forEach(c => {
      if (c.lat < minLat) minLat = c.lat;
      if (c.lat > maxLat) maxLat = c.lat;
      if (c.lng < minLng) minLng = c.lng;
      if (c.lng > maxLng) maxLng = c.lng;
    });
  } else {
    // Fallback: região operacional padrão
    minLat = -14.5; maxLat = -12.0; minLng = -45.0; maxLng = -43.3;
  }

  // Centro = centróide do bounding box
  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;

  // Zoom idêntico ao Leaflet fitBounds com padding de ~55px (como no componente)
  // Calcula o zoom máximo em que o bbox cabe no canvas com padding
  const PADDING = 55;
  const usableW = CANVAS_W - PADDING * 2;
  const usableH = CANVAS_H - PADDING * 2;

  function latLngToWorldXY(lat: number, lng: number, z: number) {
    const n = Math.pow(2, z) * 256;
    const x = (lng + 180) / 360 * n;
    const latR = lat * Math.PI / 180;
    const y = (1 - Math.log(Math.tan(latR) + 1 / Math.cos(latR)) / Math.PI) / 2 * n;
    return { x, y };
  }

  let ZOOM = 9; // padrão
  for (let z = 13; z >= 6; z--) {
    const topLeft = latLngToWorldXY(maxLat, minLng, z);
    const botRight = latLngToWorldXY(minLat, maxLng, z);
    const bboxW = Math.abs(botRight.x - topLeft.x);
    const bboxH = Math.abs(botRight.y - topLeft.y);
    if (bboxW <= usableW && bboxH <= usableH) {
      ZOOM = z;
      break;
    }
  }

  // 2. Fundo provisório
  ctx.fillStyle = '#E8ECE9';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // 3. Calcula range de tiles necessários para cobrir o canvas inteiro
  const numTiles = Math.pow(2, ZOOM);
  const scale = TILE_SIZE * numTiles;

  const cWorldX = (centerLng + 180) / 360 * scale;
  const cLatRad = centerLat * Math.PI / 180;
  const cWorldY = (1 - Math.log(Math.tan(cLatRad) + 1 / Math.cos(cLatRad)) / Math.PI) / 2 * scale;

  // tile X/Y do canto superior esquerdo do canvas
  const topLeftWorldX = cWorldX - CANVAS_W / 2;
  const topLeftWorldY = cWorldY - CANVAS_H / 2;

  const tileX0 = Math.floor(topLeftWorldX / TILE_SIZE) - 1;
  const tileY0 = Math.floor(topLeftWorldY / TILE_SIZE) - 1;

  // tile X/Y do canto inferior direito
  const botRightWorldX = cWorldX + CANVAS_W / 2;
  const botRightWorldY = cWorldY + CANVAS_H / 2;
  const tileX1 = Math.floor(botRightWorldX / TILE_SIZE) + 1;
  const tileY1 = Math.floor(botRightWorldY / TILE_SIZE) + 1;

  // Clamp dentro dos limites do mapa
  const clampedX0 = Math.max(0, tileX0);
  const clampedX1 = Math.min(numTiles - 1, tileX1);
  const clampedY0 = Math.max(0, tileY0);
  const clampedY1 = Math.min(numTiles - 1, tileY1);

  // 4. Carrega os tiles em paralelo
  const loadTile = (tx: number, ty: number): Promise<{ img: HTMLImageElement; tx: number; ty: number } | null> =>
    new Promise(resolve => {
      const sub = ['a', 'b', 'c'][(tx + ty) % 3];
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve({ img, tx, ty });
      img.onerror = () => resolve(null);
      img.src = `https://${sub}.tile.openstreetmap.org/${ZOOM}/${tx}/${ty}.png`;
      setTimeout(() => resolve(null), 4000);
    });

  const tilePromises: Promise<any>[] = [];
  for (let tx = clampedX0; tx <= clampedX1; tx++) {
    for (let ty = clampedY0; ty <= clampedY1; ty++) {
      tilePromises.push(loadTile(tx, ty));
    }
  }
  const tiles = await Promise.all(tilePromises);

  // 5. Desenha os tiles no canvas
  tiles.forEach(t => {
    if (!t) return;
    const tileWorldX = t.tx * TILE_SIZE;
    const tileWorldY = t.ty * TILE_SIZE;
    const screenX = CANVAS_W / 2 + (tileWorldX - cWorldX);
    const screenY = CANVAS_H / 2 + (tileWorldY - cWorldY);
    ctx.drawImage(t.img, screenX, screenY, TILE_SIZE, TILE_SIZE);
  });

  // Função auxiliar para converter lat/lng em coordenada de pixel no canvas
  const toScreen = (lat: number, lng: number) =>
    latLngToPixel(lat, lng, centerLat, centerLng, ZOOM, CANVAS_W, CANVAS_H);

  // 6. Polilinhas das equipes (tracejado idêntico ao Leaflet)
  equipes.forEach(eq => {
    const color = eq.cor || getTeamColor(eq.codigo);
    const pts = resolvePoints(eq);
    if (pts.length < 2) return;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3.5;
    ctx.setLineDash([8, 8]);
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    pts.forEach((p, i) => {
      const s = toScreen(p.lat, p.lng);
      i === 0 ? ctx.moveTo(s.x, s.y) : ctx.lineTo(s.x, s.y);
    });
    ctx.stroke();
    ctx.restore();
  });

  // 7. Marcadores tipo pílula (idêntico ao Leaflet createTeamMarkerIcon)
  const PILL_H = 26;
  const FONT = 'bold 12px sans-serif';
  ctx.font = FONT;

  equipes.forEach(eq => {
    const color = eq.cor || getTeamColor(eq.codigo);
    const short = eq.codigo.length > 7 ? eq.codigo.substring(0, 7) : eq.codigo;
    const pts = resolvePoints(eq);

    pts.forEach(pt => {
      const s = toScreen(pt.lat, pt.lng);
      const label = `${short} | ${pt.num || 1}`;
      ctx.font = FONT;
      const tw = ctx.measureText(label).width;
      const pw = tw + 18;
      const px = s.x - pw / 2;
      const py = s.y - PILL_H / 2;

      // Sombra
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 2;

      // Pílula
      ctx.fillStyle = color;
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(px, py, pw, PILL_H, 13);
      ctx.fill();
      ctx.stroke();
      ctx.shadowColor = 'transparent';

      // Texto
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, s.x, s.y);
    });
  });

  // 8. Header do mapa (idêntico ao Leaflet)
  const HDR_H = 26;
  const SUB_H = 18;
  ctx.fillStyle = 'rgba(247, 246, 243, 0.96)';
  ctx.strokeStyle = '#DEDAD3';
  ctx.lineWidth = 1;
  ctx.fillRect(0, 0, CANVAS_W, HDR_H);
  ctx.strokeRect(0, 0, CANVAS_W, HDR_H);

  ctx.fillStyle = '#5C574F';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, CANVAS_W / 2, HDR_H / 2);

  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  ctx.fillRect(0, HDR_H, CANVAS_W, SUB_H);
  ctx.strokeRect(0, HDR_H, CANVAS_W, SUB_H);
  ctx.fillStyle = '#6B6660';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Linhas retas indicam a ordem cronológica das obras da equipe no período.', 12, HDR_H + SUB_H / 2);

  // 9. Controles de zoom (idêntico ao Leaflet)
  const ZX = 14, ZY = HDR_H + SUB_H + 8;
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#CCCCCC';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(ZX, ZY, 28, 56, 4);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#333';
  ctx.font = 'bold 18px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('+', ZX + 14, ZY + 14);
  ctx.fillText('−', ZX + 14, ZY + 42);
  ctx.strokeStyle = '#DDD';
  ctx.beginPath();
  ctx.moveTo(ZX + 1, ZY + 28);
  ctx.lineTo(ZX + 27, ZY + 28);
  ctx.stroke();

  // 10. Legenda de equipes (canto superior direito – idêntico ao Leaflet)
  const eqList = equipes.slice(0, 12);
  const LEG_W = 150;
  const LEG_H = 26 + eqList.length * 22;
  const LEG_X = CANVAS_W - LEG_W - 12;
  const LEG_Y = HDR_H + SUB_H + 8;

  ctx.shadowColor = 'rgba(0,0,0,0.12)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#DEDAD3';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(LEG_X, LEG_Y, LEG_W, LEG_H, 6);
  ctx.fill();
  ctx.stroke();
  ctx.shadowColor = 'transparent';

  ctx.fillStyle = '#23211E';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('Equipes no Mapa', LEG_X + 10, LEG_Y + 7);

  eqList.forEach((eq, i) => {
    const iy = LEG_Y + 26 + i * 22;
    const c = eq.cor || getTeamColor(eq.codigo);
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(LEG_X + 16, iy + 8, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5C574F';
    ctx.font = '10px monospace';
    ctx.textBaseline = 'top';
    ctx.fillText(eq.codigo, LEG_X + 26, iy + 2);
  });

  // 11. Atribuição OSM
  ctx.fillStyle = 'rgba(255,255,255,0.82)';
  ctx.fillRect(CANVAS_W - 165, CANVAS_H - 16, 165, 16);
  ctx.fillStyle = '#0078A8';
  ctx.font = '9px sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText('Leaflet | © OpenStreetMap', CANVAS_W - 5, CANVAS_H - 2);

  return canvas.toDataURL('image/jpeg', 0.92);
}

/** Resolve lista de pontos de uma equipe (pontos reais ou coordenadas de município) */
function resolvePoints(eq: EquipeMapaInfo): Array<{ lat: number; lng: number; num: number }> {
  if (eq.points && eq.points.length > 0) {
    return eq.points as any[];
  }
  const mList = eq.municipios?.length ? eq.municipios : (eq.municipio ? eq.municipio.split(',') : []);
  return mList
    .map((m, idx) => {
      const geo = MUNICIPIOS_GEO[m.toUpperCase().trim()];
      return geo ? { lat: geo.lat, lng: geo.lng, num: idx + 1 } : null;
    })
    .filter(Boolean) as any[];
}

/**
 * Tenta capturar a instância viva do Leaflet na tela via html2canvas
 */
export async function capturarMapaLeafletDoDom(): Promise<string | null> {
  if (typeof document === 'undefined') return null;
  const mapEl = document.querySelector<HTMLElement>('#mapa-equipes-container .leaflet-container') ||
                document.querySelector<HTMLElement>('.leaflet-container');
  if (!mapEl) return null;
  try {
    const { default: html2canvas } = await import('html2canvas');
    const c = await html2canvas(mapEl, {
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#f8f9fa',
      scale: 1.5,
    });
    return c.toDataURL('image/jpeg', 0.92);
  } catch {
    return null;
  }
}

/**
 * Função principal para obter a imagem Base64 do Mapa para o e-mail:
 * 1. Tenta capturar a instância viva do Leaflet na tela
 * 2. Fallback: renderiza composição OSM real
 */
export async function obterMapaBase64ParaEmail(
  equipes: EquipeMapaInfo[],
  unidadeNome: string = 'BOM JESUS DA LAPA'
): Promise<string> {
  const domCapture = await capturarMapaLeafletDoDom();
  if (domCapture) return domCapture;
  return await gerarMapaLeafletRealAsync(equipes, unidadeNome);
}

// Fallback síncrono (mantido por compatibilidade – retorna canvas em branco)
export function gerarMapaEstaticoBase64(
  _equipes: EquipeMapaInfo[],
  _unidadeNome: string = 'BOM JESUS DA LAPA',
  _periodoStr: string = ''
): string {
  if (typeof document === 'undefined') return '';
  const c = document.createElement('canvas');
  c.width = 1440; c.height = 820;
  const ctx = c.getContext('2d');
  if (!ctx) return '';
  ctx.fillStyle = '#E8ECE9';
  ctx.fillRect(0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.85);
}

