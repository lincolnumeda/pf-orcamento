import { describe, expect, it } from 'vitest';
import { descreverMudancaStatus } from './interacoes';

describe('descreverMudancaStatus', () => {
  it('descreve a transição com o nome de quem mudou', () => {
    expect(descreverMudancaStatus('Priscila', 'recebido', 'em_conversa')).toBe(
      'Priscila moveu de Recebido → Em conversa',
    );
  });

  it('funciona pra qualquer par de status', () => {
    expect(descreverMudancaStatus('Lincoln', 'em_conversa', 'aprovado')).toBe(
      'Lincoln moveu de Em conversa → Aprovado',
    );
    expect(descreverMudancaStatus('Lincoln', 'aprovado', 'perdido')).toBe('Lincoln moveu de Aprovado → Perdido');
  });
});
