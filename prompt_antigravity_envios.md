# PROMPT — Seção ENVIOS (Projeção de Materiais e Postes para Obras)

## Contexto

O app de gestão já possui a seção **MATERIAIS** (separação de materiais), que já tem conectada a base de orçamentos e o **De/Para de materiais** (que identifica quais itens são postes). Agora quero criar a seção **ENVIOS**, que substitui a aba `Logistica` da planilha "PCP - CCM - Check de Planejamento (BAR) - v1.1" e suas macros do Apps Script (lógica descrita integralmente abaixo — replicar fielmente).

Objetivo: **projetar o que precisa ser enviado para cada obra em um período**, cruzando a programação de execução com os materiais orçados, com foco em postes de concreto: qual poste, em qual obra, em quais pontos, quando, com qual supervisor e em qual localização GPS.

## Fontes de dados

1. **Orçamentos da unidade** — arquivo no Google Drive, ID: `1T94xDk3pw92Ts0UKn07Iz2g5sojuPZCV` (mesma base já usada na seção MATERIAIS — reutilizar o conector/parser existente, não duplicar). Layout de colunas (padrão "MATERIAIS_PONTO_A_PONTO"):
   - C = Código do material
   - D = Item (descrição)
   - E ou F = Quantidade orçada (usar E; se vazia, usar F)
   - I = Chave `PROJETO_PONTO` (ex.: `B-1160571_P133`)
   - Validar o cabeçalho na primeira leitura; se o arquivo for CSV, detectar delimitador (`;` vs `,`) automaticamente escolhendo o que produz mais linhas com ≥9 colunas e chave válida na coluna I (regex `[A-Z]-?\d+_[A-Z0-9\-]+`).

2. **De/Para de materiais** — já existente na seção MATERIAIS do app. Usar para identificar itens do tipo POSTE (na planilha original o critério era descrição normalizada começando com `POSTE`; manter esse fallback, mas priorizar o De/Para do app).

3. **CCM - Planejamento - Barreiras** (Google Sheets, ID: `1OTHF2ytEOjGgfE49paARXkz9GjaklOQC_UhiXwUjC2E`):
   - **Aba `Plan_Principal`** (dados a partir da linha 6) — programação DIÁRIA:
     - B = Data (formato `dd/mm/aaaa - dia-da-semana`; extrair a data com regex `(\d{1,2})/(\d{1,2})/(\d{4})`)
     - E = Supervisor da equipe
     - H = Projeto (obra, ex.: `B-1203543`)
     - K = Município
     - O = **Compilado de atividades por ponto**, no formato: `P59 - INSTALAR POSTE 9 A 14 METROS - Qtd: 0.5 - Hr. Prev: 00:10 | P60 - ... | ...`
       (blocos separados por `|`; dentro de cada bloco, campos separados por ` - `: [0]=ponto, [1]=descrição do serviço; a quantidade vem do padrão `Qtd: N` — se ausente ou ≤ 0, assumir 1)
   - **Aba `Carteira_Planejador`** — carteira de obras (fonte do modo MENSAL):
     - J = Início planejado da obra
     - K = Fim planejado da obra
     - Também: L = Status Execução, M = Projeto, N = Título, O = Município, P = Prioridade
   - **Localização das obras**: na base espelho da carteira (BD_Carteira_Planejador), a obra fica na coluna K e as coordenadas nas colunas AS e AT (lat e long, concatenadas como `lat long`). No app, mapear obra → localização a partir dessa mesma origem.

4. **Parametrização** (hoje na aba CONFIG; transformar em configurações da seção no app):
   - Unidades: `BARREIRAS`, `LUIS_EDUARDO` (lista editável — cada unidade corresponde a um arquivo/aba de orçamento)
   - Serviços que caracterizam instalação de poste (lista editável): `INSTALAR POSTE 9 A 14 METROS`, `INSTALAR POSTE 14 METROS OU SUPERIOR`, `INSTALAR POSTE SUPERIOR A 14 METROS`
   - Supervisores: `ALFREDO`, `DANIEL`, `JHANATAN`

## Regras de normalização (usar em TODAS as comparações)

- `normalizarTexto`: remover acentos (NFD + strip diacríticos), remover TODOS os espaços, uppercase. Comparações de chaves, descrições e nomes de obra sempre com valores normalizados.
- `converterParaNumero`: aceitar formato BR (`1.234,56` → 1234.56) e US.
- Datas sempre in dd/mm/aaaa (pt-BR), timezone local.

## Pipeline de projeção (replicar a lógica das macros)

### Etapa 1 — Coleta da programação (depende do modo ativo)

**Modo DIÁRIO (padrão — lógica atual):**
1. Ler `Plan_Principal` a partir da linha 6.
2. Filtrar linhas com Data (B) dentro de [Data Início, Data Fim] (inclusivo).
3. Para cada linha com Projeto (H) preenchido, parsear a coluna O e extrair somente os blocos cuja descrição normalizada esteja na lista de serviços de instalação de poste. Resultado por linha: lista de `{ponto, qtd}`.
4. Para cada obra, acumular ao longo do período:
   - `primeiraData` = menor data em que a obra aparece (com o supervisor e município dessa data)
   - união ordenada (ordem de aparição) dos pontos válidos
   - `qtdPorChave[PROJETO_PONTO]` = soma das Qtd da coluna O **somente quando mesma obra + mesmo ponto** (dentro da mesma célula O e entre dias diferentes)
5. Obras que aparecem no período mas não têm nenhum ponto válido na coluna O em nenhuma linha entram na lista **"Obras sem pontos válidos"** (no layout original, coluna "Sem Orçamento").

**Modo MENSAL (novo):**
1. Ler `Carteira_Planejador`.
2. Incluir cada obra cuja janela [J (Início), K (Fim)] tenha **interseção** com [Data Início, Data Fim]. Excluir status finalizados (ex.: `CONCLUÍDA/UNITIZADA` — lista de exclusão configurável).
3. Para as obras incluídas, buscar no arquivo de orçamentos **todas** as chaves `OBRA_PONTO` da obra (todos os pontos orçados), já que não há programação diária por ponto.
4. `data prevista` = coluna J (Início) da obra; supervisor/município vêm da própria Carteira_Planejador. Marcar visualmente os registros com tag **MENSAL**.
5. Nesse modo não existe qtd da coluna O: usar a quantidade do próprio orçamento (E/F).

### Etapa 2 — Cruzamento com o orçamento
1. Ler o arquivo de orçamentos da(s) unidade(s) configurada(s).
2. Para cada linha do orçamento com chave I presente no conjunto de chaves da Etapa 1:
   - **Bloco 1 (Materiais do Período)**: agregar por `item + código` somando quantidades — todos os materiais, com filtro opcional "Somente Postes" (checkbox, hoje em C5). Para itens POSTE, **substituir** a qtd do orçamento pela qtd acumulada da coluna O (`qtdPorChave`) no modo DIÁRIO.
   - **Bloco 2 (Entregas de Concretos)**: somente itens POSTE. Agrupar por item (tipo de poste) → por obra, com: OBRA | PONTOS (lista) | MUNICÍPIO | DATA (primeiraData) | QTDE | SUPERV. | LOCALIZAÇÃO. Ordenar obras por data e nome; itens em ordem alfabética pt-BR.
   - Registrar cada chave POSTE encontrada no orçamento em um set `chavesEncontradas`.
3. **Bloco 4 (Pendências)**: toda chave `OBRA_PONTO` esperada (Etapa 1) que NÃO apareceu em `chavesEncontradas` vira pendência: DATA (primeira data do ponto) | OBRA | PONTO | QTD | "Poste não encontrado no Orçamento". Ordenar por data, obra, ponto.
4. **Bloco 3 (Postes por Obra)**: visão achatada do Bloco 2: MUNICÍPIO | OBRA | ITEM | QTD | LOCALIZAÇÃO (uma linha por obra×item).

## UI da seção ENVIOS

- Header: campos **Data Início** e **Data Fim**; toggle **DIÁRIO / MENSAL** (DIÁRIO padrão); checkbox **Somente Postes** (afeta só o Bloco 1); botão **Projetar**; indicador "Atualizado em: dd/mm/aaaa hh:mm".
- Bloco 1 — **Materiais do Período**: tabela Item | Qtde | Código, com busca; painel lateral/badge com "Obras sem pontos válidos".
- Bloco 2 — **Entregas de Concretos**: seções/accordions por tipo de poste; localização clicável abrindo Google Maps (`https://maps.google.com/?q=lat,long`).
- Bloco 3 — **Postes por Obra**: tabela consolidada com filtros por Município, Obra, Supervisor e Item.
- Bloco 4 — **Pendências** (postes programados sem correspondência no orçamento): destaque visual de alerta.
- Em cada linha de obra do Bloco 2/3, permitir expandir para ver as **estruturas previstas por ponto** (todas as linhas do orçamento daquela obra, agrupadas por ponto — reutilizando a leitura da seção MATERIAIS).
- **Exportação em PDF por bloco** (equivalente às macros gerarPdfIntervalo*): A4 retrato, ajustado à largura, cabeçalho do bloco congelado/repetido, numeração de página, sem linhas de grade. Também oferecer CSV.

## Critérios de aceite
1. Modo DIÁRIO com o mesmo período reproduz exatamente os 4 blocos da aba `Logistica` atual (mesmos itens, quantidades, pontos, datas e pendências).
2. Modo MENSAL lista todas as obras da `Carteira_Planejador` com janela J–K intersectando o período, com orçamento completo e tag MENSAL.
3. Qtd de postes no modo DIÁRIO vem da coluna O (não do orçamento); pendências aparecem para pontos sem poste no orçamento.
4. Toggle troca o modo e reprocessa sem recarregar a página; cada bloco exporta em PDF e CSV.
5. Falhas de leitura (arquivo não encontrado, aba renomeada, colunas fora do lugar) geram mensagem clara sem quebrar a seção.
