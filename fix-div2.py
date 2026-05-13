import os

file_path = "src/components/views/CarteiraDashboardView.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace(
    '''              </div>
           </div>
          </div>
        </div>

        {/* Filtros Ativos Badge row (Opcional, mas útil) */}''',
    '''              </div>
           </div>
        </div>

        {/* Filtros Ativos Badge row (Opcional, mas útil) */}'''
)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
print("Removed extra closing div.")
