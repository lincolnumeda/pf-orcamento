// Lógica pura de montagem do HTML — sem Deno/SMTP, pra dar pra testar com
// qualquer runtime. Estrutura/tom seguem o modelo de referência que a
// Pequenos Fluentes já usava (fluxo antigo via Make), com dados reais do
// motor de regras no lugar dos placeholders fixos.
//
// Sem emojis de propósito: a lib de SMTP (denomailer) tem um bug conhecido no
// encoder quoted-printable que pode corromper caracteres de 4 bytes (emoji)
// quando caem perto do limite de quebra de linha, produzindo lixo tipo "=20"
// no corpo do email. O envio (index.ts) já contorna isso mandando o corpo em
// base64, mas evitar linhas problemáticas aqui é defesa extra.

const LOGO_URL = 'https://pequenosfluentes.com.br/wp-content/uploads/2023/11/cropped-Logo-1-jpg.webp';
const COR_PRINCIPAL = '#004AAD';
const SITE_URL = 'https://pequenosfluentes.com.br';
const EMAIL_CONTATO = 'vendas@pequenosfluentes.com.br';
const WHATSAPP_TEXTO = '11 97867-4844';
const WHATSAPP_LINK =
  'https://api.whatsapp.com/send?phone=+5511978674844&text=Ol%C3%A1,%20gostaria%20de%20falar%20sobre%20o%20or%C3%A7amento';
const VALIDADE_DIAS_UTEIS = 10;

export interface ItemEmail {
  nome: string;
  quantidade: number;
  precoUnitario: number;
  destaque?: boolean;
}

export interface BeneficioEmail {
  mensagem: string;
  itemGratis: { nome: string; quantidade: number } | null;
  valorEconomizado: number;
}

export interface FreteBeneficioEmail {
  mensagem: string;
  valorEconomizado: number;
}

export interface PrazoProducaoEmail {
  diasUteis: number | null;
  textoCustomizado: string | null;
}

export interface PrazoTransporteEmail {
  dias: number | null;
  servico: string | null;
}

export interface DadosEmail {
  escolaNome: string;
  cidadeUf: string | null;
  responsavelNome: string;
  linkAprovacao: string;
  itens: ItemEmail[];
  totalLivros: number;
  totalItens: number;
  subtotal: number;
  freteBruto: number;
  freteFinal: number;
  totalFinal: number;
  // null = frete sem desconto (vira linha normal fora do bloco de benefícios).
  freteBeneficio: FreteBeneficioEmail | null;
  beneficios: BeneficioEmail[];
  prazoProducao: PrazoProducaoEmail | null;
  prazoTransporte: PrazoTransporteEmail | null;
}

function formatarReais(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function linhaItem(item: ItemEmail): string {
  const totalItem = item.quantidade * item.precoUnitario;
  const fundo = item.destaque ? 'background-color:#F2F7FB;' : '';
  const peso = item.destaque ? 'font-weight:600;' : '';
  return `
    <tr style="${fundo}">
      <td style="padding:10px 8px;border-bottom:1px solid #eee;color:#111827;${peso}">${item.nome}</td>
      <td align="center" style="padding:10px 8px;border-bottom:1px solid #eee;color:#374151;">${item.quantidade}</td>
      <td align="right" style="padding:10px 8px;border-bottom:1px solid #eee;color:#374151;">${formatarReais(item.precoUnitario)}</td>
      <td align="right" style="padding:10px 8px;border-bottom:1px solid #eee;color:#111827;">${formatarReais(totalItem)}</td>
    </tr>`;
}

function detalheBeneficio(b: BeneficioEmail): string {
  if (b.itemGratis) {
    return `${b.itemGratis.quantidade}x ${b.itemGratis.nome} grátis (economia de ${formatarReais(b.valorEconomizado)})`;
  }
  return `economia de ${formatarReais(b.valorEconomizado)}`;
}

function linhaBeneficio(b: BeneficioEmail): string {
  return `<li style="margin-bottom:6px;"><strong>${b.mensagem}</strong> — ${detalheBeneficio(b)}</li>`;
}

// Frete com desconto entra no bloco de benefícios com o preço original
// riscado e o valor final em destaque, em vez do texto "economia de X"
// usado pelos outros benefícios.
function linhaFreteBeneficio(frete: FreteBeneficioEmail, freteBruto: number, freteFinal: number): string {
  return (
    `<li style="margin-bottom:6px;"><strong>${frete.mensagem}</strong> — ` +
    `<span style="text-decoration:line-through;color:#6b7280;">${formatarReais(freteBruto)}</span> ` +
    `<strong>${formatarReais(freteFinal)}</strong></li>`
  );
}

function linhaPrazoProducao(prazo: PrazoProducaoEmail): string {
  const texto = prazo.textoCustomizado ?? `${prazo.diasUteis} dias úteis`;
  return `<p style="margin:4px 0;"><strong>Prazo de produção:</strong> ${texto}</p>`;
}

function linhaPrazoTransporte(prazo: PrazoTransporteEmail): string {
  if (prazo.dias === null) return '';
  const servico = prazo.servico ? ` (${prazo.servico})` : '';
  return `<p style="margin:4px 0;"><strong>Prazo de transporte:</strong> ${prazo.dias} dias úteis${servico}</p>`;
}

export function montarEmailHtml(dados: DadosEmail): string {
  const itensHtml = dados.itens.map(linhaItem).join('');
  const localizacao = dados.cidadeUf ? ` — ${dados.cidadeUf}` : '';

  const totalEconomizado =
    dados.beneficios.reduce((soma, b) => soma + b.valorEconomizado, 0) + (dados.freteBeneficio?.valorEconomizado ?? 0);

  const temBeneficios = dados.beneficios.length > 0 || dados.freteBeneficio !== null;

  const beneficiosHtml = temBeneficios
    ? `<div style="background:#ecfdf5;border:1px solid #6ee7b7;border-radius:8px;padding:16px;margin:20px 0;">` +
      `<p style="margin:0 0 8px;font-weight:600;color:#065f46;">Benefícios desbloqueados</p>` +
      `<ul style="margin:0 0 8px;padding-left:20px;color:#065f46;">` +
      (dados.freteBeneficio ? linhaFreteBeneficio(dados.freteBeneficio, dados.freteBruto, dados.freteFinal) : '') +
      dados.beneficios.map(linhaBeneficio).join('') +
      `</ul>` +
      `<p style="margin:0;font-weight:700;color:#065f46;">Total economizado: ${formatarReais(totalEconomizado)}</p>` +
      `</div>`
    : '';

  const freteNormalHtml = dados.freteBeneficio
    ? ''
    : `<tr>
              <td align="right" style="color:#666;padding:4px 0;">Frete:</td>
              <td align="right" width="140" style="padding:4px 0;">${formatarReais(dados.freteFinal)}</td>
            </tr>`;

  const prazosHtml =
    (dados.prazoProducao ? linhaPrazoProducao(dados.prazoProducao) : '') +
    (dados.prazoTransporte ? linhaPrazoTransporte(dados.prazoTransporte) : '');

  return `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:0;background:#f9fafb;font-family:'Helvetica Neue',Arial,sans-serif;color:#333;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:30px auto;background:#ffffff;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,0.05);">
      <tr>
        <td style="padding:30px;">
          <div style="text-align:center;">
            <img src="${LOGO_URL}" alt="Pequenos Fluentes" width="160" style="margin-bottom:20px;">
            <h2 style="color:${COR_PRINCIPAL};margin-bottom:5px;">Orçamento Class Books</h2>
            <p style="color:#666;margin-top:0;">Solicitação de ${dados.escolaNome}${localizacao}</p>
          </div>

          <p>Olá <strong>${dados.responsavelNome}</strong>,</p>
          <p>Segue abaixo o orçamento solicitado com base nas informações enviadas:</p>

          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-top:15px;">
            <thead style="background-color:#E6F0FA;">
              <tr>
                <th align="left" style="padding:8px;border-bottom:2px solid ${COR_PRINCIPAL};font-size:13px;">Item</th>
                <th align="center" style="padding:8px;border-bottom:2px solid ${COR_PRINCIPAL};font-size:13px;">Qtd</th>
                <th align="right" style="padding:8px;border-bottom:2px solid ${COR_PRINCIPAL};font-size:13px;">Unitário</th>
                <th align="right" style="padding:8px;border-bottom:2px solid ${COR_PRINCIPAL};font-size:13px;">Total</th>
              </tr>
            </thead>
            <tbody>${itensHtml}</tbody>
          </table>

          <table role="presentation" width="100%" style="margin-top:8px;">
            <tr><td align="right" style="color:#666;">Total de livros:</td><td align="right" width="120">${dados.totalLivros}</td></tr>
            <tr><td align="right" style="color:#666;">Total de itens:</td><td align="right" width="120">${dados.totalItens}</td></tr>
          </table>

          <table role="presentation" width="100%" style="margin-top:15px;">
            <tr>
              <td align="right" style="color:#666;padding:4px 0;">Subtotal:</td>
              <td align="right" width="140" style="padding:4px 0;">${formatarReais(dados.subtotal)}</td>
            </tr>
          </table>
          ${beneficiosHtml}
          <table role="presentation" width="100%" style="margin-top:8px;">
            ${freteNormalHtml}
            <tr>
              <td align="right" style="padding:10px 0;border-top:2px solid ${COR_PRINCIPAL};font-weight:700;">Total geral:</td>
              <td align="right" width="140" style="padding:10px 0;border-top:2px solid ${COR_PRINCIPAL};font-weight:700;">${formatarReais(dados.totalFinal)}</td>
            </tr>
          </table>

          <div style="margin-top:20px;">${prazosHtml}</div>

          <div style="text-align:center;margin:28px 0;">
            <a href="${dados.linkAprovacao}" style="display:inline-block;padding:14px 32px;background:${COR_PRINCIPAL};color:#ffffff;text-decoration:none;border-radius:6px;font-weight:700;">Aprovar orçamento</a>
          </div>

          <hr style="margin:30px 0;border:none;border-top:1px solid #eee;">
          <p style="font-size:13px;color:#888;text-align:center;">
            Este orçamento é válido por ${VALIDADE_DIAS_UTEIS} dias úteis.<br>
            Pagamento via Cartão de Crédito ou PIX
          </p>
          <p style="text-align:center;color:#666;font-size:13px;">
            <strong>Pequenos Fluentes</strong><br>
            <a href="${SITE_URL}" style="color:${COR_PRINCIPAL};text-decoration:none;">pequenosfluentes.com.br</a>
            | ${EMAIL_CONTATO} |
            <a href="${WHATSAPP_LINK}" style="color:${COR_PRINCIPAL};text-decoration:none;">${WHATSAPP_TEXTO}</a>
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
