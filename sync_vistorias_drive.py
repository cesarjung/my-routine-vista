"""
=============================================================================
sync_vistorias_drive.py
Sincronização da Base Central de Vistorias do Google Drive para o Supabase.

Pasta no Google Drive:
https://drive.google.com/open?id=1Mw44sdaQTsyuGeuttNPJVOIK_68asTvL

Arquivos esperados:
- Históricos: 2023, 2024, 2025
- Mensais: 01.2026, 02.2026, 03.2026 ... (mm.aaaa)

Regras:
1. Mapeamento dinâmico de colunas por nome do cabeçalho (não por índice).
2. Deduplicação por Obra ID: Sempre prevalece o registro mais recente.
3. Extração estruturada dos itens operacionais e de segurança.
=============================================================================
"""

import os
import re
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

DRIVE_VISTORIAS_FOLDER_ID = '1Mw44sdaQTsyuGeuttNPJVOIK_68asTvL'

# ─── Funções de Autenticação e Ambiente ─────────────────────────────────────

def load_env():
    env_vars = {}
    if os.path.exists('.env'):
        try:
            with open('.env', 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if '=' in line and not line.startswith('#'):
                        key, val = line.split('=', 1)
                        env_vars[key.strip()] = val.strip().strip('"').strip("'")
        except Exception as e:
            logging.warning(f"Aviso ao ler .env: {e}")

    for key, val in os.environ.items():
        if key.startswith('VITE_') or key == 'GOOGLE_CREDENTIALS':
            env_vars[key] = val.strip().strip('"').strip("'")

    return env_vars

def get_gspread_and_credentials():
    creds_json_str = os.environ.get("GOOGLE_CREDENTIALS")
    credentials = None
    if creds_json_str:
        try:
            creds_dict = json.loads(creds_json_str)
            credentials = Credentials.from_service_account_info(creds_dict, scopes=SCOPES)
        except Exception as e:
            logging.error(f"Erro ao carregar GOOGLE_CREDENTIALS: {e}")
    elif os.path.exists("google_credentials.json"):
        credentials = Credentials.from_service_account_file("google_credentials.json", scopes=SCOPES)

    if not credentials:
        logging.error("Nenhuma credencial do Google encontrada.")
        return None, None

    gc = gspread.authorize(credentials)
    return gc, credentials

# ─── Utilitários de Parsing de Cabeçalhos e Tipos ───────────────────────────

def is_sim(val):
    if not val:
        return False
    s = str(val).strip().upper()
    return s in ('SIM', 'S', 'TRUE', '1', 'YES', 'Y')

def is_nao(val):
    if not val:
        return False
    s = str(val).strip().upper()
    return s in ('NÃO', 'NAO', 'N', 'FALSE', '0', 'NO')

def parse_vistoria_date(val):
    """Tenta converter datas em vários formatos para objeto datetime."""
    if not val:
        return None
    s = str(val).strip()
    formats = [
        '%d/%m/%Y %H:%M:%S', '%d/%m/%Y %H:%M', '%d/%m/%Y',
        '%Y-%m-%d %H:%M:%S', '%Y-%m-%d',
        '%d-%m-%Y %H:%M:%S', '%d-%m-%Y'
    ]
    for fmt in formats:
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            pass
    return None

def normalize_obra_id(val):
    if not val:
        return ''
    s = str(val).strip().upper()
    # Remove prefixo 'OBRA' ou espaços
    s = re.sub(r'^OBRA\s*', '', s).strip()
    return s

def build_header_map(header_row):
    """
    Localiza os índices das colunas relevantes usando correspondência por regex nos nomes.
    Evita quebra por reposicionamento de colunas.
    """
    col_map = {}
    for idx, raw_h in enumerate(header_row):
        h = str(raw_h).strip().lower()
        if not h:
            continue

        # Obra / Projeto ID
        if ('número' in h or 'numero' in h or 'código' in h or 'codigo' in h or 'projeto' in h) and 'obra' in h:
            col_map['obra_id'] = idx
        elif h in ('obra', 'projeto', 'num_obra', 'cod_obra') and 'obra_id' not in col_map:
            col_map['obra_id'] = idx

        # Data / Carimbo
        if 'carimbo' in h or 'data da vistoria' in h or 'data vistoria' in h or (h == 'data' and 'data_vistoria' not in col_map):
            col_map['data_vistoria'] = idx

        # 0.1 - Observações importantes para planejamento
        if '0.1' in h or ('observações importantes' in h and 'planejamento' in h):
            col_map['obs_planejamento'] = idx

        # 0.2 - Apta ou Inapta
        if '0.2' in h or ('apta ou inapta' in h or 'apta/inapta' in h):
            col_map['apta_inapta'] = idx

        # 0.4 - Desligamento BT
        if '0.4' in h or ('desligamento bt' in h or 'desligamento b.t' in h):
            col_map['desligamento_bt'] = idx

        # 0.5 - Desligamento MT
        if '0.5' in h or ('desligamento mt' in h or 'desligamento m.t' in h):
            col_map['desligamento_mt'] = idx

        # 0.6 - Atuação de equipe LV
        if '0.6' in h or ('atuação' in h and 'equipe lv' in h) or ('atuacao' in h and 'lv' in h):
            col_map['equipe_lv'] = idx

        # 1.4 - Terreno molhado / chuva
        if '1.4' in h or ('terreno molhado' in h and 'acesso' in h) or ('chuva' in h and 'acesso' in h):
            col_map['acesso_chuva'] = idx

        # 1.6 - Autorização de passagem
        if '1.6' in h or ('autorização de passagem' in h or 'autorizacao de passagem' in h):
            col_map['autorizacao_passagem'] = idx

        # 1.7 - Alojamento próximo
        if '1.7' in h or ('alojamento' in h and 'próximo' in h) or ('alojamento' in h and 'proximo' in h):
            col_map['alojamento_proximo'] = idx

        # 1.10 - Observações gerais de acesso
        if '1.10' in h or ('observações gerais' in h and 'acesso' in h) or ('observacoes gerais' in h and 'acesso' in h):
            col_map['obs_acesso'] = idx

        # 2.1 - Equipamentos de manobra
        if '2.1' in h or ('equipamentos de manobra' in h or 'equipamento de manobra' in h):
            col_map['equipamentos_manobra'] = idx

        # 4.5 - Estado das estruturas permite Linha Viva
        if '4.5' in h or ('estado de conservação' in h and 'linha viva' in h) or ('conservacao' in h and 'lv' in h):
            col_map['conservacao_lv'] = idx

        # 5.1 - Manejo de vegetação (poda)
        if '5.1' in h or ('manejo da vegetação' in h or 'manejo de vegetacao' in h or 'poda' in h):
            col_map['necessita_poda'] = idx

        # 6.2 - Solo rochoso (Solo C)
        if '6.2' in h or ('solo rochoso' in h or 'solo c' in h):
            col_map['solo_rochoso'] = idx

        # 6.4 - Postes e estruturas em boas condições permitindo manobra (ALERTA VERMELHO)
        if '6.4' in h or ('boas condições' in h and 'manobra' in h) or ('boas condicoes' in h and 'manobra' in h):
            col_map['condicoes_manobra_seguras'] = idx

        # 6.5 - Risco de queda de poste ou rompimento de cabos (ALERTA VERMELHO)
        if '6.5' in h or ('risco de queda' in h or 'rompimento de cabos' in h):
            col_map['risco_queda_cabos'] = idx

        # 6.10 - Auxílio de linha viva
        if '6.10' in h or ('auxilio de linha viva' in h or 'auxílio de linha viva' in h or 'auxilio linha viva' in h):
            col_map['auxilio_lv'] = idx

    return col_map

def get_drive_access_token(credentials):
    try:
        if not credentials.valid or not credentials.token:
            import google.auth.transport.requests
            req = google.auth.transport.requests.Request()
            credentials.refresh(req)
        return credentials.token
    except Exception as e:
        logging.error(f"Erro ao obter access token do Google: {e}")
        return None

def check_folder_access(credentials, folder_id):
    try:
        token = get_drive_access_token(credentials)
        if not token:
            return None
        headers = {"Authorization": f"Bearer {token}"}
        url = f"https://www.googleapis.com/drive/v3/files/{folder_id}"
        params = {
            "supportsAllDrives": "true",
            "fields": "id,name,mimeType,owners"
        }
        resp = requests.get(url, headers=headers, params=params, timeout=30)
        if resp.status_code == 200:
            return resp.json()
        else:
            logging.warning(f"Metadados da pasta {folder_id} (HTTP {resp.status_code}): {resp.text[:200]}")
            return None
    except Exception as e:
        logging.warning(f"Aviso ao consultar metadados da pasta: {e}")
        return None

def list_files_in_drive_folder(credentials, folder_id):
    """Lista todos os arquivos do Google Drive contidos na pasta especificada."""
    try:
        token = get_drive_access_token(credentials)
        if not token:
            logging.error("Token de acesso inválido para o Google Drive.")
            return []

        service_email = getattr(credentials, 'service_account_email', None) or getattr(credentials, '_service_account_email', 'desconhecido')
        logging.info(f"Service Account autenticada: {service_email}")

        folder_meta = check_folder_access(credentials, folder_id)
        if folder_meta:
            logging.info(f"Pasta encontrada no Drive: '{folder_meta.get('name')}' (ID: {folder_id})")

        headers = {"Authorization": f"Bearer {token}"}
        url = "https://www.googleapis.com/drive/v3/files"

        # 1. Tentativa com supportsAllDrives + includeItemsFromAllDrives
        params = {
            "q": f"'{folder_id}' in parents and trashed = false",
            "fields": "files(id, name, mimeType, modifiedTime, createdTime)",
            "pageSize": 100,
            "supportsAllDrives": "true",
            "includeItemsFromAllDrives": "true"
        }
        resp = requests.get(url, headers=headers, params=params, timeout=30)

        if resp.status_code == 200:
            files = resp.json().get('files', [])
            if files:
                return files

            # 2. Tentativa sem filtro trashed
            params["q"] = f"'{folder_id}' in parents"
            resp2 = requests.get(url, headers=headers, params=params, timeout=30)
            if resp2.status_code == 200:
                files2 = resp2.json().get('files', [])
                if files2:
                    return files2

            logging.warning(f"A pasta {folder_id} retornou 0 arquivos.")
            logging.warning(f"DICA: Certifique-se de que a pasta no Google Drive foi compartilhada como 'Leitor' com o email da Service Account: {service_email}")
            return []
        else:
            logging.error(f"Erro ao listar arquivos da pasta {folder_id} ({resp.status_code}): {resp.text[:200]}")
            return []
    except Exception as e:
        logging.error(f"Erro ao listar arquivos da pasta {folder_id}: {e}")
        return []

def download_csv_from_drive(credentials, file_id, file_name):
    """Baixa o conteúdo de um arquivo CSV do Google Drive via REST API."""
    try:
        token = get_drive_access_token(credentials)
        if not token:
            return None
        headers = {"Authorization": f"Bearer {token}"}
        url = f"https://www.googleapis.com/drive/v3/files/{file_id}"
        params = {"alt": "media", "supportsAllDrives": "true"}
        resp = requests.get(url, headers=headers, params=params, timeout=60)
        if resp.status_code == 200:
            return resp.text
        else:
            logging.error(f"Erro ao baixar CSV '{file_name}' (HTTP {resp.status_code}): {resp.text[:200]}")
            return None
    except Exception as e:
        logging.error(f"Erro ao baixar CSV '{file_name}': {e}")
        return None

def extract_rows_from_file(gc, credentials, file_id, file_name, mime_type=''):
    """Extrai as linhas de um arquivo CSV ou Google Sheet com mapeamento dinâmico de cabeçalho."""
    logging.info(f"Processando arquivo: '{file_name}' (ID: {file_id})...")
    try:
        all_values = []
        is_csv = file_name.lower().endswith('.csv') or 'text/csv' in mime_type.lower()

        if is_csv:
            # Baixa o CSV via Drive REST API
            csv_text = download_csv_from_drive(credentials, file_id, file_name)
            if not csv_text:
                logging.warning(f"Arquivo CSV '{file_name}' vazio ou inacessível.")
                return []

            import csv as csv_mod
            import io

            # Detectar delimitador (vírgula, ponto-e-vírgula ou tab)
            first_lines = csv_text[:2000]
            semicolons = first_lines.count(';')
            commas = first_lines.count(',')
            tabs = first_lines.count('\t')
            if semicolons > commas and semicolons > tabs:
                delimiter = ';'
            elif tabs > commas:
                delimiter = '\t'
            else:
                delimiter = ','

            logging.info(f"Arquivo '{file_name}': delimitador detectado = '{delimiter}'")

            reader = csv_mod.reader(io.StringIO(csv_text), delimiter=delimiter)
            all_values = [row for row in reader]
        else:
            # Google Sheets nativo
            sh = gc.open_by_key(file_id)
            ws = sh.get_worksheet(0)
            all_values = ws.get_all_values()

        if len(all_values) < 2:
            logging.warning(f"Arquivo '{file_name}' está vazio ou sem cabeçalho.")
            return []

        # Tenta achar o cabeçalho nas primeiras 5 linhas
        header_idx = 0
        header_map = {}
        for r_idx in range(min(5, len(all_values))):
            h_map = build_header_map(all_values[r_idx])
            if 'obra_id' in h_map or 'obs_planejamento' in h_map:
                header_idx = r_idx
                header_map = h_map
                break

        if 'obra_id' not in header_map:
            # Fallback: assume primeira linha
            header_map = build_header_map(all_values[0])
            header_idx = 0

        logging.info(f"Arquivo '{file_name}': Cabeçalho linha {header_idx + 1}, colunas mapeadas: {list(header_map.keys())}")

        parsed_records = []
        for row in all_values[header_idx + 1:]:
            if not any(str(c).strip() for c in row):
                continue

            def get_col(field_key):
                if field_key in header_map and header_map[field_key] < len(row):
                    return row[header_map[field_key]].strip()
                return ''

            raw_obra = get_col('obra_id')
            obra_id = normalize_obra_id(raw_obra)
            if not obra_id or len(obra_id) < 2:
                continue

            raw_data = get_col('data_vistoria')
            dt = parse_vistoria_date(raw_data)

            # Extração dos campos operacionais
            apta_inapta_raw = get_col('apta_inapta')
            apta_inapta = 'INAPTA' if 'INAPTA' in apta_inapta_raw.upper() else ('APTA' if 'APTA' in apta_inapta_raw.upper() else apta_inapta_raw)

            # 1.4: Em condições de terreno molhado devido a chuva, haverá acesso? (se NÃO -> false)
            acesso_chuva_val = get_col('acesso_chuva')
            acesso_chuva = not is_nao(acesso_chuva_val)

            # 4.5: Estado permite Linha Viva? (se NÃO -> false)
            conservacao_lv_val = get_col('conservacao_lv')
            conservacao_lv = not is_nao(conservacao_lv_val)

            # 6.4: Postes e estruturas em boas condições? (se NÃO -> false, ALERTA VERMELHO)
            condicoes_manobra_val = get_col('condicoes_manobra_seguras')
            condicoes_manobra_seguras = not is_nao(condicoes_manobra_val)

            record = {
                'obra_id': obra_id,
                'data_vistoria': raw_data or None,
                'timestamp_vistoria': dt.isoformat() + 'Z' if dt else None,
                'dt_obj': dt,
                'apta_inapta': apta_inapta or None,
                'obs_planejamento': get_col('obs_planejamento') or None,
                'desligamento_bt': is_sim(get_col('desligamento_bt')),
                'desligamento_mt': is_sim(get_col('desligamento_mt')),
                'equipe_lv': is_sim(get_col('equipe_lv')),
                'acesso_chuva': acesso_chuva,
                'autorizacao_passagem': is_sim(get_col('autorizacao_passagem')),
                'alojamento_proximo': get_col('alojamento_proximo') or None,
                'obs_acesso': get_col('obs_acesso') or None,
                'equipamentos_manobra': get_col('equipamentos_manobra') or None,
                'conservacao_lv': conservacao_lv,
                'necessita_poda': is_sim(get_col('necessita_poda')),
                'solo_rochoso': is_sim(get_col('solo_rochoso')),
                'condicoes_manobra_seguras': condicoes_manobra_seguras,
                'risco_queda_cabos': is_sim(get_col('risco_queda_cabos')),
                'auxilio_lv': is_sim(get_col('auxilio_lv')),
                'arquivo_origem': file_name,
                'synced_at': datetime.utcnow().isoformat() + 'Z'
            }

            parsed_records.append(record)

        logging.info(f"Arquivo '{file_name}': {len(parsed_records)} vistorias lidas.")
        return parsed_records

    except Exception as e:
        logging.error(f"Erro ao processar arquivo '{file_name}': {e}")
        return []

# ─── Deduplicação e Consolidação da Vistoria Mais Recente ──────────────────

def consolidate_latest_vistorias(all_records):
    """
    Garante que cada obra possua exatamente 1 registro consolidado,
    sempre selecionando o registro com a data/timestamp mais recente.
    """
    obras_map = {}
    for r in all_records:
        obra_id = r['obra_id']
        if obra_id not in obras_map:
            obras_map[obra_id] = r
        else:
            existing = obras_map[obra_id]
            # Compara timestamps ou ordem de leitura (arquivos mais recentes tem prioridade)
            curr_dt = r.get('dt_obj')
            exist_dt = existing.get('dt_obj')

            if curr_dt and exist_dt:
                if curr_dt >= exist_dt:
                    obras_map[obra_id] = r
            elif curr_dt and not exist_dt:
                obras_map[obra_id] = r
            elif not curr_dt and not exist_dt:
                # Se nenhum tem data parseada, mantém o arquivo mais novo (ex: 2026 sobre 2025)
                obras_map[obra_id] = r

    # Limpa objeto dt_obj temporário antes de enviar ao Supabase
    final_list = []
    for r in obras_map.values():
        clean_r = {k: v for k, v in r.items() if k != 'dt_obj'}
        final_list.append(clean_r)

    return final_list

# ─── Upsert no Supabase ────────────────────────────────────────────────────

def upsert_to_supabase(vistorias_list, env_vars):
    if not vistorias_list:
        logging.info("Nenhuma vistoria para salvar no Supabase.")
        return

    supabase_url = env_vars.get('VITE_SUPABASE_URL', '')
    supabase_key = env_vars.get('VITE_SUPABASE_PUBLISHABLE_KEY', '')

    if not supabase_url or not supabase_key:
        logging.error("Supabase URL ou Key não definidos.")
        return

    headers = {
        'apikey': supabase_key,
        'Authorization': f'Bearer {supabase_key}',
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=minimal'
    }

    BATCH_SIZE = 400
    total_synced = 0

    logging.info(f"Iniciando upsert de {len(vistorias_list)} vistorias consolidadas no Supabase...")

    for i in range(0, len(vistorias_list), BATCH_SIZE):
        batch = vistorias_list[i:i+BATCH_SIZE]
        resp = requests.post(
            f"{supabase_url}/rest/v1/vistorias_formulario?on_conflict=obra_id",
            headers=headers,
            json=batch,
            timeout=60
        )
        if resp.status_code in (200, 201):
            total_synced += len(batch)
        else:
            logging.error(f"Erro no batch {i}-{i+len(batch)}: HTTP {resp.status_code} — {resp.text[:300]}")

    logging.info(f"✅ Sincronização concluída! {total_synced} vistorias consolidadas no Supabase.")

# ─── Função Principal ───────────────────────────────────────────────────────

def run_vistorias_sync(gc=None, env_vars=None, credentials=None):
    if env_vars is None:
        env_vars = load_env()

    if gc is None or credentials is None:
        gc_new, creds_new = get_gspread_and_credentials()
        if gc is None:
            gc = gc_new
        if credentials is None:
            credentials = creds_new

    if not gc or not credentials:
        logging.error("Não foi possível inicializar os clientes do Google. Abortando sync de vistorias.")
        return

    logging.info("==================================================================")
    logging.info("INICIANDO SINCRONIZAÇÃO COMPLETA DE VISTORIAS (GOOGLE DRIVE)")
    logging.info(f"Pasta Alvo: {DRIVE_VISTORIAS_FOLDER_ID}")
    logging.info("==================================================================")

    files = list_files_in_drive_folder(credentials, DRIVE_VISTORIAS_FOLDER_ID)
    if not files:
        logging.warning("Nenhum arquivo encontrado na pasta de vistorias.")
        return

    logging.info(f"Encontrados {len(files)} arquivos na pasta de vistorias.")

    # Ordena para processar primeiro os históricos (2023, 2024, 2025) e depois os mensais (01.2026, 02.2026...)
    def file_sort_key(f):
        name = f.get('name', '')
        # Remove extensão .csv para matching correto
        name_clean = re.sub(r'\.(csv|xlsx?)$', '', name, flags=re.IGNORECASE).strip()
        # Se for só ano, prioridade baixa (2023, 2024, 2025)
        if re.match(r'^\d{4}$', name_clean):
            return (1, int(name_clean))
        # Se for mm.aaaa
        m = re.match(r'^(\d{2})[.\-_](\d{4})', name_clean)
        if m:
            mes, ano = int(m.group(1)), int(m.group(2))
            return (2, ano * 100 + mes)
        return (0, 0)

    sorted_files = sorted(files, key=file_sort_key)

    all_extracted_records = []
    for f in sorted_files:
        f_id = f.get('id')
        f_name = f.get('name')
        f_mime = f.get('mimeType', '')
        records = extract_rows_from_file(gc, credentials, f_id, f_name, mime_type=f_mime)
        all_extracted_records.extend(records)

    logging.info(f"Total bruto de registros extraídos: {len(all_extracted_records)}")

    # Consolida e seleciona a mais recente por obra
    consolidated = consolidate_latest_vistorias(all_extracted_records)
    logging.info(f"Total de obras únicas após consolidação por data mais recente: {len(consolidated)}")

    # Envia para a tabela vistorias_formulario no Supabase
    upsert_to_supabase(consolidated, env_vars)

if __name__ == '__main__':
    run_vistorias_sync()
