"""
Script standalone para:
1. Criar tabela atividades_por_ponto no Supabase (se não existir)
2. Popular com todos os dados da aba ATIVIDADES_POR_PONTO_BASE (~537k linhas)

Execute: python sync_atividades_inicial.py
"""
import json
import os
import time
import logging
import requests
import gspread
from google.oauth2.service_account import Credentials

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(levelname)s %(message)s',
    handlers=[logging.StreamHandler()]
)

# === CONFIGURAÇÃO ===
SHEET_ID = "1Ipp454Clq0lKik8G5LjMMmV-8eA0R6if4FGG555K1j8"
TAB_NAME = "ATIVIDADES_POR_PONTO_BASE"
CREDS_FILE = "google_credentials.json"
ENV_FILE = ".env"

def load_env():
    env = {}
    if os.path.exists(ENV_FILE):
        with open(ENV_FILE, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if '=' in line and not line.startswith('#'):
                    k, v = line.split('=', 1)
                    env[k.strip()] = v.strip().strip('"').strip("'")
    return env

env = load_env()
SUPABASE_URL = env.get('VITE_SUPABASE_URL', '')
SUPABASE_KEY = env.get('VITE_SUPABASE_PUBLISHABLE_KEY', '')
SERVICE_KEY = env.get('VITE_SUPABASE_SERVICE_KEY', SUPABASE_KEY)  # se disponível

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERRO: Credenciais do Supabase não encontradas no .env")
    exit(1)

headers_supa = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
}

# === PASSO 1: Verificar se a tabela existe ===
logging.info("Verificando se a tabela atividades_por_ponto existe no Supabase...")
test_url = f"{SUPABASE_URL}/rest/v1/atividades_por_ponto?limit=1"
test_res = requests.get(test_url, headers=headers_supa, timeout=15)

if test_res.status_code == 404:
    logging.error("TABELA NÃO EXISTE! Execute o SQL em CREATE_ATIVIDADES_POR_PONTO.sql no Supabase Dashboard primeiro.")
    logging.error("URL: https://supabase.com/dashboard/project/curyufedazpkhtxrwhkn/sql")
    exit(1)
elif test_res.status_code == 200:
    current_count_res = requests.get(
        f"{SUPABASE_URL}/rest/v1/atividades_por_ponto?select=id",
        headers={**headers_supa, "Prefer": "count=exact"},
        timeout=15
    )
    count_header = current_count_res.headers.get("Content-Range", "")
    logging.info(f"Tabela existe. Content-Range: {count_header}")
else:
    logging.warning(f"Status inesperado: {test_res.status_code} - {test_res.text[:200]}")

# === PASSO 2: Ler planilha ===
SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets.readonly",
    "https://www.googleapis.com/auth/drive.readonly",
]
creds = Credentials.from_service_account_file(CREDS_FILE, scopes=SCOPES)
gc = gspread.authorize(creds)

logging.info(f"Abrindo planilha {SHEET_ID}...")
sh = gc.open_by_key(SHEET_ID)
ws = sh.worksheet(TAB_NAME)
logging.info(f"Lendo aba '{TAB_NAME}'... (~537k linhas, aguarde)")
raw_data = ws.get_all_values()
logging.info(f"{len(raw_data) - 1} linhas lidas. Processando...")

# === PASSO 3: Processar dados ===
# Col: A=0=Projeto, B=1=PontoObra, C=2=Etapa, D=3=CodAtividade,
#      E=4=Descricao, F=5=UnidadeMedida, G=6=Quantidade, H=7=Orcamentista,
#      I=8=ComMascara, J=9=UnidadeObra, K=10=ComPontoMascara
COL = {
    "projeto": 0, "ponto_obra": 1, "etapa": 2, "codigo_atividade": 3,
    "descricao": 4, "unidade_medida": 5, "quantidade": 6, "orcamentista": 7,
    "com_mascara": 8, "unidade_obra": 9, "com_ponto_mascara": 10
}

records = []
skipped = 0
for row in raw_data[1:]:
    if not row or not any(r.strip() for r in row):
        skipped += 1
        continue

    def safe_get(col_idx):
        return row[col_idx].strip() if col_idx < len(row) else ""

    com_mascara = safe_get(COL["com_mascara"])
    if not com_mascara:
        skipped += 1
        continue

    qty_str = safe_get(COL["quantidade"])
    try:
        qty = float(qty_str.replace(",", ".").replace(" ", "")) if qty_str else 1.0
    except (ValueError, AttributeError):
        qty = 1.0

    records.append({
        "projeto": safe_get(COL["projeto"]),
        "ponto_obra": safe_get(COL["ponto_obra"]),
        "etapa": safe_get(COL["etapa"]),
        "codigo_atividade": safe_get(COL["codigo_atividade"]),
        "descricao": safe_get(COL["descricao"]),
        "unidade_medida": safe_get(COL["unidade_medida"]) or "UND",
        "quantidade": qty,
        "orcamentista": safe_get(COL["orcamentista"]),
        "com_mascara": com_mascara,
        "unidade_obra": safe_get(COL["unidade_obra"]),
        "com_ponto_mascara": safe_get(COL["com_ponto_mascara"]),
    })

logging.info(f"{len(records)} registros válidos ({skipped} pulados). Iniciando upsert...")

# === PASSO 4: Limpar tabela e inserir ===
logging.info("Limpando tabela existente (DELETE)...")
del_res = requests.delete(
    f"{SUPABASE_URL}/rest/v1/atividades_por_ponto?id=gt.0",
    headers=headers_supa,
    timeout=120
)
logging.info(f"DELETE: status={del_res.status_code}")

# Inserir em lotes
chunk_size = 2000
insert_url = f"{SUPABASE_URL}/rest/v1/atividades_por_ponto"
total = len(records)
errors = 0
start_time = time.time()

for i in range(0, total, chunk_size):
    chunk = records[i:i + chunk_size]
    res = requests.post(insert_url, headers=headers_supa, json=chunk, timeout=60)
    
    if res.status_code not in [200, 201, 204]:
        errors += 1
        logging.error(f"Falha no bloco {i // chunk_size}: {res.status_code} - {res.text[:150]}")
        # Tenta sub-blocos menores
        for j in range(0, len(chunk), 500):
            sub = chunk[j:j + 500]
            r2 = requests.post(insert_url, headers=headers_supa, json=sub, timeout=60)
            if r2.status_code not in [200, 201, 204]:
                logging.error(f"  Sub-bloco {j//500} também falhou: {r2.status_code}")
    
    done = min(i + chunk_size, total)
    elapsed = time.time() - start_time
    rate = done / elapsed if elapsed > 0 else 0
    eta = (total - done) / rate if rate > 0 else 0
    
    if i % 20000 == 0 or done >= total:
        logging.info(f"  {done:,}/{total:,} ({done*100//total}%) — {rate:.0f} registros/s — ETA: {eta/60:.1f} min")

elapsed_total = time.time() - start_time
logging.info(f"\n{'='*60}")
logging.info(f"CONCLUÍDO! {total:,} registros sincronizados em {elapsed_total/60:.1f} minutos.")
logging.info(f"Erros: {errors} blocos")
logging.info(f"{'='*60}")
