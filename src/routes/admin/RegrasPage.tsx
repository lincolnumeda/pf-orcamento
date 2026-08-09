import { useMemo, useState } from 'react';
import { useRegras } from '../../hooks/useRegras';
import { useProdutos } from '../../hooks/useProdutos';
import { criarRegra, atualizarRegra, alternarAtiva, excluirRegra, type RegraInput } from '../../lib/regras';
import { RegraLinha } from '../../components/regras/RegraLinha';
import { RegraForm } from '../../components/regras/RegraForm';
import type { Regra } from '../../types';

const REGRA_PADRAO: RegraInput = {
  nome: '',
  ativa: true,
  tipo_gatilho: 'quantidade',
  gatilho_modo: 'a_partir_de',
  gatilho_valor: 10,
  frete_min: null,
  frete_max: null,
  tipo_beneficio: 'desconto_frete_pct',
  beneficio_valor: 100,
  item_beneficio: null,
  grupo_exclusivo: null,
  prioridade: 1,
  mensagem_cliente: null,
};

function paraInput(regra: Regra): RegraInput {
  const { id, criado_em, atualizado_em, ...resto } = regra;
  return resto;
}

export default function RegrasPage() {
  const { regras, carregando, erro, refetch } = useRegras();
  const { produtos } = useProdutos();
  const [editando, setEditando] = useState<Regra | 'novo' | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);

  const itensBeneficioDisponiveis = useMemo(() => {
    const set = new Set<string>();
    for (const p of produtos) {
      if (p.categoria === 'teachers_guide') set.add("Teacher's Guide");
      if (p.categoria === 'assinatura') set.add(p.nome);
    }
    return [...set];
  }, [produtos]);

  const regrasOrdenadas = useMemo(
    () =>
      [...regras].sort((a, b) => {
        const grupoA = a.grupo_exclusivo ?? '￿';
        const grupoB = b.grupo_exclusivo ?? '￿';
        if (grupoA !== grupoB) return grupoA.localeCompare(grupoB);
        return a.prioridade - b.prioridade;
      }),
    [regras],
  );

  async function handleSalvar(input: RegraInput) {
    setSalvando(true);
    setErroForm(null);
    try {
      if (editando === 'novo') {
        await criarRegra(input);
      } else if (editando) {
        await atualizarRegra(editando.id, input);
      }
      await refetch();
      setEditando(null);
    } catch (err) {
      setErroForm(err instanceof Error ? err.message : 'Erro ao salvar regra');
    } finally {
      setSalvando(false);
    }
  }

  async function handleAlternarAtiva(regra: Regra, ativa: boolean) {
    try {
      await alternarAtiva(regra.id, ativa);
      await refetch();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao atualizar regra');
    }
  }

  async function handleExcluir(regra: Regra) {
    if (!confirm(`Excluir a regra "${regra.nome}"? Isso não afeta orçamentos já enviados.`)) return;
    try {
      await excluirRegra(regra.id);
      await refetch();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao excluir regra');
    }
  }

  if (carregando) return <main>Carregando regras...</main>;
  if (erro) return <main>Erro ao carregar regras: {erro}</main>;

  return (
    <main className="regras-page">
      <div className="regras-page__cabecalho">
        <h1>Administração de regras</h1>
        <button type="button" onClick={() => setEditando('novo')}>
          + Nova regra
        </button>
      </div>

      {editando && (
        <div className="regra-form__painel">
          <h2>{editando === 'novo' ? 'Nova regra' : `Editar: ${editando.nome}`}</h2>
          <RegraForm
            valorInicial={editando === 'novo' ? REGRA_PADRAO : paraInput(editando)}
            itensBeneficioDisponiveis={itensBeneficioDisponiveis}
            salvando={salvando}
            erro={erroForm}
            onSalvar={handleSalvar}
            onCancelar={() => {
              setEditando(null);
              setErroForm(null);
            }}
          />
        </div>
      )}

      <div className="regras-page__lista">
        {regrasOrdenadas.map((regra) => (
          <RegraLinha
            key={regra.id}
            regra={regra}
            onAlternarAtiva={(ativa) => handleAlternarAtiva(regra, ativa)}
            onEditar={() => setEditando(regra)}
            onExcluir={() => handleExcluir(regra)}
          />
        ))}
        {regrasOrdenadas.length === 0 && <p>Nenhuma regra cadastrada ainda.</p>}
      </div>
    </main>
  );
}
