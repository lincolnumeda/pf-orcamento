import type { PrazoProducao } from '../types';

export interface ResultadoPrazoProducao {
  diasUteis: number | null;
  textoCustomizado: string | null;
}

export function calcularPrazoProducao(totalLivros: number, prazos: PrazoProducao[]): ResultadoPrazoProducao | null {
  const faixa = prazos.find((p) => totalLivros >= p.qtd_min && (p.qtd_max === null || totalLivros <= p.qtd_max));
  if (!faixa) return null;
  return { diasUteis: faixa.dias_uteis, textoCustomizado: faixa.texto_customizado };
}
