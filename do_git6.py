import subprocess

try:
    subprocess.run(["git", "add", "src/components/views/."], check=True)
    subprocess.run(["git", "commit", "-m", "fix: limitação de projetos no dropdown para evitar freeze da pagina"], check=True)
    subprocess.run(["git", "push"], check=True)
    print("Sucesso dropdown config")
except Exception as e:
    print("Erro:", e)
