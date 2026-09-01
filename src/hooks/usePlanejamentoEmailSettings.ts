import { useState, useEffect, useCallback } from 'react';
import { UNIDADES_PLANEJAMENTO, UnidadePlanejamento } from '@/constants/unidades';

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

export interface UserSignatureFields {
  nome: string;
  cargo: string;
  celular: string;
}

export interface UserSignatureConfig {
  tipo: 'html' | 'texto';
  nome?: string;
  cargo?: string;
  celular?: string;
  html: string;
  texto: string;
}

export interface UserUnitEmailConfig {
  destinatariosPara: string[];
  destinatariosCc: string[];
  destinatariosBcc?: string[];
  assuntoTemplate?: string;
}

export interface UserSpecificSettings {
  signature?: UserSignatureConfig;
  unidades?: Record<string, UserUnitEmailConfig>;
}

export interface PlanejamentoEmailFullConfig {
  smtp: SmtpConfig;
  unidades: Record<string, UnidadeEmailConfig>;
  userSettings?: Record<string, UserSpecificSettings>;
  signatures?: Record<string, UserSignatureConfig>;
  defaultSignature?: UserSignatureConfig;
  updatedAt?: string;
  updatedBy?: string;
}

const STORAGE_KEY = 'pcp_planejamento_email_config_v2';

export const generateOfficialHtmlSignature = (nome?: string, cargo?: string, celular?: string): string => {
  const cleanNome = (nome || '').trim() || 'Sirtec PCP';
  const cleanCargo = (cargo || '').trim() || 'Planejamento Operacional';
  const cleanCelular = (celular || '').trim() || '(77) 99999-9999';

  return `<div style="font-family: 'Trebuchet MS', sans-serif; font-size: 13px; color: #23211E; line-height: 1.4;">
  <b>${cleanNome}</b><br>
  <span style="font-size: 11px; color: #5C574F;">${cleanCargo}</span><br>
  <img src="http://www.sirtec.com.br/imagens/logo_email_RS.jpg" width="307" height="99" alt="Sirtec" style="margin: 6px 0; display: block;" /><br>
  <span style="font-size: 11px; color: #23211E;">Celular: ${cleanCelular}</span><br>
  <a href="http://www.sirtec.com.br/" style="font-size: 11px; text-decoration: none; color: #A52A2A; font-weight: bold;">www.sirtec.com.br</a><br>
  <span style="font-size: 11px; color: #FF0000; font-weight: 500;">NOSSA MISSÃO: Contribuir para o bem-estar e o desenvolvimento da humanidade.</span><br><br>
  <span style="font-size: 9.5px; color: #8C877D; line-height: 1.3; display: block;">Esta mensagem, incluindo seus eventuais anexos, é somente para uso do destinatário informado e pode conter informações privilegiadas, confidenciais, proprietárias de uso restrito e/ou legalmente protegidas. Se você recebeu esta mensagem por engano, por favor, notifique o remetente imediatamente e apague a original. Qualquer outro uso deste e-mail é proibido. Se tiver alguma dúvida, entre em contato conosco pelo endereço sirtec.com.br/contato.</span>
</div>`;
};

export const generateOfficialTextSignature = (nome?: string, cargo?: string, celular?: string): string => {
  const cleanNome = (nome || '').trim() || 'Sirtec PCP';
  const cleanCargo = (cargo || '').trim() || 'Planejamento Operacional';
  const cleanCelular = (celular || '').trim() || '(77) 99999-9999';

  return `${cleanNome}
${cleanCargo}
Celular: ${cleanCelular}
www.sirtec.com.br
NOSSA MISSÃO: Contribuir para o bem-estar e o desenvolvimento da humanidade.`;
};

export const DEFAULT_USER_SIGNATURE: UserSignatureConfig = {
  tipo: 'html',
  nome: 'Cesar Jung',
  cargo: 'Coordenador de PCP - CCM',
  celular: '(55) 99708-7985',
  html: generateOfficialHtmlSignature('Cesar Jung', 'Coordenador de PCP - CCM', '(55) 99708-7985'),
  texto: generateOfficialTextSignature('Cesar Jung', 'Coordenador de PCP - CCM', '(55) 99708-7985'),
};

export const DEFAULT_SMTP_CONFIG: SmtpConfig = {
  host: 'smtp.sirtec.com.br',
  port: 587,
  secure: 'tls', // STARTTLS
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
      const stored = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('pcp_planejamento_email_config_v1');
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          smtp: { ...DEFAULT_SMTP_CONFIG, ...(parsed.smtp || {}) },
          unidades: { ...getDefaultUnidadesConfig(), ...(parsed.unidades || {}) },
          userSettings: parsed.userSettings || {},
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
      userSettings: {},
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

  // Salvar configuração de unidade: se userId for informado, salva especificamente para o usuário
  const saveUnidadeConfig = useCallback((unidadeId: string, partial: Partial<UnidadeEmailConfig>, userId?: string) => {
    setConfig(prev => {
      const existingGlobal = prev.unidades[unidadeId] || {
        unidadeId,
        unidadeNome: UNIDADES_PLANEJAMENTO.find(u => u.id === unidadeId)?.nome || unidadeId,
        destinatariosPara: [],
        destinatariosCc: [],
        destinatariosBcc: [],
        assuntoTemplate: 'Programação Semanal PCP · {unidade} · {periodo}',
      };

      const updatedUnidade: UnidadeEmailConfig = { ...existingGlobal, ...partial };
      const next: PlanejamentoEmailFullConfig = {
        ...prev,
        unidades: {
          ...prev.unidades,
          [unidadeId]: updatedUnidade,
        },
        updatedAt: new Date().toISOString(),
      };

      // Se houver userId, salva no namespace do usuário
      if (userId) {
        const currentUserSettings = prev.userSettings?.[userId] || { unidades: {} };
        const userUnidades = currentUserSettings.unidades || {};
        next.userSettings = {
          ...(prev.userSettings || {}),
          [userId]: {
            ...currentUserSettings,
            unidades: {
              ...userUnidades,
              [unidadeId]: {
                destinatariosPara: partial.destinatariosPara ?? existingGlobal.destinatariosPara,
                destinatariosCc: partial.destinatariosCc ?? existingGlobal.destinatariosCc,
                destinatariosBcc: partial.destinatariosBcc ?? existingGlobal.destinatariosBcc,
                assuntoTemplate: partial.assuntoTemplate ?? existingGlobal.assuntoTemplate,
              }
            }
          }
        };
      }

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  }, []);

  // Obter configuração da unidade (prioriza a do usuário logado se existir)
  const getUnidadeConfig = useCallback((unidadeId: string, userId?: string): UnidadeEmailConfig => {
    const unitObj = UNIDADES_PLANEJAMENTO.find(u => u.id === unidadeId);
    const unitNome = unitObj?.nome || 'UNIDADE';

    // 1. Tentar pegar a configuração específica salva pelo usuário logado
    if (userId && config.userSettings?.[userId]?.unidades?.[unidadeId]) {
      const userU = config.userSettings[userId].unidades![unidadeId];
      return {
        unidadeId,
        unidadeNome: unitNome,
        destinatariosPara: userU.destinatariosPara || [],
        destinatariosCc: userU.destinatariosCc || [],
        destinatariosBcc: userU.destinatariosBcc || [],
        assuntoTemplate: userU.assuntoTemplate || 'Programação Semanal PCP · {unidade} · {periodo}',
      };
    }

    // 2. Tentar pegar a configuração global da unidade
    if (config.unidades && config.unidades[unidadeId]) {
      return config.unidades[unidadeId];
    }

    // 3. Fallback padrão
    return {
      unidadeId,
      unidadeNome: unitNome,
      destinatariosPara: ['planejamento.ba@sirtec.com.br', 'supervisao.operacional@sirtec.com.br'],
      destinatariosCc: ['gerencia.operacoes@sirtec.com.br'],
      destinatariosBcc: [],
      assuntoTemplate: 'Programação Semanal PCP · {unidade} · {periodo}',
    };
  }, [config.userSettings, config.unidades]);

  // Obter assinatura do usuário
  const getUserSignature = useCallback((userId?: string, fallbackProfile?: { full_name?: string; email?: string }): UserSignatureConfig => {
    // 1. Assinatura específica do usuário em userSettings
    if (userId && config.userSettings?.[userId]?.signature) {
      return config.userSettings[userId].signature!;
    }
    // 2. Assinatura legada em signatures[userId]
    if (userId && config.signatures && config.signatures[userId]) {
      return config.signatures[userId];
    }
    // 3. Gerar assinatura padrão com o nome do perfil se existir
    if (fallbackProfile?.full_name) {
      const nome = fallbackProfile.full_name;
      const cargo = 'Planejamento Operacional - PCP';
      const celular = '(77) 99999-9999';
      return {
        tipo: 'html',
        nome,
        cargo,
        celular,
        html: generateOfficialHtmlSignature(nome, cargo, celular),
        texto: generateOfficialTextSignature(nome, cargo, celular),
      };
    }
    // 4. Default global
    return config.defaultSignature || DEFAULT_USER_SIGNATURE;
  }, [config.userSettings, config.signatures, config.defaultSignature]);

  // Salvar assinatura do usuário
  const saveUserSignature = useCallback((signature: UserSignatureConfig, userId?: string) => {
    // Garante que o HTML e texto estejam atualizados de acordo com nome, cargo e celular
    const nome = signature.nome || 'Sirtec PCP';
    const cargo = signature.cargo || 'Planejamento Operacional';
    const celular = signature.celular || '';
    const cleanSig: UserSignatureConfig = {
      tipo: signature.tipo || 'html',
      nome,
      cargo,
      celular,
      html: generateOfficialHtmlSignature(nome, cargo, celular),
      texto: generateOfficialTextSignature(nome, cargo, celular),
    };

    setConfig(prev => {
      const next: PlanejamentoEmailFullConfig = {
        ...prev,
        defaultSignature: cleanSig,
        signatures: {
          ...(prev.signatures || {}),
          ...(userId ? { [userId]: cleanSig } : {}),
        },
        userSettings: {
          ...(prev.userSettings || {}),
          ...(userId ? {
            [userId]: {
              ...(prev.userSettings?.[userId] || {}),
              signature: cleanSig,
            }
          } : {})
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
