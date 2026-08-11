import type { Orcamento } from '../../types';
import { formatarReais } from '../../lib/formato';
import { totalComAjuste } from '../../lib/orcamentos';

export function OrcamentoCard({ orcamento, onClick }: { orcamento: Orcamento; onClick: () => void }) {
  const total = totalComAjuste(orcamento);
  const ajustado = orcamento.ajuste_manual !== 0;

  return (
    <button
      type="button"
      className={`orcamento-card orcamento-card--${orcamento.status}`}
      onClick={onClick}
    >
      <span className="orcamento-card__escola">{orcamento.escola_nome}</span>
      <span className="orcamento-card__responsavel">{orcamento.responsavel_nome}</span>
      <span className="orcamento-card__total">
        {formatarReais(total)}
        {ajustado && <span className="orcamento-card__ajustado"> (ajustado)</span>}
      </span>
      <span className="orcamento-card__data">
        {new Date(orcamento.criado_em).toLocaleDateString('pt-BR')}
      </span>
    </button>
  );
}
