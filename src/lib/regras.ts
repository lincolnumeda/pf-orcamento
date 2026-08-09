import { orcamentoDb } from './supabase';
import type { Regra } from '../types';

export type RegraInput = Omit<Regra, 'id' | 'criado_em' | 'atualizado_em'>;

function formatarReais(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function descreverGatilho(regra: Regra): string {
  let principal: string;

  if (regra.tipo_gatilho === 'quantidade') {
    principal =
      regra.gatilho_modo === 'a_cada' ? `a cada ${regra.gatilho_valor} livro(s)` : `${regra.gatilho_valor}+ livro(s)`;
  } else if (regra.tipo_gatilho === 'valor_pedido') {
    principal =
      regra.gatilho_modo === 'a_cada'
        ? `a cada ${formatarReais(regra.gatilho_valor)} no pedido`
        : `pedido ≥ ${formatarReais(regra.gatilho_valor)}`;
  } else {
    principal = 'frete dentro da faixa configurada';
  }

  const min = regra.frete_min !== null ? formatarReais(regra.frete_min) : null;
  const max = regra.frete_max !== null ? formatarReais(regra.frete_max) : null;

  if (regra.tipo_gatilho === 'faixa_frete') {
    if (min && max) return `frete entre ${min} e ${max}`;
    if (min) return `frete ≥ ${min}`;
    if (max) return `frete ≤ ${max}`;
    return principal;
  }

  if (min && max) return `${principal} e frete entre ${min} e ${max}`;
  if (min) return `${principal} e frete ≥ ${min}`;
  if (max) return `${principal} e frete ≤ ${max}`;
  return principal;
}

function descreverBeneficio(regra: Regra): string {
  if (regra.tipo_beneficio === 'desconto_frete_pct') return `${regra.beneficio_valor}% de desconto no frete`;
  if (regra.tipo_beneficio === 'desconto_total_pct') return `${regra.beneficio_valor}% de desconto no total`;
  return `${regra.beneficio_valor}x ${regra.item_beneficio ?? 'item'} grátis`;
}

export function descreverRegra(regra: Regra): string {
  return `Se ${descreverGatilho(regra)} → ${descreverBeneficio(regra)}`;
}

export async function criarRegra(input: RegraInput): Promise<Regra> {
  const { data, error } = await orcamentoDb.from('regras').insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function atualizarRegra(id: string, input: RegraInput): Promise<Regra> {
  const { data, error } = await orcamentoDb
    .from('regras')
    .update({ ...input, atualizado_em: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function alternarAtiva(id: string, ativa: boolean): Promise<void> {
  const { error } = await orcamentoDb
    .from('regras')
    .update({ ativa, atualizado_em: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function excluirRegra(id: string): Promise<void> {
  const { error } = await orcamentoDb.from('regras').delete().eq('id', id);
  if (error) throw error;
}
