// Mapa nome-do-produto (como cadastrado em orcamento.produtos, ver
// scripts/seed.ts) -> slug do arquivo em public/capas/. My Baby Book não
// tem variante -TG porque não tem Teacher's Guide (ver PROJETO-ORCAMENTO.md
// seção 2).
const SLUG_CAPA: Record<string, string> = {
  'My Baby Book': 'my-baby-book',
  'Hello Baby!': 'hello-baby',
  'Tiny People': 'tiny-people',
  'Little Explorers': 'little-explorers',
  'Tots 1': 'tots-1',
  'Tots 2': 'tots-2',
  'Tots 3': 'tots-3',
  'Tots 4': 'tots-4',
  'Tots 5': 'tots-5',
};

export function capaProduto(nomeProduto: string, comTeachersGuide = false): string | null {
  const slug = SLUG_CAPA[nomeProduto];
  if (!slug) return null;
  const temTG = comTeachersGuide && nomeProduto !== 'My Baby Book';
  return `/capas/${slug}${temTG ? '-TG' : ''}.jpg`;
}
