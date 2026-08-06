/**
 * O corte "base sem lixo" herdado do BI de 2016: registros com data e sem
 * suspeita de digitação. Vive sozinho porque é o único conceito que a análise
 * de números e a de qualidade de dados precisam compartilhar.
 */
export const BASE = "data IS NOT NULL AND data_suspeita = 0";
