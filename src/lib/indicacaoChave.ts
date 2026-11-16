// Normalização do nome/cidade da escola pra detectar duplicidade.
//
// ⚠️ ESPELHADO NO SQL: orcamento.normalizar_texto_escola() em
// scripts/sql/criar-indicacoes.sql. O banco calcula escola_chave no insert
// (trigger) e a Central usa esta versão pra comparar com orçamentos — os dois
// lados TÊM que produzir o mesmo resultado. Mudou aqui, mude lá (mesma lista
// de acentos, mesmas palavras ignoradas, mesmo separador).

const COM_ACENTO = 'áàâãäåéèêëíìîïóòôõöúùûüçñýÿÁÀÂÃÄÅÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑÝ';
const SEM_ACENTO = 'aaaaaaeeeeiiiiooooouuuucnyyaaaaaaeeeeiiiiooooouuuucny';

// Palavras que não ajudam a identificar a escola ("Escola X" e "Colégio X
// Ltda" são a mesma X).
const PALAVRAS_IGNORADAS = ['escola', 'colegio', 'ltda'];
const REGEX_IGNORADAS = new RegExp(`\\b(${PALAVRAS_IGNORADAS.join('|')})\\b`, 'g');

export const SEPARADOR_CHAVE = '|';

function tirarAcentos(texto: string): string {
  let saida = '';
  for (const ch of texto) {
    const i = COM_ACENTO.indexOf(ch);
    saida += i >= 0 ? SEM_ACENTO[i] : ch;
  }
  return saida;
}

// minúsculas, sem acento, sem pontuação, sem "escola/colégio/ltda", espaços
// simples.
export function normalizarTextoEscola(texto: string | null | undefined): string {
  return tirarAcentos(texto ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(REGEX_IGNORADAS, ' ')
    .replace(/ +/g, ' ')
    .trim();
}

// "nome|cidade" normalizados — é o que vai em indicacoes.escola_chave.
export function gerarEscolaChave(nome: string, cidade: string): string {
  return `${normalizarTextoEscola(nome)}${SEPARADOR_CHAVE}${normalizarTextoEscola(cidade)}`;
}

// orcamentos não guarda cidade (só CEP), então a comparação com orçamentos
// usa só a parte do nome da chave.
export function nomeDaChave(chave: string): string {
  return chave.split(SEPARADOR_CHAVE)[0] ?? '';
}

// Ajuda visual na Central pra achar orçamentos de uma escola com nome
// parecido. Não decide nada sozinho — a equipe confere.
// Parecido = mesmo nome normalizado, OU um contém o outro (nomes com 5+
// letras, pra "abc" não casar com tudo), OU metade ou mais das palavras em
// comum.
export function nomesParecidos(a: string, b: string): boolean {
  const na = normalizarTextoEscola(a);
  const nb = normalizarTextoEscola(b);
  if (!na || !nb) return false;
  if (na === nb) return true;

  const menor = na.length <= nb.length ? na : nb;
  const maior = menor === na ? nb : na;
  if (menor.length >= 5 && ` ${maior} `.includes(` ${menor} `)) return true;

  const pa = new Set(na.split(' ').filter((p) => p.length > 2));
  const pb = new Set(nb.split(' ').filter((p) => p.length > 2));
  if (pa.size === 0 || pb.size === 0) return false;
  let comuns = 0;
  for (const p of pa) if (pb.has(p)) comuns++;
  return comuns / Math.max(pa.size, pb.size) >= 0.5;
}
