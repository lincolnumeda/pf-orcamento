// Ligação visual orçamento ↔ indicação na Central (só leitura, não muda
// nada no fluxo do orçamento).

import type { Indicacao, Orcamento } from '../types';
import { nomeDaChave, nomesParecidos, normalizarTextoEscola } from './indicacaoChave';

const STATUS_VIGENTES = new Set(['aceita', 'em_negociacao']);

type OrcamentoMin = Pick<Orcamento, 'escola_nome' | 'criado_em'>;
type IndicacaoMin = Pick<Indicacao, 'id' | 'status' | 'escola_chave' | 'criado_em' | 'valida_ate' | 'indicador_nome'>;

// Indicação aceita cujo nome normalizado bate com o do orçamento, e o
// orçamento chegou depois da indicação e dentro da validade. orcamentos não
// tem cidade, então compara só a parte do nome da escola_chave. Se mais de
// uma bater, vale a primeira registrada.
export function indicacaoDoOrcamento<T extends IndicacaoMin>(orcamento: OrcamentoMin, indicacoes: T[]): T | null {
  const nome = normalizarTextoEscola(orcamento.escola_nome);
  if (!nome) return null;
  const chegada = new Date(orcamento.criado_em).getTime();

  const candidatas = indicacoes.filter(
    (i) =>
      STATUS_VIGENTES.has(i.status) &&
      nomeDaChave(i.escola_chave) === nome &&
      chegada >= new Date(i.criado_em).getTime() &&
      chegada <= new Date(i.valida_ate).getTime(),
  );
  if (candidatas.length === 0) return null;
  return candidatas.reduce((primeira, i) => (i.criado_em < primeira.criado_em ? i : primeira));
}

// Orçamentos de escola com nome parecido — ajuda a conferir se a escola
// indicada já é cliente / já pediu orçamento.
export function orcamentosParecidos<T extends OrcamentoMin>(escolaNome: string, orcamentos: T[]): T[] {
  return orcamentos.filter((o) => nomesParecidos(o.escola_nome, escolaNome));
}
