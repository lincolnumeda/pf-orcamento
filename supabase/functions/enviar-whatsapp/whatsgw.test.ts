import { describe, expect, it } from 'vitest';
import { formatarNumero, montarPayloadWhatsGW } from './whatsgw';

describe('formatarNumero', () => {
  it('adiciona código do país quando ausente', () => {
    expect(formatarNumero('11999999999')).toBe('5511999999999');
  });

  it('não duplica o código do país quando já presente', () => {
    expect(formatarNumero('5511999999999')).toBe('5511999999999');
  });

  it('remove formatação (parênteses, traço, espaço)', () => {
    expect(formatarNumero('(11) 99999-9999')).toBe('5511999999999');
  });
});

describe('montarPayloadWhatsGW', () => {
  it('monta o payload no formato esperado pela API', () => {
    const payload = montarPayloadWhatsGW('chave-api', '11988887777', {
      numeroDestino: '11999999999',
      mensagem: 'Olá!',
    });
    expect(payload).toEqual({
      apikey: 'chave-api',
      phone_number: '5511988887777',
      contact_phone_number: '5511999999999',
      message_type: 'text',
      message_body: 'Olá!',
    });
  });
});
