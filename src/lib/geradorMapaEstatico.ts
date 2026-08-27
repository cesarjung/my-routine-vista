/**
 * Gerador de Imagem Cartográfica do Mapa Operacional de Deslocamento das Equipes
 * 
 * Renderiza um mapa vetorial de alta definição em Canvas 2D com a base central,
 * trajetos rodoviários, municípios das frentes de serviço, pins das equipes e legenda.
 * Retorna uma string Base64 (data:image/jpeg;base64,...) compatível com e-mails corporativos.
 */

export interface EquipeMapaInfo {
  codigo: string;
  supervisor?: string;
  municipio?: string;
  municipios?: string[];
  deslocamentoH?: number;
  pctMeta?: number;
  cor?: string;
}

// Coordenadas aproximadas dos municípios da região Oeste da Bahia (referência Bom Jesus da Lapa)
const MUNICIPIOS_GEO: Record<string, { lat: number; lng: number; xRel: number; yRel: number; nome: string }> = {
  'BOM JESUS DA LAPA': { lat: -13.2550, lng: -43.4231, xRel: 0.68, yRel: 0.52, nome: 'Bom Jesus da Lapa (Base)' },
  'LAPA': { lat: -13.2550, lng: -43.4231, xRel: 0.68, yRel: 0.52, nome: 'Bom Jesus da Lapa' },
  'BREJOLÂNDIA': { lat: -12.4439, lng: -44.1017, xRel: 0.46, yRel: 0.16, nome: 'Brejolândia' },
  'BREJOLANDIA': { lat: -12.4439, lng: -44.1017, xRel: 0.46, yRel: 0.16, nome: 'Brejolândia' },
  'TABOCAS DO BREJO VELHO': { lat: -12.7094, lng: -44.0044, xRel: 0.48, yRel: 0.26, nome: 'Tabocas do Brejo Velho' },
  'TABOCAS': { lat: -12.7094, lng: -44.0044, xRel: 0.48, yRel: 0.26, nome: 'Tabocas' },
  'SERRA DOURADA': { lat: -12.7533, lng: -43.9392, xRel: 0.53, yRel: 0.28, nome: 'Serra Dourada' },
  'SANTANA': { lat: -12.9818, lng: -44.0487, xRel: 0.48, yRel: 0.38, nome: 'Santana' },
  'CANÁPOLIS': { lat: -13.1203, lng: -44.1884, xRel: 0.41, yRel: 0.44, nome: 'Canápolis' },
  'CANAPOLIS': { lat: -13.1203, lng: -44.1884, xRel: 0.41, yRel: 0.44, nome: 'Canápolis' },
  'SÃO FÉLIX DO CORIBE': { lat: -13.3986, lng: -44.1858, xRel: 0.42, yRel: 0.58, nome: 'São Félix do Coribe' },
  'SANTA MARIA DA VITÓRIA': { lat: -13.3947, lng: -44.1886, xRel: 0.40, yRel: 0.58, nome: 'Santa Maria da Vitória' },
  'CORIBE': { lat: -13.8294, lng: -44.4539, xRel: 0.32, yRel: 0.74, nome: 'Coribe' },
  'JABORANDI': { lat: -13.9189, lng: -44.4289, xRel: 0.34, yRel: 0.82, nome: 'Jaborandi' },
  'COCOS': { lat: -14.1819, lng: -44.5333, xRel: 0.26, yRel: 0.90, nome: 'Cocos' },
};

const CORES_PALETA = [
  '#E07A1F', '#2563EB', '#059669', '#7C3AED', '#DC2626', 
  '#D97706', '#0284C7', '#4F46E5', '#0D9488', '#E11D48',
  '#475569', '#B45309', '#15803D', '#6D28D9', '#9333EA'
];

export function gerarMapaEstaticoBase64(
  equipes: EquipeMapaInfo[],
  unidadeNome: string = 'BOM JESUS DA LAPA',
  periodoStr: string = ''
): string {
  if (typeof document === 'undefined') return '';

  const width = 1000;
  const height = 580;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // 1. Fundo Gradiente Suave (Estilo Cartográfico Elegante)
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#F5F2EB');
  bgGrad.addColorStop(0.5, '#EFEBE2');
  bgGrad.addColorStop(1, '#E8E3D7');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // 2. Grade de Coordenadas Geográficas (Linhas Finas)
  ctx.strokeStyle = '#DFDAD0';
  ctx.lineWidth = 1;
  for (let x = 60; x < width; x += 80) {
    ctx.beginPath();
    ctx.moveTo(x, 40);
    ctx.lineTo(x, height - 30);
    ctx.stroke();
  }
  for (let y = 50; y < height - 30; y += 70) {
    ctx.beginPath();
    ctx.moveTo(40, y);
    ctx.lineTo(width - 40, y);
    ctx.stroke();
  }

  // 3. Rio São Francisco (Curva Cartográfica Estilizada)
  ctx.strokeStyle = '#BDD5E7';
  ctx.lineWidth = 18;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(width * 0.72, 40);
  ctx.bezierCurveTo(width * 0.69, height * 0.35, width * 0.67, height * 0.65, width * 0.70, height - 30);
  ctx.stroke();

  // Margens do Rio
  ctx.strokeStyle = '#9BBFD9';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Label do Rio
  ctx.save();
  ctx.translate(width * 0.72, height * 0.40);
  ctx.rotate(Math.PI / 2.3);
  ctx.fillStyle = '#6E9AB9';
  ctx.font = 'italic 11px sans-serif';
  ctx.fillText('Rio São Francisco', 0, 0);
  ctx.restore();

  // Posição da Base Central
  const baseX = width * 0.68;
  const baseY = height * 0.52;

  // 4. Mapear e Agrupar Municípios com Equipes
  const frentesMap = new Map<string, { x: number; y: number; nome: string; equipes: EquipeMapaInfo[] }>();

  equipes.forEach((eq, idx) => {
    const cor = eq.cor || CORES_PALETA[idx % CORES_PALETA.length];
    eq.cor = cor;

    const munList: string[] = [];
    if (eq.municipios && eq.municipios.length > 0) {
      munList.push(...eq.municipios);
    } else if (eq.municipio) {
      munList.push(...eq.municipio.split(',').map(m => m.trim()));
    }

    munList.forEach(m => {
      const cleanM = m.toUpperCase().trim();
      if (!cleanM || cleanM === 'FOLGA' || cleanM === 'FERIADO') return;

      const geo = MUNICIPIOS_GEO[cleanM] || {
        nome: m,
        xRel: 0.38 + (Math.sin(idx * 1.5) * 0.18),
        yRel: 0.45 + (Math.cos(idx * 1.5) * 0.25)
      };

      const key = geo.nome;
      if (!frentesMap.has(key)) {
        frentesMap.set(key, {
          x: width * geo.xRel,
          y: height * geo.yRel,
          nome: geo.nome,
          equipes: []
        });
      }
      frentesMap.get(key)!.equipes.push(eq);
    });
  });

  // 5. Desenhar Rotas e Raios de Deslocamento da Base até cada Frente
  frentesMap.forEach(frente => {
    if (frente.nome.includes('Base')) return;

    // Linha de Trajeto Pontilhada
    ctx.save();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = '#A39E96';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(baseX, baseY);
    ctx.lineTo(frente.x, frente.y);
    ctx.stroke();
    ctx.restore();

    // Distância estimada / tempo no ponto médio da rota
    const midX = (baseX + frente.x) / 2;
    const midY = (baseY + frente.y) / 2;
    const distPx = Math.hypot(frente.x - baseX, frente.y - baseY);
    const tempoEstimadoH = ((distPx / width) * 4.5).toFixed(1).replace('.', ',');

    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#DEDAD3';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(midX - 22, midY - 9, 44, 18, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#6B6660';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${tempoEstimadoH}h`, midX, midY);
  });

  // 6. Desenhar Pins e Cards dos Municípios / Frentes de Serviço
  frentesMap.forEach(frente => {
    const isBase = frente.nome.includes('Base');
    if (isBase) return;

    // Marcador do Município
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#E07A1F';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(frente.x, frente.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Ponto Central do Marcador
    ctx.fillStyle = '#E07A1F';
    ctx.beginPath();
    ctx.arc(frente.x, frente.y, 3, 0, Math.PI * 2);
    ctx.fill();

    // Box do Município e Equipes Atuando
    const cardWidth = Math.max(130, frente.equipes.length * 48 + 30);
    const cardHeight = 38;
    const cardX = frente.x - cardWidth / 2;
    const cardY = frente.y - cardHeight - 12;

    // Sombra do Card
    ctx.shadowColor = 'rgba(0, 0, 0, 0.12)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;

    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#E6E3DD';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardWidth, cardHeight, 6);
    ctx.fill();
    ctx.stroke();

    ctx.shadowColor = 'transparent';

    // Nome do Município
    ctx.fillStyle = '#23211E';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(frente.nome.toUpperCase(), frente.x, cardY + 4);

    // Badges das Equipes
    const startBadgesX = frente.x - ((frente.equipes.length * 42) / 2) + 21;
    frente.equipes.forEach((eq, idx) => {
      const bX = startBadgesX + (idx * 42);
      const bY = cardY + 20;

      ctx.fillStyle = eq.cor || '#E07A1F';
      ctx.beginPath();
      ctx.roundRect(bX - 18, bY - 2, 36, 14, 3);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(eq.codigo, bX, bY + 5);
    });
  });

  // 7. Desenhar Base Central (Destaque Primário)
  // Anéis de Radar
  ctx.strokeStyle = 'rgba(224, 122, 31, 0.25)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(baseX, baseY, 24, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(224, 122, 31, 0.15)';
  ctx.beginPath();
  ctx.arc(baseX, baseY, 42, 0, Math.PI * 2);
  ctx.stroke();

  // Pin Base Central
  ctx.fillStyle = '#E07A1F';
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(baseX, baseY, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Card da Base Central
  const baseCardWidth = 190;
  const baseCardHeight = 42;
  const baseCardX = baseX - baseCardWidth / 2;
  const baseCardY = baseY + 18;

  ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;

  ctx.fillStyle = '#23211E';
  ctx.strokeStyle = '#E07A1F';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(baseCardX, baseCardY, baseCardWidth, baseCardHeight, 6);
  ctx.fill();
  ctx.stroke();

  ctx.shadowColor = 'transparent';

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(`🚩 BASE OPERACIONAL CENTRAL`, baseX, baseCardY + 6);

  ctx.fillStyle = '#E07A1F';
  ctx.font = 'bold 10px sans-serif';
  ctx.fillText(unidadeNome.toUpperCase(), baseX, baseCardY + 22);

  // 8. Cabeçalho Superior do Mapa
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.strokeStyle = '#E6E3DD';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(16, 14, 380, 52, 6);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#E07A1F';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('SIRTEC PCP · MAPEAMENTO DE FRENTES E ROTAS', 26, 22);

  ctx.fillStyle = '#23211E';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText(`Raio de Atendimento · ${unidadeNome}`, 26, 38);

  // 9. Legenda Inferior Esquerda
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.strokeStyle = '#E6E3DD';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(16, height - 76, 260, 60, 6);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#23211E';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('LEGENDA OPERACIONAL', 26, height - 68);

  // Ícone Base
  ctx.fillStyle = '#E07A1F';
  ctx.beginPath();
  ctx.arc(32, height - 42, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#5C574F';
  ctx.font = '10px sans-serif';
  ctx.fillText('Base Operacional', 44, height - 47);

  // Ícone Frente
  ctx.strokeStyle = '#E07A1F';
  ctx.fillStyle = '#FFFFFF';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(142, height - 42, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#5C574F';
  ctx.fillText('Frentes de Serviço', 154, height - 47);

  // Ícone Rota
  ctx.strokeStyle = '#A39E96';
  ctx.lineWidth = 2;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(26, height - 24);
  ctx.lineTo(46, height - 24);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#5C574F';
  ctx.fillText('Itinerário Rodoviário', 52, height - 29);

  // Exporta imagem em JPEG de alta qualidade
  try {
    return canvas.toDataURL('image/jpeg', 0.92);
  } catch (e) {
    console.error('Erro ao exportar imagem do mapa:', e);
    return '';
  }
}
