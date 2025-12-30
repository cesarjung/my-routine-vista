-- DELETAR USUÁRIO VIA SQL (FORÇA BRUTA)
-- O Painel/Dashboard falha porque usa a API que está quebrada com o erro de leitura.
-- O SQL direto não sofre desse erro. Vamos arrancar o mal pela raiz.

BEGIN;
    -- 1. Remover perfil público (para evitar erros de FK se não tiver cascade)
    DELETE FROM public.profiles WHERE email = 'teste.2@sirtec.com.br';

    -- 2. Remover identidades e sessões (geralmente cascade funciona, mas garantindo)
    DELETE FROM auth.identities WHERE email = 'teste.2@sirtec.com.br';
    
    -- 3. REMOVER O USUÁRIO DO AUTH
    DELETE FROM auth.users WHERE email = 'teste.2@sirtec.com.br';
COMMIT;

SELECT 'Usuário "teste.2" deletado com sucesso pelo SQL.' as status;
