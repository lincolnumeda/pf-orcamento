import { supabase } from './supabase';
import type { ItemOrcamento, RegraAplicada } from '../types';

export interface DadosEnvioEmail {
  orcamento_id: string;
  destinatario: string;
  escola_nome: string;
  cidade_uf: string | null;
  responsavel_nome: string;
  itens: ItemOrcamento[];
  total_livros: number;
  subtotal: number;
  frete_bruto: number;
  frete_final: number;
  total_final: number;
  regras_aplicadas: RegraAplicada[];
  prazo_producao: { diasUteis: number | null; textoCustomizado: string | null } | null;
  prazo_transporte: { dias: number | null; servico: string | null } | null;
}

// Best-effort: o orçamento já foi salvo antes disso ser chamado, então uma
// falha aqui não deve impedir a confirmação pro cliente — só fica sem email.
export async function enviarEmailOrcamento(dados: DadosEnvioEmail): Promise<void> {
  const { error } = await supabase.functions.invoke('enviar-email', { body: dados });
  if (error) throw error;
}
