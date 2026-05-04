-- VAMOS LIMPAR DEFINITIVAMENTE O LIXO DAS RECORRÊNCIAS INFINITAS --
-- (Rode este script sem medo)

-- Este script vai apagar TODAS as tarefas Filhas que foram indevidamente marcadas
-- como is_recurring = true E que têm as datas alteradas erroneamente pro dia 26 e filhos infinitos criados como herança:

DELETE FROM public.tasks 
WHERE routine_id IS NOT NULL 
  AND parent_task_id IS NOT NULL 
  AND is_recurring = true;

-- Com esse passo a tabela limpará qualquer tarefa filha (de unidade ou clonada infinitamente) 
-- que erroneamente possui a flag de recorrência. A partir de agora, apenas as raízes (root) 
-- originais iniciarão a clonagem, graças ao novo script.
