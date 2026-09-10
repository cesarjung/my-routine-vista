import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://curyufedazpkhtxrwhkn.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1cnl1ZmVkYXpwa2h0eHJ3aGtuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5NzU5NTIsImV4cCI6MjA4MjU1MTk1Mn0.DGKJPQBmLCTw5YyKwg7LfRQMseeVgXzljD5Z6lCESRs';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const CACHE_STORE_KEY = 'SYSTEM_REPORTES_STORE';

// Helper to fetch list from Supabase cloud
async function getCloudReportes() {
  // 1. Try native app_reports table first
  try {
    const { data, error } = await supabase
      .from('app_reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data)) {
      return data;
    }
  } catch (e) {}

  // 2. Fallback to Supabase cloud JSON store in planejamento_cache
  try {
    const { data, error } = await supabase
      .from('planejamento_cache')
      .select('principal')
      .eq('unidade_id', CACHE_STORE_KEY)
      .maybeSingle();

    if (!error && data?.principal && Array.isArray(data.principal)) {
      return data.principal;
    }
  } catch (e) {
    console.error('[API Reportes] Erro ao buscar da nuvem:', e);
  }

  return [];
}

// Helper to save list to Supabase cloud
async function saveCloudReportes(list) {
  try {
    await supabase
      .from('planejamento_cache')
      .upsert({
        unidade_id: CACHE_STORE_KEY,
        principal: list,
        updated_at: new Date().toISOString(),
      });
    return true;
  } catch (e) {
    console.error('[API Reportes] Erro ao salvar na nuvem:', e);
    return false;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const list = await getCloudReportes();
      return res.status(200).json({ success: true, data: list });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const newReport = {
        id: body.id || `rep_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
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
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Try inserting into app_reports if it exists
      try {
        await supabase.from('app_reports').insert(newReport);
      } catch (e) {}

      // Always save to Supabase cloud JSON store so it's globally persistent
      const currentList = await getCloudReportes();
      const updatedList = [newReport, ...currentList.filter((r) => r.id !== newReport.id)];
      await saveCloudReportes(updatedList);

      return res.status(200).json({ success: true, data: newReport });
    }

    if (req.method === 'PATCH') {
      const body = req.body || {};
      const { id, status, resposta, respondido_por_id, respondido_por_nome } = body;

      const currentList = await getCloudReportes();
      const index = currentList.findIndex((r) => r.id === id);

      if (index === -1) {
        return res.status(404).json({ success: false, error: 'Reporte não encontrado.' });
      }

      if (status !== undefined) currentList[index].status = status;
      if (resposta !== undefined) currentList[index].resposta = resposta;
      if (respondido_por_id !== undefined) currentList[index].respondido_por_id = respondido_por_id;
      if (respondido_por_nome !== undefined) currentList[index].respondido_por_nome = respondido_por_nome;
      currentList[index].respondido_em = new Date().toISOString();
      currentList[index].updated_at = new Date().toISOString();

      // Try updating in app_reports if exists
      try {
        await supabase.from('app_reports').update(currentList[index]).eq('id', id);
      } catch (e) {}

      // Save updated list to Supabase cloud store
      await saveCloudReportes(currentList);

      return res.status(200).json({ success: true, data: currentList[index] });
    }

    if (req.method === 'DELETE') {
      const { id } = req.body || {};
      const currentList = await getCloudReportes();
      const filtered = currentList.filter((r) => r.id !== id);
      await saveCloudReportes(filtered);

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
