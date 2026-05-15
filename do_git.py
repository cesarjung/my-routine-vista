import subprocess

try:
    subprocess.run(["git", "add", "sync_bot.py"], check=True)
    print("Add OK")
    subprocess.run(["git", "commit", "-m", "fix: aumenta timeout do DELETE para 60s"], check=True)
    print("Commit OK")
    subprocess.run(["git", "push"], check=True)
    print("Push OK")
except Exception as e:
    print("Error:", e)
