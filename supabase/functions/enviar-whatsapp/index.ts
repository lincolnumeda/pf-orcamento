import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { montarPayloadWhatsGW } from './whatsgw.ts';

const WHATSGW_API_KEY = Deno.env.get('WHATSGW_API_KEY')!;
const WHATSGW_PHONE_NUMBER = Deno.env.get('WHATSGW_PHONE_NUMBER')!;

// A WhatsGW reseta conexão vinda da infra do Supabase Edge Functions (parece
// restrição de IP do lado deles) — por isso a chamada passa por um relay PHP
// hospedado junto com o app (ver public/api/enviar-whatsapp-relay.php), que
// repassa o payload pro WhatsGW de um IP "normal" de hospedagem.
const RELAY_URL = `${Deno.env.get('APP_URL')!}/api/enviar-whatsapp-relay.php`;
const RELAY_SHARED_SECRET = Deno.env.get('RELAY_SHARED_SECRET')!;

function mensagemAutomatica(nome: string): string {
  return `Olá ${nome}! Vimos que você solicitou um orçamento com a Pequenos Fluentes. Conseguiu ver o email com os detalhes? Se ficou com alguma dúvida, é só chamar por aqui!`;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method Not Allowed' }, 405);
  }

  try {
    const body = await req.json();
    const orcamentoId: string = body.orcamento_id;
    const tipo: string = body.tipo ?? 'manual';
    const mensagemManual: string | undefined = body.mensagem;
    const autor: string | null = body.autor ?? null;

    if (!orcamentoId) {
      return jsonResponse({ error: 'orcamento_id é obrigatório' }, 400);
    }
    if (tipo === 'manual' && !mensagemManual?.trim()) {
      return jsonResponse({ error: 'mensagem é obrigatória pra envio manual' }, 400);
    }

    // service_role: chamada tanto pela Central (autenticada) quanto pelo
    // pg_cron (sem sessão de usuário) — busca e grava sempre com privilégio
    // total, sem depender de RLS.
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    ).schema('orcamento');

    const { data: orcamento, error: orcamentoError } = await supabase
      .from('orcamentos')
      .select('id, responsavel_nome, responsavel_whatsapp')
      .eq('id', orcamentoId)
      .single();

    if (orcamentoError || !orcamento) {
      return jsonResponse({ error: 'Orçamento não encontrado' }, 404);
    }

    const ehAutomatico = tipo === 'automatico';
    const mensagem = ehAutomatico ? mensagemAutomatica(orcamento.responsavel_nome) : (mensagemManual as string);

    const payload = montarPayloadWhatsGW(WHATSGW_API_KEY, WHATSGW_PHONE_NUMBER, {
      numeroDestino: orcamento.responsavel_whatsapp,
      mensagem,
    });

    const respostaWhatsGw = await fetch(RELAY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RELAY_SHARED_SECRET}`,
      },
      body: JSON.stringify(payload),
    });

    if (!respostaWhatsGw.ok) {
      const texto = await respostaWhatsGw.text();
      throw new Error(`Relay/WhatsGW respondeu ${respostaWhatsGw.status}: ${texto}`);
    }

    const autorFinal = ehAutomatico ? 'Automático' : autor;
    const { error: interacaoError } = await supabase
      .from('interacoes')
      .insert({ orcamento_id: orcamentoId, tipo: 'whatsapp_enviado', conteudo: mensagem, autor: autorFinal });

    if (interacaoError) throw interacaoError;

    return jsonResponse({ enviado: true });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : 'Erro desconhecido' }, 500);
  }
});
