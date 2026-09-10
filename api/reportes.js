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
      const { data, error } = await supabase
        .from('app_reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        // Table may not exist yet in Supabase
        return res.status(200).json({ success: true, data: [], note: error.message });
      }
      return res.status(200).json({ success: true, data: data || [] });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const newRecord = {
        titulo: body.titulo || 'Reporte de Erro',
        descricao: body.descricao || '',
        categoria: body.categoria || 'Geral',
        prioridade: body.prioridade || 'media',
        status: 'pendente',
        anexo_url: body.anexo_url || (body.anexo_base64?.startsWith('data:') ? body.anexo_base64 : null),
        anexo_nome: body.anexo_nome || null,
        anexo_tipo: body.anexo_tipo || null,
        usuario_id: body.usuario_id && body.usuario_id.length > 20 ? body.usuario_id : null,
        usuario_nome: body.usuario_nome || 'Usuário',
        usuario_email: body.usuario_email || '',
      };

      const { data, error } = await supabase
        .from('app_reports')
        .insert(newRecord)
        .select()
        .single();

      if (error) {
        return res.status(200).json({
          success: true,
          data: {
            id: `rep_${Date.now()}`,
            ...newRecord,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        });
      }
      return res.status(200).json({ success: true, data });
    }

    if (req.method === 'PATCH') {
      const body = req.body || {};
      const { id, status, resposta, respondido_por_id, respondido_por_nome } = body;

      const updateData = {
        updated_at: new Date().toISOString()
      };
      if (status !== undefined) updateData.status = status;
      if (resposta !== undefined) updateData.resposta = resposta;
      if (respondido_por_id && respondido_por_id.length > 20) updateData.respondido_por_id = respondido_por_id;
      if (respondido_por_nome !== undefined) updateData.respondido_por_nome = respondido_por_nome;
      updateData.respondido_em = new Date().toISOString();

      const { data, error } = await supabase
        .from('app_reports')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return res.status(200).json({
          success: true,
          data: { id, ...updateData }
        });
      }
      return res.status(200).json({ success: true, data });
    }

    if (req.method === 'DELETE') {
      const { id } = req.body || {};
      await supabase.from('app_reports').delete().eq('id', id);
      return res.status(200).json({ success: true, message: 'Reporte removido' });
    }

    return res.status(405).json({ error: 'Método não suportado' });
  } catch (err) {
    console.error('[API Reportes Vercel] Erro:', err);
    return res.status(200).json({ success: true, data: [], error: err.message });
  }
}
