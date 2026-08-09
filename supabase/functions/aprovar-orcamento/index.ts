import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { montarPedidoWoo, montarLinkPagamento, type ItemPedido } from './woocommerce.ts';

const WOOCOMMERCE_URL = Deno.env.get('WOOCOMMERCE_URL')!;
const WOOCOMMERCE_CONSUMER_KEY = Deno.env.get('WOOCOMMERCE_CONSUMER_KEY')!;
const WOOCOMMERCE_CONSUMER_SECRET = Deno.env.get('WOOCOMMERCE_CONSUMER_SECRET')!;
// Slug real da página de Checkout do site — não é "checkout" em inglês nesse
// site, é "finalizar-compra" (conferido em wp-json/wp/v2/pages). Se a página
// mudar de slug um dia, só trocar esse secret, sem precisar redeployar.
const WOOCOMMERCE_CHECKOUT_PATH = Deno.env.get('WOOCOMMERCE_CHECKOUT_PATH') ?? 'checkout';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method Not Allowed' }, 405);
  }

  try {
    const { orcamento_id, acao } = await req.json();
    if (!orcamento_id) {
      return jsonResponse({ error: 'orcamento_id é obrigatório' }, 400);
    }

    // service_role: essa function atende a página pública /aprovar/[id], sem
    // sessão autenticada — orcamento.orcamentos exige leitura autenticada.
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    ).schema('orcamento');

    const { data: orcamento, error: orcamentoError } = await supabase
      .from('orcamentos')
      .select('*')
      .eq('id', orcamento_id)
      .single();

    if (orcamentoError || !orcamento) {
      return jsonResponse({ error: 'Orçamento não encontrado' }, 404);
    }

    if (acao === 'confirmar') {
      // Idempotente: se já tem link de pagamento, não cria pedido de novo —
      // só devolve o mesmo link (evita pedido duplicado em clique repetido).
      if (orcamento.link_pagamento) {
        return jsonResponse({ link_pagamento: orcamento.link_pagamento });
      }

      const itens: ItemPedido[] = orcamento.itens;
      const produtoIds = itens.map((i) => i.produto_id);

      const { data: produtos, error: produtosError } = await supabase
        .from('produtos')
        .select('id, woocommerce_id')
        .in('id', produtoIds);

      if (produtosError) throw produtosError;

      const mapaWooId = new Map(
        (produtos ?? [])
          .filter((p): p is { id: string; woocommerce_id: number } => p.woocommerce_id !== null)
          .map((p) => [p.id, p.woocommerce_id]),
      );

      const payload = montarPedidoWoo(
        {
          itens,
          freteFinal: orcamento.frete_final,
          ajusteManual: orcamento.ajuste_manual,
          responsavelNome: orcamento.responsavel_nome,
          responsavelEmail: orcamento.responsavel_email,
          responsavelWhatsapp: orcamento.responsavel_whatsapp,
          cep: orcamento.cep,
        },
        mapaWooId,
      );

      const auth = btoa(`${WOOCOMMERCE_CONSUMER_KEY}:${WOOCOMMERCE_CONSUMER_SECRET}`);
      const respostaWoo = await fetch(`${WOOCOMMERCE_URL}/wp-json/wc/v3/orders`, {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!respostaWoo.ok) {
        const texto = await respostaWoo.text();
        throw new Error(`WooCommerce respondeu ${respostaWoo.status}: ${texto}`);
      }

      const pedido = await respostaWoo.json();
      const linkPagamento = montarLinkPagamento(WOOCOMMERCE_URL, WOOCOMMERCE_CHECKOUT_PATH, pedido.id, pedido.order_key);

      const { error: updateError } = await supabase
        .from('orcamentos')
        .update({ status: 'aprovado', link_pagamento: linkPagamento, atualizado_em: new Date().toISOString() })
        .eq('id', orcamento_id);

      if (updateError) throw updateError;

      return jsonResponse({ link_pagamento: linkPagamento });
    }

    // Padrão (sem ação ou acao='consultar'): só devolve o estado atual, pra
    // página /aprovar/[id] sempre mostrar o que tem no banco agora — inclui
    // qualquer ajuste manual feito na Central depois do email ter sido enviado.
    return jsonResponse({ orcamento });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : 'Erro desconhecido' }, 500);
  }
});
