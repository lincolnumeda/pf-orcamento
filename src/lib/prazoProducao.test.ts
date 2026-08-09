import { describe, expect, it } from 'vitest';
import { calcularPrazoProducao } from './prazoProducao';
import type { PrazoProducao } from '../types';

const prazos: PrazoProducao[] = [
  { id: '1', qtd_min: 1, qtd_max: 20, dias_uteis: 5, texto_customizado: null },
  { id: '2', qtd_min: 21, qtd_max: 30, dias_uteis: 10, texto_customizado: null },
  { id: '3', qtd_min: 31, qtd_max: 50, dias_uteis: 15, texto_customizado: null },
  { id: '4', qtd_min: 51, qtd_max: 100, dias_uteis: 20, texto_customizado: null },
  { id: '5', qtd_min: 101, qtd_max: 150, dias_uteis: 25, texto_customizado: null },
  { id: '6', qtd_min: 151, qtd_max: null, dias_uteis: null, texto_customizado: 'Consultar' },
];

describe('calcularPrazoProducao', () => {
  it('escolhe a faixa certa por quantidade, incluindo os limites', () => {
    expect(calcularPrazoProducao(1, prazos)).toEqual({ diasUteis: 5, textoCustomizado: null });
    expect(calcularPrazoProducao(20, prazos)).toEqual({ diasUteis: 5, textoCustomizado: null });
    expect(calcularPrazoProducao(21, prazos)).toEqual({ diasUteis: 10, textoCustomizado: null });
    expect(calcularPrazoProducao(100, prazos)).toEqual({ diasUteis: 20, textoCustomizado: null });
  });

  it('faixa aberta (151+) cai no texto customizado', () => {
    expect(calcularPrazoProducao(151, prazos)).toEqual({ diasUteis: null, textoCustomizado: 'Consultar' });
    expect(calcularPrazoProducao(9999, prazos)).toEqual({ diasUteis: null, textoCustomizado: 'Consultar' });
  });

  it('sem faixa cobrindo a quantidade: null', () => {
    expect(calcularPrazoProducao(0, prazos)).toBeNull();
  });
});
