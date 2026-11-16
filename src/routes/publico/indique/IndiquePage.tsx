import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useIndiqueVisual, LOGO_BRANCO } from './useIndiqueVisual';
import { cpfValido, formatarCpf, somenteDigitos, whatsappValido } from '../../../lib/cpf';
import { formatarWhatsapp } from '../../../lib/formato';
import { criarIndicacao } from '../../../lib/indicacoes';
import { DATA_FIM_INDICACOES, formatarDataCurta, programaEncerrado } from '../../../lib/indicacaoConfig';

const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

const RELACOES = [
  'Sou dono(a) ou gestor(a) da escola',
  'Conheço a gestão / sou amiga(o)',
  'Sou professor(a) na escola',
  'Sou mãe/pai de aluno',
  'Já trabalhei lá',
  'Outro',
];

interface FormIndicacao {
  escola_nome: string;
  escola_cidade: string;
  escola_uf: string;
  escola_responsavel: string;
  escola_cargo: string;
  escola_whatsapp: string;
  escola_email: string;
  indicador_nome: string;
  indicador_whatsapp: string;
  indicador_email: string;
  indicador_cpf: string;
  indicador_relacao: string;
  aceite_contato: boolean;
  aceite_regulamento: boolean;
  website: string; // honeypot
}

const VAZIO: FormIndicacao = {
  escola_nome: '',
  escola_cidade: '',
  escola_uf: '',
  escola_responsavel: '',
  escola_cargo: '',
  escola_whatsapp: '',
  escola_email: '',
  indicador_nome: '',
  indicador_whatsapp: '',
  indicador_email: '',
  indicador_cpf: '',
  indicador_relacao: '',
  aceite_contato: false,
  aceite_regulamento: false,
  website: '',
};

const CAMPOS_ESCOLA: (keyof FormIndicacao)[] = [
  'escola_nome',
  'escola_cidade',
  'escola_uf',
  'escola_responsavel',
  'escola_cargo',
  'escola_whatsapp',
  'escola_email',
];

const OBRIGATORIOS: (keyof FormIndicacao)[] = [
  'escola_nome',
  'escola_cidade',
  'escola_uf',
  'escola_responsavel',
  'escola_whatsapp',
  'indicador_nome',
  'indicador_whatsapp',
  'indicador_email',
  'indicador_cpf',
  'indicador_relacao',
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Campos com problema (pra destacar em coral depois da 1ª tentativa).
function camposInvalidos(f: FormIndicacao): Set<keyof FormIndicacao> {
  const invalidos = new Set<keyof FormIndicacao>();
  for (const c of OBRIGATORIOS) if (!String(f[c]).trim()) invalidos.add(c);
  if (f.indicador_email && !EMAIL_RE.test(f.indicador_email.trim())) invalidos.add('indicador_email');
  if (f.escola_email && !EMAIL_RE.test(f.escola_email.trim())) invalidos.add('escola_email');
  if (f.indicador_cpf && !cpfValido(f.indicador_cpf)) invalidos.add('indicador_cpf');
  if (f.escola_whatsapp && !whatsappValido(f.escola_whatsapp)) invalidos.add('escola_whatsapp');
  if (f.indicador_whatsapp && !whatsappValido(f.indicador_whatsapp)) invalidos.add('indicador_whatsapp');
  if (!f.aceite_contato) invalidos.add('aceite_contato');
  if (!f.aceite_regulamento) invalidos.add('aceite_regulamento');
  return invalidos;
}

function mensagemDeErro(f: FormIndicacao, invalidos: Set<keyof FormIndicacao>): string {
  const vazio = OBRIGATORIOS.some((c) => !String(f[c]).trim());
  if (vazio || !f.aceite_contato || !f.aceite_regulamento) return 'Confira os campos destacados e as duas confirmações.';
  if (invalidos.has('indicador_cpf')) return 'Esse CPF não parece válido.';
  if (invalidos.has('escola_whatsapp') || invalidos.has('indicador_whatsapp')) return 'Confira os números de WhatsApp (com DDD).';
  if (invalidos.has('indicador_email') || invalidos.has('escola_email')) return 'Confira os e-mails informados.';
  return 'Confira os campos destacados.';
}

export default function IndiquePage() {
  useIndiqueVisual(
    'Indique uma escola | Pequenos Fluentes',
    'Conhece uma escola que ainda não usa os Class Books da Pequenos Fluentes? Indique e ganhe 10% do pedido.',
  );
  const [params] = useSearchParams();
  const origem = (params.get('utm_source') ?? '').trim().slice(0, 120) || 'direto';
  const encerrado = programaEncerrado();
  const dataFim = formatarDataCurta(DATA_FIM_INDICACOES);

  const [form, setForm] = useState<FormIndicacao>(VAZIO);
  const [tentou, setTentou] = useState(false);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const secaoRef = useRef<HTMLElement>(null);
  const escolaRef = useRef<HTMLInputElement>(null);

  const invalidos = useMemo(() => camposInvalidos(form), [form]);
  const marcar = (campo: keyof FormIndicacao) => (tentou && invalidos.has(campo) ? 'ind__invalido' : undefined);

  function alterar(campo: keyof FormIndicacao) {
    return (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      let valor: string | boolean =
        e.target instanceof HTMLInputElement && e.target.type === 'checkbox' ? e.target.checked : e.target.value;
      if (campo === 'indicador_cpf') valor = formatarCpf(valor as string);
      if (campo === 'escola_whatsapp' || campo === 'indicador_whatsapp') valor = formatarWhatsapp(valor as string);
      setForm((f) => ({ ...f, [campo]: valor }));
    };
  }

  function irParaFormulario(e?: { preventDefault: () => void }) {
    e?.preventDefault();
    secaoRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro('');
    setTentou(true);
    if (invalidos.size > 0) {
      setErro(mensagemDeErro(form, invalidos));
      return;
    }

    // Honeypot preenchido = robô. Finge que deu certo e não grava nada.
    if (form.website) {
      setEnviado(true);
      return;
    }

    setEnviando(true);
    try {
      const opcional = (v: string) => v.trim() || null;
      await criarIndicacao({
        escola_nome: form.escola_nome.trim(),
        escola_cidade: form.escola_cidade.trim(),
        escola_uf: form.escola_uf,
        escola_responsavel: form.escola_responsavel.trim(),
        escola_cargo: opcional(form.escola_cargo),
        escola_whatsapp: somenteDigitos(form.escola_whatsapp),
        escola_email: opcional(form.escola_email)?.toLowerCase() ?? null,
        indicador_nome: form.indicador_nome.trim(),
        indicador_whatsapp: somenteDigitos(form.indicador_whatsapp),
        indicador_email: form.indicador_email.trim().toLowerCase(),
        indicador_cpf: somenteDigitos(form.indicador_cpf),
        indicador_relacao: form.indicador_relacao,
        origem,
      });
      setEnviado(true);
      irParaFormulario();
    } catch {
      setErro('Não conseguimos enviar agora. Tente de novo em instantes.');
    } finally {
      setEnviando(false);
    }
  }

  // Mantém os dados de quem indica; limpa só a escola e as confirmações.
  function indicarOutra() {
    setForm((f) => {
      const novo = { ...f, aceite_contato: false, aceite_regulamento: false };
      for (const c of CAMPOS_ESCOLA) (novo as Record<string, unknown>)[c] = '';
      return novo;
    });
    setTentou(false);
    setErro('');
    setEnviado(false);
    setTimeout(() => escolaRef.current?.focus(), 0);
  }

  return (
    <div className="ind">
      <header className="ind__hero">
        <span className="ind__estrela" style={{ top: 90, left: '6%' }}>✦</span>
        <span className="ind__estrela" style={{ top: 220, left: '46%', fontSize: 14 }}>✦</span>
        <span className="ind__estrela" style={{ top: 40, right: '30%', fontSize: 16 }}>✦</span>
        <div className="ind__wrap">
          <div className="ind__topo">
            <a className="ind__logo" href="https://pequenosfluentes.com.br/">
              <img src={LOGO_BRANCO} alt="Pequenos Fluentes" />
            </a>
            <span className="ind__tag">Programa de indicação · Class Books</span>
          </div>
          <div className="ind__hero-grid">
            <div>
              <h1>
                Conhece uma escola que <span>ainda não usa</span> os Class Books?
              </h1>
              <p className="ind__lead">
                Indique para a gente. Se ela fechar um pedido de mais de 10 livros, você ganha 10% do valor.
              </p>
              <a className="ind__btn" href="#indicar" onClick={irParaFormulario}>
                Quero indicar uma escola
              </a>
            </div>
            <div className="ind__selo">
              <div>
                <b>10%</b>
                <small>do pedido para quem indicou</small>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="ind__secao">
        <div className="ind__wrap">
          <div className="ind__titulo">
            <h2>Como funciona</h2>
            <p>Você indica, a gente cuida do resto.</p>
          </div>
          <div className="ind__passos">
            <div className="ind__passo" style={{ ['--c' as string]: 'var(--ind-roxo)' }}>
              <h3>Você indica</h3>
              <p>Preencha o formulário com os dados da escola e os seus.</p>
            </div>
            <div className="ind__passo" style={{ ['--c' as string]: 'var(--ind-teal)' }}>
              <h3>A gente confere</h3>
              <p>Em até 2 dias úteis confirmamos se a escola é nova e avisamos você.</p>
            </div>
            <div className="ind__passo" style={{ ['--c' as string]: 'var(--ind-coral)' }}>
              <h3>A gente conversa</h3>
              <p>Nossa equipe entra em contato com a escola e apresenta os Class Books.</p>
            </div>
            <div className="ind__passo" style={{ ['--c' as string]: 'var(--ind-verde)' }}>
              <h3>Você recebe</h3>
              <p>A escola fechou mais de 10 livros e pagou? Seus 10% vão por PIX.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="ind__secao" style={{ paddingTop: 8 }}>
        <div className="ind__wrap">
          <div className="ind__titulo">
            <h2>O essencial das regras</h2>
          </div>
          <div className="ind__regras">
            <div className="ind__regra" style={{ ['--bg-regra' as string]: '#EAF7F6' }}>
              <div className="ind__regra-ic">🏫</div>
              <h3>Escola nova</h3>
              <p>Vale só para escolas que nunca compraram da Pequenos Fluentes.</p>
            </div>
            <div className="ind__regra" style={{ ['--bg-regra' as string]: '#FFF2D6' }}>
              <div className="ind__regra-ic">📚</div>
              <h3>Mais de 10 livros</h3>
              <p>
                O pedido da escola precisa ter 11 Class Books ou mais, somando os volumes. Teacher's Guide não conta.
              </p>
            </div>
            <div className="ind__regra" style={{ ['--bg-regra' as string]: '#FFE9E6' }}>
              <div className="ind__regra-ic">⏱️</div>
              <h3>Quem indica primeiro</h3>
              <p>
                Vale a primeira indicação registrada aqui, antes de a escola pedir orçamento. Indicações até {dataFim}.
              </p>
            </div>
          </div>
          <p style={{ textAlign: 'center', marginTop: 22 }}>
            <Link to="/indique/regulamento" target="_blank">
              Ler o regulamento completo →
            </Link>
          </p>
        </div>
      </section>

      <section className="ind__secao ind__form-sec" id="indicar" ref={secaoRef}>
        <div className="ind__wrap">
          {encerrado ? (
            <div className="ind__form">
              <div className="ind__ok">
                <div className="ind__ok-ic">💜</div>
                <h3>Programa encerrado</h3>
                <p>As indicações foram aceitas até {dataFim}. Obrigada a todo mundo que indicou uma escola!</p>
                <p>
                  Quem já indicou continua valendo pelas regras do{' '}
                  <Link to="/indique/regulamento">regulamento</Link>.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="ind__titulo">
                <h2>Indique uma escola</h2>
                <p>Leva menos de 2 minutos.</p>
              </div>

              <form className="ind__form" noValidate onSubmit={enviar}>
                {enviado ? (
                  <div className="ind__ok" role="status">
                    <div className="ind__ok-ic">🎉</div>
                    <h3>Indicação recebida!</h3>
                    <p>
                      Em até 2 dias úteis a gente confirma pelo seu WhatsApp se a escola é nova e se a indicação está
                      valendo.
                    </p>
                    <p>
                      <button type="button" className="ind__link-botao" onClick={indicarOutra}>
                        Indicar outra escola
                      </button>
                    </p>
                  </div>
                ) : (
                  <>
                    <fieldset>
                      <legend>
                        <i style={{ ['--c' as string]: 'var(--ind-teal)' }}>🏫</i>Dados da escola
                      </legend>
                      <p className="ind__hint">Quanto mais completo, mais rápido a gente consegue falar com ela.</p>
                      <div className="ind__grid2">
                        <div className="ind__campo ind__campo--full">
                          <label htmlFor="ind-escola">Nome da escola</label>
                          <input
                            id="ind-escola"
                            type="text"
                            ref={escolaRef}
                            maxLength={200}
                            value={form.escola_nome}
                            onChange={alterar('escola_nome')}
                            className={marcar('escola_nome')}
                          />
                        </div>
                        <div className="ind__campo">
                          <label htmlFor="ind-cidade">Cidade</label>
                          <input
                            id="ind-cidade"
                            type="text"
                            maxLength={120}
                            value={form.escola_cidade}
                            onChange={alterar('escola_cidade')}
                            className={marcar('escola_cidade')}
                          />
                        </div>
                        <div className="ind__campo">
                          <label htmlFor="ind-uf">Estado</label>
                          <select id="ind-uf" value={form.escola_uf} onChange={alterar('escola_uf')} className={marcar('escola_uf')}>
                            <option value="">Selecione</option>
                            {UFS.map((uf) => (
                              <option key={uf}>{uf}</option>
                            ))}
                          </select>
                        </div>
                        <div className="ind__campo">
                          <label htmlFor="ind-resp">Nome do responsável</label>
                          <input
                            id="ind-resp"
                            type="text"
                            maxLength={200}
                            placeholder="Quem decide a compra"
                            value={form.escola_responsavel}
                            onChange={alterar('escola_responsavel')}
                            className={marcar('escola_responsavel')}
                          />
                        </div>
                        <div className="ind__campo">
                          <label htmlFor="ind-cargo">
                            Cargo <span className="ind__opc">(opcional)</span>
                          </label>
                          <input
                            id="ind-cargo"
                            type="text"
                            maxLength={120}
                            placeholder="Diretora, coordenadora…"
                            value={form.escola_cargo}
                            onChange={alterar('escola_cargo')}
                          />
                        </div>
                        <div className="ind__campo">
                          <label htmlFor="ind-esczap">WhatsApp do responsável</label>
                          <input
                            id="ind-esczap"
                            type="tel"
                            inputMode="tel"
                            placeholder="(11) 99999-9999"
                            value={form.escola_whatsapp}
                            onChange={alterar('escola_whatsapp')}
                            className={marcar('escola_whatsapp')}
                          />
                        </div>
                        <div className="ind__campo">
                          <label htmlFor="ind-escmail">
                            E-mail da escola <span className="ind__opc">(opcional)</span>
                          </label>
                          <input
                            id="ind-escmail"
                            type="email"
                            maxLength={200}
                            value={form.escola_email}
                            onChange={alterar('escola_email')}
                            className={marcar('escola_email')}
                          />
                        </div>
                      </div>
                    </fieldset>

                    <fieldset>
                      <legend>
                        <i style={{ ['--c' as string]: 'var(--ind-roxo)' }}>🙋</i>Seus dados
                      </legend>
                      <p className="ind__hint">É para estes dados que a gente manda as novidades e paga o seu prêmio.</p>
                      <div className="ind__grid2">
                        <div className="ind__campo ind__campo--full">
                          <label htmlFor="ind-nome">Seu nome completo</label>
                          <input
                            id="ind-nome"
                            type="text"
                            autoComplete="name"
                            maxLength={200}
                            value={form.indicador_nome}
                            onChange={alterar('indicador_nome')}
                            className={marcar('indicador_nome')}
                          />
                        </div>
                        <div className="ind__campo">
                          <label htmlFor="ind-zap">Seu WhatsApp</label>
                          <input
                            id="ind-zap"
                            type="tel"
                            inputMode="tel"
                            autoComplete="tel"
                            placeholder="(11) 99999-9999"
                            value={form.indicador_whatsapp}
                            onChange={alterar('indicador_whatsapp')}
                            className={marcar('indicador_whatsapp')}
                          />
                        </div>
                        <div className="ind__campo">
                          <label htmlFor="ind-mail">Seu e-mail</label>
                          <input
                            id="ind-mail"
                            type="email"
                            autoComplete="email"
                            maxLength={200}
                            value={form.indicador_email}
                            onChange={alterar('indicador_email')}
                            className={marcar('indicador_email')}
                          />
                        </div>
                        <div className="ind__campo">
                          <label htmlFor="ind-cpf">Seu CPF</label>
                          <input
                            id="ind-cpf"
                            type="text"
                            inputMode="numeric"
                            placeholder="000.000.000-00"
                            maxLength={14}
                            value={form.indicador_cpf}
                            onChange={alterar('indicador_cpf')}
                            className={marcar('indicador_cpf')}
                          />
                        </div>
                        <div className="ind__campo">
                          <label htmlFor="ind-rel">Sua relação com a escola</label>
                          <select
                            id="ind-rel"
                            value={form.indicador_relacao}
                            onChange={alterar('indicador_relacao')}
                            className={marcar('indicador_relacao')}
                          >
                            <option value="">Selecione</option>
                            {RELACOES.map((r) => (
                              <option key={r}>{r}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <label className={`ind__check ${tentou && !form.aceite_contato ? 'ind__check--invalido' : ''}`}>
                        <input type="checkbox" checked={form.aceite_contato} onChange={alterar('aceite_contato')} />
                        <span>Tenho autorização do responsável para passar o contato dele à Pequenos Fluentes.</span>
                      </label>
                      <label className={`ind__check ${tentou && !form.aceite_regulamento ? 'ind__check--invalido' : ''}`}>
                        <input type="checkbox" checked={form.aceite_regulamento} onChange={alterar('aceite_regulamento')} />
                        <span>
                          Li e aceito o{' '}
                          <Link to="/indique/regulamento" target="_blank">
                            regulamento
                          </Link>
                          , inclusive o uso dos meus dados para este programa.
                        </span>
                      </label>
                    </fieldset>

                    {/* anti-spam: campo escondido que humanos não preenchem */}
                    <div className="ind__honeypot" aria-hidden="true">
                      <label htmlFor="ind-website">Não preencha</label>
                      <input
                        id="ind-website"
                        type="text"
                        name="website"
                        tabIndex={-1}
                        autoComplete="off"
                        value={form.website}
                        onChange={alterar('website')}
                      />
                    </div>

                    <div className="ind__enviar">
                      <p className="ind__erro" role="alert">
                        {erro}
                      </p>
                      <button className="ind__btn" type="submit" disabled={enviando}>
                        {enviando ? 'Enviando…' : 'Enviar indicação'}
                      </button>
                    </div>
                  </>
                )}
              </form>
            </>
          )}
        </div>
      </section>

      <footer className="ind__rodape">
        Pequenos Fluentes · Programa de indicação Class Books ·{' '}
        <Link to="/indique/regulamento" target="_blank">
          Regulamento
        </Link>
      </footer>
    </div>
  );
}
