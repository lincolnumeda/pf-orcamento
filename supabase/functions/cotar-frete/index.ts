import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { calcularVolumes, type FaixaEmbalagem } from './embalagem.ts';

const MELHOR_ENVIO_URL = 'https://www.melhorenvio.com.br/api/v2/me/shipment/calculate';
const CEP_ORIGEM = Deno.env.get('MELHOR_ENVIO_CEP_ORIGEM')!;
const MELHOR_ENVIO_TOKEN = Deno.env.get('MELHOR_ENVIO_TOKEN')!;

interface CotacaoMelhorEnvio {
  price?: string;
  delivery_time?: number;
  name?: string;
  company?: { name?: string };
  error?: string;
}

// Só trabalhamos com essas transportadoras/modalidades hoje (contrato ativo
// no Melhor Envio) — as demais que a API retorna (Loggi, Azul Cargo, etc.)
// não devem entrar na cotação nem serem oferecidas ao cliente.
const TRANSPORTADORAS_PERMITIDAS = [
  { company: 'Correios', name: 'PAC' },
  { company: 'Correios', name: 'SEDEX' },
  { company: 'Jadlog', name: '.Com' },
];

function permitida(cotacao: CotacaoMelhorEnvio): boolean {
  return TRANSPORTADORAS_PERMITIDAS.some(
    (t) => t.company === cotacao.company?.name && t.name === cotacao.name,
  );
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
    const { cep_destino, quantidade_livros } = await req.json();
    if (!cep_destino || !quantidade_livros || quantidade_livros <= 0) {
      return jsonResponse({ error: 'cep_destino e quantidade_livros (>0) são obrigatórios' }, 400);
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!);
    const { data: faixas, error: faixasError } = await supabase
      .schema('orcamento')
      .from('faixas_embalagem')
      .select('qtd_min, qtd_max, altura_cm, largura_cm, comprimento_cm, peso_embalagem_kg')
      .order('qtd_min');

    if (faixasError) throw faixasError;

    const volumes = calcularVolumes(quantidade_livros, (faixas ?? []) as FaixaEmbalagem[]);

    const resposta = await fetch(MELHOR_ENVIO_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${MELHOR_ENVIO_TOKEN}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'Pequenos Fluentes Orçamento (contato@pequenosfluentes.com.br)',
      },
      body: JSON.stringify({
        from: { postal_code: CEP_ORIGEM },
        to: { postal_code: String(cep_destino).replace(/\D/g, '') },
        volumes,
        options: { insurance_value: 0, receipt: false, own_hand: false },
      }),
    });

    if (!resposta.ok) {
      const texto = await resposta.text();
      throw new Error(`Melhor Envio respondeu ${resposta.status}: ${texto}`);
    }

    const cotacoes = (await resposta.json()) as CotacaoMelhorEnvio[];
    const validas = (Array.isArray(cotacoes) ? cotacoes : []).filter((c) => !c.error && c.price && permitida(c));

    if (validas.length === 0) {
      return jsonResponse({ error: 'Nenhuma das transportadoras contratadas (Correios PAC/SEDEX, Jadlog .Com) atende esse CEP' }, 422);
    }

    const maisBarata = validas.reduce((menor, atual) => (Number(atual.price) < Number(menor.price) ? atual : menor));

    return jsonResponse({
      valor: Number(maisBarata.price),
      prazoDias: Number(maisBarata.delivery_time ?? 0),
      servico: `${maisBarata.company?.name ?? ''} ${maisBarata.name ?? ''}`.trim(),
    });
  } catch (err) {
    return jsonResponse({ error: err instanceof Error ? err.message : 'Erro desconhecido' }, 500);
  }
});
