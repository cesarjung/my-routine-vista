import os
import time
import json
import requests
from dotenv import load_dotenv

# Try importing the functions from sync_bot
from sync_bot import load_env, get_gspread_client, fetch_google_sheets, UNIDADES_PLANEJAMENTO, upsert_supabase

def test_single_unit():
    env_vars = load_env()
    gc = get_gspread_client()
    
    unidade_id = UNIDADES_PLANEJAMENTO[0] # Test with the first unit
    print(f"Buscando dados da unidade {unidade_id}...")
    
    t0 = time.time()
    sheets_data = fetch_google_sheets(unidade_id, gc)
    t1 = time.time()
    
    print(f"Tempo de busca: {t1 - t0:.2f} segundos")
    
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
        "updated_at": "2026-05-13T12:00:00Z"
    }
    
    payload_str = json.dumps(payload)
    print(f"Tamanho do payload JSON: {len(payload_str) / 1024 / 1024:.2f} MB")
    
    print("Enviando para Supabase...")
    t2 = time.time()
    success = upsert_supabase(env_vars, payload)
    t3 = time.time()
    
    print(f"Tempo de envio Supabase: {t3 - t2:.2f} segundos. Sucesso: {success}")

if __name__ == '__main__':
    test_single_unit()
