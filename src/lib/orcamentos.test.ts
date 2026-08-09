import { describe, expect, it } from 'vitest';
import { totalComAjuste, linkWhatsApp } from './orcamentos';
import type { Orcamento } from '../types';

function orcamentoBase(overrides: Partial<Orcamento>): Orcamento {
  return {
    id: 'o1',
    escola_nome: 'Escola X',
    responsavel_nome: 'Fulano',
    responsavel_email: 'fulano@example.com',
    responsavel_whatsapp: '11999999999',
    cep: '01310-100',
    itens: [],
    subtotal: 999,
    frete_bruto: 20,
    frete_final: 0,
    total_final: 999,
    regras_aplicadas: [],
    status: 'recebido',
    notas_internas: null,
    link_pagamento: null,
    ajuste_manual: 0,
    criado_em: '2026-01-01',
    atualizado_em: '2026-01-01',
    ...overrides,
  };
}

describe('totalComAjuste', () => {
  it('sem ajuste, retorna o total calculado', () => {
    expect(totalComAjuste(orcamentoBase({ total_final: 999, ajuste_manual: 0 }))).toBe(999);
  });

  it('desconto negociado (ajuste negativo)', () => {
    expect(totalComAjuste(orcamentoBase({ total_final: 999, ajuste_manual: -50 }))).toBe(949);
  });

  it('acréscimo negociado (ajuste positivo)', () => {
    expect(totalComAjuste(orcamentoBase({ total_final: 999, ajuste_manual: 30 }))).toBe(1029);
  });
});

describe('linkWhatsApp', () => {
  it('adiciona código do país quando ausente', () => {
    expect(linkWhatsApp('11999999999', 'Olá')).toBe('https://api.whatsapp.com/send?phone=5511999999999&text=Ol%C3%A1');
  });

  it('não duplica o código do país quando já presente', () => {
    expect(linkWhatsApp('5511999999999', 'Oi')).toBe('https://api.whatsapp.com/send?phone=5511999999999&text=Oi');
  });

  it('remove formatação (parênteses, traço, espaço)', () => {
    expect(linkWhatsApp('(11) 99999-9999', 'Oi')).toBe('https://api.whatsapp.com/send?phone=5511999999999&text=Oi');
  });
});
