import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { buscarUsuarioAutorizado, type UsuarioAutorizado } from '../lib/auth';

export type EstadoAuth =
  | { status: 'carregando' }
  | { status: 'deslogado' }
  | { status: 'nao_autorizado'; email: string }
  | { status: 'autorizado'; usuario: UsuarioAutorizado };

export function useAuth(): EstadoAuth {
  const [estado, setEstado] = useState<EstadoAuth>({ status: 'carregando' });

  useEffect(() => {
    let cancelado = false;

    async function avaliar(email: string | undefined) {
      if (!email) {
        if (!cancelado) setEstado({ status: 'deslogado' });
        return;
      }
      const usuario = await buscarUsuarioAutorizado(email);
      if (cancelado) return;
      setEstado(usuario ? { status: 'autorizado', usuario } : { status: 'nao_autorizado', email });
    }

    supabase.auth.getSession().then(({ data }) => avaliar(data.session?.user.email));

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      avaliar(session?.user.email);
    });

    return () => {
      cancelado = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  return estado;
}
