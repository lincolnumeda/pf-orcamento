// Configuração do programa "Indique uma escola" — um lugar só pra mudar
// prazo, validade e percentual. Ver PROJETO-ORCAMENTO.md, seção 10.
//
// ⚠️ VALIDADE_DIAS também está no SQL (trigger em
// scripts/sql/criar-indicacoes.sql, `interval '30 days'`) e no texto da
// mensagem "aceita" (supabase/functions/_shared/mensagensIndicacao.ts). Se
// mudar aqui, mude lá também.

// Último dia em que o formulário aceita indicações (horário de Brasília).
// A partir de 00:00 do dia seguinte, /indique mostra "Programa encerrado".
export const DATA_FIM_INDICACOES = '2026-12-31';

// Dias que uma indicação vale a partir do registro.
export const VALIDADE_DIAS = 30;

// Percentual pago a quem indicou, sobre o valor líquido dos Class Books.
export const COMISSAO_PCT = 10;

// O pedido precisa ter MAIS de 10 Class Books (11 ou mais).
export const QTD_MINIMA_LIVROS = 11;

// Prazo prometido pra conferir a indicação (destaque na Central).
export const PRAZO_CONFERENCIA_DIAS_UTEIS = 2;

// Fim do último dia do programa em Brasília (UTC-3, sem horário de verão).
export function fimDoPrograma(): Date {
  return new Date(`${DATA_FIM_INDICACOES}T23:59:59.999-03:00`);
}

export function programaEncerrado(agora: Date = new Date()): boolean {
  return agora.getTime() > fimDoPrograma().getTime();
}

// "2026-12-31" → "31/12/2026"
export function formatarDataCurta(iso: string): string {
  const [ano, mes, dia] = iso.slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}
