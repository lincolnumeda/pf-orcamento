import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { montarLinkCarrinhoAssinado, montarUrlCarrinho, type DadosPedido, type ItemPedido } from './woocommerce.ts';

const WOOCOMMERCE_URL = Deno.env.get('WOOCOMMERCE_URL')!;
// Segredo dedicado só pra assinar/conferir o link de carrinho — não é o
// mesmo WOOCOMMERCE_CONSUMER_KEY/SECRET (aquele é credencial da API REST;
// este é um HMAC verificado pelo snippet PHP no WordPress, propósito
// diferente, rotação independente). Precisa estar definido IDENTICAMENTE
// como constante PHP no wp-config.php (ou snippet "PHP Constants" no
// WPCode) com o nome PF_ORCAMENTO_LINK_SECRET.
const PF_ORCAMENTO_LINK_SECRET = Deno.env.get('PF_ORCAMENTO_LINK_SECRET')!;

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
      // Idempotente: se já tem link, não monta de novo — só devolve o mesmo
      // (evita assinar duas vezes, com exp diferente, em clique repetido).
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

      const dados: DadosPedido = {
        itens,
        freteFinal: orcamento.frete_final,
        ajusteManual: orcamento.ajuste_manual,
      };

      // Não fazemos NENHUMA chamada de rede pro WooCommerce aqui — só
      // matemática local (montar/assinar o link). O WooCommerce só precisa
      // estar de pé quando o cliente efetivamente clicar no link, não no
      // momento da confirmação.
      const { itensUrl, exp, sig } = await montarLinkCarrinhoAssinado(orcamento_id, dados, mapaWooId, PF_ORCAMENTO_LINK_SECRET, new Date());
      const linkCarrinho = montarUrlCarrinho(WOOCOMMERCE_URL, orcamento_id, itensUrl, dados.ajusteManual, dados.freteFinal, exp, sig);

      const { error: updateError } = await supabase
        .from('orcamentos')
        .update({ status: 'aprovado', link_pagamento: linkCarrinho, atualizado_em: new Date().toISOString() })
        .eq('id', orcamento_id);

      if (updateError) throw updateError;

      return jsonResponse({ link_pagamento: linkCarrinho });
    }

    // Padrão (sem ação ou acao='consultar'): só devolve o estado atual, pra
    // página /aprovar/[id] sempre mostrar o que tem no banco agora — inclui
    // qualquer ajuste manual feito na Central depois do email ter sido enviado.
    return jsonResponse({ orcamento });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : 'Erro desconhecido' }, 500);
  }
});
