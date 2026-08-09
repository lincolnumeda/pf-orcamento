import { supabase } from './supabase';
import type { Orcamento } from '../types';

export async function consultarOrcamentoPublico(orcamentoId: string): Promise<Orcamento> {
  const { data, error } = await supabase.functions.invoke<{ orcamento?: Orcamento; error?: string }>(
    'aprovar-orcamento',
    { body: { orcamento_id: orcamentoId, acao: 'consultar' } },
  );
  if (error) throw error;
  if (!data?.orcamento) throw new Error(data?.error ?? 'Orçamento não encontrado');
  return data.orcamento;
}

export async function confirmarAprovacao(orcamentoId: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke<{ link_pagamento?: string; error?: string }>(
    'aprovar-orcamento',
    { body: { orcamento_id: orcamentoId, acao: 'confirmar' } },
  );
  if (error) throw error;
  if (!data?.link_pagamento) throw new Error(data?.error ?? 'Não foi possível gerar o link de pagamento');
  return data.link_pagamento;
}
