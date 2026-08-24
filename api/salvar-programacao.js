import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const ROOT_DRIVE_FOLDER_ID = '13UejORpk84bhf6Y4ISb3TedPLGU79eHn';

const UNIDADES_MAP = {
  'BJL': '1rj2V7CxbZwkan63eCeLkH9G00Gi041IZNC6vwEgq6yI', // Bom Jesus da Lapa
  'BAR': '1OTHF2ytEOjGgfE49paARXkz9GjaklOQC_UhiXwUjC2E', // Barreiras
  'GNB': '1FO5tyhXygbbzSmmTGdnm45j4DD_rRFQgEheN8T8Wy70', // Guanambi
  'BRU': '1oS619l3x_D1mXkvDpw8vs91G6ipZmsK83JqEIwPj7Uk', // Brumado
  'LIV': '1gN2tR_LCuRnVCQ9tm2UURnVuMlJPVNEjvmo02TwFQCI', // Livramento
  'IBO': '1dNwj8qWTl1k92PxI9iXwaNZYITnxuKP-kOF1QnZK3Iw', // Ibotirama
  'JEQ': '1sGHf-zWXoxjnO20QBw2KWX39BSCzT8rzHdEz1hL7jyU', // Jequié
  'VDC': '1XmpY8mqkRou-CRY68j1ljHH8W8zcROy7wnwMMSfbV7o', // Vitória da Conquista
  'ITP': '1rzT8o6XZi4v8j7CYLky3BD3sT5IPjv1PRb45ipBfbw4'  // Itapetinga
};

function getGoogleCredentials() {
  if (process.env.GOOGLE_CREDENTIALS) {
    try {
      return typeof process.env.GOOGLE_CREDENTIALS === 'string'
        ? JSON.parse(process.env.GOOGLE_CREDENTIALS)
        : process.env.GOOGLE_CREDENTIALS;
    } catch (e) {}
  }
  const localFile = path.resolve(process.cwd(), 'google_credentials.json');
  if (fs.existsSync(localFile)) {
    return JSON.parse(fs.readFileSync(localFile, 'utf8'));
  }
  throw new Error('Nenhuma credencial Google (GOOGLE_CREDENTIALS) encontrada.');
}

async function getAccessToken() {
  const creds = getGoogleCredentials();
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claimSet = {
    iss: creds.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  const encodeBase64Url = (obj) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url');

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
  if (!res.ok) {
    throw new Error(`Erro ao autenticar com Google: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

async function getOrCreateDriveFolder(token, rootFolderId, unitSigla) {
  const q = encodeURIComponent(`'${rootFolderId}' in parents and name = '${unitSigla}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
  const listRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&supportsAllDrives=true&includeItemsFromAllDrives=true`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const listData = await listRes.json();
  if (listData.files && listData.files.length > 0) {
    return listData.files[0].id;
  }

  const createRes = await fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: unitSigla,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [rootFolderId]
    })
  });
  const createData = await createRes.json();
  return createData.id;
}

async function uploadCsvToDrive(token, unitSigla, filename, csvContent) {
  try {
    const folderId = await getOrCreateDriveFolder(token, ROOT_DRIVE_FOLDER_ID, unitSigla);
    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadata = {
      name: filename,
      parents: [folderId]
    };

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: text/csv; charset=UTF-8\r\n\r\n' +
      csvContent +
      closeDelimiter;

    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: multipartRequestBody
    });
    return await res.json();
  } catch (err) {
    console.error('Erro ao enviar CSV pro Drive:', err);
    return null;
  }
}

function getColumnLetter(colIndex) {
  if (colIndex < 26) {
    return String.fromCharCode(65 + colIndex);
  }
  const first = String.fromCharCode(65 + Math.floor(colIndex / 26) - 1);
  const second = String.fromCharCode(65 + (colIndex % 26));
  return `${first}${second}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { csvFilename, csvContent, unitSigla = 'BJL', reprogramar = false, motivo = '' } = req.body || {};
    if (!csvContent) {
      return res.status(400).json({ error: 'csvContent is required' });
    }

    const token = await getAccessToken();
    const spreadsheetId = UNIDADES_MAP[unitSigla] || UNIDADES_MAP['BJL'];

    // 1. Upload CSV to Google Drive
    await uploadCsvToDrive(token, unitSigla, csvFilename || `${unitSigla}_programacao.csv`, csvContent);

    // 2. Parse CSV lines
    const rawLines = csvContent.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (rawLines.length < 2) {
      return res.status(400).json({ error: 'CSV sem dados suficientes.' });
    }
    const dataLines = rawLines.slice(1);

    // Identify keys in Col BK (index 62)
    const keysToReplace = new Set();
    dataLines.forEach(line => {
      const cells = line.split(';');
      const bkVal = (cells[62] || '').trim().replace(/^"|"$/g, '');
      if (bkVal) keysToReplace.add(bkVal);
    });

    // 3. Read current Plan_Principal column B (index 2) and BK (index 63)
    const readUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?ranges=Plan_Principal!B1:B&ranges=Plan_Principal!BK1:BK`;
    const readRes = await fetch(readUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const readData = await readRes.json();
    const colBValues = (readData.valueRanges && readData.valueRanges[0]?.values) || [];
    const colBKValues = (readData.valueRanges && readData.valueRanges[1]?.values) || [];

    // Find existing rows to replace
    const rowsToRemove = [];
    colBKValues.forEach((row, idx) => {
      if (idx < 5) return; // Header rows 1-5
      const val = (row[0] || '').trim();
      if (val && keysToReplace.has(val)) {
        rowsToRemove.push(idx + 1); // 1-indexed
      }
    });

    // Handle Reprogramadas if needed
    if (rowsToRemove.length > 0 && reprogramar) {
      const readRowsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Plan_Principal!A1:BZ`;
      const allRowsRes = await fetch(readRowsUrl, { headers: { Authorization: `Bearer ${token}` } });
      const allRowsData = await allRowsRes.json();
      const allRows = allRowsData.values || [];

      // Find first empty row in Reprogramadas (Col B)
      const readReprogUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Reprogramadas!B1:B`;
      const readReprogRes = await fetch(readReprogUrl, { headers: { Authorization: `Bearer ${token}` } });
      const readReprogData = await readReprogRes.json();
      const reprogB = readReprogData.values || [];
      let targetReprogRow = 6;
      for (let i = 5; i < reprogB.length; i++) {
        if (!reprogB[i] || !reprogB[i][0] || !reprogB[i][0].trim()) {
          targetReprogRow = i + 1;
          break;
        }
      }
      if (targetReprogRow <= 5) targetReprogRow = Math.max(6, reprogB.length + 1);

      const reprogUpdates = [];
      rowsToRemove.forEach((rNum, offset) => {
        const existingRow = allRows[rNum - 1] || [];
        const copyRow = [...existingRow];
        while (copyRow.length <= 46) copyRow.push('');
        if (motivo) copyRow[46] = String(motivo).trim();

        const destRow = targetReprogRow + offset;
        copyRow.forEach((val, cIdx) => {
          const valStr = String(val ?? '').trim();
          if (valStr) {
            reprogUpdates.push({
              range: `Reprogramadas!${getColumnLetter(cIdx)}${destRow}`,
              values: [[valStr]]
            });
          }
        });
      });

      if (reprogUpdates.length > 0) {
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            valueInputOption: 'USER_ENTERED',
            data: reprogUpdates
          })
        });
      }
    }

    // Find first empty row in Column B (Data) starting at row 6
    let targetRow = 6;
    for (let i = 5; i < colBValues.length; i++) {
      const val = (colBValues[i] && colBValues[i][0]) ? colBValues[i][0].trim() : '';
      if (!val) {
        targetRow = i + 1;
        break;
      }
    }
    if (targetRow <= 5) {
      targetRow = Math.max(6, colBValues.length + 1);
    }

    // 4. Update non-empty cells in Plan_Principal (preserving dropdowns & validations)
    const cellUpdates = [];
    dataLines.forEach((line, rOffset) => {
      const currentRow = targetRow + rOffset;
      const rowCells = line.split(';');
      rowCells.slice(0, 78).forEach((val, cIdx) => {
        const valStr = String(val ?? '').trim().replace(/^"|"$/g, '');
        if (valStr) {
          cellUpdates.push({
            range: `Plan_Principal!${getColumnLetter(cIdx)}${currentRow}`,
            values: [[valStr]]
          });
        }
      });
    });

    if (cellUpdates.length > 0) {
      const batchRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          valueInputOption: 'USER_ENTERED',
          data: cellUpdates
        })
      });
      const batchData = await batchRes.json();
      if (!batchRes.ok) {
        throw new Error(`Erro ao atualizar Plan_Principal: ${JSON.stringify(batchData)}`);
      }
    }

    return res.status(200).json({
      success: true,
      message: `Programação gravada com sucesso na Plan_Principal da unidade ${unitSigla} (a partir da linha ${targetRow}) e salva no Drive!`
    });
  } catch (err) {
    console.error('Erro na API salvar-programacao:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
