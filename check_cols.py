import json

try:
    with open('C:\\Users\\Sirtec\\.gemini\\antigravity\\brain\\ebeb92c7-6bc6-4309-8587-4816978b319b\\scratch\\sample_carteira.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
        for u in data:
            carteira = u.get('carteira', [])
            if carteira and len(carteira) > 0:
                print("Carteira Headers:", len(carteira[0]))
                for i, col in enumerate(carteira[0]):
                    if i in [12, 35, 38]:
                        print(f"C{i} ({chr(65+i) if i < 26 else chr(64+i//26)+chr(65+i%26)}): {col}")
            
            principal = u.get('principal', [])
            if principal and len(principal) > 0:
                print("Principal Headers:", len(principal[0]))
                for i, col in enumerate(principal[0]):
                    if i in [7, 38, 40]:
                        print(f"C{i} ({chr(65+i) if i < 26 else chr(64+i//26)+chr(65+i%26)}): {col}")
            break
except Exception as e:
    print(e)
