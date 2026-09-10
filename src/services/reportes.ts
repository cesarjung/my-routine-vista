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

const LOCAL_STORAGE_KEY = 'sirtec_reportes_cache';

export const reportesService = {
  async list(): Promise<ReporteItem[]> {
    try {
      const res = await fetch('/api/reportes');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(json.data));
          return json.data;
        }
      }
    } catch (err) {
      console.warn('[ReportesService] Falha ao conectar à API local, usando cache local:', err);
    }

    // Fallback: localStorage
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {
      console.error('[ReportesService] Erro ao carregar cache local:', e);
    }
    return [];
  },

  async create(dto: CreateReporteDTO): Promise<ReporteItem> {
    try {
      const res = await fetch('/api/reportes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dto),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          return json.data;
        }
      }
    } catch (err) {
      console.warn('[ReportesService] Erro na API local ao criar, salvando localmente:', err);
    }

    // Fallback offline / local
    const fallbackItem: ReporteItem = {
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

    const current = await this.list();
    const updated = [fallbackItem, ...current];
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    return fallbackItem;
  },

  async update(dto: UpdateReporteDTO): Promise<ReporteItem> {
    try {
      const res = await fetch('/api/reportes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dto),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          return json.data;
        }
      }
    } catch (err) {
      console.warn('[ReportesService] Erro ao atualizar via API local:', err);
    }

    // Fallback update in cache
    const current = await this.list();
    const idx = current.findIndex((r) => r.id === dto.id);
    if (idx !== -1) {
      if (dto.status !== undefined) current[idx].status = dto.status;
      if (dto.resposta !== undefined) current[idx].resposta = dto.resposta;
      if (dto.respondido_por_id !== undefined) current[idx].respondido_por_id = dto.respondido_por_id;
      if (dto.respondido_por_nome !== undefined) current[idx].respondido_por_nome = dto.respondido_por_nome;
      current[idx].respondido_em = new Date().toISOString();
      current[idx].updated_at = new Date().toISOString();
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(current));
      return current[idx];
    }
    throw new Error('Reporte não encontrado.');
  },

  async delete(id: string): Promise<boolean> {
    try {
      const res = await fetch('/api/reportes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        return true;
      }
    } catch (err) {
      console.warn('[ReportesService] Erro ao deletar via API:', err);
    }

    const current = await this.list();
    const filtered = current.filter((r) => r.id !== id);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filtered));
    return true;
  },
};
