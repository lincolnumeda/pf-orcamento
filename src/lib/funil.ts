import { orcamentoDb, supabase } from './supabase';

// Funil de conversão do formulário público. Tabela: orcamento.eventos
// (scripts/sql/criar-funil.sql). Regras:
// - NUNCA atrasar, travar nem derrubar o formulário: registrarEvento() é
//   síncrona, não lança erro e dispara o envio em segundo plano.
// - Cada evento no máximo 1x por aba (memória + sessionStorage).
// - Nada de dado pessoal: só um código aleatório do visitante.

// ⚠️ Espelhado no CHECK de orcamento.eventos.evento e em funil_periodo().
export const EVENTOS_FUNIL = [
  'pagina_aberta',
  'livro_adicionado',
  'frete_calculado',
  'contato_iniciado',
  'orcamento_enviado',
] as const;

export type EventoFunil = (typeof EVENTOS_FUNIL)[number];

const CHAVE_VISITANTE = 'pf_funil_visitante';
const PREFIXO_SESSAO = 'pf_funil_registrado:';
const LARGURA_MOBILE = 768;
const MAX_ORIGEM = 100; // mesmo limite do CHECK da tabela
const MAX_VISITANTE = 64; // idem

const registradosNestaPagina = new Set<EventoFunil>();
let visitanteDaPagina: string | null = null;
let origemDaPagina: string | null = null;

function gerarId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
  }
}

function semWww(host: string): string {
  return host.toLowerCase().replace(/^www\./, '');
}

function limparOrigem(valor: string | null): string | null {
  if (!valor) return null;
  const limpo = valor
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_ORIGEM);
  return limpo || null;
}

// ?origem= da URL; senão o domínio de quem mandou (referrer); senão "direto".
// Referrer do próprio site conta como "direto".
export function calcularOrigem(search: string, referrer: string, hostAtual: string): string {
  const doParametro = limparOrigem(new URLSearchParams(search).get('origem'));
  if (doParametro) return doParametro;
  try {
    if (referrer) {
      const host = semWww(new URL(referrer).hostname);
      if (host && host !== semWww(hostAtual)) return host.slice(0, MAX_ORIGEM);
    }
  } catch {
    // referrer inválido → cai no "direto"
  }
  return 'direto';
}

export function calcularDispositivo(largura: number): 'mobile' | 'desktop' {
  return largura < LARGURA_MOBILE ? 'mobile' : 'desktop';
}

// Código do visitante guardado no localStorage. Se o storage falhar (aba
// privada, bloqueado...), usa um código só desta página.
function obterVisitanteId(): string {
  try {
    const salvo = localStorage.getItem(CHAVE_VISITANTE);
    if (salvo && salvo.length <= MAX_VISITANTE) return salvo;
    const novo = gerarId();
    localStorage.setItem(CHAVE_VISITANTE, novo);
    return novo;
  } catch {
    visitanteDaPagina ??= gerarId();
    return visitanteDaPagina;
  }
}

function obterOrigem(): string {
  if (origemDaPagina === null) {
    try {
      origemDaPagina = calcularOrigem(window.location.search, document.referrer, window.location.hostname);
    } catch {
      origemDaPagina = 'direto';
    }
  }
  return origemDaPagina;
}

function jaRegistrado(evento: EventoFunil): boolean {
  if (registradosNestaPagina.has(evento)) return true;
  try {
    return sessionStorage.getItem(PREFIXO_SESSAO + evento) !== null;
  } catch {
    return false;
  }
}

function marcarRegistrado(evento: EventoFunil) {
  registradosNestaPagina.add(evento);
  try {
    sessionStorage.setItem(PREFIXO_SESSAO + evento, '1');
  } catch {
    // sem sessionStorage, vale só a memória desta página
  }
}

// "equipe" = existe sessão logada (Google) neste navegador — serve pra
// filtrar os testes de quem usa a Central.
async function temSessaoLogada(): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getSession();
    return Boolean(data.session);
  } catch {
    return false;
  }
}

async function enviar(linha: { visitante_id: string; evento: EventoFunil; origem: string; dispositivo: string }) {
  const equipe = await temSessaoLogada();
  // Insert simples, SEM .select(): anon só tem permissão de INSERT nesta
  // tabela; pedir a linha de volta faria o insert falhar.
  await orcamentoDb.from('eventos').insert({ ...linha, equipe });
}

export function registrarEvento(evento: EventoFunil): void {
  try {
    if (jaRegistrado(evento)) return;
    marcarRegistrado(evento);
    const linha = {
      visitante_id: obterVisitanteId(),
      evento,
      origem: obterOrigem(),
      dispositivo: calcularDispositivo(window.innerWidth),
    };
    enviar(linha).catch(() => {
      // falha silenciosa: o formulário não pode perceber
    });
  } catch {
    // idem
  }
}
