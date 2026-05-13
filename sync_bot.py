import os
import time
import json
import logging
from datetime import datetime
import requests
import gspread
from google.oauth2.service_account import Credentials

SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive'
]

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
        # Se não achar o .env, não tem problema no GitHub Actions
        pass
        
    # No GitHub Actions as variáveis virão do os.environ
    for key, val in os.environ.items():
        if key.startswith('VITE_'):
            cleaned_val = val.strip().strip('"').strip("'")
            if cleaned_val.startswith(f"{key}="):
                cleaned_val = cleaned_val.split('=', 1)[1].strip().strip('"').strip("'")
            env_vars[key] = cleaned_val
            
    return env_vars

def get_gspread_client():
    creds_json_str = os.environ.get("GOOGLE_CREDENTIALS")
    if creds_json_str:
        try:
            creds_dict = json.loads(creds_json_str)
            credentials = Credentials.from_service_account_info(creds_dict, scopes=SCOPES)
            return gspread.authorize(credentials)
        except Exception as e:
            logging.error(f"Erro ao carregar credenciais da variavel GOOGLE_CREDENTIALS: {e}")
            return None
    else:
        # Fallback para arquivo local se a pessoa quiser testar
        if os.path.exists("google_credentials.json"):
            credentials = Credentials.from_service_account_file("google_credentials.json", scopes=SCOPES)
            return gspread.authorize(credentials)
        else:
            logging.error("Nenhuma credencial do Google encontrada (variavel GOOGLE_CREDENTIALS ou arquivo google_credentials.json).")
            return None

def fetch_google_sheets(unidade_id, gc, retries=3):
    sheets_to_fetch = ['Carteira_Planejador', 'Plan_Principal', 'BD_Metas', 'Reprogramadas', 'Base_Curva', 'BD_Config']
    
    for attempt in range(retries):
        try:
            logging.info(f"Baixando dados do Google (via gspread) para a unidade {unidade_id} (Tentativa {attempt + 1}/{retries})...")
            spreadsheet = gc.open_by_key(unidade_id)
            
            # Limite maximo de colunas a extrair de cada aba (para evitar lixo infinito)
            MAX_COLS = {
                "Carteira_Planejador": 50,
                "Plan_Principal": 55,
                "Reprogramadas": 55,
                "Base_Curva": 10,
                "BD_Config": 100,
                "BD_Metas": 20
            }
            
            # Colunas (índices 0-based) que o frontend de fato consome. O resto é lixo que incha o payload.
            USED_COLS = {
                "Carteira_Planejador": {1, 3, 5, 6, 9, 10, 11, 12, 13, 14, 15, 22, 23, 24, 38, 44, 45, 46, 47},
                "Plan_Principal": {1, 4, 6, 7, 37, 38, 42, 53},
                "Reprogramadas": {1, 4, 6, 7, 37, 38, 42, 53}
            }
            
            result = {}
            for sheet_name in sheets_to_fetch:
                try:
                    logging.info(f"  [>] Lendo aba '{sheet_name}'...")
                    worksheet = spreadsheet.worksheet(sheet_name)
                    raw_data = worksheet.get_all_values()
                    
                    max_col = MAX_COLS.get(sheet_name, 100)
                    whitelist = USED_COLS.get(sheet_name)
                    
                    # O gspread as vezes traz milhares de linhas e colunas vazias
                    cleaned_data = []
                    for row_idx, row in enumerate(raw_data):
                        # Corta a linha no tamanho maximo permitido pela aba
                        row = row[:max_col]
                        
                        # Zera qualquer coluna que o Dashboard não precise (exceto cabeçalho linha 0)
                        if whitelist and row_idx > 0:
                            for i in range(len(row)):
                                if i not in whitelist:
                                    row[i] = ""
                        
                        # Encontra o ultimo indice nao vazio
                        last_non_empty = -1
                        for i in range(len(row) - 1, -1, -1):
                            if str(row[i]).strip():
                                last_non_empty = i
                                break
                                
                        # Se a linha nao for totalmente vazia, adiciona apenas ate a ultima coluna preenchida
                        if last_non_empty >= 0:
                            cleaned_data.append(row[:last_non_empty + 1])
                    
                    logging.info(f"  [OK] Aba '{sheet_name}' concluída: {len(raw_data)} linhas lidas, {len(cleaned_data)} linhas úteis mantidas.")
                    result[sheet_name] = cleaned_data
                    time.sleep(2.5) # Pausa maior (2.5s) pois o limite é estrito de 60 req/minuto
                except gspread.exceptions.WorksheetNotFound:
                    logging.warning(f"  [!] Aba '{sheet_name}' não encontrada na planilha {unidade_id}.")
                    result[sheet_name] = []
                except Exception as sheet_e:
                    logging.error(f"  [X] Erro ao ler aba {sheet_name}: {sheet_e}")
                    raise sheet_e
                    
            return result
        except Exception as e:
            import traceback
            error_details = traceback.format_exc()
            logging.error(f"Falha ao conectar no Google para {unidade_id}: {e}\nDetalhes técnicos:\n{error_details}")
            
        if attempt < retries - 1:
            logging.info(f"Aguardando 25 segundos antes de tentar novamente a unidade {unidade_id} (permitindo reset de cotas)...")
            time.sleep(25)
            
    logging.error(f"Todas as {retries} tentativas falharam para a unidade {unidade_id}.")
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
        "Content-Type": "application/json"
    }
    
    unidade_id = payload['unidade_id']
    
    try:
        import json
        
        # O POSTGRESQL (Supabase) sofre muito para fazer UPDATE de colunas JSONB gigantes (TOAST rewrite).
        # A estrategia mais rapida eh DELETAR a linha e dar um INSERT limpo.
        
        # 1. Deleta a linha atual
        delete_url = f"{url}?unidade_id=eq.{unidade_id}"
        try:
            logging.info(f"  [>] Limpando cache antigo no Supabase (DELETE)...")
            requests.delete(delete_url, headers=headers, timeout=60)
            logging.info(f"  [OK] Cache antigo removido.")
        except Exception as delete_e:
            logging.warning(f"  [!] Aviso no DELETE da unidade {unidade_id}: {delete_e}")
            
        # 2. Insere a nova linha completa (muito mais rapido que update)
        logging.info(f"  [>] Compactando pacotes e calculando tamanho do Payload...")
        total_size = len(json.dumps(payload))
        logging.info(f"  [OK] Tamanho total compactado para envio: {total_size / 1024 / 1024:.3f} MB")
        
        # Volta o cabeçalho merge-duplicates para garantir que o POST funcione caso o DELETE tenha falhado
        headers["Prefer"] = "resolution=merge-duplicates"
        
        logging.info(f"  [>] Enviando novo pacote (POST) para Supabase...")
        res = requests.post(url, headers=headers, json=payload, timeout=90)
        if res.status_code in [200, 201, 204]:
            logging.info(f"  [SUCESSO] Unidade {unidade_id} sincronizada no Supabase!")
            return True
        else:
            logging.error(f"  [X] Falha Supabase ao inserir unidade {res.status_code}: {res.text}")
            return False
            
    except Exception as e:
        logging.error(f"  [X] Falha de conexão com Supabase: {e}")
    return False

def run_sync_cycle():
    logging.info("--- Iniciando ciclo de sincronizacao ---")
    env_vars = load_env()
    
    gc = get_gspread_client()
    if not gc:
        logging.error("Abortando ciclo por falta de credenciais do Google Cloud.")
        return
        
    for unidade_id in UNIDADES_PLANEJAMENTO:
        sheets_data = fetch_google_sheets(unidade_id, gc)
        
        if sheets_data:
            import json
            payload = {
                "unidade_id": unidade_id,
                "carteira": json.dumps(sheets_data.get("Carteira_Planejador", [])),
                "principal": json.dumps(sheets_data.get("Plan_Principal", [])),
                "bd_metas": json.dumps({
                    "bd_metas": sheets_data.get("BD_Metas", []),
                    "base_curva": sheets_data.get("Base_Curva", []),
                    "bd_config": sheets_data.get("BD_Config", [])
                }),
                "reprogramadas": json.dumps(sheets_data.get("Reprogramadas", [])),
                "updated_at": datetime.utcnow().isoformat() + "Z"
            }
            upsert_supabase(env_vars, payload)
        
        # Pausa intencional para NUNCA dar cota excedida na Google Sheets API (100 requisicoes por 100 segundos)
        logging.info("Pausando 2 segundos antes da proxima unidade...")
        time.sleep(2)
        
    logging.info("--- Ciclo concluido ---")

if __name__ == "__main__":
    # Se estiver rodando no GitHub Actions, roda apenas um ciclo e encerra
    if os.environ.get("GITHUB_ACTIONS") == "true":
        logging.info("Executando em modo GitHub Actions (ciclo único)")
        run_sync_cycle()
    else:
        # Modo local: loop infinito
        logging.info("Sync Bot iniciado localmente. Pressione Ctrl+C para parar.")
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
