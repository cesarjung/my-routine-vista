-- VAMOS DESCOBRIR SE AINDA EXISTE UM PERÍODO FANTASMA PRESO
-- O botão "Iniciar Período" no frontend provavelmente tenta criar a linha em 'routine_periods'
-- e falha silenciosamente porque já existe uma!

SELECT * FROM public.routine_periods 
WHERE period_start >= '2026-03-05 00:00:00+00';
