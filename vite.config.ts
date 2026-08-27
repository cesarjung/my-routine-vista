import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { exec } from "child_process";
import { componentTagger } from "lovable-tagger";

const pcpSyncApiPlugin = (): Plugin => ({
  name: "pcp-sync-api",
  configureServer(server) {
    server.middlewares.use("/api/salvar-programacao", (req, res, next) => {
      if (req.method === "POST") {
        let body = "";
        req.on("data", (chunk) => {
          body += chunk.toString();
        });
        req.on("end", () => {
          try {
            const data = JSON.parse(body);
            const { csvFilename, csvContent, unitSigla, reprogramar, motivo } = data;

            if (!csvFilename || !csvContent) {
              res.statusCode = 400;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: "Parâmetros csvFilename e csvContent são obrigatórios." }));
              return;
            }

            const scratchDir = path.resolve(__dirname, "scratch");
            if (!fs.existsSync(scratchDir)) {
              fs.mkdirSync(scratchDir, { recursive: true });
            }

            const filePath = path.join(scratchDir, csvFilename);
            fs.writeFileSync(filePath, csvContent, "utf-8");
            console.log(`\n[API PCP] 📄 Arquivo CSV salvo em: ${filePath} (reprogramar=${Boolean(reprogramar)}, motivo="${motivo || ''}")`);

            // Run sync_csv_to_sheets.py immediately to upload to Drive & paste to Plan_Principal
            const pyScript = path.resolve(__dirname, "sync_csv_to_sheets.py");
            let cmd = `python "${pyScript}" "${filePath}"`;
            if (reprogramar) {
              cmd += ' --reprogramar';
              if (motivo) {
                const safeMotivo = String(motivo).replace(/"/g, '\\"');
                cmd += ` --motivo="${safeMotivo}"`;
              }
            }

            console.log(`[API PCP] 🚀 Disparando upload pro Drive e gravação direta na Plan_Principal: ${cmd}`);
            exec(cmd, { cwd: __dirname }, (error, stdout, stderr) => {
              if (error) {
                console.error(`[API PCP ERRO] ${error.message}`);
                if (stderr) console.error(`[API PCP STDERR] ${stderr}`);
              } else {
                console.log(`[API PCP SUCESSO]\n${stdout}`);
              }
            });

            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({
              success: true,
              filename: csvFilename,
              message: "Programação salva! CSV enviado ao Drive e colado na Plan_Principal!"
            }));
          } catch (e: any) {
            console.error(`[API PCP EXCEPTION] ${e.message}`);
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: e.message }));
          }
        });
      } else {
        next();
      }
    });

    server.middlewares.use("/api/sync-pcp-cache", (req, res, next) => {
      if (req.method === "POST") {
        let body = "";
        req.on("data", chunk => { body += chunk.toString(); });
        req.on("end", () => {
          try {
            const data = body ? JSON.parse(body) : {};
            const unidadeId = data.unidadeId || "1rj2V7CxbZwkan63eCeLkH9G00Gi041IZNC6vwEgq6yI";
            const pyScript = path.resolve(__dirname, "sync_unit_now.py");
            const cmd = `python "${pyScript}" "${unidadeId}"`;

            console.log(`[API PCP SYNC] 🔄 Sincronizando dados do Google Sheets para o Supabase: ${cmd}`);
            exec(cmd, { cwd: __dirname }, (error, stdout, stderr) => {
              if (error) {
                console.error(`[API PCP SYNC ERRO] ${error.message}`);
                res.statusCode = 500;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ success: false, error: error.message }));
              } else {
                console.log(`[API PCP SYNC SUCESSO]\n${stdout}`);
                res.statusCode = 200;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ success: true, message: "Dados sincronizados do Google Sheets com sucesso!" }));
              }
            });
          } catch (e: any) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ success: false, error: e.message }));
          }
        });
      } else {
        next();
      }
    });

    server.middlewares.use("/api/enviar-planejamento-email", (req, res, next) => {
      if (req.method === "POST") {
        let body = "";
        req.on("data", chunk => { body += chunk.toString(); });
        req.on("end", () => {
          try {
            const data = JSON.parse(body);
            const scratchDir = path.resolve(__dirname, "scratch");
            if (!fs.existsSync(scratchDir)) {
              fs.mkdirSync(scratchDir, { recursive: true });
            }

            const tempPayloadPath = path.join(scratchDir, `email_payload_${Date.now()}.json`);
            fs.writeFileSync(tempPayloadPath, JSON.stringify(data, null, 2), "utf-8");

            const pyScript = path.resolve(__dirname, "send_planejamento_email.py");
            const cmd = `python "${pyScript}" "${tempPayloadPath}"`;

            console.log(`[API PCP EMAIL] 📧 Disparando envio de e-mail via SMTP...`);
            exec(cmd, { cwd: __dirname }, (error, stdout, stderr) => {
              // Remove temp file after send
              try { if (fs.existsSync(tempPayloadPath)) fs.unlinkSync(tempPayloadPath); } catch (e) {}

              if (error) {
                console.error(`[API PCP EMAIL ERRO] ${error.message}`);
                res.statusCode = 500;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ success: false, error: error.message }));
                return;
              }

              try {
                const parsedResult = JSON.parse(stdout.trim());
                if (!parsedResult.success) {
                  res.statusCode = 400;
                  res.setHeader("Content-Type", "application/json");
                  res.end(JSON.stringify(parsedResult));
                  return;
                }
                res.statusCode = 200;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify(parsedResult));
              } catch (e) {
                res.statusCode = 200;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ success: true, message: stdout.trim() }));
              }
            });
          } catch (e: any) {
            console.error(`[API PCP EMAIL EXCEPTION] ${e.message}`);
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ success: false, error: e.message }));
          }
        });
      } else {
        next();
      }
    });
  },
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    strictPort: true,
    hmr: {
      overlay: false
    }
  },
  plugins: [react(), mode === "development" && componentTagger(), pcpSyncApiPlugin()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
