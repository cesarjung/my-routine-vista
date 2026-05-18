import os

filepath = 'src/hooks/useCarteiraDashboardData.ts'
with open(filepath, 'r', encoding='utf-8') as f:
    code = f.read()

# Add to interface CarteiraRow
if "orcamentoValidado: number;" not in code:
    code = code.replace("qtdNeoex: number;", "qtdNeoex: number;\n  orcamentoValidado: number;\n  recursosAplicados: number;")

# Add pre-calculation of recursos aplicados
calc_logic = """
      const recursosAplicadosPorObra: Record<string, number> = {};
      
      for (const unidadeData of rawData) {
        const principalRows = unidadeData.principal || [];
        for (let i = 1; i < principalRows.length; i++) {
          const row = principalRows[i];
          if (!row) continue;
          
          const obraId = String(row[7] || '').trim(); // H (Obra)
          if (!obraId) continue;
          
          const metaR$ = parseNumber(row[38]); // AM (Meta R$)
          const colAO = parseNumber(row[40]); // AO
          
          if (colAO > 0) {
            recursosAplicadosPorObra[obraId] = (recursosAplicadosPorObra[obraId] || 0) + metaR$;
          }
        }
      }
"""
if "recursosAplicadosPorObra: Record" not in code:
    code = code.replace("for (const unidadeData of rawData) {", calc_logic + "\n      for (const unidadeData of rawData) {")

# Add to carteira.push
push_logic = """
          qtdGpm: parseNumber(row[22]), // W
          qtdNeoex: parseNumber(row[23]), // X
          orcamentoValidado: parseNumber(row[35]), // AJ
          recursosAplicados: recursosAplicadosPorObra[String(row[12] || '').trim()] || 0, // Obra ID na coluna M
"""
if "orcamentoValidado: parseNumber" not in code:
    code = code.replace("          qtdGpm: parseNumber(row[22]), // W\n          qtdNeoex: parseNumber(row[23]), // X\n", push_logic)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(code)
