// Popula orcamento.produtos, orcamento.regras e orcamento.faixas_embalagem
// com os dados iniciais descritos no PROJETO-ORCAMENTO.md (seções 2 e 3).
//
// Idempotente: apaga e reinsere só essas tabelas — nunca toca em
// orcamento.orcamentos. Roda com a service role key (bypassa RLS), nunca com
// a anon key.
//
// Uso: npm run seed   (exige SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env)

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import type { CategoriaProduto, GatilhoModo, TipoBeneficio, TipoGatilho } from '../src/types';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY precisam estar definidas em .env');
}

const db = createClient(supabaseUrl, serviceRoleKey).schema('orcamento');

interface ProdutoSeed {
  nome: string;
  categoria: CategoriaProduto;
  preco: number;
  livro_relacionado: string | null;
  ativo: boolean;
  woocommerce_id: number | null;
}

const LIVROS_INFANTIL = ['Hello Baby!', 'Tiny People', 'Little Explorers'];
const LIVROS_TOTS = ['Tots 1', 'Tots 2', 'Tots 3', 'Tots 4', 'Tots 5'];

// My Baby Book não entra aqui: não tem Teacher's Guide (a plataforma própria
// do produto já cumpre essa função — ver seção 2 do PROJETO-ORCAMENTO.md).
const LIVROS_COM_TEACHERS_GUIDE = [...LIVROS_INFANTIL, ...LIVROS_TOTS];

// Mapeamento pro catálogo real do WooCommerce (pequenosfluentes.com.br),
// conferido por nome + preço em 2026-08-09 e confirmado com o Lincoln antes
// de gravar — usado na aprovação (Edge Function aprovar-orcamento) pra criar
// o pedido de verdade com o produto certo.
const WOOCOMMERCE_ID_LIVRO: Record<string, number> = {
  'My Baby Book': 18501,
  'Hello Baby!': 13686,
  'Tiny People': 10726,
  'Little Explorers': 4896,
  'Tots 1': 4313,
  'Tots 2': 4499,
  'Tots 3': 4917,
  'Tots 4': 8091,
  'Tots 5': 8093,
};

const WOOCOMMERCE_ID_TEACHERS_GUIDE: Record<string, number> = {
  'Hello Baby!': 14055,
  'Tiny People': 11250,
  'Little Explorers': 12475,
  'Tots 1': 15218,
  'Tots 2': 15269,
  'Tots 3': 15275,
  'Tots 4': 15281,
  'Tots 5': 15287,
};

const produtos: ProdutoSeed[] = [
  // Class Books — Educação Infantil
  {
    nome: 'My Baby Book',
    categoria: 'infantil',
    preco: 114.9,
    livro_relacionado: null,
    ativo: true,
    woocommerce_id: WOOCOMMERCE_ID_LIVRO['My Baby Book'],
  },
  ...LIVROS_INFANTIL.map((nome) => ({
    nome,
    categoria: 'infantil' as CategoriaProduto,
    preco: 99.9,
    livro_relacionado: null,
    ativo: true,
    woocommerce_id: WOOCOMMERCE_ID_LIVRO[nome],
  })),

  // Coleção Tots — Fundamental 1
  ...LIVROS_TOTS.map((nome) => ({
    nome,
    categoria: 'tots' as CategoriaProduto,
    preco: 99.9,
    livro_relacionado: null,
    ativo: true,
    woocommerce_id: WOOCOMMERCE_ID_LIVRO[nome],
  })),

  // Teacher's Guide — um produto por livro elegível
  ...LIVROS_COM_TEACHERS_GUIDE.map((livro) => ({
    nome: `Teacher's Guide — ${livro}`,
    categoria: 'teachers_guide' as CategoriaProduto,
    preco: 139.9,
    livro_relacionado: livro,
    ativo: true,
    woocommerce_id: WOOCOMMERCE_ID_TEACHERS_GUIDE[livro],
  })),

  // Assinatura Digital — nunca é comprável direto no formulário (só aparece
  // como valor de brinde anunciado), por isso não precisa de woocommerce_id.
  { nome: 'Assinatura Digital', categoria: 'assinatura', preco: 99.9, livro_relacionado: null, ativo: true, woocommerce_id: null },
];

interface RegraSeed {
  nome: string;
  ativa: boolean;
  tipo_gatilho: TipoGatilho;
  gatilho_modo: GatilhoModo;
  gatilho_valor: number;
  frete_min: number | null;
  frete_max: number | null;
  tipo_beneficio: TipoBeneficio;
  beneficio_valor: number;
  item_beneficio: string | null;
  grupo_exclusivo: string | null;
  prioridade: number;
  mensagem_cliente: string;
}

// Regras 1, 2 e 4 dividem o grupo 'frete': dentro de um grupo exclusivo só a
// regra de maior prioridade (menor número) cujo gatilho disparar é aplicada.
// A regra 4 tem prioridade 1 (mais alta) para que, quando o pedido atinge
// R$2.000+, ela "vença" as regras de frete e nenhum desconto de frete seja
// dado junto — conforme a seção 3 do PROJETO-ORCAMENTO.md.
const regras: RegraSeed[] = [
  {
    nome: 'Assinatura de brinde (pedido grande)',
    ativa: true,
    tipo_gatilho: 'valor_pedido',
    gatilho_modo: 'a_partir_de',
    gatilho_valor: 2000,
    frete_min: null,
    frete_max: null,
    tipo_beneficio: 'item_gratis',
    beneficio_valor: 1,
    item_beneficio: 'Assinatura Digital',
    grupo_exclusivo: 'frete',
    prioridade: 1,
    mensagem_cliente: '1 Assinatura Digital de brinde!',
  },
  {
    nome: 'Frete grátis (pedido menor)',
    ativa: true,
    tipo_gatilho: 'quantidade',
    gatilho_modo: 'a_partir_de',
    gatilho_valor: 10,
    frete_min: null,
    frete_max: 100,
    tipo_beneficio: 'desconto_frete_pct',
    beneficio_valor: 100,
    item_beneficio: null,
    grupo_exclusivo: 'frete',
    prioridade: 2,
    mensagem_cliente: 'Frete grátis!',
  },
  {
    nome: 'Frete 50% off (pedido distante)',
    ativa: true,
    tipo_gatilho: 'quantidade',
    gatilho_modo: 'a_partir_de',
    gatilho_valor: 10,
    frete_min: 100,
    frete_max: null,
    tipo_beneficio: 'desconto_frete_pct',
    beneficio_valor: 50,
    item_beneficio: null,
    grupo_exclusivo: 'frete',
    prioridade: 3,
    mensagem_cliente: '50% de desconto no frete!',
  },
  {
    nome: "Teacher's Guide de brinde",
    ativa: true,
    tipo_gatilho: 'quantidade',
    gatilho_modo: 'a_cada',
    gatilho_valor: 10,
    frete_min: null,
    frete_max: null,
    tipo_beneficio: 'item_gratis',
    beneficio_valor: 1,
    item_beneficio: "Teacher's Guide",
    grupo_exclusivo: 'brinde-livro',
    prioridade: 1,
    mensagem_cliente: "Teacher's Guide de brinde!",
  },
];

interface FaixaEmbalagemSeed {
  qtd_min: number;
  qtd_max: number;
  altura_cm: number;
  largura_cm: number;
  comprimento_cm: number;
  peso_embalagem_kg: number;
}

// Acima de 55 livros a Edge Function cotar-frete divide o pedido em múltiplas
// caixas 40×40×30 (a última faixa aqui), preenchendo cada uma até 55 livros.
const faixasEmbalagem: FaixaEmbalagemSeed[] = [
  { qtd_min: 1, qtd_max: 5, altura_cm: 25, largura_cm: 35, comprimento_cm: 5, peso_embalagem_kg: 0 },
  { qtd_min: 6, qtd_max: 10, altura_cm: 25, largura_cm: 35, comprimento_cm: 9, peso_embalagem_kg: 0 },
  { qtd_min: 11, qtd_max: 16, altura_cm: 15, largura_cm: 25, comprimento_cm: 35, peso_embalagem_kg: 0 },
  { qtd_min: 17, qtd_max: 27, altura_cm: 25, largura_cm: 25, comprimento_cm: 35, peso_embalagem_kg: 0 },
  { qtd_min: 28, qtd_max: 55, altura_cm: 40, largura_cm: 40, comprimento_cm: 30, peso_embalagem_kg: 0 },
];

interface PrazoProducaoSeed {
  qtd_min: number;
  qtd_max: number | null;
  dias_uteis: number | null;
  texto_customizado: string | null;
}

const prazosProducao: PrazoProducaoSeed[] = [
  { qtd_min: 1, qtd_max: 20, dias_uteis: 5, texto_customizado: null },
  { qtd_min: 21, qtd_max: 30, dias_uteis: 10, texto_customizado: null },
  { qtd_min: 31, qtd_max: 50, dias_uteis: 15, texto_customizado: null },
  { qtd_min: 51, qtd_max: 100, dias_uteis: 20, texto_customizado: null },
  { qtd_min: 101, qtd_max: 150, dias_uteis: 25, texto_customizado: null },
  { qtd_min: 151, qtd_max: null, dias_uteis: null, texto_customizado: 'Consultar' },
];

async function seed() {
  console.log(`Produtos: apagando existentes e inserindo ${produtos.length}...`);
  const { error: delProdutosError } = await db.from('produtos').delete().not('id', 'is', null);
  if (delProdutosError) throw delProdutosError;

  const { error: insProdutosError } = await db.from('produtos').insert(produtos);
  if (insProdutosError) throw insProdutosError;

  console.log(`Regras: apagando existentes e inserindo ${regras.length}...`);
  const { error: delRegrasError } = await db.from('regras').delete().not('id', 'is', null);
  if (delRegrasError) throw delRegrasError;

  const { error: insRegrasError } = await db.from('regras').insert(regras);
  if (insRegrasError) throw insRegrasError;

  console.log(`Faixas de embalagem: apagando existentes e inserindo ${faixasEmbalagem.length}...`);
  const { error: delFaixasError } = await db.from('faixas_embalagem').delete().not('id', 'is', null);
  if (delFaixasError) throw delFaixasError;

  const { error: insFaixasError } = await db.from('faixas_embalagem').insert(faixasEmbalagem);
  if (insFaixasError) throw insFaixasError;

  console.log(`Prazos de produção: apagando existentes e inserindo ${prazosProducao.length}...`);
  const { error: delPrazosError } = await db.from('prazos_producao').delete().not('id', 'is', null);
  if (delPrazosError) throw delPrazosError;

  const { error: insPrazosError } = await db.from('prazos_producao').insert(prazosProducao);
  if (insPrazosError) throw insPrazosError;

  console.log('Seed concluído.');
}

seed().catch((err) => {
  console.error('Falha no seed:', err);
  process.exit(1);
});
