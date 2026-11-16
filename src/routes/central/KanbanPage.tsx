import { useEffect, useMemo, useState } from 'react';
import { useOrcamentos } from '../../hooks/useOrcamentos';
import { useAuth } from '../../hooks/useAuth';
import { KanbanColuna } from '../../components/central/KanbanColuna';
import { OrcamentoDetalhe } from '../../components/central/OrcamentoDetalhe';
import type { Indicacao, Orcamento, StatusOrcamento } from '../../types';
import { listarIndicacoes } from '../../lib/indicacoes';
import { indicacaoDoOrcamento } from '../../lib/indicacaoVinculo';

const COLUNAS: { status: StatusOrcamento; titulo: string }[] = [
  { status: 'recebido', titulo: 'Recebido' },
  { status: 'em_conversa', titulo: 'Em conversa' },
  { status: 'aprovado', titulo: 'Aprovado' },
  { status: 'pago', titulo: 'Pago' },
  { status: 'perdido', titulo: 'Perdido' },
];

export default function KanbanPage() {
  const { orcamentos, carregando, erro, setOrcamentos } = useOrcamentos();
  const auth = useAuth();
  const autorNome = auth.status === 'autorizado' ? auth.usuario.nome || auth.usuario.email : '';
  const [busca, setBusca] = useState('');
  const [selecionado, setSelecionado] = useState<Orcamento | null>(null);
  const [indicacoes, setIndicacoes] = useState<Indicacao[]>([]);

  // Programa de indicação: só pra mostrar o selo "Indicada por" — se falhar
  // (ex.: tabela ainda não criada), a Central segue igual, sem selo.
  useEffect(() => {
    listarIndicacoes()
      .then(setIndicacoes)
      .catch(() => setIndicacoes([]));
  }, []);

  const indicacaoPorOrcamento = useMemo(() => {
    const mapa = new Map<string, Indicacao>();
    if (indicacoes.length === 0) return mapa;
    for (const o of orcamentos) {
      const indicacao = indicacaoDoOrcamento(o, indicacoes);
      if (indicacao) mapa.set(o.id, indicacao);
    }
    return mapa;
  }, [orcamentos, indicacoes]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return orcamentos;
    return orcamentos.filter(
      (o) => o.escola_nome.toLowerCase().includes(termo) || o.responsavel_nome.toLowerCase().includes(termo),
    );
  }, [orcamentos, busca]);

  function handleAtualizado(atualizado: Orcamento) {
    setOrcamentos((atual) => atual.map((o) => (o.id === atualizado.id ? atualizado : o)));
    setSelecionado(atualizado);
  }

  if (carregando) return <main className="kanban-page">Carregando orçamentos...</main>;
  if (erro) return <main className="kanban-page">Erro ao carregar orçamentos: {erro}</main>;

  return (
    <main className="kanban-page">
      <div className="kanban-page__cabecalho">
        <h1>Central de orçamentos</h1>
        <input
          type="search"
          className="kanban-page__busca"
          placeholder="Buscar por escola ou responsável..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      <div className="kanban-page__colunas">
        {COLUNAS.map((coluna) => (
          <KanbanColuna
            key={coluna.status}
            titulo={coluna.titulo}
            orcamentos={filtrados.filter((o) => o.status === coluna.status)}
            onSelecionar={setSelecionado}
            indicacaoPorOrcamento={indicacaoPorOrcamento}
          />
        ))}
      </div>

      {selecionado && (
        <OrcamentoDetalhe
          orcamento={selecionado}
          autorNome={autorNome}
          indicacao={indicacaoPorOrcamento.get(selecionado.id) ?? null}
          onFechar={() => setSelecionado(null)}
          onAtualizado={handleAtualizado}
        />
      )}
    </main>
  );
}
