import { describe, expect, it } from 'vitest';
import { indicacaoDoOrcamento, orcamentosParecidos } from './indicacaoVinculo';

const indicacao = {
  id: 'i1',
  status: 'aceita' as const,
  escola_chave: 'pequeno principe|campinas',
  criado_em: '2026-11-20T12:00:00Z',
  valida_ate: '2026-12-20T12:00:00Z',
  indicador_nome: 'Maria',
};

describe('indicacaoDoOrcamento', () => {
  it('acha a indicação aceita da mesma escola dentro do prazo', () => {
    expect(indicacaoDoOrcamento({ escola_nome: 'Colégio Pequeno Príncipe', criado_em: '2026-12-01T10:00:00Z' }, [indicacao])).toBe(
      indicacao,
    );
  });

  it('ignora indicação ainda não aceita ou recusada', () => {
    const orc = { escola_nome: 'Pequeno Príncipe', criado_em: '2026-12-01T10:00:00Z' };
    expect(indicacaoDoOrcamento(orc, [{ ...indicacao, status: 'recebida' as const }])).toBeNull();
    expect(indicacaoDoOrcamento(orc, [{ ...indicacao, status: 'recusada_cliente' as const }])).toBeNull();
  });

  it('ignora orçamento anterior à indicação ou depois da validade', () => {
    expect(indicacaoDoOrcamento({ escola_nome: 'Pequeno Príncipe', criado_em: '2026-11-01T10:00:00Z' }, [indicacao])).toBeNull();
    expect(indicacaoDoOrcamento({ escola_nome: 'Pequeno Príncipe', criado_em: '2026-12-21T10:00:00Z' }, [indicacao])).toBeNull();
  });

  it('com duas indicações, vale a primeira registrada', () => {
    const segunda = { ...indicacao, id: 'i2', status: 'em_negociacao' as const, criado_em: '2026-11-21T12:00:00Z' };
    expect(indicacaoDoOrcamento({ escola_nome: 'Pequeno Príncipe', criado_em: '2026-12-01T10:00:00Z' }, [segunda, indicacao])?.id).toBe(
      'i1',
    );
  });
});

describe('orcamentosParecidos', () => {
  it('filtra por nome parecido', () => {
    const lista = [
      { escola_nome: 'Escola Pequeno Príncipe', criado_em: '' },
      { escola_nome: 'Arco-Íris', criado_em: '' },
    ];
    expect(orcamentosParecidos('Pequeno Principe Ltda', lista)).toEqual([lista[0]]);
  });
});
