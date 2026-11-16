import { describe, expect, it } from 'vitest';
import {
  COLUNA_ENVIO_INDICACAO,
  MENSAGENS_INDICACAO,
  TIPOS_MENSAGEM_INDICACAO,
  ehTipoMensagemIndicacao,
  formatarValorBR,
  montarMensagemIndicacao,
  primeiroNome,
} from './mensagensIndicacao.ts';

const vars = { indicadorNome: 'Maria Clara Souza', escolaNome: 'Escola Pequeno Príncipe ' };

describe('montarMensagemIndicacao', () => {
  it('recebida: primeiro nome do indicador e nome da escola', () => {
    expect(montarMensagemIndicacao('recebida', vars)).toBe(
      'Oi, Maria! Recebemos sua indicação da Escola Pequeno Príncipe 💜 Em até 2 dias úteis a gente confere se ela é uma escola nova e te avisa por aqui.',
    );
  });

  it('recusas levam o link pra indicar de novo', () => {
    expect(montarMensagemIndicacao('recusada_cliente', vars)).toContain(
      'É só indicar de novo: https://orcamento.pequenosfluentes.com.br/indique',
    );
    expect(montarMensagemIndicacao('recusada_duplicada', { ...vars, link: 'https://x.test/indique' })).toContain(
      'É só indicar de novo: https://x.test/indique',
    );
  });

  it('fechou e paga formatam a comissão em reais', () => {
    expect(montarMensagemIndicacao('fechou', { ...vars, comissao: 1234.5 })).toBe(
      'Maria, boa notícia! A Escola Pequeno Príncipe fechou o pedido 🎉 Assim que o pagamento for confirmado, sua comissão de R$ 1.234,50 vai por PIX para o CPF cadastrado.',
    );
    expect(montarMensagemIndicacao('paga', { ...vars, comissao: 119.88 })).toBe(
      'Pronto, Maria! Sua comissão de R$ 119,88 foi paga por PIX. Obrigada por indicar a Pequenos Fluentes 💜',
    );
  });

  it('sem comissão definida, deixa o marcador visível pra equipe preencher', () => {
    expect(montarMensagemIndicacao('fechou', vars)).toContain('R$ {comissao}');
  });

  it('nenhum texto fica com variável sem substituir quando tudo é informado', () => {
    for (const tipo of TIPOS_MENSAGEM_INDICACAO) {
      expect(montarMensagemIndicacao(tipo, { ...vars, comissao: 10 })).not.toMatch(/\{\w+\}/);
    }
  });
});

describe('apoio', () => {
  it('cada mensagem tem coluna de controle de envio', () => {
    expect(Object.keys(COLUNA_ENVIO_INDICACAO).sort()).toEqual(Object.keys(MENSAGENS_INDICACAO).sort());
  });

  it('ehTipoMensagemIndicacao', () => {
    expect(ehTipoMensagemIndicacao('aceita')).toBe(true);
    expect(ehTipoMensagemIndicacao('qualquer')).toBe(false);
    expect(ehTipoMensagemIndicacao(undefined)).toBe(false);
  });

  it('primeiroNome', () => {
    expect(primeiroNome('  Ana   Paula ')).toBe('Ana');
    expect(primeiroNome('João')).toBe('João');
  });

  it('formatarValorBR', () => {
    expect(formatarValorBR(0)).toBe('0,00');
    expect(formatarValorBR(99.9)).toBe('99,90');
    expect(formatarValorBR(1234567.891)).toBe('1.234.567,89');
  });
});
