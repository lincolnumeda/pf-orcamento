// Lógica pura de montagem do pedido pro WooCommerce — sem rede, pra dar pra
// testar com qualquer runtime.

export interface ItemPedido {
  produto_id: string;
  nome: string;
  quantidade: number;
  preco_unitario: number;
}

export interface DadosPedido {
  itens: ItemPedido[];
  freteFinal: number;
  ajusteManual: number;
  responsavelNome: string;
  responsavelEmail: string;
  responsavelWhatsapp: string;
  cep: string;
}

export interface LineItemWoo {
  product_id: number;
  quantity: number;
  subtotal: string;
  total: string;
}

export interface PedidoWoo {
  status: string;
  billing: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    postcode: string;
  };
  shipping: {
    first_name: string;
    last_name: string;
    postcode: string;
  };
  line_items: LineItemWoo[];
  shipping_lines: { method_id: string; method_title: string; total: string }[];
  fee_lines: { name: string; total: string }[];
}

// Cada item do orçamento precisa de um produto correspondente no WooCommerce
// (orcamento.produtos.woocommerce_id) — se faltar, não dá pra criar o pedido
// (mais seguro falhar alto do que criar um pedido incompleto/errado).
export function montarLineItems(itens: ItemPedido[], mapaWooId: Map<string, number>): LineItemWoo[] {
  return itens.map((item) => {
    const wooId = mapaWooId.get(item.produto_id);
    if (!wooId) {
      throw new Error(`Produto "${item.nome}" não tem woocommerce_id cadastrado — não dá pra criar o pedido`);
    }
    const total = (item.preco_unitario * item.quantidade).toFixed(2);
    return { product_id: wooId, quantity: item.quantidade, subtotal: total, total };
  });
}

function separarNome(nomeCompleto: string): { primeiroNome: string; sobrenome: string } {
  const partes = nomeCompleto.trim().split(/\s+/);
  return { primeiroNome: partes[0] ?? '', sobrenome: partes.slice(1).join(' ') || '-' };
}

// subtotal/total nos line_items são setados explicitamente (não deixamos o
// Woo recalcular pelo preço de catálogo dele) pra garantir que o cliente paga
// exatamente o que foi cotado/enviado por email — o "snapshot congelado" do
// orçamento vale mesmo se o preço mudar depois no catálogo do Woo.
export function montarPedidoWoo(dados: DadosPedido, mapaWooId: Map<string, number>): PedidoWoo {
  const { primeiroNome, sobrenome } = separarNome(dados.responsavelNome);

  const shipping_lines =
    dados.freteFinal > 0
      ? [{ method_id: 'flat_rate', method_title: 'Frete', total: dados.freteFinal.toFixed(2) }]
      : [];

  const fee_lines = dados.ajusteManual !== 0 ? [{ name: 'Ajuste negociado', total: dados.ajusteManual.toFixed(2) }] : [];

  return {
    status: 'pending',
    billing: {
      first_name: primeiroNome,
      last_name: sobrenome,
      email: dados.responsavelEmail,
      phone: dados.responsavelWhatsapp,
      postcode: dados.cep,
    },
    shipping: { first_name: primeiroNome, last_name: sobrenome, postcode: dados.cep },
    line_items: montarLineItems(dados.itens, mapaWooId),
    shipping_lines,
    fee_lines,
  };
}

// caminhoCheckout é a slug real da página de Checkout do site (WooCommerce
// gera a URL "pagar pedido" a partir dela) — não necessariamente "checkout"
// em inglês, sites com página traduzida usam outra slug (ex: "finalizar-compra").
export function montarLinkPagamento(baseUrl: string, caminhoCheckout: string, pedidoId: number, orderKey: string): string {
  return `${baseUrl}/${caminhoCheckout}/order-pay/${pedidoId}/?pay_for_order=true&key=${orderKey}`;
}
