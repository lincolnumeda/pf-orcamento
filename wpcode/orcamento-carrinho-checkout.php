<?php
/**
 * ATENÇÃO — este arquivo NÃO faz parte do build/deploy deste projeto
 * (pf-orcamento). Ele não roda em lugar nenhum sozinho.
 *
 * É só uma cópia versionada, pra revisão, do snippet PHP que deve ser colado
 * manualmente no WPCode do WordPress do site principal (pequenosfluentes.com.br).
 * Cole SEM a tag <?php de abertura (o WPCode já assume PHP) e escolha o tipo
 * "PHP Snippet" com localização "Run Everywhere".
 *
 * HISTÓRICO: substitui por completo a abordagem anterior (formulário de
 * endereço na tela "Pay for Order"), abandonada porque essa tela também
 * escondia o campo de CPF (exigido por lei pra NF-e) e outros campos que
 * seriam necessários remendar um por um. A abordagem atual manda o cliente
 * pro checkout NATIVO e não-modificado do site (/finalizar-compra/), já
 * com carrinho/ajuste/frete prontos — todo campo (endereço, CPF, etc.)
 * continua sendo o formulário real do WooCommerce, sem nenhuma alteração.
 *
 * OBJETIVO
 * Quando o cliente confirma em /aprovar/[id], a Edge Function
 * aprovar-orcamento monta um link assinado (não cria mais pedido nenhum via
 * API REST). Esse link cai aqui: confere a assinatura, popula o carrinho do
 * cliente com os itens do orçamento (preço pinado no valor cotado), guarda
 * o ajuste negociado e o frete negociado na sessão do WooCommerce, e manda
 * o cliente pro checkout normal do site.
 *
 * FRONTEIRA DE SEGURANÇA — não-negociável
 * Este arquivo NUNCA usa woocommerce_before_pay_action, order-pay, nem
 * qualquer hook de criação/processamento de pedido ou pagamento. Tudo aqui
 * é WC()->cart, WC()->session e o filtro nativo de frete
 * (woocommerce_package_rates) — carrinho e sessão, nunca pedido. A partir do
 * momento em que o cliente chega no checkout, ele passa por um fluxo 100%
 * nativo do WooCommerce, sem nenhuma modificação.
 *
 * A ÚNICA trava de todo o comportamento abaixo (fora a checagem de
 * assinatura, que é sobre o link em si) é a função
 * pf_orcamento_precos_da_sessao_se_valido(): só existe alguma coisa a fazer
 * quando (a) a sessão do WooCommerce tem os dados deste fluxo E (b) o
 * conteúdo ATUAL do carrinho ainda é exatamente o mesmo conjunto de produtos
 * que foi populado. Cliente comum do site nunca tem essas chaves na sessão
 * — os hooks são no-op pra ele, sempre.
 */

// -----------------------------------------------------------------------
// CONFIGURAÇÃO — PF_ORCAMENTO_LINK_SECRET precisa ser definido ANTES deste
// snippet (wp-config.php, ou um snippet separado "PHP Constants" no
// WPCode), com o MESMO valor da env var PF_ORCAMENTO_LINK_SECRET da Edge
// Function aprovar-orcamento. É um segredo dedicado — não é o
// WOOCOMMERCE_CONSUMER_KEY/SECRET da API REST (propósito diferente).
// Exemplo (NÃO cole o valor real aqui, isso é só ilustrativo):
//   define( 'PF_ORCAMENTO_LINK_SECRET', 'COLE_O_SEGREDO_AQUI' );
// -----------------------------------------------------------------------
if ( ! defined( 'PF_ORCAMENTO_LINK_SECRET' ) ) {
	return; // segredo não configurado -> este arquivo inteiro fica inerte
}

// -----------------------------------------------------------------------
// PASSO 1 — popular o carrinho a partir do link assinado.
//
// Hook: template_redirect. Roda cedo, em QUALQUER página do site, antes de
// qualquer template renderizar — não precisa de rewrite nem de página
// especial; o link pode apontar pra raiz do site. Só entra em ação quando o
// parâmetro pf_orcamento_cart está presente; em qualquer outra requisição
// normal do site (a esmagadora maioria), essa condição é falsa e a função
// não faz mais nada além dessa checagem.
// -----------------------------------------------------------------------
add_action( 'template_redirect', 'pf_orcamento_popular_carrinho' );
function pf_orcamento_popular_carrinho() {
	if ( empty( $_GET['pf_orcamento_cart'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		return; // não é uma requisição deste fluxo — não faz NADA
	}

	if ( ! function_exists( 'WC' ) || ! WC()->cart ) {
		return; // WooCommerce não carregado por algum motivo — aborta em silêncio, nunca fatal
	}

	$dados = pf_orcamento_validar_link();
	if ( ! $dados ) {
		// Link inválido, adulterado ou expirado — não expõe o motivo, só
		// manda pro carrinho normal (vazio) do site.
		wp_safe_redirect( wc_get_cart_url() );
		exit;
	}

	// Carrinho sempre zerado antes de popular — nunca soma em cima do que o
	// cliente já tinha de uma navegação anterior no site (decisão explícita).
	WC()->cart->empty_cart();

	$produtos_adicionados = array();
	$precos_pinados       = array();

	foreach ( $dados['itens'] as $item ) {
		$adicionou = WC()->cart->add_to_cart( $item['id'], $item['qtd'] );
		if ( ! $adicionou ) {
			continue; // produto sem estoque / despublicado / etc. — não trava os outros itens
		}
		$produtos_adicionados[]         = $item['id'];
		$precos_pinados[ $item['id'] ] = $item['preco'];
	}

	if ( empty( $produtos_adicionados ) ) {
		// Nenhum item entrou — não faz sentido mandar pro checkout de um
		// carrinho vazio. O carrinho nativo mostra o que o WooCommerce achar
		// relevante avisar (ex: aviso de produto indisponível).
		wp_safe_redirect( wc_get_cart_url() );
		exit;
	}

	// Guarda tudo na sessão do WooCommerce — os 3 hooks do Passo 2 leem
	// daqui a CADA recálculo do carrinho, do carrinho até o checkout.
	WC()->session->set( 'pf_orcamento_id', $dados['orcamento_id'] );
	WC()->session->set( 'pf_orcamento_precos', $precos_pinados );
	WC()->session->set( 'pf_orcamento_ajuste', $dados['ajuste'] );
	WC()->session->set( 'pf_orcamento_frete', $dados['frete'] );

	wp_safe_redirect( wc_get_checkout_url() );
	exit;
}

// -----------------------------------------------------------------------
// Confere a assinatura HMAC e a expiração do link, e devolve os dados já
// validados e convertidos — ou null se qualquer coisa não bater. Nunca
// confia em nenhum valor de $_GET sem passar por aqui primeiro.
// -----------------------------------------------------------------------
function pf_orcamento_validar_link() {
	$campos_obrigatorios = array( 'orcamento', 'itens', 'ajuste', 'frete', 'exp', 'sig' );
	foreach ( $campos_obrigatorios as $campo ) {
		if ( ! isset( $_GET[ $campo ] ) || '' === $_GET[ $campo ] ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			return null; // faltou parâmetro -> link não é válido, ponto final
		}
	}

	$orcamento_id  = sanitize_text_field( wp_unslash( $_GET['orcamento'] ) ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
	$itens_url     = sanitize_text_field( wp_unslash( $_GET['itens'] ) ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
	$ajuste        = (float) $_GET['ajuste']; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
	$frete         = (float) $_GET['frete']; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
	$exp           = absint( $_GET['exp'] ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
	$sig_recebida  = sanitize_text_field( wp_unslash( $_GET['sig'] ) ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended

	// MESMA formatação usada do lado da Edge Function (2 casas fixas nos
	// valores monetários, mesma ordem, mesmo separador "|") — se divergir
	// aqui, a assinatura nunca bate, mesmo com um link genuíno. Espelha
	// exatamente montarPayloadAssinatura() em
	// supabase/functions/aprovar-orcamento/woocommerce.ts.
	$payload = $orcamento_id . '|' . $itens_url . '|'
		. number_format( $ajuste, 2, '.', '' ) . '|'
		. number_format( $frete, 2, '.', '' ) . '|'
		. $exp;

	$sig_calculada = hash_hmac( 'sha256', $payload, PF_ORCAMENTO_LINK_SECRET );

	// hash_equals (não ==) — comparação em tempo constante, pra não vazar
	// informação sobre a assinatura correta através do tempo de resposta.
	if ( ! hash_equals( $sig_calculada, $sig_recebida ) ) {
		return null;
	}

	if ( $exp < time() ) {
		return null; // link expirado (validade de 15 dias corridos, definida na Edge Function)
	}

	$itens = pf_orcamento_parse_itens( $itens_url );
	if ( empty( $itens ) ) {
		return null;
	}

	return array(
		'orcamento_id' => $orcamento_id,
		'itens'        => $itens,
		'ajuste'       => $ajuste,
		'frete'        => $frete,
	);
}

// "id:qtd:preco,id:qtd:preco,..." -> array de ['id'=>int,'qtd'=>int,'preco'=>float].
// Qualquer item em formato inesperado é descartado individualmente (mais
// seguro que tentar adivinhar); se sobrar zero itens válidos, o link inteiro
// é rejeitado por quem chamou esta função.
function pf_orcamento_parse_itens( $itens_url ) {
	$itens = array();
	foreach ( explode( ',', $itens_url ) as $parte ) {
		$campos = explode( ':', $parte );
		if ( 3 !== count( $campos ) ) {
			continue;
		}
		list( $id, $qtd, $preco ) = $campos;
		if ( ! ctype_digit( $id ) || ! ctype_digit( $qtd ) || ! is_numeric( $preco ) ) {
			continue;
		}
		$itens[] = array(
			'id'    => absint( $id ),
			'qtd'   => absint( $qtd ),
			'preco' => (float) $preco,
		);
	}
	return $itens;
}

// -----------------------------------------------------------------------
// PASSO 2 — trava compartilhada pelos 3 hooks de carrinho abaixo.
//
// Só devolve os preços pinados (e, portanto, só deixa os hooks agirem)
// quando a sessão tem os dados deste fluxo E o carrinho ATUAL ainda é
// exatamente o mesmo conjunto de produtos que foi populado no Passo 1. Se o
// cliente mexeu no carrinho depois (tirou ou adicionou item), o preço/
// ajuste/frete negociado não se aplica mais a essa combinação — os hooks
// não fazem nada, carrinho volta a se comportar 100% nativo.
// -----------------------------------------------------------------------
function pf_orcamento_precos_da_sessao_se_valido() {
	if ( ! WC()->session ) {
		return null;
	}

	$precos = WC()->session->get( 'pf_orcamento_precos' );
	if ( empty( $precos ) || ! is_array( $precos ) ) {
		return null; // sessão de cliente normal — não é deste fluxo
	}

	$ids_esperados = array_map( 'intval', array_keys( $precos ) );
	sort( $ids_esperados );

	$ids_no_carrinho = array();
	foreach ( WC()->cart->get_cart() as $cart_item ) {
		$ids_no_carrinho[] = (int) $cart_item['product_id'];
	}
	$ids_no_carrinho = array_unique( $ids_no_carrinho );
	sort( $ids_no_carrinho );

	if ( $ids_no_carrinho !== $ids_esperados ) {
		return null; // carrinho foi alterado depois de populado — não aplica nada
	}

	return $precos;
}

// -----------------------------------------------------------------------
// Pina o preço unitário de cada item no valor exato cotado no orçamento —
// o "snapshot congelado" que já valia antes (quando o pedido era criado
// direto via API REST) continua valendo aqui, mesmo que o catálogo mude.
//
// set_price()/set_regular_price()/set_sale_price() aqui atuam só na cópia
// em memória do produto usada NESTE cálculo do carrinho — não gravam nada
// no produto real do catálogo/banco. Zera o preço promocional também, pra
// nenhuma promoção ativa do produto competir com o preço cotado.
// Reaplica a CADA recálculo (é assim que o hook funciona) — não é uma
// gravação única.
// -----------------------------------------------------------------------
add_action( 'woocommerce_before_calculate_totals', 'pf_orcamento_pinar_preco' );
function pf_orcamento_pinar_preco( $cart ) {
	$precos = pf_orcamento_precos_da_sessao_se_valido();
	if ( ! $precos ) {
		return; // não é deste fluxo, ou carrinho já não bate — zero interferência
	}

	foreach ( $cart->get_cart() as $cart_item ) {
		$id = $cart_item['product_id'];
		if ( ! isset( $precos[ $id ] ) ) {
			continue; // defensivo — não deveria acontecer, já filtrado na trava acima
		}
		$cart_item['data']->set_price( $precos[ $id ] );
		$cart_item['data']->set_regular_price( $precos[ $id ] );
		$cart_item['data']->set_sale_price( '' );
	}
}

// -----------------------------------------------------------------------
// Aplica o ajuste negociado (desconto ou acréscimo — add_fee aceita valor
// negativo ou positivo) como uma taxa no carrinho. Reaplica a cada
// recálculo — fees do WooCommerce não persistem sozinhas entre requisições,
// por isso isso PRECISA estar num hook, não numa chamada única no Passo 1.
// -----------------------------------------------------------------------
add_action( 'woocommerce_cart_calculate_fees', 'pf_orcamento_aplicar_ajuste' );
function pf_orcamento_aplicar_ajuste( $cart ) {
	if ( ! pf_orcamento_precos_da_sessao_se_valido() ) {
		return;
	}

	$ajuste = (float) WC()->session->get( 'pf_orcamento_ajuste' );
	if ( 0.0 === $ajuste ) {
		return; // sem ajuste negociado — não cria uma taxa de R$ 0,00 à toa
	}

	// Nome é só o que o cliente vê no resumo do pedido. Valor pode ser
	// negativo (desconto) ou positivo (acréscimo) — mesmo mecanismo pros dois.
	$cart->add_fee( __( 'Ajuste negociado', 'woocommerce' ), $ajuste );
}

// -----------------------------------------------------------------------
// PRECISA vir antes do filtro de frete abaixo, mesmo que o efeito só
// apareça nele. O WooCommerce cacheia a cotação de frete calculada por
// pacote numa chave de sessão própria (shipping_for_package_N), baseada
// num hash do conteúdo do pacote (itens + destino) — não leva em conta
// nada que a gente grave na sessão. Sem isso, se o hash bater com um
// cálculo anterior já guardado (ex: de um teste anterior com os mesmos
// itens/CEP, antes mesmo de este fluxo existir), o WooCommerce reaproveita
// a cotação antiga e NUNCA chama de novo o woocommerce_package_rates
// abaixo — mesmo com o valor negociado certinho na sessão. Confirmado
// lendo WC_Shipping::calculate_shipping_for_package() e get_package_hash()
// no core; o comentário nativo logo acima do apply_filters(
// 'woocommerce_package_rates', ...) até aponta pra esse problema
// (@see .../cache-invalidation-methods). Injetar um campo próprio no
// pacote aqui muda o hash automaticamente (só subtotal/total/rates/etc.
// são ignorados no cálculo do hash), forçando recálculo sempre que o
// nosso frete negociado mudar.
// -----------------------------------------------------------------------
add_filter( 'woocommerce_cart_shipping_packages', 'pf_orcamento_marcar_pacote_frete' );
function pf_orcamento_marcar_pacote_frete( $packages ) {
	if ( ! pf_orcamento_precos_da_sessao_se_valido() ) {
		return $packages; // sessão normal — não mexe em nada
	}

	$frete = WC()->session->get( 'pf_orcamento_frete' );
	foreach ( $packages as $key => $package ) {
		$packages[ $key ]['pf_orcamento_frete_marcador'] = $frete;
	}
	return $packages;
}

// -----------------------------------------------------------------------
// Força o frete no valor exato negociado, substituindo as opções que as
// zonas de frete do site calculariam normalmente — o valor já foi
// prometido ao cliente na página de aprovação/email, não pode divergir.
//
// Filtro nativo woocommerce_package_rates, aplicado a cada cálculo de
// frete (carrinho, checkout, updates via AJAX) — nunca "gravado" uma vez
// só, sempre recalculado igual às outras duas trava/reaplicação acima
// (agora que o filtro acima garante que ele de fato roda de novo).
// -----------------------------------------------------------------------
add_filter( 'woocommerce_package_rates', 'pf_orcamento_forcar_frete', 10, 2 );
function pf_orcamento_forcar_frete( $rates, $package ) {
	if ( ! pf_orcamento_precos_da_sessao_se_valido() ) {
		return $rates; // sessão normal — devolve as opções nativas intocadas
	}

	$frete = WC()->session->get( 'pf_orcamento_frete' );
	if ( null === $frete ) {
		return $rates;
	}

	$taxa_unica = new WC_Shipping_Rate(
		'pf_orcamento_frete',
		__( 'Frete', 'woocommerce' ),
		(float) $frete,
		array(),
		'flat_rate'
	);

	// Substitui TODAS as opções calculadas pela zona por essa única — evita
	// o cliente ver duas opções de frete divergentes (a negociada e a que o
	// site calcularia normalmente).
	return array( 'pf_orcamento_frete' => $taxa_unica );
}

// -----------------------------------------------------------------------
// Limpeza — assim que o pedido é finalizado, apaga as 4 chaves da sessão.
//
// IMPORTANTE: isto NÃO é a automação de status que foi descartada — não
// toca no pedido, não muda status de nada, não chama Supabase nem WooCommerce
// API. É só higiene da sessão local: sem isso, o mesmo navegador (a sessão
// do WooCommerce dura alguns dias) poderia carregar o frete/ajuste/preço
// deste orçamento pra dentro de uma compra normal e não relacionada, feita
// depois no mesmo navegador. Se preferir remover mesmo assim por tocar num
// hook do ciclo de vida do pedido, é seguro remover só este bloco — os 3
// hooks acima continuam funcionando sem ele (a sessão só ficaria "presa"
// por mais tempo, até expirar sozinha).
// -----------------------------------------------------------------------
add_action( 'woocommerce_thankyou', 'pf_orcamento_limpar_sessao' );
function pf_orcamento_limpar_sessao() {
	if ( ! WC()->session ) {
		return;
	}
	WC()->session->__unset( 'pf_orcamento_id' );
	WC()->session->__unset( 'pf_orcamento_precos' );
	WC()->session->__unset( 'pf_orcamento_ajuste' );
	WC()->session->__unset( 'pf_orcamento_frete' );
}
