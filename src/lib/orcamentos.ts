import { orcamentoDb } from './supabase';
import type { Orcamento, StatusOrcamento } from '../types';

export async function listarOrcamentos(): Promise<Orcamento[]> {
  const { data, error } = await orcamentoDb.from('orcamentos').select('*').order('criado_em', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function atualizarStatus(id: string, status: StatusOrcamento): Promise<void> {
  const { error } = await orcamentoDb
    .from('orcamentos')
    .update({ status, atualizado_em: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function atualizarNotas(id: string, notas_internas: string): Promise<void> {
  const { error } = await orcamentoDb
    .from('orcamentos')
    .update({ notas_internas, atualizado_em: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function atualizarAjusteManual(id: string, ajuste_manual: number): Promise<void> {
  const { error } = await orcamentoDb
    .from('orcamentos')
    .update({ ajuste_manual, atualizado_em: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export function totalComAjuste(orcamento: Orcamento): number {
  return orcamento.total_final + orcamento.ajuste_manual;
}

export function linkWhatsApp(numero: string, mensagem: string): string {
  const digitos = numero.replace(/\D/g, '');
  const comCodigoPais = digitos.startsWith('55') ? digitos : `55${digitos}`;
  return `https://api.whatsapp.com/send?phone=${comCodigoPais}&text=${encodeURIComponent(mensagem)}`;
}
