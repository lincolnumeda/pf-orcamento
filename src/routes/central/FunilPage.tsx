import { useEffect, useState } from 'react';
import { orcamentoDb } from '../../lib/supabase';
import type { EventoFunil } from '../../lib/funil';

// Contagens vêm prontas do banco (orcamento.funil_periodo) — nada de baixar
// eventos e contar aqui, que esbarraria no limite de 1.000 linhas da API.

const ROTULO_ETAPA: Record<EventoFunil, string> = {
  pagina_aberta: 'Abriu o formulário',
  livro_adicionado: 'Adicionou livro',
  frete_calculado: 'Calculou o frete',
  contato_iniciado: 'Começou o contato',
  orcamento_enviado: 'Enviou o orçamento',
};

const PERIODOS = [7, 30] as const;

interface LinhaFunil {
  ordem: number;
  evento: EventoFunil;
  visitantes: number;
}

interface LinhaOrigem {
  origem: string;
  visitantes: number;
}

async function buscarFunil(dias: number, origem: string | null): Promise<LinhaFunil[]> {
  const { data, error } = await orcamentoDb.rpc('funil_periodo', { dias, p_origem: origem });
  if (error) throw error;
  return ((data ?? []) as LinhaFunil[]).map((l) => ({ ...l, visitantes: Number(l.visitantes) }));
}

async function buscarOrigens(dias: number): Promise<LinhaOrigem[]> {
  const { data, error } = await orcamentoDb.rpc('funil_origens', { dias });
  if (error) throw error;
  return ((data ?? []) as LinhaOrigem[]).map((l) => ({ ...l, visitantes: Number(l.visitantes) }));
}

function porcentagem(parte: number, todo: number): string {
  if (todo === 0) return '—';
  return `${Math.round((parte / todo) * 100)}%`;
}

export default function FunilPage() {
  const [origem, setOrigem] = useState('');
  const [origens, setOrigens] = useState<LinhaOrigem[]>([]);
  const [funis, setFunis] = useState<Record<number, LinhaFunil[]>>({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    buscarOrigens(30)
      .then(setOrigens)
      .catch(() => setOrigens([]));
  }, []);

  useEffect(() => {
    let cancelado = false;
    setCarregando(true);
    Promise.all(PERIODOS.map((dias) => buscarFunil(dias, origem || null)))
      .then((resultados) => {
        if (cancelado) return;
        setFunis(Object.fromEntries(PERIODOS.map((dias, i) => [dias, resultados[i]])));
        setErro(null);
      })
      .catch((err) => {
        if (!cancelado) setErro(err instanceof Error ? err.message : 'Erro ao carregar o funil');
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [origem]);

  return (
    <main className="kanban-page funil-page">
      <div className="kanban-page__cabecalho">
        <h1>Funil do formulário</h1>
      </div>

      <div className="indicacoes-filtros">
        <select value={origem} onChange={(e) => setOrigem(e.target.value)}>
          <option value="">Todas as origens</option>
          {origens.map((o) => (
            <option key={o.origem} value={o.origem}>
              {o.origem} ({o.visitantes})
            </option>
          ))}
        </select>
      </div>

      {erro ? (
        <p className="resumo__erro">Erro ao carregar o funil: {erro}</p>
      ) : (
        <div className={`funil-periodos ${carregando ? 'funil-periodos--carregando' : ''}`}>
          {PERIODOS.map((dias) => {
            const linhas = funis[dias] ?? [];
            const topo = linhas[0]?.visitantes ?? 0;
            return (
              <section key={dias} className="card funil-periodo">
                <h3>Últimos {dias} dias</h3>
                {linhas.length === 0 ? (
                  <p className="funil-periodo__vazio">{carregando ? 'Carregando...' : 'Sem dados.'}</p>
                ) : (
                  <ol className="funil-etapas">
                    {linhas.map((l, i) => {
                      const anterior = i > 0 ? linhas[i - 1].visitantes : null;
                      return (
                        <li key={l.evento} className="funil-etapa">
                          <div className="funil-etapa__linha">
                            <span className="funil-etapa__nome">{ROTULO_ETAPA[l.evento] ?? l.evento}</span>
                            <b className="funil-etapa__valor">{l.visitantes}</b>
                          </div>
                          <div className="funil-etapa__barra" aria-hidden="true">
                            <span style={{ width: topo ? `${Math.min(100, (l.visitantes / topo) * 100)}%` : '0%' }} />
                          </div>
                          {anterior !== null && (
                            <small className="funil-etapa__taxa">
                              {porcentagem(l.visitantes, anterior)} da etapa anterior
                            </small>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                )}
              </section>
            );
          })}
        </div>
      )}

      <p className="funil-page__nota">
        Visitantes únicos que chegaram em cada etapa (sem os testes da equipe). Origem vem do link (?origem=) ou do site
        que mandou a pessoa.
      </p>
    </main>
  );
}
