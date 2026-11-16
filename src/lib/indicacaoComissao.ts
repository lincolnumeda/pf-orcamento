// Cálculo da comissão de indicação a partir do SNAPSHOT do orçamento.
//
// Regra (regulamento, item 5): 10% sobre o valor líquido efetivamente pago
// pelos Class Books do pedido — sem Teacher's Guide, assinatura ou frete, e
// já com os descontos. Por isso tudo aqui sai de orcamento.itens
// (preco_unitario congelado no envio) e orcamento.regras_aplicadas — NUNCA
// da tabela produtos, cujo preço muda com o tempo.

import type { ItemOrcamento, Orcamento } from '../types';
import { COMISSAO_PCT, QTD_MINIMA_LIVROS } from './indicacaoConfig';

const CATEGORIAS_CLASS_BOOK = new Set(['infantil', 'tots']);

export function arredondar2(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

export type OrcamentoParaComissao = Pick<
  Orcamento,
  'itens' | 'regras_aplicadas' | 'total_final' | 'frete_final' | 'ajuste_manual'
>;

export interface CalculoComissao {
  qtdLivros: number;
  valorBruto: number; // soma quantidade × preço congelado dos Class Books
  valorLivros: number; // líquido, depois dos descontos
  comissao: number;
}

function ehClassBook(item: ItemOrcamento): boolean {
  return CATEGORIAS_CLASS_BOOK.has(item.categoria);
}

export function calcularComissaoDoOrcamento(
  orcamento: OrcamentoParaComissao,
  pct: number = COMISSAO_PCT,
): CalculoComissao {
  const livros = (orcamento.itens ?? []).filter(ehClassBook);
  const qtdLivros = livros.reduce((soma, i) => soma + i.quantidade, 0);
  const valorBruto = livros.reduce((soma, i) => soma + i.quantidade * i.preco_unitario, 0);

  let valor = valorBruto;
  const regras = orcamento.regras_aplicadas ?? [];

  // 1) Desconto percentual no total: o motor aplica sobre o subtotal inteiro,
  //    então a parte dos livros recebe o mesmo percentual.
  const pctDesconto = regras
    .filter((r) => r.tipo_beneficio === 'desconto_total_pct')
    .reduce((soma, r) => soma + r.beneficio_valor, 0);
  valor -= valorBruto * Math.min(pctDesconto, 100) / 100;

  // 2) Brinde que é um Class Book que já está no carrinho: o motor desconta
  //    as unidades que estão no pedido (até a quantidade do brinde). Brinde
  //    de Teacher's Guide/assinatura não mexe no valor dos livros.
  for (const r of regras) {
    if (r.tipo_beneficio !== 'item_gratis' || !r.item_beneficio) continue;
    const doLivro = livros.filter((i) => i.nome === r.item_beneficio);
    const noCarrinho = doLivro.reduce((soma, i) => soma + i.quantidade, 0);
    if (noCarrinho === 0) continue;
    const preco = doLivro[0].preco_unitario;
    valor -= Math.min(r.beneficio_valor, noCarrinho) * preco;
  }

  // 3) Ajuste manual negativo (desconto negociado na Central): rateado entre
  //    os produtos na proporção do que os livros representam. Ajuste
  //    positivo (acréscimo) não aumenta a base — o regulamento exclui taxas.
  const ajuste = orcamento.ajuste_manual ?? 0;
  const produtosLiquido = orcamento.total_final - orcamento.frete_final;
  if (ajuste < 0 && produtosLiquido > 0 && valor > 0) {
    valor += ajuste * Math.min(1, valor / produtosLiquido);
  }

  const valorLivros = arredondar2(Math.max(0, valor));
  return {
    qtdLivros,
    valorBruto: arredondar2(valorBruto),
    valorLivros,
    comissao: calcularComissao(valorLivros, pct),
  };
}

export function calcularComissao(valorLivros: number, pct: number = COMISSAO_PCT): number {
  return arredondar2(Math.max(0, valorLivros) * pct / 100);
}

export interface ContextoAvisoFechamento {
  qtdLivros: number;
  validaAte: string; // ISO da indicação
  indicacaoCriadaEm: string; // ISO
  orcamentoCriadoEm?: string | null; // ISO do orçamento vinculado
  fechamentoEm?: Date; // padrão: agora
}

// Avisos (não bloqueiam — a equipe decide) ao marcar uma indicação como
// fechada.
export function avisosFechamento(ctx: ContextoAvisoFechamento): string[] {
  const avisos: string[] = [];
  if (ctx.qtdLivros < QTD_MINIMA_LIVROS) {
    avisos.push(
      `O pedido tem ${ctx.qtdLivros} Class Book${ctx.qtdLivros === 1 ? '' : 's'}. Pra valer comissão precisa de ${QTD_MINIMA_LIVROS} ou mais.`,
    );
  }
  const fechamento = ctx.fechamentoEm ?? new Date();
  if (fechamento.getTime() > new Date(ctx.validaAte).getTime()) {
    avisos.push(
      `O fechamento passou do prazo da indicação (válida até ${new Date(ctx.validaAte).toLocaleDateString('pt-BR')}).`,
    );
  }
  if (ctx.orcamentoCriadoEm && new Date(ctx.orcamentoCriadoEm).getTime() < new Date(ctx.indicacaoCriadaEm).getTime()) {
    avisos.push('Esse orçamento foi pedido ANTES da indicação — pelo regulamento (3.1), a escola não seria nova.');
  }
  return avisos;
}
