interface Props {
  ativa: boolean;
  onChange: (ativa: boolean) => void;
  disabled?: boolean;
}

export function Disjuntor({ ativa, onChange, disabled }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ativa}
      disabled={disabled}
      className={`disjuntor ${ativa ? 'disjuntor--ligado' : 'disjuntor--desligado'}`}
      onClick={() => onChange(!ativa)}
    >
      <span className="disjuntor__track">
        <span className="disjuntor__bolinha" />
      </span>
      <span className="disjuntor__rotulo">{ativa ? 'Ativa' : 'Inativa'}</span>
    </button>
  );
}
