import { useMemo } from 'react';
import { usePlanejamentoRaw } from './usePlanejamentoRaw';
import { parse, isValid, startOfDay, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { UNIDADES_PLANEJAMENTO } from '@/constants/unidades';

export interface CarteiraRow {
  id: string;
  unidadeId: string;
  unidadeNome: string;
  projeto: string;
  titulo: string;
  statusExecucao: string;
  municipio: string;
  prioridade: string;
  meses: string[]; // Lista de meses (ex: "abr./25")
  avnpMap: Record<string, number>; // Mapa Mês -> AVNP
  avnpMaisRecente: number; // AVNP do primeiro mês da lista
  obrasInaptasVal: string;
  obrasSemOrcamentoVal: string;
  postesDisponiveis: number;
  capacidadeFaturamento: number;
  dataInicio: Date | null;
  dataFim: Date | null;
  dataVistoria: Date | null;
  dataEnergizacao: Date | null;
  latitude: number | null;
  longitude: number | null;
  qtdGpm: number;
  qtdNeoex: number;
  orcamentoValidado: number;
  recursosAplicados: number;
}

export interface BaseCurvaRow {
  unidadeId: string;
  mesMeta: string;
  metaPostesEquipe: number;
  totalPostes: number;
  totalEquipes: number;
}

export interface MetaFaturamentoRow {
  unidadeId: string;
  mesMeta: string;
  valor: number;
}

export const useCarteiraDashboardData = (selectedUnidadesIds: string[]) => {
  const { data: rawData, isLoading } = usePlanejamentoRaw(selectedUnidadesIds);

  const parsedData = useMemo(() => {
    if (!rawData || rawData.length === 0) return { carteira: [], baseCurva: [], metasFaturamento: [] };

    const parseNumber = (val: any) => {
      if (!val) return 0;
      let str = String(val).trim();
      const isPercent = str.includes('%');
      const clean = str.replace(/[R$%\s\.]/g, '').replace(',', '.');
      let num = Number(clean);
      if (isNaN(num)) return 0;
      return isPercent ? num / 100 : num;
    };

    const normalizeString = (str: string) => {
      if (!str) return '';
      return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
    };

    const parseDate = (val: any): Date | null => {
      if (!val) return null;
      let str = String(val).trim();
      if (!str || str === '-') return null;
      let parsed = parse(str.split(' - ')[0], 'dd/MM/yyyy', new Date());
      if (isValid(parsed)) return startOfDay(parsed);
      parsed = new Date(str);
      if (isValid(parsed)) return startOfDay(parsed);
      return null;
    };

    const carteira: CarteiraRow[] = [];
    const baseCurva: BaseCurvaRow[] = [];
    const metasFaturamento: MetaFaturamentoRow[] = [];
    let lastUpdated: Date | null = null;

    rawData.forEach(unidadeData => {
      if (unidadeData.lastUpdated) {
        const d = new Date(unidadeData.lastUpdated);
        if (!lastUpdated || d > lastUpdated) lastUpdated = d;
      }
      
      const carteiraRows = unidadeData.carteira;
      const unidadeInfo = UNIDADES_PLANEJAMENTO.find(u => u.id === unidadeData.unidadeId);
      const unidadeNome = unidadeInfo ? unidadeInfo.nome : `UNIDADE ${unidadeData.unidadeId}`;

      // --- PROCESSAR CARTEIRA ---
      for (let i = 1; i < carteiraRows.length; i++) {
        const row = carteiraRows[i];
        if (!row || !Array.isArray(row)) continue; 

        // Ler AVNP (F) e Mês (G)
        const avnpStr = row[5] ? String(row[5]).trim() : '';
        let mesStr = row[6] ? String(row[6]).trim() : '';
        
        // Fallback robusto para mês se estiver vazio usando Data Inicio (coluna J)
        if (!mesStr || mesStr === '-') {
            const dataInicioRaw = row[9] ? String(row[9]).trim() : '';
            if (dataInicioRaw && dataInicioRaw !== '-') {
              const matchDI = dataInicioRaw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
              if (matchDI) {
                mesStr = `01/${matchDI[2]}/${matchDI[3]}`;
              }
            }
        }

        const normalizeMes = (m: string) => {
          if (!m) return '';
          // Ex: "01/05/2026"
          const match = m.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
          if (match) {
            const date = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
            return `${format(date, "MMM", { locale: ptBR })}./${format(date, "yy")}`.toLowerCase(); 
          }
          return m.toLowerCase();
        };

        const meses = mesStr.split(',').map(m => normalizeMes(m.trim())).filter(Boolean);
        const avnps = avnpStr.split(',').map(m => m.trim()).filter(Boolean);
        
        const avnpMap: Record<string, number> = {};
        let avnpMaisRecente = 0;
        
        meses.forEach((m, idx) => {
          let val = parseNumber(avnps[idx] || '0');
          avnpMap[m] = val;
        });

        if (meses.length > 0 && avnps.length > 0) {
          avnpMaisRecente = parseNumber(avnps[0] || '0');
        }

        let lat = Number(String(row[46] || '').replace(',', '.'));
        let lng = Number(String(row[47] || '').replace(',', '.'));

        if (isNaN(lat)) lat = 0;
        if (isNaN(lng)) lng = 0;

        carteira.push({
          id: `${unidadeData.unidadeId}-${i}`,
          unidadeId: unidadeData.unidadeId,
          unidadeNome,
          obrasInaptasVal: row[1] ? String(row[1]).trim() : '', // B
          obrasSemOrcamentoVal: row[3] ? String(row[3]).trim() : '', // D
          statusExecucao: row[11] ? String(row[11]).trim() : '', // L
          projeto: row[12] ? String(row[12]).trim() : '', // M
          titulo: row[13] ? String(row[13]).trim() : '', // N
          municipio: row[14] ? String(row[14]).trim() : '', // O
          prioridade: row[15] ? String(row[15]).trim() : '', // P
          postesDisponiveis: parseNumber(row[24]), // Y
          capacidadeFaturamento: parseNumber(row[38]), // AM
          dataInicio: parseDate(row[9]), // J
          dataFim: parseDate(row[10]), // K
          dataVistoria: parseDate(row[44]), // AS
          dataEnergizacao: parseDate(row[45]), // AT
          meses,
          avnpMap,
          avnpMaisRecente,
          latitude: lat !== 0 ? lat : null,
          longitude: lng !== 0 ? lng : null,

          qtdGpm: parseNumber(row[22]), // W
          qtdNeoex: parseNumber(row[23]), // X
          orcamentoValidado: parseNumber(row[35]), // AJ
          recursosAplicados: recursosAplicadosPorObra[String(row[12] || '').trim()] || 0, // Obra ID na coluna M
        });
      }

      const bdMetasObj = unidadeData.bdMetas as any;
      const baseCurvaRows = bdMetasObj?.base_curva || [];
      const bdConfigRows = bdMetasObj?.bd_config || [];
      
      const unidadeNomeNorm = normalizeString(unidadeNome);

      for (let i = 1; i < baseCurvaRows.length; i++) {
        const row = baseCurvaRows[i];
        if (!row || !Array.isArray(row)) continue;
        
        const unidadeRow = normalizeString(String(row[1] || ''));
        if (unidadeRow !== unidadeNomeNorm && unidadeRow !== unidadeNomeNorm.replace(/\s+/g, '')) {
          continue;
        }

        let parsedMes = parseDate(row[2]);
        let mesMetaStr = '';
        if (parsedMes) {
          mesMetaStr = `${format(parsedMes, "MMM", { locale: ptBR })}./${format(parsedMes, "yy")}`.toLowerCase();
        } else {
          mesMetaStr = row[2] ? String(row[2]).trim() : '';
        }
        
        baseCurva.push({
          unidadeId: unidadeData.unidadeId,
          mesMeta: mesMetaStr, // C (Formatado para bater com selectedMeses)
          metaPostesEquipe: parseNumber(row[4]), // E
          totalPostes: parseNumber(row[5]), // F
          totalEquipes: parseNumber(row[6]), // G
        });
      }

      for (let i = 2; i < bdConfigRows.length; i++) {
        const row = bdConfigRows[i];
        if (!row || !Array.isArray(row)) continue;

        const unidadeRow = normalizeString(String(row[81] || ''));
        if (unidadeRow === unidadeNomeNorm || unidadeRow === unidadeNomeNorm.replace(/\s+/g, '')) {
          const monthNames = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
          for (let m = 0; m < 12; m++) {
            metasFaturamento.push({
              unidadeId: unidadeData.unidadeId,
              mesMeta: `${monthNames[m]}./26`,
              valor: parseNumber(row[82 + m])
            });
          }
        }
      }
    });

    return { carteira, baseCurva, metasFaturamento, lastUpdated };
  }, [rawData]);

  return {
    data: parsedData,
    isLoading
  };
};
