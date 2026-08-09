import { describe, expect, it } from 'vitest';
import { calcularOrcamento } from './motorRegras';
import type { ItemOrcamento, Produto, Regra } from '../types';

// Espelha exatamente as 4 regras do seed (scripts/seed.ts), conforme a
// seção 3 do PROJETO-ORCAMENTO.md — inclui a decisão de colocar a regra da
// assinatura no mesmo grupo 'frete' das regras de desconto de frete.
function regrasBase(): Regra[] {
  const base = {
    ativa: true,
    frete_min: null,
    item_beneficio: null,
    criado_em: '2026-01-01',
    atualizado_em: '2026-01-01',
  };
  return [
    {
      ...base,
      id: 'r-assinatura',
      nome: 'Assinatura de brinde (pedido grande)',
      mensagem_cliente: '1 Assinatura Digital de brinde!',
      tipo_gatilho: 'valor_pedido',
      gatilho_modo: 'a_partir_de',
      gatilho_valor: 2000,
      frete_max: null,
      tipo_beneficio: 'item_gratis',
      beneficio_valor: 1,
      item_beneficio: 'Assinatura Digital',
      grupo_exclusivo: 'frete',
      prioridade: 1,
    },
    {
      ...base,
      id: 'r-frete-gratis',
      nome: 'Frete grátis (pedido menor)',
      mensagem_cliente: 'Frete grátis!',
      tipo_gatilho: 'quantidade',
      gatilho_modo: 'a_partir_de',
      gatilho_valor: 10,
      frete_max: 100,
      tipo_beneficio: 'desconto_frete_pct',
      beneficio_valor: 100,
      grupo_exclusivo: 'frete',
      prioridade: 2,
    },
    {
      ...base,
      id: 'r-frete-50',
      nome: 'Frete 50% off (pedido distante)',
      mensagem_cliente: '50% de desconto no frete!',
      tipo_gatilho: 'quantidade',
      gatilho_modo: 'a_partir_de',
      gatilho_valor: 10,
      frete_min: 100,
      frete_max: null,
      tipo_beneficio: 'desconto_frete_pct',
      beneficio_valor: 50,
      grupo_exclusivo: 'frete',
      prioridade: 3,
    },
    {
      ...base,
      id: 'r-tg-brinde',
      nome: "Teacher's Guide de brinde",
      mensagem_cliente: null, // testa o fallback pro `nome`
      tipo_gatilho: 'quantidade',
      gatilho_modo: 'a_cada',
      gatilho_valor: 10,
      frete_max: null,
      tipo_beneficio: 'item_gratis',
      beneficio_valor: 1,
      item_beneficio: "Teacher's Guide",
      grupo_exclusivo: 'brinde-livro',
      prioridade: 1,
    },
  ];
}

const produtosBase: Produto[] = [
  {
    id: 'p-hello-baby',
    nome: 'Hello Baby!',
    categoria: 'infantil',
    preco: 99.9,
    livro_relacionado: null,
    ativo: true,
    woocommerce_id: 13686,
  },
  {
    id: 'p-tg',
    nome: "Teacher's Guide — Hello Baby!",
    categoria: 'teachers_guide',
    preco: 139.9,
    livro_relacionado: 'Hello Baby!',
    ativo: true,
    woocommerce_id: 14055,
  },
  {
    id: 'p-assinatura',
    nome: 'Assinatura Digital',
    categoria: 'assinatura',
    preco: 99.9,
    livro_relacionado: null,
    ativo: true,
    woocommerce_id: null,
  },
];

function livro(nome: string, quantidade: number, preco = 99.9): ItemOrcamento {
  return { produto_id: nome, nome, categoria: 'infantil', quantidade, preco_unitario: preco, teachers_guide: false };
}

function teachersGuide(nome: string, quantidade = 1, preco = 139.9): ItemOrcamento {
  return { produto_id: nome, nome, categoria: 'teachers_guide', quantidade, preco_unitario: preco, teachers_guide: true };
}

describe('calcularOrcamento', () => {
  it('não dispara nada abaixo dos gatilhos, e sinaliza near-miss quando está perto', () => {
    const resultado = calcularOrcamento({
      itens: [livro('Hello Baby!', 8)],
      freteBruto: 50,
      regras: regrasBase(),
      produtos: produtosBase,
    });

    expect(resultado.regrasAplicadas).toHaveLength(0);
    expect(resultado.freteFinal).toBe(50);
    expect(resultado.nearMiss.map((h) => h.nome).sort()).toEqual(
      ['Frete grátis (pedido menor)', "Teacher's Guide de brinde"].sort(),
    );
    expect(resultado.nearMiss.every((h) => h.falta === 2)).toBe(true);
  });

  it('10+ livros com frete baixo: frete grátis + 1 Teacher\'s Guide de brinde', () => {
    const resultado = calcularOrcamento({
      itens: [livro('Hello Baby!', 10)],
      freteBruto: 80,
      regras: regrasBase(),
      produtos: produtosBase,
    });

    expect(resultado.freteFinal).toBe(0);
    expect(resultado.regrasAplicadas.map((r) => r.nome).sort()).toEqual(
      ['Frete grátis (pedido menor)', "Teacher's Guide de brinde"].sort(),
    );
    expect(resultado.itensGratis).toEqual([
      { nome: "Teacher's Guide", quantidade: 1, precoUnitario: 139.9, regraId: 'r-tg-brinde' },
    ]);

    // subtotal é só o que o cliente escolheu no formulário (10 livros) — o
    // Teacher's Guide de brinde não entra aqui, ele nem está no carrinho.
    expect(resultado.subtotal).toBe(999);
    expect(resultado.totalFinal).toBe(999); // frete grátis, e nada a descontar (TG não estava no carrinho)

    const freteGratis = resultado.regrasAplicadas.find((r) => r.regra_id === 'r-frete-gratis')!;
    expect(freteGratis.mensagem_cliente).toBe('Frete grátis!');

    // r-tg-brinde não tem mensagem_cliente definida — cai no fallback pro nome.
    // valor_economizado é sempre o valor nominal do benefício (pro cliente ver
    // o que ele "ganhou"), mesmo quando não há nada a descontar do total.
    const tgBrinde = resultado.regrasAplicadas.find((r) => r.regra_id === 'r-tg-brinde')!;
    expect(tgBrinde.mensagem_cliente).toBe("Teacher's Guide de brinde");
    expect(tgBrinde.valor_economizado).toBe(139.9); // 1x Teacher's Guide a R$139,90
  });

  it('cliente já tem 2 Teacher\'s Guide no carrinho: o brinde desconta 1 de verdade', () => {
    const resultado = calcularOrcamento({
      itens: [
        livro('Little Explorers', 5),
        livro('Hello Baby!', 5),
        teachersGuide('Teacher\'s Guide — Little Explorers', 1),
        teachersGuide('Teacher\'s Guide — Hello Baby!', 1),
      ],
      freteBruto: 80,
      regras: regrasBase(),
      produtos: produtosBase,
    });

    // subtotal real do carrinho: 5+5 livros (999) + 2 Teacher's Guide (279,80)
    expect(resultado.subtotal).toBeCloseTo(1278.8, 2);

    const tgBrinde = resultado.regrasAplicadas.find((r) => r.regra_id === 'r-tg-brinde')!;
    expect(tgBrinde.valor_economizado).toBe(139.9); // valor nominal de 1x TG

    // como 2 TGs já estão no carrinho, o brinde desconta 1 de verdade do total.
    // Frete grátis some do total, e só 1 dos 2 TGs é cobrado: 999 + 139,90.
    expect(resultado.freteFinal).toBe(0);
    expect(resultado.totalFinal).toBe(1138.9);
  });

  it('10+ livros com frete alto: 50% off no frete, não frete grátis', () => {
    const resultado = calcularOrcamento({
      itens: [livro('Hello Baby!', 10)],
      freteBruto: 150,
      regras: regrasBase(),
      produtos: produtosBase,
    });

    expect(resultado.freteFinal).toBe(75);
    expect(resultado.regrasAplicadas.map((r) => r.nome)).toContain('Frete 50% off (pedido distante)');
    expect(resultado.regrasAplicadas.map((r) => r.nome)).not.toContain('Frete grátis (pedido menor)');
  });

  it('pedido grande (>=R$2000) vence o grupo frete: 1 assinatura grátis, sem desconto de frete', () => {
    const resultado = calcularOrcamento({
      itens: [livro('Hello Baby!', 10, 250)], // 10 livros a R$250 = R$2500 (livros reais escolhidos)
      freteBruto: 80,
      regras: regrasBase(),
      produtos: produtosBase,
    });

    // subtotal é só o carrinho real do cliente — os brindes (assinatura + TG)
    // não entram aqui, mesmo que também disparem.
    expect(resultado.subtotal).toBe(2500);
    expect(resultado.freteFinal).toBe(80); // sem desconto — a regra da assinatura venceu o grupo
    expect(resultado.itensGratis).toContainEqual({
      nome: 'Assinatura Digital',
      quantidade: 1,
      precoUnitario: 99.9,
      regraId: 'r-assinatura',
    });
    expect(resultado.regrasAplicadas.map((r) => r.nome)).not.toContain('Frete grátis (pedido menor)');

    const assinatura = resultado.regrasAplicadas.find((r) => r.regra_id === 'r-assinatura')!;
    expect(assinatura.valor_economizado).toBe(99.9); // 1x Assinatura Digital a R$99,90

    // Total final só cobra o que foi de fato escolhido (2500 livros) + frete
    // sem desconto — os brindes (assinatura + TG) não entram na conta.
    expect(resultado.totalFinal).toBe(2580);
  });

  it('20 livros: brinde de Teacher\'s Guide dobra (a_cada 10)', () => {
    const resultado = calcularOrcamento({
      itens: [livro('Hello Baby!', 20)],
      freteBruto: 80,
      regras: regrasBase(),
      produtos: produtosBase,
    });

    expect(resultado.itensGratis).toContainEqual({
      nome: "Teacher's Guide",
      quantidade: 2,
      precoUnitario: 139.9,
      regraId: 'r-tg-brinde',
    });

    const tgBrinde = resultado.regrasAplicadas.find((r) => r.regra_id === 'r-tg-brinde')!;
    expect(tgBrinde.valor_economizado).toBe(279.8); // 2x Teacher's Guide a R$139,90
  });

  it('regra inativa nunca dispara', () => {
    const regras = regrasBase().map((r) => (r.id === 'r-frete-gratis' ? { ...r, ativa: false } : r));
    const resultado = calcularOrcamento({
      itens: [livro('Hello Baby!', 10)],
      freteBruto: 80,
      regras,
      produtos: produtosBase,
    });

    expect(resultado.regrasAplicadas.map((r) => r.nome)).not.toContain('Frete grátis (pedido menor)');
  });
});
