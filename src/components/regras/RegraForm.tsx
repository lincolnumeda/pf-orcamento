import { useState } from 'react';
import type { RegraInput } from '../../lib/regras';
import type { GatilhoModo, TipoBeneficio, TipoGatilho } from '../../types';

const TIPOS_GATILHO: { valor: TipoGatilho; rotulo: string }[] = [
  { valor: 'quantidade', rotulo: 'Quantidade de livros' },
  { valor: 'valor_pedido', rotulo: 'Valor do pedido' },
  { valor: 'faixa_frete', rotulo: 'Faixa de frete' },
];

const MODOS_GATILHO: { valor: GatilhoModo; rotulo: string }[] = [
  { valor: 'a_partir_de', rotulo: 'A partir de (fixo, uma vez)' },
  { valor: 'a_cada', rotulo: 'A cada (proporcional)' },
];

const TIPOS_BENEFICIO: { valor: TipoBeneficio; rotulo: string }[] = [
  { valor: 'desconto_frete_pct', rotulo: 'Desconto no frete (%)' },
  { valor: 'desconto_total_pct', rotulo: 'Desconto no total (%)' },
  { valor: 'item_gratis', rotulo: 'Item grátis' },
];

interface Props {
  valorInicial: RegraInput;
  itensBeneficioDisponiveis: string[];
  salvando: boolean;
  erro: string | null;
  onSalvar: (input: RegraInput) => void;
  onCancelar: () => void;
}

export function RegraForm({ valorInicial, itensBeneficioDisponiveis, salvando, erro, onSalvar, onCancelar }: Props) {
  const [valor, setValor] = useState<RegraInput>(valorInicial);

  const set = <K extends keyof RegraInput>(campo: K, valorCampo: RegraInput[K]) =>
    setValor((atual) => ({ ...atual, [campo]: valorCampo }));

  const numeroOuNull = (texto: string): number | null => (texto === '' ? null : Number(texto));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSalvar(valor);
  }

  return (
    <form className="regra-form" onSubmit={handleSubmit}>
      <label className="campo">
        Nome (interno, só a equipe vê)
        <input type="text" required value={valor.nome} onChange={(e) => set('nome', e.target.value)} />
      </label>

      <label className="campo">
        Mensagem pro cliente (email/tela — deixe em branco pra usar o nome acima)
        <input
          type="text"
          value={valor.mensagem_cliente ?? ''}
          onChange={(e) => set('mensagem_cliente', e.target.value || null)}
          placeholder="Ex: Frete grátis!"
        />
      </label>

      <fieldset>
        <legend>Gatilho</legend>
        <div className="row3">
          <label className="campo">
            Tipo de gatilho
            <select value={valor.tipo_gatilho} onChange={(e) => set('tipo_gatilho', e.target.value as TipoGatilho)}>
              {TIPOS_GATILHO.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.rotulo}
                </option>
              ))}
            </select>
          </label>

          <label className="campo">
            Modo do gatilho
            <select value={valor.gatilho_modo} onChange={(e) => set('gatilho_modo', e.target.value as GatilhoModo)}>
              {MODOS_GATILHO.map((m) => (
                <option key={m.valor} value={m.valor}>
                  {m.rotulo}
                </option>
              ))}
            </select>
          </label>

          <label className="campo">
            Valor do gatilho
            <input
              type="number"
              required
              min={0}
              value={valor.gatilho_valor}
              onChange={(e) => set('gatilho_valor', Number(e.target.value))}
            />
          </label>
        </div>

        <div className="row2">
          <label className="campo">
            Frete mín. (R$, opcional)
            <input
              type="number"
              min={0}
              value={valor.frete_min ?? ''}
              onChange={(e) => set('frete_min', numeroOuNull(e.target.value))}
            />
          </label>
          <label className="campo">
            Frete máx. (R$, opcional)
            <input
              type="number"
              min={0}
              value={valor.frete_max ?? ''}
              onChange={(e) => set('frete_max', numeroOuNull(e.target.value))}
            />
          </label>
        </div>
        <p className="regra-form__ajuda">
          Faixa de frete é uma condição extra opcional (ex: "só isenta frete se o frete calculado for baixo") — deixe
          em branco se não se aplica.
        </p>
      </fieldset>

      <fieldset>
        <legend>Benefício</legend>
        <div className="row2">
          <label className="campo">
            Tipo de benefício
            <select
              value={valor.tipo_beneficio}
              onChange={(e) => set('tipo_beneficio', e.target.value as TipoBeneficio)}
            >
              {TIPOS_BENEFICIO.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.rotulo}
                </option>
              ))}
            </select>
          </label>

          <label className="campo">
            {valor.tipo_beneficio === 'item_gratis' ? 'Quantidade grátis' : 'Valor do benefício (%)'}
            <input
              type="number"
              required
              min={0}
              value={valor.beneficio_valor}
              onChange={(e) => set('beneficio_valor', Number(e.target.value))}
            />
          </label>
        </div>

        {valor.tipo_beneficio === 'item_gratis' && (
          <label className="campo">
            Item do benefício
            <select
              required
              value={valor.item_beneficio ?? ''}
              onChange={(e) => set('item_beneficio', e.target.value || null)}
            >
              <option value="" disabled>
                Selecione...
              </option>
              {itensBeneficioDisponiveis.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        )}
      </fieldset>

      <fieldset>
        <legend>Prioridade e exclusividade</legend>
        <div className="row2">
          <label className="campo">
            Grupo exclusivo (opcional)
            <input
              type="text"
              value={valor.grupo_exclusivo ?? ''}
              onChange={(e) => set('grupo_exclusivo', e.target.value || null)}
              placeholder="Ex: frete"
            />
          </label>
          <label className="campo">
            Prioridade (menor = mais prioritária)
            <input
              type="number"
              required
              value={valor.prioridade}
              onChange={(e) => set('prioridade', Number(e.target.value))}
            />
          </label>
        </div>
        <p className="regra-form__ajuda">
          Regras do mesmo grupo exclusivo competem entre si — só a de maior prioridade que disparar é aplicada.
        </p>
      </fieldset>

      <label className="regra-form__ativa">
        <input type="checkbox" checked={valor.ativa} onChange={(e) => set('ativa', e.target.checked)} />
        Regra ativa
      </label>

      {erro && <p className="resumo__erro">{erro}</p>}

      <div className="modal-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancelar} disabled={salvando}>
          Cancelar
        </button>
        <button type="submit" className="btn btn-primary" disabled={salvando}>
          {salvando ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </form>
  );
}
