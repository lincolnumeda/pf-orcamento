// Textos das mensagens de WhatsApp do programa "Indique uma escola".
//
// ESTE É O ÚNICO LUGAR DOS TEXTOS: a Edge Function enviar-whatsapp-indicacao
// usa daqui (mensagem automática "recebida") e a Central também (prévia
// editável antes de cada envio manual). Pra mudar um texto, mude aqui e:
//   - republique a function (npx supabase functions deploy enviar-whatsapp-indicacao)
//   - faça o deploy do front (push na main)
//
// Variáveis: {indicador} {escola} {comissao} {link}
// Sem imports de propósito — roda igual no Deno (Edge Function) e no Vite.

export type TipoMensagemIndicacao = 'recebida' | 'aceita' | 'recusada_cliente' | 'recusada_duplicada' | 'fechou' | 'paga';

export const LINK_INDICAR = 'https://orcamento.pequenosfluentes.com.br/indique';

export const MENSAGENS_INDICACAO: Record<TipoMensagemIndicacao, string> = {
  recebida:
    'Oi, {indicador}! Recebemos sua indicação da {escola} 💜 Em até 2 dias úteis a gente confere se ela é uma escola nova e te avisa por aqui.',
  aceita:
    'Oi, {indicador}! Sua indicação da {escola} foi aceita ✅ Nossa equipe já vai entrar em contato com a escola. Se ela fechar um pedido de mais de 10 livros em até 30 dias, os seus 10% são garantidos. A gente te avisa!',
  recusada_cliente:
    'Oi, {indicador}! Obrigada pela indicação da {escola}. Ela já é cliente da Pequenos Fluentes, então não entra no programa 😕 Conhece outra escola? É só indicar de novo: {link}',
  recusada_duplicada:
    'Oi, {indicador}! Obrigada pela indicação da {escola}. Outra pessoa indicou essa escola antes, então vale a primeira indicação 😕 Conhece outra escola? É só indicar de novo: {link}',
  fechou:
    '{indicador}, boa notícia! A {escola} fechou o pedido 🎉 Assim que o pagamento for confirmado, sua comissão de R$ {comissao} vai por PIX para o CPF cadastrado.',
  paga: 'Pronto, {indicador}! Sua comissão de R$ {comissao} foi paga por PIX. Obrigada por indicar a Pequenos Fluentes 💜',
};

// Rótulo do botão na Central.
export const ROTULO_MENSAGEM_INDICACAO: Record<TipoMensagemIndicacao, string> = {
  recebida: 'Recebida',
  aceita: 'Aceita',
  recusada_cliente: 'Já é cliente',
  recusada_duplicada: 'Já indicada',
  fechou: 'Fechou',
  paga: 'Comissão paga',
};

// Coluna em orcamento.indicacoes que marca o envio — garante que a mesma
// mensagem nunca sai duas vezes.
export const COLUNA_ENVIO_INDICACAO: Record<TipoMensagemIndicacao, string> = {
  recebida: 'whatsapp_recebida_enviado_em',
  aceita: 'whatsapp_aceita_enviado_em',
  recusada_cliente: 'whatsapp_recusada_cliente_enviado_em',
  recusada_duplicada: 'whatsapp_recusada_duplicada_enviado_em',
  fechou: 'whatsapp_fechou_enviado_em',
  paga: 'whatsapp_paga_enviado_em',
};

export const TIPOS_MENSAGEM_INDICACAO = Object.keys(MENSAGENS_INDICACAO) as TipoMensagemIndicacao[];

export function ehTipoMensagemIndicacao(valor: unknown): valor is TipoMensagemIndicacao {
  return typeof valor === 'string' && Object.prototype.hasOwnProperty.call(MENSAGENS_INDICACAO, valor);
}

// "Maria Clara Souza" → "Maria". Mais natural no "Oi, Maria!".
export function primeiroNome(nomeCompleto: string): string {
  return nomeCompleto.trim().split(/\s+/)[0] ?? '';
}

// 1234.5 → "1.234,50" (sem depender de Intl/ICU do runtime).
export function formatarValorBR(valor: number): string {
  const [inteiro, centavos] = (Math.round(valor * 100) / 100).toFixed(2).split('.');
  return `${inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${centavos}`;
}

export interface VariaveisMensagemIndicacao {
  indicadorNome: string;
  escolaNome: string;
  comissao?: number | null;
  link?: string;
}

export function montarMensagemIndicacao(tipo: TipoMensagemIndicacao, vars: VariaveisMensagemIndicacao): string {
  const valores: Record<string, string> = {
    indicador: primeiroNome(vars.indicadorNome),
    escola: vars.escolaNome.trim(),
    comissao: vars.comissao != null ? formatarValorBR(vars.comissao) : '{comissao}',
    link: vars.link ?? LINK_INDICAR,
  };
  return MENSAGENS_INDICACAO[tipo].replace(/\{(\w+)\}/g, (original, chave: string) => valores[chave] ?? original);
}
