import type { Indicacao, Orcamento } from '../../types';
import { OrcamentoCard } from './OrcamentoCard';

interface Props {
  titulo: string;
  orcamentos: Orcamento[];
  onSelecionar: (orcamento: Orcamento) => void;
  indicacaoPorOrcamento?: Map<string, Indicacao>;
}

export function KanbanColuna({ titulo, orcamentos, onSelecionar, indicacaoPorOrcamento }: Props) {
  return (
    <div className="kanban-coluna">
      <h2 className="kanban-coluna__titulo">
        {titulo} <span className="kanban-coluna__contador">{orcamentos.length}</span>
      </h2>
      <div className="kanban-coluna__cards">
        {orcamentos.map((o) => (
          <OrcamentoCard
            key={o.id}
            orcamento={o}
            onClick={() => onSelecionar(o)}
            indicadaPor={indicacaoPorOrcamento?.get(o.id)?.indicador_nome}
          />
        ))}
        {orcamentos.length === 0 && <p className="kanban-coluna__vazio">Nenhum</p>}
      </div>
    </div>
  );
}
