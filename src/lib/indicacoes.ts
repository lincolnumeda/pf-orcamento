import { orcamentoDb, supabase } from './supabase';
import type { HistoricoIndicacao, Indicacao, NovaIndicacao, StatusIndicacao, TipoHistoricoIndicacao } from '../types';
import type { TipoMensagemIndicacao } from '../../supabase/functions/_shared/mensagensIndicacao.ts';

export const ROTULO_STATUS_INDICACAO: Record<StatusIndicacao, string> = {
  recebida: 'Recebida',
  aceita: 'Aceita',
  recusada_cliente: 'Recusada (já é cliente)',
  recusada_duplicada: 'Recusada (já indicada)',
  em_negociacao: 'Em negociação',
  fechou: 'Fechou',
  nao_fechou: 'Não fechou',
  paga: 'Paga',
};

export const STATUS_INDICACAO: StatusIndicacao[] = [
  'recebida',
  'aceita',
  'recusada_cliente',
  'recusada_duplicada',
  'em_negociacao',
  'fechou',
  'nao_fechou',
  'paga',
];

// Formulário público: só INSERT (o anon não tem SELECT, então nada de
// .select() encadeado — mesmo cuidado de OrcamentoPage).
export async function criarIndicacao(dados: NovaIndicacao): Promise<void> {
  const { error } = await orcamentoDb.from('indicacoes').insert(dados);
  if (error) throw error;
}

export async function listarIndicacoes(): Promise<Indicacao[]> {
  const { data, error } = await orcamentoDb.from('indicacoes').select('*').order('criado_em', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function buscarIndicacao(id: string): Promise<Indicacao> {
  const { data, error } = await orcamentoDb.from('indicacoes').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function atualizarIndicacao(id: string, campos: Partial<Indicacao>): Promise<Indicacao> {
  const { data, error } = await orcamentoDb.from('indicacoes').update(campos).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function listarHistoricoIndicacao(indicacaoId: string): Promise<HistoricoIndicacao[]> {
  const { data, error } = await orcamentoDb
    .from('indicacoes_historico')
    .select('*')
    .eq('indicacao_id', indicacaoId)
    .order('criado_em', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function registrarHistoricoIndicacao(
  indicacaoId: string,
  tipo: TipoHistoricoIndicacao,
  conteudo: string,
  autor: string | null,
): Promise<void> {
  const { error } = await orcamentoDb.from('indicacoes_historico').insert({ indicacao_id: indicacaoId, tipo, conteudo, autor });
  if (error) throw error;
}

// Muda o status, grava campos extras (ex.: valores do fechamento) e registra
// no histórico.
export async function mudarStatusIndicacao(
  indicacao: Indicacao,
  novoStatus: StatusIndicacao,
  autor: string,
  extras: Partial<Indicacao> = {},
): Promise<Indicacao> {
  const atualizada = await atualizarIndicacao(indicacao.id, { ...extras, status: novoStatus });
  if (indicacao.status !== novoStatus) {
    await registrarHistoricoIndicacao(
      indicacao.id,
      'status_alterado',
      `${autor} moveu de ${ROTULO_STATUS_INDICACAO[indicacao.status]} → ${ROTULO_STATUS_INDICACAO[novoStatus]}`,
      autor,
    );
  }
  return atualizada;
}

export async function enviarWhatsappIndicacao(
  indicacaoId: string,
  tipo: TipoMensagemIndicacao,
  mensagem: string,
  autor: string,
): Promise<void> {
  const { data, error } = await supabase.functions.invoke<{ enviado?: boolean; error?: string }>('enviar-whatsapp-indicacao', {
    body: { indicacao_id: indicacaoId, tipo, mensagem, autor },
  });
  if (error) {
    // FunctionsHttpError: a mensagem útil vem no corpo da resposta.
    const contexto = (error as { context?: Response }).context;
    if (contexto && typeof contexto.json === 'function') {
      const corpo = await contexto.json().catch(() => null);
      if (corpo?.error) throw new Error(corpo.error);
    }
    throw error;
  }
  if (!data?.enviado) throw new Error(data?.error ?? 'Não foi possível enviar o WhatsApp');
}
