import { useMemo, useState } from 'react';
import { useOrcamentos } from '../../hooks/useOrcamentos';
import { KanbanColuna } from '../../components/central/KanbanColuna';
import { OrcamentoDetalhe } from '../../components/central/OrcamentoDetalhe';
import type { Orcamento, StatusOrcamento } from '../../types';

const COLUNAS: { status: StatusOrcamento; titulo: string }[] = [
  { status: 'recebido', titulo: 'Recebido' },
  { status: 'em_conversa', titulo: 'Em conversa' },
  { status: 'aprovado', titulo: 'Aprovado' },
  { status: 'pago', titulo: 'Pago' },
  { status: 'perdido', titulo: 'Perdido' },
];

export default function KanbanPage() {
  const { orcamentos, carregando, erro, setOrcamentos } = useOrcamentos();
  const [busca, setBusca] = useState('');
  const [selecionado, setSelecionado] = useState<Orcamento | null>(null);

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

  if (carregando) return <main>Carregando orçamentos...</main>;
  if (erro) return <main>Erro ao carregar orçamentos: {erro}</main>;

  return (
    <main className="kanban-page">
      <div className="kanban-page__cabecalho">
        <h1>Central de orçamentos</h1>
        <input
          type="search"
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
          />
        ))}
      </div>

      {selecionado && (
        <OrcamentoDetalhe orcamento={selecionado} onFechar={() => setSelecionado(null)} onAtualizado={handleAtualizado} />
      )}
    </main>
  );
}
