import subprocess

try:
    subprocess.run(["git", "add", "src/hooks/.", "src/components/views/."], check=True)
    subprocess.run(["git", "commit", "-m", "fix: cache global no raw data e limite de rendering na dom para acelerar interface"], check=True)
    subprocess.run(["git", "push"], check=True)
    print("Sucesso cache config")
except Exception as e:
    print("Erro:", e)
