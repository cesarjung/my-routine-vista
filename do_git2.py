import subprocess

try:
    subprocess.run(["git", "add", "sync_bot.py"], check=True)
    subprocess.run(["git", "commit", "-m", "feat: adiciona logs detalhados de progresso"], check=True)
    subprocess.run(["git", "push"], check=True)
    print("Sucesso")
except Exception as e:
    print("Erro:", e)
