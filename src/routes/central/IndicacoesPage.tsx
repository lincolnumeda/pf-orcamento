import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import type { Indicacao, Orcamento, StatusIndicacao } from '../../types';
import { ROTULO_STATUS_INDICACAO, STATUS_INDICACAO, listarIndicacoes } from '../../lib/indicacoes';
import { listarOrcamentos } from '../../lib/orcamentos';
import { formatarReais } from '../../lib/formato';
import { conferenciaAtrasada } from '../../lib/indicacaoPrazo';
import { normalizarTextoEscola } from '../../lib/indicacaoChave';
import { IndicacaoDetalhe } from '../../components/indicacoes/IndicacaoDetalhe';

const ACEITAS = new Set<StatusIndicacao>(['aceita', 'em_negociacao', 'fechou', 'nao_fechou', 'paga']);

export default function IndicacoesPage() {
  const auth = useAuth();
  const autorNome = auth.status === 'autorizado' ? auth.usuario.nome || auth.usuario.email : '';
  const [params, setParams] = useSearchParams();
  const [indicacoes, setIndicacoes] = useState<Indicacao[]>([]);
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [filtroStatus, setFiltroStatus] = useState<StatusIndicacao | ''>('');
  const [busca, setBusca] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [ind, orc] = await Promise.all([listarIndicacoes(), listarOrcamentos()]);
      setIndicacoes(ind);
      setOrcamentos(orc);
      setErro(null);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao carregar indicações');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const selecionadaId = params.get('id');
  const selecionada = indicacoes.find((i) => i.id === selecionadaId) ?? null;

  function selecionar(id: string | null) {
    const novos = new URLSearchParams(params);
    if (id) novos.set('id', id);
    else novos.delete('id');
    setParams(novos, { replace: !id });
  }

  function handleAtualizada(atualizada: Indicacao) {
    setIndicacoes((atual) => atual.map((i) => (i.id === atualizada.id ? atualizada : i)));
  }

  const totais = useMemo(() => {
    let aguardando = 0;
    let aceitas = 0;
    let fechadas = 0;
    let aPagar = 0;
    let pagas = 0;
    for (const i of indicacoes) {
      if (i.status === 'recebida') aguardando++;
      if (ACEITAS.has(i.status)) aceitas++;
      if (i.status === 'fechou' || i.status === 'paga') fechadas++;
      if (i.status === 'fechou') aPagar += i.comissao ?? 0;
      if (i.status === 'paga') pagas += i.comissao ?? 0;
    }
    return { recebidas: indicacoes.length, aguardando, aceitas, fechadas, aPagar, pagas };
  }, [indicacoes]);

  const filtradas = useMemo(() => {
    const termo = normalizarTextoEscola(busca);
    return indicacoes.filter((i) => {
      if (filtroStatus && i.status !== filtroStatus) return false;
      if (!termo) return true;
      return (
        normalizarTextoEscola(i.escola_nome).includes(termo) ||
        normalizarTextoEscola(i.indicador_nome).includes(termo) ||
        normalizarTextoEscola(i.escola_cidade).includes(termo)
      );
    });
  }, [indicacoes, filtroStatus, busca]);

  if (carregando && indicacoes.length === 0) return <main className="kanban-page">Carregando indicações...</main>;
  if (erro) return <main className="kanban-page">Erro ao carregar indicações: {erro}</main>;

  return (
    <main className="kanban-page indicacoes-page">
      <div className="kanban-page__cabecalho">
        <h1>Indicações</h1>
        <a className="btn btn-ghost" href="/indique" target="_blank" rel="noreferrer">
          Ver página pública
        </a>
      </div>

      <div className="indicacoes-totais">
        <div className="indicacoes-total">
          <span>Recebidas</span>
          <b>{totais.recebidas}</b>
          <small>{totais.aguardando} aguardando conferência</small>
        </div>
        <div className="indicacoes-total">
          <span>Aceitas</span>
          <b>{totais.aceitas}</b>
        </div>
        <div className="indicacoes-total">
          <span>Fechadas</span>
          <b>{totais.fechadas}</b>
        </div>
        <div className="indicacoes-total indicacoes-total--apagar">
          <span>Comissões a pagar</span>
          <b>{formatarReais(totais.aPagar)}</b>
        </div>
        <div className="indicacoes-total indicacoes-total--pagas">
          <span>Comissões pagas</span>
          <b>{formatarReais(totais.pagas)}</b>
        </div>
      </div>

      <div className="indicacoes-filtros">
        <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value as StatusIndicacao | '')}>
          <option value="">Todos os status</option>
          {STATUS_INDICACAO.map((s) => (
            <option key={s} value={s}>
              {ROTULO_STATUS_INDICACAO[s]} ({indicacoes.filter((i) => i.status === s).length})
            </option>
          ))}
        </select>
        <input
          type="search"
          placeholder="Buscar por escola, cidade ou quem indicou..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      {filtradas.length === 0 ? (
        <p className="kanban-coluna__vazio">Nenhuma indicação {indicacoes.length ? 'com esse filtro' : 'ainda'}.</p>
      ) : (
        <ul className="indicacoes-lista">
          {filtradas.map((i) => {
            const atrasada = conferenciaAtrasada(i.status, i.criado_em);
            return (
              <li key={i.id}>
                <button
                  type="button"
                  className={`indicacao-card indicacao-card--${i.status} ${atrasada ? 'indicacao-card--atrasada' : ''} ${
                    i.possivel_duplicada ? 'indicacao-card--duplicada' : ''
                  }`}
                  onClick={() => selecionar(i.id)}
                >
                  <span className="indicacao-card__escola">{i.escola_nome}</span>
                  <span className="indicacao-card__meta">
                    {i.escola_cidade}/{i.escola_uf} · por {i.indicador_nome}
                  </span>
                  <span className="indicacao-card__selos">
                    <span className={`indicacao-status indicacao-status--${i.status}`}>{ROTULO_STATUS_INDICACAO[i.status]}</span>
                    {i.possivel_duplicada && <span className="indicacao-selo indicacao-selo--duplicada">Possível duplicada</span>}
                    {atrasada && <span className="indicacao-selo indicacao-selo--atrasada">+2 dias úteis sem conferir</span>}
                    {i.comissao != null && <span className="indicacao-selo">{formatarReais(i.comissao)}</span>}
                  </span>
                  <span className="indicacao-card__data">{new Date(i.criado_em).toLocaleDateString('pt-BR')}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {selecionada && (
        <IndicacaoDetalhe
          key={selecionada.id}
          indicacao={selecionada}
          todas={indicacoes}
          orcamentos={orcamentos}
          autorNome={autorNome}
          onFechar={() => selecionar(null)}
          onAtualizada={handleAtualizada}
        />
      )}
    </main>
  );
}
