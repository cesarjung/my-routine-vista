import os
import re

views_dir = r"c:\Users\Sirtec\my-routine-vista\src\components\views"
files = ["PostesTurnoView.tsx", "EtapasView.tsx", "DeslocamentoView.tsx", "CumprimentoView.tsx"]

for filename in files:
    filepath = os.path.join(views_dir, filename)
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
        
    # Replace onClick={() => setSelectedProjetos(projetosUnicos)} with onClick={() => setSelectedProjetos(projetosUnicos.slice(0, 100))}
    new_content = content.replace("onClick={() => setSelectedProjetos(projetosUnicos)}", "onClick={() => setSelectedProjetos(projetosUnicos.slice(0, 100))}")
    
    # Replace {projetosUnicos.map(p => ( with {projetosUnicos.slice(0, 100).map(p => (
    new_content = new_content.replace("{projetosUnicos.map(p => (", "{projetosUnicos.slice(0, 100).map(p => (")
    
    if new_content != content:
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(new_content)
        print(f"Updated {filename}")
