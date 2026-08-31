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

def get_unit_from_filename(filename):
    if not filename:
        return 'BJL'
    basename = os.path.basename(filename).upper()
    for sigla in UNIDADES_MAP.keys():
        if basename.startswith(sigla) or f"_{sigla}_" in f"_{basename}_":
            return sigla
    # Default to BJL if Bom Jesus da Lapa
    if 'BOM JESUS' in basename or 'LAPA' in basename or 'BJL' in basename:
        return 'BJL'
    return 'BJL'

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

def paste_row_directly_to_plan_principal(gc, unit_sigla, csv_filepath, is_reprogramar=False, motivo=None, deleted_schedules=None):
    sheet_id = UNIDADES_MAP.get(unit_sigla)
    if not sheet_id:
        logging.error(f"Sigla de unidade desconhecida '{unit_sigla}'")
        return False

    try:
        spreadsheet = gc.open_by_key(sheet_id)
        worksheet = spreadsheet.worksheet("Plan_Principal")

        with open(csv_filepath, 'r', encoding='utf-8-sig') as f:
            lines = [l.strip() for l in f if l.strip()]

        if len(lines) < 2 and not deleted_schedules:
            logging.warning("CSV sem linhas de dados.")
            return False

        # Process all data lines from the CSV
        data_lines = lines[1:] if len(lines) > 1 else []

        # Helpers
        import re
        def extract_date(s):
            if not s: return ""
            m = re.search(r'(\d{2}/\d{2}/\d{4})', str(s))
            if m: return m.group(1)
            m2 = re.search(r'(\d{4}-\d{2}-\d{2})', str(s))
            if m2:
                parts = m2.group(1).split('-')
                return f"{parts[2]}/{parts[1]}/{parts[0]}"
            return str(s).strip()

        def clean_code(c):
            if not c: return ""
            return re.sub(r'[^A-Z0-9]', '', re.sub(r'^[BP]-', '', str(c).strip().upper()))

        def get_col_letter(col_idx):
            if col_idx < 26:
                return chr(65 + col_idx)
            return chr(65 + (col_idx // 26) - 1) + chr(65 + (col_idx % 26))

        # 1. Read all rows from Plan_Principal
        raw_all_rows = worksheet.get_all_values()

        # 2. Helpers to find existing rows or empty slots
        def find_existing_planned_row(rows, target_eq, target_dt, target_bk, exclude=set()):
            for i in range(5, len(rows)):
                if i in exclude: continue
                r = rows[i]
                if not r or len(r) == 0: continue
                exist_proj = clean_code(r[7] if len(r) > 7 else "")
                if not exist_proj: continue
                exist_bk = str(r[62] if len(r) > 62 else "").strip()
                exist_eq = str(r[6] if len(r) > 6 else "").strip().upper()
                exist_dt = extract_date(r[1] if len(r) > 1 else "")
                if (target_bk and exist_bk and exist_bk == target_bk) or \
                   (target_eq and exist_eq == target_eq and target_dt and exist_dt == target_dt):
                    return i
            return -1

        def find_template_slot(rows, target_eq, target_dt, exclude=set()):
            for i in range(5, len(rows)):
                if i in exclude: continue
                r = rows[i]
                if not r or len(r) == 0: continue
                exist_proj = clean_code(r[7] if len(r) > 7 else "")
                if exist_proj: continue
                exist_eq = str(r[6] if len(r) > 6 else "").strip().upper()
                exist_dt = extract_date(r[1] if len(r) > 1 else "")
                if target_eq and exist_eq == target_eq and target_dt and exist_dt == target_dt:
                    return i
            return -1

        def find_first_empty_row(rows, exclude=set()):
            for i in range(5, len(rows)):
                if i in exclude: continue
                r = rows[i]
                if not r or len(r) == 0: return i
                val_b = str(r[1] if len(r) > 1 else "").strip()
                val_g = str(r[6] if len(r) > 6 else "").strip()
                val_h = str(r[7] if len(r) > 7 else "").strip()
                if not val_b and not val_g and not val_h:
                    return i
            return max(5, len(rows))

        reprog_updates = []
        rows_to_delete = []
        planned_operations = []

        # Process explicit deleted schedules (requests to delete rows from Plan_Principal)
        if deleted_schedules:
            for ds in deleted_schedules:
                del_eq = str(ds.get('equipe', '')).strip().upper()
                del_dt = extract_date(ds.get('dataCompleta') or ds.get('dataStr') or ds.get('data', ''))
                del_bk = str(ds.get('chaveBk', '')).strip()
                del_idx = find_existing_planned_row(raw_all_rows, del_eq, del_dt, del_bk, set(rows_to_delete))
                if del_idx != -1 and del_idx not in rows_to_delete:
                    rows_to_delete.append(del_idx)
                    logging.info(f"  [SHEETS] Linha {del_idx + 1} marcada para exclusão definitiva na Plan_Principal (equipe={del_eq}, data={del_dt}).")

        # Find next available row in Reprogramadas tab if needed
        next_reprog_row = 6
        if is_reprogramar:
            try:
                ws_reprog = spreadsheet.worksheet("Reprogramadas")
                reprog_b_vals = ws_reprog.col_values(2)
                found_reprog = False
                for i in range(5, len(reprog_b_vals)):
                    if not reprog_b_vals[i].strip():
                        next_reprog_row = i + 1
                        found_reprog = True
                        break
                if not found_reprog:
                    next_reprog_row = max(6, len(reprog_b_vals) + 1)
            except Exception as e:
                logging.warning(f"Aba Reprogramadas aviso: {e}")

        # 3. Categorize each data line
        for line in data_lines:
            row_cells = line.split(';')
            nova_dt = extract_date(row_cells[1] if len(row_cells) > 1 else "")
            nova_eq = str(row_cells[6] if len(row_cells) > 6 else "").strip().upper()
            novo_proj = clean_code(row_cells[7] if len(row_cells) > 7 else "")
            nova_bk = str(row_cells[62] if len(row_cells) > 62 else "").strip().strip('"')
            is_line_reprog = is_reprogramar or ('REPROG' in str(row_cells[0]).upper()) or (str(row_cells[0]).upper() == 'TRUE')

            existing_idx = find_existing_planned_row(raw_all_rows, nova_eq, nova_dt, nova_bk, set(rows_to_delete))
            has_existing = existing_idx != -1
            old_proj = clean_code(raw_all_rows[existing_idx][7] if has_existing and len(raw_all_rows[existing_idx]) > 7 else "")
            is_same_obra = (novo_proj == old_proj) if (has_existing and novo_proj and old_proj) else True

            if is_line_reprog:
                # 1. Copia a linha (existente ou atual) para a aba Reprogramadas (sem nada na Coluna A e com Motivo na Coluna AU)
                source_row = raw_all_rows[existing_idx] if has_existing else row_cells
                copy_row = list(source_row)
                while len(copy_row) <= 79: copy_row.append("")
                copy_row[0] = "" # Coluna A vazia na aba Reprogramadas conforme especificado
                motivo_linha = (str(row_cells[46]).strip() if len(row_cells) > 46 and str(row_cells[46]).strip() else "") or (str(motivo).strip() if motivo else "") or (str(source_row[46]).strip() if len(source_row) > 46 and str(source_row[46]).strip() else "") or ""
                if motivo_linha:
                    copy_row[46] = str(motivo_linha).strip()

                dest_reprog = next_reprog_row
                next_reprog_row += 1

                for c_idx, val in enumerate(copy_row):
                    if c_idx >= 77: # Reprogramadas tab has 77 columns (A to BY)
                        continue
                    val_str = str(val if val is not None else '').strip()
                    if val_str:
                        reprog_updates.append({
                            'range': f"{get_col_letter(c_idx)}{dest_reprog}",
                            'values': [[val_str]]
                        })

                # Na Plan_Principal, a nova programação fica com Coluna AU vazia (sem motivo ainda)
                while len(row_cells) <= 46: row_cells.append("")
                row_cells[46] = ""

                # 2. Comportamento na Plan_Principal
                if has_existing and is_same_obra:
                    old_compilado = str(raw_all_rows[existing_idx][14] if len(raw_all_rows[existing_idx]) > 14 else "").strip()
                    new_compilado = str(row_cells[14] if len(row_cells) > 14 else "").strip()

                    old_val = str(raw_all_rows[existing_idx][37] if len(raw_all_rows[existing_idx]) > 37 else "").strip().replace("R$", "").replace(" ", "").replace(",", ".")
                    new_val = str(row_cells[37] if len(row_cells) > 37 else "").strip().replace("R$", "").replace(" ", "").replace(",", ".")

                    old_pontos = str(raw_all_rows[existing_idx][8] if len(raw_all_rows[existing_idx]) > 8 else "").strip()
                    new_pontos = str(row_cells[8] if len(row_cells) > 8 else "").strip()

                    old_etapa = str(raw_all_rows[existing_idx][12] if len(raw_all_rows[existing_idx]) > 12 else "").strip()
                    new_etapa = str(row_cells[12] if len(row_cells) > 12 else "").strip()

                    has_diff = (old_compilado != new_compilado) or (old_val != new_val) or (old_pontos != new_pontos) or (old_etapa != new_etapa)

                    if has_diff:
                        # Cenário 1B: Mesma Obra com valores/atividades diferentes -> Altera a linha na Plan_Principal (não exclui)
                        planned_operations.append({
                            'type': 'OVERWRITE_SAME_ROW',
                            'original_idx': existing_idx,
                            'row_cells': row_cells
                        })
                    else:
                        # Cenário 1A: Mesma Obra sem alterações de valores -> Apenas exclui a linha da Plan_Principal
                        rows_to_delete.append(existing_idx)

                elif has_existing and not is_same_obra:
                    # Cenário 2: Outra Obra -> Apaga a linha da obra original antiga e grava a nova programação na primeira linha em branco
                    rows_to_delete.append(existing_idx)
                    planned_operations.append({
                        'type': 'APPEND',
                        'row_cells': row_cells
                    })
                else:
                    # Nova programação
                    planned_operations.append({
                        'type': 'NEW_OR_TEMPLATE',
                        'nova_eq': nova_eq,
                        'nova_dt': nova_dt,
                        'row_cells': row_cells
                    })
            else:
                # CASO 2: NÃO REPROGRAMAR (SOBRESCREVER MESMA LINHA)
                if has_existing:
                    planned_operations.append({
                        'type': 'OVERWRITE_SAME_ROW',
                        'original_idx': existing_idx,
                        'row_cells': row_cells
                    })
                else:
                    planned_operations.append({
                        'type': 'NEW_OR_TEMPLATE',
                        'nova_eq': nova_eq,
                        'nova_dt': nova_dt,
                        'row_cells': row_cells
                    })

        # 4. Grava linhas na aba Reprogramadas (se houver)
        if reprog_updates:
            ws_reprog = spreadsheet.worksheet("Reprogramadas")
            ws_reprog.batch_update(reprog_updates, value_input_option='USER_ENTERED')
            logging.info(f"  [SHEETS] {len(reprog_updates)} células gravadas na aba Reprogramadas!")

        # 5. Exclui fisicamente as linhas antigas (se houver reprogramação)
        if rows_to_delete:
            for idx in sorted(set(rows_to_delete), reverse=True):
                worksheet.delete_rows(idx + 1)
                logging.info(f"  [SHEETS] Linha antiga {idx + 1} removida da Plan_Principal.")

        # 6. Atualiza o estado das linhas
        current_rows = worksheet.get_all_values()
        cell_updates = []
        used_target_indices = set()

        for op in planned_operations:
            if op['type'] == 'OVERWRITE_SAME_ROW':
                adjusted_idx = op['original_idx']
                if rows_to_delete:
                    del_before = len([d for d in rows_to_delete if d < op['original_idx']])
                    adjusted_idx = op['original_idx'] - del_before
                target_row_idx = adjusted_idx
                used_target_indices.add(target_row_idx)

            elif op['type'] == 'NEW_OR_TEMPLATE':
                slot_idx = find_template_slot(current_rows, op['nova_eq'], op['nova_dt'], used_target_indices)
                if slot_idx != -1:
                    target_row_idx = slot_idx
                else:
                    blank_idx = find_first_empty_row(current_rows, used_target_indices)
                    while blank_idx in used_target_indices:
                        blank_idx += 1
                    target_row_idx = blank_idx
                used_target_indices.add(target_row_idx)
                while len(current_rows) <= target_row_idx:
                    current_rows.append([])
                current_rows[target_row_idx] = op['row_cells']

            else:
                # APPEND
                blank_idx = find_first_empty_row(current_rows, used_target_indices)
                while blank_idx in used_target_indices:
                    blank_idx += 1
                target_row_idx = blank_idx
                used_target_indices.add(target_row_idx)
                while len(current_rows) <= target_row_idx:
                    current_rows.append([])
                current_rows[target_row_idx] = op['row_cells']

            target_row_num = target_row_idx + 1 # 1-indexed for Sheets

            MANAGED_COL_INDICES = {
                0, 1, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16,
                17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35,
                36, 37, 38, 39, 46, 56, 62, 63, 64, 65, 66, 67, 68, 76, 77, 78
            }
            for c_idx in range(80):
                if c_idx >= len(op['row_cells']) and c_idx not in MANAGED_COL_INDICES:
                    continue
                val = op['row_cells'][c_idx] if c_idx < len(op['row_cells']) else ""
                val_str = str(val if val is not None else '').strip().strip('"')
                if c_idx in MANAGED_COL_INDICES:
                    col_letter = get_col_letter(c_idx)
                    cell_range = f"{col_letter}{target_row_num}"
                    cell_updates.append({
                        'range': cell_range,
                        'values': [[val_str]]
                    })
                elif val_str:
                    col_letter = get_col_letter(c_idx)
                    cell_range = f"{col_letter}{target_row_num}"
                    cell_updates.append({
                        'range': cell_range,
                        'values': [[val_str]]
                    })

        if cell_updates:
            worksheet.batch_update(cell_updates, value_input_option='USER_ENTERED')
            logging.info(f"  [SHEETS OK] {len(cell_updates)} células com dados atualizadas na Plan_Principal (listas suspensas preservadas)!")
            return True
        elif rows_to_delete:
            logging.info(f"  [SHEETS OK] {len(rows_to_delete)} linha(s) excluída(s) com sucesso da Plan_Principal!")
            return True
        else:
            logging.warning("Nenhuma célula com dados para atualizar.")
            return False

    except Exception as e:
        err_msg = str(e)
        logging.error(f"  [SHEETS ERRO] Não foi possível escrever diretamente na Plan_Principal: {err_msg}")
        return False

def process_csv_file(csv_filepath, is_reprogramar=False, motivo=None, deleted_schedules=None):
    filename = os.path.basename(csv_filepath)
    sigla = get_unit_from_filename(filename)
    if not sigla:
        logging.warning(f"Não foi possível identificar a unidade pelo nome do arquivo: {filename}")
        return False

    creds = get_credentials()
    if not creds:
        logging.error("Credenciais do Google não encontradas.")
        return False

    gc = gspread.authorize(creds)
    drive_service = build('drive', 'v3', credentials=creds)

    logging.info(f"Iniciando processamento imediato do arquivo {filename} para a unidade {sigla} (reprogramar={is_reprogramar}, motivo='{motivo}')...")

    # 1. Upload CSV to Drive
    upload_csv_to_gdrive(drive_service, sigla, csv_filepath)

    # 2. Cola as linhas diretamente na Plan_Principal
    paste_res = paste_row_directly_to_plan_principal(gc, sigla, csv_filepath, is_reprogramar=is_reprogramar, motivo=motivo, deleted_schedules=deleted_schedules)

    # 3. Sincroniza a Plan_Principal atualizada de volta pro Supabase imediatamente!
    sheet_id = UNIDADES_MAP.get(sigla)
    if sheet_id and paste_res:
        try:
            from sync_unit_now import sync_single_unit
            logging.info(f"  [SUPABASE] Atualizando cache da unidade {sigla} no Supabase...")
            sync_single_unit(sheet_id)
        except Exception as e_sync:
            logging.error(f"  [SUPABASE ERRO] Erro ao sincronizar cache: {e_sync}")

    return paste_res

if __name__ == "__main__":
    import json
    is_reprog = '--reprogramar' in sys.argv
    motivo_arg = None
    deleted_schedules_arg = None

    for a in sys.argv[1:]:
        if a.startswith('--motivo='):
            motivo_arg = a.split('=', 1)[1]
        elif a.startswith('--deleted-schedules='):
            try:
                deleted_schedules_arg = json.loads(a.split('=', 1)[1])
            except Exception as e:
                logging.warning(f"Erro ao parsear --deleted-schedules: {e}")

    clean_args = [a for a in sys.argv[1:] if not a.startswith('--') and (motivo_arg is None or a != motivo_arg)]
    if len(clean_args) > 0:
        files = [clean_args[0]]
    else:
        files = glob.glob("*.csv") + glob.glob("scratch/*.csv")

    for f in files:
        if os.path.exists(f):
            process_csv_file(f, is_reprogramar=is_reprog, motivo=motivo_arg, deleted_schedules=deleted_schedules_arg)
