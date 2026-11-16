import { describe, expect, it } from 'vitest';
import { conferenciaAtrasada, diasUteisEntre } from './indicacaoPrazo';
import { programaEncerrado } from './indicacaoConfig';

describe('diasUteisEntre', () => {
  it('pula fim de semana', () => {
    // sexta 20/11/2026 → segunda 23/11/2026 = 1 dia útil
    expect(diasUteisEntre(new Date(2026, 10, 20, 10), new Date(2026, 10, 23, 10))).toBe(1);
    // segunda → quinta = 3
    expect(diasUteisEntre(new Date(2026, 10, 16, 10), new Date(2026, 10, 19, 9))).toBe(3);
  });

  it('mesmo dia ou data invertida dá zero', () => {
    expect(diasUteisEntre(new Date(2026, 10, 16, 8), new Date(2026, 10, 16, 18))).toBe(0);
    expect(diasUteisEntre(new Date(2026, 10, 18), new Date(2026, 10, 16))).toBe(0);
  });
});

describe('conferenciaAtrasada', () => {
  const criada = new Date(2026, 10, 16, 10).toISOString(); // segunda

  it('só marca recebidas com mais de 2 dias úteis', () => {
    expect(conferenciaAtrasada('recebida', criada, new Date(2026, 10, 18, 10))).toBe(false);
    expect(conferenciaAtrasada('recebida', criada, new Date(2026, 10, 19, 10))).toBe(true);
    expect(conferenciaAtrasada('aceita', criada, new Date(2026, 10, 30, 10))).toBe(false);
  });
});

describe('programaEncerrado', () => {
  it('vale até o fim de 31/12/2026 em Brasília', () => {
    expect(programaEncerrado(new Date('2026-12-31T23:59:00-03:00'))).toBe(false);
    expect(programaEncerrado(new Date('2027-01-01T00:00:01-03:00'))).toBe(true);
    expect(programaEncerrado(new Date('2026-11-16T12:00:00-03:00'))).toBe(false);
  });
});
