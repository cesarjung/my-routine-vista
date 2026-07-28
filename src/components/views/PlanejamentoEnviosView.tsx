import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePlanejamentoRaw, useSyncPlanejamento } from '@/hooks/usePlanejamentoRaw';
import { useSessionState } from '@/hooks/useSessionState';
import { format, parse, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { UNIDADES_PLANEJAMENTO } from '@/constants/unidades';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FilterSelect } from '@/components/ui/filter-select';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import { 
  Truck, Calendar, Filter, Download, Printer, Settings, 
  AlertTriangle, ClipboardList, Info, CheckCircle2, 
  Search, FileText, MapPin, RefreshCw, Loader2, AlertCircle,
  Map as MapIcon, User, ListFilter, Building2, ChevronDown, ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';
import Papa from 'papaparse';
import { saveAs } from 'file-saver';

// --- HELPER FUNCTIONS ---

const normalizarTexto = (text: string): string => {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacríticos
    .replace(/\s+/g, '')             // remove todos os espaços
    .toUpperCase();
};

const converterParaNumero = (val: any): number => {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return val;
  let str = String(val).trim();
  if (str.includes(',') && !str.includes('.')) {
    str = str.replace(',', '.');
  } else if (str.includes('.') && str.includes(',')) {
    str = str.replace(/\./g, '').replace(',', '.');
  }
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
};

const formatQtd = (val: number) => {
  if (val === undefined || val === null) return '0';
  return val % 1 === 0 ? String(val) : Number(val.toFixed(1)).toString().replace('.', ',');
};

interface EnviosConfig {
  poleServices: string[];
  excludedStatuses: string[];
  supervisores: string[];
}

export const PlanejamentoEnviosView = () => {
  // 1. FILTERS & STATES (Matching materials view styles)
  const [selectedUnidades, setSelectedUnidades] = useSessionState<string[]>('filter_unidades_envios', []);
  
  // Set default start date to a few days ago, and end date to 30 days ahead to ensure the user gets data immediately
  const defaultStart = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 3);
    return format(d, 'yyyy-MM-dd');
  }, []);

  const defaultEnd = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return format(d, 'yyyy-MM-dd');
  }, []);

  const [filterStart, setFilterStart] = useSessionState<string>('filter_start_envios', defaultStart);
  const [filterEnd, setFilterEnd] = useSessionState<string>('filter_end_envios', defaultEnd);
  const [modo, setModo] = useSessionState<'DIARIO' | 'MENSAL'>('filter_modo_envios', 'DIARIO');
  const [somentePostes, setSomentePostes] = useSessionState<boolean>('filter_somente_postes_envios', true);
  
  // Custom filter selections (matching materials view FilterSelect)
  const [selectedMunicipios, setSelectedMunicipios] = useState<string[]>([]);
  const [selectedObras, setSelectedObras] = useState<string[]>([]);
  const [selectedSupervisores, setSelectedSupervisores] = useState<string[]>([]);
  const [selectedPostesTypes, setSelectedPostesTypes] = useState<string[]>([]);
  const [searchMaterial, setSearchMaterial] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [activeDialogCard, setActiveDialogCard] = useState<'postes' | 'obras' | 'tipos' | 'pendencias' | null>(null);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1280);

  React.useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1280);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Accordion and Dialog states
  const [expandedPostes, setExpandedPostes] = useState<Record<string, boolean>>({});
  const [expandedObrasDetail, setExpandedObrasDetail] = useState<Record<string, boolean>>({});
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  // Sync planning hook (same as materials view)
  const { mutate: syncPlanejamento, isPending: isSyncing } = useSyncPlanejamento();

  // 2. CONFIG PARAMETRIZATION (Default from CONFIG sheet)
  const [enviosConfig, setEnviosConfig] = useState<EnviosConfig>(() => {
    const local = localStorage.getItem('config_secao_envios');
    if (local) {
      try {
        return JSON.parse(local);
      } catch (e) {}
    }
    return {
      poleServices: [
        'INSTALAR POSTE 9 A 14 METROS',
        'INSTALAR POSTE 14 METROS OU SUPERIOR',
        'INSTALAR POSTE SUPERIOR A 14 METROS'
      ],
      excludedStatuses: [
        'CONCLUÍDA/UNITIZADA',
        'CONCLUÍDA',
        'CONCLUIDA',
        'UNITIZADA',
        'CANCELADA'
      ],
      supervisores: [
        'ALFREDO',
        'DANIEL',
        'JHANATAN'
      ]
    };
  });

  const [configTextServices, setConfigTextServices] = useState(enviosConfig.poleServices.join('\n'));
  const [configTextStatuses, setConfigTextStatuses] = useState(enviosConfig.excludedStatuses.join('\n'));
  const [configTextSupervisors, setConfigTextSupervisors] = useState(enviosConfig.supervisores.join('\n'));

  const handleSaveConfig = () => {
    const services = configTextServices.split('\n').map(s => s.trim()).filter(Boolean);
    const statuses = configTextStatuses.split('\n').map(s => s.trim()).filter(Boolean);
    const supervisors = configTextSupervisors.split('\n').map(s => s.trim()).filter(Boolean);

    const newConfig = {
      poleServices: services,
      excludedStatuses: statuses,
      supervisores: supervisors
    };
    setEnviosConfig(newConfig);
    localStorage.setItem('config_secao_envios', JSON.stringify(newConfig));
    setIsConfigOpen(false);
    toast.success('Configurações de parametrização salvas!');
  };

  // 3. FETCH RAW DATA FROM GOOGLE SHEETS CACHE
  const rawQuery = usePlanejamentoRaw(selectedUnidades);

  // 4. FETCH MATERIALS RULES (De/Para) FROM DATABASE
  const rulesQuery = useQuery({
    queryKey: ['materiais_regras_envios'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('materiais_regras')
        .select('*');
      if (error) throw error;
      return data || [];
    },
    staleTime: 10 * 60 * 1000,
  });

  const regrasMaterialMap = useMemo(() => {
    const rawRules = rulesQuery.data || [];
    const regrasList = rawRules.find(r => r.tipo === 'REGRAS_MATERIAL')?.dados || [];
    const map = new Map<string, any>();
    regrasList.forEach((r: any) => {
      if (r.codigo) map.set(String(r.codigo).trim(), r);
    });
    return map;
  }, [rulesQuery.data]);

  const implantacaoEEstruturaCodes = useMemo(() => {
    const rawRules = rulesQuery.data || [];
    const regrasList = rawRules.find(r => r.tipo === 'REGRAS_MATERIAL')?.dados || [];
    const codes: string[] = [];
    regrasList.forEach((r: any) => {
      const gp = String(r.grupo_padrao || '').toUpperCase().trim();
      if (gp === 'IMPLANTAÇÃO' || gp === 'IMPLANTACAO' || gp === 'ESTRUTURA') {
        if (r.codigo) codes.push(String(r.codigo).trim());
      }
    });
    return codes;
  }, [rulesQuery.data]);

  // Helper: check if a material is a POLE (POSTE) using base rules (De/Para group IMPLANTAÇÃO)
  const isPoste = (m: { codigo: string; descricao: string }): boolean => {
    const code = m.codigo ? String(m.codigo).trim() : '';
    const desc = m.descricao ? String(m.descricao).toUpperCase().trim() : '';
    
    // Prioritize De/Para rule in materials section (grupo_padrao IMPLANTAÇÃO)
    const regra = regrasMaterialMap.get(code);
    if (regra) {
      const gp = String(regra.grupo_padrao || '').toUpperCase().trim();
      if (gp === 'IMPLANTAÇÃO' || gp === 'IMPLANTACAO') {
        return true;
      }
    }
    
    // Fallback: description starts with POSTE
    return desc.startsWith('POSTE');
  };

  // 5. PIPELINE STEP 1: PARSE SCHEDULED DATA & EXTRACT PROJECTS (OBRAS)
  const scheduledData = useMemo(() => {
    if (!rawQuery.data || !Array.isArray(rawQuery.data)) return {
      projectsList: [],
      scheduledKeysMap: new Map<string, number>(),
      obrasSemPontosValidos: new Set<string>(),
      obraDetailsMap: new Map<string, { primeiraData: string; supervisor: string; municipio: string; points: Set<string> }>(),
      carteiraMap: new Map<string, any>()
    };

    const projectsSet = new Set<string>();
    const scheduledKeysMap = new Map<string, number>(); // Key: OBRA_PONTO, Val: programmed Qtd
    const obrasSemPontosValidos = new Set<string>();
    const obrasComPontosValidos = new Set<string>();
    
    const obraDetailsMap = new Map<string, { primeiraData: string; supervisor: string; municipio: string; points: Set<string> }>();
    const carteiraMap = new Map<string, any>();

    const parsedStart = filterStart ? parse(filterStart, 'yyyy-MM-dd', new Date()) : null;
    const parsedEnd = filterEnd ? parse(filterEnd, 'yyyy-MM-dd', new Date()) : null;

    const normPoleServices = enviosConfig.poleServices.map(s => normalizarTexto(s));
    const normExcludedStatuses = enviosConfig.excludedStatuses.map(s => normalizarTexto(s));

    rawQuery.data.forEach(unidadeData => {
      const principalRows = unidadeData.principal || [];
      const carteiraRows = unidadeData.carteira || [];
      
      // Parse Carteira_Planejador
      for (let i = 6; i < carteiraRows.length; i++) {
        const row = carteiraRows[i];
        if (!row || !Array.isArray(row) || row.length < 15) continue;
        
        const projectCode = String(row[12] || '').trim(); // M
        if (!projectCode) continue;

        const dataInicioRaw = row[9] || ''; // J
        const dataFimRaw = row[10] || ''; // K
        let dataInicio: Date | null = null;
        let dataFim: Date | null = null;
        
        try {
          if (dataInicioRaw && dataInicioRaw !== '-') dataInicio = parse(dataInicioRaw, 'dd/MM/yyyy', new Date());
          if (dataFimRaw && dataFimRaw !== '-') dataFim = parse(dataFimRaw, 'dd/MM/yyyy', new Date());
        } catch (e) {}

        const statusExecucao = String(row[11] || '').trim(); // L
        const titulo = String(row[13] || '').trim(); // N
        const municipio = String(row[14] || '').trim(); // O
        const supervisor = String(row[32] || '').trim(); // AG
        
        let lat = Number(String(row[46] || '').replace(',', '.'));
        let lng = Number(String(row[47] || '').replace(',', '.'));
        if (isNaN(lat)) lat = 0;
        if (isNaN(lng)) lng = 0;

        carteiraMap.set(projectCode, {
          projectCode,
          dataInicio,
          dataFim,
          statusExecucao,
          titulo,
          municipio,
          supervisor,
          latitude: lat !== 0 ? lat : null,
          longitude: lng !== 0 ? lng : null,
        });
      }

      // MODE DIARIO: Parse Plan_Principal
      if (modo === 'DIARIO') {
        for (let i = 7; i < principalRows.length; i++) {
          const row = principalRows[i];
          if (!row || !Array.isArray(row) || row.length < 15) continue;

          const dataStrFull = String(row[1] || '').trim(); // Col B
          if (!dataStrFull) continue;

          const dataApenas = dataStrFull.split(' - ')[0].trim();
          let dataParsed: Date | null = null;
          try {
            const p = parse(dataApenas, 'dd/MM/yyyy', new Date());
            if (isValid(p)) dataParsed = p;
          } catch (e) {}

          if (!dataParsed || !parsedStart || !parsedEnd) continue;
          
          // Check date range boundary
          if (dataParsed < parsedStart || dataParsed > parsedEnd) continue;

          const projectCode = String(row[7] || '').trim(); // Col H
          if (!projectCode) continue;

          projectsSet.add(projectCode);

          const supervisor = String(row[4] || '').trim(); // Col E
          const municipio = String(row[10] || '').trim() || carteiraMap.get(projectCode)?.municipio || ''; // Col K or fallback
          const atividadesCompiladas = String(row[14] || '').trim(); // Col O

          let rowHasValidPoste = false;

          if (atividadesCompiladas) {
            const blocos = atividadesCompiladas.split('|').map(b => b.trim()).filter(Boolean);
            blocos.forEach(bloco => {
              const parts = bloco.split(' - ').map(p => p.trim());
              if (parts.length >= 2) {
                const ponto = parts[0];
                const servicoDesc = parts[1];
                const normServico = normalizarTexto(servicoDesc);

                // Check if matches configured pole services
                if (normPoleServices.some(s => normServico.includes(s) || s.includes(normServico))) {
                  rowHasValidPoste = true;
                  obrasComPontosValidos.add(projectCode);
                  
                  // Extract Qtd: N
                  let qty = 1;
                  const qtyMatch = bloco.match(/Qtd:\s*([0-9.,]+)/i);
                  if (qtyMatch) {
                    qty = converterParaNumero(qtyMatch[1]);
                    if (qty <= 0) qty = 1;
                  }

                  const key = `${projectCode}_${ponto}`;
                  scheduledKeysMap.set(key, (scheduledKeysMap.get(key) || 0) + qty);

                  // Accumulate details
                  if (!obraDetailsMap.has(projectCode)) {
                    obraDetailsMap.set(projectCode, {
                      primeiraData: dataApenas,
                      supervisor,
                      municipio,
                      points: new Set()
                    });
                  } else {
                    const current = obraDetailsMap.get(projectCode)!;
                    try {
                      const dCurr = parse(current.primeiraData, 'dd/MM/yyyy', new Date());
                      if (dataParsed < dCurr) {
                        current.primeiraData = dataApenas;
                        current.supervisor = supervisor || current.supervisor;
                        current.municipio = municipio || current.municipio;
                      }
                    } catch (e) {}
                  }
                  obraDetailsMap.get(projectCode)!.points.add(ponto);
                }
              }
            });
          }

          if (!rowHasValidPoste && !obrasComPontosValidos.has(projectCode)) {
            obrasSemPontosValidos.add(projectCode);
          }
        }

        // Clean up Obras sem pontos validos list
        obrasComPontosValidos.forEach(o => obrasSemPontosValidos.delete(o));
      } 
      // MODE MENSAL: Parse from Carteira_Planejador directly
      else {
        carteiraMap.forEach((obra, projectCode) => {
          if (!obra.dataInicio || !parsedStart || !parsedEnd) return;
          
          // Condição solicitada: início entre as datas selecionadas
          const intersects = obra.dataInicio >= parsedStart && obra.dataInicio <= parsedEnd;
          
          const statusNorm = normalizarTexto(obra.statusExecucao);
          const isExcluded = normExcludedStatuses.some(s => statusNorm.includes(s));

          if (intersects && !isExcluded) {
            projectsSet.add(projectCode);
            
            const dateStr = format(obra.dataInicio, 'dd/MM/yyyy');
            obraDetailsMap.set(projectCode, {
              primeiraData: dateStr,
              supervisor: obra.supervisor || 'SEM SUPERVISOR',
              municipio: obra.municipio || 'SEM MUNICIPIO',
              points: new Set()
            });
          }
        });
      }
    });

    return {
      projectsList: Array.from(projectsSet),
      scheduledKeysMap,
      obrasSemPontosValidos: Array.from(obrasSemPontosValidos),
      obraDetailsMap,
      carteiraMap
    };
  }, [rawQuery.data, filterStart, filterEnd, modo, enviosConfig]);

  // 6. QUERY SUPABASE FOR BUDGET MATERIALS BY PROJECT
  // Strategy: Now that indexes exist, filter by implantação codes IN the database.
  // Two queries per chunk: one for codigo IN (implantacaoCodes), one for descricao LIKE POSTE%.
  // This avoids the 1000-row Supabase gateway limit since each project has only ~1-5 matching materials.
  const budgetQuery = useQuery({
    queryKey: [
      'envios_budget_materials_v10', 
      scheduledData.projectsList, 
      implantacaoEEstruturaCodes, 
      modo,
      somentePostes,
      Array.from(scheduledData.scheduledKeysMap.keys()).sort().join(',')
    ],
    enabled: scheduledData.projectsList.length > 0 && rulesQuery.isSuccess,
    queryFn: async () => {
      let allData: any[] = [];
      const existingProjects = new Set<string>();
      const list = scheduledData.projectsList;
      
      console.log(`[budgetQuery] Starting: ${list.length} projects, ${implantacaoEEstruturaCodes.length} implantação/estrutura codes, mode: ${modo}, somentePostes: ${somentePostes}`);
      
      // Parallel existence check for each project using limit(1) to avoid Postgrest's 1000 row truncation limit
      const existPromises = list.map(async (project) => {
        const { data, error } = await supabase
          .from('materiais_por_ponto')
          .select('com_mascara')
          .eq('com_mascara', project)
          .limit(1);
        
        if (error) {
          console.error(`[budgetQuery] Error checking project existence for ${project}:`, error);
          return null;
        }
        return data && data.length > 0 ? project : null;
      });
      
      const checkResults = await Promise.all(existPromises);
      checkResults.forEach(p => {
        if (p) existingProjects.add(p);
      });
      
      if (modo === 'DIARIO') {
        const keysList = Array.from(scheduledData.scheduledKeysMap.keys());
        const keyChunkSize = somentePostes ? 50 : 20;
        
        console.log(`[budgetQuery] DIÁRIO mode: querying ${keysList.length} programmed points, somentePostes: ${somentePostes}`);
        
        for (let i = 0; i < keysList.length; i += keyChunkSize) {
          const chunk = keysList.slice(i, i + keyChunkSize);
          
          if (somentePostes) {
            if (implantacaoEEstruturaCodes.length > 0) {
              const { data: d1, error: e1 } = await supabase
                .from('materiais_por_ponto')
                .select('mascara_e_ponto,com_mascara,ponto_obra,codigo,descricao,quantidade,unidade,projeto')
                .in('mascara_e_ponto', chunk)
                .in('codigo', implantacaoEEstruturaCodes);
                
              if (e1) {
                console.error('[budgetQuery] Error (codigo IN):', e1);
                throw e1;
              }
              if (d1) allData = [...allData, ...d1];
            }
            
            const { data: d2, error: e2 } = await supabase
              .from('materiais_por_ponto')
              .select('mascara_e_ponto,com_mascara,ponto_obra,codigo,descricao,quantidade,unidade,projeto')
              .in('mascara_e_ponto', chunk)
              .ilike('descricao', 'POSTE%');
              
            if (e2) {
              console.error('[budgetQuery] Error (POSTE ilike):', e2);
              throw e2;
            }
            if (d2) allData = [...allData, ...d2];
          } else {
            // Fetch all materials for the points
            const { data: d1, error: e1 } = await supabase
              .from('materiais_por_ponto')
              .select('mascara_e_ponto,com_mascara,ponto_obra,codigo,descricao,quantidade,unidade,projeto')
              .in('mascara_e_ponto', chunk);
              
            if (e1) {
              console.error('[budgetQuery] Error (all materials chunk):', e1);
              throw e1;
            }
            if (d1) allData = [...allData, ...d1];
          }
        }
      } else {
        // MENSAL mode: query project-by-project to prevent cross-project truncation
        console.log(`[budgetQuery] MENSAL mode: querying ${list.length} projects individually, somentePostes: ${somentePostes}`);
        
        for (const project of list) {
          if (somentePostes) {
            if (implantacaoEEstruturaCodes.length > 0) {
              const { data: d1, error: e1 } = await supabase
                .from('materiais_por_ponto')
                .select('mascara_e_ponto,com_mascara,ponto_obra,codigo,descricao,quantidade,unidade,projeto')
                .eq('com_mascara', project)
                .in('codigo', implantacaoEEstruturaCodes);
                
              if (e1) {
                console.error(`[budgetQuery] Error for ${project} (codigo IN):`, e1);
                throw e1;
              }
              if (d1) allData = [...allData, ...d1];
            }
            
            const { data: d2, error: e2 } = await supabase
              .from('materiais_por_ponto')
              .select('mascara_e_ponto,com_mascara,ponto_obra,codigo,descricao,quantidade,unidade,projeto')
              .eq('com_mascara', project)
              .ilike('descricao', 'POSTE%');
              
            if (e2) {
              console.error(`[budgetQuery] Error for ${project} (POSTE ilike):`, e2);
              throw e2;
            }
            if (d2) allData = [...allData, ...d2];
          } else {
            // Fetch all materials for the project
            const { data: d1, error: e1 } = await supabase
              .from('materiais_por_ponto')
              .select('mascara_e_ponto,com_mascara,ponto_obra,codigo,descricao,quantidade,unidade,projeto')
              .eq('com_mascara', project);
              
            if (e1) {
              console.error(`[budgetQuery] Error for ${project} (all materials project):`, e1);
              throw e1;
            }
            if (d1) allData = [...allData, ...d1];
          }
        }
      }

      console.log(`[budgetQuery] Total raw rows: ${allData.length}`);

      // Deduplicate (Query 1 and 2 may overlap for postes that are also in implantacaoCodes)
      const uniqueMap = new Map<string, any>();
      allData.forEach(row => {
        const key = `${row.com_mascara || row.projeto}_${row.ponto_obra || ''}_${row.codigo}`;
        uniqueMap.set(key, row);
      });

      console.log(`[budgetQuery] After dedup: ${uniqueMap.size} unique materials`);
      return {
        materials: Array.from(uniqueMap.values()),
        existingProjects: Array.from(existingProjects)
      };
    }
  });

  // 6b. QUERY SUPABASE FOR MATERIALS DELIVERIES (RESERVAS)
  const reservasQuery = useQuery({
    queryKey: ['envios_materials_reservas', selectedUnidades],
    enabled: selectedUnidades.length > 0,
    queryFn: async () => {
      let allData: any[] = [];
      let offset = 0;
      const limit = 1000;
      while (true) {
        const { data, error } = await supabase
          .from('materiais_reservas')
          .select('unidade_id,obra,codigo,quantidade,status')
          .in('unidade_id', selectedUnidades)
          .range(offset, offset + limit - 1);
        if (error) {
          console.warn("Erro ao buscar reservas:", error);
          throw error;
        }
        if (!data || data.length === 0) break;
        allData = [...allData, ...data];
        if (data.length < limit) break;
        offset += limit;
      }
      return allData;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Mapeia quantidades entregues (baixadas ou entregues) por Obra e Código
  const entregueMap = useMemo(() => {
    const map = new Map<string, number>();
    const rawReservas = reservasQuery.data || [];
    rawReservas.forEach((r: any) => {
      const rStatus = String(r.status || '').toUpperCase().trim();
      if (rStatus === 'BAIXADO' || rStatus === 'ENTREGUE') {
        const rCode = String(r.codigo || '').trim();
        const rObra = String(r.obra || '').trim().toUpperCase();
        const key = `${rObra}_${rCode}`;
        const qty = Number(r.quantidade || 0);
        map.set(key, (map.get(key) || 0) + qty);
      }
    });
    return map;
  }, [reservasQuery.data]);

  // 7. PIPELINE STEP 2: CROSS DATA & BUILD THE 4 DATA BLOCKS
  const processedBlocks = useMemo(() => {
    const budgetRaw = budgetQuery.data?.materials || [];
    const scheduledKeys = scheduledData.scheduledKeysMap;
    const obraDetails = scheduledData.obraDetailsMap;
    const carteiraMap = scheduledData.carteiraMap;

    const chavesEncontradasNoOrcamento = new Set<string>();
    const bloco1ItemsMap = new Map<string, { codigo: string; descricao: string; unidade: string; quantidade: number }>();
    
    interface DeliveryItem {
      obra: string;
      pontos: Set<string>;
      municipio: string;
      data: string;
      quantidade: number;
      supervisor: string;
      latitude: number | null;
      longitude: number | null;
    }
    const bloco2Groups = new Map<string, Map<string, DeliveryItem>>();

    // 1. Process all budget materials matching our scheduled projects
    budgetRaw.forEach((m: any) => {
      // Use mascara_e_ponto directly as key - it matches scheduledKeysMap format "B-1112835_P1"
      const keyObraPonto = String(m.mascara_e_ponto || '').trim();
      const project = String(m.com_mascara || m.projeto || '').trim();
      // Extract ponto from mascara_e_ponto: "B-1112835_P1" -> "P1"
      const pontoIdx = keyObraPonto.indexOf('_');
      const ponto = pontoIdx >= 0 ? keyObraPonto.substring(pontoIdx + 1) : String(m.ponto_obra || '').trim();
      const code = String(m.codigo || '').trim();
      const desc = String(m.descricao || '').trim();
      const isItemPoste = isPoste({ codigo: code, descricao: desc });

      const isProgrammedKey = scheduledKeys.has(keyObraPonto);
      const shouldInclude = modo === 'MENSAL' ? true : isProgrammedKey;

      if (!shouldInclude) return;

      if (isItemPoste) {
        chavesEncontradasNoOrcamento.add(keyObraPonto);
      }

      let qty = converterParaNumero(m.quantidade);
      if (isItemPoste && modo === 'DIARIO') {
        qty = scheduledKeys.get(keyObraPonto) || 0;
      }

      // Aggregate Bloco 1 (Period Materials)
      const keyB1 = `${code}_${desc}`;
      const gp = regrasMaterialMap.get(code)?.grupo_padrao ? String(regrasMaterialMap.get(code).grupo_padrao).toUpperCase().trim() : '';
      const isStructure = gp === 'ESTRUTURA';
      const includeB1 = somentePostes ? (isItemPoste || isStructure) : true;
      if (includeB1) {
        if (!bloco1ItemsMap.has(keyB1)) {
          bloco1ItemsMap.set(keyB1, {
            codigo: code,
            descricao: desc,
            unidade: String(m.unidade || 'UN'),
            quantidade: 0
          });
        }
        bloco1ItemsMap.get(keyB1)!.quantidade += qty;
      }

      // Aggregate Bloco 2 (Concrete Deliveries) - Postes only!
      if (isItemPoste && qty > 0) {
        const typeKey = desc;
        if (!bloco2Groups.has(typeKey)) {
          bloco2Groups.set(typeKey, new Map<string, DeliveryItem>());
        }

        const details = obraDetails.get(project) || {
          primeiraData: carteiraMap.get(project)?.dataInicio ? format(carteiraMap.get(project).dataInicio, 'dd/MM/yyyy') : '',
          supervisor: carteiraMap.get(project)?.supervisor || 'SEM SUPERVISOR',
          municipio: m.municipio || carteiraMap.get(project)?.municipio || 'SEM MUNICIPIO',
          points: new Set<string>()
        };

        if (modo === 'MENSAL') {
          details.points.add(ponto);
        }

        const projectMap = bloco2Groups.get(typeKey)!;
        if (!projectMap.has(project)) {
          projectMap.set(project, {
            obra: project,
            pontos: new Set([ponto]),
            municipio: details.municipio,
            data: details.primeiraData,
            quantidade: 0,
            supervisor: details.supervisor,
            latitude: carteiraMap.get(project)?.latitude || null,
            longitude: carteiraMap.get(project)?.longitude || null
          });
        }

        const item = projectMap.get(project)!;
        item.quantidade += qty;
        item.pontos.add(ponto);
      }
    });

    // 2. Build final structures

    // Bloco 1: Period Materials (With the new Sem Orçamento column matched)
    const bloco1: any[] = [];
    bloco1ItemsMap.forEach((val, key) => {
      const code = val.codigo;
      
      // Encontrar quais obras programadas no período não possuem este material no orçamento
      const projectsWithMaterial = new Set<string>();
      budgetRaw.forEach((bm: any) => {
        if (String(bm.codigo).trim() === code && converterParaNumero(bm.quantidade) > 0) {
          projectsWithMaterial.add(String(bm.com_mascara || bm.projeto).trim());
        }
      });
      
      const semOrcamentoList = Array.from(obraDetails.keys())
        .filter(p => !projectsWithMaterial.has(p))
        .sort();

      // Calcular o total entregue para este código de material nas obras ativas no período
      let entregueTotal = 0;
      Array.from(obraDetails.keys()).forEach(project => {
        const keyMap = `${project.toUpperCase()}_${code}`;
        entregueTotal += entregueMap.get(keyMap) || 0;
      });

      const previsto = val.quantidade;
      const saldo = previsto - entregueTotal;

      bloco1.push({
        ...val,
        previsto,
        entregue: entregueTotal,
        saldo,
        semOrcamento: semOrcamentoList.join(', ')
      });
    });

    bloco1.sort((a, b) => a.descricao.localeCompare(b.descricao, 'pt-BR'));

    // Bloco 2: Concrete Deliveries
    interface FinalGroupedDelivery {
      poleType: string;
      deliveries: {
        obra: string;
        pontosString: string;
        municipio: string;
        data: string;
        quantidade: number;
        supervisor: string;
        localizacao: string;
        latitude: number | null;
        longitude: number | null;
        previsto: number;
        entregue: number;
        saldo: number;
      }[];
      totalQuantity: number;
      totalPrevisto: number;
      totalEntregue: number;
      totalSaldo: number;
    }
    const bloco2: FinalGroupedDelivery[] = [];
    bloco2Groups.forEach((projMap, poleType) => {
      const deliveriesList = Array.from(projMap.values()).map(d => {
        // Encontrar o orçamento deste poste nesta obra
        const projBudget = budgetRaw.filter((bm: any) => 
          String(bm.com_mascara || bm.projeto).trim() === d.obra && 
          String(bm.descricao).trim() === poleType
        );
        const previsto = projBudget.reduce((acc, curr) => acc + converterParaNumero(curr.quantidade), 0);

        // Encontrar as entregas deste poste nesta obra
        const codes = Array.from(new Set(projBudget.map((bm: any) => String(bm.codigo).trim())));
        let entregue = 0;
        codes.forEach(code => {
          const keyMap = `${d.obra.toUpperCase()}_${code}`;
          entregue += entregueMap.get(keyMap) || 0;
        });

        const saldo = previsto - entregue;

        return {
          obra: d.obra,
          pontosString: modo === 'MENSAL' ? '-' : Array.from(d.pontos).sort().join(', '),
          municipio: d.municipio,
          data: d.data,
          quantidade: d.quantidade,
          supervisor: d.supervisor,
          localizacao: d.latitude && d.longitude ? `${d.latitude}, ${d.longitude}` : '',
          latitude: d.latitude,
          longitude: d.longitude,
          previsto,
          entregue,
          saldo
        };
      });

      deliveriesList.sort((a, b) => {
        try {
          const dA = parse(a.data, 'dd/MM/yyyy', new Date());
          const dB = parse(b.data, 'dd/MM/yyyy', new Date());
          if (dA.getTime() !== dB.getTime()) return dA.getTime() - dB.getTime();
        } catch (e) {}
        return a.obra.localeCompare(b.obra);
      });

      const totalQty = deliveriesList.reduce((acc, curr) => acc + curr.quantidade, 0);
      const totalPrevisto = deliveriesList.reduce((acc, curr) => acc + curr.previsto, 0);
      const totalEntregue = deliveriesList.reduce((acc, curr) => acc + curr.entregue, 0);
      const totalSaldo = totalPrevisto - totalEntregue;

      bloco2.push({
        poleType,
        deliveries: deliveriesList,
        totalQuantity: totalQty,
        totalPrevisto,
        totalEntregue,
        totalSaldo
      });
    });

    bloco2.sort((a, b) => a.poleType.localeCompare(b.poleType, 'pt-BR'));

    // Bloco 3: Postes por Obra (Flattened Bloco 2)
    interface FlattenedPosteObra {
      municipio: string;
      obra: string;
      item: string;
      quantidade: number;
      supervisor: string;
      localizacao: string;
      latitude: number | null;
      longitude: number | null;
      previsto: number;
      entregue: number;
      saldo: number;
    }
    const bloco3: FlattenedPosteObra[] = [];
    bloco2.forEach(group => {
      group.deliveries.forEach(del => {
        bloco3.push({
          municipio: del.municipio,
          obra: del.obra,
          item: group.poleType,
          quantidade: del.quantidade,
          supervisor: del.supervisor,
          localizacao: del.localizacao,
          latitude: del.latitude,
          longitude: del.longitude,
          previsto: del.previsto,
          entregue: del.entregue,
          saldo: del.saldo
        });
      });
    });

    bloco3.sort((a, b) => {
      if (a.municipio !== b.municipio) return a.municipio.localeCompare(b.municipio);
      if (a.obra !== b.obra) return a.obra.localeCompare(b.obra);
      return a.item.localeCompare(b.item);
    });

    // Bloco 4: Pendências (only in DIÁRIO mode)
    interface PendencyItem {
      data: string;
      obra: string;
      ponto: string;
      quantidade: number;
      statusText: string;
    }
    const bloco4: PendencyItem[] = [];
    
    if (modo === 'DIARIO') {
      scheduledKeys.forEach((programmedQty, keyObraPonto) => {
        if (!chavesEncontradasNoOrcamento.has(keyObraPonto)) {
          const parts = keyObraPonto.split('_');
          const project = parts[0];
          const ponto = parts[1];
          const details = obraDetails.get(project);
          
          bloco4.push({
            data: details?.primeiraData || '',
            obra: project,
            ponto,
            quantidade: programmedQty,
            statusText: 'Poste não encontrado no Orçamento'
          });
        }
      });

      bloco4.sort((a, b) => {
        try {
          const dA = parse(a.data, 'dd/MM/yyyy', new Date());
          const dB = parse(b.data, 'dd/MM/yyyy', new Date());
          if (dA.getTime() !== dB.getTime()) return dA.getTime() - dB.getTime();
        } catch (e) {}
        if (a.obra !== b.obra) return a.obra.localeCompare(b.obra);
        return a.ponto.localeCompare(b.ponto);
      });
    }

    return {
      bloco1,
      bloco2,
      bloco3,
      bloco4
    };
  }, [budgetQuery.data, scheduledData, modo, somentePostes, entregueMap]);

  const obrasSemPreFechamento = useMemo(() => {
    const existing = new Set<string>(budgetQuery.data?.existingProjects || []);

    const list: { obra: string; municipio: string; supervisor: string }[] = [];
    scheduledData.projectsList.forEach(p => {
      if (p.toUpperCase().startsWith('B-') && !existing.has(p)) {
        const details = scheduledData.obraDetailsMap.get(p);
        list.push({
          obra: p,
          municipio: details?.municipio || 'N/A',
          supervisor: details?.supervisor || 'N/A'
        });
      }
    });

    return list.sort((a, b) => a.obra.localeCompare(b.obra));
  }, [scheduledData.projectsList, budgetQuery.data, scheduledData.obraDetailsMap]);

  // 8. DERIVE FILTER OPTIONS FOR CROSS SELECTS (Matching materials layout FilterSelect)
  const filterOptions = useMemo(() => {
    const municipios = new Set<string>();
    const obras = new Set<string>();
    const supervisores = new Set<string>();
    const types = new Set<string>();

    processedBlocks.bloco3.forEach(item => {
      if (item.municipio) municipios.add(item.municipio);
      if (item.obra) obras.add(item.obra);
      if (item.supervisor) supervisores.add(item.supervisor);
      if (item.item) types.add(item.item);
    });

    return {
      municipios: Array.from(municipios).sort(),
      obras: Array.from(obras).sort(),
      supervisores: Array.from(supervisores).sort(),
      types: Array.from(types).sort()
    };
  }, [processedBlocks.bloco3]);

  // Apply filters to Bloco 3
  const filteredBloco3 = useMemo(() => {
    return processedBlocks.bloco3.filter(item => {
      if (selectedMunicipios.length > 0 && !selectedMunicipios.includes(item.municipio)) return false;
      if (selectedObras.length > 0 && !selectedObras.includes(item.obra)) return false;
      if (selectedSupervisores.length > 0 && !selectedSupervisores.includes(item.supervisor)) return false;
      if (selectedPostesTypes.length > 0 && !selectedPostesTypes.includes(item.item)) return false;
      return true;
    });
  }, [processedBlocks.bloco3, selectedMunicipios, selectedObras, selectedSupervisores, selectedPostesTypes]);

  // Apply text search to Bloco 1
  const filteredBloco1 = useMemo(() => {
    const query = searchMaterial.trim().toLowerCase();
    if (!query) return processedBlocks.bloco1;
    return processedBlocks.bloco1.filter(item => 
      item.codigo.includes(query) || item.descricao.toLowerCase().includes(query)
    );
  }, [processedBlocks.bloco1, searchMaterial]);

  // 9. EXPORTS IMPLEMENTATION
  const handleExportCSV = (blockNum: number) => {
    let csvData: any[] = [];
    let filename = '';

    if (blockNum === 1) {
      csvData = filteredBloco1.map(item => ({
        'Código': item.codigo,
        'Descrição': item.descricao,
        'Unidade': item.unidade,
        'Previsto': item.previsto,
        'Entregue': item.entregue,
        'Saldo': item.saldo,
        'Sem Orçamento': item.semOrcamento
      }));
      filename = `envios_materiais_periodo_${filterStart}_${filterEnd}.csv`;
    } 
    else if (blockNum === 2) {
      processedBlocks.bloco2.forEach(group => {
        group.deliveries.forEach(del => {
          csvData.push({
            'Tipo de Poste': group.poleType,
            'Obra': del.obra,
            'Pontos': del.pontosString,
            'Município': del.municipio,
            'Data Prevista': del.data,
            'Previsto': del.previsto,
            'Entregue': del.entregue,
            'Saldo': del.saldo,
            'Supervisor': del.supervisor,
            'Coordenadas': del.localizacao
          });
        });
      });
      filename = `envios_entregas_concretos_${filterStart}_${filterEnd}.csv`;
    } 
    else if (blockNum === 3) {
      csvData = filteredBloco3.map(item => ({
        'Município': item.municipio,
        'Obra': item.obra,
        'Poste': item.item,
        'Previsto': item.previsto,
        'Entregue': item.entregue,
        'Saldo': item.saldo,
        'Supervisor': item.supervisor,
        'Localização': item.localizacao
      }));
      filename = `envios_postes_por_obra_${filterStart}_${filterEnd}.csv`;
    } 
    else if (blockNum === 4) {
      csvData = processedBlocks.bloco4.map(item => ({
        'Data': item.data,
        'Obra': item.obra,
        'Ponto': item.ponto,
        'Quantidade': item.quantidade,
        'Observação': item.statusText
      }));
      filename = `envios_pendencias_${filterStart}_${filterEnd}.csv`;
    }

    if (csvData.length === 0) {
      toast.warning('Não há dados para exportar.');
      return;
    }

    const csvText = Papa.unparse(csvData, { delimiter: ';' });
    const blob = new Blob(['\uFEFF' + csvText], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, filename);
    toast.success('CSV exportado com sucesso!');
  };

  const handleExportPDF = (blockNum: number, title: string) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Bloqueador de pop-ups ativo. Permita pop-ups para exportar PDF.');
      return;
    }

    let tableHTML = '';
    const dateRange = `Período: ${filterStart ? format(parse(filterStart, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy') : ''} a ${filterEnd ? format(parse(filterEnd, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy') : ''}`;
    const modeLabel = `Modo: ${modo === 'DIARIO' ? 'Diário' : 'Mensal'}`;

    if (blockNum === 1) {
      tableHTML = `
        <table>
          <thead>
            <tr>
              <th style="width: 10%">Código</th>
              <th style="width: 40%">Descrição</th>
              <th style="width: 8%">Unidade</th>
              <th style="width: 10%; text-align: right">Previsto</th>
              <th style="width: 10%; text-align: right">Entregue</th>
              <th style="width: 10%; text-align: right">Saldo</th>
              <th style="width: 12%">Sem Orçamento</th>
            </tr>
          </thead>
          <tbody>
            ${filteredBloco1.map(item => `
              <tr>
                <td>${item.codigo}</td>
                <td>${item.descricao}</td>
                <td>${item.unidade}</td>
                <td style="text-align: right; font-weight: bold">${formatQtd(item.previsto)}</td>
                <td style="text-align: right; font-weight: bold; color: #1d4ed8;">${formatQtd(item.entregue)}</td>
                <td style="text-align: right; font-weight: bold; color: ${item.saldo < 0 ? '#b91c1c' : item.saldo === 0 ? '#16a34a' : '#1f2937'};">${formatQtd(item.saldo)}</td>
                <td style="color: #b91c1c; font-weight: 500">${item.semOrcamento || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } 
    else if (blockNum === 2) {
      tableHTML = processedBlocks.bloco2.map(group => `
        <h3 style="margin-top: 15px; font-size: 10px; border-bottom: 1.5px solid #1e3a8a; padding-bottom: 2px; color: #1e3a8a;">
          ${group.poleType} 
          <span style="float: right; color: #1e40af;">
            Prev: ${formatQtd(group.totalPrevisto)} | Entr: ${formatQtd(group.totalEntregue)} | Saldo: ${formatQtd(group.totalSaldo)}
          </span>
        </h3>
        <table>
          <thead>
            <tr>
              <th style="width: 12%">Obra</th>
              <th style="width: 20%">Pontos</th>
              <th style="width: 15%">Município</th>
              <th style="width: 12%">Data Prev.</th>
              <th style="width: 8%; text-align: right">Prev.</th>
              <th style="width: 8%; text-align: right">Entr.</th>
              <th style="width: 8%; text-align: right">Saldo</th>
              <th style="width: 12%">Supervisor</th>
              <th style="width: 10%">Localização</th>
            </tr>
          </thead>
          <tbody>
            ${group.deliveries.map(del => `
              <tr>
                <td style="font-weight: bold">${del.obra}</td>
                <td>${del.pontosString}</td>
                <td>${del.municipio}</td>
                <td>${del.data}</td>
                <td style="text-align: right; font-weight: bold">${formatQtd(del.previsto)}</td>
                <td style="text-align: right; font-weight: bold; color: #1d4ed8;">${formatQtd(del.entregue)}</td>
                <td style="text-align: right; font-weight: bold; color: ${del.saldo < 0 ? '#b91c1c' : del.saldo === 0 ? '#16a34a' : '#1f2937'};">${formatQtd(del.saldo)}</td>
                <td>${del.supervisor}</td>
                <td>${del.localizacao || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `).join('');
    } 
    else if (blockNum === 3) {
      tableHTML = `
        <table>
          <thead>
            <tr>
              <th style="width: 15%">Município</th>
              <th style="width: 12%">Obra</th>
              <th style="width: 35%">Poste</th>
              <th style="width: 8%; text-align: right">Prev.</th>
              <th style="width: 8%; text-align: right">Entr.</th>
              <th style="width: 8%; text-align: right">Saldo</th>
              <th style="width: 15%">Supervisor</th>
              <th style="width: 10%">Localização</th>
            </tr>
          </thead>
          <tbody>
            ${filteredBloco3.map(item => `
              <tr>
                <td>${item.municipio}</td>
                <td style="font-weight: bold">${item.obra}</td>
                <td>${item.item}</td>
                <td style="text-align: right; font-weight: bold">${formatQtd(item.previsto)}</td>
                <td style="text-align: right; font-weight: bold; color: #1d4ed8;">${formatQtd(item.entregue)}</td>
                <td style="text-align: right; font-weight: bold; color: ${item.saldo < 0 ? '#b91c1c' : item.saldo === 0 ? '#16a34a' : '#1f2937'};">${formatQtd(item.saldo)}</td>
                <td>${item.supervisor}</td>
                <td>${item.localizacao || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } 
    else if (blockNum === 4) {
      tableHTML = `
        <table>
          <thead>
            <tr>
              <th style="width: 15%">Data</th>
              <th style="width: 15%">Obra</th>
              <th style="width: 15%">Ponto</th>
              <th style="width: 10%; text-align: right">Quantidade</th>
              <th style="width: 45%">Observação</th>
            </tr>
          </thead>
          <tbody>
            ${processedBlocks.bloco4.map(item => `
              <tr style="background-color: #fef2f2;">
                <td>${item.data}</td>
                <td style="font-weight: bold">${item.obra}</td>
                <td>${item.ponto}</td>
                <td style="text-align: right; font-weight: bold; color: #b91c1c">${formatQtd(item.quantidade)}</td>
                <td style="color: #b91c1c; font-weight: 500">${item.statusText}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>${title}</title>
          <style>
            @page {
              size: A4 landscape;
              margin: 10mm 12mm;
            }
            body {
              font-family: 'Segoe UI', Arial, sans-serif;
              color: #1f2937;
              margin: 0;
              padding: 0;
              font-size: 8.5px;
              line-height: 1.25;
            }
            .header-print {
              border-bottom: 2px solid #1e3a8a;
              padding-bottom: 4px;
              margin-bottom: 10px;
            }
            .header-print h1 {
              font-size: 13px;
              margin: 0 0 2px 0;
              color: #1e3a8a;
              text-transform: uppercase;
            }
            .header-print .info {
              font-size: 8.5px;
              color: #4b5563;
              font-weight: 500;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 10px;
              page-break-inside: auto;
            }
            tr {
              page-break-inside: avoid;
              page-break-after: auto;
            }
            thead {
              display: table-header-group;
            }
            th {
              background-color: #f3f4f6;
              color: #111827;
              font-weight: 700;
              text-align: left;
              padding: 4px 5px;
              border-bottom: 1.5px solid #9ca3af;
              font-size: 8px;
            }
            td {
              padding: 4px 5px;
              border-bottom: 1px solid #e5e7eb;
              color: #374151;
            }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .font-bold { font-weight: bold; }
            .footer {
              position: fixed;
              bottom: 0;
              width: 100%;
              text-align: center;
              font-size: 7px;
              color: #9ca3af;
              border-top: 1px solid #e5e7eb;
              padding-top: 2px;
            }
          </style>
        </head>
        <body>
          <div class="header-print">
            <h1>${title}</h1>
            <div class="info">${dateRange} | ${modeLabel} | Gerado em: ${new Date().toLocaleString('pt-BR')}</div>
          </div>
          ${tableHTML}
          <div class="footer">Gestão CCM Routine Vista - Página 1 de 1</div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Helper: query budget detail for an expanding project
  const renderObraDetail = (projectCode: string) => {
    const budgetRaw = budgetQuery.data?.materials || [];
    const obraMaterials = budgetRaw.filter((m: any) => String(m.com_mascara || m.projeto).trim() === projectCode);

    if (obraMaterials.length === 0) {
      return <div className="text-xs text-muted-foreground p-2">Nenhum material encontrado no orçamento para esta obra.</div>;
    }

    // Group by point
    const pointsMap = new Map<string, any[]>();
    obraMaterials.forEach((m: any) => {
      const ptRaw = String(m.ponto_obra || 'Sem Ponto').trim();
      const pt = ptRaw.includes('_') ? ptRaw.split('_')[1] : ptRaw;
      if (!pointsMap.has(pt)) pointsMap.set(pt, []);
      pointsMap.get(pt)!.push(m);
    });

    return (
      <div className="bg-slate-50 dark:bg-zinc-900/40 p-3 rounded-lg border border-dashed border-slate-200 dark:border-zinc-800 mt-2 space-y-3">
        <h4 className="text-xs font-bold text-slate-700 dark:text-slate-350">Estruturas previstas por Ponto (Orçamento da Obra {projectCode})</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Array.from(pointsMap.entries()).map(([pt, mats]) => (
            <div key={pt} className="bg-white dark:bg-zinc-900 p-2.5 rounded border shadow-sm">
              <span className="text-xs font-extrabold text-blue-650 dark:text-blue-400 block mb-1">Ponto: {pt}</span>
              <table className="w-full text-[10px] table-fixed">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-zinc-800 font-bold text-slate-500">
                    <th className="text-left pb-1">Item</th>
                    <th className="text-right pb-1 w-12">Prev.</th>
                    <th className="text-right pb-1 w-12">Entr.</th>
                    <th className="text-right pb-1 w-12">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {mats.map((m, idx) => {
                    const code = String(m.codigo).trim();
                    const keyMap = `${projectCode.toUpperCase()}_${code}`;
                    const delivered = entregueMap.get(keyMap) || 0;
                    const balance = m.quantidade - delivered;
                    return (
                      <tr key={idx} className="border-b border-slate-50 dark:border-zinc-900/50 hover:bg-slate-50/50 align-top">
                        <td className="py-1 pr-2 truncate" title={m.descricao}>{m.descricao}</td>
                        <td className="py-1 text-right font-semibold text-slate-800 dark:text-slate-200">{formatQtd(m.quantidade)}</td>
                        <td className="py-1 text-right font-semibold text-blue-650 dark:text-blue-400">{formatQtd(delivered)}</td>
                        <td className={`py-1 text-right font-bold ${balance < 0 ? 'text-red-650' : balance === 0 ? 'text-green-650' : 'text-slate-700 dark:text-slate-350'}`}>
                          {formatQtd(balance)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // 10. STATISTICS / KPIS SUMMARY
  const stats = useMemo(() => {
    let totalPostes = 0;
    const uniqueTypes = new Set<string>();

    processedBlocks.bloco3.forEach(item => {
      totalPostes += item.quantidade;
      uniqueTypes.add(item.item);
    });

    return {
      totalPostes,
      obrasCount: scheduledData.projectsList.length,
      typesCount: uniqueTypes.size,
      pendenciesCount: processedBlocks.bloco4.length,
      obrasSemPontosCount: scheduledData.obrasSemPontosValidos.length
    };
  }, [processedBlocks, scheduledData]);

  const isLoading = rawQuery.isLoading || budgetQuery.isLoading || rulesQuery.isLoading;
  const isError = rawQuery.isError || budgetQuery.isError || rulesQuery.isError;

  // JSX variables for the three columns to avoid code duplication in the responsive layout
  const leftColumnContent = (
    <div className="flex flex-col gap-4 w-full h-full">
      {/* CARD: MATERIAIS PARA O PERÍODO */}
      <Card className="border-slate-200 dark:border-zinc-800 shadow-md">
        <CardHeader className="flex flex-row items-center justify-between border-b pb-2 gap-2 bg-slate-50/50 dark:bg-zinc-900/50 px-3 py-2.5">
          <div className="truncate">
            <CardTitle className="text-[11px] font-extrabold uppercase tracking-wider flex items-center gap-1 text-slate-800 dark:text-slate-100">
              <ClipboardList className="h-3.5 w-3.5 text-indigo-650" /> Materiais para o Período
            </CardTitle>
          </div>
          <div className="flex items-center gap-1 shrink-0 no-print">
            <Button variant="outline" size="xs" className="h-6 text-[9.5px] px-1.5 font-semibold gap-0.5" onClick={() => handleExportCSV(1)}>
              <Download className="w-2.5 h-2.5" /> CSV
            </Button>
            <Button variant="outline" size="xs" className="h-6 text-[9.5px] px-1.5 font-semibold gap-0.5" onClick={() => handleExportPDF(1, 'Materiais do Período')}>
              <Printer className="w-2.5 h-2.5" /> PDF
            </Button>
          </div>
        </CardHeader>
        
        {/* Search Bar inside Block 1 Card */}
        <div className="p-2 border-b bg-slate-50/10 no-print">
          <div className="relative">
            <Search className="absolute left-2 top-2 h-3 w-3 text-slate-400" />
            <Input
              placeholder="Pesquisar material..."
              className="pl-6 h-7 text-[11px] w-full bg-background border"
              value={searchMaterial}
              onChange={(e) => setSearchMaterial(e.target.value)}
            />
          </div>
        </div>

        <CardContent className="p-0">
          {filteredBloco1.length === 0 ? (
            <div className="text-center p-6 text-muted-foreground text-[11px]">Nenhum material encontrado.</div>
          ) : (
            <div className="overflow-auto h-[450px] min-h-[250px] max-h-[800px] resize-y relative bg-white dark:bg-zinc-950 pb-2 border rounded-b-lg">
              <table className="w-full text-[10.5px] table-fixed">
                <thead className="bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-slate-200 font-bold border-b sticky top-0 z-10 shadow-[0_1px_0_0_rgba(229,231,235,1)]">
                  <tr>
                    <th className="px-2 py-1.5 w-16 text-left">Código</th>
                    <th className="px-2 py-1.5 text-left">Item</th>
                    <th className="px-2 py-1.5 text-right w-14">Prev.</th>
                    <th className="px-2 py-1.5 text-right w-14">Entr.</th>
                    <th className="px-2 py-1.5 text-right w-14">Saldo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dashed divide-slate-200 dark:divide-zinc-800">
                  {filteredBloco1.map((item, idx) => {
                    const balance = item.saldo;
                    return (
                      <tr key={idx} className="hover:bg-slate-50/20 dark:hover:bg-zinc-900/5 align-top">
                        <td className="px-2 py-1.5 font-mono text-[10px] text-slate-550 truncate" title={item.codigo}>{item.codigo}</td>
                        <td className="px-2 py-1.5 font-semibold text-slate-750 dark:text-slate-350 leading-tight truncate" title={item.descricao}>
                          {item.descricao}
                        </td>
                        <td className="px-2 py-1.5 text-right font-semibold text-slate-800 dark:text-slate-100 text-[11px] truncate">
                          {formatQtd(item.previsto)}
                        </td>
                        <td className="px-2 py-1.5 text-right font-semibold text-blue-650 dark:text-blue-400 text-[11px] truncate">
                          {formatQtd(item.entregue)}
                        </td>
                        <td className={`px-2 py-1.5 text-right font-black text-[11px] truncate ${balance < 0 ? 'text-red-650' : balance === 0 ? 'text-green-650' : 'text-slate-800 dark:text-slate-100'}`}>
                          {formatQtd(balance)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* CARD: OBRAS SEM PRÉ-FECHAMENTO */}
      <Card className="border-slate-200 dark:border-zinc-800 shadow-md">
        <CardHeader className="flex flex-row items-center justify-between border-b pb-2 gap-2 bg-red-50/5 dark:bg-red-950/5 px-3 py-2.5">
          <div className="truncate">
            <CardTitle className="text-[11px] font-extrabold uppercase tracking-wider flex items-center gap-1.5 text-red-900 dark:text-red-300">
              <AlertTriangle className="h-3.5 w-3.5 text-red-650" /> Obras sem Pré-Fechamento
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {obrasSemPreFechamento.length === 0 ? (
            <div className="text-center p-6 text-green-600 dark:text-green-500 text-[11px] font-semibold">
              Todas as obras estão na base de materiais.
            </div>
          ) : (
            <div className="overflow-auto h-[250px] min-h-[150px] max-h-[600px] resize-y relative bg-white dark:bg-zinc-950 pb-2 border rounded-b-lg">
              <table className="w-full text-[10.5px] table-fixed">
                <thead className="bg-red-50/20 text-red-950 font-bold border-b border-red-150 sticky top-0 z-10">
                  <tr>
                    <th className="px-2 py-1.5 text-left w-24">Obra</th>
                    <th className="px-2 py-1.5 text-left w-32">Município</th>
                    <th className="px-2 py-1.5 text-left">Supervisor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dashed divide-red-100 bg-red-50/5">
                  {obrasSemPreFechamento.map((item, idx) => (
                    <tr key={idx} className="hover:bg-red-50/20 align-middle">
                      <td className="px-2 py-1.5 font-bold text-red-700 dark:text-red-400 truncate" title={item.obra}>{item.obra}</td>
                      <td className="px-2 py-1.5 text-slate-650 dark:text-slate-450 truncate" title={item.municipio}>{item.municipio}</td>
                      <td className="px-2 py-1.5 text-slate-650 dark:text-slate-450 truncate" title={item.supervisor}>{item.supervisor}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const middleColumnContent = (
    <Card className="border-slate-200 dark:border-zinc-800 shadow-md w-full h-full">
      <CardHeader className="flex flex-row items-center justify-between border-b pb-2 gap-2 bg-slate-50/50 dark:bg-zinc-900/50 px-3 py-2.5">
        <div>
          <CardTitle className="text-[11px] font-extrabold uppercase tracking-wider flex items-center gap-1.5 text-slate-800 dark:text-slate-100">
            <Truck className="h-3.5 w-3.5 text-indigo-650" /> Entregas de Concretos
          </CardTitle>
        </div>
        <div className="flex items-center gap-1 shrink-0 no-print">
          <Button variant="outline" size="xs" className="h-6 text-[9.5px] px-1.5 font-semibold gap-0.5" onClick={() => handleExportCSV(2)}>
            <Download className="w-2.5 h-2.5" /> CSV
          </Button>
          <Button variant="outline" size="xs" className="h-6 text-[9.5px] px-1.5 font-semibold gap-0.5" onClick={() => handleExportPDF(2, 'Entregas de Concretos')}>
            <Printer className="w-2.5 h-2.5" /> PDF
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {processedBlocks.bloco2.length === 0 ? (
          <div className="text-center p-8 text-muted-foreground text-[11px]">Nenhuma entrega de postes projetada.</div>
        ) : (
          <div className="overflow-auto h-[600px] min-h-[300px] max-h-[1000px] resize-y relative bg-white dark:bg-zinc-950 pb-2 border rounded-b-lg">
            <div className="divide-y divide-slate-100 dark:divide-zinc-800">
              {processedBlocks.bloco2.map(group => {
                const isExpanded = expandedPostes[group.poleType] !== false; // Default expanded!
                return (
                  <div key={group.poleType} className="flex flex-col">
                    
                    {/* Group Accordion Header (Looks like the Excel Group Titles) */}
                    <button
                      onClick={() => setExpandedPostes(prev => ({ ...prev, [group.poleType]: !isExpanded }))}
                      className="w-full flex items-center justify-between px-3 py-1.5 bg-slate-150 dark:bg-zinc-850 hover:bg-slate-200 dark:hover:bg-zinc-800 transition-colors text-left border-y border-slate-350 dark:border-zinc-700"
                    >
                      <div className="flex items-center gap-1.5 pr-3">
                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
                        <span className="font-extrabold text-[10px] text-slate-800 dark:text-slate-200 uppercase tracking-wider">{group.poleType}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[9.5px] text-slate-800 dark:text-slate-300 font-extrabold bg-slate-50 dark:bg-zinc-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-zinc-700">
                          Prev: {formatQtd(group.totalPrevisto)}
                        </span>
                        <span className="text-[9.5px] text-blue-800 dark:text-blue-300 font-extrabold bg-blue-50 dark:bg-blue-950/20 px-1.5 py-0.5 rounded border border-blue-150">
                          Entr: {formatQtd(group.totalEntregue)}
                        </span>
                        <span className={`text-[9.5px] font-black px-1.5 py-0.5 rounded border ${group.totalSaldo < 0 ? 'bg-red-50 text-red-800 border-red-150 dark:bg-red-950/20 dark:text-red-300' : group.totalSaldo === 0 ? 'bg-green-50 text-green-800 border-green-150 dark:bg-green-950/20 dark:text-green-300' : 'bg-slate-50 text-slate-800 border-slate-200 dark:bg-zinc-800 dark:text-slate-350'}`}>
                          Saldo: {formatQtd(group.totalSaldo)}
                        </span>
                      </div>
                    </button>
    
                    {/* Group Deliveries Table */}
                    {isExpanded && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-[10px] table-fixed">
                          <thead className="bg-slate-800 text-white dark:bg-zinc-900 dark:text-slate-200 font-bold border-b">
                            <tr>
                              <th className="px-2 py-1.5 text-left w-24">Obra</th>
                              <th className="px-2 py-1.5 text-left w-32">Pontos</th>
                              <th className="px-2 py-1.5 text-left w-24">Município</th>
                              <th className="px-2 py-1.5 text-left w-20">Data Prev.</th>
                              <th className="px-2 py-1.5 text-right w-12">Prev.</th>
                              <th className="px-2 py-1.5 text-right w-12">Entr.</th>
                              <th className="px-2 py-1.5 text-right w-12">Saldo</th>
                              <th className="px-2 py-1.5 text-left w-28">Supervisor</th>
                              <th className="px-2 py-1.5 text-center w-20">Localização</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-dashed divide-slate-200 dark:divide-zinc-800">
                            {group.deliveries.map(del => {
                              const isObraDetailExpanded = expandedObrasDetail[del.obra];
                              return (
                                <React.Fragment key={del.obra}>
                                  <tr className="hover:bg-slate-50/20 dark:hover:bg-zinc-900/5 align-middle">
                                    <td className="px-2 py-1.5 font-semibold text-[10.5px] truncate">
                                      <button 
                                        onClick={() => setExpandedObrasDetail(prev => ({ ...prev, [del.obra]: !isObraDetailExpanded }))}
                                        className="hover:underline flex items-center gap-0.5 text-left text-blue-655 dark:text-blue-400 w-full truncate"
                                      >
                                        {isObraDetailExpanded ? <ChevronDown className="w-2.5 h-2.5 shrink-0" /> : <ChevronRight className="w-2.5 h-2.5 shrink-0" />}
                                        <span className="truncate">{del.obra}</span>
                                      </button>
                                    </td>
                                    <td className="px-2 py-1.5 text-slate-600 dark:text-slate-450 font-mono truncate" title={del.pontosString}>{del.pontosString}</td>
                                    <td className="px-2 py-1.5 text-slate-655 dark:text-slate-400 truncate" title={del.municipio}>{del.municipio}</td>
                                    <td className="px-2 py-1.5 font-semibold text-slate-650 dark:text-slate-450 truncate">{del.data}</td>
                                    <td className="px-2 py-1.5 text-right font-semibold text-slate-800 dark:text-slate-100 truncate">{formatQtd(del.previsto)}</td>
                                    <td className="px-2 py-1.5 text-right font-semibold text-blue-650 dark:text-blue-400 truncate">{formatQtd(del.entregue)}</td>
                                    <td className={`px-2 py-1.5 text-right font-black truncate ${del.saldo < 0 ? 'text-red-650' : del.saldo === 0 ? 'text-green-650' : 'text-slate-800 dark:text-slate-100'}`}>{formatQtd(del.saldo)}</td>
                                    <td className="px-2 py-1.5 text-slate-655 dark:text-slate-450 truncate" title={del.supervisor}>{del.supervisor}</td>
                                    <td className="px-2 py-1.5 text-center">
                                      {del.latitude && del.longitude ? (
                                        <a
                                          href={`https://maps.google.com/?q=${del.latitude},${del.longitude}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center justify-center gap-0.5 text-blue-600 hover:underline bg-blue-50/50 dark:bg-blue-950/10 px-1 py-0.5 rounded text-[9px] font-bold w-full truncate"
                                        >
                                          <MapPin className="w-2.5 h-2.5 shrink-0" style={{ width: '10px', height: '10px' }} /> Mapa
                                        </a>
                                      ) : (
                                        <span className="text-slate-400 dark:text-slate-600 text-[9px]">-</span>
                                      )}
                                    </td>
                                  </tr>
                                  {isObraDetailExpanded && (
                                    <tr>
                                      <td colSpan={9} className="px-2 py-1 bg-slate-50/10">
                                        {renderObraDetail(del.obra)}
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const rightColumnContent = (
    <Card className="border-slate-200 dark:border-zinc-800 shadow-md w-full h-full">
      <CardHeader className="flex flex-row items-center justify-between border-b pb-2 gap-2 bg-slate-50/50 dark:bg-zinc-900/50 px-3 py-2.5">
        <div>
          <CardTitle className="text-[11px] font-extrabold uppercase tracking-wider flex items-center gap-1.5 text-slate-800 dark:text-slate-100">
            <MapIcon className="h-3.5 w-3.5 text-indigo-650" /> Postes por Obra
          </CardTitle>
        </div>
        <div className="flex items-center gap-1 shrink-0 no-print">
          <Button variant="outline" size="xs" className="h-6 text-[9.5px] px-1.5 font-semibold gap-0.5" onClick={() => handleExportCSV(3)}>
            <Download className="w-2.5 h-2.5" /> CSV
          </Button>
          <Button variant="outline" size="xs" className="h-6 text-[9.5px] px-1.5 font-semibold gap-0.5" onClick={() => handleExportPDF(3, 'Postes por Obra')}>
            <Printer className="w-2.5 h-2.5" /> PDF
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {filteredBloco3.length === 0 ? (
          <div className="text-center p-6 text-muted-foreground text-[11px]">Nenhum registro para exibir.</div>
        ) : (
          <div className="overflow-auto h-[600px] min-h-[300px] max-h-[1000px] resize-y relative bg-white dark:bg-zinc-950 pb-2 border rounded-b-lg">
            <table className="w-full text-[10.5px] table-fixed">
              <thead className="bg-slate-700 text-white dark:bg-zinc-855 dark:text-slate-200 font-bold border-b sticky top-0 z-10 shadow-[0_1px_0_0_rgba(229,231,235,1)]">
                <tr>
                  <th className="px-2 py-1.5 text-left w-24">Município</th>
                  <th className="px-2 py-1.5 text-left w-24">Obra</th>
                  <th className="px-2 py-1.5 text-left">Item</th>
                  <th className="px-2 py-1.5 text-right w-12">Prev.</th>
                  <th className="px-2 py-1.5 text-right w-12">Entr.</th>
                  <th className="px-2 py-1.5 text-right w-12">Saldo</th>
                  <th className="px-2 py-1.5 text-center w-24">Localização</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dashed divide-slate-200 dark:divide-zinc-800">
                {filteredBloco3.map((item, idx) => {
                  const balance = item.saldo;
                  return (
                    <tr key={idx} className="hover:bg-slate-50/20 dark:hover:bg-zinc-900/5 align-middle">
                      <td className="px-2 py-1.5 text-slate-655 dark:text-slate-450 truncate" title={item.municipio}>{item.municipio}</td>
                      <td className="px-2 py-1.5 font-semibold text-slate-700 dark:text-slate-350 truncate">{item.obra}</td>
                      <td className="px-2 py-1.5 font-semibold text-slate-800 dark:text-slate-200 leading-tight truncate" title={item.item}>{item.item}</td>
                      <td className="px-2 py-1.5 text-right font-semibold text-slate-800 dark:text-slate-100 text-[11px] truncate">{formatQtd(item.previsto)}</td>
                      <td className="px-2 py-1.5 text-right font-semibold text-blue-650 dark:text-blue-400 text-[11px] truncate">{formatQtd(item.entregue)}</td>
                      <td className={`px-2 py-1.5 text-right font-black text-[11px] truncate ${balance < 0 ? 'text-red-650' : balance === 0 ? 'text-green-650' : 'text-slate-850 dark:text-slate-100'}`}>{formatQtd(balance)}</td>
                      <td className="px-2 py-1.5 text-center">
                        {item.latitude && item.longitude ? (
                          <a
                            href={`https://maps.google.com/?q=${item.latitude},${item.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-0.5 text-blue-655 hover:underline font-bold text-[9px] w-full truncate"
                          >
                            <MapPin className="w-2.5 h-2.5 shrink-0" style={{ width: '10px', height: '10px' }} /> Ver Mapa
                          </a>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-600 text-[9px]">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="flex flex-col gap-6 w-full pb-10">
      
      {/* INTEGRATED APP HEADER ROW (Matching materials view header) */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Truck className="h-5 w-5 text-indigo-650" />
            Envios (Postes e Concretos)
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-1.5">
            <span>Projeção e cruzamento logístico da carteira e programações diárias.</span>
            {rawQuery.data?.[0]?.lastUpdated && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1 text-[10.5px]">
                  <RefreshCw className="w-3 h-3 text-muted-foreground" /> Sincronizado em: {format(new Date(rawQuery.data[0].lastUpdated), 'dd/MM/yyyy HH:mm')}
                </span>
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 no-print">
          {/* Settings Button */}
          <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs font-semibold gap-1.5">
                <Settings className="w-4 h-4 text-slate-500" /> Configurar Filtros
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Parametrização da Seção Envios</DialogTitle>
                <DialogDescription>Ajuste os serviços, supervisores e status válidos para o cálculo da projeção local.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Serviços que caracterizam Instalação de Poste (um por linha)</Label>
                  <textarea
                    className="w-full h-24 text-xs p-2 border rounded-md font-mono outline-none focus:ring-1 focus:ring-blue-500 bg-slate-50 dark:bg-zinc-900"
                    value={configTextServices}
                    onChange={(e) => setConfigTextServices(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Status Excluídos no modo Mensal (um por linha)</Label>
                  <textarea
                    className="w-full h-24 text-xs p-2 border rounded-md font-mono outline-none focus:ring-1 focus:ring-blue-500 bg-slate-50 dark:bg-zinc-900"
                    value={configTextStatuses}
                    onChange={(e) => setConfigTextStatuses(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Supervisores Válidos (um por linha)</Label>
                  <textarea
                    className="w-full h-20 text-xs p-2 border rounded-md font-mono outline-none focus:ring-1 focus:ring-blue-500 bg-slate-50 dark:bg-zinc-900"
                    value={configTextSupervisors}
                    onChange={(e) => setConfigTextSupervisors(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsConfigOpen(false)} className="text-xs">Cancelar</Button>
                <Button onClick={handleSaveConfig} className="bg-blue-600 hover:bg-blue-700 text-white text-xs">Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => syncPlanejamento()} 
            disabled={isSyncing}
            className="h-8"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* FILTER SEARCH TOOLBAR (Ultra-compact, all filters in a single row) */}
      <div className="no-print bg-slate-50/50 dark:bg-zinc-900/30 border border-slate-200 dark:border-zinc-800 rounded-lg p-2.5 flex flex-wrap items-center justify-between gap-3 w-full shadow-sm">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
          {/* Unidades select using FilterSelect */}
          <div className="w-[130px] shrink-0">
            <FilterSelect 
              label="Unidades" 
              options={UNIDADES_PLANEJAMENTO.map(u => ({ value: u.id, label: u.nome }))} 
              selectedValues={selectedUnidades} 
              onChange={setSelectedUnidades} 
            />
          </div>

          {/* Date range picker */}
          <div className="flex flex-col justify-center shrink-0">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Período</span>
            <div className="flex items-center gap-1 border border-input bg-background rounded-md h-8 px-2 focus-within:ring-1 focus-within:ring-ring">
              <Calendar className="w-3 text-muted-foreground shrink-0" style={{ width: '12px', height: '12px' }} />
              <input 
                type="date" 
                value={filterStart} 
                onChange={e => setFilterStart(e.target.value)} 
                onClick={e => { try { e.currentTarget.showPicker(); } catch (err) {} }}
                onFocus={e => { try { e.currentTarget.showPicker(); } catch (err) {} }}
                className="bg-transparent text-[11px] outline-none w-[90px] text-foreground cursor-pointer" 
                title="Data Inicial" 
              />
              <span className="text-muted-foreground text-xs shrink-0 px-0.5 font-medium">-</span>
              <input 
                type="date" 
                value={filterEnd} 
                onChange={e => setFilterEnd(e.target.value)} 
                onClick={e => { try { e.currentTarget.showPicker(); } catch (err) {} }}
                onFocus={e => { try { e.currentTarget.showPicker(); } catch (err) {} }}
                className="bg-transparent text-[11px] outline-none w-[90px] text-foreground cursor-pointer" 
                title="Data Final" 
              />
            </div>
          </div>

          {/* Projection mode toggle segment */}
          <div className="flex flex-col justify-center shrink-0">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Modo de Projeção</span>
            <div className="flex bg-slate-100 dark:bg-zinc-900 border p-0.5 rounded-lg h-8">
              <button
                onClick={() => setModo('DIARIO')}
                className={`px-3 py-0.5 rounded-md text-[11px] font-bold transition-all ${
                  modo === 'DIARIO' 
                    ? 'bg-white dark:bg-zinc-950 text-slate-800 dark:text-white shadow-sm border border-slate-200 dark:border-zinc-800' 
                    : 'text-slate-500 hover:text-slate-850 dark:text-slate-400'
                }`}
              >
                Diário
              </button>
              <button
                onClick={() => setModo('MENSAL')}
                className={`px-3 py-0.5 rounded-md text-[11px] font-bold transition-all ${
                  modo === 'MENSAL' 
                    ? 'bg-white dark:bg-zinc-950 text-slate-800 dark:text-white shadow-sm border border-slate-200 dark:border-zinc-800' 
                    : 'text-slate-500 hover:text-slate-850 dark:text-slate-400'
                }`}
              >
                Mensal
              </button>
            </div>
          </div>

          {/* Cross Select: Municipio */}
          <div className="w-[130px] shrink-0">
            <FilterSelect 
              label="Município" 
              options={filterOptions.municipios.map(m => ({ value: m, label: m }))} 
              selectedValues={selectedMunicipios} 
              onChange={setSelectedMunicipios} 
              searchable={true} 
            />
          </div>

          {/* Cross Select: Obra */}
          <div className="w-[110px] shrink-0">
            <FilterSelect 
              label="Obra" 
              options={filterOptions.obras.map(o => ({ value: o, label: o }))} 
              selectedValues={selectedObras} 
              onChange={setSelectedObras} 
              searchable={true} 
            />
          </div>

          {/* Cross Select: Supervisor */}
          <div className="w-[130px] shrink-0">
            <FilterSelect 
              label="Supervisor" 
              options={filterOptions.supervisores.map(s => ({ value: s, label: s }))} 
              selectedValues={selectedSupervisores} 
              onChange={setSelectedSupervisores} 
              searchable={true} 
            />
          </div>

          {/* Cross Select: Tipo de Poste */}
          <div className="w-[140px] shrink-0">
            <FilterSelect 
              label="Tipo de Poste" 
              options={filterOptions.types.map(t => ({ value: t, label: t }))} 
              selectedValues={selectedPostesTypes} 
              onChange={setSelectedPostesTypes} 
              searchable={true} 
            />
          </div>

          {/* Clean filters button */}
          {(selectedMunicipios.length > 0 || selectedObras.length > 0 || selectedSupervisores.length > 0 || selectedPostesTypes.length > 0) && (
            <div className="flex flex-col justify-end h-10 shrink-0">
              <Button
                variant="ghost" 
                className="text-[11px] text-red-650 hover:text-red-700 h-8 font-bold px-2 self-end mb-0.5"
                onClick={() => {
                  setSelectedMunicipios([]);
                  setSelectedObras([]);
                  setSelectedSupervisores([]);
                  setSelectedPostesTypes([]);
                }}
              >
                Limpar Filtros
              </Button>
            </div>
          )}
        </div>

        {/* Right section: Somente Postes Checkbox */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1.5 h-8">
            <Checkbox
              id="somente-postes"
              checked={somentePostes}
              onCheckedChange={(checked) => setSomentePostes(!!checked)}
            />
            <label htmlFor="somente-postes" className="text-[11px] font-bold text-slate-700 dark:text-slate-350 cursor-pointer select-none">
              Postes e Estruturas (Bloco 1)
            </label>
          </div>
        </div>
      </div>

      {/* ERROR OR LOADING STATE (Matching materials style) */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-indigo-600" />
          <p className="text-muted-foreground animate-pulse text-sm font-semibold">Processando projeções logísticas e cruzando orçamentos...</p>
        </div>
      ) : isError ? (
        <Card className="border-red-200 bg-red-50/20 shadow-md">
          <CardContent className="flex flex-col items-center justify-center p-12 gap-4 text-center">
            <AlertCircle className="w-10 h-10 text-red-600" />
            <div>
              <h3 className="font-extrabold text-red-800 text-sm mb-1">Erro de Conexão</h3>
              <p className="text-xs text-red-600">Não foi possível carregar os dados de materiais da tabela Supabase. Tente novamente mais tarde.</p>
              {rawQuery.error && <p className="text-[10px] text-red-500 mt-2 font-mono">rawQuery: {rawQuery.error.message}</p>}
              {rulesQuery.error && <p className="text-[10px] text-red-500 mt-2 font-mono">rulesQuery: {rulesQuery.error.message}</p>}
              {budgetQuery.error && <p className="text-[10px] text-red-500 mt-2 font-mono">budgetQuery: {budgetQuery.error.message}</p>}
            </div>
            <Button variant="outline" className="border-red-300 text-red-700 hover:bg-red-50 text-xs" onClick={() => {
              rawQuery.refetch();
              budgetQuery.refetch();
            }}>
              Tentar Novamente
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* APP INTEGRATED STATS CARDS (Matching materials styling) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card 
              className="cursor-pointer border-slate-200 dark:border-zinc-800 shadow-md hover:-translate-y-0.5 hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-900 transition-all duration-300"
              onClick={() => setActiveDialogCard('postes')}
            >
              <CardContent className="p-4 flex flex-col justify-between h-20">
                <span className="text-[10px] text-muted-foreground font-extrabold uppercase tracking-wider">Postes Projetados</span>
                <span className="text-2xl font-black text-blue-650 dark:text-blue-400">{formatQtd(stats.totalPostes)}</span>
              </CardContent>
            </Card>
            <Card 
              className="cursor-pointer border-slate-200 dark:border-zinc-800 shadow-md hover:-translate-y-0.5 hover:shadow-lg hover:border-indigo-300 dark:hover:border-indigo-900 transition-all duration-300"
              onClick={() => setActiveDialogCard('obras')}
            >
              <CardContent className="p-4 flex flex-col justify-between h-20">
                <span className="text-[10px] text-muted-foreground font-extrabold uppercase tracking-wider">Obras Programadas</span>
                <span className="text-2xl font-black text-indigo-650 dark:text-indigo-400">{stats.obrasCount}</span>
              </CardContent>
            </Card>
            <Card 
              className="cursor-pointer border-slate-200 dark:border-zinc-800 shadow-md hover:-translate-y-0.5 hover:shadow-lg hover:border-purple-300 dark:hover:border-purple-900 transition-all duration-300"
              onClick={() => setActiveDialogCard('tipos')}
            >
              <CardContent className="p-4 flex flex-col justify-between h-20">
                <span className="text-[10px] text-muted-foreground font-extrabold uppercase tracking-wider">Tipos de Postes</span>
                <span className="text-2xl font-black text-purple-650 dark:text-purple-400">{stats.typesCount}</span>
              </CardContent>
            </Card>
            <Card 
              className={`cursor-pointer border-slate-200 dark:border-zinc-800 shadow-md hover:-translate-y-0.5 hover:shadow-lg hover:border-amber-300 dark:hover:border-amber-900 transition-all duration-300 ${stats.pendenciesCount > 0 ? 'bg-amber-50/30 border-amber-300 dark:bg-amber-950/10' : ''}`}
              onClick={() => setActiveDialogCard('pendencias')}
            >
              <CardContent className="p-4 flex flex-col justify-between h-20">
                <span className="text-[10px] text-muted-foreground font-extrabold uppercase tracking-wider">Pendências Orçado</span>
                <span className={`text-2xl font-black ${stats.pendenciesCount > 0 ? 'text-amber-600 dark:text-amber-500' : 'text-slate-650'}`}>{stats.pendenciesCount}</span>
              </CardContent>
            </Card>
          </div>

          {/* 
            DASHBOARD GRID VIEWPORT:
            Displays Block 1 (Materiais), Block 2 (Entregas), and Block 3 (Postes por Obra) side-by-side,
            supporting mobile stacking.
          */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
            
            {/* LEFT COLUMN: BLOCO 1 (MATERIAIS PARA O PERÍODO - xl:col-span-3) */}
            <div className="xl:col-span-3 flex flex-col gap-4">
              {leftColumnContent}
            </div>

            {/* MIDDLE COLUMN: BLOCO 2 (DETALHAMENTO DE ENTREGAS DE CONCRETOS - xl:col-span-5) */}
            <div className="xl:col-span-5">
              {middleColumnContent}
            </div>
            
            {/* RIGHT COLUMN: BLOCO 3 (DETALHAMENTO DE POSTES / OBRA - xl:col-span-4) */}
            <div className="xl:col-span-4">
              {rightColumnContent}
            </div>
            
          </div>

          {/* BOTTOM SECTION: BLOCO 4 (PENDÊNCIAS LOGÍSTICAS - FULL WIDTH) */}
          {modo === 'DIARIO' && (
            <Card className="border-slate-200 dark:border-zinc-800 shadow-md">
              <CardHeader className="flex flex-row items-center justify-between border-b pb-2 gap-2 bg-red-50/5 px-3 py-2.5">
                <div>
                  <CardTitle className="text-[11px] font-extrabold uppercase tracking-wider flex items-center gap-1.5 text-red-900 dark:text-red-300">
                    <AlertTriangle className="w-4 h-4 text-red-650" /> Pendências Logísticas (Postes Ausentes no Orçamento)
                  </CardTitle>
                </div>
                <div className="flex items-center gap-1 shrink-0 no-print">
                  <Button variant="outline" size="xs" className="h-6 text-[9.5px] px-1.5 font-semibold gap-0.5 border-red-200 text-red-700 bg-white hover:bg-red-50" onClick={() => handleExportCSV(4)}>
                    <Download className="w-2.5 h-2.5" /> CSV
                  </Button>
                  <Button variant="outline" size="xs" className="h-6 text-[9.5px] px-1.5 font-semibold gap-0.5 border-red-200 text-red-700 bg-white hover:bg-red-50" onClick={() => handleExportPDF(4, 'Pendências')}>
                    <Printer className="w-2.5 h-2.5" /> PDF
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {processedBlocks.bloco4.length === 0 ? (
                  <div className="text-center p-6 text-green-600 dark:text-green-500 text-[11px] font-semibold flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-green-550" /> Tudo limpo! Nenhum poste programado está ausente no orçamento.
                  </div>
                ) : (
                  <div className="max-h-[300px] overflow-y-auto">
                    <table className="w-full text-[10.5px]">
                      <thead className="bg-red-50/20 text-red-950 font-bold border-b border-red-150 sticky top-0 z-10 shadow-[0_1px_0_0_rgba(254,226,226,1)]">
                        <tr>
                          <th className="px-2 py-1.5 w-24 text-left">Data Prog.</th>
                          <th className="px-2 py-1.5 text-left">Obra</th>
                          <th className="px-2 py-1.5 w-20 text-left">Ponto</th>
                          <th className="px-2 py-1.5 w-24 text-right">Qtd Prog.</th>
                          <th className="px-2 py-1.5 text-left">Inconsistência Identificada</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-red-100 bg-red-50/5">
                        {processedBlocks.bloco4.map((item, idx) => (
                          <tr key={idx} className="hover:bg-red-50/20">
                            <td className="px-2 py-1.5 text-slate-650 dark:text-slate-450">{item.data}</td>
                            <td className="px-2 py-1.5 font-semibold text-slate-700 dark:text-slate-350">{item.obra}</td>
                            <td className="px-2 py-1.5 font-mono font-bold text-blue-650 dark:text-blue-400">{item.ponto}</td>
                            <td className="px-2 py-1.5 text-right font-black text-red-650 dark:text-red-500">{formatQtd(item.quantidade)}</td>
                            <td className="px-2 py-1.5 text-red-650 dark:text-red-450 font-semibold">{item.statusText}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* DIALOGS FOR CLICKABLE STATS CARDS */}
          <Dialog open={activeDialogCard !== null} onOpenChange={(open) => !open && setActiveDialogCard(null)}>
            <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-sm font-extrabold uppercase tracking-wider flex items-center gap-1.5 text-slate-800 dark:text-slate-100">
                  {activeDialogCard === 'postes' && (
                    <>
                      <MapIcon className="h-4 w-4 text-blue-650" /> Detalhamento de Postes Projetados
                    </>
                  )}
                  {activeDialogCard === 'obras' && (
                    <>
                      <Building2 className="h-4 w-4 text-indigo-650" /> Detalhamento de Obras Programadas
                    </>
                  )}
                  {activeDialogCard === 'tipos' && (
                    <>
                      <ListFilter className="h-4 w-4 text-purple-650" /> Detalhamento dos Tipos de Postes
                    </>
                  )}
                  {activeDialogCard === 'pendencias' && (
                    <>
                      <AlertTriangle className="h-4 w-4 text-amber-650" /> Detalhamento de Pendências de Orçamento
                    </>
                  )}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {activeDialogCard === 'postes' && 'Lista completa de postes projetados no período selecionado.'}
                  {activeDialogCard === 'obras' && 'Lista completa de obras que possuem programação no período selecionado.'}
                  {activeDialogCard === 'tipos' && 'Resumo consolidado das quantidades projetadas para cada tipo de poste.'}
                  {activeDialogCard === 'pendencias' && 'Detalhamento de inconsistências e postes ausentes no orçamento.'}
                </DialogDescription>
              </DialogHeader>

              <div className="py-4">
                {activeDialogCard === 'postes' && (
                  <div className="max-h-[50vh] overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-100 dark:bg-zinc-800 font-bold border-b sticky top-0">
                        <tr>
                          <th className="px-2 py-1.5 text-left">Obra</th>
                          <th className="px-2 py-1.5 text-left">Município</th>
                          <th className="px-2 py-1.5 text-left">Item (Poste)</th>
                          <th className="px-2 py-1.5 text-right w-16">Qtd</th>
                          <th className="px-2 py-1.5 text-left">Supervisor</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-150 dark:divide-zinc-800">
                        {processedBlocks.bloco3.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/20">
                            <td className="px-2 py-1.5 font-bold">{item.obra}</td>
                            <td className="px-2 py-1.5">{item.municipio}</td>
                            <td className="px-2 py-1.5 font-semibold">{item.item}</td>
                            <td className="px-2 py-1.5 text-right font-black text-blue-655">{formatQtd(item.quantidade)}</td>
                            <td className="px-2 py-1.5">{item.supervisor}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {activeDialogCard === 'obras' && (
                  <div className="max-h-[50vh] overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-100 dark:bg-zinc-800 font-bold border-b sticky top-0">
                        <tr>
                          <th className="px-2 py-1.5 text-left">Obra</th>
                          <th className="px-2 py-1.5 text-left">Município</th>
                          <th className="px-2 py-1.5 text-left">Supervisor</th>
                          <th className="px-2 py-1.5 text-left">Primeira Prog.</th>
                          <th className="px-2 py-1.5 text-left">Pontos Programados</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-150 dark:divide-zinc-800">
                        {Array.from(scheduledData.obraDetailsMap.entries()).map(([projectCode, details]) => (
                          <tr key={projectCode} className="hover:bg-slate-50/20">
                            <td className="px-2 py-1.5 font-bold">{projectCode}</td>
                            <td className="px-2 py-1.5">{details.municipio}</td>
                            <td className="px-2 py-1.5">{details.supervisor}</td>
                            <td className="px-2 py-1.5 font-medium">{details.primeiraData}</td>
                            <td className="px-2 py-1.5 font-mono text-[10.5px] max-w-xs truncate" title={Array.from(details.points).join(', ')}>
                              {Array.from(details.points).join(', ')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {activeDialogCard === 'tipos' && (
                  <div className="max-h-[50vh] overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-100 dark:bg-zinc-800 font-bold border-b sticky top-0">
                        <tr>
                          <th className="px-2 py-1.5 text-left">Tipo de Poste</th>
                          <th className="px-2 py-1.5 text-right w-24">Quantidade Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-150 dark:divide-zinc-800">
                        {processedBlocks.bloco2.map((group, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/20">
                            <td className="px-2 py-2 font-bold">{group.poleType}</td>
                            <td className="px-2 py-2 text-right font-black text-purple-650 text-sm">{formatQtd(group.totalQuantity)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {activeDialogCard === 'pendencias' && (
                  <div className="max-h-[50vh] overflow-y-auto">
                    {processedBlocks.bloco4.length === 0 ? (
                      <div className="text-center p-6 text-green-600 dark:text-green-500 font-semibold flex items-center justify-center gap-1.5">
                        <CheckCircle2 className="w-5 h-5 text-green-550" /> Tudo limpo! Nenhum poste programado está ausente no orçamento.
                      </div>
                    ) : (
                      <table className="w-full text-xs">
                        <thead className="bg-red-50/20 text-red-950 font-bold border-b border-red-150 sticky top-0">
                          <tr>
                            <th className="px-2 py-1.5 text-left">Data Prog.</th>
                            <th className="px-2 py-1.5 text-left">Obra</th>
                            <th className="px-2 py-1.5 text-left">Ponto</th>
                            <th className="px-2 py-1.5 text-right">Qtd Prog.</th>
                            <th className="px-2 py-1.5 text-left">Inconsistência Identificada</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-red-100 bg-red-50/5">
                          {processedBlocks.bloco4.map((item, idx) => (
                            <tr key={idx} className="hover:bg-red-50/20">
                              <td className="px-2 py-1.5">{item.data}</td>
                              <td className="px-2 py-1.5 font-semibold">{item.obra}</td>
                              <td className="px-2 py-1.5 font-mono font-bold text-blue-650">{item.ponto}</td>
                              <td className="px-2 py-1.5 text-right font-black text-red-650">{formatQtd(item.quantidade)}</td>
                              <td className="px-2 py-1.5 text-red-650 font-semibold">{item.statusText}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button onClick={() => setActiveDialogCard(null)} className="text-xs">Fechar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
};
export default PlanejamentoEnviosView;
