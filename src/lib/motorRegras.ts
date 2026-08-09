import type { ItemOrcamento, Produto, Regra, RegraAplicada } from '../types';

const CATEGORIAS_LIVRO = new Set(['infantil', 'tots']);

export interface ContextoCalculo {
  itens: ItemOrcamento[];
  freteBruto: number;
  regras: Regra[];
  produtos: Produto[];
}

export interface ItemGratis {
  nome: string;
  quantidade: number;
  precoUnitario: number;
  regraId: string;
}

export interface NearMissHint {
  regraId: string;
  nome: string;
  falta: number;
  unidade: 'livros' | 'reais';
}

export interface ResultadoCalculo {
  // Soma exata do que o cliente escolheu no formulário — "vida real" do
  // pedido, sem injetar brindes. O que os brindes valem/descontam aparece
  // à parte, em regrasAplicadas, e reflete no totalFinal quando aplicável.
  subtotal: number;
  freteBruto: number;
  freteFinal: number;
  totalFinal: number;
  regrasAplicadas: RegraAplicada[];
  itensGratis: ItemGratis[];
  nearMiss: NearMissHint[];
}

export function contarLivros(itens: ItemOrcamento[]): number {
  return itens
    .filter((item) => CATEGORIAS_LIVRO.has(item.categoria))
    .reduce((soma, item) => soma + item.quantidade, 0);
}

export function calcularSubtotal(itens: ItemOrcamento[]): number {
  return itens.reduce((soma, item) => soma + item.preco_unitario * item.quantidade, 0);
}

// Todo Teacher's Guide custa o mesmo (R$139,90 hoje), então qualquer produto
// dessa categoria serve pra achar o preço — o benefício "item_beneficio" não
// referencia um livro específico, só "Teacher's Guide" genericamente.
function precoPorItemBeneficio(produtos: Produto[]): Map<string, number> {
  const mapa = new Map<string, number>();
  for (const produto of produtos) {
    if (produto.categoria === 'teachers_guide') {
      mapa.set("Teacher's Guide", produto.preco);
    } else {
      mapa.set(produto.nome, produto.preco);
    }
  }
  return mapa;
}

// Quantas unidades do item do benefício já estão de fato no carrinho — o
// desconto de item_gratis só pode "zerar" o que o cliente já vai comprar,
// nunca inventar uma linha nova (ver decisão no histórico do projeto).
function quantidadeNoCarrinho(itemBeneficio: string, itens: ItemOrcamento[]): number {
  if (itemBeneficio === "Teacher's Guide") {
    return itens.filter((i) => i.categoria === 'teachers_guide').reduce((soma, i) => soma + i.quantidade, 0);
  }
  return itens.filter((i) => i.nome === itemBeneficio).reduce((soma, i) => soma + i.quantidade, 0);
}

function valorDoGatilho(regra: Regra, livros: number, subtotal: number): number {
  if (regra.tipo_gatilho === 'quantidade') return livros;
  if (regra.tipo_gatilho === 'valor_pedido') return subtotal;
  return 0; // 'faixa_frete': o gatilho principal é a faixa de frete, tratada à parte
}

function freteDentroDaFaixa(regra: Regra, freteBruto: number): boolean {
  if (regra.frete_min !== null && freteBruto < regra.frete_min) return false;
  if (regra.frete_max !== null && freteBruto > regra.frete_max) return false;
  return true;
}

// "vezes" = quantas vezes o gatilho disparou (1 para a_partir_de, N para a_cada).
function avaliarGatilho(regra: Regra, livros: number, subtotal: number, freteBruto: number): number {
  if (regra.tipo_gatilho === 'faixa_frete') {
    return freteDentroDaFaixa(regra, freteBruto) ? 1 : 0;
  }

  if (!freteDentroDaFaixa(regra, freteBruto)) return 0;

  const valorAtual = valorDoGatilho(regra, livros, subtotal);
  if (regra.gatilho_modo === 'a_partir_de') {
    return valorAtual >= regra.gatilho_valor ? 1 : 0;
  }
  // a_cada
  if (regra.gatilho_valor <= 0) return 0;
  return Math.floor(valorAtual / regra.gatilho_valor);
}

// Dentro de cada grupo_exclusivo, só a regra de maior prioridade (menor número)
// cujo gatilho disparou é aplicada; as demais do grupo são ignoradas. Regras
// sem grupo (null) sempre aplicam de forma independente quando disparam.
function selecionarRegrasVencedoras(regras: Regra[], vezesPorRegra: Map<string, number>): Regra[] {
  const disparadas = regras.filter((r) => (vezesPorRegra.get(r.id) ?? 0) > 0);

  const semGrupo = disparadas.filter((r) => !r.grupo_exclusivo);
  const porGrupo = new Map<string, Regra[]>();
  for (const r of disparadas) {
    if (!r.grupo_exclusivo) continue;
    const lista = porGrupo.get(r.grupo_exclusivo) ?? [];
    lista.push(r);
    porGrupo.set(r.grupo_exclusivo, lista);
  }

  const vencedorasDeGrupo = [...porGrupo.values()].map(
    (lista) => lista.slice().sort((a, b) => a.prioridade - b.prioridade)[0],
  );

  return [...semGrupo, ...vencedorasDeGrupo];
}

// Limiar de "quase lá": só mostra o incentivo quando falta pouco, senão vira
// ruído em pedidos pequenos. Livros: até 3 faltando. Valor: até 15% do gatilho.
function calcularNearMiss(
  regrasNaoAplicadas: Regra[],
  livros: number,
  subtotal: number,
  freteBruto: number,
): NearMissHint[] {
  const candidatas: { regra: Regra; hint: NearMissHint }[] = [];

  for (const regra of regrasNaoAplicadas) {
    if (!regra.ativa) continue;
    if (!freteDentroDaFaixa(regra, freteBruto)) continue;
    if (regra.tipo_gatilho === 'faixa_frete') continue;

    const valorAtual = valorDoGatilho(regra, livros, subtotal);
    const restoParaProximo =
      regra.gatilho_modo === 'a_cada'
        ? regra.gatilho_valor - (valorAtual % regra.gatilho_valor)
        : regra.gatilho_valor - valorAtual;

    if (restoParaProximo <= 0 || restoParaProximo >= regra.gatilho_valor) continue;

    if (regra.tipo_gatilho === 'quantidade' && restoParaProximo <= 3) {
      candidatas.push({ regra, hint: { regraId: regra.id, nome: regra.nome, falta: restoParaProximo, unidade: 'livros' } });
    } else if (regra.tipo_gatilho === 'valor_pedido' && restoParaProximo <= regra.gatilho_valor * 0.15) {
      candidatas.push({ regra, hint: { regraId: regra.id, nome: regra.nome, falta: restoParaProximo, unidade: 'reais' } });
    }
  }

  // Dentro de um grupo_exclusivo só uma regra pode vencer, então só faz
  // sentido mostrar o "quase lá" da regra que efetivamente ganharia o grupo.
  const semGrupo = candidatas.filter((c) => !c.regra.grupo_exclusivo);
  const porGrupo = new Map<string, { regra: Regra; hint: NearMissHint }[]>();
  for (const c of candidatas) {
    if (!c.regra.grupo_exclusivo) continue;
    const lista = porGrupo.get(c.regra.grupo_exclusivo) ?? [];
    lista.push(c);
    porGrupo.set(c.regra.grupo_exclusivo, lista);
  }
  const melhorPorGrupo = [...porGrupo.values()].map(
    (lista) => lista.slice().sort((a, b) => a.regra.prioridade - b.regra.prioridade)[0],
  );

  return [...semGrupo, ...melhorPorGrupo].map((c) => c.hint);
}

export function calcularOrcamento(ctx: ContextoCalculo): ResultadoCalculo {
  const livros = contarLivros(ctx.itens);
  // Gatilhos (ex: "pedido >= R$2000") avaliam sempre sobre o que o cliente de
  // fato escolheu — não sobre o valor inflado pelos brindes, senão um brinde
  // poderia empurrar o pedido pra cima de um limiar e desencadear outro brinde.
  const subtotalBase = calcularSubtotal(ctx.itens);
  const regrasAtivas = ctx.regras.filter((r) => r.ativa);

  const vezesPorRegra = new Map<string, number>();
  for (const regra of regrasAtivas) {
    vezesPorRegra.set(regra.id, avaliarGatilho(regra, livros, subtotalBase, ctx.freteBruto));
  }

  const vencedoras = selecionarRegrasVencedoras(regrasAtivas, vezesPorRegra);
  const precosBeneficio = precoPorItemBeneficio(ctx.produtos);

  let freteFinal = ctx.freteBruto;
  let totalAntesDeFrete = subtotalBase;
  const regrasAplicadas: RegraAplicada[] = [];
  const itensGratis: ItemGratis[] = [];

  for (const regra of vencedoras) {
    const vezes = vezesPorRegra.get(regra.id) ?? 0;
    const mensagemCliente = regra.mensagem_cliente ?? regra.nome;

    if (regra.tipo_beneficio === 'desconto_frete_pct') {
      const economizado = ctx.freteBruto * (regra.beneficio_valor / 100);
      freteFinal = Math.max(0, freteFinal - economizado);
      regrasAplicadas.push({
        regra_id: regra.id,
        nome: regra.nome,
        mensagem_cliente: mensagemCliente,
        tipo_beneficio: regra.tipo_beneficio,
        beneficio_valor: regra.beneficio_valor,
        item_beneficio: null,
        valor_economizado: economizado,
      });
    } else if (regra.tipo_beneficio === 'desconto_total_pct') {
      const economizado = subtotalBase * (regra.beneficio_valor / 100);
      totalAntesDeFrete = Math.max(0, totalAntesDeFrete - economizado);
      regrasAplicadas.push({
        regra_id: regra.id,
        nome: regra.nome,
        mensagem_cliente: mensagemCliente,
        tipo_beneficio: regra.tipo_beneficio,
        beneficio_valor: regra.beneficio_valor,
        item_beneficio: null,
        valor_economizado: economizado,
      });
    } else if (regra.tipo_beneficio === 'item_gratis') {
      const quantidade = regra.gatilho_modo === 'a_cada' ? regra.beneficio_valor * vezes : regra.beneficio_valor;
      const precoUnitario = regra.item_beneficio ? (precosBeneficio.get(regra.item_beneficio) ?? 0) : 0;
      // O total só desconta o que está de fato no carrinho (ex: cliente já
      // comprou 2 Teacher's Guide e ganhou 1 de brinde → desconta 1). Se o
      // item do benefício nem é comprável pelo formulário (ex: Assinatura
      // Digital), nunca há o que descontar — o benefício aparece anunciado
      // com o valor cheio, mas o total não muda.
      const noCarrinho = regra.item_beneficio ? quantidadeNoCarrinho(regra.item_beneficio, ctx.itens) : 0;
      const quantidadeDescontada = Math.min(quantidade, noCarrinho);
      totalAntesDeFrete = Math.max(0, totalAntesDeFrete - quantidadeDescontada * precoUnitario);

      itensGratis.push({ nome: regra.item_beneficio ?? '', quantidade, precoUnitario, regraId: regra.id });
      regrasAplicadas.push({
        regra_id: regra.id,
        nome: regra.nome,
        mensagem_cliente: mensagemCliente,
        tipo_beneficio: regra.tipo_beneficio,
        beneficio_valor: quantidade,
        item_beneficio: regra.item_beneficio,
        valor_economizado: quantidade * precoUnitario,
      });
    }
  }

  const idsVencedoras = new Set(vencedoras.map((r) => r.id));
  const regrasNaoAplicadas = regrasAtivas.filter((r) => !idsVencedoras.has(r.id));
  const nearMiss = calcularNearMiss(regrasNaoAplicadas, livros, subtotalBase, ctx.freteBruto);

  return {
    subtotal: subtotalBase,
    freteBruto: ctx.freteBruto,
    freteFinal,
    totalFinal: totalAntesDeFrete + freteFinal,
    regrasAplicadas,
    itensGratis,
    nearMiss,
  };
}
