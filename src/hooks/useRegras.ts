import { useCallback, useEffect, useState } from 'react';
import { orcamentoDb } from '../lib/supabase';
import type { Regra } from '../types';

export function useRegras() {
  const [regras, setRegras] = useState<Regra[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const buscar = useCallback(async () => {
    setCarregando(true);
    const { data, error } = await orcamentoDb.from('regras').select('*');
    if (error) {
      setErro(error.message);
    } else {
      setErro(null);
      setRegras(data ?? []);
    }
    setCarregando(false);
  }, []);

  useEffect(() => {
    buscar();
  }, [buscar]);

  return { regras, carregando, erro, refetch: buscar };
}
