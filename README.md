# EFAHub

Plataforma em evolução para descoberta, agendamento e gestão de negócios com hora marcada. A experiência web está sendo migrada para Next.js 15, React 19, TypeScript e Tailwind CSS.

## Executar localmente

Pré-requisitos: Node.js 20.9+ e npm.

```powershell
npm install
npm run dev
```

Abra `http://localhost:3000`. Os comandos de build e testes são `npm run build` e `npm test`.

## Experiência implementada neste estágio

- Cinco espaços demonstrativos independentes: cliente, profissional, funcionário/recepção, administrador da empresa e administrador EFAHub.
- Navegações e dashboards próprios para cada papel, adaptados a desktop e dispositivos móveis.
- Jornada guiada de agendamento com empresa, serviço, profissional, data, horário e confirmação.
- Visões demonstrativas de agenda, CRM, atendimento, ganhos, caixa, serviços, equipe, marketing, estoque, assinaturas, suporte e auditoria.
- Layouts responsivos e componentes base para métricas, agenda, tabelas, cards, notificações e estados de interface.
- Paleta visual padronizada com o roxo EFAHub (`#7853D6`, `#A888FF` e tons lilás), mantendo cores semânticas para status, avaliações e alertas.
- Temas claro, escuro neutro e automático, com preferência local; no modo escuro, superfícies usam tons de preto e o roxo da marca permanece como destaque.
- [Mapa completo de navegação, rotas, wireframes, componentes e RBAC](./docs/architecture.md).
- [Relatório de auditoria do produto, UX, UI, arquitetura e roadmap priorizado](./docs/audit-report.md).
- [Como publicar e testar pelo GitHub Pages](./docs/deployment.md).

## Importante: protótipo, não sistema de produção

O seletor de papel é somente uma prévia de interface. Não há login, autenticação, autorização RBAC, banco conectado, sincronização, pagamentos ou envio de notificações. Os registros e indicadores exibidos são fictícios; não use dados reais de clientes. Nenhuma operação privilegiada pode ser considerada protegida até que autorização e isolamento sejam verificados no backend.

**Regra de pagamento:** clientes pagam pelos serviços diretamente no estabelecimento. O EFAHub não deve oferecer checkout, Pix/cartão, cobrança, transferência ou estorno desses serviços. A única cobrança prevista dentro do produto é a assinatura que a empresa paga ao EFAHub. Um registro manual de caixa, se usado pela empresa, apenas anota um pagamento que já ocorreu presencialmente; não movimenta dinheiro.

O sitemap e a matriz RBAC são propostas de produto. A migração Supabase atual ainda não define papéis de cliente ou administrador da plataforma e precisa ser ampliada e testada. Regras de disponibilidade, conflitos, estados de atendimento, comissões, pagamentos e auditoria precisam ser executadas e validadas no servidor. Não exponha uma `service_role` no navegador.

## Arquitetura planejada

O Next.js é a aplicação web. Apps mobile para cliente e profissional podem ser desenvolvidos separadamente e devem consumir as mesmas APIs. Supabase/PostgreSQL é a fundação prevista para identidade, dados multiempresa, políticas de acesso e regras compartilhadas; a migração atual não está implantada nem conectada à interface.

| Componente | Estado |
| --- | --- |
| Next.js 15 + TypeScript + Tailwind CSS | Interface em protótipo |
| TanStack Query, Zustand, React Hook Form e Zod | Dependências preparadas para estado remoto e formulários |
| shadcn/ui | Componentes acessíveis a incorporar conforme os módulos evoluírem |
| Supabase/PostgreSQL | Migração inicial preparada, ainda inativa |
| Supabase Auth, políticas por papel/empresa | Não conectados à aplicação |
| WhatsApp e notificações | Edge Function existente; não conectada nem operacional |
| Apps Flutter | Não implementados |

### Supabase e comunicações

A migração `supabase/migrations/202611030001_mvp_core.sql` prepara isolamento por estabelecimento, papéis, regras de disponibilidade e conflito de agenda, snapshots de comissão e uma fila transacional para mensagens de WhatsApp. A Edge Function `supabase/functions/whatsapp-outbox` envia templates aprovados pela Meta. Nenhum desses componentes está implantado ou conectado à interface.

Antes de ativar, configure um projeto Supabase, revise e aplique as migrações, implemente Auth e políticas RLS, cubra isolamento com testes, conecte a aplicação às APIs/RPCs, configure os segredos do worker e agende seu processamento. O worker espera `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_API_VERSION`, `WHATSAPP_WORKER_SECRET` e os nomes `WHATSAPP_TEMPLATE_BOOKING_CONFIRMED`, `WHATSAPP_TEMPLATE_BOOKING_RESCHEDULED` e `WHATSAPP_TEMPLATE_BOOKING_CANCELLED`. Não registre segredos no repositório ou no frontend.

## Protótipo HTML legado

`legacy/` guarda o protótipo estático anterior, incluindo HTML, CSS, JavaScript e utilitários, como referência de fluxos explorados. A aplicação Next.js é a entrada principal e o workflow do GitHub Pages publica a versão Next.js exportada estaticamente.

## Publicação de demonstração

O workflow de GitHub Actions compila o Next.js como site estático e publica o diretório `out/` no GitHub Pages a cada atualização da branch `main`. As rotas da demonstração são pré-geradas, e a base de caminho usa o nome do repositório.

O repositório está configurado como privado neste momento. O GitHub Pages para uma fonte privada depende do plano da conta. Se o Pages não estiver disponível para este repositório, será necessário habilitar Pages na configuração do repositório ou torná-lo público; tornar o repositório público expõe também o código e o histórico Git. Veja as etapas em [deployment.md](./docs/deployment.md). A URL do site só ficará ativa depois que a configuração de Pages estiver habilitada e o workflow terminar com sucesso.

O site publicado é uma demonstração pública com dados fictícios, sem autenticação ou RBAC efetivo. Não use dados reais nem considere as ações como operações de produção.
