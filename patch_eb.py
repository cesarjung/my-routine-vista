import os

filepath = 'src/components/views/CarteiraDashboardView.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    code = f.read()

# Fix table 1 (Obras Filtradas) - already wrapped
# Fix table 2 (Municipios)
old_table2 = """
      {/* 10. Localização das Obras (Tabela) */}
      <div className="w-full bg-card border border-border rounded-xl shadow-sm flex flex-col overflow-hidden mb-6 h-[400px]">
        <div className="p-4 border-b border-border bg-muted/20">
          <h3 className="font-bold text-sm">Localização (Municípios)</h3>
        </div>
        <div className="flex-1 overflow-auto custom-scrollbar p-0">
          <ErrorBoundary>
          <table className="w-full text-sm text-left">
            <thead className="bg-muted sticky top-0 z-10 shadow-sm">
"""
# Wait, look at the error log.
# 776|              </tbody>
# 777|            </table>
# 778|          </div>

# Let's just fix it by replacing </ErrorBoundary> correctly.
import re

# Fix Table 2
if "<ErrorBoundary>\n          <table className=\"w-full text-sm text-left\">" in code:
    code = code.replace(
        "            </table>\n        </div>",
        "            </table>\n          </ErrorBoundary>\n        </div>"
    )

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(code)
