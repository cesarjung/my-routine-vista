import os
import time
import json
import logging
from datetime import datetime
import requests

# Configurar logs
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

# Constantes do Google Apps Script
API_URL = 'https://script.google.com/macros/s/AKfycbxn-YpuZZsNsdGT_FxQdhUwLE5KUIuXvo7Ffad03x80LByig3qneNe7-hy9PUZYS8-bDg/exec'
SECRET_TOKEN = 'sirtec_vista_2026_seguro'

UNIDADES_PLANEJAMENTO = [
    '1OTHF2ytEOjGgfE49paARXkz9GjaklOQC_UhiXwUjC2E',
    '1rj2V7CxbZwkan63eCeLkH9G00Gi041IZNC6vwEgq6yI',
    '1FO5tyhXygbbzSmmTGdnm45j4DD_rRFQgEheN8T8Wy70',
    '1oS619l3x_D1mXkvDpw8vs91G6ipZmsK83JqEIwPj7Uk',
    '1gN2tR_LCuRnVCQ9tm2UURnVuMlJPVNEjvmo02TwFQCI',
    '1dNwj8qWTl1k92PxI9iXwaNZYITnxuKP-kOF1QnZK3Iw',
    '1sGHf-zWXoxjnO20QBw2KWX39BSCzT8rzHdEz1hL7jyU',
    '1XmpY8mqkRou-CRY68j1ljHH8W8zcROy7wnwMMSfbV7o',
    '1rzT8o6XZi4v8j7CYLky3BD3sT5IPjv1PRb45ipBfbw4'
]

def load_env():
    env_vars = {}
    try:
        with open('.env', 'r') as f:
            for line in f:
                if '=' in line and not line.startswith('#'):
                    key, val = line.strip().split('=', 1)
                    env_vars[key] = val.strip('"').strip("'")
    except Exception as e:
        logging.error(f"Erro ao ler .env: {e}")
    return env_vars

def fetch_google_sheets(unidade_id):
    url = f"{API_URL}?token={SECRET_TOKEN}&id={unidade_id}&sheets=Carteira_Planejador,Plan_Principal,BD_Metas,Reprogramadas,Base_Curva,BD_Config"
    try:
        logging.info(f"Baixando dados do Google para a unidade {unidade_id}...")
        res = requests.get(url, timeout=45)
        if res.status_code == 200:
            data = res.json()
            if data.get('success'):
                return data.get('data')
            else:
                logging.error(f"Erro no retorno do script para {unidade_id}: {data.get('error')}")
        else:
            logging.error(f"Erro HTTP {res.status_code} na unidade {unidade_id}")
    except Exception as e:
        logging.error(f"Falha ao conectar no Google para {unidade_id}: {e}")
    return None

def upsert_supabase(env_vars, payload):
    supabase_url = env_vars.get('VITE_SUPABASE_URL')
    supabase_key = env_vars.get('VITE_SUPABASE_PUBLISHABLE_KEY')
    
    if not supabase_url or not supabase_key:
        logging.error("Credenciais do Supabase nao encontradas.")
        return False
        
    url = f"{supabase_url}/rest/v1/planejamento_cache"
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
    }
    
    try:
        res = requests.post(url, headers=headers, json=payload, timeout=15)
        if res.status_code in [200, 201, 204]:
            logging.info(f"Unidade {payload['unidade_id']} salva no Supabase com sucesso.")
            return True
        else:
            logging.error(f"Falha Supabase {res.status_code}: {res.text}")
    except Exception as e:
        logging.error(f"Falha de conexão com Supabase: {e}")
    return False

def run_sync_cycle():
    logging.info("--- Iniciando ciclo de sincronizacao ---")
    env_vars = load_env()
    
    for unidade_id in UNIDADES_PLANEJAMENTO:
        sheets_data = fetch_google_sheets(unidade_id)
        
        if sheets_data:
            payload = {
                "unidade_id": unidade_id,
                "carteira": sheets_data.get("Carteira_Planejador", []),
                "principal": sheets_data.get("Plan_Principal", []),
                "bd_metas": {
                    "bd_metas": sheets_data.get("BD_Metas", []),
                    "base_curva": sheets_data.get("Base_Curva", []),
                    "bd_config": sheets_data.get("BD_Config", [])
                },
                "reprogramadas": sheets_data.get("Reprogramadas", []),
                "updated_at": datetime.utcnow().isoformat() + "Z"
            }
            upsert_supabase(env_vars, payload)
        
        # Pausa intencional para NUNCA dar "Too Many Requests" no Google Apps Script
        logging.info("Pausando 5 segundos antes da proxima unidade...")
        time.sleep(5)
        
    logging.info("--- Ciclo concluido ---")

if __name__ == "__main__":
    logging.info("Sync Bot iniciado. Pressione Ctrl+C para parar.")
    while True:
        try:
            current_hour = datetime.now().hour
            
            # Pausa as atualizações entre 22h e 05h59
            if current_hour >= 22 or current_hour < 6:
                logging.info(f"Horário de descanso ({current_hour}h). O bot voltará a sincronizar às 06h da manhã.")
                time.sleep(60 * 60) # Dorme por 1 hora e verifica novamente
                continue

            run_sync_cycle()
            
            # Aguarda 10 minutos para o próximo ciclo
            WAIT_TIME = 10 * 60
            logging.info(f"Aguardando 10 minutos ate a proxima execucao...")
            time.sleep(WAIT_TIME)
            
        except KeyboardInterrupt:
            logging.info("Bot finalizado pelo usuario.")
            break
        except Exception as e:
            logging.error(f"Erro critico no loop principal: {e}")
            time.sleep(60) # Espera 1 minuto antes de tentar de novo caso de erro
