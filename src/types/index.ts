// Espelha o schema `orcamento` criado no Supabase (ver PROJETO-ORCAMENTO.md, seção 4).

export type CategoriaProduto = 'infantil' | 'tots' | 'teachers_guide' | 'assinatura';

export interface Produto {
  id: string;
  nome: string;
  categoria: CategoriaProduto;
  preco: number;
  livro_relacionado: string | null;
  ativo: boolean;
  // ID do produto correspondente no WooCommerce — usado só na aprovação, pra
  // criar o pedido de verdade. null = produto não é vendável direto (ex:
  // Assinatura Digital, que só existe como brinde, nunca no carrinho real).
  woocommerce_id: number | null;
}

export interface PrazoProducao {
  id: string;
  qtd_min: number;
  qtd_max: number | null;
  dias_uteis: number | null;
  texto_customizado: string | null;
}

export interface FaixaEmbalagem {
  id: string;
  qtd_min: number;
  qtd_max: number;
  altura_cm: number;
  largura_cm: number;
  comprimento_cm: number;
  peso_embalagem_kg: number;
}

export type TipoGatilho = 'quantidade' | 'valor_pedido' | 'faixa_frete';
export type GatilhoModo = 'a_partir_de' | 'a_cada';
export type TipoBeneficio = 'desconto_frete_pct' | 'desconto_total_pct' | 'item_gratis';

export interface Regra {
  id: string;
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
  // Texto amigável pro cliente ver no email/tela (ex: "Frete grátis!"), sem
  // detalhe interno da regra. Se vazio, cai no `nome` como fallback.
  mensagem_cliente: string | null;
  criado_em: string;
  atualizado_em: string;
}

export type StatusOrcamento = 'recebido' | 'em_conversa' | 'aprovado' | 'pago' | 'perdido';

// Um livro/produto escolhido no formulário, com a quantidade e se o Teacher's Guide foi marcado.
export interface ItemOrcamento {
  produto_id: string;
  nome: string;
  categoria: CategoriaProduto;
  quantidade: number;
  preco_unitario: number;
  teachers_guide: boolean;
}

// Snapshot de uma regra que disparou, congelado no momento do envio do orçamento.
// mensagem_cliente já vem resolvida (regra.mensagem_cliente ?? regra.nome) —
// fica imune a edições futuras da regra no admin.
export interface RegraAplicada {
  regra_id: string;
  nome: string;
  mensagem_cliente: string;
  tipo_beneficio: TipoBeneficio;
  beneficio_valor: number;
  item_beneficio: string | null;
  valor_economizado: number;
}

export type TipoInteracao = 'nota' | 'whatsapp_enviado' | 'status_alterado' | 'email_enviado';

// Linha do tempo do orçamento na Central — substitui o campo único de notas
// internas. Log imutável: só cria, nunca edita/apaga (ver RLS da tabela).
export interface Interacao {
  id: string;
  orcamento_id: string;
  tipo: TipoInteracao;
  conteudo: string;
  autor: string | null;
  criado_em: string;
}

export interface Orcamento {
  id: string;
  escola_nome: string;
  responsavel_nome: string;
  responsavel_email: string;
  responsavel_whatsapp: string;
  cep: string;
  itens: ItemOrcamento[];
  subtotal: number;
  frete_bruto: number;
  frete_final: number;
  total_final: number;
  regras_aplicadas: RegraAplicada[];
  status: StatusOrcamento;
  notas_internas: string | null;
  link_pagamento: string | null;
  // Ajuste manual da equipe sobre o total calculado (negativo = desconto
  // negociado, positivo = acréscimo). total_final nunca muda sozinho — ele é
  // o que o motor calculou; o valor que o cliente efetivamente vê/aprova é
  // total_final + ajuste_manual.
  ajuste_manual: number;
  criado_em: string;
  atualizado_em: string;
}

// ===== Programa "Indique uma escola" (scripts/sql/criar-indicacoes.sql) =====

export type StatusIndicacao =
  | 'recebida'
  | 'aceita'
  | 'recusada_cliente'
  | 'recusada_duplicada'
  | 'em_negociacao'
  | 'fechou'
  | 'nao_fechou'
  | 'paga';

export interface Indicacao {
  id: string;
  escola_nome: string;
  escola_cidade: string;
  escola_uf: string;
  escola_responsavel: string;
  escola_cargo: string | null;
  escola_whatsapp: string;
  escola_email: string | null;
  indicador_nome: string;
  indicador_whatsapp: string;
  indicador_email: string;
  indicador_cpf: string;
  indicador_relacao: string;
  origem: string;
  escola_chave: string;
  possivel_duplicada: boolean;
  status: StatusIndicacao;
  valida_ate: string;
  orcamento_id: string | null;
  qtd_livros: number | null;
  valor_livros: number | null;
  comissao: number | null;
  fechado_em: string | null;
  pago_em: string | null;
  notas_internas: string | null;
  whatsapp_recebida_disparado_em: string | null;
  whatsapp_recebida_enviado_em: string | null;
  whatsapp_aceita_enviado_em: string | null;
  whatsapp_recusada_cliente_enviado_em: string | null;
  whatsapp_recusada_duplicada_enviado_em: string | null;
  whatsapp_fechou_enviado_em: string | null;
  whatsapp_paga_enviado_em: string | null;
  criado_em: string;
  atualizado_em: string;
}

// O que o formulário público envia (o resto o trigger preenche).
export type NovaIndicacao = Pick<
  Indicacao,
  | 'escola_nome'
  | 'escola_cidade'
  | 'escola_uf'
  | 'escola_responsavel'
  | 'escola_cargo'
  | 'escola_whatsapp'
  | 'escola_email'
  | 'indicador_nome'
  | 'indicador_whatsapp'
  | 'indicador_email'
  | 'indicador_cpf'
  | 'indicador_relacao'
  | 'origem'
>;

export type TipoHistoricoIndicacao = 'nota' | 'whatsapp_enviado' | 'status_alterado';

export interface HistoricoIndicacao {
  id: string;
  indicacao_id: string;
  tipo: TipoHistoricoIndicacao;
  conteudo: string;
  autor: string | null;
  criado_em: string;
}
