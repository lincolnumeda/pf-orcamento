import { formatarWhatsapp } from '../../lib/formato';

export interface DadosContatoValor {
  escolaNome: string;
  responsavelNome: string;
  responsavelEmail: string;
  responsavelWhatsapp: string;
}

interface Props {
  valor: DadosContatoValor;
  cep: string;
  cidadeUf: string | null;
  onChange: (valor: DadosContatoValor) => void;
  onCepChange: (cep: string) => void;
}

export function DadosContato({ valor, cep, cidadeUf, onChange, onCepChange }: Props) {
  const set = (campo: keyof DadosContatoValor) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...valor, [campo]: e.target.value });

  return (
    <div className="card">
      <h3>Escola / contato</h3>
      <div className="campo-grid">
        <label className="campo">
          Nome da escola
          <input type="text" required value={valor.escolaNome} onChange={set('escolaNome')} />
        </label>

        <label className="campo">
          Nome do responsável
          <input type="text" required value={valor.responsavelNome} onChange={set('responsavelNome')} />
        </label>

        <label className="campo">
          Email
          <input type="email" required value={valor.responsavelEmail} onChange={set('responsavelEmail')} />
        </label>

        <label className="campo">
          WhatsApp
          <input
            type="tel"
            required
            inputMode="numeric"
            placeholder="(11) 98312-0446"
            maxLength={15}
            value={valor.responsavelWhatsapp}
            onChange={(e) => onChange({ ...valor, responsavelWhatsapp: formatarWhatsapp(e.target.value) })}
          />
        </label>
      </div>

      <label className="campo">
        CEP de entrega
        <div className="dados-contato__cep-linha">
          <input
            type="text"
            required
            inputMode="numeric"
            maxLength={9}
            value={cep}
            onChange={(e) => onCepChange(e.target.value)}
            placeholder="00000-000"
          />
          {cidadeUf && <span className="dados-contato__cidade">{cidadeUf}</span>}
        </div>
      </label>
    </div>
  );
}
