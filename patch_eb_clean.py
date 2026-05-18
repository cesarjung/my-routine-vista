import os

filepath = 'src/components/views/CarteiraDashboardView.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    code = f.read()

# Add import
if "import { ErrorBoundary } from '@/components/ErrorBoundary';" not in code:
    code = code.replace("import { cn } from '@/lib/utils';", "import { cn } from '@/lib/utils';\nimport { ErrorBoundary } from '@/components/ErrorBoundary';")

# Wrap table 1
code = code.replace(
    '<table className="w-full text-sm text-left whitespace-nowrap">',
    '<ErrorBoundary>\n<table className="w-full text-sm text-left whitespace-nowrap">',
    1
)
code = code.replace(
    '</table>\n          </div>\n        </div>\n      </div>\n\n      {/* MAPA */}',
    '</table>\n</ErrorBoundary>\n          </div>\n        </div>\n      </div>\n\n      {/* MAPA */}',
    1
)

# Wrap Map
code = code.replace(
    "<CarteiraMapView obras={filteredData.filter(r => considerarInaptas || r.obrasInaptasVal !== '0')} />",
    "<ErrorBoundary><CarteiraMapView obras={filteredData.filter(r => considerarInaptas || r.obrasInaptasVal !== '0')} /></ErrorBoundary>"
)

# Wrap table 2
code = code.replace(
    '<table className="w-full text-sm text-left">',
    '<ErrorBoundary>\n<table className="w-full text-sm text-left">',
    1
)
code = code.replace(
    '</table>\n        </div>\n      </div>\n\n      {/* OBRAS COM DÉFICIT NEOEX */}',
    '</table>\n</ErrorBoundary>\n        </div>\n      </div>\n\n      {/* OBRAS COM DÉFICIT NEOEX */}',
    1
)

# Wrap table 3
code = code.replace(
    '<table className="w-full text-sm text-left whitespace-nowrap">\n            <thead className="bg-muted sticky top-0 z-10 shadow-sm">\n              <tr>\n                <th className="px-4 py-2 font-semibold">Obra</th>',
    '<ErrorBoundary>\n<table className="w-full text-sm text-left whitespace-nowrap">\n            <thead className="bg-muted sticky top-0 z-10 shadow-sm">\n              <tr>\n                <th className="px-4 py-2 font-semibold">Obra</th>',
    1
)
code = code.replace(
    '</table>\n        </div>\n      </div>\n\n      </div>',
    '</table>\n</ErrorBoundary>\n        </div>\n      </div>\n\n      </div>',
    1
)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(code)
