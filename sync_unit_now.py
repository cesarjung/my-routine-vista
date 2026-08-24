import sys
import json
import logging
from datetime import datetime
import requests
import gspread
from google.oauth2.service_account import Credentials
from sync_bot import SCOPES, load_env, get_gspread_client, fetch_google_sheets, fetch_global_recursos, UNIDADES_PLANEJAMENTO

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def sync_single_unit(unidade_id):
    env_vars = load_env()
    supabase_url = env_vars.get("VITE_SUPABASE_URL")
    supabase_key = env_vars.get("VITE_SUPABASE_PUBLISHABLE_KEY")

    if not supabase_url or not supabase_key:
        logging.error("Supabase URL or Key not found.")
        return False

    gc = get_gspread_client()
    if not gc:
        logging.error("Google Sheets credentials not found.")
        return False

    logging.info(f"Sincronizando unidade {unidade_id} do Google Sheets para o Supabase...")
    sheets_data = fetch_google_sheets(unidade_id, gc)
    if not sheets_data:
        logging.error(f"Não foi possível obter dados da planilha para a unidade {unidade_id}")
        return False

    headers_supa = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
    }

    global_recursos, central_postes = fetch_global_recursos(gc)

    payload = {
        "unidade_id": unidade_id,
        "carteira": json.dumps(sheets_data.get("Carteira_Planejador", [])),
        "principal": json.dumps(sheets_data.get("Plan_Principal", [])),
        "bd_metas": json.dumps({
            "bd_metas": sheets_data.get("BD_Metas", []),
            "base_curva": sheets_data.get("Base_Curva", []),
            "bd_config": sheets_data.get("BD_Config", []),
            "recursos_aplicados": global_recursos,
            "central_postes": central_postes.get(unidade_id, [])
        }),
        "reprogramadas": json.dumps(sheets_data.get("Reprogramadas", [])),
        "updated_at": datetime.utcnow().isoformat() + "Z"
    }

    url = f"{supabase_url}/rest/v1/planejamento_cache"
    res = requests.post(url, headers=headers_supa, json=payload, timeout=30)
    if res.status_code in [200, 201, 204]:
        logging.info(f"Unidade {unidade_id} sincronizada com sucesso no Supabase!")
        return True
    else:
        logging.error(f"Erro ao salvar no Supabase: {res.status_code} - {res.text}")
        return False

if __name__ == "__main__":
    unit_id = sys.argv[1] if len(sys.argv) > 1 else '1rj2V7CxbZwkan63eCeLkH9G00Gi041IZNC6vwEgq6yI'
    success = sync_single_unit(unit_id)
    sys.exit(0 if success else 1)
