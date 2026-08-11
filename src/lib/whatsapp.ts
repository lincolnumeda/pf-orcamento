import { supabase } from './supabase';

export async function enviarWhatsappManual(orcamentoId: string, mensagem: string, autor: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke<{ enviado?: boolean; error?: string }>('enviar-whatsapp', {
    body: { orcamento_id: orcamentoId, mensagem, autor, tipo: 'manual' },
  });
  if (error) throw error;
  if (!data?.enviado) throw new Error(data?.error ?? 'Não foi possível enviar o WhatsApp');
}
