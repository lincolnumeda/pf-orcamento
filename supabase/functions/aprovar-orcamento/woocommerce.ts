// Lógica pura de montagem do link de carrinho assinado pro WooCommerce —
// sem rede, pra dar pra testar com qualquer runtime.
//
// Esta function NÃO cria mais pedido nenhum via API REST do WooCommerce.
// Em vez disso, monta uma URL assinada (HMAC-SHA256) que aponta pro próprio
// site — um snippet no WordPress (ver wpcode/orcamento-carrinho-checkout.php)
// confere a assinatura, popula o carrinho do cliente com WC()->cart nativo
// (itens, preço pinado, ajuste, frete) e manda ele pro checkout normal do
// site (/finalizar-compra/). Nunca cria WC_Order, nunca toca em order-pay
// nem em nenhum hook de pagamento — só carrinho/sessão.

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
}

export interface ItemCarrinho {
  wooId: number;
  quantidade: number;
  precoUnitario: number;
}

// Cada item do orçamento precisa de um produto correspondente no WooCommerce
// (orcamento.produtos.woocommerce_id) — se faltar, não dá pra montar o link
// (mais seguro falhar alto do que mandar o cliente pra um carrinho
// incompleto/errado).
export function montarItensCarrinho(itens: ItemPedido[], mapaWooId: Map<string, number>): ItemCarrinho[] {
  const itensCarrinho = itens.map((item) => {
    const wooId = mapaWooId.get(item.produto_id);
    if (!wooId) {
      throw new Error(`Produto "${item.nome}" não tem woocommerce_id cadastrado — não dá pra montar o link do carrinho`);
    }
    if (!Number.isInteger(item.quantidade) || item.quantidade <= 0) {
      throw new Error(`Produto "${item.nome}" tem quantidade inválida (${item.quantidade}) — precisa ser um inteiro positivo`);
    }
    return { wooId, quantidade: item.quantidade, precoUnitario: item.preco_unitario };
  });

  // Ordenado por wooId crescente — precisa ser determinístico, porque essa
  // mesma ordem entra na string que é assinada (ver montarPayloadAssinatura)
  // e reconferida no WordPress; se a ordem mudasse entre montar e verificar,
  // a assinatura nunca bateria.
  return itensCarrinho.sort((a, b) => a.wooId - b.wooId);
}

// "id1:qtd1:preco1,id2:qtd2:preco2,..." — formato compacto que cabe numa URL
// e que o snippet do WordPress sabe interpretar. Preço sempre com 2 casas
// fixas (mesma formatação usada na assinatura, ver montarPayloadAssinatura —
// TEM que bater exatamente com o que o PHP recalcula, senão a verificação
// de assinatura falha por divergência de formatação, não por adulteração).
export function formatarItensParaUrl(itens: ItemCarrinho[]): string {
  return itens.map((item) => `${item.wooId}:${item.quantidade}:${item.precoUnitario.toFixed(2)}`).join(',');
}

// 15 dias corridos — aproximação segura da promessa de "10 dias úteis" que
// já está no texto do email de aprovação (corridos >= úteis, nunca expira
// antes do que foi prometido).
const VALIDADE_LINK_SEGUNDOS = 15 * 24 * 60 * 60;

export function calcularExpiracao(agora: Date): number {
  return Math.floor(agora.getTime() / 1000) + VALIDADE_LINK_SEGUNDOS;
}

// String canônica que é assinada — TEM que ser montada exatamente igual
// aqui e no snippet PHP (mesma ordem de campos, mesmo separador "|", mesma
// formatação de número). Documentado nos dois lados pra não divergir.
export function montarPayloadAssinatura(orcamentoId: string, itensUrl: string, ajuste: number, frete: number, exp: number): string {
  return `${orcamentoId}|${itensUrl}|${ajuste.toFixed(2)}|${frete.toFixed(2)}|${exp}`;
}

// HMAC-SHA256 em hex minúsculo, via Web Crypto (disponível nativamente no
// runtime Deno das Edge Functions, sem precisar de lib externa). O
// equivalente exato do lado do WordPress é hash_hmac('sha256', $payload,
// $segredo) — mesmo algoritmo, mesma codificação de saída (hex, minúsculo);
// conferido manualmente que os dois produzem o mesmo valor pro mesmo
// payload/segredo antes de este arquivo ser escrito.
export async function assinarPayload(payload: string, segredo: string): Promise<string> {
  const chave = await crypto.subtle.importKey('raw', new TextEncoder().encode(segredo), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  const assinatura = await crypto.subtle.sign('HMAC', chave, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(assinatura))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export interface LinkCarrinho {
  itensUrl: string;
  exp: number;
  sig: string;
}

// Monta os 3 valores que dependem da assinatura (itens formatados, exp e a
// própria assinatura). Separado de montarUrlCarrinho só pra facilitar teste
// e log de cada parte isoladamente.
export async function montarLinkCarrinhoAssinado(
  orcamentoId: string,
  dados: DadosPedido,
  mapaWooId: Map<string, number>,
  segredo: string,
  agora: Date,
): Promise<LinkCarrinho> {
  const itensUrl = formatarItensParaUrl(montarItensCarrinho(dados.itens, mapaWooId));
  const exp = calcularExpiracao(agora);
  const payload = montarPayloadAssinatura(orcamentoId, itensUrl, dados.ajusteManual, dados.freteFinal, exp);
  const sig = await assinarPayload(payload, segredo);
  return { itensUrl, exp, sig };
}

// A URL final não precisa apontar pra nenhuma página específica — o snippet
// do WordPress escuta o parâmetro pf_orcamento_cart em qualquer requisição
// (hook template_redirect), então a raiz do site serve. Sem rewrite, sem
// depender de slug de página nenhuma.
export function montarUrlCarrinho(
  baseUrl: string,
  orcamentoId: string,
  itensUrl: string,
  ajuste: number,
  frete: number,
  exp: number,
  sig: string,
): string {
  const params = new URLSearchParams({
    pf_orcamento_cart: '1',
    orcamento: orcamentoId,
    itens: itensUrl,
    ajuste: ajuste.toFixed(2),
    frete: frete.toFixed(2),
    exp: String(exp),
    sig,
  });
  return `${baseUrl}/?${params.toString()}`;
}
