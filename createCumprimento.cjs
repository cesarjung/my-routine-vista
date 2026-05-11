const fs = require('fs');

const hookOriginal = fs.readFileSync('src/hooks/usePlanejadoMetaData.ts', 'utf-8');
const viewOriginal = fs.readFileSync('src/components/views/PlanejadoMetaView.tsx', 'utf-8');

// Modificar o Hook
let hookNovo = hookOriginal
  .replace(/usePlanejadoMetaData/g, 'useCumprimentoData')
  .replace(/PlanejadoMetaRow/g, 'CumprimentoRow')
  .replace(/valPlanejado: number;/g, 'valPlanejado: number;\n  valRealizado: number;')
  .replace(/const valPlanejado = parseNumber\(row\[37\]\); \/\/ Coluna AL/g, 'const valPlanejado = parseNumber(row[37]); // Coluna AL\n          const valRealizado = parseNumber(row[40]); // Coluna AO')
  .replace(/valPlanejado,/g, 'valPlanejado,\n              valRealizado,');

// Modificar a View
let viewNovo = viewOriginal
  .replace(/PlanejadoMetaView/g, 'CumprimentoView')
  .replace(/usePlanejadoMetaData/g, 'useCumprimentoData')
  .replace(/Planejado x Meta/g, 'Cumprimento Planejamento')
  .replace(/PLANEJADO X META/g, 'CUMPRIMENTO PLANEJAMENTO');

// Cálculos de soma.
// Original tem: sumU (Planejado - AL), countU, countAM, sumAQ (Produção), sumAMGlob (Meta - AM).
// Agora precisamos somar:
// sumAL (Planejado)
// sumAO (Realizado)
// sumAMGlob (Meta)
// sumAQ (Produção)

viewNovo = viewNovo.replace(/sumU/g, 'sumAL');
viewNovo = viewNovo.replace(/countU/g, 'countAL');

// Em PlanejadoMetaView.tsx, a lógica global é:
// g.sumAL += row.valPlanejado;
// if (row.valPlanejado > 0) g.countAL += 1;
// Precisamos adicionar g.sumAO += row.valRealizado;

viewNovo = viewNovo.replace(
  'g.sumAL += row.valPlanejado;',
  'g.sumAL += row.valPlanejado;\n      g.sumAO += row.valRealizado;'
);

viewNovo = viewNovo.replace(
  'gm.sumAL += row.valPlanejado;',
  'gm.sumAL += row.valPlanejado;\n      gm.sumAO += row.valRealizado;'
);

// Na inicialização do agrupado:
viewNovo = viewNovo.replace(
  'sumAL: 0, countAL: 0, countAM: 0,',
  'sumAL: 0, sumAO: 0, countAL: 0, countAM: 0,'
);
viewNovo = viewNovo.replace(
  '{ sumAL: 0, countAL: 0, countAM: 0, sumAQ: 0, sumAM: 0 }',
  '{ sumAL: 0, sumAO: 0, countAL: 0, countAM: 0, sumAQ: 0, sumAM: 0 }'
);

// No cálculo da média geral (agora Cumprimento = (AO / AL) * 100)
// Original: item._mediaGeral = u.sumAMGlob > 0 ? (u.sumAL / u.sumAMGlob) * 100 : 0;
// Novo: item._mediaGeral = u.sumAL > 0 ? (u.sumAO / u.sumAL) * 100 : 0;
viewNovo = viewNovo.replace(
  'item._mediaGeral = u.sumAMGlob > 0 ? (u.sumAL / u.sumAMGlob) * 100 : 0;',
  'item._mediaGeral = u.sumAL > 0 ? (u.sumAO / u.sumAL) * 100 : 0;'
);

// Média mensal (agora Cumprimento mensal = (AO_mês / AL_mês) * 100)
// Original: item[m] = u.meses[m].sumAM > 0 ? Number(((u.meses[m].sumAL / u.meses[m].sumAM) * 100).toFixed(1)) : null;
// Novo: item[m] = u.meses[m].sumAL > 0 ? Number(((u.meses[m].sumAO / u.meses[m].sumAL) * 100).toFixed(1)) : null;
viewNovo = viewNovo.replace(
  'item[m] = u.meses[m].sumAM > 0 ? Number(((u.meses[m].sumAL / u.meses[m].sumAM) * 100).toFixed(1)) : null;',
  'item[m] = u.meses[m].sumAL > 0 ? Number(((u.meses[m].sumAO / u.meses[m].sumAL) * 100).toFixed(1)) : null;'
);

// O cálculo da produção (AQ / AM) continua o mesmo:
// _producaoPerc = u.sumAMGlob > 0 ? (u.sumAQ / u.sumAMGlob) * 100
// item[\`\${m}_prod\`] = u.meses[m].sumAM > 0 ? (u.meses[m].sumAQ / u.meses[m].sumAM) * 100

fs.writeFileSync('src/hooks/useCumprimentoData.ts', hookNovo);
fs.writeFileSync('src/components/views/CumprimentoView.tsx', viewNovo);
console.log('Scripts Cumprimento duplicados com sucesso!');
