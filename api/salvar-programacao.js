import crypto from 'crypto';
import { GOOGLE_CREDS } from './google_creds.js';

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
  if (GOOGLE_CREDS && GOOGLE_CREDS.client_email) {
    return GOOGLE_CREDS;
  }
  throw new Error('Nenhuma credencial Google encontrada.');
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

function extractDate(str) {
  if (!str) return '';
  const m = String(str).match(/(\d{2}\/\d{2}\/\d{4})/);
  if (m) return m[1];
  const m2 = String(str).match(/(\d{4}-\d{2}-\d{2})/);
  if (m2) {
    const parts = m2[1].split('-');
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return String(str).trim();
}

function cleanCode(code) {
  if (!code) return '';
  return String(code).trim().toUpperCase().replace(/^[BP]-/, '').replace(/[^A-Z0-9]/g, '');
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
    if (rawLines.length === 0) {
      return res.status(400).json({ error: 'CSV sem dados.' });
    }
    let dataLines = rawLines;
    if (rawLines.length > 1 && (
      rawLines[0].toLowerCase().includes('data') ||
      rawLines[0].toLowerCase().includes('supervisor') ||
      rawLines[0].toLowerCase().includes('equipe') ||
      rawLines[0].toLowerCase().includes('projeto')
    )) {
      dataLines = rawLines.slice(1);
    }

    // 3. Read current full Plan_Principal (Col A to BZ)
    const readRowsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Plan_Principal!A1:BZ`;
    const allRowsRes = await fetch(readRowsUrl, { headers: { Authorization: `Bearer ${token}` } });
    const allRowsData = await allRowsRes.json();
    const allRows = allRowsData.values || [];

    // Helper: find first empty row index (0-indexed in allRows, starting at row 6 / index 5)
    const findFirstEmptyRowIndex = (rowsArray, excludeIndices = new Set()) => {
      for (let i = 5; i < rowsArray.length; i++) {
        if (excludeIndices.has(i)) continue;
        const r = rowsArray[i];
        if (!r || r.length === 0) return i;
        const valB = String(r[1] || '').trim();
        const valG = String(r[6] || '').trim();
        const valH = String(r[7] || '').trim();
        if (!valB && !valG && !valH) {
          return i;
        }
      }
      return Math.max(5, rowsArray.length);
    };

    const rangesToClear = [];
    const cellUpdates = [];
    const reprogUpdates = [];
    const clearedIndices = new Set();

    // If reprogramming, check Reprogramadas tab to find target starting row
    let targetReprogRow = 6;
    if (reprogramar) {
      try {
        const readReprogUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Reprogramadas!B1:B`;
        const readReprogRes = await fetch(readReprogUrl, { headers: { Authorization: `Bearer ${token}` } });
        const readReprogData = await readReprogRes.json();
        const reprogB = readReprogData.values || [];
        for (let i = 5; i < reprogB.length; i++) {
          if (!reprogB[i] || !reprogB[i][0] || !reprogB[i][0].trim()) {
            targetReprogRow = i + 1;
            break;
          }
        }
        if (targetReprogRow <= 5) targetReprogRow = Math.max(6, reprogB.length + 1);
      } catch (e) {
        console.error('Erro ao ler aba Reprogramadas:', e);
      }
    }

    // 4. Process each new dataLine according to business rules
    dataLines.forEach((line) => {
      const rowCells = line.split(';');
      const novaDataStr = extractDate(rowCells[1]);
      const novaEquipe = String(rowCells[6] || '').trim().toUpperCase();
      const novoProjeto = cleanCode(rowCells[7]);
      const novaChaveBk = String(rowCells[62] || '').trim().replace(/^"|"$/g, '');
      const isLineReprog = reprogramar || String(rowCells[0] || '').toUpperCase().includes('REPROG') || String(rowCells[0] || '').toUpperCase() === 'TRUE';

      // Search for existing matching row in allRows (row 6 onwards)
      let existingRowIdx = -1;
      for (let i = 5; i < allRows.length; i++) {
        if (clearedIndices.has(i)) continue;
        const r = allRows[i] || [];
        const existChaveBk = String(r[62] || '').trim();
        const existEquipe = String(r[6] || '').trim().toUpperCase();
        const existDataStr = extractDate(r[1]);

        if (
          (novaChaveBk && existChaveBk && existChaveBk === novaChaveBk) ||
          (novaEquipe && existEquipe === novaEquipe && novaDataStr && existDataStr === novaDataStr)
        ) {
          existingRowIdx = i;
          break;
        }
      }

      const hasExistingRow = existingRowIdx !== -1;
      const existProjeto = hasExistingRow ? cleanCode(allRows[existingRowIdx][7]) : '';
      const isSameObra = hasExistingRow && (existProjeto === novoProjeto);
      const existingRowNumber = existingRowIdx + 1; // 1-indexed for sheets

      let targetRowNumber;

      if (isLineReprog) {
        // === CASO 1: REPROGRAMAR MARCADO ===
        // 1. Se existir programação anterior, copia para a aba Reprogramadas e apaga a original da Plan_Principal
        if (hasExistingRow) {
          const oldRowData = allRows[existingRowIdx] || [];
          const copyRow = [...oldRowData];
          while (copyRow.length <= 46) copyRow.push('');
          const motivoLinha = motivo || rowCells[46] || '';
          if (motivoLinha) copyRow[46] = String(motivoLinha).trim();

          const destReprogRow = targetReprogRow;
          targetReprogRow++;

          copyRow.forEach((val, cIdx) => {
            const valStr = String(val ?? '').trim();
            if (valStr) {
              reprogUpdates.push({
                range: `Reprogramadas!${getColumnLetter(cIdx)}${destReprogRow}`,
                values: [[valStr]]
              });
            }
          });

          // Limpa a linha original em Plan_Principal
          rangesToClear.push(`Plan_Principal!A${existingRowNumber}:BZ${existingRowNumber}`);
          clearedIndices.add(existingRowIdx);
          allRows[existingRowIdx] = []; // marca como vazia em memória
        }

        // 2. Lança a nova programação na primeira linha em branco de Plan_Principal (ao final das preenchidas)
        const blankIdx = findFirstEmptyRowIndex(allRows, clearedIndices);
        targetRowNumber = blankIdx + 1;
        while (allRows.length <= blankIdx) allRows.push([]);
        allRows[blankIdx] = rowCells.map(c => String(c ?? '').replace(/^"|"$/g, ''));

      } else {
        // === CASO 2: REPROGRAMAR NÃO MARCADO (Alteração na própria programação) ===
        if (hasExistingRow && isSameObra) {
          // 2A: Mesma obra e mesma data -> sobrescreve e mantém na mesma linha
          targetRowNumber = existingRowNumber;
          rangesToClear.push(`Plan_Principal!A${existingRowNumber}:BZ${existingRowNumber}`);
          allRows[existingRowIdx] = rowCells.map(c => String(c ?? '').replace(/^"|"$/g, ''));
        } else {
          // 2B: Obra diferente no mesmo dia -> apaga a linha anterior e lança na primeira em branco
          if (hasExistingRow) {
            rangesToClear.push(`Plan_Principal!A${existingRowNumber}:BZ${existingRowNumber}`);
            clearedIndices.add(existingRowIdx);
            allRows[existingRowIdx] = []; // marca como vazia em memória
          }
          const blankIdx = findFirstEmptyRowIndex(allRows, clearedIndices);
          targetRowNumber = blankIdx + 1;
          while (allRows.length <= blankIdx) allRows.push([]);
          allRows[blankIdx] = rowCells.map(c => String(c ?? '').replace(/^"|"$/g, ''));
        }
      }

      // Adiciona células a serem gravadas na Plan_Principal
      rowCells.slice(0, 78).forEach((val, cIdx) => {
        const valStr = String(val ?? '').trim().replace(/^"|"$/g, '');
        if (valStr) {
          cellUpdates.push({
            range: `Plan_Principal!${getColumnLetter(cIdx)}${targetRowNumber}`,
            values: [[valStr]]
          });
        }
      });
    });

    // 5. Executa gravações em Reprogramadas (se houver)
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

    // 6. Executa limpeza das linhas antigas/substituídas em Plan_Principal (se houver)
    if (rangesToClear.length > 0) {
      const uniqueRanges = Array.from(new Set(rangesToClear));
      try {
        const clearRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchClear`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ranges: uniqueRanges
          })
        });
        if (!clearRes.ok) {
          // Fallback: preenche com strings vazias para limpar os dados
          const clearUpdates = uniqueRanges.map(r => ({
            range: r,
            values: [new Array(78).fill('')]
          }));
          await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              valueInputOption: 'USER_ENTERED',
              data: clearUpdates
            })
          });
        }
      } catch (clearErr) {
        console.error('Erro ao limpar ranges em Plan_Principal:', clearErr);
      }
    }

    // 7. Executa gravação das novas programações em Plan_Principal
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
      message: `Programação processada e gravada com sucesso na unidade ${unitSigla}!`
    });
  } catch (err) {
    console.error('Erro na API salvar-programacao:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
