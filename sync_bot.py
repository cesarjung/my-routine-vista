import os
import time
import json
import logging
from datetime import datetime
import requests
import gspread
from google.oauth2.service_account import Credentials

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    force=True
)

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

def parse_number(val):
    if not val:
        return 0.0
    val_str = str(val).strip().replace('R$', '').strip()
    if not val_str or val_str == '-' or val_str.upper() == 'VAZIO':
        return 0.0
    try:
        # Se tem vírgula, e ponto, retira o ponto e troca vírgula por ponto.
        if ',' in val_str and '.' in val_str:
            val_str = val_str.replace('.', '').replace(',', '.')
        elif ',' in val_str:
            val_str = val_str.replace(',', '.')
        return float(val_str)
    except Exception:
        return 0.0

def fetch_global_recursos(gc, retries=3):
    sheet_id = '1lUNIeWCddfmvJEjWJpQMtuR4oRuMsI3VImDY0xBp3Bs'
    for attempt in range(retries):
        try:
            logging.info(f"Baixando base global de Planejamento (Tentativa {attempt + 1}/{retries})...")
            spreadsheet = gc.open_by_key(sheet_id)
            worksheet = spreadsheet.worksheet("Planejamento")
            raw_data = worksheet.get_all_values()
            
            # Precisamos mapear: Projeto (G=6), Meta (AL=37), Realizado (AN=39)
            recursos_globais = {}
            # Poste/Turno: Data(A=0), Supervisor(D=3), Equipe Cod(E=4), Equipe(F=5), Projeto(G=6), IMPLANT(T=19), Unidade(BD=55)
            central_postes = {}
            
            # Map das unidades normalizado para garantir que os nomes fiquem iguais
            unidades_map = {
                'BARREIRAS': '1OTHF2ytEOjGgfE49paARXkz9GjaklOQC_UhiXwUjC2E',
                'LAPA': '1rj2V7CxbZwkan63eCeLkH9G00Gi041IZNC6vwEgq6yI',
                'GUANAMBI': '1FO5tyhXygbbzSmmTGdnm45j4DD_rRFQgEheN8T8Wy70',
                'BRUMADO': '1oS619l3x_D1mXkvDpw8vs91G6ipZmsK83JqEIwPj7Uk',
                'LIVRAMENTO': '1gN2tR_LCuRnVCQ9tm2UURnVuMlJPVNEjvmo02TwFQCI',
                'IBOTIRAMA': '1dNwj8qWTl1k92PxI9iXwaNZYITnxuKP-kOF1QnZK3Iw',
                'JEQUIE': '1sGHf-zWXoxjnO20QBw2KWX39BSCzT8rzHdEz1hL7jyU',
                'VITORIA': '1XmpY8mqkRou-CRY68j1ljHH8W8zcROy7wnwMMSfbV7o',
                'ITAPETINGA': '1rzT8o6XZi4v8j7CYLky3BD3sT5IPjv1PRb45ipBfbw4'
            }
            
            import unicodedata
            def normalize_name(name):
                # Remove acentos para facilitar o match
                return ''.join(c for c in unicodedata.normalize('NFD', name) if unicodedata.category(c) != 'Mn').upper()
            
            for i, row in enumerate(raw_data):
                if i == 0 or len(row) <= 6:
                    continue
                
                projeto = str(row[6]).strip()
                if not projeto:
                    continue
                    
                meta = parse_number(row[37]) if len(row) > 37 else 0.0
                realizado = parse_number(row[39]) if len(row) > 39 else 0.0
                
                # Extrai dados do Poste/Turno da Planilha Central
                unidade_nome_raw = str(row[55]).strip() if len(row) > 55 else ""
                unidade_nome = normalize_name(unidade_nome_raw)
                implant_val = row[19] if len(row) > 19 else ""
                
                if str(implant_val).strip():
                    uid = None
                    for key, val in unidades_map.items():
                        if key in unidade_nome:
                            uid = val
                            break
                            
                    if uid:
                        if uid not in central_postes:
                            central_postes[uid] = []
                        
                    data_val = str(row[0]).strip() if len(row) > 0 else ""
                    supervisor = str(row[3]).strip() if len(row) > 3 else ""
                    equipe = str(row[5]).strip() if len(row) > 5 else ""
                    
                    central_postes[uid].append({
                        "data": data_val,
                        "supervisor": supervisor,
                        "equipe": equipe,
                        "projeto": projeto,
                        "implant": implant_val
                    })

                if realizado > 0:
                    if projeto not in recursos_globais:
                        recursos_globais[projeto] = 0.0
                        
                    recursos_globais[projeto] += meta
            
            logging.info(f"  [OK] Base global carregada. Projetos mapeados: {len(recursos_globais)}. Linhas de Poste/Turno: {sum(len(x) for x in central_postes.values())}")
            return recursos_globais, central_postes
        except Exception as e:
            logging.error(f"Erro ao ler base global: {e}")
            if attempt < retries - 1:
                time.sleep(10)
    return {}, {}

def fetch_google_sheets(unidade_id, gc, retries=3):
    sheets_to_fetch = ['Carteira_Planejador', 'Plan_Principal', 'BD_Metas', 'Reprogramadas', 'Base_Curva', 'BD_Config']
    
    for attempt in range(retries):
        try:
            logging.info(f"Baixando dados do Google (via gspread) para a unidade {unidade_id} (Tentativa {attempt + 1}/{retries})...")
            spreadsheet = gc.open_by_key(unidade_id)
            
            # Limite maximo de colunas a extrair de cada aba (para evitar lixo infinito)
            MAX_COLS = {
                "Carteira_Planejador": 50,
                "Plan_Principal": 78,
                "Reprogramadas": 55,
                "Base_Curva": 10,
                "BD_Config": 100,
                "BD_Metas": 20
            }
            
            # Colunas (índices 0-based) que o frontend de fato consome. O resto é lixo que incha o payload.
            USED_COLS = {
                # Carteira liberada até 50 colunas para busca dinâmica de cabeçalhos
                "Plan_Principal": {0, 1, 4, 6, 7, 8, 12, 14, 20, 21, 22, 23, 24, 25, 28, 29, 37, 38, 40, 42, 53, 64, 67, 76},
                "Reprogramadas": {0, 1, 4, 6, 7, 12, 20, 28, 29, 37, 38, 40, 42}
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

def sync_materiais_regras(gc, env_vars):
    supabase_url = env_vars.get('VITE_SUPABASE_URL')
    supabase_key = env_vars.get('VITE_SUPABASE_PUBLISHABLE_KEY')
    if not supabase_url or not supabase_key:
        logging.error("Supabase credentials not found for rules sync.")
        return
        
    sheet_id = '1c-Wy5fnNj2Lji7Y-Qv4sFZMqO6Oh-wm9fz-uV-qfyqI'
    try:
        logging.info("Sincronizando regras de materiais (DE/PARA)...")
        spreadsheet = gc.open_by_key(sheet_id)
        
        headers = {
            "apikey": supabase_key,
            "Authorization": f"Bearer {supabase_key}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates"
        }
        
        for tab_name in ["GRUPOS", "MAPA_LIBERACAO", "REGRAS_MATERIAL"]:
            try:
                logging.info(f"  [>] Lendo aba '{tab_name}'...")
                worksheet = spreadsheet.worksheet(tab_name)
                raw_data = worksheet.get_all_values()
                if not raw_data:
                    continue
                
                keys = [k.strip().lower() for k in raw_data[0]]
                records = []
                for row in raw_data[1:]:
                    row_data = {keys[idx]: row[idx].strip() if idx < len(row) else "" for idx in range(len(keys))}
                    records.append(row_data)
                
                payload = {
                    "tipo": tab_name,
                    "dados": records
                }
                
                url = f"{supabase_url}/rest/v1/materiais_regras"
                
                # Delete anterior para evitar violação de constraint de chave única
                try:
                    requests.delete(f"{url}?tipo=eq.{tab_name}", headers=headers, timeout=15)
                except Exception as del_e:
                    logging.warning(f"  [!] Falha ao deletar regra antiga {tab_name}: {del_e}")
                
                res = requests.post(url, headers=headers, json=payload, timeout=30)
                if res.status_code in [200, 201, 204]:
                    logging.info(f"  [OK] Regras da aba {tab_name} sincronizadas! ({len(records)} registros)")
                else:
                    logging.error(f"  [X] Falha ao salvar regras da aba {tab_name}: {res.status_code} - {res.text}")
                    
            except Exception as e:
                logging.error(f"  [X] Erro na aba {tab_name}: {e}")
                
    except Exception as e:
        logging.error(f"Erro ao abrir planilha de regras: {e}")

def sync_materiais_por_ponto(gc, env_vars):
    supabase_url = env_vars.get('VITE_SUPABASE_URL')
    supabase_key = env_vars.get('VITE_SUPABASE_PUBLISHABLE_KEY')
    if not supabase_url or not supabase_key:
        logging.error("Supabase credentials not found for materials sync.")
        return
        
    folder_id = '1la_5Ozfa0zkZQ8a4OKElkjrIA9dPUB8Y'
    unidade_map = {
        "BARREIRAS": "1OTHF2ytEOjGgfE49paARXkz9GjaklOQC_UhiXwUjC2E"
    }
    
    try:
        logging.info("Buscando arquivos na pasta de materiais no Google Drive...")
        
        credentials = gc.http_client.auth
        if not credentials.valid:
            from google.auth.transport.requests import Request
            credentials.refresh(Request())
        access_token = credentials.token
        
        headers_drive = {
            "Authorization": f"Bearer {access_token}"
        }
        
        # Procura por qualquer arquivo na pasta (sem filtrar por planilha do Google, pois pode ser CSV)
        query = f"'{folder_id}' in parents and trashed = false"
        url_drive = f"https://www.googleapis.com/drive/v3/files?q={requests.utils.quote(query)}&fields=files(id,name,mimeType)"
        res_drive = requests.get(url_drive, headers=headers_drive, timeout=30)
        
        if res_drive.status_code != 200:
            logging.error(f"Erro ao listar arquivos da pasta de materiais: {res_drive.status_code} - {res_drive.text}")
            return
            
        files = res_drive.json().get('files', [])
        logging.info(f"Planilhas/arquivos encontrados na pasta de materiais: {[f['name'] for f in files]}")
        
        headers = {
            "apikey": supabase_key,
            "Authorization": f"Bearer {supabase_key}",
            "Content-Type": "application/json"
        }
        
        for tab_name, plan_unidade_id in unidade_map.items():
            # Busca arquivo que corresponde à unidade
            target_file = None
            for f in files:
                fname = f['name'].upper().replace(' ', '_').replace('-', '_')
                if f"MATERIAIS_POR_PONTO_{tab_name}" in fname or (tab_name in fname and "MATERIAIS" in fname):
                    target_file = f
                    break
                    
            if not target_file:
                logging.warning(f"Nenhuma planilha de materiais encontrada na pasta para a unidade {tab_name}.")
                continue
                
            sheet_title = f"MATERIAIS_POR_PONTO_{tab_name}"
            try:
                logging.info(f"  [>] Abrindo/Baixando '{target_file['name']}' (ID: {target_file['id']})...")
                
                raw_data = []
                # Se for planilha nativa do Google, usamos gspread
                if target_file.get('mimeType') == 'application/vnd.google-apps.spreadsheet':
                    spreadsheet = gc.open_by_key(target_file['id'])
                    
                    # Abre a aba da planilha correspondente
                    worksheet = None
                    for w in spreadsheet.worksheets():
                        w_title = w.title.upper().replace(' ', '_').replace('-', '_')
                        if sheet_title.upper().replace(' ', '_').replace('-', '_') in w_title or tab_name in w_title:
                            worksheet = w
                            break
                            
                    if not worksheet:
                        # Tenta pegar a primeira aba como fallback
                        worksheet = spreadsheet.get_worksheet(0)
                        logging.info(f"  [!] Aba '{sheet_title}' não encontrada. Usando a primeira aba '{worksheet.title}'.")
                    
                    logging.info(f"  [>] Lendo aba '{worksheet.title}'...")
                    raw_data = worksheet.get_all_values()
                else:
                    # É um arquivo binário (CSV ou Excel)
                    url_media = f"https://www.googleapis.com/drive/v3/files/{target_file['id']}?alt=media"
                    res_media = requests.get(url_media, headers=headers_drive, timeout=90)
                    if res_media.status_code != 200:
                        logging.error(f"  [X] Falha ao baixar arquivo binário: {res_media.status_code}")
                        continue
                        
                    content_str = res_media.content.decode('utf-8', errors='ignore')
                    
                    import csv
                    import io
                    # Detecta o delimitador (normalmente ; ou ,)
                    first_line = content_str.split('\n')[0] if content_str else ''
                    delimiter = ';' if ';' in first_line else ','
                    
                    reader = csv.reader(io.StringIO(content_str), delimiter=delimiter)
                    raw_data = list(reader)
                
                if not raw_data or len(raw_data) < 2:
                    logging.warning(f"  [!] Aba/Arquivo está vazio ou sem dados.")
                    continue
                
                # Remove aspas extras das strings (comum em CSVs exportados)
                cleaned_data = []
                for row in raw_data:
                    cleaned_data.append([c.strip().strip('"').strip("'") for c in row])
                
                headers_row = [h.strip().lower() for h in cleaned_data[0]]
                
                col_indices = {
                    "projeto": -1,
                    "ponto_obra": -1,
                    "codigo": -1,
                    "descricao": -1,
                    "quantidade": -1,
                    "orcamentista": -1,
                    "com_mascara": -1,
                    "unidade": -1,
                    "mascara_e_ponto": -1,
                }
                
                for col_name in col_indices:
                    for idx, h in enumerate(headers_row):
                        if col_name.replace("_", " ") in h or h in col_name.replace("_", " ") or col_name in h:
                            col_indices[col_name] = idx
                            break
                            
                # Fallbacks manuais caso a correspondência acima falhe
                if col_indices["ponto_obra"] == -1 and "ponto" in headers_row:
                    col_indices["ponto_obra"] = headers_row.index("ponto")
                if col_indices["codigo"] == -1 and "código" in headers_row:
                    col_indices["codigo"] = headers_row.index("código")
                if col_indices["descricao"] == -1 and "descrição" in headers_row:
                    col_indices["descricao"] = headers_row.index("descrição")
                if col_indices["orcamentista"] == -1 and "orçamentista" in headers_row:
                    col_indices["orcamentista"] = headers_row.index("orçamentista")
                if col_indices["mascara_e_ponto"] == -1 and "mascara e ponto" in headers_row:
                    col_indices["mascara_e_ponto"] = headers_row.index("mascara e ponto")
                
                records = []
                for row in cleaned_data[1:]:
                    if not row or not any(row):
                        continue
                    
                    def get_val(col_key):
                        idx = col_indices[col_key]
                        return row[idx].strip() if idx != -1 and idx < len(row) else ""
                    
                    qty_str = get_val("quantidade")
                    qty = parse_number(qty_str)
                    
                    records.append({
                        "unidade_id": plan_unidade_id,
                        "projeto": get_val("projeto"),
                        "ponto_obra": get_val("ponto_obra"),
                        "codigo": get_val("codigo"),
                        "descricao": get_val("descricao"),
                        "quantidade": qty,
                        "unidade": get_val("unidade"),
                        "mascara_e_ponto": get_val("mascara_e_ponto"),
                        "orçamentista": get_val("orcamentista"),
                        "com_mascara": get_val("com_mascara")
                    })
                
                logging.info(f"  [>] Carregados {len(records)} registros. Limpando cache antigo no Supabase...")
                delete_url = f"{supabase_url}/rest/v1/materiais_por_ponto?unidade_id=eq.{plan_unidade_id}"
                requests.delete(delete_url, headers=headers, timeout=60)
                
                chunk_size = 2000
                insert_url = f"{supabase_url}/rest/v1/materiais_por_ponto"
                logging.info(f"  [>] Enviando novos registros em blocos de {chunk_size}...")
                
                for i in range(0, len(records), chunk_size):
                    chunk = records[i:i+chunk_size]
                    res = requests.post(insert_url, headers=headers, json=chunk, timeout=60)
                    if res.status_code not in [200, 201, 204]:
                        logging.error(f"  [X] Falha no bloco {i//chunk_size}: {res.status_code} - {res.text}")
                        # Tenta sub-blocos menores
                        sub_chunk_size = 500
                        for j in range(0, len(chunk), sub_chunk_size):
                            sub_chunk = chunk[j:j+sub_chunk_size]
                            requests.post(insert_url, headers=headers, json=sub_chunk, timeout=60)
                    else:
                        if i % 10000 == 0 or i + chunk_size >= len(records):
                            logging.info(f"    Sincronizados {min(i + chunk_size, len(records))}/{len(records)} registros...")
                
                logging.info(f"  [OK] Aba '{sheet_title}' sincronizada com sucesso!")
                
            except Exception as e:
                logging.error(f"  [X] Erro ao sincronizar aba '{sheet_title}': {e}")
                
    except Exception as e:
        logging.error(f"Erro geral no sync de materiais por ponto: {e}")

def run_sync_cycle():
    logging.info("--- Iniciando ciclo de sincronizacao ---")
    env_vars = load_env()
    
    gc = get_gspread_client()
    if not gc:
        logging.error("Abortando ciclo por falta de credenciais do Google Cloud.")
        return
        
    global_recursos, central_postes = fetch_global_recursos(gc)
    
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
                    "bd_config": sheets_data.get("BD_Config", []),
                    "recursos_aplicados": global_recursos,
                    "central_postes": central_postes.get(unidade_id, [])
                }),
                "reprogramadas": json.dumps(sheets_data.get("Reprogramadas", [])),
                "updated_at": datetime.utcnow().isoformat() + "Z"
            }
            upsert_supabase(env_vars, payload)
        
        logging.info("Pausando 2 segundos antes da proxima unidade...")
        time.sleep(2)
        
    # Executa a sincronização de materiais e regras ao fim do ciclo
    try:
        sync_materiais_regras(gc, env_vars)
        sync_materiais_por_ponto(gc, env_vars)
    except Exception as e:
        logging.error(f"Erro no sync de materiais e regras: {e}")
        
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
