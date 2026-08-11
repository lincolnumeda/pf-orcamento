import type { Regra } from '../../types';
import { descreverRegra } from '../../lib/regras';
import { Disjuntor } from './Disjuntor';

interface Props {
  regra: Regra;
  onAlternarAtiva: (ativa: boolean) => void;
  onEditar: () => void;
  onExcluir: () => void;
}

export function RegraLinha({ regra, onAlternarAtiva, onEditar, onExcluir }: Props) {
  return (
    <div className={`regra-linha ${regra.ativa ? '' : 'regra-linha--inativa'}`}>
      <span className="regra-linha__nome">{regra.nome}</span>

      <div className="regra-linha__acoes">
        <Disjuntor ativa={regra.ativa} onChange={onAlternarAtiva} />
        <button type="button" className="regra-linha__link" onClick={onEditar}>
          editar
        </button>
        <button type="button" className="regra-linha__link regra-linha__excluir" onClick={onExcluir}>
          excluir
        </button>
      </div>

      <div className="regra-linha__meta">
        {descreverRegra(regra)}
        {(regra.grupo_exclusivo || regra.mensagem_cliente) && (
          <div className="regra-linha__tags">
            {regra.grupo_exclusivo && <span className="pill pill--grupo">grupo: {regra.grupo_exclusivo}</span>}
            <span className="pill">prioridade {regra.prioridade}</span>
            {regra.mensagem_cliente && <span className="pill">"{regra.mensagem_cliente}"</span>}
          </div>
        )}
      </div>
    </div>
  );
}
