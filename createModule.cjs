const fs = require('fs');

const hookOriginal = fs.readFileSync('src/hooks/usePostesTurnoData.ts', 'utf-8');
const viewOriginal = fs.readFileSync('src/components/views/PostesTurnoView.tsx', 'utf-8');

// Modificar o Hook
let hookNovo = hookOriginal
  .replace(/usePostesTurnoData/g, 'useDeslocamentoData')
  .replace(/PosteTurnoRow/g, 'DeslocamentoRow')
  .replace(/valPlanTurno/g, 'valDeslocamento') // substituímos U (20) por BM (64)? Wait.
  .replace(/parseNumber\(row\[20\]\)/g, 'parseNumber(row[63])') // Let's check index for BM. Z=25, AA=26. BM is B=2, M=13. 26 + 13 - 1 = 38? No. 
  // A=0. Z=25. AA=26, AZ=51. BA=52, BM=64.
  // parseNumber(row[20]) -> U
  // replace with parseNumber(row[64]) -> BM
;
hookNovo = hookNovo.replace(/parseNumber\(row\[20\]\)/g, 'parseNumber(row[64])');

// Modificar a View
let viewNovo = viewOriginal
  .replace(/PostesTurnoView/g, 'DeslocamentoView')
  .replace(/usePostesTurnoData/g, 'useDeslocamentoData')
  .replace(/Poste x Turno/g, 'Deslocamento')
  .replace(/Média de Postes Planejados por Turno/g, 'Média de Tempo de Deslocamento')
  .replace(/MODULO POSTE X TURNO/g, 'MODULO DESLOCAMENTO')
  .replace(/Media Todos Turnos/g, 'Media Deslocamentos');

// O usuário pediu pra color scale ser invertida.
// Verde <= 1.0. Vermelho > 1.5. 
const colorsReplacement = `
  const getCellColor = (val: number | null) => {
    if (val === null || val === undefined) return 'bg-muted/30 text-muted-foreground';
    if (val <= 1.0) return 'bg-[#43a047] text-white font-bold'; // Verde escuro
    if (val <= 1.2) return 'bg-[#7cb342] text-white font-bold'; // Verde claro
    if (val <= 1.5) return 'bg-[#fb8c00] text-white font-bold'; // Laranja
    return 'bg-[#e53935] text-white font-bold'; // Vermelho
  };
`;
// Vamos injetar o colorsReplacement manualmente via JS.
viewNovo = viewNovo.replace(/const getCellColor = \(val: number \| null\) => \{[\s\S]*?\};/, colorsReplacement.trim());

const legendReplacement = `
            {/* Legenda de Cores */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded bg-[#43a047]"></div>
                <span>≤ 1.0 h</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded bg-[#7cb342]"></div>
                <span>1.1 - 1.2 h</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded bg-[#fb8c00]"></div>
                <span>1.3 - 1.5 h</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded bg-[#e53935]"></div>
                <span>> 1.5 h</span>
              </div>
            </div>
`;
viewNovo = viewNovo.replace(/\{\/\* Legenda de Cores \*\/\}[\s\S]*?<\/div>\s*<\/div>/, legendReplacement.trim());

fs.writeFileSync('src/hooks/useDeslocamentoData.ts', hookNovo);
fs.writeFileSync('src/components/views/DeslocamentoView.tsx', viewNovo);
console.log('Scripts duplicados com sucesso!');
