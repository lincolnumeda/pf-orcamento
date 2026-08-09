// Lógica pura de empacotamento — sem dependências de Deno, pra dar pra testar
// com qualquer runtime. Regras vêm de orcamento.faixas_embalagem.

export interface FaixaEmbalagem {
  qtd_min: number;
  qtd_max: number;
  altura_cm: number;
  largura_cm: number;
  comprimento_cm: number;
  peso_embalagem_kg: number;
}

export interface Volume {
  height: number;
  width: number;
  length: number;
  weight: number;
}

const PESO_POR_LIVRO_KG = 0.4;
const MAX_LIVROS_POR_CAIXA_GRANDE = 55;

function arredondar(valor: number): number {
  return Math.round(valor * 100) / 100;
}

// Acima de 55 livros, divide em várias caixas 40×40×30 (a faixa cujo qtd_max
// é 55), preenchendo cada uma até 55 antes de abrir a próxima.
export function calcularVolumes(quantidadeLivros: number, faixas: FaixaEmbalagem[]): Volume[] {
  if (quantidadeLivros <= 0) return [];

  if (quantidadeLivros > MAX_LIVROS_POR_CAIXA_GRANDE) {
    const caixaGrande = faixas.find((f) => f.qtd_max === MAX_LIVROS_POR_CAIXA_GRANDE);
    if (!caixaGrande) {
      throw new Error(`Nenhuma faixa de embalagem cobre pedidos grandes (qtd_max=${MAX_LIVROS_POR_CAIXA_GRANDE})`);
    }

    const volumes: Volume[] = [];
    let restante = quantidadeLivros;
    while (restante > 0) {
      const nestaCaixa = Math.min(restante, MAX_LIVROS_POR_CAIXA_GRANDE);
      volumes.push({
        height: caixaGrande.altura_cm,
        width: caixaGrande.largura_cm,
        length: caixaGrande.comprimento_cm,
        weight: arredondar(nestaCaixa * PESO_POR_LIVRO_KG + caixaGrande.peso_embalagem_kg),
      });
      restante -= nestaCaixa;
    }
    return volumes;
  }

  const faixa = faixas.find((f) => quantidadeLivros >= f.qtd_min && quantidadeLivros <= f.qtd_max);
  if (!faixa) {
    throw new Error(`Nenhuma faixa de embalagem cobre ${quantidadeLivros} livro(s)`);
  }

  return [
    {
      height: faixa.altura_cm,
      width: faixa.largura_cm,
      length: faixa.comprimento_cm,
      weight: arredondar(quantidadeLivros * PESO_POR_LIVRO_KG + faixa.peso_embalagem_kg),
    },
  ];
}
