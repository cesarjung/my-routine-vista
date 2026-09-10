import { supabase } from '@/integrations/supabase/client';

export type ReporteStatus = 'pendente' | 'em_andamento' | 'resolvido';
export type ReportePrioridade = 'baixa' | 'media' | 'alta' | 'urgente';

export interface ReporteMensagem {
  id: string;
  usuario_id: string;
  usuario_nome: string;
  usuario_role?: 'admin' | 'gestor' | 'usuario';
  mensagem: string;
  created_at: string;
}

export interface ReporteItem {
  id: string;
  numero: number;
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
  mensagens?: ReporteMensagem[];
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

export const reportesService = {
  /**
   * Busca a lista unificada de todos os reportes diretamente do Supabase.
   * Mesma base utilizada tanto no ambiente local quanto em produção.
   */
  async list(): Promise<ReporteItem[]> {
    let items: ReporteItem[] = [];

    try {
      // 1. Tentar ler da tabela nativa app_reports (se já tiver sido criada)
      const { data: tableData, error: tableErr } = await supabase
        .from('app_reports' as any)
        .select('*')
        .order('created_at', { ascending: false });

      if (!tableErr && Array.isArray(tableData) && tableData.length > 0) {
        items = tableData as any;
      }
    } catch (e) {}

    // 2. Ler da base compartilhada do Supabase via planejamento_cache com chave REP_%
    if (items.length === 0) {
      try {
        const { data, error } = await supabase
          .from('planejamento_cache')
          .select('principal')
          .like('unidade_id', 'REP_%');

        if (!error && Array.isArray(data)) {
          items = data
            .map((row: any) => row.principal)
            .filter(Boolean) as ReporteItem[];
        }
      } catch (err) {
        console.error('[ReportesService] Erro ao carregar reportes do Supabase:', err);
      }
    }

    // Ordenar do mais recente para o mais antigo
    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Garantir numeração sequencial consistente se algum registro não tiver número gravado
    const chronologicallySorted = [...items].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    chronologicallySorted.forEach((item, index) => {
      if (!item.numero) {
        item.numero = index + 1;
      }
    });

    return items;
  },

  /**
   * Cria um novo reporte gravando diretamente no Supabase com numeração sequencial.
   */
  async create(dto: CreateReporteDTO): Promise<ReporteItem> {
    const existing = await this.list();
    const maxNumero = existing.reduce((max, r) => Math.max(max, r.numero || 0), 0);
    const nextNumero = maxNumero + 1;

    const reportId = `rep_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const nowIso = new Date().toISOString();

    const newReport: ReporteItem = {
      id: reportId,
      numero: nextNumero,
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
      mensagens: [],
      created_at: nowIso,
      updated_at: nowIso,
    };

    // 1. Tentar gravar na tabela app_reports se existir
    try {
      await supabase.from('app_reports' as any).insert(newReport);
    } catch (e) {}

    // 2. Gravar registro individual no Supabase (planejamento_cache)
    const { error } = await supabase
      .from('planejamento_cache')
      .upsert({
        unidade_id: `REP_${reportId}`,
        principal: newReport as any,
        updated_at: nowIso,
      });

    if (error) {
      console.error('[ReportesService] Erro ao salvar reporte no Supabase:', error);
      throw new Error('Não foi possível salvar o reporte no banco de dados.');
    }

    return newReport;
  },

  /**
   * Adiciona uma mensagem de chat/interação ao chamado.
   */
  async addMessage(
    reportId: string,
    msg: {
      usuario_id: string;
      usuario_nome: string;
      usuario_role?: 'admin' | 'gestor' | 'usuario';
      mensagem: string;
    }
  ): Promise<ReporteItem> {
    const nowIso = new Date().toISOString();
    const newMsg: ReporteMensagem = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      usuario_id: msg.usuario_id,
      usuario_nome: msg.usuario_nome,
      usuario_role: msg.usuario_role || 'usuario',
      mensagem: msg.mensagem.trim(),
      created_at: nowIso,
    };

    // 1. Buscar item existente no Supabase
    const { data: existingRow, error: fetchErr } = await supabase
      .from('planejamento_cache')
      .select('principal')
      .eq('unidade_id', `REP_${reportId}`)
      .maybeSingle();

    if (fetchErr || !existingRow?.principal) {
      throw new Error('Reporte não encontrado.');
    }

    const currentItem = existingRow.principal as ReporteItem;
    currentItem.mensagens = [...(currentItem.mensagens || []), newMsg];
    currentItem.updated_at = nowIso;

    // Atualizar no Supabase
    await supabase
      .from('planejamento_cache')
      .upsert({
        unidade_id: `REP_${reportId}`,
        principal: currentItem as any,
        updated_at: nowIso,
      });

    try {
      await supabase.from('app_reports' as any).update(currentItem).eq('id', reportId);
    } catch (e) {}

    return currentItem;
  },

  /**
   * Atualiza o status ou resposta de um reporte na base compartilhada do Supabase.
   */
  async update(dto: UpdateReporteDTO): Promise<ReporteItem> {
    const nowIso = new Date().toISOString();

    // 1. Buscar item existente no Supabase
    const { data: existingRow, error: fetchErr } = await supabase
      .from('planejamento_cache')
      .select('principal')
      .eq('unidade_id', `REP_${dto.id}`)
      .maybeSingle();

    if (fetchErr || !existingRow?.principal) {
      // Tentar buscar na tabela app_reports se existir
      try {
        const { data: rep } = await supabase
          .from('app_reports' as any)
          .select('*')
          .eq('id', dto.id)
          .single();

        if (rep) {
          const updated = {
            ...rep,
            ...(dto.status !== undefined ? { status: dto.status } : {}),
            ...(dto.resposta !== undefined ? { resposta: dto.resposta } : {}),
            ...(dto.respondido_por_id !== undefined ? { respondido_por_id: dto.respondido_por_id } : {}),
            ...(dto.respondido_por_nome !== undefined ? { respondido_por_nome: dto.respondido_por_nome } : {}),
            respondido_em: nowIso,
            updated_at: nowIso,
          };
          await supabase.from('app_reports' as any).update(updated).eq('id', dto.id);
          return updated as ReporteItem;
        }
      } catch (e) {}

      throw new Error('Reporte não encontrado no banco de dados.');
    }

    const currentItem = existingRow.principal as ReporteItem;

    if (dto.status !== undefined) currentItem.status = dto.status;
    if (dto.resposta !== undefined) currentItem.resposta = dto.resposta;
    if (dto.respondido_por_id !== undefined) currentItem.respondido_por_id = dto.respondido_por_id;
    if (dto.respondido_por_nome !== undefined) currentItem.respondido_por_nome = dto.respondido_por_nome;
    currentItem.respondido_em = nowIso;
    currentItem.updated_at = nowIso;

    // Atualizar no Supabase
    await supabase
      .from('planejamento_cache')
      .upsert({
        unidade_id: `REP_${dto.id}`,
        principal: currentItem as any,
        updated_at: nowIso,
      });

    try {
      await supabase.from('app_reports' as any).update(currentItem).eq('id', dto.id);
    } catch (e) {}

    return currentItem;
  },

  /**
   * Exclui um reporte do Supabase.
   */
  async delete(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('planejamento_cache')
      .delete()
      .eq('unidade_id', `REP_${id}`);

    try {
      await supabase.from('app_reports' as any).delete().eq('id', id);
    } catch (e) {}

    return !error;
  },
};
