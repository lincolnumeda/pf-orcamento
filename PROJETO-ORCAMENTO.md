# Projeto: Central de Orçamentos — Pequenos Fluentes

## 1. Contexto e objetivo

Substituir o fluxo atual de orçamento por Google Forms por um sistema próprio, com:
- Página pública onde escolas preenchem um pedido de orçamento (Class Books + Teacher's Guide)
- Cálculo em tempo real de subtotal, frete (via Melhor Envio) e descontos/benefícios (via motor de regras parametrizável)
- Email automático bonito com o resumo, igual ao fluxo atual
- Central interna (Kanban) para Lincoln e Priscila acompanharem os orçamentos recebidos e fazerem follow-up
- Aprovação (pelo cliente ou pela equipe) gera automaticamente um pedido no WooCommerce com o link de pagamento (Mercado Pago, já configurado lá)

Mantém o fluxo comercial atual: email → conversa por WhatsApp → fechamento. O sistema só profissionaliza e automatiza os cálculos, hoje feitos manualmente.

## 2. Catálogo de produtos

**Class Books — Educação Infantil (carro-chefe):**
- My Baby Book (2 anos) — R$ 114,90 *(⚠️ NÃO tem Teacher's Guide separado — a plataforma própria do produto, com vídeos/e-books/ciclos temáticos, já cumpre essa função. Na tela de orçamento, este item não deve mostrar o checkbox "+ Teacher's Guide" que os demais têm.)*
- Hello Baby! (3 anos) — R$ 99,90
- Tiny People (4 anos) — R$ 99,90
- Little Explorers (5 anos) — R$ 99,90

**Coleção Tots — Fundamental 1:**
- Tots 1 a Tots 5 — R$ 99,90 cada

**Teacher's Guide** (opcional, por livro) — R$ 139,90 cada

**Assinatura Digital** (mencionada como possível brinde) — R$ 99,90/mês

Cada livro tem QR codes que levam a áudios, vídeos/músicas (YouTube) e flipbooks/e-books — isso é só contexto de produto, não afeta o sistema de orçamento.

## 3. Motor de regras (o coração do sistema)

Não são regras fixas no código — é um modelo **genérico e parametrizável**, editável numa tela de admin sem precisar programar.

### Estrutura de uma regra
- **Nome**
- **Ativa** (flag liga/desliga)
- **Tipo de gatilho**: `quantidade` (livros) / `valor_pedido` / `faixa_frete`
- **Modo do gatilho**: `a_partir_de` (fixo, uma vez) / `a_cada` (proporcional, ex: a cada 10 livros)
- **Valor do gatilho**
- **Faixa de frete** (min/max) — condição extra opcional, usada por exemplo pra "só isenta frete se o frete calculado for baixo"
- **Tipo de benefício**: `desconto_frete_pct` / `desconto_total_pct` / `item_gratis`
- **Valor do benefício** (percentual ou quantidade)
- **Item do benefício** (se for item grátis: "Teacher's Guide" ou "Assinatura Digital")
- **Grupo exclusivo** (regras do mesmo grupo competem — só uma aplica)
- **Prioridade** (menor número = maior prioridade, desempata dentro do grupo exclusivo)

### Regras de exemplo (estado inicial desejado)
1. **Frete grátis (pedido menor):** 10+ livros E frete calculado ≤ R$100 → 100% de desconto no frete. Grupo: `frete`.
2. **Frete 50% off (pedido distante):** 10+ livros E frete calculado > R$100 → 50% de desconto no frete. Grupo: `frete`.
3. **Teacher's Guide de brinde:** a cada 10 livros → 1 Teacher's Guide grátis. Grupo: `brinde-livro`.
4. **2 Assinaturas de brinde (pedido grande):** valor do pedido ≥ R$2.000 → 2 assinaturas grátis. Grupo: `beneficio-grande` (compete com desconto de frete — se disparar, não dá desconto de frete).

### Regra de contagem
O My Baby Book **conta normalmente** na soma total de livros usada pelos gatilhos de quantidade (ex: "10+ livros"), junto com Hello Baby!, Tiny People, Little Explorers e a coleção Tots. Não há tratamento especial de contagem — só a ausência do benefício "Teacher's Guide" pra esse item específico, já que ele não existe como produto separado.

### Comportamento esperado
- Cálculo **em tempo real** na tela do cliente, a cada mudança de quantidade/CEP
- Feedback visual quando um benefício é desbloqueado (efeito de gamificação)
- "Near-miss hints": avisar quando falta pouco pra desbloquear um benefício (ex: "faltam 2 livros para frete grátis")
- Snapshot das regras aplicadas fica **congelado** em cada orçamento salvo — mudar uma regra depois não deve alterar orçamentos já gerados

## 4. Banco de dados — Supabase (já criado)

Projeto Supabase compartilhado com o app "pf-corporativo" (mesmo projeto: `pequenos fluentes`, URL `https://vtwxjuuzbonvywnmcics.supabase.co`).

### Schema `orcamento` (isolado, criado via SQL Editor)

**`orcamento.produtos`**
`id (uuid)`, `nome`, `categoria` (infantil/tots/teachers_guide/assinatura), `preco`, `livro_relacionado`, `ativo`

**`orcamento.regras`**
`id`, `nome`, `ativa`, `tipo_gatilho`, `gatilho_modo`, `gatilho_valor`, `frete_min`, `frete_max`, `tipo_beneficio`, `beneficio_valor`, `item_beneficio`, `grupo_exclusivo`, `prioridade`, `criado_em`, `atualizado_em`

**`orcamento.orcamentos`**
`id`, `escola_nome`, `responsavel_nome`, `responsavel_email`, `responsavel_whatsapp`, `cep`, `itens (jsonb)`, `subtotal`, `frete_bruto`, `frete_final`, `total_final`, `regras_aplicadas (jsonb)`, `status` (recebido/em_conversa/aprovado/pago/perdido), `notas_internas`, `link_pagamento`, `criado_em`, `atualizado_em`

RLS ativado nas 3 tabelas:
- `produtos` e `regras`: leitura pública, escrita só autenticado
- `orcamentos`: criação pública (INSERT), leitura/edição só autenticado

**Importante:** o schema `orcamento` precisa estar na lista "Exposed schemas" em Project Settings → Data API do Supabase pra ficar acessível via API.

### Autenticação e permissões (REAPROVEITADAS do pf-corporativo — não criar nada novo)

O pf-corporativo já tem um sistema de multi-app com controle de acesso central, no schema `public`:
- `public.usuarios` (id, email, nome, ativo, admin, criado_em)
- `public.modulos` (id, slug, nome, descricao, icone, url, ordem)
- `public.permissoes` (id, usuario_id, modulo_id, criado_em) — tabela de ligação

Login via **Google OAuth** (mesmo Client ID/Secret do projeto Google Cloud `pf-assets`, usado pelo corporativo — foi adicionada a URL de callback do Supabase como redirect autorizado, e um novo Client Secret foi gerado e configurado em Supabase → Authentication → Providers → Google).

Já cadastrado:
- Módulo `orcamento` inserido em `public.modulos`
- Permissão liberada para `lincolnumeda@gmail.com` e `pzachumeda@gmail.com` em `public.permissoes`

**A tela de login/gestão de acesso do pf-corporativo deve ser reaproveitada ou replicada** — não construir uma tela de login nova do zero. Avaliar se dá pra compartilhar componente/lógica entre os dois projetos ou se replica o padrão.

## 5. Integrações externas

**Melhor Envio** (cotação de frete):
- Token de API pessoal gerado separadamente (não é o mesmo usado no plugin do WooCommerce, mas mesma conta)
- Chamado direto do backend/Edge Function — cotação em tempo real durante o preenchimento do orçamento
- Guardar como secret, nunca no código

**WooCommerce REST API** (criação de pedido + link de pagamento Mercado Pago):
- Consumer Key + Consumer Secret gerados em WooCommerce → Configurações → Avançado → API REST, permissão Leitura/Escrita
- Usado só no momento de aprovação do orçamento: cria o pedido no WooCommerce com os itens/desconto/frete calculados, e o Mercado Pago (já configurado no Woo) gera o link de checkout com parcelamento nativo
- Guardar como secret, nunca no código

## 6. Hospedagem e deploy

- **Front-end**: site estático (sem servidor Node rodando) — hospedagem compartilhada na Hostinger não tem SSH, só FTP e é sensível a carga
- Subdomínio `orcamento.pequenosfluentes.com.br` já criado na Hostinger (hospedagem tipo PHP/HTML), DNS gerenciado via Cloudflare (domínio raiz está no Hostgator)
- Deploy automático: GitHub Actions builda o projeto a cada push na branch principal e sobe os arquivos via FTP pra pasta do site na Hostinger
- Credenciais de FTP (host/usuário/senha) guardadas como secret no GitHub, nunca no código
- **Importante**: o domínio principal (pequenosfluentes.com.br) e o site principal em WordPress continuam no Hostgator — esse projeto novo é 100% desacoplado disso, só troca dados com o WooCommerce via API REST pontualmente (criação de pedido)

## 7. Fluxo completo (visão de ponta a ponta)

1. Escola acessa `orcamento.pequenosfluentes.com.br`, preenche escola/contato/CEP e escolhe livros/quantidades
2. A cada mudança, o sistema busca preço em `orcamento.produtos`, cota frete real via Melhor Envio, avalia `orcamento.regras` ativas e mostra o resultado em tempo real (com banners de benefício desbloqueado)
3. Ao enviar, grava um registro em `orcamento.orcamentos` com status `recebido`, com snapshot das regras aplicadas, e dispara o email automático
4. Cliente recebe o email; pode responder por WhatsApp (fluxo humano continua) ou clicar em "Aprovar orçamento" direto no email
5. Se Priscila/Lincoln quiserem ajustar manualmente (adicionar benefício negociado, mudar status, anotar follow-up), fazem isso na Central de Orçamentos (tela autenticada, kanban por status)
6. Aprovação (por qualquer um dos dois caminhos) → chamada à API do WooCommerce cria o pedido com os valores finais → link de pagamento Mercado Pago é salvo em `link_pagamento` e enviado ao cliente
7. Cliente paga via Mercado Pago (parcelamento nativo do gateway já configurado)

## 8. O que falta construir (escopo do Claude Code)

- [ ] Setup do projeto (stack recomendada: Vite + React ou vanilla JS/TS, buildando pra arquivos estáticos)
- [ ] Cliente Supabase configurado (URL + anon key em variável de ambiente)
- [ ] Tela pública de orçamento (formulário + cálculo em tempo real + integração Melhor Envio)
- [ ] Email automático (definir provedor — ex: Resend, ou reaproveitar o que já é usado hoje)
- [ ] Tela de login (reaproveitando padrão do pf-corporativo)
- [ ] Tela de administração de regras (CRUD completo, visual estilo "disjuntor" liga/desliga)
- [ ] Central de orçamentos / Kanban (lista, filtros, detalhe, notas internas, mudança de status, botão WhatsApp)
- [ ] Botão de aprovação (cliente e interno) → integração WooCommerce REST API → geração de link de pagamento
- [ ] GitHub Actions: build + deploy via FTP pra Hostinger
- [ ] Popular tabela `orcamento.produtos` com o catálogo completo (13 produtos + Teacher's Guides + Assinatura)
- [ ] Popular tabela `orcamento.regras` com as 4 regras iniciais descritas na seção 3

## 9. Protótipo de referência visual

Já existe um mockup HTML funcional (não conectado a dados reais) demonstrando a experiência esperada — tanto da tela de regras quanto da tela do cliente com cálculo ao vivo. Serve como referência de UX/visual, não como código de produção.
