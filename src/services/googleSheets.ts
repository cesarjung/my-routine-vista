import Papa from 'papaparse';

const BASE_URL = 'https://docs.google.com/spreadsheets/d/1Ipp454Clq0lKik8G5LjMMmV-8eA0R6if4FGG555K1j8/export?format=csv&gid=';
const BD_CONFIG_GID = '2089298406';
const ATIVIDADES_GID = '126690637';

export interface AtividadeGrupo {
  descricao: string; // BD_Config Col C
  grupo: string; // BD_Config Col D (POSTE, CAVA, etc)
}

export interface PontoObraRow {
  projeto: string; // Col I (Index 8) - Com Mascara
  unidade: string; // Col J (Index 9) - Unidade
  variacaoCompleta: string; // Col K (Index 10) - Com ponto e Máscara
  variacao: string; // Extraído de Col K após '_'
  descricaoAtividade: string; // Col E (Index 4) - Descrição
}

export const fetchBDConfig = async (): Promise<Map<string, string>> => {
  const response = await fetch(`${BASE_URL}${BD_CONFIG_GID}`);
  const csvText = await response.text();
  
  return new Promise((resolve, reject) => {
    Papa.parse(csvText, {
      header: false,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as string[][];
        const map = new Map<string, string>();
        
        // Pular as 2 primeiras linhas (cabeçalhos)
        for (let i = 2; i < rows.length; i++) {
          const row = rows[i];
          if (row.length >= 4) {
            const descricao = row[2]?.trim();
            const grupo = row[3]?.trim();
            if (descricao && grupo) {
              map.set(descricao, grupo);
            }
          }
        }
        resolve(map);
      },
      error: (error: Error) => reject(error)
    });
  });
};

export const fetchAtividadesBase = async (): Promise<PontoObraRow[]> => {
  const response = await fetch(`${BASE_URL}${ATIVIDADES_GID}`);
  const csvText = await response.text();
  
  return new Promise((resolve, reject) => {
    Papa.parse(csvText, {
      header: false,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as string[][];
        const parsedData: PontoObraRow[] = [];
        
        // Pular a 1ª linha (cabeçalho)
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (row.length >= 10) {
            const projeto = row[8]?.trim() || row[0]?.trim(); // I: Com Mascara ou A: Projeto
            const unidade = row[9]?.trim(); // J: Unidade
            const variacaoCompleta = row[1]?.trim(); // B: Ponto Obra (ex: 1133017_P1)
            const descricaoAtividade = row[4]?.trim(); // E: Descrição
            
            if (projeto && unidade && variacaoCompleta) {
              const parts = variacaoCompleta.split('_');
              const variacao = parts.length > 1 ? parts.slice(1).join('_') : variacaoCompleta;
              
              parsedData.push({
                projeto,
                unidade,
                variacaoCompleta,
                variacao,
                descricaoAtividade
              });
            }
          }
        }
        resolve(parsedData);
      },
      error: (error: Error) => reject(error)
    });
  });
};
