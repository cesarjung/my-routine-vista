const fs = require('fs');

const hookOriginal = fs.readFileSync('src/hooks/usePostesTurnoData.ts', 'utf-8');
const viewOriginal = fs.readFileSync('src/components/views/PostesTurnoView.tsx', 'utf-8');

// Modificar o Hook
let hookNovo = hookOriginal
  .replace(/usePostesTurnoData/g, 'usePlanejadoMetaData')
  .replace(/PosteTurnoRow/g, 'PlanejadoMetaRow')
  .replace(/valPlanTurno/g, 'valPlanejado')
  .replace(/parseNumber\(row\[20\]\)/g, 'parseNumber(row[37])') // AL
;

// Modificar a View
let viewNovo = viewOriginal
  .replace(/PostesTurnoView/g, 'PlanejadoMetaView')
  .replace(/usePostesTurnoData/g, 'usePlanejadoMetaData')
  .replace(/Poste x Turno/g, 'Planejado x Meta')
  .replace(/Média de Postes Planejados por Turno/g, 'Percentual Planejado x Meta')
  .replace(/MODULO POSTE X TURNO/g, 'MODULO PLANEJADO X META');

// A lógica de média no View original (sumU / countU) precisa mudar para (sumU / sumAM) * 100
viewNovo = viewNovo.replace(/item\[_mediaGeral\] = denomGeral > 0 \? u\.sumU \/ denomGeral : null;/, 'item._mediaGeral = u.sumAMGlob > 0 ? (u.sumU / u.sumAMGlob) * 100 : null;');
// Replace the exact line from PostesTurnoView: `item._mediaGeral = denomGeral > 0 ? u.sumU / denomGeral : null;`
// Wait, the original regex needs to be exact.
// Let's just do an exact string replace.

viewNovo = viewNovo.replace(
  'item._mediaGeral = denomGeral > 0 ? u.sumU / denomGeral : null;',
  'item._mediaGeral = u.sumAMGlob > 0 ? (u.sumU / u.sumAMGlob) * 100 : 0;'
);

// For the month calculations:
viewNovo = viewNovo.replace(
  'item[m] = denomMes > 0 ? Number((u.meses[m].sumU / denomMes).toFixed(1)) : null;',
  'item[m] = u.meses[m].sumAM > 0 ? Number(((u.meses[m].sumU / u.meses[m].sumAM) * 100).toFixed(1)) : null;'
);

// We need to change the getCellColor to be the exact same as getProdColor!
const getCellColorReplacement = `
  const getCellColor = (perc: number | null) => {
    if (perc === null || perc === undefined) return 'bg-muted/30 text-muted-foreground';
    if (perc >= 110) return 'bg-blue-500 text-white font-bold';
    if (perc >= 90) return 'bg-green-500 text-white font-bold';
    if (perc >= 70) return 'bg-yellow-500 text-white font-bold';
    return 'bg-red-500 text-white font-bold';
  };
`;

viewNovo = viewNovo.replace(/const getCellColor = \(val: number \| null\) => \{[\s\S]*?\};/, getCellColorReplacement.trim());

// We also need to change the legend
const legendReplacement = `
            {/* Legenda de Cores */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded bg-blue-500"></div>
                <span>≥ 110%</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded bg-green-500"></div>
                <span>90% - 109%</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded bg-yellow-500"></div>
                <span>70% - 89%</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded bg-red-500"></div>
                <span>&lt; 70%</span>
              </div>
            </div>
`;
viewNovo = viewNovo.replace(/\{\/\* Legenda de Cores \*\/\}[\s\S]*?<\/div>\s*<\/div>/, legendReplacement.trim());

// Render format: need to append % to the month cell and mediaGeral cell.
viewNovo = viewNovo.replace(
  `{val !== null ? val.toFixed(1) : '-'}`,
  `{val !== null ? val.toFixed(1) + '%' : '-'}`
);

viewNovo = viewNovo.replace(
  `{row._mediaGeral !== null ? row._mediaGeral.toFixed(1) : '-'}`,
  `{row._mediaGeral !== null ? row._mediaGeral.toFixed(1) + '%' : '-'}`
);

fs.writeFileSync('src/hooks/usePlanejadoMetaData.ts', hookNovo);
fs.writeFileSync('src/components/views/PlanejadoMetaView.tsx', viewNovo);
console.log('Scripts PlanejadoMeta duplicados com sucesso!');
