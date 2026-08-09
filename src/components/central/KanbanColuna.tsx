import type { Orcamento } from '../../types';
import { OrcamentoCard } from './OrcamentoCard';

interface Props {
  titulo: string;
  orcamentos: Orcamento[];
  onSelecionar: (orcamento: Orcamento) => void;
}

export function KanbanColuna({ titulo, orcamentos, onSelecionar }: Props) {
  return (
    <div className="kanban-coluna">
      <h2 className="kanban-coluna__titulo">
        {titulo} <span className="kanban-coluna__contador">{orcamentos.length}</span>
      </h2>
      <div className="kanban-coluna__cards">
        {orcamentos.map((o) => (
          <OrcamentoCard key={o.id} orcamento={o} onClick={() => onSelecionar(o)} />
        ))}
        {orcamentos.length === 0 && <p className="kanban-coluna__vazio">Nenhum</p>}
      </div>
    </div>
  );
}
