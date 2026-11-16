// Envia as mensagens de WhatsApp do programa "Indique uma escola" pro
// indicador. Function separada de enviar-whatsapp (orçamentos) pra não mexer
// no fluxo que já funciona — reaproveita o mesmo montador de payload
// (whatsgw.ts) e o mesmo relay PHP na Hostinger.
//
// Chamadas:
//  - pg_cron (scripts/sql/agendar-whatsapp-indicacao.sql), com a service_role:
//      { indicacao_id, tipo: 'recebida', automatico: true }
//    → monta o texto daqui (_shared/mensagensIndicacao.ts).
//  - Central (usuário logado), depois da prévia editável:
//      { indicacao_id, tipo, mensagem, autor }
//
// Cada tipo de mensagem sai no máximo uma vez: a coluna
// whatsapp_<tipo>_enviado_em é reservada de forma atômica (UPDATE ... WHERE
// coluna IS NULL) antes do envio e liberada de novo se o envio falhar.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { montarPayloadWhatsGW } from '../enviar-whatsapp/whatsgw.ts';
import {
  COLUNA_ENVIO_INDICACAO,
  ROTULO_MENSAGEM_INDICACAO,
  ehTipoMensagemIndicacao,
  montarMensagemIndicacao,
} from '../_shared/mensagensIndicacao.ts';

const WHATSGW_API_KEY = Deno.env.get('WHATSGW_API_KEY')!;
const WHATSGW_PHONE_NUMBER = Deno.env.get('WHATSGW_PHONE_NUMBER')!;
const APP_URL = Deno.env.get('APP_URL')!;
const RELAY_URL = `${APP_URL}/api/enviar-whatsapp-relay.php`;
const RELAY_SHARED_SECRET = Deno.env.get('RELAY_SHARED_SECRET')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function roleDoJwt(token: string): string | null {
  try {
    const parte = token.split('.')[1];
    const json = atob(parte.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(parte.length / 4) * 4, '='));
    return JSON.parse(json).role ?? null;
  } catch {
    return null;
  }
}

// Só o cron (service_role) ou alguém logado na Central pode disparar — a anon
// key pública do front não basta (senão qualquer um mandaria mensagem em nome
// da Pequenos Fluentes).
// A assinatura do JWT já é conferida pelo gateway do Supabase (verify_jwt,
// padrão do deploy — NÃO publicar com --no-verify-jwt).
async function chamadaAutorizada(req: Request): Promise<{ ok: boolean; servico: boolean }> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return { ok: false, servico: false };
  if (token === SERVICE_ROLE_KEY || roleDoJwt(token) === 'service_role') return { ok: true, servico: true };
  const { data, error } = await createClient(SUPABASE_URL, SERVICE_ROLE_KEY).auth.getUser(token);
  return { ok: !error && !!data.user, servico: false };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method Not Allowed' }, 405);
  }

  const auth = await chamadaAutorizada(req);
  if (!auth.ok) return jsonResponse({ error: 'Não autorizado' }, 401);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY).schema('orcamento');
  let colunaReservada: string | null = null;
  let indicacaoId: string | null = null;

  try {
    const body = await req.json();
    indicacaoId = body.indicacao_id ?? null;
    const tipo = body.tipo;
    const automatico = body.automatico === true;
    const mensagemManual: string | undefined = body.mensagem;
    const autor: string | null = body.autor ?? null;

    if (!indicacaoId) return jsonResponse({ error: 'indicacao_id é obrigatório' }, 400);
    if (!ehTipoMensagemIndicacao(tipo)) return jsonResponse({ error: 'tipo de mensagem inválido' }, 400);
    if (automatico && (!auth.servico || tipo !== 'recebida')) {
      return jsonResponse({ error: 'envio automático só da mensagem "recebida", pelo cron' }, 400);
    }
    if (!automatico && !mensagemManual?.trim()) {
      return jsonResponse({ error: 'mensagem é obrigatória pra envio manual' }, 400);
    }

    const { data: indicacao, error: indicacaoError } = await supabase
      .from('indicacoes')
      .select('id, indicador_nome, indicador_whatsapp, escola_nome, comissao')
      .eq('id', indicacaoId)
      .single();
    if (indicacaoError || !indicacao) return jsonResponse({ error: 'Indicação não encontrada' }, 404);

    const mensagem = automatico
      ? montarMensagemIndicacao('recebida', {
          indicadorNome: indicacao.indicador_nome,
          escolaNome: indicacao.escola_nome,
          link: `${APP_URL}/indique`,
        })
      : (mensagemManual as string).trim();

    if (/\{\w+\}/.test(mensagem)) {
      return jsonResponse({ error: 'A mensagem ainda tem variável sem preencher (ex.: {comissao})' }, 400);
    }

    // Reserva atômica: se outra chamada (duplo clique, cron + manual) já
    // reservou/enviou essa mensagem, não manda de novo.
    const coluna = COLUNA_ENVIO_INDICACAO[tipo];
    const agora = new Date().toISOString();
    const { data: reservada, error: reservaError } = await supabase
      .from('indicacoes')
      .update({ [coluna]: agora })
      .eq('id', indicacaoId)
      .is(coluna, null)
      .select('id');
    if (reservaError) throw reservaError;
    if (!reservada || reservada.length === 0) {
      return jsonResponse({ error: `A mensagem "${ROTULO_MENSAGEM_INDICACAO[tipo]}" já foi enviada pra essa indicação` }, 409);
    }
    colunaReservada = coluna;

    const payload = montarPayloadWhatsGW(WHATSGW_API_KEY, WHATSGW_PHONE_NUMBER, {
      numeroDestino: indicacao.indicador_whatsapp,
      mensagem,
    });

    const resposta = await fetch(RELAY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RELAY_SHARED_SECRET}` },
      body: JSON.stringify(payload),
    });
    if (!resposta.ok) {
      const texto = await resposta.text();
      throw new Error(`Relay/WhatsGW respondeu ${resposta.status}: ${texto}`);
    }
    colunaReservada = null; // enviado — a marca fica

    const { error: historicoError } = await supabase.from('indicacoes_historico').insert({
      indicacao_id: indicacaoId,
      tipo: 'whatsapp_enviado',
      conteudo: `[${ROTULO_MENSAGEM_INDICACAO[tipo]}] ${mensagem}`,
      autor: automatico ? 'Automático' : autor,
    });
    if (historicoError) console.error('Falha ao registrar histórico', historicoError);

    return jsonResponse({ enviado: true, enviado_em: agora });
  } catch (err) {
    // Envio falhou depois da reserva → libera pra dar pra tentar de novo.
    if (colunaReservada && indicacaoId) {
      await supabase.from('indicacoes').update({ [colunaReservada]: null }).eq('id', indicacaoId);
    }
    return jsonResponse({ error: err instanceof Error ? err.message : 'Erro desconhecido' }, 500);
  }
});
