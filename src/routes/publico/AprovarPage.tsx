import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { Orcamento } from '../../types';
import { consultarOrcamentoPublico, confirmarAprovacao } from '../../lib/aprovacao';
import { totalComAjuste } from '../../lib/orcamentos';
import { formatarReais } from '../../lib/formato';

export default function AprovarPage() {
  const { id } = useParams<{ id: string }>();
  const [orcamento, setOrcamento] = useState<Orcamento | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [erroConfirmar, setErroConfirmar] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    consultarOrcamentoPublico(id)
      .then(setOrcamento)
      .catch((err) => setErro(err instanceof Error ? err.message : 'Erro ao carregar orçamento'))
      .finally(() => setCarregando(false));
  }, [id]);

  async function handleConfirmar() {
    if (!id) return;
    setConfirmando(true);
    setErroConfirmar(null);
    try {
      const link = await confirmarAprovacao(id);
      window.location.href = link;
    } catch (err) {
      setErroConfirmar(err instanceof Error ? err.message : 'Erro ao confirmar aprovação');
      setConfirmando(false);
    }
  }

  if (carregando) return <main className="aprovar-page">Carregando orçamento...</main>;
  if (erro || !orcamento) return <main className="aprovar-page">Não foi possível carregar este orçamento: {erro}</main>;

  const total = totalComAjuste(orcamento);
  const parcelaAproximada = total / 10;

  return (
    <main className="aprovar-page">
      <div className="aprovar-page__card">
        <h1>Confirmação de orçamento</h1>
        <p>
          {orcamento.escola_nome} — {orcamento.responsavel_nome}
        </p>

        <table className="aprovar-page__itens">
          <thead>
            <tr>
              <th>Item</th>
              <th>Qtd</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {orcamento.itens.map((item, i) => (
              <tr key={i}>
                <td>{item.nome}</td>
                <td>{item.quantidade}</td>
                <td>{formatarReais(item.preco_unitario * item.quantidade)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {orcamento.regras_aplicadas.length > 0 && (
          <ul className="aprovar-page__beneficios">
            {orcamento.regras_aplicadas.map((r) => (
              <li key={r.regra_id}>
                {r.mensagem_cliente}
                {r.tipo_beneficio === 'item_gratis' && r.item_beneficio
                  ? ` — ${r.beneficio_valor}x ${r.item_beneficio} grátis`
                  : ` — economia de ${formatarReais(r.valor_economizado)}`}
              </li>
            ))}
          </ul>
        )}

        <dl className="aprovar-page__valores">
          <div>
            <dt>Subtotal</dt>
            <dd>{formatarReais(orcamento.subtotal)}</dd>
          </div>
          <div>
            <dt>Frete</dt>
            <dd>{formatarReais(orcamento.frete_final)}</dd>
          </div>
          {orcamento.ajuste_manual !== 0 && (
            <div>
              <dt>Ajuste</dt>
              <dd>{formatarReais(orcamento.ajuste_manual)}</dd>
            </div>
          )}
          <div className="aprovar-page__total">
            <dt>Total</dt>
            <dd>{formatarReais(total)}</dd>
          </div>
        </dl>

        <p className="aprovar-page__parcelamento">
          A partir de {formatarReais(parcelaAproximada)} em até 10x no cartão (simulação aproximada — o parcelamento
          exato é escolhido no checkout do Mercado Pago).
        </p>

        {orcamento.link_pagamento ? (
          <a className="aprovar-page__confirmar" href={orcamento.link_pagamento}>
            Ir para pagamento
          </a>
        ) : (
          <button className="aprovar-page__confirmar" onClick={handleConfirmar} disabled={confirmando}>
            {confirmando ? 'Confirmando...' : 'Confirmar e ir para pagamento'}
          </button>
        )}

        {erroConfirmar && <p className="resumo__erro">{erroConfirmar}</p>}
      </div>
    </main>
  );
}
