-- Unifica a forma canônica de placa (maiúsculas, sem espaços/hífens) em bancos
-- já existentes — o caminho de escrita passou a compactar, e a busca por
-- prefixo/igualdade só encontra a forma compacta. Idempotente.
UPDATE servicos
SET placa = REPLACE(REPLACE(placa, ' ', ''), '-', '')
WHERE placa LIKE '% %' OR placa LIKE '%-%';
