import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' });
  }

  try {
    const data = req.body;
    const scratchDir = path.resolve(__dirname, '..', 'scratch');
    if (!fs.existsSync(scratchDir)) {
      fs.mkdirSync(scratchDir, { recursive: true });
    }

    const tempPayloadPath = path.join(scratchDir, `email_payload_${Date.now()}.json`);
    fs.writeFileSync(tempPayloadPath, JSON.stringify(data, null, 2), 'utf-8');

    const pyScript = path.resolve(__dirname, '..', 'send_planejamento_email.py');
    const cmd = `python "${pyScript}" "${tempPayloadPath}"`;

    exec(cmd, { cwd: path.resolve(__dirname, '..') }, (error, stdout, stderr) => {
      try { if (fs.existsSync(tempPayloadPath)) fs.unlinkSync(tempPayloadPath); } catch (e) {}

      if (error) {
        console.error(`[API PCP EMAIL ERRO] ${error.message}`);
        return res.status(500).json({ success: false, error: error.message });
      }

      try {
        const parsedResult = JSON.parse(stdout.trim());
        if (!parsedResult.success) {
          return res.status(400).json(parsedResult);
        }
        return res.status(200).json(parsedResult);
      } catch (e) {
        return res.status(200).json({ success: true, message: stdout.trim() });
      }
    });
  } catch (e) {
    console.error(`[API PCP EMAIL EXCEPTION] ${e.message}`);
    return res.status(500).json({ success: false, error: e.message });
  }
}
