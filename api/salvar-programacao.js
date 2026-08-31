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
    const { csvFilename, csvContent, unitSigla = 'BJL', reprogramar = false, motivo = '', deletedSchedules = [] } = req.body || {};
    if (!csvContent && (!deletedSchedules || deletedSchedules.length === 0)) {
      return res.status(400).json({ error: 'csvContent ou deletedSchedules é obrigatório' });
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

    // 3. Fetch spreadsheet metadata to obtain sheetId of Plan_Principal (for physical row deletion)
    const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const metaData = await metaRes.json();
    const planPrincipalSheet = (metaData.sheets || []).find(s => s.properties?.title === 'Plan_Principal');
    const planPrincipalSheetId = planPrincipalSheet ? planPrincipalSheet.properties.sheetId : 0;

    // 4. Read current full Plan_Principal (Col A to CA)
    const readRowsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Plan_Principal!A1:CA`;
    const allRowsRes = await fetch(readRowsUrl, { headers: { Authorization: `Bearer ${token}` } });
    const allRowsData = await allRowsRes.json();
    const allRows = allRowsData.values || [];

    // Helper: Find next available row in Reprogramadas tab (row 6 onwards)
    let nextReprogRowNumber = 6;
    if (reprogramar) {
      try {
        const readReprogUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Reprogramadas!B1:B`;
        const readReprogRes = await fetch(readReprogUrl, { headers: { Authorization: `Bearer ${token}` } });
        const readReprogData = await readReprogRes.json();
        const reprogB = readReprogData.values || [];
        let foundEmpty = false;
        for (let i = 5; i < reprogB.length; i++) {
          if (!reprogB[i] || !reprogB[i][0] || !String(reprogB[i][0]).trim()) {
            nextReprogRowNumber = i + 1;
            foundEmpty = true;
            break;
          }
        }
        if (!foundEmpty) {
          nextReprogRowNumber = Math.max(6, reprogB.length + 1);
        }
      } catch (e) {
        console.error('Erro ao ler aba Reprogramadas:', e);
      }
    }

    // Helper: Find existing planned schedule (has project in Col H / r[7]) for team and date
    const findExistingPlannedRowIndex = (rowsArray, targetEquipe, targetDataStr, targetChaveBk, excludeIndices = new Set()) => {
      for (let i = 5; i < rowsArray.length; i++) {
        if (excludeIndices.has(i)) continue;
        const r = rowsArray[i];
        if (!r || r.length === 0) continue;
        const existProjeto = cleanCode(r[7]);
        if (!existProjeto) continue; // Only rows that actually have an active project

        const existChaveBk = String(r[62] || '').trim();
        const existEquipe = String(r[6] || '').trim().toUpperCase();
        const existDataStr = extractDate(r[1]);

        if (
          (targetChaveBk && existChaveBk && existChaveBk === targetChaveBk) ||
          (targetEquipe && existEquipe === targetEquipe && targetDataStr && existDataStr === targetDataStr)
        ) {
          return i;
        }
      }
      return -1;
    };

    const reprogUpdates = [];
    const rowIndicesToDelete = [];
    const plannedOperations = [];

    // Process explicit deletions requested from frontend
    if (Array.isArray(deletedSchedules) && deletedSchedules.length > 0) {
      deletedSchedules.forEach((ds) => {
        const delEq = String(ds.equipe || '').trim().toUpperCase();
        const delDt = extractDate(ds.dataCompleta || ds.dataStr || ds.data || '');
        const delBk = String(ds.chaveBk || '').trim();
        const delIdx = findExistingPlannedRowIndex(allRows, delEq, delDt, delBk, new Set(rowIndicesToDelete));
        if (delIdx !== -1 && !rowIndicesToDelete.includes(delIdx)) {
          rowIndicesToDelete.push(delIdx);
        }
      });
    }

    // 5. Categorize each dataLine according to business rules
    dataLines.forEach((line) => {
      const rowCells = line.split(';');
      const novaDataStr = extractDate(rowCells[1]);
      const novaEquipe = String(rowCells[6] || '').trim().toUpperCase();
      const novoProjeto = cleanCode(rowCells[7]);
      const novaChaveBk = String(rowCells[62] || '').trim().replace(/^"|"$/g, '');
      const isLineReprog = reprogramar || String(rowCells[0] || '').toUpperCase().includes('REPROG') || String(rowCells[0] || '').toUpperCase() === 'TRUE';

      const existingPlannedIdx = findExistingPlannedRowIndex(allRows, novaEquipe, novaDataStr, novaChaveBk, new Set(rowIndicesToDelete));
      const hasExistingPlan = existingPlannedIdx !== -1;
      const existProjeto = hasExistingPlan ? cleanCode(allRows[existingPlannedIdx][7]) : '';
      const isSameObra = hasExistingPlan && (existProjeto === novoProjeto);

      if (isLineReprog) {
        // === CASO 1: BOTÃO REPROGRAMAR MARCADO ===
        // 1.1 Copia a linha (existente ou atual) para a aba Reprogramadas (sem nada na Coluna A e com motivo na Coluna AU)
        const sourceRow = hasExistingPlan ? (allRows[existingPlannedIdx] || []) : rowCells;
        const copyRow = [...sourceRow];
        while (copyRow.length <= 79) copyRow.push('');
        copyRow[0] = ''; // Coluna A vazia na aba Reprogramadas conforme especificado
        const motivoLinha = (rowCells[46] && String(rowCells[46]).trim()) ? String(rowCells[46]).trim() : (motivo ? String(motivo).trim() : (sourceRow[46] ? String(sourceRow[46]).trim() : ''));
        if (motivoLinha) copyRow[46] = String(motivoLinha).trim();

        const destReprogRow = nextReprogRowNumber;
        nextReprogRowNumber++;

        copyRow.forEach((val, cIdx) => {
          if (cIdx >= 77) return; // Aba Reprogramadas possui 77 colunas (A a BY)
          const valStr = String(val ?? '').trim();
          if (valStr) {
            reprogUpdates.push({
              range: `Reprogramadas!${getColumnLetter(cIdx)}${destReprogRow}`,
              values: [[valStr]]
            });
          }
        });

        // Na Plan_Principal, a nova programação fica com Coluna AU vazia (sem motivo ainda)
        while (rowCells.length <= 46) rowCells.push('');
        rowCells[46] = '';

        // 1.2 Comportamento na Plan_Principal
        if (hasExistingPlan && isSameObra) {
          const oldCompilado = String(allRows[existingPlannedIdx][14] || '').trim();
          const newCompilado = String(rowCells[14] || '').trim();

          const oldVal = String(allRows[existingPlannedIdx][37] || '').trim().replace(/R\$|\s/g, '').replace(',', '.');
          const newVal = String(rowCells[37] || '').trim().replace(/R\$|\s/g, '').replace(',', '.');

          const oldPontos = String(allRows[existingPlannedIdx][8] || '').trim();
          const newPontos = String(rowCells[8] || '').trim();

          const oldEtapa = String(allRows[existingPlannedIdx][12] || '').trim();
          const newEtapa = String(rowCells[12] || '').trim();

          const hasDiff = (oldCompilado !== newCompilado) || (oldVal !== newVal) || (oldPontos !== newPontos) || (oldEtapa !== newEtapa);

          if (hasDiff) {
            // Cenário 1B: Mesma obra com valores/atividades alteradas -> Altera a linha na Plan_Principal (não exclui)
            plannedOperations.push({
              type: 'OVERWRITE_SAME_ROW',
              originalRowIndex: existingPlannedIdx,
              rowCells
            });
          } else {
            // Cenário 1A: Mesma obra sem alterações de valores -> Apenas exclui a linha da Plan_Principal
            rowIndicesToDelete.push(existingPlannedIdx);
          }
        } else if (hasExistingPlan && !isSameObra) {
          // Cenário 2: Outra Obra -> Apaga a linha da obra original antiga e grava a nova programação na primeira em branco
          rowIndicesToDelete.push(existingPlannedIdx);
          plannedOperations.push({
            type: 'APPEND',
            rowCells
          });
        } else {
          // Nova programação sem anterior
          plannedOperations.push({
            type: 'NEW_OR_TEMPLATE',
            novaEquipe,
            novaDataStr,
            rowCells
          });
        }

      } else {
        // === CASO 2: BOTÃO REPROGRAMAR NÃO MARCADO ===
        if (hasExistingPlan && isSameObra) {
          // 2.1 Mesma obra e mesma data -> Altera os dados e mantém na mesma linha existente
          plannedOperations.push({
            type: 'OVERWRITE_SAME_ROW',
            originalRowIndex: existingPlannedIdx,
            rowCells
          });
        } else if (hasExistingPlan && !isSameObra) {
          // 2.2 Outra obra no mesmo dia -> EXCLUI a linha original da Plan_Principal e lança na primeira em branco
          rowIndicesToDelete.push(existingPlannedIdx);
          plannedOperations.push({
            type: 'APPEND',
            rowCells
          });
        } else {
          // 2.3 Planejamento NOVO -> lança na primeira linha em branco
          plannedOperations.push({
            type: 'NEW_OR_TEMPLATE',
            novaEquipe,
            novaDataStr,
            rowCells
          });
        }
      }
    });

    // 6. Grava linhas copiadas na aba Reprogramadas (se houver)
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

    // 7. EXCLUI FISICAMENTE as linhas originais da Plan_Principal via deleteDimension
    if (rowIndicesToDelete.length > 0) {
      // Ordena índices de forma DECRESCENTE para que a exclusão de um índice maior não altere os menores
      const uniqueSortedIndices = Array.from(new Set(rowIndicesToDelete)).sort((a, b) => b - a);
      const deleteRequests = uniqueSortedIndices.map(idx => ({
        deleteDimension: {
          range: {
            sheetId: planPrincipalSheetId,
            dimension: 'ROWS',
            startIndex: idx,
            endIndex: idx + 1
          }
        }
      }));

      const deleteRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ requests: deleteRequests })
      });
      const deleteData = await deleteRes.json();
      if (!deleteRes.ok) {
        console.error('Aviso ao excluir linhas via deleteDimension:', deleteData);
      }
    }

    // 8. Lê o estado atualizado de Plan_Principal após exclusões para posicionamento exato das novas linhas
    const updatedRowsRes = await fetch(readRowsUrl, { headers: { Authorization: `Bearer ${token}` } });
    const updatedRowsData = await updatedRowsRes.json();
    const currentRows = updatedRowsData.values || [];

    // Helper: Find first empty row in updated Plan_Principal (row 6 onwards)
    const findFirstEmptyInUpdated = (rowsArray, excludeIndices = new Set()) => {
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

    // Helper: Find template slot in updated Plan_Principal
    const findTemplateSlotInUpdated = (rowsArray, targetEquipe, targetDataStr, excludeIndices = new Set()) => {
      for (let i = 5; i < rowsArray.length; i++) {
        if (excludeIndices.has(i)) continue;
        const r = rowsArray[i];
        if (!r || r.length === 0) continue;
        const existProjeto = cleanCode(r[7]);
        if (existProjeto) continue;

        const existEquipe = String(r[6] || '').trim().toUpperCase();
        const existDataStr = extractDate(r[1]);

        if (targetEquipe && existEquipe === targetEquipe && targetDataStr && existDataStr === targetDataStr) {
          return i;
        }
      }
      return -1;
    };

function getWeekdayNumber(dataStr) {
  if (!dataStr) return 1;
  const m = String(dataStr).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) {
    const d = new Date(parseInt(m[3], 10), parseInt(m[2], 10) - 1, parseInt(m[1], 10));
    return d.getDay();
  }
  const mIso = String(dataStr).match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (mIso) {
    const d = new Date(parseInt(mIso[1], 10), parseInt(mIso[2], 10) - 1, parseInt(mIso[3], 10));
    return d.getDay();
  }
  return 1;
}

function getRowBackgroundColor(dayOfWeek) {
  if (dayOfWeek === 0) {
    // Domingo: Cinza Escuro
    return { red: 0.80, green: 0.80, blue: 0.80 };
  } else if (dayOfWeek === 1 || dayOfWeek === 3 || dayOfWeek === 5) {
    // Segunda, Quarta, Sexta: Cinza Claro
    return { red: 0.95, green: 0.95, blue: 0.95 };
  } else {
    // Terça, Quinta, Sábado: Amarelo Claro
    return { red: 1.0, green: 0.95, blue: 0.80 };
  }
}

    const cellUpdates = [];
    const formatRequests = [];
    const usedTargetIndices = new Set();

    plannedOperations.forEach((op) => {
      let targetRowIndex;

      if (op.type === 'OVERWRITE_SAME_ROW') {
        // Se houve exclusões anteriores a esta linha, a linha se deslocou para cima
        let adjustedIdx = op.originalRowIndex;
        if (rowIndicesToDelete.length > 0) {
          const deletedBefore = rowIndicesToDelete.filter(dIdx => dIdx < op.originalRowIndex).length;
          adjustedIdx = op.originalRowIndex - deletedBefore;
        }
        targetRowIndex = adjustedIdx;
        usedTargetIndices.add(targetRowIndex);

      } else if (op.type === 'NEW_OR_TEMPLATE') {
        const slotIdx = findTemplateSlotInUpdated(currentRows, op.novaEquipe, op.novaDataStr, usedTargetIndices);
        if (slotIdx !== -1) {
          targetRowIndex = slotIdx;
        } else {
          let blankIdx = findFirstEmptyInUpdated(currentRows, usedTargetIndices);
          while (usedTargetIndices.has(blankIdx)) {
            blankIdx++;
          }
          targetRowIndex = blankIdx;
        }
        usedTargetIndices.add(targetRowIndex);
        while (currentRows.length <= targetRowIndex) currentRows.push([]);
        currentRows[targetRowIndex] = op.rowCells;

      } else {
        // APPEND
        let blankIdx = findFirstEmptyInUpdated(currentRows, usedTargetIndices);
        while (usedTargetIndices.has(blankIdx)) {
          blankIdx++;
        }
        targetRowIndex = blankIdx;
        usedTargetIndices.add(targetRowIndex);
        while (currentRows.length <= targetRowIndex) currentRows.push([]);
        currentRows[targetRowIndex] = op.rowCells;
      }

      const targetRowNumber = targetRowIndex + 1; // 1-indexed for Google Sheets
      const MANAGED_COL_INDICES = new Set([
        0, 1, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16,
        17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35,
        36, 37, 38, 39, 46, 56, 62, 63, 64, 65, 66, 67, 68, 76, 77, 78
      ]);

      const dataStrForDay = extractDate(op.rowCells[1]) || op.novaDataStr;
      const dayOfWeek = getWeekdayNumber(dataStrForDay);

      // Formatação de cor por dia da semana
      formatRequests.push({
        repeatCell: {
          range: {
            sheetId: planPrincipalSheetId,
            startRowIndex: targetRowIndex,
            endRowIndex: targetRowIndex + 1,
            startColumnIndex: 0,
            endColumnIndex: 79
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: getRowBackgroundColor(dayOfWeek)
            }
          },
          fields: 'userEnteredFormat.backgroundColor'
        }
      });

      // Formatação numérica da Coluna B como data com dia da semana
      formatRequests.push({
        repeatCell: {
          range: {
            sheetId: planPrincipalSheetId,
            startRowIndex: targetRowIndex,
            endRowIndex: targetRowIndex + 1,
            startColumnIndex: 1,
            endColumnIndex: 2
          },
          cell: {
            userEnteredFormat: {
              numberFormat: {
                type: 'DATE',
                pattern: 'dd/mm/yyyy - dddd'
              }
            }
          },
          fields: 'userEnteredFormat.numberFormat'
        }
      });

      for (let cIdx = 0; cIdx < 79; cIdx++) {
        let val = op.rowCells[cIdx];
        if (cIdx === 1) {
          val = extractDate(val) || val;
        }
        const valStr = String(val ?? '').trim().replace(/^"|"$/g, '');
        if (MANAGED_COL_INDICES.has(cIdx)) {
          cellUpdates.push({
            range: `Plan_Principal!${getColumnLetter(cIdx)}${targetRowNumber}`,
            values: [[valStr]]
          });
        } else if (valStr) {
          cellUpdates.push({
            range: `Plan_Principal!${getColumnLetter(cIdx)}${targetRowNumber}`,
            values: [[valStr]]
          });
        }
      }
    });

    // 9. Grava as novas programações e atualizações na Plan_Principal
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

    // 10. Aplica formatação de cores e formato numérico de data
    if (formatRequests.length > 0) {
      try {
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ requests: formatRequests })
        });
      } catch (fmtErr) {
        console.error('Aviso ao aplicar formatação de cores e data:', fmtErr);
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
