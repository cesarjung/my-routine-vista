import sys
import json
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr

def send_email_from_payload(payload_path):
    if not os.path.exists(payload_path):
        return {"success": False, "error": f"Arquivo de payload não encontrado: {payload_path}"}

    try:
        with open(payload_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        return {"success": False, "error": f"Erro ao ler JSON: {str(e)}"}

    smtp_cfg = data.get("smtp", {})
    dest = data.get("destinatarios", {})
    assunto = data.get("assunto", "Programação Semanal PCP")
    html_content = data.get("html", "")

    host = smtp_cfg.get("host", "smtp.sirtec.com.br").strip()
    port = int(smtp_cfg.get("port", 587))
    secure = smtp_cfg.get("secure", "tls").lower().strip()
    user = smtp_cfg.get("user", "").strip()
    password = smtp_cfg.get("password", "").strip()
    sender_name = smtp_cfg.get("senderName", "Sirtec PCP · Planejamento Operacional").strip()
    from_email = smtp_cfg.get("fromEmail", user).strip() or user

    para_list = [e.strip() for e in dest.get("para", []) if e.strip()]
    cc_list = [e.strip() for e in dest.get("cc", []) if e.strip()]
    bcc_list = [e.strip() for e in dest.get("bcc", []) if e.strip()]

    if not para_list:
        return {"success": False, "error": "Nenhum destinatário informado no campo 'Para'."}

    if not host or not user:
        return {"success": False, "error": "Servidor SMTP e Usuário são obrigatórios nas Configurações."}

    all_recipients = list(set(para_list + cc_list + bcc_list))

    msg = MIMEMultipart("alternative")
    msg["Subject"] = assunto
    msg["From"] = formataddr((sender_name, from_email))
    msg["To"] = ", ".join(para_list)
    if cc_list:
        msg["Cc"] = ", ".join(cc_list)

    part_html = MIMEText(html_content, "html", "utf-8")
    msg.attach(part_html)

    try:
        print(f"[SMTP] Conectando a {host}:{port} (secure={secure})...", file=sys.stderr)
        
        if secure == "ssl" or port == 465:
            server = smtplib.SMTP_SSL(host, port, timeout=25)
            server.ehlo()
        else:
            server = smtplib.SMTP(host, port, timeout=25)
            server.ehlo()
            if secure != "none":
                server.starttls()
                server.ehlo()

        if password:
            print(f"[SMTP] Autenticando usuário: {user}...", file=sys.stderr)
            server.login(user, password)
        elif user:
            print(f"[SMTP] Tentando envio sem autenticação por senha...", file=sys.stderr)

        print(f"[SMTP] Enviando e-mail para {len(all_recipients)} destinatários...", file=sys.stderr)
        server.send_message(msg, from_addr=from_email, to_addrs=all_recipients)
        server.quit()
        print(f"[SMTP] ✅ E-mail enviado com sucesso!", file=sys.stderr)

        return {
            "success": True,
            "message": f"E-mail de planejamento enviado com sucesso para {len(para_list)} destinatário(s) e {len(cc_list)} em cópia.",
            "recipientsCount": len(all_recipients)
        }
    except smtplib.SMTPAuthenticationError as auth_err:
        err_msg = f"Falha de autenticação SMTP: {auth_err.smtp_error.decode('utf-8', errors='ignore') if isinstance(auth_err.smtp_error, bytes) else str(auth_err)}"
        print(f"[SMTP ERRO] {err_msg}", file=sys.stderr)
        return {"success": False, "error": f"Erro de autenticação no servidor de e-mail. Verifique o usuário e senha/senha de app nas configurações. ({err_msg})"}
    except Exception as e:
        err_msg = str(e)
        print(f"[SMTP ERRO] {err_msg}", file=sys.stderr)
        return {"success": False, "error": f"Erro ao disparar e-mail via SMTP: {err_msg}"}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        res = {"success": False, "error": "Uso: python send_planejamento_email.py <payload.json>"}
    else:
        res = send_email_from_payload(sys.argv[1])

    print(json.dumps(res, ensure_ascii=False))
