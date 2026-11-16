import { useMemo, useState } from 'react';
import type { Indicacao, Orcamento } from '../../types';
import { formatarReais } from '../../lib/formato';
import { arredondar2, avisosFechamento, calcularComissao, calcularComissaoDoOrcamento } from '../../lib/indicacaoComissao';
import { COMISSAO_PCT } from '../../lib/indicacaoConfig';
import { nomesParecidos } from '../../lib/indicacaoChave';

export interface DadosFechamento {
  orcamento_id: string | null;
  qtd_livros: number;
  valor_livros: number;
  comissao: number;
}

interface Props {
  indicacao: Indicacao;
  orcamentos: Orcamento[];
  salvando: boolean;
  rotuloSalvar: string;
  onSalvar: (dados: DadosFechamento) => void;
  onCancelar: () => void;
}

function rotuloOrcamento(o: Orcamento): string {
  return `${o.escola_nome} — ${new Date(o.criado_em).toLocaleDateString('pt-BR')} — ${formatarReais(o.total_final + o.ajuste_manual)} (${o.status})`;
}

// Vincula o orçamento e calcula qtd/valor/comissão a partir do SNAPSHOT dele
// (itens congelados + regras aplicadas). Valores ficam editáveis.
export function FechamentoIndicacao({ indicacao, orcamentos, salvando, rotuloSalvar, onSalvar, onCancelar }: Props) {
  const [orcamentoId, setOrcamentoId] = useState(indicacao.orcamento_id ?? '');
  const [qtd, setQtd] = useState(indicacao.qtd_livros != null ? String(indicacao.qtd_livros) : '');
  const [valor, setValor] = useState(indicacao.valor_livros != null ? String(indicacao.valor_livros) : '');
  const [comissao, setComissao] = useState(indicacao.comissao != null ? String(indicacao.comissao) : '');

  // Parecidos primeiro, depois o resto (mais recentes antes).
  const opcoes = useMemo(() => {
    const parecidos = orcamentos.filter((o) => nomesParecidos(o.escola_nome, indicacao.escola_nome));
    const outros = orcamentos.filter((o) => !parecidos.includes(o));
    return { parecidos, outros };
  }, [orcamentos, indicacao.escola_nome]);

  const orcamento = orcamentos.find((o) => o.id === orcamentoId) ?? null;
  const calculo = orcamento ? calcularComissaoDoOrcamento(orcamento) : null;

  function escolherOrcamento(id: string) {
    setOrcamentoId(id);
    const o = orcamentos.find((x) => x.id === id);
    if (!o) return;
    const c = calcularComissaoDoOrcamento(o);
    setQtd(String(c.qtdLivros));
    setValor(c.valorLivros.toFixed(2));
    setComissao(c.comissao.toFixed(2));
  }

  function alterarValor(v: string) {
    setValor(v);
    const n = Number(v);
    if (!Number.isNaN(n)) setComissao(calcularComissao(n).toFixed(2));
  }

  const qtdNum = Number(qtd);
  const valorNum = Number(valor);
  const comissaoNum = Number(comissao);
  const valido = qtd !== '' && valor !== '' && comissao !== '' && [qtdNum, valorNum, comissaoNum].every((n) => !Number.isNaN(n) && n >= 0);

  const avisos = avisosFechamento({
    qtdLivros: Number.isNaN(qtdNum) ? 0 : qtdNum,
    validaAte: indicacao.valida_ate,
    indicacaoCriadaEm: indicacao.criado_em,
    orcamentoCriadoEm: orcamento?.criado_em ?? null,
    fechamentoEm: indicacao.fechado_em ? new Date(indicacao.fechado_em) : new Date(),
  });

  return (
    <div className="indicacao-fechamento">
      <label className="campo">
        Orçamento da escola
        <select value={orcamentoId} onChange={(e) => escolherOrcamento(e.target.value)}>
          <option value="">Sem orçamento vinculado (preencher à mão)</option>
          {opcoes.parecidos.length > 0 && (
            <optgroup label="Nome parecido">
              {opcoes.parecidos.map((o) => (
                <option key={o.id} value={o.id}>
                  {rotuloOrcamento(o)}
                </option>
              ))}
            </optgroup>
          )}
          <optgroup label="Todos os orçamentos">
            {opcoes.outros.map((o) => (
              <option key={o.id} value={o.id}>
                {rotuloOrcamento(o)}
              </option>
            ))}
          </optgroup>
        </select>
      </label>

      {calculo && (
        <p className="indicacao-fechamento__calculo">
          Do orçamento: {calculo.qtdLivros} Class Books · bruto {formatarReais(calculo.valorBruto)} · líquido{' '}
          {formatarReais(calculo.valorLivros)} (já com descontos; sem Teacher's Guide, assinatura e frete) ·{' '}
          {COMISSAO_PCT}% = {formatarReais(calculo.comissao)}
        </p>
      )}

      <div className="row3">
        <label className="campo">
          Qtd. Class Books
          <input type="number" min={0} step={1} value={qtd} onChange={(e) => setQtd(e.target.value)} />
        </label>
        <label className="campo">
          Valor líquido dos livros (R$)
          <input type="number" min={0} step="0.01" value={valor} onChange={(e) => alterarValor(e.target.value)} />
        </label>
        <label className="campo">
          Comissão (R$)
          <input type="number" min={0} step="0.01" value={comissao} onChange={(e) => setComissao(e.target.value)} />
        </label>
      </div>

      {avisos.length > 0 && (
        <ul className="indicacao-aviso indicacao-aviso--lista">
          {avisos.map((a) => (
            <li key={a}>⚠️ {a}</li>
          ))}
        </ul>
      )}

      <div className="indicacao-fechamento__acoes">
        <button type="button" className="btn btn-ghost" onClick={onCancelar}>
          Cancelar
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!valido || salvando}
          onClick={() =>
            onSalvar({
              orcamento_id: orcamentoId || null,
              qtd_livros: Math.round(qtdNum),
              valor_livros: arredondar2(valorNum),
              comissao: arredondar2(comissaoNum),
            })
          }
        >
          {salvando ? 'Salvando...' : rotuloSalvar}
        </button>
      </div>
    </div>
  );
}
