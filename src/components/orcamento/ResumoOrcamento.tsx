import type { ResultadoCalculo } from '../../lib/motorRegras';
import type { ResultadoPrazoProducao } from '../../lib/prazoProducao';
import { formatarReais } from '../../lib/formato';

interface Props {
  resultado: ResultadoCalculo;
  freteCarregando: boolean;
  freteErro: string | null;
  cepPreenchido: boolean;
  freteDias: number | null;
  freteServico: string | null;
  prazoProducao: ResultadoPrazoProducao | null;
}

export function ResumoOrcamento({
  resultado,
  freteCarregando,
  freteErro,
  cepPreenchido,
  freteDias,
  freteServico,
  prazoProducao,
}: Props) {
  return (
    <aside className="resumo">
      <h2>Resumo</h2>

      <dl className="resumo__linhas">
        <div>
          <dt>Subtotal</dt>
          <dd>{formatarReais(resultado.subtotal)}</dd>
        </div>
        <div>
          <dt>Frete</dt>
          <dd>
            {!cepPreenchido && '—'}
            {cepPreenchido && freteCarregando && 'calculando...'}
            {cepPreenchido && !freteCarregando && formatarReais(resultado.freteFinal)}
          </dd>
        </div>
        <div className="resumo__total">
          <dt>Total</dt>
          <dd>{formatarReais(resultado.totalFinal)}</dd>
        </div>
      </dl>

      {freteErro && <p className="resumo__erro">Não foi possível calcular o frete: {freteErro}</p>}

      {resultado.regrasAplicadas.length > 0 && (
        <ul className="resumo__beneficios">
          {resultado.regrasAplicadas.map((r) => (
            <li key={r.regra_id} className="beneficio-banner">
              🎉 {r.mensagem_cliente}
              {r.tipo_beneficio === 'item_gratis' && r.item_beneficio
                ? ` — ${r.beneficio_valor}x ${r.item_beneficio} grátis (economia de ${formatarReais(r.valor_economizado)})`
                : ` — economia de ${formatarReais(r.valor_economizado)}`}
            </li>
          ))}
        </ul>
      )}

      {(prazoProducao || freteDias !== null) && (
        <div className="resumo__prazos">
          {prazoProducao && (
            <p>
              Prazo de produção: {prazoProducao.textoCustomizado ?? `${prazoProducao.diasUteis} dias úteis`}
            </p>
          )}
          {freteDias !== null && (
            <p>
              Prazo de transporte: {freteDias} dias úteis{freteServico ? ` (${freteServico})` : ''}
            </p>
          )}
        </div>
      )}

      {resultado.nearMiss.length > 0 && (
        <ul className="resumo__near-miss">
          {resultado.nearMiss.map((hint) => (
            <li key={hint.regraId}>
              Falta {hint.unidade === 'livros' ? `${hint.falta} livro(s)` : formatarReais(hint.falta)} para desbloquear:{' '}
              {hint.nome}
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
