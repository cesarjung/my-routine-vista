import os
import sys
import glob
import json
import logging
from datetime import datetime
import gspread
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive'
]

# Root Google Drive Folder ID:
# https://drive.google.com/open?id=13UejORpk84bhf6Y4ISb3TedPLGU79eHn
ROOT_DRIVE_FOLDER_ID = '13UejORpk84bhf6Y4ISb3TedPLGU79eHn'

UNIDADES_MAP = {
    'BJL': '1rj2V7CxbZwkan63eCeLkH9G00Gi041IZNC6vwEgq6yI', # Bom Jesus da Lapa
    'BAR': '1OTHF2ytEOjGgfE49paARXkz9GjaklOQC_UhiXwUjC2E', # Barreiras
    'GNB': '1FO5tyhXygbbzSmmTGdnm45j4DD_rRFQgEheN8T8Wy70', # Guanambi
    'BRU': '1oS619l3x_D1mXkvDpw8vs91G6ipZmsK83JqEIwPj7Uk', # Brumado
    'LIV': '1gN2tR_LCuRnVCQ9tm2UURnVuMlJPVNEjvmo02TwFQCI', # Livramento
    'IBO': '1dNwj8qWTl1k92PxI9iXwaNZYITnxuKP-kOF1QnZK3Iw', # Ibotirama
    'JEQ': '1sGHf-zWXoxjnO20QBw2KWX39BSCzT8rzHdEz1hL7jyU', # Jequié
    'VDC': '1XmpY8mqkRou-CRY68j1ljHH8W8zcROy7wnwMMSfbV7o', # Vitória da Conquista
    'ITP': '1rzT8o6XZi4v8j7CYLky3BD3sT5IPjv1PRb45ipBfbw4'  # Itapetinga
}

SERVICE_ACCOUNT_EMAIL = 'zps-importador@roteirizador-461922.iam.gserviceaccount.com'

def get_credentials():
    creds_json_str = os.environ.get("GOOGLE_CREDENTIALS")
    if creds_json_str:
        try:
            creds_dict = json.loads(creds_json_str)
            return Credentials.from_service_account_info(creds_dict, scopes=SCOPES)
        except Exception as e:
            logging.error(f"Erro ao carregar credenciais env: {e}")
    if os.path.exists("google_credentials.json"):
        return Credentials.from_service_account_file("google_credentials.json", scopes=SCOPES)
    logging.error("Nenhuma credencial do Google encontrada.")
    return None

def get_or_create_unit_drive_folder(drive_service, root_folder_id, unit_sigla):
    query = f"'{root_folder_id}' in parents and name = '{unit_sigla}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
    results = drive_service.files().list(
        q=query,
        fields="files(id, name)",
        supportsAllDrives=True,
        includeItemsFromAllDrives=True
    ).execute()
    files = results.get('files', [])

    if files:
        return files[0]['id']

    folder_metadata = {
        'name': unit_sigla,
        'mimeType': 'application/vnd.google-apps.folder',
        'parents': [root_folder_id]
    }
    folder = drive_service.files().create(
        body=folder_metadata,
        fields='id',
        supportsAllDrives=True
    ).execute()
    return folder['id']

def upload_csv_to_gdrive(drive_service, unit_sigla, csv_filepath):
    try:
        unit_folder_id = get_or_create_unit_drive_folder(drive_service, ROOT_DRIVE_FOLDER_ID, unit_sigla)
        filename = os.path.basename(csv_filepath)

        file_metadata = {
            'name': filename,
            'parents': [unit_folder_id]
        }
        media = MediaFileUpload(csv_filepath, mimetype='text/csv')
        uploaded_file = drive_service.files().create(
            body=file_metadata,
            media_body=media,
            fields='id, webViewLink',
            supportsAllDrives=True
        ).execute()

        logging.info(f"  [DRIVE OK] Arquivo CSV '{filename}' salvo na pasta '{unit_sigla}' do Google Drive! ID: {uploaded_file.get('id')}")
        return uploaded_file
    except Exception as e:
        logging.error(f"Erro ao enviar arquivo para o Google Drive: {e}")
        return None

def paste_row_directly_to_plan_principal(gc, unit_sigla, csv_filepath):
    sheet_id = UNIDADES_MAP.get(unit_sigla)
    if not sheet_id:
        logging.error(f"Sigla de unidade desconhecida '{unit_sigla}'")
        return False

    try:
        spreadsheet = gc.open_by_key(sheet_id)
        worksheet = spreadsheet.worksheet("Plan_Principal")

        with open(csv_filepath, 'r', encoding='utf-8-sig') as f:
            lines = [l.strip() for l in f if l.strip()]

        if len(lines) < 2:
            logging.warning("CSV sem linhas de dados.")
            return False

        # Process all data lines from the CSV
        data_lines = lines[1:]

        # Find first empty row starting at line 6 (index 5) by checking Column B (Data)
        col_b_values = worksheet.col_values(2)
        target_row_idx = None

        for i in range(5, len(col_b_values)):
            val = col_b_values[i].strip() if i < len(col_b_values) else ""
            if not val:
                target_row_idx = i + 1 # 1-indexed row number
                break

        if target_row_idx is None:
            target_row_idx = len(col_b_values) + 1

        logging.info(f"  [SHEETS] Inserindo {len(data_lines)} linha(s) a partir da Linha {target_row_idx} preservando listas suspensas e validações...")

        # APENAS ATUALIZA AS CÉLULAS QUE POSSUEM DADOS!
        # Células vazias NUNCA são enviadas para preservar 100% dos botões de lista suspensa, caixas de seleção e fórmulas pré-existentes.
        cell_updates = []
        for r_offset, line in enumerate(data_lines):
            current_row = target_row_idx + r_offset
            row_cells = line.split(';')

            for c_idx, val in enumerate(row_cells[:78]):
                val_str = str(val if val is not None else '').strip().strip('"')
                if val_str:
                    col_letter = chr(65+c_idx) if c_idx < 26 else (chr(65+c_idx//26 - 1) + chr(65+c_idx%26))
                    cell_range = f"{col_letter}{current_row}"
                    cell_updates.append({
                        'range': cell_range,
                        'values': [[val_str]]
                    })

        if cell_updates:
            worksheet.batch_update(cell_updates, value_input_option='USER_ENTERED')
            logging.info(f"  [SHEETS OK] {len(cell_updates)} células com dados atualizadas a partir da Linha {target_row_idx} da Plan_Principal (listas suspensas preservadas)!")
            return True
        else:
            logging.warning("Nenhuma célula com dados para atualizar.")
            return False

    except Exception as e:
        err_msg = str(e)
        logging.error(f"  [SHEETS ERRO] Não foi possível escrever diretamente na Plan_Principal: {err_msg}")
        return False

def process_csv_file(csv_filepath):
    filename = os.path.basename(csv_filepath)
    sigla = filename.split('_')[0].upper()

    creds = get_credentials()
    if not creds:
        logging.error("Credenciais não encontradas.")
        return False

    gc = gspread.authorize(creds)
    drive_service = build('drive', 'v3', credentials=creds)

    logging.info(f"Iniciando processamento imediato do arquivo {filename} para a unidade {sigla}...")

    # 1. Salva o CSV na pasta do Google Drive da unidade (ex: BJL)
    upload_res = upload_csv_to_gdrive(drive_service, sigla, csv_filepath)

    # 2. Insere IMEDIATAMENTE os dados na primeira linha em branco da Plan_Principal do Sheets preservando listas suspensas!
    paste_res = paste_row_directly_to_plan_principal(gc, sigla, csv_filepath)

    return paste_res

if __name__ == "__main__":
    if len(sys.argv) > 1:
        files = [sys.argv[1]]
    else:
        files = glob.glob("*.csv") + glob.glob("scratch/*.csv")

    for csv_file in files:
        if "_" in os.path.basename(csv_file):
            process_csv_file(csv_file)
