import { useEffect } from 'react';
import '../../../styles/indique.css';

const FONTE_ID = 'fonte-baloo-indique';
const FONTE_URL = 'https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&display=swap';

export const LOGO_BRANCO = '/marca/logo-pf-branco.png';

// Carrega a Baloo 2 (títulos da referência) só nas páginas do programa — o
// resto do app usa só Nunito, que já vem do index.html — e ajusta o <title>.
export function useIndiqueVisual(titulo: string, descricao?: string) {
  useEffect(() => {
    if (!document.getElementById(FONTE_ID)) {
      const link = document.createElement('link');
      link.id = FONTE_ID;
      link.rel = 'stylesheet';
      link.href = FONTE_URL;
      document.head.appendChild(link);
    }

    const tituloAnterior = document.title;
    document.title = titulo;

    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const descricaoAnterior = meta?.content ?? null;
    if (descricao) {
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'description';
        document.head.appendChild(meta);
      }
      meta.content = descricao;
    }

    return () => {
      document.title = tituloAnterior;
      if (meta && descricaoAnterior !== null) meta.content = descricaoAnterior;
    };
  }, [titulo, descricao]);
}
