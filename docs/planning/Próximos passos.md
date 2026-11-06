# EFAHub — resumo e próximos passos

## Prévia no celular

[Abrir o EFAHub no GitHub Pages](https://alexsandrogobbi.github.io/EFAHub_v1/)

O endereço fica disponível após habilitar GitHub Pages e concluir o workflow de publicação. A demonstração publicada é pública e usa dados fictícios; não use dados reais. Veja as instruções em [deployment.md](../deployment.md).

## O que já foi feito

- Criada uma demonstração web do EFAHub em HTML, CSS e JavaScript, sem dependências, com logo vetorial própria.
- Aplicado um redesenho premium, com interface escura, detalhes em cobre, navegação adaptável e layout responsivo.
- Disponibilizados temas claro e escuro, com alternância no cabeçalho, opção em Configurações e preferência salva no navegador.
- Criado um dashboard com 12 KPIs, filtros por período, gráficos, indicadores operacionais e exportação CSV. Métricas sem dados disponíveis são identificadas como indisponíveis.
- Implementada a agenda diária, com cadastro, conclusão e cancelamento de agendamentos, incluindo verificações de horário e conflitos.
- Adicionado o cadastro de serviços com descrição, preço, duração, ativação e vínculo opcional com profissionais.
- Criado o módulo **Equipe**, com cadastro/edição de profissionais, foto, contato, cargo, data de entrada, status e histórico de atendimentos.
- Adicionadas comissões individuais, calculadas ao concluir um atendimento, com fechamento por período, pagamentos com data/observação e exportação CSV ou impressão em PDF.
- Implementada a disponibilidade em intervalos de 15 minutos, considerando serviço, horário da barbearia, jornada individual, intervalos, folgas, bloqueios e reservas; a validação é local, tanto ao listar quanto ao salvar.
- Criado o dashboard da equipe com filtros por período, ranking ordenável, faturamento, atendimentos, ticket médio, comissão e ocupação.
- Criadas configurações para marca, logo, perfil profissional, contato, endereço e horários de funcionamento.
- Adicionados produtos, controles locais de estoque, vendas manuais e exportação CSV, sem integração de pagamento.
- Criadas lista de espera, prévia do perfil público e solicitações locais de suporte, sem publicação ou envio externo.
- Incluída a criação de séries recorrentes semanais, quinzenais ou mensais com validação de disponibilidade para cada ocorrência.
- Adicionadas uma visão do histórico de clientes, um registro local de atividade e uma busca de comandos.
- Criado o EFA AI como assistente demonstrativo que responde a algumas perguntas com regras e dados locais.
- Incluída uma ação que prepara uma mensagem de WhatsApp para revisão e envio manual.

## Produto e arquitetura alvo

O EFAHub deve evoluir de uma demonstração web para uma plataforma de gestão e crescimento de negócios de beleza, composta por:

- App mobile para clientes: descoberta, favoritos, agendamento, reagendamento, cancelamento, histórico, avaliações, fidelidade, cupons e notificações.
- App mobile para profissionais: visão “Meu dia”, agenda, chegada e andamento dos atendimentos, vendas, observações, metas, comissões e desempenho.
- Web administrativa: visão executiva, CRM, agenda, serviços, equipe, comissões, fechamento e relatórios.
- Backend compartilhado com PostgreSQL centralizado e APIs unificadas. App e Web consomem os mesmos contratos; regras de negócio de produção são implementadas uma única vez no backend.
- EFA AI e automações: análises fundamentadas em dados autorizados e fluxos com estados, consentimento e histórico auditável.
- Operação segura: autenticação, permissões por negócio e papel, logs, analytics, auditoria, backups e tratamento de falhas.

### Stack prevista

- **Mobile:** Flutter para iOS e Android, com experiências e permissões distintas para clientes e profissionais.
- **Web administrativa:** React, TypeScript, Tailwind CSS e shadcn/ui.
- **Backend e dados:** Supabase e PostgreSQL, com políticas de acesso por negócio e APIs compartilhadas.
- **Autenticação:** e-mail/senha, Google e Apple.
- **Push:** Firebase Cloud Messaging, condicionado a consentimento e preferências.
- **Analytics, logs e auditoria:** instrumentação explícita e minimizada; dados pessoais não devem ser enviados sem base e finalidade definidas.

Esta é uma direção arquitetural, não uma descrição de integrações existentes. A aplicação principal atual é um protótipo Next.js; a antiga demonstração HTML/CSS/JavaScript foi arquivada em `legacy/`. Ainda não há dependências mobile, APIs conectadas, autenticação ou sincronização. Os fluxos precisam ser migrados e validados no servidor antes de uso real.

Produtos, estoque, vendas, lista de espera, página pública e suporte também são protótipos locais. Ainda não existem checkout ou cobrança de sinal, estorno financeiro, cupons, pacotes, anamneses, mensagens automáticas, agendamento online publicado ou conexão com equipe de suporte.

## Roteiro recomendado de evolução

### 1. Definir o domínio e os limites de acesso

- Modelar negócios, usuários, papéis, clientes, profissionais, serviços, jornadas, agendamentos e registros financeiros.
- Definir como cada negócio isola seus dados e quem pode executar cada ação.
- Especificar contratos de API e estados para agendamento, atendimento, comissão, pagamento e cancelamento.
- Documentar privacidade, retenção, consentimento e requisitos de auditoria.

### 2. Construir a base compartilhada

- Criar o projeto Supabase e o esquema PostgreSQL com migrações versionadas.
- Implementar autenticação e políticas de acesso por negócio e papel; testar tentativas de acesso cruzado.
- Mover disponibilidade, conflitos, transições de atendimento e cálculo de comissão para regras executadas no backend.
- Expor contratos usados igualmente pelo app mobile e pela web administrativa.
- Planejar migração de dados locais apenas como importação assistida; o armazenamento do navegador não deve ser tratado como fonte confiável.

### 3. Evoluir a web administrativa

- Migrar a interface atual para React, TypeScript, Tailwind CSS e shadcn/ui mantendo a identidade visual e os fluxos validados.
- Completar dashboard executivo com comparativos de períodos apenas quando existirem dados confiáveis.
- Construir CRM, gestão de equipe, metas, comissões, fechamento e relatórios com permissões no servidor.
- Registrar receita e pagamentos separadamente: serviço concluído não é confirmação de recebimento.

### 4. Lançar as experiências mobile

- Criar os apps Flutter para iOS e Android consumindo as mesmas APIs da web.
- Implementar a jornada do cliente e a área profissional, incluindo “Meu dia”, histórico e desempenho.
- Garantir que a disponibilidade exibida seja calculada pelo backend e que conflitos simultâneos sejam recusados de forma consistente.
- Validar acessibilidade, desempenho, estados offline, atualização e publicação em cada loja.

### 5. Ativar comunicações e automações

- Integrar FCM com opt-in, preferências e possibilidade de descadastro.
- Implementar fluxos configuráveis de confirmação, lembrete e avaliação com logs, retentativas e prevenção de duplicidade.
- Informar claramente quando uma comunicação foi agendada, enviada ou falhou.

### 6. Lançar IA e observabilidade

- Permitir que a EFA AI consulte métricas agregadas e autorizadas do backend, apresentando período, origem e limites dos dados usados.
- Não inferir respostas quando os dados necessários estiverem ausentes; não expor dados pessoais sem permissão.
- Instrumentar analytics, logs e trilha de auditoria sem registrar segredos ou informações pessoais desnecessárias.
- Monitorar erros e desempenho e definir alertas, backups e recuperação antes da expansão.

### 7. Validar e expandir

- Cobrir APIs, permissões, conflitos de agenda, cálculos financeiros, automações e integrações com testes.
- Fazer piloto com negócios e perfis distintos, revisar acessos e corrigir problemas antes de ampliar.
- Publicar web e apps com HTTPS, política de privacidade, suporte, backups e processo de resposta a incidentes.

## Próximo passo sugerido

Começar pelo modelo de dados multiempresa, matriz de permissões e contratos compartilhados de agendamento e comissão. Validar esses fundamentos antes de migrar regras do navegador ou iniciar os apps; isso evita duplicar lógica e expor dados entre negócios.

## Arquivos principais do projeto

- `index.html`: estrutura das telas e dos diálogos.
- `styles.css`: identidade visual, temas e layout responsivo.
- `app.js`: navegação, regras da demonstração e armazenamento local.
- `efahub-logo.svg`: logo vetorial usada pela interface.
- `README.md`: instruções para abrir a demonstração e suas limitações.
