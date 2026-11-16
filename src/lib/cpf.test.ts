import { describe, expect, it } from 'vitest';
import { cpfValido, formatarCpf, whatsappValido } from './cpf';

describe('cpfValido', () => {
  it('aceita CPF válido, com ou sem máscara', () => {
    expect(cpfValido('529.982.247-25')).toBe(true);
    expect(cpfValido('52998224725')).toBe(true);
    expect(cpfValido('111.444.777-35')).toBe(true);
  });

  it('aceita CPF com zeros à esquerda', () => {
    expect(cpfValido('000.000.001-91')).toBe(true);
  });

  it('rejeita dígito verificador errado', () => {
    expect(cpfValido('529.982.247-24')).toBe(false);
    expect(cpfValido('529.982.247-15')).toBe(false);
  });

  it('rejeita sequência repetida', () => {
    expect(cpfValido('000.000.000-00')).toBe(false);
    expect(cpfValido('111.111.111-11')).toBe(false);
  });

  it('rejeita tamanho errado', () => {
    expect(cpfValido('5299822472')).toBe(false);
    expect(cpfValido('529982247255')).toBe(false);
    expect(cpfValido('')).toBe(false);
  });
});

describe('formatarCpf', () => {
  it('aplica a máscara progressivamente', () => {
    expect(formatarCpf('529')).toBe('529');
    expect(formatarCpf('5299')).toBe('529.9');
    expect(formatarCpf('5299822')).toBe('529.982.2');
    expect(formatarCpf('52998224725')).toBe('529.982.247-25');
  });

  it('ignora o que passar de 11 dígitos', () => {
    expect(formatarCpf('529982247259999')).toBe('529.982.247-25');
  });
});

describe('whatsappValido', () => {
  it('aceita celular e fixo com DDD', () => {
    expect(whatsappValido('(11) 99999-9999')).toBe(true);
    expect(whatsappValido('(11) 3333-4444')).toBe(true);
  });

  it('rejeita sem DDD ou DDD começando com zero', () => {
    expect(whatsappValido('99999-9999')).toBe(false);
    expect(whatsappValido('(01) 99999-9999')).toBe(false);
  });
});
