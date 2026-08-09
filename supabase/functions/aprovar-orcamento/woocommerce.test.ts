import { describe, expect, it } from 'vitest';
import { montarLineItems, montarPedidoWoo, montarLinkPagamento } from './woocommerce';

describe('montarLineItems', () => {
  it('monta os itens com o preço/quantidade do orçamento, não do catálogo do Woo', () => {
    const mapa = new Map([['p1', 13686]]);
    const itens = [{ produto_id: 'p1', nome: 'Hello Baby!', quantidade: 10, preco_unitario: 99.9 }];
    expect(montarLineItems(itens, mapa)).toEqual([{ product_id: 13686, quantity: 10, subtotal: '999.00', total: '999.00' }]);
  });

  it('lança erro se o produto não tiver woocommerce_id mapeado', () => {
    const itens = [{ produto_id: 'p1', nome: 'Assinatura Digital', quantidade: 1, preco_unitario: 99.9 }];
    expect(() => montarLineItems(itens, new Map())).toThrow(/woocommerce_id/);
  });
});

describe('montarPedidoWoo', () => {
  const dadosBase = {
    itens: [{ produto_id: 'p1', nome: 'Hello Baby!', quantidade: 10, preco_unitario: 99.9 }],
    freteFinal: 0,
    ajusteManual: 0,
    responsavelNome: 'Maria Silva',
    responsavelEmail: 'maria@example.com',
    responsavelWhatsapp: '11999999999',
    cep: '01310-100',
  };
  const mapa = new Map([['p1', 13686]]);

  it('separa nome e sobrenome do responsável', () => {
    const pedido = montarPedidoWoo(dadosBase, mapa);
    expect(pedido.billing.first_name).toBe('Maria');
    expect(pedido.billing.last_name).toBe('Silva');
  });

  it('sem frete e sem ajuste, não inclui shipping_lines nem fee_lines', () => {
    const pedido = montarPedidoWoo(dadosBase, mapa);
    expect(pedido.shipping_lines).toEqual([]);
    expect(pedido.fee_lines).toEqual([]);
  });

  it('com frete, inclui shipping_lines', () => {
    const pedido = montarPedidoWoo({ ...dadosBase, freteFinal: 35 }, mapa);
    expect(pedido.shipping_lines).toEqual([{ method_id: 'flat_rate', method_title: 'Frete', total: '35.00' }]);
  });

  it('com ajuste manual negativo (desconto), inclui fee_lines negativo', () => {
    const pedido = montarPedidoWoo({ ...dadosBase, ajusteManual: -50 }, mapa);
    expect(pedido.fee_lines).toEqual([{ name: 'Ajuste negociado', total: '-50.00' }]);
  });

  it('pedido sempre nasce como pending (aguardando pagamento)', () => {
    expect(montarPedidoWoo(dadosBase, mapa).status).toBe('pending');
  });
});

describe('montarLinkPagamento', () => {
  it('monta a URL de pagamento nativa do WooCommerce, com a slug real da página de checkout', () => {
    expect(montarLinkPagamento('https://pequenosfluentes.com.br', 'finalizar-compra', 123, 'wc_order_abc')).toBe(
      'https://pequenosfluentes.com.br/finalizar-compra/order-pay/123/?pay_for_order=true&key=wc_order_abc',
    );
  });
});
