import { useState } from 'react';
import type { Orcamento, StatusOrcamento } from '../../types';
import { formatarReais } from '../../lib/formato';
import { atualizarAjusteManual, atualizarNotas, atualizarStatus, linkWhatsApp, totalComAjuste } from '../../lib/orcamentos';

const STATUS_OPCOES: { valor: StatusOrcamento; rotulo: string }[] = [
  { valor: 'recebido', rotulo: 'Recebido' },
  { valor: 'em_conversa', rotulo: 'Em conversa' },
  { valor: 'aprovado', rotulo: 'Aprovado' },
  { valor: 'pago', rotulo: 'Pago' },
  { valor: 'perdido', rotulo: 'Perdido' },
];

interface Props {
  orcamento: Orcamento;
  onFechar: () => void;
  onAtualizado: (orcamento: Orcamento) => void;
}

export function OrcamentoDetalhe({ orcamento, onFechar, onAtualizado }: Props) {
  const [notas, setNotas] = useState(orcamento.notas_internas ?? '');
  const [ajuste, setAjuste] = useState(String(orcamento.ajuste_manual));
  const [salvandoNotas, setSalvandoNotas] = useState(false);
  const [salvandoAjuste, setSalvandoAjuste] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleStatusChange(status: StatusOrcamento) {
    try {
      await atualizarStatus(orcamento.id, status);
      onAtualizado({ ...orcamento, status });
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao mudar status');
    }
  }

  async function handleSalvarNotas() {
    setSalvandoNotas(true);
    setErro(null);
    try {
      await atualizarNotas(orcamento.id, notas);
      onAtualizado({ ...orcamento, notas_internas: notas });
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar notas');
    } finally {
      setSalvandoNotas(false);
    }
  }

  async function handleSalvarAjuste() {
    const valor = Number(ajuste);
    if (Number.isNaN(valor)) {
      setErro('Ajuste precisa ser um número');
      return;
    }
    setSalvandoAjuste(true);
    setErro(null);
    try {
      await atualizarAjusteManual(orcamento.id, valor);
      onAtualizado({ ...orcamento, ajuste_manual: valor });
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar ajuste');
    } finally {
      setSalvandoAjuste(false);
    }
  }

  const total = totalComAjuste({ ...orcamento, ajuste_manual: Number(ajuste) || 0 });

  return (
    <div className="orcamento-detalhe__fundo" onClick={onFechar}>
      <div className="orcamento-detalhe" onClick={(e) => e.stopPropagation()}>
        <div className="orcamento-detalhe__cabecalho">
          <div>
            <h2>{orcamento.escola_nome}</h2>
            <p>
              {orcamento.responsavel_nome} — {orcamento.responsavel_email}
            </p>
          </div>
          <button type="button" onClick={onFechar}>
            Fechar
          </button>
        </div>

        <div className="orcamento-detalhe__acoes-topo">
          <a
            href={linkWhatsApp(orcamento.responsavel_whatsapp, `Olá ${orcamento.responsavel_nome}, tudo bem?`)}
            target="_blank"
            rel="noreferrer"
            className="orcamento-detalhe__whatsapp"
          >
            Chamar no WhatsApp
          </a>

          <a
            href={`${window.location.origin}/aprovar/${orcamento.id}`}
            target="_blank"
            rel="noreferrer"
            className="orcamento-detalhe__aprovacao"
          >
            Ver página de aprovação
          </a>

          <label className="orcamento-detalhe__status">
            Status
            <select value={orcamento.status} onChange={(e) => handleStatusChange(e.target.value as StatusOrcamento)}>
              {STATUS_OPCOES.map((s) => (
                <option key={s.valor} value={s.valor}>
                  {s.rotulo}
                </option>
              ))}
            </select>
          </label>
        </div>

        <table className="orcamento-detalhe__itens">
          <thead>
            <tr>
              <th>Item</th>
              <th>Qtd</th>
              <th>Unitário</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {orcamento.itens.map((item, i) => (
              <tr key={i}>
                <td>{item.nome}</td>
                <td>{item.quantidade}</td>
                <td>{formatarReais(item.preco_unitario)}</td>
                <td>{formatarReais(item.preco_unitario * item.quantidade)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {orcamento.regras_aplicadas.length > 0 && (
          <ul className="orcamento-detalhe__beneficios">
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

        <dl className="orcamento-detalhe__valores">
          <div>
            <dt>Subtotal</dt>
            <dd>{formatarReais(orcamento.subtotal)}</dd>
          </div>
          <div>
            <dt>Frete</dt>
            <dd>{formatarReais(orcamento.frete_final)}</dd>
          </div>
          <div>
            <dt>Total calculado</dt>
            <dd>{formatarReais(orcamento.total_final)}</dd>
          </div>
          <div className="orcamento-detalhe__ajuste">
            <dt>
              Ajuste manual
              <span className="orcamento-detalhe__ajuste-ajuda">(negativo = desconto, positivo = acréscimo)</span>
            </dt>
            <dd>
              <input type="number" step="0.01" value={ajuste} onChange={(e) => setAjuste(e.target.value)} />
              <button type="button" onClick={handleSalvarAjuste} disabled={salvandoAjuste}>
                {salvandoAjuste ? 'Salvando...' : 'Salvar'}
              </button>
            </dd>
          </div>
          <div className="orcamento-detalhe__total-final">
            <dt>Total final</dt>
            <dd>{formatarReais(total)}</dd>
          </div>
        </dl>

        <label className="orcamento-detalhe__notas">
          Notas internas
          <textarea rows={4} value={notas} onChange={(e) => setNotas(e.target.value)} />
        </label>
        <button type="button" onClick={handleSalvarNotas} disabled={salvandoNotas}>
          {salvandoNotas ? 'Salvando...' : 'Salvar notas'}
        </button>

        {erro && <p className="resumo__erro">{erro}</p>}
      </div>
    </div>
  );
}
