import { describe, expect, it } from 'vitest';
import { descreverRegra } from './regras';
import type { Regra } from '../types';

function regraBase(overrides: Partial<Regra>): Regra {
  return {
    id: 'r1',
    nome: 'Teste',
    ativa: true,
    tipo_gatilho: 'quantidade',
    gatilho_modo: 'a_partir_de',
    gatilho_valor: 10,
    frete_min: null,
    frete_max: null,
    tipo_beneficio: 'desconto_frete_pct',
    beneficio_valor: 100,
    item_beneficio: null,
    grupo_exclusivo: null,
    prioridade: 1,
    mensagem_cliente: null,
    criado_em: '2026-01-01',
    atualizado_em: '2026-01-01',
    ...overrides,
  };
}

describe('descreverRegra', () => {
  it('quantidade a_partir_de + desconto de frete', () => {
    const regra = regraBase({ tipo_gatilho: 'quantidade', gatilho_modo: 'a_partir_de', gatilho_valor: 10, frete_max: 100 });
    expect(descreverRegra(regra)).toBe('Se 10+ livro(s) e frete ≤ R$ 100,00 → 100% de desconto no frete');
  });

  it('quantidade a_cada + item grátis', () => {
    const regra = regraBase({
      tipo_gatilho: 'quantidade',
      gatilho_modo: 'a_cada',
      gatilho_valor: 10,
      tipo_beneficio: 'item_gratis',
      beneficio_valor: 1,
      item_beneficio: "Teacher's Guide",
    });
    expect(descreverRegra(regra)).toBe("Se a cada 10 livro(s) → 1x Teacher's Guide grátis");
  });

  it('valor_pedido a_partir_de', () => {
    const regra = regraBase({ tipo_gatilho: 'valor_pedido', gatilho_modo: 'a_partir_de', gatilho_valor: 2000 });
    expect(descreverRegra(regra)).toContain('pedido ≥ R$ 2.000,00');
  });

  it('faixa_frete como gatilho principal', () => {
    const regra = regraBase({ tipo_gatilho: 'faixa_frete', frete_min: 50, frete_max: 150 });
    expect(descreverRegra(regra)).toContain('frete entre R$ 50,00 e R$ 150,00');
  });
});
