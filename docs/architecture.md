# EFAHub — arquitetura de navegação e experiência

## 1. Princípios de produto

- Referências externas orientam padrões funcionais, nunca a cópia de telas, textos, identidade visual ou ativos.
- Cada papel tem uma área, navegação, tarefas e indicadores próprios.
- A aplicação web e os clientes mobile usam a mesma API; regras de disponibilidade, autorização e valores são validadas no servidor.
- O protótipo atual usa dados fictícios e não implementa autenticação, RBAC efetivo, pagamentos, sincronização ou envio de notificações.
- O cliente paga pelo serviço diretamente no estabelecimento. O EFAHub não processa pagamentos, Pix, cartão, sinal, estorno ou repasse dos serviços; o único pagamento previsto no app é a assinatura da empresa ao EFAHub. Um eventual registro de caixa da empresa serve apenas para anotar um recebimento feito fora do app.
- A experiência deve informar estados vazios, carregamento, erro, sucesso e indisponibilidade, sem inventar integrações ou métricas.
- Dados de saúde e outros dados pessoais sensíveis não são necessários para os fluxos deste MVP.

## 2. Mapa de navegação e sitemap

### Cliente — `/cliente`

Navegação inferior no mobile e cabeçalho no desktop:

1. `/cliente/inicio` — descoberta, próximos agendamentos e atalhos.
2. `/cliente/buscar` — busca e filtros de empresas, profissionais e serviços.
3. `/cliente/empresa/[slug]` — perfil público da empresa.
4. `/cliente/empresa/[slug]/servicos` — catálogo e seleção do serviço.
5. `/cliente/agendar/profissional` — seleção do profissional.
6. `/cliente/agendar/data` — calendário e disponibilidade por dia.
7. `/cliente/agendar/horario` — horários livres por faixa do dia.
8. `/cliente/agendar/confirmacao` — resumo e confirmação da reserva, com aviso de que o serviço será pago diretamente no estabelecimento.
9. `/cliente/agendamentos` — abas de próximos, concluídos e cancelados.
10. `/cliente/perfil` — dados pessoais, preferências, privacidade e suporte.

Jornada: início/busca → empresa → serviço → profissional → data → horário → confirmação → agendamentos. O servidor deve recalcular a disponibilidade e confirmar a reserva atomicamente; o cliente nunca decide sozinho que um horário está livre.

### Profissional — `/profissional`

Navegação própria, priorizando a rotina individual:

11. `/profissional/inicio` — atendimentos de hoje, próxima pessoa, produção e comissão estimada.
12. `/profissional/agenda/dia` — timeline do dia e detalhes do atendimento.
13. `/profissional/agenda/semana` — calendário semanal, jornadas e bloqueios.
14. `/profissional/atendimentos/[id]` — cliente, serviço, observações e transições permitidas.
15. `/profissional/clientes` — busca e histórico permitido ao profissional.
16. `/profissional/comissoes` — valores por período e situação das comissões.
17. `/profissional/perfil` — especialidades, dados profissionais, jornada e folgas.

Jornada: início → atendimento → consulta de informações necessárias → iniciar/concluir ou solicitar alteração. O profissional só acessa os dados de clientes vinculados ao seu negócio e às suas permissões.

### Funcionário/recepção — `/funcionario`

Navegação operacional independente:

18. `/funcionario/inicio` — fila, check-ins, agenda do dia e serviços cujo pagamento presencial ainda precisa ser registrado.
19. `/funcionario/agenda` — visão geral por profissional, sala e data.
20. `/funcionario/agendamentos/novo` — criação assistida de reserva.
21. `/funcionario/clientes/novo` — cadastro mínimo de cliente, com validação e consentimento aplicável.
22. `/funcionario/check-in` — clientes do dia, chegada, atraso e falta.
23. `/funcionario/caixa` — anotação administrativa de recebimentos feitos no estabelecimento; não cobra nem processa pagamentos.

Jornada: localizar ou cadastrar cliente → selecionar serviço e profissional → consultar disponibilidade do servidor → confirmar reserva → registrar chegada → se necessário, anotar no caixa o pagamento que já foi feito no estabelecimento.

### Administrador da empresa — `/empresa`

Navegação de gestão da própria organização:

24. `/empresa/inicio` — receita, ticket médio, novos clientes, ocupação e indicadores disponíveis.
25. `/empresa/agenda` — agendas da unidade, filtros, bloqueios e reagendamento.
26. `/empresa/clientes` — CRM, busca, frequência e segmentos com base em dados disponíveis.
27. `/empresa/profissionais` — equipe, metas, permissões e produção.
28. `/empresa/servicos` — serviços, preço, duração, categoria e profissionais habilitados.
29. `/empresa/financeiro` — receitas anotadas após recebimento no estabelecimento, despesas, comissões e fluxo de caixa; sem checkout ou processamento de pagamentos de serviços.
30. `/empresa/relatorios` — relatórios por intervalo, serviço, profissional e cliente.
31. `/empresa/marketing` — campanhas e fidelidade; comunicações dependem de consentimento e integração.
32. `/empresa/estoque` — produtos, entradas, saídas e alertas.
33. `/empresa/configuracoes` — dados da empresa, unidades, horários, integrações e assinatura.

Jornada: visão executiva → localizar oportunidade → agir no módulo operacional → acompanhar resultado mensurável. A receita prevista dos serviços e os valores anotados como recebidos presencialmente são indicadores distintos; o dinheiro não passa pelo EFAHub.

### Administrador EFAHub — `/plataforma`

Console de plataforma, sem assumir propriedade dos dados operacionais do estabelecimento:

34. `/plataforma/inicio` — empresas ativas, MRR/ARR, churn e volume agregado.
35. `/plataforma/empresas` — ativação, suspensão, bloqueio e alteração de plano, com motivo e auditoria.
36. `/plataforma/assinaturas` — planos, ciclos, estados e histórico.
37. `/plataforma/financeiro` — cobranças das assinaturas do EFAHub, recebimentos da plataforma e inadimplência dessas assinaturas; nunca pagamentos dos serviços dos estabelecimentos.
38. `/plataforma/suporte` — tickets, prioridade e SLA.
39. `/plataforma/auditoria` — eventos administrativos, acessos e alterações.

Jornada: indicador agregado → conta ou incidente → ação privilegiada com confirmação, justificativa, autorização no servidor e registro de auditoria. As cobranças financeiras deste perfil são somente referentes ao uso do EFAHub pelas empresas.

## 3. Arquitetura de rotas web

Usar App Router do Next.js com áreas explícitas por papel:

```text
app/
  (auth)/
    entrar/page.tsx
    recuperar-senha/page.tsx
  (client)/
    cliente/inicio/page.tsx
    cliente/buscar/page.tsx
    cliente/empresa/[slug]/page.tsx
    cliente/empresa/[slug]/servicos/page.tsx
    cliente/agendar/{profissional,data,horario,confirmacao}/page.tsx
    cliente/agendamentos/page.tsx
    cliente/perfil/page.tsx
  (professional)/
    profissional/inicio/page.tsx
    profissional/agenda/{dia,semana}/page.tsx
    profissional/atendimentos/[id]/page.tsx
    profissional/{clientes,comissoes,perfil}/page.tsx
  (employee)/
    funcionario/inicio/page.tsx
    funcionario/agenda/page.tsx
    funcionario/agendamentos/novo/page.tsx
    funcionario/clientes/novo/page.tsx
    funcionario/{check-in,caixa}/page.tsx
  (business)/
    empresa/inicio/page.tsx
    empresa/{agenda,clientes,profissionais,servicos,financeiro,relatorios,marketing,estoque,configuracoes}/page.tsx
  (platform)/
    plataforma/inicio/page.tsx
    plataforma/{empresas,assinaturas,financeiro,suporte,auditoria}/page.tsx
```

Os grupos entre parênteses organizam layouts, não aparecem na URL. Middleware pode melhorar redirecionamentos, mas não substitui autorização: cada consulta e mutação deve verificar a sessão, o papel e o `business_id` no servidor/RLS. Endpoints e Server Actions devem repetir essas verificações; ocultar itens de menu não é controle de acesso.

Neste protótipo, as URLs são resolvidas por `app/[area]/[[...segments]]/page.tsx` e `lib/routes.ts` para manter uma única prévia navegável. O sitemap completo acima é a arquitetura-alvo; cada fluxo deve ganhar seus próprios segmentos/layouts e componentes antes de produção. A rota e o seletor de papel não fornecem autorização.

## 4. Wireframes textuais por tela

### Cliente

1. **Início:** cabeçalho com avatar, saudação, busca e notificações; destaque editorial; atalhos por categoria; próximo agendamento com ações; empresas próximas e favoritos; navegação inferior persistente.
2. **Buscar empresas:** busca com estado vazio; filtros recolhíveis por categoria, nota, distância, preço e disponibilidade; resultados em cards com capa, logo, endereço, funcionamento, avaliação e próximo horário; ordenar e limpar filtros.
3. **Perfil da empresa:** capa e logo; nome, avaliação, localização e contato; abas serviços, profissionais, avaliações, informações e galeria; CTA de agendamento persistente; avaliações identificadas como verificadas somente se houver fonte confiável.
4. **Serviços:** cabeçalho da empresa; busca/categorias; cards de serviço com descrição, duração, preço, profissionais habilitados e ação “Agendar”; indisponibilidade explicada.
5. **Profissional:** lista de profissionais compatíveis com o serviço; foto/iniciais, nome, especialidade, experiência, nota e serviços; opção “qualquer profissional” se a empresa permitir.
6. **Datas:** calendário mensal acessível; navegação entre meses; legenda de disponível/lotado/bloqueado; estados não selecionáveis anunciados por texto e não apenas por cor.
7. **Horários:** data selecionada; grupos manhã/tarde/noite; mostrar somente slots retornados pelo servidor; atualizar e tratar conflito como indisponibilidade, sem confirmar reserva.
8. **Confirmação:** empresa, serviço, profissional, data, hora, duração e valor; política de cancelamento; consentimentos e pagamento se aplicáveis; botão de confirmar com estado de envio, sucesso ou erro recuperável.
9. **Agendamentos:** abas próximos/concluídos/cancelados; cards com detalhes; remarcar, cancelar e localização quando suportados; confirmação de cancelamento e status atualizado do servidor.
10. **Perfil:** dados pessoais mínimos, contato, cidade opcional, preferências de comunicação, consentimentos, privacidade, exclusão/exportação conforme política e suporte.

### Profissional

11. **Dashboard:** saudação e data; métricas de atendimentos, produção, comissão e próximo cliente; timeline; atalhos para agenda, clientes e ganhos; explicação de que produção não significa valor pago.
12. **Agenda diária:** seletor de data; timeline com horários, estado e duração; filtros próprios; cartões abrem atendimento; folgas e bloqueios aparecem distintos de reservas.
13. **Agenda semanal:** grade por dia e faixa de horário; navegação semanal; bloqueios e intervalos; versão móvel em lista; alterações exigem autorização e validação de conflito no servidor.
14. **Atendimento:** cliente e informações estritamente necessárias, histórico relacionado, serviço/valor/duração e observações; ações iniciar/finalizar/cancelar conforme estado e papel; confirmação para operações irreversíveis.
15. **Clientes:** busca e filtros autorizados; visitas e preferências fornecidas; sem expor clientes sem vínculo; estado vazio e aviso de uso responsável.
16. **Comissões:** seletor dia/semana/mês; total estimado, pago e pendente em categorias distintas; gráfico acessível; itens de origem e exportação permitida.
17. **Perfil profissional:** dados, especialidades, serviços habilitados, jornada, pausas, folgas e bloqueios; mudanças críticas encaminhadas para aprovação se o papel não puder editar.

### Funcionário/recepção

18. **Dashboard:** contagens de fila, check-ins, reservas e recebíveis pendentes; lista “próximos”; ações rápidas; alerta de dado desatualizado.
19. **Agenda geral:** dia/semana; filtros de profissional, sala e unidade autorizada; status visual e textual; abrir detalhes; reagendamento sujeito a validação de conflito.
20. **Novo agendamento:** busca/cadastro de cliente; seleção serviço/profissional; consulta dos slots ao servidor; revisão final; salvar, mostrar conflito e permitir nova consulta.
21. **Cadastro de cliente:** nome e contato mínimos, formato validado, consentimento e finalidade; indicar duplicidade potencial sem revelar dados a quem não tenha acesso.
22. **Check-in:** lista cronológica do dia; ações chegou, atrasado e falta; confirmação e trilha de auditoria; impedir estados inválidos.
23. **Caixa:** indicar serviços cujo pagamento será feito no estabelecimento e permitir, se a empresa quiser, anotar o recebimento depois que ocorreu; forma (PIX/cartão/dinheiro), referência e comprovante são somente registros manuais. Não oferecer checkout, cobrança, captura, transferência ou estorno pelo app.

### Administrador da empresa

24. **Dashboard executivo:** período comparável; receita, ticket, clientes novos/recorrentes, ocupação e cancelamentos; NPS somente se medido; gráficos com legenda, origem e vazios explícitos; atalhos para módulos.
25. **Agenda empresarial:** dia/semana/mês; colunas por profissional/sala; filtros e criação; bloqueios, folgas, férias e reagendamento; conflito tratado no servidor; drag-and-drop só quando houver persistência confiável.
26. **CRM:** pesquisa, filtros e segmentos; visitas, última visita e preferências; aniversário/inatividade apenas com dados e base apropriados; evitar exposição excessiva de PII.
27. **Profissionais:** lista e status; perfil, serviços, agenda, metas e produção; permissões por função; convite e alteração de acesso com auditoria.
28. **Serviços:** catálogo ativo/inativo; formulário validado para preço, categoria, duração e profissional; prévia pública; histórico de alterações relevantes.
29. **Financeiro:** entradas anotadas após recebimento no estabelecimento, despesas e comissões separados; filtros, relatórios e exportação. Não processar o pagamento do serviço nem afirmar que o dinheiro passou pelo EFAHub.
30. **Relatórios:** período, unidade e dimensões; receita, serviços, profissionais e clientes; definição do indicador, origem, filtros aplicados e exportação autorizada.
31. **Marketing:** campanhas, cupons, cashback e fidelidade; audiência e consentimento antes do envio; prévia, agendamento, estado e resultados; não disparar comunicações no protótipo.
32. **Estoque:** catálogo, saldo, custo, entradas/saídas, inventário e alertas; confirmação para ajustes; histórico por operador.
33. **Configurações:** empresa/unidades; horários; regras de reserva e cancelamento; integrações; assinatura; membros e papéis; alterações críticas confirmadas e auditadas.

### Administrador EFAHub

34. **Dashboard global:** MRR/ARR com fórmulas e período; churn, empresas e agendamentos agregados; tickets e alertas; nenhum dado individual do cliente final por padrão.
35. **Empresas:** pesquisa, filtros e detalhes; ativar/suspender/bloquear/alterar plano; motivo obrigatório, revisão de impacto e auditoria.
36. **Assinaturas:** planos Basic/Pro/Enterprise; ciclo, status, vigência, cobrança e histórico; mudanças protegidas contra ação acidental.
37. **Financeiro da plataforma:** cobranças e recebimentos apenas das assinaturas do EFAHub, inadimplência e conciliação dessas cobranças; nunca incluir pagamentos dos serviços dos estabelecimentos. Moeda, período e origem visíveis.
38. **Suporte:** fila, severidade, SLA, atribuição, notas e histórico; limitar dados sensíveis nos tickets; estados de resposta claros.
39. **Auditoria:** filtros por ator, empresa, ação e período; trilha imutável no backend, paginação e exportação privilegiada; nunca expor tokens/segredos.

## 5. Componentes e fronteiras

### Componentes de plataforma compartilhados

- `AppShell`/layouts separados por papel, `Brand`, seletor de unidade autorizado e cabeçalho contextual.
- `RoleNavigation` configurada por área, `Breadcrumbs`, `PageHeader` e navegação responsiva.
- `MetricCard`, `DateRangePicker`, `SearchField`, `FilterBar`, `EmptyState`, `LoadingState`, `ErrorState`, `Toast` e confirmação acessível.
- `DataTable` com paginação e estados; `StatusBadge` com texto e ícone; `Money` e formatadores de data usando locale/timezone da empresa.
- Formulários com React Hook Form + Zod; validação de servidor é sempre autoritativa.
- TanStack Query para estado remoto, cache, invalidação e erros; Zustand somente para estado efêmero de interface, nunca como fonte de autorização.
- shadcn/ui como componentes acessíveis mantidos no repositório, com tokens visuais EFAHub e sem cópia de interface concorrente.

### Domínios com componentes próprios

- Cliente: `BusinessCard`, `ServiceCard`, `ProfessionalCard`, `AvailabilityCalendar`, `TimeSlotPicker`, `BookingSummary`.
- Profissional: `DayTimeline`, `WeekSchedule`, `AppointmentDetail`, `CommissionSummary`.
- Recepção: `CheckInQueue`, `QuickBookingForm`, `CashEntryForm`.
- Empresa: `BusinessCalendar`, `CustomerSegments`, `StaffTable`, `ServiceEditor`, `CashFlow`, `CampaignEditor`, `InventoryLedger`.
- Plataforma: `TenantTable`, `SubscriptionStatus`, `SupportQueue`, `AuditLogTable`.

Compartilhar controles e linguagem visual não significa compartilhar telas ou permissões. Layout, conteúdo, navegação e tarefas são específicos de cada papel.

## 6. Matriz RBAC acordada

Legenda: **L** ler; **C** criar; **E** editar; **X** excluir; **A** administrar; **—** sem acesso. “Próprio” significa somente os dados ligados à identidade autenticada. As permissões devem ser aplicadas em policies/RPCs no servidor e no banco, não apenas na interface. Todo dado operacional deve permanecer isolado por empresa.

| Recurso/ação | Cliente | Profissional | Recepcionista | Admin Empresa | Admin EFAHub |
|---|---:|---:|---:|---:|---:|
| Criar empresa | — | — | — | C própria, como contratante | C; deve vincular o proprietário contratante |
| Editar dados da empresa | — | — | — | E própria | E |
| Suspender/excluir empresa | — | — | — | — | A |
| Ver informações da empresa | L | L | L | L | L |
| Criar, editar, remover e ativar funcionários | — | — | — | A | A |
| Definir permissões da equipe | — | — | — | A | A |
| Visualizar equipe | — | L | L | L | L |
| Criar/atualizar cadastro próprio de cliente | C/E próprio | — | — | — | — |
| Criar/editar cadastro de cliente | — | C/E | C/E | C/E | C/E |
| Excluir cadastro de cliente | — | — | X | X | X |
| Visualizar clientes | L próprio | L | L | L | L |
| Criar agendamento | C próprio | C | C | C | C |
| Alterar próprio agendamento | E próprio, conforme regra da empresa | E | E | E | E |
| Alterar/cancelar qualquer agendamento | — | E/A | E/A | E/A | E/A |
| Cancelar/reagendar próprio agendamento | Conforme prazo e regras da empresa | E/A | E/A | E/A | E/A |
| Confirmar atendimento/check-in | Conforme configuração da empresa | E | E | E | E |
| Visualizar agenda completa | — | L | L | L | L |
| Visualizar serviços | L | L | L | L | L |
| Criar, editar, excluir serviços e configurar preço/duração | — | — | — | A | A |
| Utilizar cupom | C próprio | — | C | C | C |
| Criar/editar/excluir cupom | — | — | — | A | A |
| Consultar uso de cupons | — | — | L | L | L |
| Registrar pagamento presencial concluído | — | C | C | C | C |
| Registrar sangria/suprimento | — | — | C | C | C |
| Visualizar caixa | — | L | L | L | L |
| Fechar/reabrir caixa | — | — / — | C / — | C / E | C / E |
| Visualizar comissões | — | L próprias | L todas | L todas | L todas |
| Configurar, ajustar ou estornar comissões | — | — | — | A | A |
| Configurar cancelamento, remarcação, check-in, horários, comissões e notificações | — | — | — | A | A |
| Visualizar agenda própria/relatório próprio | L próprio | L próprio | L | L | L |
| Ver faturamento / produtividade | — / — | — / L própria | L / L | L / L | L / L |
| Exportar relatórios | — | — | C | C | C |
| Ver plano, alterar plano, atualizar cobrança ou cancelar assinatura | — | — | — | A própria | A |
| Suspender assinatura | — | — | — | — | A |
| Ler auditoria | — | — | — | L da própria empresa | L global |
| Registrar ações críticas na auditoria | Via servidor | Via servidor | Via servidor | Via servidor | Via servidor |

### Identidade e papéis no banco

- `owner` representa o proprietário que contrata e cadastra a empresa; `manager` representa o administrador da empresa. Ambos têm administração do próprio tenant, conforme a matriz.
- `barber` é o nome legado da função `professional`; manter o mapeamento até concluir uma migração compatível.
- `receptionist` representa a recepção.
- O cliente precisa autenticar seu telefone por OTP antes de acessar ou alterar reservas. O telefone digitado num formulário não prova titularidade.
- `platform_admin` deve ser uma associação global separada, nunca um papel que um administrador de empresa possa atribuir a si mesmo ou a outro membro. Toda ação global deve ser auditada.
- Admin EFAHub pode criar o registro da empresa, mas deve associar o proprietário que contratou; isso não o torna dono.

O esquema anterior é um MVP com nomes `businesses`/`business_id` e papéis `owner`, `manager`, `barber` e `receptionist`; ele não deve ser apagado ou reescrito enquanto não se confirmar se já foi aplicado. A migração incremental [202611150001_rbac_foundation.sql](../supabase/migrations/202611150001_rbac_foundation.sql) prepara identidade de cliente por OTP, registro separado de administradores globais, trilha de auditoria e tabelas de apoio. Ela ainda não implementa toda a matriz: fluxos de faturamento, gestão de caixa, cadastro de empresa pelo Admin EFAHub e algumas operações precisam de implementação e teste. A migração não foi aplicada a um projeto Supabase; até validar RLS/RPCs em um banco de teste, esta tabela é a regra de produto, não uma garantia de segurança disponível no app. Não colocar `service_role` no navegador nem tratar o seletor de perfil demonstrativo como login. Ver [regras de negócio](./business-rules.md).

## 7. Decisões pendentes antes de produção

- Aplicar a migração incremental em um ambiente de teste após confirmar o estado da migração MVP; executar testes reais de RLS e RPC com usuários de cada papel/tenant.
- Configuração do Supabase Auth para OTP por SMS, limites contra abuso, recuperação de acesso e fluxo de convites.
- Entitlements/planos e limites comerciais; regras de bloqueio e contestação.
- Provedor e conciliação das assinaturas recorrentes pagas pelas empresas ao EFAHub.
- Revisão jurídica da retenção de dados pessoais por até 10 anos e do consentimento para campanhas, WhatsApp, analytics e preferências.
- Requisitos fiscais, LGPD, suporte, auditoria, backups e resposta a incidentes.
- API de disponibilidade e confirmação atômica para impedir dupla reserva.
- Métricas e fórmulas auditáveis para MRR, ARR, churn, NPS e ocupação.
- Cobertura de testes automatizados para cada ação da matriz, incluindo tentativas de acesso cruzado entre tenants e ações globais.
