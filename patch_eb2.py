import os

filepath = 'src/components/views/CarteiraDashboardView.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    code = f.read()

import re

# Fix Table 2 again, making sure we have ErrorBoundary
if "<ErrorBoundary>\n          <table className=\"w-full text-sm text-left\">" in code:
    code = code.replace(
        "            </tbody>\n          </table>\n        </div>",
        "            </tbody>\n          </table>\n          </ErrorBoundary>\n        </div>"
    )

# Wrap Table 3
if "<table className=\"w-full text-sm text-left whitespace-nowrap\">" in code:
    code = code.replace(
        "<table className=\"w-full text-sm text-left whitespace-nowrap\">",
        "<ErrorBoundary>\n          <table className=\"w-full text-sm text-left whitespace-nowrap\">",
        1 # only replace the first occurrence after Table 1 (Table 1 already wrapped)
    )
    # Actually wait. Table 1: <ErrorBoundary>\n            <table className="w-full text-sm text-left whitespace-nowrap">
    # Table 3: <table className="w-full text-sm text-left whitespace-nowrap">
    
# Let's just do a dirty replace for Table 3
code = code.replace(
    """        <div className="flex-1 overflow-auto custom-scrollbar p-0">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="bg-muted sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-4 py-2 font-semibold">Obra</th>""",
    """        <div className="flex-1 overflow-auto custom-scrollbar p-0">
          <ErrorBoundary>
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="bg-muted sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-4 py-2 font-semibold">Obra</th>"""
)

code = code.replace(
    """              )}
            </tbody>
          </table>
        </div>
      </div>""",
    """              )}
            </tbody>
          </table>
          </ErrorBoundary>
        </div>
      </div>"""
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(code)
