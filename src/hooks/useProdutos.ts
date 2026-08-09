import { useEffect, useState } from 'react';
import { orcamentoDb } from '../lib/supabase';
import type { Produto } from '../types';

export function useProdutos() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;

    orcamentoDb
      .from('produtos')
      .select('*')
      .eq('ativo', true)
      .then(({ data, error }) => {
        if (cancelado) return;
        if (error) {
          setErro(error.message);
        } else {
          setProdutos(data ?? []);
        }
        setCarregando(false);
      });

    return () => {
      cancelado = true;
    };
  }, []);

  return { produtos, carregando, erro };
}
