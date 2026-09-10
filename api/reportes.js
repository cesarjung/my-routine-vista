import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://curyufedazpkhtxrwhkn.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1cnl1ZmVkYXpwa2h0eHJ3aGtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5NzU5NTIsImV4cCI6MjA4MjU1MTk1Mn0.DGKJPQBmLCTw5YyKwg7LfRQMseeVgXzljD5Z6lCESRs';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      // 1. Tentar ler de app_reports
      try {
        const { data: tableData, error: tableErr } = await supabase
          .from('app_reports')
          .select('*')
          .order('created_at', { ascending: false });

        if (!tableErr && Array.isArray(tableData) && tableData.length > 0) {
          return res.status(200).json({ success: true, data: tableData });
        }
      } catch (e) {}

      // 2. Ler da base compartilhada do Supabase
      const { data, error } = await supabase
        .from('planejamento_cache')
        .select('principal')
        .like('unidade_id', 'REP_%');

      if (error) {
        return res.status(200).json({ success: true, data: [] });
      }

      const items = (data || [])
        .map((r) => r.principal)
        .filter(Boolean);

      items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return res.status(200).json({ success: true, data: items });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const reportId = body.id || `rep_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const nowIso = new Date().toISOString();

      const newReport = {
        id: reportId,
        titulo: body.titulo || 'Reporte de Erro',
        descricao: body.descricao || '',
        categoria: body.categoria || 'Geral',
        prioridade: body.prioridade || 'media',
        status: 'pendente',
        anexo_url: body.anexo_url || (body.anexo_base64?.startsWith('data:') ? body.anexo_base64 : null),
        anexo_nome: body.anexo_nome || null,
        anexo_tipo: body.anexo_tipo || null,
        usuario_id: body.usuario_id || 'anon',
        usuario_nome: body.usuario_nome || 'Usuário',
        usuario_email: body.usuario_email || '',
        resposta: null,
        respondido_por_id: null,
        respondido_por_nome: null,
        respondido_em: null,
        created_at: nowIso,
        updated_at: nowIso,
      };

      try {
        await supabase.from('app_reports').insert(newReport);
      } catch (e) {}

      await supabase
        .from('planejamento_cache')
        .upsert({
          unidade_id: `REP_${reportId}`,
          principal: newReport,
          updated_at: nowIso,
        });

      return res.status(200).json({ success: true, data: newReport });
    }

    if (req.method === 'PATCH') {
      const body = req.body || {};
      const { id, status, resposta, respondido_por_id, respondido_por_nome } = body;
      const nowIso = new Date().toISOString();

      const { data: existingRow } = await supabase
        .from('planejamento_cache')
        .select('principal')
        .eq('unidade_id', `REP_${id}`)
        .maybeSingle();

      if (!existingRow?.principal) {
        return res.status(404).json({ success: false, error: 'Reporte não encontrado.' });
      }

      const item = existingRow.principal;
      if (status !== undefined) item.status = status;
      if (resposta !== undefined) item.resposta = resposta;
      if (respondido_por_id !== undefined) item.respondido_por_id = respondido_por_id;
      if (respondido_por_nome !== undefined) item.respondido_por_nome = respondido_por_nome;
      item.respondido_em = nowIso;
      item.updated_at = nowIso;

      await supabase
        .from('planejamento_cache')
        .upsert({
          unidade_id: `REP_${id}`,
          principal: item,
          updated_at: nowIso,
        });

      try {
        await supabase.from('app_reports').update(item).eq('id', id);
      } catch (e) {}

      return res.status(200).json({ success: true, data: item });
    }

    if (req.method === 'DELETE') {
      const { id } = req.body || {};
      await supabase
        .from('planejamento_cache')
        .delete()
        .eq('unidade_id', `REP_${id}`);

      try {
        await supabase.from('app_reports').delete().eq('id', id);
      } catch (e) {}

      return res.status(200).json({ success: true, message: 'Reporte removido com sucesso.' });
    }

    return res.status(405).json({ error: 'Método não permitido.' });
  } catch (err) {
    console.error('[API Reportes Serverless] Erro:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
