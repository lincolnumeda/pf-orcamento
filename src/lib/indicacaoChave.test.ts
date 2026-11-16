import { describe, expect, it } from 'vitest';
import { gerarEscolaChave, nomeDaChave, nomesParecidos, normalizarTextoEscola } from './indicacaoChave';

describe('normalizarTextoEscola', () => {
  it('minúsculas e sem acento', () => {
    expect(normalizarTextoEscola('Pequeno Príncipe')).toBe('pequeno principe');
    expect(normalizarTextoEscola('SÃO JOÃO')).toBe('sao joao');
    expect(normalizarTextoEscola('Crianças Felizes')).toBe('criancas felizes');
  });

  it('tira escola, colégio e ltda (com ou sem acento, qualquer caixa)', () => {
    expect(normalizarTextoEscola('Escola Pequeno Príncipe')).toBe('pequeno principe');
    expect(normalizarTextoEscola('COLÉGIO Pequeno Príncipe LTDA')).toBe('pequeno principe');
    expect(normalizarTextoEscola('Colegio Escola Arco-Íris')).toBe('arco iris');
  });

  it('não corta palavras que só contêm "escola" no meio', () => {
    expect(normalizarTextoEscola('Escolinha Sol')).toBe('escolinha sol');
  });

  it('tira pontuação e junta espaços', () => {
    expect(normalizarTextoEscola('  E.M.E.I.  "Tia  Ana" - Ltda. ')).toBe('e m e i tia ana');
    expect(normalizarTextoEscola("Kids' Club & Cia")).toBe('kids club cia');
  });

  it('lida com vazio/nulo', () => {
    expect(normalizarTextoEscola('')).toBe('');
    expect(normalizarTextoEscola(null)).toBe('');
    expect(normalizarTextoEscola(undefined)).toBe('');
  });
});

describe('gerarEscolaChave', () => {
  it('junta nome e cidade normalizados com |', () => {
    expect(gerarEscolaChave('Colégio Pequeno Príncipe Ltda.', 'São Paulo')).toBe('pequeno principe|sao paulo');
  });

  it('variações do mesmo nome geram a mesma chave', () => {
    const a = gerarEscolaChave('Escola Pequeno Príncipe', 'Ribeirão Preto');
    const b = gerarEscolaChave('pequeno principe', 'RIBEIRAO PRETO');
    const c = gerarEscolaChave('Colégio Pequeno-Príncipe LTDA', 'Ribeirão  Preto ');
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('mesma escola em cidades diferentes gera chaves diferentes', () => {
    expect(gerarEscolaChave('Pequeno Príncipe', 'Campinas')).not.toBe(gerarEscolaChave('Pequeno Príncipe', 'Santos'));
  });

  it('nomeDaChave devolve só a parte do nome', () => {
    expect(nomeDaChave('pequeno principe|sao paulo')).toBe('pequeno principe');
  });
});

describe('nomesParecidos', () => {
  it('mesmo nome normalizado', () => {
    expect(nomesParecidos('Escola Pequeno Príncipe', 'Colégio Pequeno Principe Ltda')).toBe(true);
  });

  it('um nome contém o outro', () => {
    expect(nomesParecidos('Pequeno Príncipe', 'Centro Educacional Pequeno Príncipe')).toBe(true);
  });

  it('metade das palavras em comum', () => {
    expect(nomesParecidos('Instituto Sementinha Feliz', 'Sementinha Feliz Bilíngue')).toBe(true);
  });

  it('nomes diferentes não batem', () => {
    expect(nomesParecidos('Pequeno Príncipe', 'Arco-Íris')).toBe(false);
    expect(nomesParecidos('Escola Sol', 'Escola Lua')).toBe(false);
  });

  it('nome curto não casa por "contém"', () => {
    expect(nomesParecidos('Sol', 'Girassol Kids')).toBe(false);
  });
});
