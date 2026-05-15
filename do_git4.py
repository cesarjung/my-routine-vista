import subprocess

try:
    subprocess.run(["git", "add", "src/hooks/."], check=True)
    subprocess.run(["git", "commit", "-m", "fix: remove restricoes de length estritas que quebravam com arrays curtos"], check=True)
    subprocess.run(["git", "push"], check=True)
    print("Sucesso lengths config")
except Exception as e:
    print("Erro:", e)
