import { PRAZO_CONFERENCIA_DIAS_UTEIS } from './indicacaoConfig';

// Dias úteis (seg a sex) completos entre duas datas. Não considera feriados —
// é só pro destaque visual de "conferência atrasada" na Central.
export function diasUteisEntre(inicio: Date, fim: Date): number {
  if (fim <= inicio) return 0;
  const cursor = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
  const ultimo = new Date(fim.getFullYear(), fim.getMonth(), fim.getDate());
  let dias = 0;
  while (cursor < ultimo) {
    cursor.setDate(cursor.getDate() + 1);
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) dias++;
  }
  return dias;
}

// Ainda em "recebida" depois do prazo prometido de conferência.
export function conferenciaAtrasada(status: string, criadoEm: string, agora: Date = new Date()): boolean {
  return status === 'recebida' && diasUteisEntre(new Date(criadoEm), agora) > PRAZO_CONFERENCIA_DIAS_UTEIS;
}

// Indicação ainda dentro dos dias de validade numa data de referência.
export function dentroDaValidade(validaAte: string, referencia: Date | string = new Date()): boolean {
  return new Date(referencia).getTime() <= new Date(validaAte).getTime();
}
