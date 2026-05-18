import os

filepath = 'src/components/views/CarteiraDashboardView.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    code = f.read()

# Let's clean up all ErrorBoundaries and add them again carefully.
code = code.replace("<ErrorBoundary>\n", "")
code = code.replace("</ErrorBoundary>\n", "")
code = code.replace("<ErrorBoundary>", "")
code = code.replace("</ErrorBoundary>", "")

# Now add them back.
# Table 1
code = code.replace(
    """<table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="bg-muted sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-4 py-2 font-semibold">Obra</th>
                  <th className="px-4 py-2 font-semibold min-w-[200px]">Título</th>""",
    """<ErrorBoundary><table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="bg-muted sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-4 py-2 font-semibold">Obra</th>
                  <th className="px-4 py-2 font-semibold min-w-[200px]">Título</th>""",
    1
)
code = code.replace(
    """              )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MAPA */}""",
    """              )}
              </tbody>
            </table></ErrorBoundary>
          </div>
        </div>
      </div>

      {/* MAPA */}"""
)

# Map
code = code.replace(
    "<CarteiraMapView obras={filteredData.filter(r => considerarInaptas || r.obrasInaptasVal !== '0')} />",
    "<ErrorBoundary><CarteiraMapView obras={filteredData.filter(r => considerarInaptas || r.obrasInaptasVal !== '0')} /></ErrorBoundary>"
)

# Table 2
code = code.replace(
    """<table className="w-full text-sm text-left">
            <thead className="bg-muted sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-4 py-2 font-semibold">Município</th>
                <th className="px-4 py-2 font-semibold text-right">Qtd Obras</th>""",
    """<ErrorBoundary><table className="w-full text-sm text-left">
            <thead className="bg-muted sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-4 py-2 font-semibold">Município</th>
                <th className="px-4 py-2 font-semibold text-right">Qtd Obras</th>"""
)
code = code.replace(
    """              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* OBRAS COM DÉFICIT NEOEX */}""",
    """              )}
            </tbody>
          </table></ErrorBoundary>
        </div>
      </div>

      {/* OBRAS COM DÉFICIT NEOEX */}"""
)

# Table 3
code = code.replace(
    """<table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="bg-muted sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-4 py-2 font-semibold">Obra</th>
                <th className="px-4 py-2 font-semibold min-w-[200px]">Título</th>
                <th className="px-4 py-2 font-semibold text-right">GPM</th>""",
    """<ErrorBoundary><table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="bg-muted sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-4 py-2 font-semibold">Obra</th>
                <th className="px-4 py-2 font-semibold min-w-[200px]">Título</th>
                <th className="px-4 py-2 font-semibold text-right">GPM</th>"""
)
code = code.replace(
    """              )}
            </tbody>
          </table>
        </div>
      </div>

      </div>
    </div>
  );
};""",
    """              )}
            </tbody>
          </table></ErrorBoundary>
        </div>
      </div>

      </div>
    </div>
  );
};"""
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(code)
