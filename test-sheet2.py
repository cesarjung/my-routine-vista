import sync_bot
gc = sync_bot.get_gspread_client()
sheet = gc.open_by_key('1OTHF2ytEOjGgfE49paARXkz9GjaklOQC_UhiXwUjC2E')
ws = sheet.worksheet('Plan_Principal')
print(ws.row_values(7)[15:45])
