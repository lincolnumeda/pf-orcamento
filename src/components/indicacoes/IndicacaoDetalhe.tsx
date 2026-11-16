import { useEffect, useMemo, useState } from 'react';
import type { HistoricoIndicacao, Indicacao, Orcamento, StatusIndicacao } from '../../types';
import { formatarReais, formatarWhatsapp } from '../../lib/formato';
import { formatarCpf } from '../../lib/cpf';
import { linkWhatsApp } from '../../lib/orcamentos';
import {
  ROTULO_STATUS_INDICACAO,
  STATUS_INDICACAO,
  buscarIndicacao,
  listarHistoricoIndicacao,
  mudarStatusIndicacao,
  atualizarIndicacao,
  registrarHistoricoIndicacao,
} from '../../lib/indicacoes';
import { orcamentosParecidos } from '../../lib/indicacaoVinculo';
import { conferenciaAtrasada, dentroDaValidade } from '../../lib/indicacaoPrazo';
import {
  COLUNA_ENVIO_INDICACAO,
  ROTULO_MENSAGEM_INDICACAO,
  TIPOS_MENSAGEM_INDICACAO,
  type TipoMensagemIndicacao,
} from '../../../supabase/functions/_shared/mensagensIndicacao.ts';
import { PreviaWhatsapp } from './PreviaWhatsapp';
import { FechamentoIndicacao, type DadosFechamento } from './FechamentoIndicacao';

interface Props {
  indicacao: Indicacao;
  todas: Indicacao[];
  orcamentos: Orcamento[];
  autorNome: string;
  onFechar: () => void;
  onAtualizada: (indicacao: Indicacao) => void;
}

const ROTULO_HISTORICO: Record<HistoricoIndicacao['tipo'], string> = {
  nota: 'Nota',
  whatsapp_enviado: 'WhatsApp',
  status_alterado: 'Status',
};

function dataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function data(iso: string): string {
  return new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString('pt-BR');
}

function hojeISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type Painel = null | 'fechar' | 'editar_fechamento' | 'pagar';

export function IndicacaoDetalhe({ indicacao, todas, orcamentos, autorNome, onFechar, onAtualizada }: Props) {
  const [historico, setHistorico] = useState<HistoricoIndicacao[]>([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(true);
  const [previa, setPrevia] = useState<TipoMensagemIndicacao | null>(null);
  const [painel, setPainel] = useState<Painel>(null);
  const [dataPagamento, setDataPagamento] = useState(indicacao.pago_em ?? hojeISO());
  const [notas, setNotas] = useState(indicacao.notas_internas ?? '');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function recarregarHistorico() {
    setHistorico(await listarHistoricoIndicacao(indicacao.id));
  }

  useEffect(() => {
    let cancelado = false;
    setCarregandoHistorico(true);
    listarHistoricoIndicacao(indicacao.id)
      .then((d) => !cancelado && setHistorico(d))
      .catch((err) => !cancelado && setErro(err instanceof Error ? err.message : 'Erro ao carregar histórico'))
      .finally(() => !cancelado && setCarregandoHistorico(false));
    return () => {
      cancelado = true;
    };
  }, [indicacao.id]);

  const mesmaEscola = useMemo(
    () =>
      todas
        .filter((i) => i.escola_chave === indicacao.escola_chave)
        .sort((a, b) => a.criado_em.localeCompare(b.criado_em)),
    [todas, indicacao.escola_chave],
  );
  const primeiraDaEscola = mesmaEscola[0]?.id === indicacao.id;
  const parecidos = useMemo(() => orcamentosParecidos(indicacao.escola_nome, orcamentos), [orcamentos, indicacao.escola_nome]);
  const orcamentoVinculado = orcamentos.find((o) => o.id === indicacao.orcamento_id) ?? null;
  const atrasada = conferenciaAtrasada(indicacao.status, indicacao.criado_em);
  const valida = dentroDaValidade(indicacao.valida_ate);

  async function executar(acao: () => Promise<Indicacao>, depois?: TipoMensagemIndicacao) {
    setSalvando(true);
    setErro(null);
    try {
      const atualizada = await acao();
      onAtualizada(atualizada);
      setPainel(null);
      await recarregarHistorico();
      if (depois && !atualizada[COLUNA_ENVIO_INDICACAO[depois] as keyof Indicacao]) setPrevia(depois);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  const mudarStatus = (status: StatusIndicacao, mensagem?: TipoMensagemIndicacao, extras: Partial<Indicacao> = {}) =>
    executar(() => mudarStatusIndicacao(indicacao, status, autorNome, extras), mensagem);

  function salvarFechamento(dados: DadosFechamento, novoStatus: StatusIndicacao | null) {
    const extras: Partial<Indicacao> = { ...dados };
    if (novoStatus === 'fechou') extras.fechado_em = new Date().toISOString();
    if (novoStatus) return mudarStatus(novoStatus, novoStatus === 'fechou' ? 'fechou' : undefined, extras);
    return executar(async () => {
      const atualizada = await atualizarIndicacao(indicacao.id, extras);
      await registrarHistoricoIndicacao(
        indicacao.id,
        'nota',
        `${autorNome} ajustou o fechamento: ${dados.qtd_livros} livros, ${formatarReais(dados.valor_livros)}, comissão ${formatarReais(dados.comissao)}`,
        autorNome,
      );
      return atualizada;
    });
  }

  function salvarNotas() {
    executar(() => atualizarIndicacao(indicacao.id, { notas_internas: notas.trim() || null }));
  }

  async function aposEnvio() {
    setPrevia(null);
    try {
      onAtualizada(await buscarIndicacao(indicacao.id));
      await recarregarHistorico();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao recarregar');
    }
  }

  const s = indicacao.status;

  return (
    <div className="orcamento-detalhe__fundo" onClick={onFechar}>
      <div className="orcamento-detalhe indicacao-detalhe" onClick={(e) => e.stopPropagation()}>
        <div className="orcamento-detalhe__cabecalho">
          <div>
            <h2>{indicacao.escola_nome}</h2>
            <p>
              {indicacao.escola_cidade}/{indicacao.escola_uf} · indicada em {dataHora(indicacao.criado_em)}
            </p>
          </div>
          <button type="button" className="btn btn-ghost" onClick={onFechar}>
            Fechar
          </button>
        </div>

        <div className="indicacao-selos">
          <span className={`indicacao-status indicacao-status--${s}`}>{ROTULO_STATUS_INDICACAO[s]}</span>
          {indicacao.possivel_duplicada && <span className="indicacao-selo indicacao-selo--duplicada">Possível duplicada</span>}
          {atrasada && <span className="indicacao-selo indicacao-selo--atrasada">Conferência atrasada</span>}
          <span className={`indicacao-selo ${valida ? '' : 'indicacao-selo--vencida'}`}>
            {valida ? 'Válida' : 'Venceu'} até {data(indicacao.valida_ate)}
          </span>
        </div>

        <div className="indicacao-detalhe__blocos">
          <section>
            <h3>Escola</h3>
            <dl>
              <dt>Responsável</dt>
              <dd>
                {indicacao.escola_responsavel}
                {indicacao.escola_cargo ? ` (${indicacao.escola_cargo})` : ''}
              </dd>
              <dt>WhatsApp</dt>
              <dd>
                <a href={linkWhatsApp(indicacao.escola_whatsapp, '')} target="_blank" rel="noreferrer">
                  {formatarWhatsapp(indicacao.escola_whatsapp)}
                </a>
              </dd>
              {indicacao.escola_email && (
                <>
                  <dt>E-mail</dt>
                  <dd>{indicacao.escola_email}</dd>
                </>
              )}
            </dl>
          </section>
          <section>
            <h3>Quem indicou</h3>
            <dl>
              <dt>Nome</dt>
              <dd>{indicacao.indicador_nome}</dd>
              <dt>WhatsApp</dt>
              <dd>
                <a href={linkWhatsApp(indicacao.indicador_whatsapp, '')} target="_blank" rel="noreferrer">
                  {formatarWhatsapp(indicacao.indicador_whatsapp)}
                </a>
              </dd>
              <dt>E-mail</dt>
              <dd>{indicacao.indicador_email}</dd>
              <dt>CPF (PIX)</dt>
              <dd>{formatarCpf(indicacao.indicador_cpf)}</dd>
              <dt>Relação</dt>
              <dd>{indicacao.indicador_relacao}</dd>
              <dt>Origem</dt>
              <dd>{indicacao.origem}</dd>
            </dl>
          </section>
        </div>

        <section className="indicacao-detalhe__secao">
          <h3>Conferência: a escola é nova?</h3>
          {mesmaEscola.length > 1 && (
            <div className="indicacao-aviso">
              <strong>{primeiraDaEscola ? 'Esta é a primeira indicação desta escola.' : 'Outra pessoa indicou antes — vale a primeira.'}</strong>
              <ul>
                {mesmaEscola.map((i) => (
                  <li key={i.id}>
                    {dataHora(i.criado_em)} · {i.indicador_nome} · {ROTULO_STATUS_INDICACAO[i.status]}
                    {i.id === indicacao.id ? ' (esta)' : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {parecidos.length > 0 ? (
            <>
              <p className="indicacao-detalhe__ajuda">Orçamentos com nome parecido:</p>
              <ul className="indicacao-detalhe__orcamentos">
                {parecidos.map((o) => (
                  <li key={o.id} className={o.criado_em < indicacao.criado_em ? 'indicacao-detalhe__orcamento--antes' : ''}>
                    <strong>{o.escola_nome}</strong> · {data(o.criado_em)} · {o.status} · {formatarReais(o.total_final + o.ajuste_manual)}
                    {o.criado_em < indicacao.criado_em && ' · ⚠️ antes da indicação'}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="indicacao-detalhe__ajuda">Nenhum orçamento com nome parecido na Central.</p>
          )}
          <p className="indicacao-detalhe__ajuda">Confira também no WooCommerce e na planilha de lotes (manual).</p>
        </section>

        <section className="indicacao-detalhe__secao">
          <h3>Ações</h3>
          <div className="indicacao-detalhe__acoes">
            {s === 'recebida' && (
              <>
                <button type="button" className="btn btn-primary" disabled={salvando} onClick={() => mudarStatus('aceita', 'aceita')}>
                  Aceitar
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={salvando}
                  onClick={() => mudarStatus('recusada_cliente', 'recusada_cliente')}
                >
                  Já é cliente
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={salvando}
                  onClick={() => mudarStatus('recusada_duplicada', 'recusada_duplicada')}
                >
                  Já indicada
                </button>
              </>
            )}
            {s === 'aceita' && (
              <button type="button" className="btn btn-ghost" disabled={salvando} onClick={() => mudarStatus('em_negociacao')}>
                Em negociação
              </button>
            )}
            {(s === 'aceita' || s === 'em_negociacao') && (
              <>
                <button type="button" className="btn btn-primary" disabled={salvando} onClick={() => setPainel('fechar')}>
                  Marcar como fechou
                </button>
                <button type="button" className="btn btn-ghost" disabled={salvando} onClick={() => mudarStatus('nao_fechou')}>
                  Não fechou
                </button>
              </>
            )}
            {s === 'fechou' && (
              <button type="button" className="btn btn-primary" disabled={salvando} onClick={() => setPainel('pagar')}>
                Marcar como paga
              </button>
            )}
            {(s === 'fechou' || s === 'paga') && (
              <button type="button" className="btn btn-ghost" disabled={salvando} onClick={() => setPainel('editar_fechamento')}>
                Editar valores do fechamento
              </button>
            )}
            <label className="orcamento-detalhe__status indicacao-detalhe__corrigir">
              Corrigir status
              <select
                value={s}
                disabled={salvando}
                onChange={(e) => mudarStatus(e.target.value as StatusIndicacao)}
              >
                {STATUS_INDICACAO.map((st) => (
                  <option key={st} value={st}>
                    {ROTULO_STATUS_INDICACAO[st]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {(painel === 'fechar' || painel === 'editar_fechamento') && (
            <FechamentoIndicacao
              indicacao={indicacao}
              orcamentos={orcamentos}
              salvando={salvando}
              rotuloSalvar={painel === 'fechar' ? 'Confirmar: fechou' : 'Salvar valores'}
              onCancelar={() => setPainel(null)}
              onSalvar={(dados) => salvarFechamento(dados, painel === 'fechar' ? 'fechou' : null)}
            />
          )}

          {painel === 'pagar' && (
            <div className="indicacao-fechamento">
              <label className="campo">
                Data do PIX
                <input type="date" value={dataPagamento} onChange={(e) => setDataPagamento(e.target.value)} />
              </label>
              <p className="indicacao-detalhe__ajuda">
                Comissão: {indicacao.comissao != null ? formatarReais(indicacao.comissao) : '—'} para o CPF{' '}
                {formatarCpf(indicacao.indicador_cpf)}
              </p>
              <div className="indicacao-fechamento__acoes">
                <button type="button" className="btn btn-ghost" onClick={() => setPainel(null)}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!dataPagamento || salvando}
                  onClick={() => mudarStatus('paga', 'paga', { pago_em: dataPagamento })}
                >
                  Confirmar pagamento
                </button>
              </div>
            </div>
          )}

          {(indicacao.comissao != null || orcamentoVinculado) && painel === null && (
            <dl className="indicacao-detalhe__fechamento">
              {orcamentoVinculado && (
                <>
                  <dt>Orçamento</dt>
                  <dd>
                    {orcamentoVinculado.escola_nome} · {data(orcamentoVinculado.criado_em)}
                  </dd>
                </>
              )}
              <dt>Class Books</dt>
              <dd>{indicacao.qtd_livros ?? '—'}</dd>
              <dt>Valor dos livros</dt>
              <dd>{indicacao.valor_livros != null ? formatarReais(indicacao.valor_livros) : '—'}</dd>
              <dt>Comissão</dt>
              <dd>
                <strong>{indicacao.comissao != null ? formatarReais(indicacao.comissao) : '—'}</strong>
              </dd>
              {indicacao.fechado_em && (
                <>
                  <dt>Fechou em</dt>
                  <dd>{data(indicacao.fechado_em)}</dd>
                </>
              )}
              {indicacao.pago_em && (
                <>
                  <dt>Paga em</dt>
                  <dd>{data(indicacao.pago_em)}</dd>
                </>
              )}
            </dl>
          )}
        </section>

        <section className="indicacao-detalhe__secao">
          <h3>WhatsApp para quem indicou</h3>
          <ul className="indicacao-detalhe__mensagens">
            {TIPOS_MENSAGEM_INDICACAO.map((tipo) => {
              const enviadoEm = indicacao[COLUNA_ENVIO_INDICACAO[tipo] as keyof Indicacao] as string | null;
              const falhouAutomatico = tipo === 'recebida' && indicacao.whatsapp_recebida_disparado_em && !enviadoEm;
              return (
                <li key={tipo}>
                  <span>{ROTULO_MENSAGEM_INDICACAO[tipo]}</span>
                  {enviadoEm ? (
                    <span className="indicacao-detalhe__enviado">✓ enviada {dataHora(enviadoEm)}</span>
                  ) : (
                    <>
                      {falhouAutomatico && <span className="indicacao-detalhe__falhou">automático não saiu</span>}
                      <button type="button" className="btn btn-ghost" onClick={() => setPrevia(tipo)}>
                        Enviar…
                      </button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <section className="indicacao-detalhe__secao">
          <h3>Notas internas</h3>
          <div className="orcamento-detalhe__nova-nota">
            <textarea rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Anotações da equipe..." />
            <button
              type="button"
              className="btn btn-ghost"
              onClick={salvarNotas}
              disabled={salvando || notas === (indicacao.notas_internas ?? '')}
            >
              Salvar notas
            </button>
          </div>
        </section>

        <section className="indicacao-detalhe__secao">
          <h3>Histórico</h3>
          {carregandoHistorico ? (
            <p className="timeline__carregando">Carregando histórico...</p>
          ) : historico.length === 0 ? (
            <p className="timeline__vazio">Nenhuma interação registrada ainda.</p>
          ) : (
            <ul className="timeline">
              {historico.map((h) => (
                <li key={h.id} className={`timeline__item timeline__item--${h.tipo}`}>
                  <div className="timeline__cabecalho">
                    <span className="timeline__tipo">{ROTULO_HISTORICO[h.tipo]}</span>
                    <span className="timeline__data">{dataHora(h.criado_em)}</span>
                  </div>
                  <p className="timeline__conteudo">{h.conteudo}</p>
                  {h.autor && <span className="timeline__autor">{h.autor}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>

        {erro && <p className="resumo__erro">{erro}</p>}
      </div>

      {previa && (
        <div onClick={(e) => e.stopPropagation()}>
          <PreviaWhatsapp
            indicacao={indicacao}
            tipo={previa}
            autorNome={autorNome}
            onFechar={() => setPrevia(null)}
            onEnviado={aposEnvio}
          />
        </div>
      )}
    </div>
  );
}
