import { describe, expect, it } from 'vitest';
import { calcularVolumes, type FaixaEmbalagem } from './embalagem';

const faixas: FaixaEmbalagem[] = [
  { qtd_min: 1, qtd_max: 5, altura_cm: 25, largura_cm: 35, comprimento_cm: 5, peso_embalagem_kg: 0 },
  { qtd_min: 6, qtd_max: 10, altura_cm: 25, largura_cm: 35, comprimento_cm: 9, peso_embalagem_kg: 0 },
  { qtd_min: 11, qtd_max: 16, altura_cm: 15, largura_cm: 25, comprimento_cm: 35, peso_embalagem_kg: 0 },
  { qtd_min: 17, qtd_max: 27, altura_cm: 25, largura_cm: 25, comprimento_cm: 35, peso_embalagem_kg: 0 },
  { qtd_min: 28, qtd_max: 55, altura_cm: 40, largura_cm: 40, comprimento_cm: 30, peso_embalagem_kg: 0 },
];

describe('calcularVolumes', () => {
  it('0 livros: nenhum volume', () => {
    expect(calcularVolumes(0, faixas)).toEqual([]);
  });

  it('escolhe a faixa certa por quantidade', () => {
    expect(calcularVolumes(3, faixas)).toEqual([{ height: 25, width: 35, length: 5, weight: 1.2 }]);
    expect(calcularVolumes(8, faixas)).toEqual([{ height: 25, width: 35, length: 9, weight: 3.2 }]);
  });

  it('55 livros: uma única caixa (limite exato, não divide)', () => {
    const volumes = calcularVolumes(55, faixas);
    expect(volumes).toHaveLength(1);
    expect(volumes[0]).toEqual({ height: 40, width: 40, length: 30, weight: 22 });
  });

  it('56 livros: divide em 2 caixas de 40x40x30 (55 + 1)', () => {
    const volumes = calcularVolumes(56, faixas);
    expect(volumes).toEqual([
      { height: 40, width: 40, length: 30, weight: 22 },
      { height: 40, width: 40, length: 30, weight: 0.4 },
    ]);
  });

  it('90 livros: divide em 2 caixas (55 + 35)', () => {
    const volumes = calcularVolumes(90, faixas);
    expect(volumes).toEqual([
      { height: 40, width: 40, length: 30, weight: 22 },
      { height: 40, width: 40, length: 30, weight: 14 },
    ]);
  });

  it('soma o peso da embalagem, quando configurado', () => {
    const comPesoEmbalagem = faixas.map((f) => (f.qtd_max === 5 ? { ...f, peso_embalagem_kg: 0.3 } : f));
    expect(calcularVolumes(2, comPesoEmbalagem)).toEqual([{ height: 25, width: 35, length: 5, weight: 1.1 }]);
  });
});
