import { describe, expect, it } from 'vitest';
import { montarEmailHtml, type DadosEmail } from './template';

const dadosBase: DadosEmail = {
  escolaNome: 'Escola Exemplo',
  cidadeUf: 'Campinas/SP',
  responsavelNome: 'Maria',
  linkAprovacao: 'https://orcamento.pequenosfluentes.com.br/aprovar/abc-123',
  itens: [{ nome: 'Hello Baby!', quantidade: 10, precoUnitario: 99.9 }],
  totalLivros: 10,
  totalItens: 10,
  subtotal: 999,
  freteBruto: 18.03,
  freteFinal: 18.03,
  totalFinal: 1017.03,
  freteBeneficio: null,
  beneficios: [],
  prazoProducao: { diasUteis: 5, textoCustomizado: null },
  prazoTransporte: { dias: 6, servico: 'Jadlog .Com' },
};

describe('montarEmailHtml', () => {
  it('inclui nome da escola, cidade/UF, do responsável e os itens', () => {
    const html = montarEmailHtml(dadosBase);
    expect(html).toContain('Escola Exemplo');
    expect(html).toContain('Campinas/SP');
    expect(html).toContain('Maria');
    expect(html).toContain('Hello Baby!');
  });

  it('sem cidade/UF, não mostra o traço vazio', () => {
    const html = montarEmailHtml({ ...dadosBase, cidadeUf: null });
    expect(html).toContain('Solicitação de Escola Exemplo</p>');
  });

  it('mostra a quantidade só como número, sem "x"', () => {
    const html = montarEmailHtml(dadosBase);
    expect(html).toContain('>10<');
    expect(html).not.toContain('10x');
  });

  it('Total de itens é separado de Total de livros (não conta só Class Books/Tots)', () => {
    const html = montarEmailHtml({ ...dadosBase, totalLivros: 10, totalItens: 12 });
    expect(html).toContain('Total de livros:</td><td align="right" width="120">10</td>');
    expect(html).toContain('Total de itens:</td><td align="right" width="120">12</td>');
  });

  it('inclui a logo e o rodapé de contato', () => {
    const html = montarEmailHtml(dadosBase);
    expect(html).toContain('cropped-Logo-1-jpg.webp');
    expect(html).toContain('vendas@pequenosfluentes.com.br');
    expect(html).toContain('pequenosfluentes.com.br');
    expect(html).toContain('válido por 10 dias úteis');
    expect(html).toContain('Cartão de Crédito ou PIX');
  });

  it('mostra prazo de produção e transporte separadamente', () => {
    const html = montarEmailHtml(dadosBase);
    expect(html).toContain('Prazo de produção:</strong> 5 dias úteis');
    expect(html).toContain('Prazo de transporte:</strong> 6 dias úteis (Jadlog .Com)');
  });

  it('prazo de produção com texto customizado (151+) não mostra dias', () => {
    const html = montarEmailHtml({
      ...dadosBase,
      prazoProducao: { diasUteis: null, textoCustomizado: 'Consultar' },
    });
    expect(html).toContain('Prazo de produção:</strong> Consultar');
  });

  it('frete sem desconto: linha normal fora do bloco de benefícios, sem bloco algum', () => {
    const html = montarEmailHtml(dadosBase);
    expect(html).not.toContain('Benefícios desbloqueados');
    expect(html).toContain('Frete:</td>');
    expect(html).toContain('R$ 18,03');
  });

  it('frete com desconto: entra no bloco de benefícios, riscado, sem linha normal', () => {
    const html = montarEmailHtml({
      ...dadosBase,
      freteBruto: 18.03,
      freteFinal: 0,
      totalFinal: 999,
      freteBeneficio: { mensagem: 'Frete grátis!', valorEconomizado: 18.03 },
    });

    expect(html).toContain('Benefícios desbloqueados');
    expect(html).toContain('Frete grátis!');
    expect(html).toContain('text-decoration:line-through');
    expect(html).toContain('R$ 18,03'); // valor riscado
    expect(html).toContain('R$ 0,00'); // valor final em destaque
    expect(html).not.toContain('Frete:</td>'); // não aparece como linha normal
    expect(html).toContain('Total economizado: R$ 18,03');
  });

  it('brindes (não-frete) mantêm o texto de economia, sem nome interno da regra', () => {
    const html = montarEmailHtml({
      ...dadosBase,
      beneficios: [
        { mensagem: "Teacher's Guide de brinde!", itemGratis: { nome: "Teacher's Guide", quantidade: 1 }, valorEconomizado: 139.9 },
      ],
    });

    expect(html).toContain('Benefícios desbloqueados');
    expect(html).toContain("1x Teacher's Guide grátis (economia de R$ 139,90)");
    expect(html).not.toContain('pedido menor');
  });
  it('a tabela de itens mostra só o carrinho real, sem marcação de brinde', () => {
    const html = montarEmailHtml({
      ...dadosBase,
      beneficios: [
        { mensagem: "Teacher's Guide de brinde!", itemGratis: { nome: "Teacher's Guide", quantidade: 1 }, valorEconomizado: 139.9 },
      ],
    });

    expect(html).not.toContain('(brinde)');
  });


  it('frete com desconto + brinde: soma os dois no Total economizado', () => {
    const html = montarEmailHtml({
      ...dadosBase,
      freteBruto: 18.03,
      freteFinal: 0,
      freteBeneficio: { mensagem: 'Frete grátis!', valorEconomizado: 18.03 },
      beneficios: [
        { mensagem: "Teacher's Guide de brinde!", itemGratis: { nome: "Teacher's Guide", quantidade: 1 }, valorEconomizado: 139.9 },
      ],
    });

    expect(html).toContain('Total economizado: R$ 157,93');
  });

  it('inclui o botão de aprovação apontando pro link certo', () => {
    const html = montarEmailHtml(dadosBase);
    expect(html).toContain('href="https://orcamento.pequenosfluentes.com.br/aprovar/abc-123"');
    expect(html).toContain('Aprovar orçamento');
  });
});
