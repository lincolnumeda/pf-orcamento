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
    <aside className="resumo card">
      <h3>Resumo do orçamento</h3>

      <div className="resumo__linhas">
        <div className="sum-line">
          <span>Subtotal</span>
          <span className="tabnums">{formatarReais(resultado.subtotal)}</span>
        </div>
        <div className="sum-line">
          <span>Frete</span>
          <span className="tabnums">
            {!cepPreenchido && '—'}
            {cepPreenchido && freteCarregando && 'calculando...'}
            {cepPreenchido && !freteCarregando && formatarReais(resultado.freteFinal)}
          </span>
        </div>
      </div>

      {freteErro && <p className="resumo__erro">Não foi possível calcular o frete: {freteErro}</p>}

      {resultado.regrasAplicadas.length > 0 && (
        <div className="resumo__beneficios">
          {resultado.regrasAplicadas.map((r) => (
            <div key={r.regra_id} className="benefit-ticket">
              🎉 {r.mensagem_cliente}
              {r.tipo_beneficio === 'item_gratis' && r.item_beneficio
                ? ` — ${r.beneficio_valor}x ${r.item_beneficio} grátis (economia de ${formatarReais(r.valor_economizado)})`
                : ` — economia de ${formatarReais(r.valor_economizado)}`}
            </div>
          ))}
        </div>
      )}

      {resultado.nearMiss.length > 0 && (
        <div className="resumo__near-miss">
          {resultado.nearMiss.map((hint) => (
            <div key={hint.regraId} className="hint-box">
              Falta {hint.unidade === 'livros' ? `${hint.falta} livro(s)` : formatarReais(hint.falta)} para desbloquear:{' '}
              {hint.nome}
            </div>
          ))}
        </div>
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

      <div className="sum-total">
        <span>Total</span>
        <span className="tabnums">{formatarReais(resultado.totalFinal)}</span>
      </div>
    </aside>
  );
}
