import subprocess

try:
    subprocess.run(["git", "add", "src/hooks/usePlanejamentoData.ts"], check=True)
    subprocess.run(["git", "commit", "-m", "fix: parse multiple mesFiltro correctly for Gantt dropdown"], check=True)
    subprocess.run(["git", "push"], check=True)
    print("Sucesso hooks 2")
except Exception as e:
    print("Erro:", e)
