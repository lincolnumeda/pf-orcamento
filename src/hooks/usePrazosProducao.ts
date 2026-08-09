import { useEffect, useState } from 'react';
import { orcamentoDb } from '../lib/supabase';
import type { PrazoProducao } from '../types';

export function usePrazosProducao() {
  const [prazos, setPrazos] = useState<PrazoProducao[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let cancelado = false;

    orcamentoDb
      .from('prazos_producao')
      .select('*')
      .order('qtd_min')
      .then(({ data }) => {
        if (cancelado) return;
        setPrazos(data ?? []);
        setCarregando(false);
      });

    return () => {
      cancelado = true;
    };
  }, []);

  return { prazos, carregando };
}
