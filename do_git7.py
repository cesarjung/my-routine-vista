import subprocess

try:
    subprocess.run(["git", "add", "src/hooks/usePlanejamentoData.ts"], check=True)
    subprocess.run(["git", "commit", "-m", "fix: parse mesFiltro correctly for Gantt dropdown"], check=True)
    subprocess.run(["git", "push"], check=True)
    print("Sucesso hooks")
except Exception as e:
    print("Erro:", e)
