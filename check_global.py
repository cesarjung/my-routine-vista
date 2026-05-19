import os
import json
import gspread
from google.oauth2.service_account import Credentials

def check_global_sheet():
    creds_json_str = os.environ.get("GOOGLE_CREDENTIALS")
    if not creds_json_str:
        if os.path.exists("google_credentials.json"):
            with open("google_credentials.json", "r") as f:
                creds_json_str = f.read()
                
    if not creds_json_str:
        print("NO CREDS")
        return
        
    creds_dict = json.loads(creds_json_str)
    credentials = Credentials.from_service_account_info(creds_dict, scopes=['https://www.googleapis.com/auth/spreadsheets'])
    gc = gspread.authorize(credentials)
    
    sh = gc.open_by_key("1lUNIeWCddfmvJEjWJpQMtuR4oRuMsI3VImDY0xBp3Bs")
    ws = sh.worksheet("Planejamento")
    
    headers = ws.row_values(1)
    # Check headers at G, AL, AN, BO
    print("G (6):", headers[6] if len(headers) > 6 else "Missing")
    print("AL (37):", headers[37] if len(headers) > 37 else "Missing")
    print("AN (39):", headers[39] if len(headers) > 39 else "Missing")
    print("BO (66):", headers[66] if len(headers) > 66 else "Missing")
    
if __name__ == "__main__":
    check_global_sheet()
