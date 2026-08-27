import { useState, useEffect, useCallback } from 'react';
import { UNIDADES_PLANEJAMENTO } from '@/constants/unidades';

export interface SmtpConfig {
  host: string;
  port: number;
  secure: 'tls' | 'ssl' | 'none';
  user: string;
  password?: string;
  senderName: string;
  fromEmail: string;
}

export interface UnidadeEmailConfig {
  unidadeId: string;
  unidadeNome: string;
  destinatariosPara: string[];
  destinatariosCc: string[];
  destinatariosBcc?: string[];
  assuntoTemplate?: string;
}

export interface UserSignatureConfig {
  tipo: 'html' | 'texto';
  html: string;
  texto: string;
}

export interface PlanejamentoEmailFullConfig {
  smtp: SmtpConfig;
  unidades: Record<string, UnidadeEmailConfig>;
  signatures?: Record<string, UserSignatureConfig>;
  defaultSignature?: UserSignatureConfig;
  updatedAt?: string;
  updatedBy?: string;
}

const STORAGE_KEY = 'pcp_planejamento_email_config_v1';

export const DEFAULT_THUNDERBIRD_HTML_SIGNATURE = `<div style="font-family: 'Trebuchet MS', sans-serif; font-size: 13px; color: #23211E; line-height: 1.4;">
  <b>Cesar Jung</b><br>
  <span style="font-size: 11px; color: #5C574F;">Coordenador de PCP - CCM</span><br>
  <img src="http://www.sirtec.com.br/imagens/logo_email_RS.jpg" width="307" height="99" alt="Sirtec" style="margin: 6px 0; display: block;" /><br>
  <span style="font-size: 11px; color: #23211E;">Celular: (55) 99708-7985</span><br>
  <a href="http://www.sirtec.com.br/" style="font-size: 11px; text-decoration: none; color: #A52A2A; font-weight: bold;">www.sirtec.com.br</a><br>
  <span style="font-size: 11px; color: #FF0000; font-weight: 500;">NOSSA MISSÃO: Contribuir para o bem-estar e o desenvolvimento da humanidade.</span><br><br>
  <span style="font-size: 9.5px; color: #8C877D; line-height: 1.3; display: block;">Esta mensagem, incluindo seus eventuais anexos, é somente para uso do destinatário informado e pode conter informações privilegiadas, confidenciais, proprietárias de uso restrito e/ou legalmente protegidas. Se você recebeu esta mensagem por engano, por favor, notifique o remetente imediatamente e apague a original. Qualquer outro uso deste e-mail é proibido. Se tiver alguma dúvida, entre em contato conosco pelo endereço sirtec.com.br/contato.</span>
</div>`;

export const DEFAULT_TEXT_SIGNATURE = `Cesar Jung
Coordenador de PCP - CCM
Celular: (55) 99708-7985
www.sirtec.com.br
NOSSA MISSÃO: Contribuir para o bem-estar e o desenvolvimento da humanidade.`;

export const DEFAULT_USER_SIGNATURE: UserSignatureConfig = {
  tipo: 'html',
  html: DEFAULT_THUNDERBIRD_HTML_SIGNATURE,
  texto: DEFAULT_TEXT_SIGNATURE,
};

export const DEFAULT_SMTP_CONFIG: SmtpConfig = {
  host: 'smtp.office365.com',
  port: 587,
  secure: 'tls',
  user: 'planejamento.ba@sirtec.com.br',
  password: '',
  senderName: 'Sirtec PCP · Planejamento Operacional',
  fromEmail: 'planejamento.ba@sirtec.com.br',
};

export const getDefaultUnidadesConfig = (): Record<string, UnidadeEmailConfig> => {
  const map: Record<string, UnidadeEmailConfig> = {};
  UNIDADES_PLANEJAMENTO.forEach(u => {
    map[u.id] = {
      unidadeId: u.id,
      unidadeNome: u.nome,
      destinatariosPara: [
        'planejamento.ba@sirtec.com.br',
        'supervisao.operacional@sirtec.com.br'
      ],
      destinatariosCc: [
        'gerencia.operacoes@sirtec.com.br'
      ],
      destinatariosBcc: [],
      assuntoTemplate: 'Programação Semanal PCP · {unidade} · {periodo}',
    };
  });
  return map;
};

export function usePlanejamentoEmailSettings() {
  const [config, setConfig] = useState<PlanejamentoEmailFullConfig>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          smtp: { ...DEFAULT_SMTP_CONFIG, ...(parsed.smtp || {}) },
          unidades: { ...getDefaultUnidadesConfig(), ...(parsed.unidades || {}) },
          signatures: parsed.signatures || {},
          defaultSignature: parsed.defaultSignature || DEFAULT_USER_SIGNATURE,
          updatedAt: parsed.updatedAt,
          updatedBy: parsed.updatedBy,
        };
      }
    } catch (e) {
      console.warn('Erro ao carregar configurações de e-mail do localStorage:', e);
    }
    return {
      smtp: DEFAULT_SMTP_CONFIG,
      unidades: getDefaultUnidadesConfig(),
      signatures: {},
      defaultSignature: DEFAULT_USER_SIGNATURE,
    };
  });

  const saveConfig = useCallback((newConfig: PlanejamentoEmailFullConfig) => {
    const enriched = {
      ...newConfig,
      updatedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(enriched));
      setConfig(enriched);
    } catch (e) {
      console.error('Erro ao salvar configurações de e-mail no localStorage:', e);
    }
  }, []);

  const saveSmtpConfig = useCallback((smtp: SmtpConfig) => {
    setConfig(prev => {
      const next = { ...prev, smtp, updatedAt: new Date().toISOString() };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  }, []);

  const saveUnidadeConfig = useCallback((unidadeId: string, partial: Partial<UnidadeEmailConfig>) => {
    setConfig(prev => {
      const existing = prev.unidades[unidadeId] || {
        unidadeId,
        unidadeNome: UNIDADES_PLANEJAMENTO.find(u => u.id === unidadeId)?.nome || unidadeId,
        destinatariosPara: [],
        destinatariosCc: [],
      };

      const updatedUnidade = { ...existing, ...partial };
      const next = {
        ...prev,
        unidades: {
          ...prev.unidades,
          [unidadeId]: updatedUnidade,
        },
        updatedAt: new Date().toISOString(),
      };

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  }, []);

  const getUnidadeConfig = useCallback((unidadeId: string): UnidadeEmailConfig => {
    if (config.unidades[unidadeId]) {
      return config.unidades[unidadeId];
    }
    const unitObj = UNIDADES_PLANEJAMENTO.find(u => u.id === unidadeId);
    return {
      unidadeId,
      unidadeNome: unitObj?.nome || 'UNIDADE',
      destinatariosPara: ['planejamento.ba@sirtec.com.br', 'supervisao.operacional@sirtec.com.br'],
      destinatariosCc: ['gerencia.operacoes@sirtec.com.br'],
      destinatariosBcc: [],
      assuntoTemplate: 'Programação Semanal PCP · {unidade} · {periodo}',
    };
  }, [config.unidades]);

  const getUserSignature = useCallback((userId?: string): UserSignatureConfig => {
    if (userId && config.signatures && config.signatures[userId]) {
      return config.signatures[userId];
    }
    return config.defaultSignature || DEFAULT_USER_SIGNATURE;
  }, [config.signatures, config.defaultSignature]);

  const saveUserSignature = useCallback((signature: UserSignatureConfig, userId?: string) => {
    setConfig(prev => {
      const next: PlanejamentoEmailFullConfig = {
        ...prev,
        defaultSignature: signature,
        signatures: {
          ...(prev.signatures || {}),
          ...(userId ? { [userId]: signature } : {}),
        },
        updatedAt: new Date().toISOString(),
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  }, []);

  return {
    config,
    smtpConfig: config.smtp,
    saveConfig,
    saveSmtpConfig,
    saveUnidadeConfig,
    getUnidadeConfig,
    getUserSignature,
    saveUserSignature,
  };
}
