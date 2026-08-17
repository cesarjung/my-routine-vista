import gspread
import traceback
from google.oauth2.service_account import Credentials

SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive'
]

def run():
    print("Carregando credenciais...")
    try:
        credentials = Credentials.from_service_account_file("google_credentials.json", scopes=SCOPES)
        gc = gspread.authorize(credentials)
        print("Credenciais autorizadas com gspread.")
        
        sheet_id = '1lUNIeWCddfmvJEjWJpQMtuR4oRuMsI3VImDY0xBp3Bs'
        print(f"Tentando abrir planilha: {sheet_id}...")
        spreadsheet = gc.open_by_key(sheet_id)
        print("Planilha aberta com sucesso!")
        worksheet = spreadsheet.worksheet("Planejamento")
        print("Aba 'Planejamento' aberta!")
        raw_data = worksheet.get_all_values()
        print(f"Sucesso! Total de linhas: {len(raw_data)}")
    except Exception as e:
        print("Ocorreu um erro:")
        traceback.print_exc()

if __name__ == "__main__":
    run()
