import type { Produto } from '../../types';
import { formatarReais } from '../../lib/formato';
import { capaProduto } from '../../lib/capas';

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
  const capa = capaProduto(produto.nome, teachersGuide);

  return (
    <div className="book-row">
      {capa && <img className="book-row__capa" src={capa} alt="" loading="lazy" />}

      <div className="book-row__info">
        <span className="book-row__nome">{produto.nome}</span>
        <span className="book-row__preco">{formatarReais(produto.preco)} / un.</span>

        {temTeachersGuide && quantidade > 0 && (
          <label className="book-row__tg">
            <input
              type="checkbox"
              checked={teachersGuide}
              onChange={(e) => onTeachersGuideChange(e.target.checked)}
            />
            + Teacher's Guide (R$ 139,90)
          </label>
        )}
      </div>

      <div className="qty-stepper">
        <button type="button" onClick={() => onQuantidadeChange(Math.max(0, quantidade - 1))} aria-label="Diminuir">
          −
        </button>
        <input
          type="text"
          inputMode="numeric"
          readOnly
          value={quantidade}
          aria-label={`Quantidade de ${produto.nome}`}
        />
        <button type="button" onClick={() => onQuantidadeChange(quantidade + 1)} aria-label="Aumentar">
          +
        </button>
      </div>
    </div>
  );
}
