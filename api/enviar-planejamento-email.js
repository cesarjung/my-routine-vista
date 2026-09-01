import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' });
  }

  try {
    const data = req.body || {};
    const smtpCfg = data.smtp || {};
    const dest = data.destinatarios || {};
    const assunto = data.assunto || 'Programação Semanal PCP';
    const htmlContent = data.html || '';

    const host = (smtpCfg.host || 'smtp.sirtec.com.br').trim();
    const port = parseInt(smtpCfg.port, 10) || 587;
    const secure = (smtpCfg.secure || 'tls').toLowerCase().trim();
    const user = (smtpCfg.user || '').trim();
    const password = (smtpCfg.password || '').trim();
    const senderName = (smtpCfg.senderName || 'Sirtec PCP · Planejamento Operacional').trim();
    const fromEmail = (smtpCfg.fromEmail || user).trim() || user;

    const paraList = (dest.para || []).map(e => String(e).trim()).filter(Boolean);
    const ccList = (dest.cc || []).map(e => String(e).trim()).filter(Boolean);
    const bccList = (dest.bcc || []).map(e => String(e).trim()).filter(Boolean);

    if (paraList.length === 0) {
      return res.status(400).json({ success: false, error: "Nenhum destinatário informado no campo 'Para'." });
    }

    if (!host || !user) {
      return res.status(400).json({ success: false, error: 'Servidor SMTP e Usuário são obrigatórios nas Configurações.' });
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: secure === 'ssl' || port === 465, // true for 465, false for other ports (STARTTLS)
      auth: password ? { user, pass: password } : undefined,
      tls: {
        rejectUnauthorized: false
      }
    });

    const mailOptions = {
      from: `"${senderName}" <${fromEmail}>`,
      to: paraList.join(', '),
      cc: ccList.length > 0 ? ccList.join(', ') : undefined,
      bcc: bccList.length > 0 ? bccList.join(', ') : undefined,
      subject: assunto,
      html: htmlContent
    };

    const info = await transporter.sendMail(mailOptions);

    return res.status(200).json({
      success: true,
      message: `E-mail de planejamento enviado com sucesso para ${paraList.length} destinatário(s)${ccList.length ? ` e ${ccList.length} em cópia` : ''}.`,
      messageId: info.messageId
    });
  } catch (err) {
    console.error(`[API PCP EMAIL ERRO]`, err);
    return res.status(500).json({
      success: false,
      error: `Erro ao enviar e-mail: ${err.message || String(err)}`
    });
  }
}
