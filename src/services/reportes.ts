import { supabase } from '@/integrations/supabase/client';

export type ReporteStatus = 'pendente' | 'em_andamento' | 'resolvido';
export type ReportePrioridade = 'baixa' | 'media' | 'alta' | 'urgente';

export interface ReporteItem {
  id: string;
  titulo: string;
  descricao: string;
  categoria: string;
  prioridade: ReportePrioridade;
  status: ReporteStatus;
  anexo_url: string | null;
  anexo_nome: string | null;
  anexo_tipo: string | null;
  usuario_id: string;
  usuario_nome: string;
  usuario_email: string;
  resposta: string | null;
  respondido_por_id: string | null;
  respondido_por_nome: string | null;
  respondido_em: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateReporteDTO {
  titulo: string;
  descricao: string;
  categoria?: string;
  prioridade?: ReportePrioridade;
  usuario_id: string;
  usuario_nome: string;
  usuario_email: string;
  anexo_base64?: string | null;
  anexo_nome?: string | null;
  anexo_tipo?: string | null;
}

export interface UpdateReporteDTO {
  id: string;
  status?: ReporteStatus;
  resposta?: string;
  respondido_por_id?: string;
  respondido_por_nome?: string;
}

const CACHE_STORE_KEY = 'SYSTEM_REPORTES_STORE';
const LOCAL_STORAGE_KEY = 'sirtec_reportes_cache';

// Helper to fetch directly from Supabase Cloud
async function fetchDirectFromSupabase(): Promise<ReporteItem[]> {
  try {
    // 1. Try native app_reports table
    const { data: tableData, error: tableErr } = await supabase
      .from('app_reports' as any)
      .select('*')
      .order('created_at', { ascending: false });

    if (!tableErr && Array.isArray(tableData) && tableData.length > 0) {
      return tableData as any;
    }
  } catch (e) {}

  try {
    // 2. Try Supabase cloud JSON store in planejamento_cache
    const { data, error } = await supabase
      .from('planejamento_cache')
      .select('principal')
      .eq('unidade_id', CACHE_STORE_KEY)
      .maybeSingle();

    if (!error && data?.principal && Array.isArray(data.principal)) {
      return data.principal as any;
    }
  } catch (e) {
    console.error('[ReportesService] Erro ao buscar do Supabase:', e);
  }

  return [];
}

// Helper to save directly to Supabase Cloud
async function saveDirectToSupabase(list: ReporteItem[]): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('planejamento_cache')
      .upsert({
        unidade_id: CACHE_STORE_KEY,
        principal: list as any,
        updated_at: new Date().toISOString()
      });
    return !error;
  } catch (e) {
    console.error('[ReportesService] Erro ao salvar no Supabase:', e);
    return false;
  }
}

export const reportesService = {
  async list(): Promise<ReporteItem[]> {
    // 1. Tentar buscar da API (/api/reportes)
    try {
      const res = await fetch('/api/reportes');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(json.data));
          return json.data;
        }
      }
    } catch (err) {
      console.warn('[ReportesService] Falha ao conectar à API local/serverless:', err);
    }

    // 2. Tentar buscar direto do Supabase Cloud (garante sincronização global no Vercel)
    try {
      const cloudData = await fetchDirectFromSupabase();
      if (cloudData.length > 0) {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cloudData));
        return cloudData;
      }
    } catch (err) {
      console.warn('[ReportesService] Falha ao buscar do Supabase:', err);
    }

    // 3. Fallback: cache local do navegador
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {
      console.error('[ReportesService] Erro ao ler cache local:', e);
    }

    return [];
  },

  async create(dto: CreateReporteDTO): Promise<ReporteItem> {
    const newItem: ReporteItem = {
      id: `rep_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      titulo: dto.titulo,
      descricao: dto.descricao,
      categoria: dto.categoria || 'Geral',
      prioridade: dto.prioridade || 'media',
      status: 'pendente',
      anexo_url: dto.anexo_base64 || null,
      anexo_nome: dto.anexo_nome || null,
      anexo_tipo: dto.anexo_tipo || null,
      usuario_id: dto.usuario_id,
      usuario_nome: dto.usuario_nome,
      usuario_email: dto.usuario_email,
      resposta: null,
      respondido_por_id: null,
      respondido_por_nome: null,
      respondido_em: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    let finalItem = newItem;

    // 1. Tentar salvar via API
    try {
      const res = await fetch('/api/reportes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dto),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          finalItem = json.data;
        }
      }
    } catch (err) {
      console.warn('[ReportesService] Erro na requisição da API:', err);
    }

    // 2. Sempre salvar direto no Supabase Cloud para garantir persistência global imediata
    try {
      const current = await this.list();
      const updated = [finalItem, ...current.filter((r) => r.id !== finalItem.id)];
      await saveDirectToSupabase(updated);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
      console.warn('[ReportesService] Falha ao persistir na nuvem:', err);
    }

    return finalItem;
  },

  async update(dto: UpdateReporteDTO): Promise<ReporteItem> {
    let updatedItem: ReporteItem | null = null;

    // 1. Tentar atualizar via API
    try {
      const res = await fetch('/api/reportes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dto),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          updatedItem = json.data;
        }
      }
    } catch (err) {
      console.warn('[ReportesService] Erro ao atualizar via API:', err);
    }

    // 2. Atualizar direto no Supabase Cloud
    const current = await this.list();
    const idx = current.findIndex((r) => r.id === dto.id);
    if (idx !== -1) {
      if (dto.status !== undefined) current[idx].status = dto.status;
      if (dto.resposta !== undefined) current[idx].resposta = dto.resposta;
      if (dto.respondido_por_id !== undefined) current[idx].respondido_por_id = dto.respondido_por_id;
      if (dto.respondido_por_nome !== undefined) current[idx].respondido_por_nome = dto.respondido_por_nome;
      current[idx].respondido_em = new Date().toISOString();
      current[idx].updated_at = new Date().toISOString();
      updatedItem = current[idx];

      await saveDirectToSupabase(current);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(current));
      return updatedItem;
    }

    if (updatedItem) return updatedItem;
    throw new Error('Reporte não encontrado.');
  },

  async delete(id: string): Promise<boolean> {
    try {
      await fetch('/api/reportes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
    } catch (err) {}

    const current = await this.list();
    const filtered = current.filter((r) => r.id !== id);
    await saveDirectToSupabase(filtered);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filtered));
    return true;
  },
};
