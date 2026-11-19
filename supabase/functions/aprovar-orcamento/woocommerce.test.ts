import { describe, expect, it } from 'vitest';
import {
  montarItensCarrinho,
  formatarItensParaUrl,
  calcularExpiracao,
  montarPayloadAssinatura,
  assinarPayload,
  montarLinkCarrinhoAssinado,
  montarUrlCarrinho,
} from './woocommerce';

describe('montarItensCarrinho', () => {
  const mapa = new Map([
    ['p1', 13686],
    ['p2', 20450],
  ]);

  it('resolve o woocommerce_id e ordena por ele, crescente (precisa ser determinístico pra assinatura bater)', () => {
    const itens = [
      { produto_id: 'p2', nome: 'Aventura no Zoo', quantidade: 2, preco_unitario: 149.0 },
      { produto_id: 'p1', nome: 'Hello Baby!', quantidade: 5, preco_unitario: 99.9 },
    ];
    expect(montarItensCarrinho(itens, mapa)).toEqual([
      { wooId: 13686, quantidade: 5, precoUnitario: 99.9 },
      { wooId: 20450, quantidade: 2, precoUnitario: 149.0 },
    ]);
  });

  it('lança erro se o produto não tiver woocommerce_id mapeado', () => {
    const itens = [{ produto_id: 'p1', nome: 'Assinatura Digital', quantidade: 1, preco_unitario: 99.9 }];
    expect(() => montarItensCarrinho(itens, new Map())).toThrow(/woocommerce_id/);
  });

  it('lança erro se a quantidade não for um inteiro positivo (evita add_to_cart nativo receber algo inesperado)', () => {
    const itens = [{ produto_id: 'p1', nome: 'Hello Baby!', quantidade: 0, preco_unitario: 99.9 }];
    expect(() => montarItensCarrinho(itens, mapa)).toThrow(/quantidade inválida/);
  });
});

describe('formatarItensParaUrl', () => {
  it('monta "id:qtd:preco" separado por vírgula, preço sempre com 2 casas', () => {
    const itens = [
      { wooId: 13686, quantidade: 5, precoUnitario: 99.9 },
      { wooId: 20450, quantidade: 2, precoUnitario: 149 },
    ];
    expect(formatarItensParaUrl(itens)).toBe('13686:5:99.90,20450:2:149.00');
  });
});

describe('calcularExpiracao', () => {
  it('soma 15 dias corridos (aproximação segura dos "10 dias úteis" prometidos no email)', () => {
    const agora = new Date('2026-09-04T12:00:00Z');
    const esperado = Math.floor(agora.getTime() / 1000) + 15 * 24 * 60 * 60;
    expect(calcularExpiracao(agora)).toBe(esperado);
  });
});

describe('montarPayloadAssinatura', () => {
  it('monta a string canônica "orcamento|itens|ajuste|frete|exp", com ajuste/frete sempre em 2 casas', () => {
    expect(montarPayloadAssinatura('abc-123', '13686:5:99.90,20450:2:149.00', -50, 47.32, 1780000000)).toBe(
      'abc-123|13686:5:99.90,20450:2:149.00|-50.00|47.32|1780000000',
    );
  });
});

describe('assinarPayload', () => {
  // Vetor de teste calculado por fora (Node crypto.createHmac e Web Crypto
  // SubtleCrypto, os dois bateram) antes de este arquivo existir — é o
  // mesmo valor que hash_hmac('sha256', $payload, $segredo) precisa produzir
  // do lado do WordPress. Se esse teste passar mas a assinatura não bater em
  // produção, o problema está na formatação do payload do lado do PHP, não
  // no algoritmo.
  it('produz o mesmo HMAC-SHA256 (hex) que o WordPress vai calcular com hash_hmac', async () => {
    const payload = 'abc-123|13686:5:99.90,20450:2:149.00|-50.00|47.32|1780000000';
    const sig = await assinarPayload(payload, 'segredo-de-teste');
    expect(sig).toBe('eacbf4aee96bdaa9610f7c209c634dc97dc431068fe4e4083fe65f2943827cd8');
  });

  it('payloads diferentes produzem assinaturas diferentes (sensível a qualquer adulteração)', async () => {
    const sig1 = await assinarPayload('abc-123|...|0.00|0.00|123', 'segredo');
    const sig2 = await assinarPayload('abc-124|...|0.00|0.00|123', 'segredo');
    expect(sig1).not.toBe(sig2);
  });
});

describe('montarLinkCarrinhoAssinado', () => {
  const mapa = new Map([['p1', 13686]]);
  const dados = {
    itens: [{ produto_id: 'p1', nome: 'Hello Baby!', quantidade: 5, preco_unitario: 99.9 }],
    freteFinal: 47.32,
    ajusteManual: -50,
  };

  it('a assinatura bate com montarPayloadAssinatura + assinarPayload chamados manualmente com os mesmos dados', async () => {
    const agora = new Date('2026-09-04T12:00:00Z');
    const resultado = await montarLinkCarrinhoAssinado('abc-123', dados, mapa, 'segredo-de-teste', agora);
    const payload = montarPayloadAssinatura('abc-123', resultado.itensUrl, dados.ajusteManual, dados.freteFinal, resultado.exp);
    const sigEsperada = await assinarPayload(payload, 'segredo-de-teste');
    expect(resultado.sig).toBe(sigEsperada);
  });
});

describe('montarUrlCarrinho', () => {
  it('monta a URL na raiz do site com pf_orcamento_cart=1 e todos os parâmetros', () => {
    const url = montarUrlCarrinho('https://pequenosfluentes.com.br', 'abc-123', '13686:5:99.90', -50, 47.32, 1780000000, 'sigabc');
    const parsed = new URL(url);
    expect(parsed.origin).toBe('https://pequenosfluentes.com.br');
    expect(parsed.pathname).toBe('/');
    expect(parsed.searchParams.get('pf_orcamento_cart')).toBe('1');
    expect(parsed.searchParams.get('orcamento')).toBe('abc-123');
    expect(parsed.searchParams.get('itens')).toBe('13686:5:99.90');
    expect(parsed.searchParams.get('ajuste')).toBe('-50.00');
    expect(parsed.searchParams.get('frete')).toBe('47.32');
    expect(parsed.searchParams.get('exp')).toBe('1780000000');
    expect(parsed.searchParams.get('sig')).toBe('sigabc');
  });
});
