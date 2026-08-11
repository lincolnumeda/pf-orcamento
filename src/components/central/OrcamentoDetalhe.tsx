import { useEffect, useState } from 'react';
import type { Interacao, Orcamento, StatusOrcamento } from '../../types';
import { formatarReais } from '../../lib/formato';
import { atualizarAjusteManual, atualizarStatus, linkWhatsApp, totalComAjuste } from '../../lib/orcamentos';
import { listarInteracoes, criarInteracao } from '../../lib/interacoes';
import { enviarWhatsappManual } from '../../lib/whatsapp';
import { Timeline } from './Timeline';

const STATUS_OPCOES: { valor: StatusOrcamento; rotulo: string }[] = [
  { valor: 'recebido', rotulo: 'Recebido' },
  { valor: 'em_conversa', rotulo: 'Em conversa' },
  { valor: 'aprovado', rotulo: 'Aprovado' },
  { valor: 'pago', rotulo: 'Pago' },
  { valor: 'perdido', rotulo: 'Perdido' },
];

interface Props {
  orcamento: Orcamento;
  autorNome: string;
  onFechar: () => void;
  onAtualizado: (orcamento: Orcamento) => void;
}

export function OrcamentoDetalhe({ orcamento, autorNome, onFechar, onAtualizado }: Props) {
  const [interacoes, setInteracoes] = useState<Interacao[]>([]);
  const [carregandoInteracoes, setCarregandoInteracoes] = useState(true);
  const [novaNota, setNovaNota] = useState('');
  const [salvandoNota, setSalvandoNota] = useState(false);

  const [mensagemWhatsapp, setMensagemWhatsapp] = useState(
    `Olá ${orcamento.responsavel_nome}, tudo bem? Vi que você solicitou um orçamento com a gente, ficou alguma dúvida?`,
  );
  const [enviandoWhatsapp, setEnviandoWhatsapp] = useState(false);

  const [ajuste, setAjuste] = useState(String(orcamento.ajuste_manual));
  const [salvandoAjuste, setSalvandoAjuste] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    setCarregandoInteracoes(true);
    listarInteracoes(orcamento.id)
      .then((dados) => {
        if (!cancelado) setInteracoes(dados);
      })
      .catch((err) => {
        if (!cancelado) setErro(err instanceof Error ? err.message : 'Erro ao carregar histórico');
      })
      .finally(() => {
        if (!cancelado) setCarregandoInteracoes(false);
      });
    return () => {
      cancelado = true;
    };
  }, [orcamento.id]);

  async function handleStatusChange(novoStatus: StatusOrcamento) {
    const statusAnterior = orcamento.status;
    try {
      await atualizarStatus(orcamento.id, statusAnterior, novoStatus, autorNome);
      onAtualizado({ ...orcamento, status: novoStatus });
      setInteracoes(await listarInteracoes(orcamento.id));
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao mudar status');
    }
  }

  async function handleAdicionarNota() {
    if (!novaNota.trim()) return;
    setSalvandoNota(true);
    setErro(null);
    try {
      await criarInteracao(orcamento.id, 'nota', novaNota.trim(), autorNome);
      setNovaNota('');
      setInteracoes(await listarInteracoes(orcamento.id));
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar nota');
    } finally {
      setSalvandoNota(false);
    }
  }

  async function handleEnviarWhatsapp() {
    if (!mensagemWhatsapp.trim()) return;
    setEnviandoWhatsapp(true);
    setErro(null);
    try {
      await enviarWhatsappManual(orcamento.id, mensagemWhatsapp.trim(), autorNome);
      setInteracoes(await listarInteracoes(orcamento.id));
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao enviar WhatsApp');
    } finally {
      setEnviandoWhatsapp(false);
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
            href={linkWhatsApp(orcamento.responsavel_whatsapp, mensagemWhatsapp)}
            target="_blank"
            rel="noreferrer"
            className="orcamento-detalhe__whatsapp"
          >
            Abrir no WhatsApp
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

        <div className="orcamento-detalhe__whatsapp-manual">
          <label>
            Mensagem de WhatsApp
            <textarea rows={3} value={mensagemWhatsapp} onChange={(e) => setMensagemWhatsapp(e.target.value)} />
          </label>
          <button type="button" onClick={handleEnviarWhatsapp} disabled={enviandoWhatsapp}>
            {enviandoWhatsapp ? 'Enviando...' : 'Enviar via WhatsApp'}
          </button>
        </div>

        <div className="orcamento-detalhe__timeline-secao">
          <h3>Histórico</h3>
          <div className="orcamento-detalhe__nova-nota">
            <textarea
              rows={2}
              placeholder="Adicionar nota interna..."
              value={novaNota}
              onChange={(e) => setNovaNota(e.target.value)}
            />
            <button type="button" onClick={handleAdicionarNota} disabled={salvandoNota || !novaNota.trim()}>
              {salvandoNota ? 'Salvando...' : 'Adicionar nota'}
            </button>
          </div>
          <Timeline interacoes={interacoes} carregando={carregandoInteracoes} />
        </div>

        {erro && <p className="resumo__erro">{erro}</p>}
      </div>
    </div>
  );
}
