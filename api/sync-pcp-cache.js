import crypto from 'crypto';
import googleCredentialsStatic from '../google_credentials.json' with { type: 'json' };

const UNIDADES_MAP = {
  'BJL': '1rj2V7CxbZwkan63eCeLkH9G00Gi041IZNC6vwEgq6yI',
  'BAR': '1OTHF2ytEOjGgfE49paARXkz9GjaklOQC_UhiXwUjC2E',
  'GNB': '1FO5tyhXygbbzSmmTGdnm45j4DD_rRFQgEheN8T8Wy70',
  'BRU': '1oS619l3x_D1mXkvDpw8vs91G6ipZmsK83JqEIwPj7Uk',
  'LIV': '1gN2tR_LCuRnVCQ9tm2UURnVuMlJPVNEjvmo02TwFQCI',
  'IBO': '1dNwj8qWTl1k92PxI9iXwaNZYITnxuKP-kOF1QnZK3Iw',
  'JEQ': '1sGHf-zWXoxjnO20QBw2KWX39BSCzT8rzHdEz1hL7jyU',
  'VDC': '1XmpY8mqkRou-CRY68j1ljHH8W8zcROy7wnwMMSfbV7o',
  'ITP': '1rzT8o6XZi4v8j7CYLky3BD3sT5IPjv1PRb45ipBfbw4'
};

const UNIDADES_IDS_MAP = {
  '1rj2V7CxbZwkan63eCeLkH9G00Gi041IZNC6vwEgq6yI': 'BJL',
  '1OTHF2ytEOjGgfE49paARXkz9GjaklOQC_UhiXwUjC2E': 'BAR',
  '1FO5tyhXygbbzSmmTGdnm45j4DD_rRFQgEheN8T8Wy70': 'GNB',
  '1oS619l3x_D1mXkvDpw8vs91G6ipZmsK83JqEIwPj7Uk': 'BRU',
  '1gN2tR_LCuRnVCQ9tm2UURnVuMlJPVNEjvmo02TwFQCI': 'LIV',
  '1dNwj8qWTl1k92PxI9iXwaNZYITnxuKP-kOF1QnZK3Iw': 'IBO',
  '1sGHf-zWXoxjnO20QBw2KWX39BSCzT8rzHdEz1hL7jyU': 'JEQ',
  '1XmpY8mqkRou-CRY68j1ljHH8W8zcROy7wnwMMSfbV7o': 'VDC',
  '1rzT8o6XZi4v8j7CYLky3BD3sT5IPjv1PRb45ipBfbw4': 'ITP'
};

function getGoogleCredentials() {
  if (process.env.GOOGLE_CREDENTIALS) {
    try {
      return typeof process.env.GOOGLE_CREDENTIALS === 'string'
        ? JSON.parse(process.env.GOOGLE_CREDENTIALS)
        : process.env.GOOGLE_CREDENTIALS;
    } catch (e) {}
  }
  if (googleCredentialsStatic && googleCredentialsStatic.client_email) {
    return googleCredentialsStatic;
  }
  throw new Error('Nenhuma credencial Google encontrada.');
}

async function getAccessToken() {
  const creds = getGoogleCredentials();
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claimSet = {
    iss: creds.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  const encodeBase64Url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const unsignedToken = `${encodeBase64Url(header)}.${encodeBase64Url(claimSet)}`;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(unsignedToken);
  sign.end();
  const signature = sign.sign(creds.private_key, 'base64url');
  const jwt = `${unsignedToken}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Erro Google Auth: ${JSON.stringify(data)}`);
  return data.access_token;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { unidadeId = '1rj2V7CxbZwkan63eCeLkH9G00Gi041IZNC6vwEgq6yI' } = req.body || {};
    const spreadsheetId = unidadeId.length > 20 ? unidadeId : (UNIDADES_MAP[unidadeId] || UNIDADES_MAP['BJL']);

    const token = await getAccessToken();

    // Fetch required sheets: Carteira_Planejador, Plan_Principal, BD_Metas, Reprogramadas, Base_Curva, BD_Config
    const ranges = [
      'Carteira_Planejador!A1:BZ',
      'Plan_Principal!A1:BZ',
      'BD_Metas!A1:BZ',
      'Reprogramadas!A1:BZ',
      'Base_Curva!A1:BZ',
      'BD_Config!A1:BZ'
    ];

    const fetchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${ranges.map(r => `ranges=${encodeURIComponent(r)}`).join('&')}`;
    const sheetsRes = await fetch(fetchUrl, { headers: { Authorization: `Bearer ${token}` } });
    const sheetsData = await sheetsRes.json();

    const valueRanges = sheetsData.valueRanges || [];
    const carteira = valueRanges[0]?.values || [];
    const principal = valueRanges[1]?.values || [];
    const bdMetas = valueRanges[2]?.values || [];
    const reprogramadas = valueRanges[3]?.values || [];
    const baseCurva = valueRanges[4]?.values || [];
    const bdConfig = valueRanges[5]?.values || [];

    const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://curyufedazpkhtxrwhkn.supabase.co';
    const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1cnl1ZmVkYXpwa2h0eHJ3aGtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5NzU5NTIsImV4cCI6MjA4MjU1MTk1Mn0.DGKJPQBmLCTw5YyKwg7LfRQMseeVgXzljD5Z6lCESRs';

    const supaPayload = {
      unidade_id: spreadsheetId,
      carteira: JSON.stringify(carteira),
      principal: JSON.stringify(principal),
      bd_metas: JSON.stringify({
        bd_metas: bdMetas,
        base_curva: baseCurva,
        bd_config: bdConfig,
        recursos_aplicados: {},
        central_postes: []
      }),
      reprogramadas: JSON.stringify(reprogramadas),
      updated_at: new Date().toISOString()
    };

    const supaRes = await fetch(`${supabaseUrl}/rest/v1/planejamento_cache`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify(supaPayload)
    });

    if (!supaRes.ok) {
      const errText = await supaRes.text();
      throw new Error(`Erro ao atualizar Supabase: ${errText}`);
    }

    return res.status(200).json({
      success: true,
      message: 'Dados sincronizados do Google Sheets com sucesso!'
    });
  } catch (err) {
    console.error('Erro no sync-pcp-cache:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
