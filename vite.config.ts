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
            if (data.deletedSchedules && Array.isArray(data.deletedSchedules) && data.deletedSchedules.length > 0) {
              const safeJson = JSON.stringify(data.deletedSchedules).replace(/"/g, '\\"');
              cmd += ` --deleted-schedules="${safeJson}"`;
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

const reportesApiPlugin = (): Plugin => ({
  name: "reportes-api",
  configureServer(server) {
    const dataDir = path.resolve(__dirname, "scratch");
    const uploadsDir = path.join(dataDir, "uploads", "reportes");
    const reportesFilePath = path.join(dataDir, "reportes.json");

    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const readReportes = () => {
      try {
        if (fs.existsSync(reportesFilePath)) {
          const content = fs.readFileSync(reportesFilePath, "utf-8");
          return JSON.parse(content);
        }
      } catch (err) {
        console.error("[API Reportes] Erro ao ler reportes.json:", err);
      }
      return [];
    };

    const writeReportes = (reportes: any[]) => {
      try {
        fs.writeFileSync(reportesFilePath, JSON.stringify(reportes, null, 2), "utf-8");
      } catch (err) {
        console.error("[API Reportes] Erro ao salvar reportes.json:", err);
      }
    };

    // Serve uploaded files
    server.middlewares.use("/api/reportes/files", (req, res, next) => {
      if (req.method === "GET") {
        const parsedUrl = new URL(req.url || "", "http://localhost");
        const filename = path.basename(parsedUrl.pathname);
        const filePath = path.join(uploadsDir, filename);

        if (fs.existsSync(filePath)) {
          const ext = path.extname(filename).toLowerCase();
          const mimeTypes: Record<string, string> = {
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".gif": "image/gif",
            ".webp": "image/webp",
            ".pdf": "application/pdf",
            ".txt": "text/plain",
          };
          res.setHeader("Content-Type", mimeTypes[ext] || "application/octet-stream");
          fs.createReadStream(filePath).pipe(res);
          return;
        }
        res.statusCode = 404;
        res.end("Arquivo não encontrado");
        return;
      }
      next();
    });

    // Main Reportes API
    server.middlewares.use("/api/reportes", (req, res, next) => {
      // Ignore sub-route /files
      if (req.url && req.url.startsWith("/files")) {
        return next();
      }

      if (req.method === "GET") {
        const reportes = readReportes();
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ success: true, data: reportes }));
        return;
      }

      if (req.method === "POST" || req.method === "PATCH" || req.method === "DELETE") {
        let body = "";
        req.on("data", (chunk) => {
          body += chunk.toString();
        });
        req.on("end", () => {
          try {
            const data = body ? JSON.parse(body) : {};
            let reportes = readReportes();

            if (req.method === "POST") {
              const {
                titulo,
                descricao,
                categoria,
                prioridade,
                usuario_id,
                usuario_nome,
                usuario_email,
                anexo_base64,
                anexo_nome,
                anexo_tipo
              } = data;

              let anexo_url = data.anexo_url || null;

              if (anexo_base64 && anexo_nome) {
                try {
                  const rawBase64 = anexo_base64.replace(/^data:[^;]+;base64,/, "");
                  const fileBuffer = Buffer.from(rawBase64, "base64");
                  const safeName = `${Date.now()}_${anexo_nome.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
                  const targetPath = path.join(uploadsDir, safeName);
                  fs.writeFileSync(targetPath, fileBuffer);
                  anexo_url = `/api/reportes/files/${safeName}`;
                } catch (saveErr) {
                  console.error("[API Reportes] Erro ao salvar anexo:", saveErr);
                }
              }

              const newReport = {
                id: data.id || `rep_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
                titulo: titulo || "Erro sem título",
                descricao: descricao || "",
                categoria: categoria || "Geral",
                prioridade: prioridade || "media",
                status: "pendente",
                anexo_url,
                anexo_nome: anexo_nome || null,
                anexo_tipo: anexo_tipo || null,
                usuario_id: usuario_id || "anon",
                usuario_nome: usuario_nome || "Usuário",
                usuario_email: usuario_email || "",
                resposta: null,
                respondido_por_id: null,
                respondido_por_nome: null,
                respondido_em: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              };

              reportes.unshift(newReport);
              writeReportes(reportes);

              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ success: true, data: newReport }));
              return;
            }

            if (req.method === "PATCH") {
              const {
                id,
                status,
                resposta,
                respondido_por_id,
                respondido_por_nome
              } = data;

              const index = reportes.findIndex((r: any) => r.id === id);
              if (index === -1) {
                res.statusCode = 404;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ success: false, error: "Reporte não encontrado." }));
                return;
              }

              if (status !== undefined) reportes[index].status = status;
              if (resposta !== undefined) reportes[index].resposta = resposta;
              if (respondido_por_id !== undefined) reportes[index].respondido_por_id = respondido_por_id;
              if (respondido_por_nome !== undefined) reportes[index].respondido_por_nome = respondido_por_nome;
              reportes[index].respondido_em = new Date().toISOString();
              reportes[index].updated_at = new Date().toISOString();

              writeReportes(reportes);

              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ success: true, data: reportes[index] }));
              return;
            }

            if (req.method === "DELETE") {
              const { id } = data;
              reportes = reportes.filter((r: any) => r.id !== id);
              writeReportes(reportes);
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ success: true, message: "Reporte excluído com sucesso." }));
              return;
            }
          } catch (err: any) {
            console.error("[API Reportes] Erro:", err);
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
        });
        return;
      }

      next();
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
  plugins: [react(), mode === "development" && componentTagger(), pcpSyncApiPlugin(), reportesApiPlugin()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
