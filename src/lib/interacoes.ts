import { orcamentoDb } from './supabase';
import type { Interacao, StatusOrcamento, TipoInteracao } from '../types';

export async function listarInteracoes(orcamentoId: string): Promise<Interacao[]> {
  const { data, error } = await orcamentoDb
    .from('interacoes')
    .select('*')
    .eq('orcamento_id', orcamentoId)
    .order('criado_em', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function criarInteracao(
  orcamentoId: string,
  tipo: TipoInteracao,
  conteudo: string,
  autor: string | null,
): Promise<Interacao> {
  const { data, error } = await orcamentoDb
    .from('interacoes')
    .insert({ orcamento_id: orcamentoId, tipo, conteudo, autor })
    .select()
    .single();
  if (error) throw error;
  return data;
}

const ROTULO_STATUS: Record<StatusOrcamento, string> = {
  recebido: 'Recebido',
  em_conversa: 'Em conversa',
  aprovado: 'Aprovado',
  pago: 'Pago',
  perdido: 'Perdido',
};

export function descreverMudancaStatus(autor: string, de: StatusOrcamento, para: StatusOrcamento): string {
  return `${autor} moveu de ${ROTULO_STATUS[de]} → ${ROTULO_STATUS[para]}`;
}
