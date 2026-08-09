import { useCallback, useEffect, useState } from 'react';
import { listarOrcamentos } from '../lib/orcamentos';
import type { Orcamento } from '../types';

export function useOrcamentos() {
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const buscar = useCallback(async () => {
    setCarregando(true);
    try {
      const dados = await listarOrcamentos();
      setOrcamentos(dados);
      setErro(null);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao carregar orçamentos');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    buscar();
  }, [buscar]);

  return { orcamentos, carregando, erro, refetch: buscar, setOrcamentos };
}
