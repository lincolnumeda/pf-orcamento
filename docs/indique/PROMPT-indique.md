# Programa "Indique uma escola" — integrar ao pf-orcamento

## Contexto
Estamos lançando um programa de indicação dos Class Books. Qualquer pessoa pode indicar uma escola **nova**, inclusive o próprio dono ou gestor da escola (é proposital: escolas pequenas, e nesse caso vira uma conversão com 10% de desconto), ou seja, que nunca comprou da Pequenos Fluentes. Se essa escola fechar um pedido com **mais de 10 Class Books (11 ou mais)**, quem indicou ganha **10% do valor líquido pago pelos Class Books** (sem Teacher's Guide, assinatura ou frete), por PIX. A escola indicada não ganha desconto. As indicações valem até **31/12/2026** (podemos prorrogar), e cada uma vale por **30 dias**. Quando duas pessoas indicam a mesma escola, vale a primeira registrada (data e hora).

Quero tudo dentro deste projeto: página pública, banco no Supabase (schema `orcamento`), aba na Central e WhatsApp pelo WhatsGW, reaproveitando o que já existe. **Não altere o fluxo atual de orçamento**, exceto pelo item 6.

As referências visuais e de texto estão em `docs/indique/index.html` (página) e `docs/indique/regulamento.html` (regulamento). Mantenha os textos, as regras e o visual (paleta roxa, logo branco, selo de 10%). Pode adaptar para componentes React e para os tokens do projeto onde fizer sentido.

## 1. Páginas públicas
- `/indique`: a página de referência, com o formulário convertido para React.
- `/indique/regulamento`: o regulamento.
- Validações: CPF (com dígito verificador), WhatsApp com DDD, os dois checkboxes obrigatórios, honeypot anti-spam e captura de `utm_source` em `origem`.
- Depois de 31/12/2026, a página mostra "Programa encerrado" no lugar do formulário. A data fica numa constante de configuração, porque podemos prorrogar.
- Ajuste o deploy e as rotas para que `/indique` funcione em acesso direto (SPA na Hostinger).

## 2. Tabela `orcamento.indicacoes`
Crie o SQL em `scripts/sql/criar-indicacoes.sql`, seguindo o padrão dos outros scripts.
- Escola: `escola_nome`, `escola_cidade`, `escola_uf`, `escola_responsavel`, `escola_cargo`, `escola_whatsapp`, `escola_email`.
- Indicador: `indicador_nome`, `indicador_whatsapp`, `indicador_email`, `indicador_cpf`, `indicador_relacao`, `origem`.
- Controle: `escola_chave` (nome + cidade normalizados: minúsculas, sem acento, sem "escola/colégio/ltda" e sem pontuação), `possivel_duplicada` (bool), `status`, `valida_ate` (criado_em + 30 dias; os 30 dias também ficam numa constante), `orcamento_id` (FK opcional para `orcamento.orcamentos`), `qtd_livros`, `valor_livros`, `comissao`, `pago_em`, `notas_internas`, `criado_em`, `atualizado_em`.
- Colunas de envio de WhatsApp (ex.: `whatsapp_recebida_enviado_em`), para nunca mandar a mesma mensagem duas vezes.
- Status: `recebida` → `aceita` | `recusada_cliente` | `recusada_duplicada` → `em_negociacao` → `fechou` | `nao_fechou` → `paga`.
- RLS igual a `orcamentos`: INSERT público, leitura e edição só para autenticados.
- Ao inserir, preencha `escola_chave` e marque `possivel_duplicada` se já existir outra indicação com a mesma chave (trigger).

## 3. WhatsApp (WhatsGW)
Reaproveite `whatsgw.ts` e o relay PHP. Pode ser uma Edge Function nova (`enviar-whatsapp-indicacao`) ou generalizar a atual, como achar mais limpo, sem quebrar o que existe.
- **Automático, ao receber:** mesmo padrão do pg_cron de `agendar-whatsapp-automatico.sql`, uns 2 minutos depois do insert.
- **Manual, pela Central:** um botão por mensagem, com prévia editável antes de enviar.
- Toda mensagem enviada fica registrada no histórico da indicação.

Mensagens (variáveis entre chaves):
- **recebida (automática):** "Oi, {indicador}! Recebemos sua indicação da {escola} 💜 Em até 2 dias úteis a gente confere se ela é uma escola nova e te avisa por aqui."
- **aceita:** "Oi, {indicador}! Sua indicação da {escola} foi aceita ✅ Nossa equipe já vai entrar em contato com a escola. Se ela fechar um pedido de mais de 10 livros em até 30 dias, os seus 10% são garantidos. A gente te avisa!"
- **já é cliente:** "Oi, {indicador}! Obrigada pela indicação da {escola}. Ela já é cliente da Pequenos Fluentes, então não entra no programa 😕 Conhece outra escola? É só indicar de novo: {link}"
- **já indicada:** "Oi, {indicador}! Obrigada pela indicação da {escola}. Outra pessoa indicou essa escola antes, então vale a primeira indicação 😕 Conhece outra escola? É só indicar de novo: {link}"
- **fechou:** "{indicador}, boa notícia! A {escola} fechou o pedido 🎉 Assim que o pagamento for confirmado, sua comissão de R$ {comissao} vai por PIX para o CPF cadastrado."
- **paga:** "Pronto, {indicador}! Sua comissão de R$ {comissao} foi paga por PIX. Obrigada por indicar a Pequenos Fluentes 💜"

Deixe os textos fáceis de editar (constantes num arquivo só).

## 4. Aba "Indicações" na Central
- Lista com filtro por status, busca por escola ou indicador, e destaque visual para `possivel_duplicada` e para indicações com mais de 2 dias úteis ainda em `recebida`.
- Em cada indicação, ajude a conferir se a escola é cliente: mostre orçamentos existentes com nome parecido (pela mesma normalização). A conferência no WooCommerce e na planilha de lotes continua manual.
- Botões de ação: **Aceitar**, **Já é cliente** e **Já indicada**. Cada um muda o status e abre a prévia da mensagem correspondente.
- **Marcar como fechou:** vincula o orçamento (`orcamento_id`). O sistema calcula `qtd_livros` e `valor_livros` a partir dos itens congelados do orçamento, contando **só Class Books** (sem Teacher's Guide, assinatura ou frete) e já com descontos. Também calcula `comissao` = 10%. Avisa se a quantidade for 10 ou menos, ou se o fechamento passou do `valida_ate`. Os valores ficam editáveis.
- **Marcar como paga:** registra a data do pagamento.
- Totais no topo: indicações recebidas, aceitas, fechadas, comissões a pagar e já pagas.

## 5. Preços
Os preços dos livros vão subir depois de 30/11. A comissão tem que sair sempre do valor **efetivamente pago naquele pedido** (snapshot do orçamento), nunca do preço atual da tabela `produtos`. Não fixe nenhum preço no código do programa.

## 6. Ligação com o orçamento
Quando chegar um orçamento novo cuja escola bate (mesma `escola_chave`) com uma indicação `aceita` e ainda dentro do prazo, mostre na Central um selo "Indicada por {indicador}" nesse orçamento e um atalho para a indicação. É só visual, sem mudar o fluxo do orçamento.

## 7. Entregáveis
- Os scripts SQL, para eu rodar no SQL Editor, com instruções no topo como nos outros.
- Testes no padrão do projeto (vitest) para: normalização da chave, cálculo de quantidade e comissão a partir dos itens, montagem das mensagens e validação de CPF.
- Atualize o `PROJETO-ORCAMENTO.md` com uma seção do programa de indicação.
- No fim, me diga o passo a passo para colocar no ar: SQL, deploy da function, secrets, se mudou algo, e teste.
