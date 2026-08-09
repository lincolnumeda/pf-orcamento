import type { Produto } from '../../types';
import { formatarReais } from '../../lib/formato';

interface Props {
  produto: Produto;
  quantidade: number;
  teachersGuide: boolean;
  temTeachersGuide: boolean;
  onQuantidadeChange: (quantidade: number) => void;
  onTeachersGuideChange: (ativo: boolean) => void;
}

export function ProdutoLinha({
  produto,
  quantidade,
  teachersGuide,
  temTeachersGuide,
  onQuantidadeChange,
  onTeachersGuideChange,
}: Props) {
  return (
    <div className="produto-linha">
      <div className="produto-linha__info">
        <span className="produto-linha__nome">{produto.nome}</span>
        <span className="produto-linha__preco">{formatarReais(produto.preco)}</span>
      </div>

      <div className="produto-linha__controles">
        <label className="produto-linha__qtd">
          Qtd.
          <input
            type="number"
            min={0}
            value={quantidade}
            onChange={(e) => onQuantidadeChange(Number(e.target.value))}
          />
        </label>

        {temTeachersGuide && quantidade > 0 && (
          <label className="produto-linha__tg">
            <input
              type="checkbox"
              checked={teachersGuide}
              onChange={(e) => onTeachersGuideChange(e.target.checked)}
            />
            + Teacher's Guide (R$ 139,90)
          </label>
        )}
      </div>
    </div>
  );
}
