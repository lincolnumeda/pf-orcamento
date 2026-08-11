import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';
import { encodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { montarEmailHtml, type BeneficioEmail, type FreteBeneficioEmail, type ItemEmail } from './template.ts';

// denomailer só sabe mandar o corpo do email em quoted-printable, e o encoder
// dele tem um bug conhecido: uma linha só com espaços (comum em HTML gerado
// por template string) vira "=20" literal e visível no email — porque o
// encoder faz um replace de "espaço antes de quebra de linha" ANTES de
// escapar o '=' resultante, e depois escapa esse mesmo '=' de novo. Não dá
// pra confiar em nunca ter uma linha assim no HTML, então mandamos o corpo
// já em base64 via `mimeContent` (bypassa o encoder problemático de vez).
function corpoHtmlBase64(html: string) {
  const base64 = encodeBase64(new TextEncoder().encode(html));
  const linhas: string[] = [];
  for (let i = 0; i < base64.length; i += 76) {
    linhas.push(base64.slice(i, i + 76));
  }
  return linhas.join('\r\n');
}

const SMTP_HOST = Deno.env.get('TITAN_SMTP_HOST')!;
const SMTP_PORT = Number(Deno.env.get('TITAN_SMTP_PORT')!);
const SMTP_USER = Deno.env.get('TITAN_SMTP_USER')!;
const SMTP_PASSWORD = Deno.env.get('TITAN_SMTP_PASSWORD')!;

// Domínio do próprio app de orçamento (não o site institucional) — usado só
// pra montar o link do botão "Aprovar orçamento". Em dev aponta pro
// localhost; em produção, pro domínio publicado.
const APP_URL = Deno.env.get('APP_URL')!;

// Cópia interna (invisível pro cliente) de todo orçamento enviado.
const BCC_INTERNO = 'atendimento@pequenosfluentes.com.br';

// itens = carrinho real do cliente (o que ele escolheu no formulário) — sem
// injetar brindes. O que os brindes valem aparece à parte, no quadro de
// benefícios (ver ItemGratis/regrasAplicadas em src/lib/motorRegras.ts).
interface ItemPayload {
  nome: string;
  categoria: string;
  quantidade: number;
  preco_unitario: number;
  teachers_guide: boolean;
}

interface RegraAplicadaPayload {
  nome: string;
  mensagem_cliente: string;
  tipo_beneficio: 'desconto_frete_pct' | 'desconto_total_pct' | 'item_gratis';
  beneficio_valor: number;
  item_beneficio: string | null;
  valor_economizado: number;
}

function paraItemEmail(item: ItemPayload): ItemEmail {
  return {
    nome: item.nome,
    quantidade: item.quantidade,
    precoUnitario: item.preco_unitario,
    destaque: item.teachers_guide,
  };
}

function paraBeneficioEmail(regra: RegraAplicadaPayload): BeneficioEmail {
  return {
    mensagem: regra.mensagem_cliente,
    itemGratis:
      regra.tipo_beneficio === 'item_gratis' && regra.item_beneficio
        ? { nome: regra.item_beneficio, quantidade: regra.beneficio_valor }
        : null,
    valorEconomizado: regra.valor_economizado,
  };
}

function paraFreteBeneficioEmail(regra: RegraAplicadaPayload): FreteBeneficioEmail {
  return { mensagem: regra.mensagem_cliente, valorEconomizado: regra.valor_economizado };
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
    const destinatario: string = body.destinatario;
    const escolaNome: string = body.escola_nome;
    const cidadeUf: string | null = body.cidade_uf ?? null;
    const responsavelNome: string = body.responsavel_nome;
    const itensPayload: ItemPayload[] = body.itens ?? [];
    const totalLivros: number = body.total_livros ?? 0;
    const subtotal: number = body.subtotal;
    const freteBruto: number = body.frete_bruto;
    const freteFinal: number = body.frete_final;
    const totalFinal: number = body.total_final;
    const regrasAplicadas: RegraAplicadaPayload[] = body.regras_aplicadas ?? [];
    const prazoProducao = body.prazo_producao ?? null;
    const prazoTransporte = body.prazo_transporte ?? null;

    if (!orcamentoId || !destinatario || !escolaNome || itensPayload.length === 0) {
      return jsonResponse({ error: 'orcamento_id, destinatario, escola_nome e itens são obrigatórios' }, 400);
    }

    // "Total de itens" é só informativo (livros + Teacher's Guide, tudo que
    // está no carrinho) — não alimenta gatilho de regra nenhum, diferente de
    // totalLivros (que só conta Class Books/Tots, ver contarLivros em
    // src/lib/motorRegras.ts).
    const totalItens = itensPayload.reduce((soma, i) => soma + i.quantidade, 0);

    const regraFrete = regrasAplicadas.find((r) => r.tipo_beneficio === 'desconto_frete_pct');
    const outrosBeneficios = regrasAplicadas.filter((r) => r.tipo_beneficio !== 'desconto_frete_pct');

    const html = montarEmailHtml({
      escolaNome,
      cidadeUf,
      responsavelNome,
      linkAprovacao: `${APP_URL}/aprovar/${orcamentoId}`,
      itens: itensPayload.map(paraItemEmail),
      totalLivros,
      totalItens,
      subtotal,
      freteBruto,
      freteFinal,
      totalFinal,
      freteBeneficio: regraFrete ? paraFreteBeneficioEmail(regraFrete) : null,
      beneficios: outrosBeneficios.map(paraBeneficioEmail),
      prazoProducao,
      prazoTransporte,
    });

    const client = new SMTPClient({
      connection: {
        hostname: SMTP_HOST,
        port: SMTP_PORT,
        tls: true,
        auth: { username: SMTP_USER, password: SMTP_PASSWORD },
      },
    });

    await client.send({
      from: `Pequenos Fluentes <${SMTP_USER}>`,
      to: destinatario,
      bcc: BCC_INTERNO,
      subject: `Orçamento recebido — ${escolaNome}`,
      mimeContent: [
        { mimeType: 'text/html; charset="utf-8"', content: corpoHtmlBase64(html), transferEncoding: 'base64' },
      ],
    });
    await client.close();

    // Best-effort: o email já saiu — se o log falhar não deve virar erro pro
    // cliente que está enviando o orçamento.
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      ).schema('orcamento');
      await supabase
        .from('interacoes')
        .insert({ orcamento_id: orcamentoId, tipo: 'email_enviado', conteudo: `Email enviado para ${destinatario}`, autor: null });
    } catch {
      // não bloqueia a resposta de sucesso do envio do email
    }

    return jsonResponse({ enviado: true });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : 'Erro desconhecido' }, 500);
  }
});
