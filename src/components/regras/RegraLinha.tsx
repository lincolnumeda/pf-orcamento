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
    <div className="regra-linha">
      <Disjuntor ativa={regra.ativa} onChange={onAlternarAtiva} />

      <div className="regra-linha__info">
        <span className="regra-linha__nome">{regra.nome}</span>
        <span className="regra-linha__descricao">{descreverRegra(regra)}</span>
        {(regra.grupo_exclusivo || regra.mensagem_cliente) && (
          <span className="regra-linha__meta">
            {regra.grupo_exclusivo && `Grupo: ${regra.grupo_exclusivo} (prioridade ${regra.prioridade})`}
            {regra.grupo_exclusivo && regra.mensagem_cliente && ' — '}
            {regra.mensagem_cliente && `Mensagem: "${regra.mensagem_cliente}"`}
          </span>
        )}
      </div>

      <div className="regra-linha__acoes">
        <button type="button" onClick={onEditar}>
          Editar
        </button>
        <button type="button" className="regra-linha__excluir" onClick={onExcluir}>
          Excluir
        </button>
      </div>
    </div>
  );
}
