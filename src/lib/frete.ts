import { supabase } from './supabase';

export interface CotacaoFrete {
  valor: number;
  prazoDias: number;
  servico: string;
}

// Chama a Edge Function `cotar-frete` (Melhor Envio) — o token fica só no
// backend da função, nunca no bundle do front.
export async function cotarFrete(cepDestino: string, quantidadeLivros: number): Promise<CotacaoFrete> {
  const { data, error } = await supabase.functions.invoke<CotacaoFrete>('cotar-frete', {
    body: { cep_destino: cepDestino, quantidade_livros: quantidadeLivros },
  });

  if (error) throw error;
  if (!data) throw new Error('Cotação de frete não retornou dados');
  return data;
}
