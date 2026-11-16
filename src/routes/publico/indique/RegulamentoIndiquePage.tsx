import { Link } from 'react-router-dom';
import { useIndiqueVisual, LOGO_BRANCO } from './useIndiqueVisual';
import { DATA_FIM_INDICACOES, VALIDADE_DIAS, formatarDataCurta } from '../../../lib/indicacaoConfig';

// Texto de docs/indique/regulamento.html. Prazo final e validade vêm de
// src/lib/indicacaoConfig.ts pra não divergirem da página e do banco.
export default function RegulamentoIndiquePage() {
  useIndiqueVisual('Regulamento · Indique uma escola | Pequenos Fluentes');
  const dataFim = formatarDataCurta(DATA_FIM_INDICACOES);

  return (
    <div className="ind">
      <header className="ind-reg__cabecalho">
        <img src={LOGO_BRANCO} alt="Pequenos Fluentes" />
        <Link to="/indique">← Voltar para a página de indicação</Link>
        <h1>Regulamento do programa “Indique uma escola”</h1>
        <p>Class Books · Pequenos Fluentes</p>
      </header>
      <main className="ind-reg__main">
        <div className="ind-reg__card">
          <h2>1. O programa</h2>
          <ol>
            <li>
              O programa “Indique uma escola” é promovido pela Pequenos Fluentes e premia quem indicar uma escola nova
              que feche pedido de Class Books.
            </li>
            <li>
              As indicações valem de 15/11/2026 a {dataFim}. Pedidos de escolas indicadas nesse período continuam
              valendo até o fim do prazo do item 4.2. A Pequenos Fluentes pode prorrogar o programa, com aviso nesta
              página.
            </li>
          </ol>

          <h2>2. Quem pode indicar</h2>
          <ol>
            <li>Qualquer pessoa maior de 18 anos, com CPF válido. Não precisa ser cliente da Pequenos Fluentes.</li>
            <li>Funcionários e prestadores de serviço da Pequenos Fluentes não participam.</li>
          </ol>

          <h2>3. Escola válida</h2>
          <ol>
            <li>
              A escola indicada precisa ser nova: nunca ter comprado produtos da Pequenos Fluentes, seja pelo site, seja
              em pedido por lote, e não ter pedido orçamento antes da indicação.
            </li>
            <li>
              Unidades diferentes de uma mesma rede são consideradas escolas diferentes, desde que a unidade indicada
              nunca tenha comprado.
            </li>
            <li>Em até 2 dias úteis, a Pequenos Fluentes confirma por WhatsApp se a indicação foi aceita.</li>
          </ol>

          <h2>4. Como a indicação é registrada</h2>
          <ol>
            <li>
              A indicação só vale se for feita pelo formulário oficial do programa, antes de a escola pedir orçamento à
              Pequenos Fluentes.
            </li>
            <li>
              A indicação vale por {VALIDADE_DIAS} dias a partir do registro. Se a escola fechar o pedido dentro desse
              prazo, quem indicou tem direito ao prêmio.
            </li>
            <li>
              Se mais de uma pessoa indicar a mesma escola, vale a primeira indicação registrada, pela data e hora do
              formulário.
            </li>
            <li>
              Quem indica declara ter autorização do responsável da escola para compartilhar o contato dele com a
              Pequenos Fluentes.
            </li>
          </ol>

          <h2>5. O prêmio</h2>
          <ol>
            <li>
              Quem indicou recebe 10% do valor dos Class Books do pedido, se a escola fechar pedido de mais de 10 Class
              Books (11 ou mais), somando todos os volumes do mesmo pedido. Teacher's Guides, assinaturas e outros
              produtos não contam para a quantidade nem para o prêmio.
            </li>
            <li>
              Os 10% são calculados sobre o valor líquido efetivamente pago pelos Class Books, já com os descontos e sem
              frete ou taxas.
            </li>
            <li>
              O prêmio é pago por PIX, em até 15 dias depois da confirmação do pagamento integral do pedido, para uma
              chave PIX em nome do CPF informado no formulário.
            </li>
            <li>
              Se o pedido for cancelado ou devolvido, não há prêmio. Se o prêmio já tiver sido pago, a Pequenos Fluentes
              pode descontá-lo de prêmios futuros.
            </li>
            <li>
              Não há limite de indicações. Cada escola nova gera um prêmio, uma única vez, referente ao primeiro pedido
              fechado dentro do prazo.
            </li>
          </ol>

          <h2>6. Dados pessoais</h2>
          <ol>
            <li>
              Os dados enviados no formulário são usados só para operar o programa: confirmar a indicação, falar com a
              escola, pagar o prêmio e cumprir obrigações legais. O tratamento segue a Lei Geral de Proteção de Dados
              (LGPD).
            </li>
            <li>Quem indica ou quem foi indicado pode pedir a exclusão dos seus dados pelo WhatsApp oficial da Pequenos Fluentes.</li>
          </ol>

          <h2>7. Disposições gerais</h2>
          <ol>
            <li>
              Indicações com dados falsos, feitas em nome de outra pessoa ou que tentem burlar estas regras são
              canceladas, sem direito a prêmio.
            </li>
            <li>
              A Pequenos Fluentes pode alterar ou encerrar o programa com aviso nesta página. As indicações já aceitas
              continuam valendo pelas regras em vigor na data do registro.
            </li>
            <li>
              Dúvidas e casos não previstos são resolvidos pela Pequenos Fluentes pelo WhatsApp oficial de atendimento.
            </li>
          </ol>
        </div>
        <p className="ind-reg__nota">Versão de 16/11/2026.</p>
      </main>
    </div>
  );
}
