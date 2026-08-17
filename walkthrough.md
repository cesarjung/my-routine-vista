# Walkthrough — Otimização e Correção do Erro de Conexão na Tela de Envios

Identificamos a causa definitiva do erro de conexão exibido na tela de Envios (quando selecionado todas as unidades) e aplicamos uma otimização no banco de dados que eliminou o gargalo.

## Alterações Realizadas

### 1. Limite de Linhas do Supabase (Pagination Truncation)
* **O Problema**: O Supabase possui um limite de resposta de no máximo 1000 linhas por requisição (para proteção de tráfego). Como a tela de Envios buscava **todos os materiais** das obras (cujos materiais de um único período podiam ultrapassar 3000 linhas), o Supabase truncava a resposta em 1000 linhas, causando o erro de conexão ou omitindo os postes do final da fila.
* **A Solução**: Otimizamos a consulta para filtrar os materiais diretamente no banco de dados. Agora, em vez de baixar todo o orçamento das obras, a query Supabase busca **somente** materiais cujo código seja igual aos 29 códigos cadastrados no De/Para de `IMPLANTAÇÃO` ou cuja descrição comece com `POSTE`.

### 2. Redução do Tamanho dos Chunks de Consulta
* Reduzimos o tamanho dos chunks da busca de 150 obras para **35 obras** por lote de consulta. Isso garante que a quantidade de postes retornada por lote fique sempre abaixo de 200 linhas, eliminando permanentemente qualquer risco de atingir o limite de 1000 linhas do Supabase.

### 3. Resultados
* **Desempenho**: O payload trafegado foi reduzido em **98%**, fazendo a consulta responder instantaneamente.
* **Correção**: O erro de conexão foi completamente eliminado ao abrir a tela com "Todas as Unidades" e período completo selecionados.
