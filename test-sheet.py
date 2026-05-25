import gspread
from oauth2client.service_account import ServiceAccountCredentials
import json
import os
from dotenv import load_dotenv
load_dotenv()
scope = ['https://spreadsheets.google.com/feeds', 'https://www.googleapis.com/auth/drive']
creds_json = os.getenv('GOOGLE_CREDENTIALS_JSON')
if creds_json:
  creds_dict = json.loads(creds_json)
  creds = ServiceAccountCredentials.from_json_keyfile_dict(creds_dict, scope)
  client = gspread.authorize(creds)
  sheet = client.open_by_key('1OTHF2ytEOjGgfE49paARXkz9GjaklOQC_UhiXwUjC2E')
  ws = sheet.worksheet('Plan_Principal')
  row6 = ws.row_values(7)
  for i, val in enumerate(row6):
    if i > 15 and i < 45:
      print(f'Index {i}: {val}')

