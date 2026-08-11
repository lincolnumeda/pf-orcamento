import { useState } from 'react';
import { useProdutos } from '../../hooks/useProdutos';
import { useOrcamentoCalculo } from '../../hooks/useOrcamentoCalculo';
import { ProdutoLinha } from '../../components/orcamento/ProdutoLinha';
import { ResumoOrcamento } from '../../components/orcamento/ResumoOrcamento';
import { DadosContato, type DadosContatoValor } from '../../components/orcamento/DadosContato';
import { orcamentoDb } from '../../lib/supabase';
import { enviarEmailOrcamento } from '../../lib/email';
import type { CategoriaProduto } from '../../types';

const CATEGORIAS_SELECIONAVEIS: CategoriaProduto[] = ['infantil', 'tots'];

export default function OrcamentoPage() {
  const { produtos, carregando, erro } = useProdutos();
  const {
    cep,
    setCep,
    selecoes,
    definirQuantidade,
    alternarTeachersGuide,
    itens,
    totalLivros,
    freteCarregando,
    freteErro,
    freteDias,
    freteServico,
    prazoProducao,
    cidadeUf,
    resultado,
  } = useOrcamentoCalculo(produtos);

  const [dadosContato, setDadosContato] = useState<DadosContatoValor>({
    escolaNome: '',
    responsavelNome: '',
    responsavelEmail: '',
    responsavelWhatsapp: '',
  });
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);

  const produtosSelecionaveis = produtos.filter((p) => CATEGORIAS_SELECIONAVEIS.includes(p.categoria));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (itens.length === 0) {
      setErroEnvio('Escolha ao menos um livro antes de enviar.');
      return;
    }

    setEnviando(true);
    setErroEnvio(null);

    // Gera o id no cliente: o anon não tem GRANT de SELECT em orcamentos (só
    // INSERT), então encadear .select() depois do insert falharia com
    // "permission denied" — sem isso não teríamos como saber o id criado.
    const orcamentoId = crypto.randomUUID();

    const { error } = await orcamentoDb.from('orcamentos').insert({
      id: orcamentoId,
      escola_nome: dadosContato.escolaNome,
      responsavel_nome: dadosContato.responsavelNome,
      responsavel_email: dadosContato.responsavelEmail,
      responsavel_whatsapp: dadosContato.responsavelWhatsapp,
      cep,
      itens,
      subtotal: resultado.subtotal,
      frete_bruto: resultado.freteBruto,
      frete_final: resultado.freteFinal,
      total_final: resultado.totalFinal,
      regras_aplicadas: resultado.regrasAplicadas,
      status: 'recebido',
    });

    if (error) {
      setEnviando(false);
      setErroEnvio(error.message);
      return;
    }

    try {
      await enviarEmailOrcamento({
        orcamento_id: orcamentoId,
        destinatario: dadosContato.responsavelEmail,
        escola_nome: dadosContato.escolaNome,
        cidade_uf: cidadeUf,
        responsavel_nome: dadosContato.responsavelNome,
        itens,
        total_livros: totalLivros,
        subtotal: resultado.subtotal,
        frete_bruto: resultado.freteBruto,
        frete_final: resultado.freteFinal,
        total_final: resultado.totalFinal,
        regras_aplicadas: resultado.regrasAplicadas,
        prazo_producao: prazoProducao,
        prazo_transporte: { dias: freteDias, servico: freteServico },
      });
    } catch {
      // O orçamento já foi salvo — a falha no email não deve travar a confirmação.
    }

    setEnviando(false);
    setEnviado(true);
  }

  if (carregando) return <main className="orcamento-page">Carregando catálogo...</main>;
  if (erro) return <main className="orcamento-page">Erro ao carregar catálogo: {erro}</main>;

  if (enviado) {
    return (
      <main className="orcamento-page orcamento-page--centralizada">
        <div className="card orcamento-enviado">
          <h1>Orçamento recebido!</h1>
          <p>Em breve você recebe um email com o resumo. Qualquer dúvida, fala com a gente no WhatsApp.</p>
        </div>
      </main>
    );
  }

  const produtosInfantil = produtosSelecionaveis.filter((p) => p.categoria === 'infantil');
  const produtosTots = produtosSelecionaveis.filter((p) => p.categoria === 'tots');

  return (
    <main className="orcamento-page">
      <div className="pagehead">
        <h1>
          Solicitar orçamento <span className="badge-live">cálculo em tempo real</span>
        </h1>
        <p>Escolha os livros e a quantidade — o valor e os benefícios são calculados na hora.</p>
      </div>

      <form onSubmit={handleSubmit} className="orcamento-form">
        <div className="client-grid">
          <div>
            <DadosContato
              valor={dadosContato}
              cep={cep}
              cidadeUf={cidadeUf}
              onChange={setDadosContato}
              onCepChange={setCep}
            />

            <div className="card">
              <h3>Class Books — Educação Infantil</h3>
              {produtosInfantil.map((produto) => (
                <ProdutoLinha
                  key={produto.id}
                  produto={produto}
                  quantidade={selecoes[produto.id]?.quantidade ?? 0}
                  teachersGuide={selecoes[produto.id]?.teachersGuide ?? false}
                  temTeachersGuide={produto.nome !== 'My Baby Book'}
                  onQuantidadeChange={(q) => definirQuantidade(produto.id, q)}
                  onTeachersGuideChange={(ativo) => alternarTeachersGuide(produto.id, ativo)}
                />
              ))}
            </div>

            <div className="card">
              <h3>Coleção Tots — Fundamental 1</h3>
              {produtosTots.map((produto) => (
                <ProdutoLinha
                  key={produto.id}
                  produto={produto}
                  quantidade={selecoes[produto.id]?.quantidade ?? 0}
                  teachersGuide={selecoes[produto.id]?.teachersGuide ?? false}
                  temTeachersGuide={produto.nome !== 'My Baby Book'}
                  onQuantidadeChange={(q) => definirQuantidade(produto.id, q)}
                  onTeachersGuideChange={(ativo) => alternarTeachersGuide(produto.id, ativo)}
                />
              ))}
            </div>

            <p className="orcamento-form__contagem">{totalLivros} livro(s) selecionado(s)</p>

            {erroEnvio && <p className="resumo__erro">{erroEnvio}</p>}

            <button type="submit" className="btn btn-primary orcamento-form__enviar" disabled={enviando}>
              {enviando ? 'Enviando...' : 'Enviar pedido de orçamento'}
            </button>
          </div>

          <ResumoOrcamento
            resultado={resultado}
            freteCarregando={freteCarregando}
            freteErro={freteErro}
            cepPreenchido={cep.replace(/\D/g, '').length === 8}
            freteDias={freteDias}
            freteServico={freteServico}
            prazoProducao={prazoProducao}
          />
        </div>
      </form>
    </main>
  );
}
