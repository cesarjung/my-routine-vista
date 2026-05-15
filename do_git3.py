import subprocess

try:
    subprocess.run(["git", "add", "sync_bot.py"], check=True)
    subprocess.run(["git", "commit", "-m", "fix: habilita basicConfig logging INFO"], check=True)
    subprocess.run(["git", "push"], check=True)
    print("Sucesso logging config")
except Exception as e:
    print("Erro:", e)
