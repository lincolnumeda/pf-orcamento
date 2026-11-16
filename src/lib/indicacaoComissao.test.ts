import { describe, expect, it } from 'vitest';
import { avisosFechamento, calcularComissao, calcularComissaoDoOrcamento, type OrcamentoParaComissao } from './indicacaoComissao';
import type { ItemOrcamento, RegraAplicada } from '../types';

function item(nome: string, categoria: ItemOrcamento['categoria'], quantidade: number, preco: number): ItemOrcamento {
  return {
    produto_id: nome,
    nome,
    categoria,
    quantidade,
    preco_unitario: preco,
    teachers_guide: categoria === 'teachers_guide',
  };
}

function regra(parcial: Partial<RegraAplicada>): RegraAplicada {
  return {
    regra_id: 'r',
    nome: 'Regra',
    mensagem_cliente: 'Regra',
    tipo_beneficio: 'desconto_frete_pct',
    beneficio_valor: 0,
    item_beneficio: null,
    valor_economizado: 0,
    ...parcial,
  };
}

function orcamento(parcial: Partial<OrcamentoParaComissao>): OrcamentoParaComissao {
  return { itens: [], regras_aplicadas: [], total_final: 0, frete_final: 0, ajuste_manual: 0, ...parcial };
}

describe('calcularComissaoDoOrcamento', () => {
  it('conta só Class Books (infantil e tots), sem Teacher\'s Guide', () => {
    const r = calcularComissaoDoOrcamento(
      orcamento({
        itens: [
          item('Hello Baby!', 'infantil', 6, 99.9),
          item('Tots 1', 'tots', 6, 99.9),
          item("Teacher's Guide — Hello Baby!", 'teachers_guide', 1, 139.9),
        ],
        total_final: 12 * 99.9 + 139.9 + 30,
        frete_final: 30,
      }),
    );
    expect(r.qtdLivros).toBe(12);
    expect(r.valorLivros).toBe(1198.8);
    expect(r.comissao).toBe(119.88);
  });

  it('usa o preço congelado no orçamento, não um preço de tabela', () => {
    const antigo = calcularComissaoDoOrcamento(orcamento({ itens: [item('Tiny People', 'infantil', 11, 99.9)] }));
    const novo = calcularComissaoDoOrcamento(orcamento({ itens: [item('Tiny People', 'infantil', 11, 119.9)] }));
    expect(antigo.valorLivros).toBe(1098.9);
    expect(novo.valorLivros).toBe(1318.9);
  });

  it('ignora frete e brindes de Teacher\'s Guide/assinatura', () => {
    const r = calcularComissaoDoOrcamento(
      orcamento({
        itens: [item('Little Explorers', 'infantil', 20, 100), item("Teacher's Guide — Little Explorers", 'teachers_guide', 2, 139.9)],
        regras_aplicadas: [
          regra({ tipo_beneficio: 'desconto_frete_pct', beneficio_valor: 100, valor_economizado: 80 }),
          regra({ tipo_beneficio: 'item_gratis', beneficio_valor: 1, item_beneficio: "Teacher's Guide", valor_economizado: 139.9 }),
          regra({ tipo_beneficio: 'item_gratis', beneficio_valor: 2, item_beneficio: 'Assinatura Digital', valor_economizado: 199.8 }),
        ],
        total_final: 2000 + 139.9,
        frete_final: 0,
      }),
    );
    expect(r.valorLivros).toBe(2000);
    expect(r.comissao).toBe(200);
  });

  it('aplica desconto percentual no total à parte dos livros', () => {
    const r = calcularComissaoDoOrcamento(
      orcamento({
        itens: [item('Tots 2', 'tots', 15, 100), item("Teacher's Guide — Tots 2", 'teachers_guide', 1, 140)],
        regras_aplicadas: [regra({ tipo_beneficio: 'desconto_total_pct', beneficio_valor: 5 })],
        total_final: (1500 + 140) * 0.95,
      }),
    );
    expect(r.valorBruto).toBe(1500);
    expect(r.valorLivros).toBe(1425);
    expect(r.comissao).toBe(142.5);
  });

  it('desconta brinde que é um Class Book já no carrinho', () => {
    const r = calcularComissaoDoOrcamento(
      orcamento({
        itens: [item('Hello Baby!', 'infantil', 12, 100)],
        regras_aplicadas: [regra({ tipo_beneficio: 'item_gratis', beneficio_valor: 1, item_beneficio: 'Hello Baby!' })],
        total_final: 1100,
      }),
    );
    expect(r.valorLivros).toBe(1100);
  });

  it('rateia ajuste manual negativo proporcionalmente; ignora acréscimo', () => {
    const base = {
      itens: [item('Hello Baby!', 'infantil', 15, 100), item("Teacher's Guide — Hello Baby!", 'teachers_guide', 1, 500)],
      total_final: 2000 + 50,
      frete_final: 50,
    };
    // livros = 1500 de 2000 em produtos → 75% do desconto de 200 = 150
    expect(calcularComissaoDoOrcamento(orcamento({ ...base, ajuste_manual: -200 })).valorLivros).toBe(1350);
    expect(calcularComissaoDoOrcamento(orcamento({ ...base, ajuste_manual: 300 })).valorLivros).toBe(1500);
  });

  it('pedido sem livros dá zero', () => {
    const r = calcularComissaoDoOrcamento(orcamento({ itens: [item("Teacher's Guide — Tots 1", 'teachers_guide', 3, 139.9)] }));
    expect(r).toEqual({ qtdLivros: 0, valorBruto: 0, valorLivros: 0, comissao: 0 });
  });
});

describe('calcularComissao', () => {
  it('10% com arredondamento em centavos', () => {
    expect(calcularComissao(1098.9)).toBe(109.89);
    expect(calcularComissao(1234.56)).toBe(123.46);
    expect(calcularComissao(0)).toBe(0);
  });
});

describe('avisosFechamento', () => {
  const base = {
    validaAte: '2026-12-20T12:00:00Z',
    indicacaoCriadaEm: '2026-11-20T12:00:00Z',
    fechamentoEm: new Date('2026-12-01T12:00:00Z'),
  };

  it('sem avisos quando está tudo certo', () => {
    expect(avisosFechamento({ ...base, qtdLivros: 11, orcamentoCriadoEm: '2026-11-25T12:00:00Z' })).toEqual([]);
  });

  it('avisa com 10 livros ou menos', () => {
    const avisos = avisosFechamento({ ...base, qtdLivros: 10 });
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toContain('10 Class Books');
  });

  it('avisa quando o fechamento passou do prazo', () => {
    const avisos = avisosFechamento({ ...base, qtdLivros: 20, fechamentoEm: new Date('2026-12-21T12:00:00Z') });
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toContain('passou do prazo');
  });

  it('avisa quando o orçamento é anterior à indicação', () => {
    const avisos = avisosFechamento({ ...base, qtdLivros: 20, orcamentoCriadoEm: '2026-11-01T12:00:00Z' });
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toContain('ANTES da indicação');
  });
});
