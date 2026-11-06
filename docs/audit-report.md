# Auditoria do EFAHub

**Escopo:** aplicação web e fluxos demonstrativos existentes.  
**Data:** 06/11/2026.

## Resumo executivo

O EFAHub tem uma base visual consistente e cinco áreas demonstrativas, mas ainda não é um SaaS operacional. As telas e os dados são majoritariamente locais/fictícios; não há autenticação, autorização efetiva, isolamento entre empresas, pagamentos ou confirmação transacional de reservas. O bloqueio prioritário para produção é implementar e testar essas fronteiras no servidor.

| Dimensão | Nota | Evidência e ressalva |
|---|---:|---|
| UX | 6/10 | Jornadas principais estão representadas; algumas ações continuam demonstrativas e não concluem operações reais. |
| UI | 7/10 | Identidade roxa e componentes coerentes; tokens ainda coexistem com cores arbitrárias e não foi feita inspeção WCAG completa. |
| Performance | 6/10 | Build de produção concluído; o App Router reportou 63,1 kB para a rota principal e 166 kB de JS inicial. Não foi feito teste de rede, Core Web Vitals ou carga. |
| Escalabilidade | 4/10 | Um componente cliente central concentra muitas áreas; não há serviços/APIs reais nem autorização multiempresa em execução. |
| Produto | 4/10 | Cobertura visual dos perfis é ampla, mas boa parte dos módulos não possui regras, dados ou persistência operacionais. |

As notas são uma avaliação qualitativa do protótipo, não métricas de usuários ou certificação.

## Melhorias aplicadas nesta auditoria

- Adicionada navegação superior para cliente em desktop, mantendo a navegação inferior em dispositivos menores.
- Corrigida a navegação entre descoberta, perfil da empresa e catálogo de serviços; o perfil agora reflete a empresa selecionada.
- Adicionados estados funcionais de favorito e uma tela vazia com caminho para descoberta.
- Favoritos persistidos localmente neste protótipo; não sincronizam entre dispositivos nem usuários.
- Ligadas ações dos dashboards de profissional e plataforma a módulos existentes; tipadas as ações rápidas da recepção.
- Implementada preferência de tema claro, escuro e automático (claro das 06:00 às 17:59, escuro das 18:00 às 05:59), persistência local, sincronização entre abas e tratamento explícito de erro de armazenamento.
- Convertidos os fundos do modo escuro para tons neutros próximos do preto, preservando o roxo EFAHub e as cores semânticas de status.
- Reduzido o overflow horizontal do cabeçalho em telas estreitas.
- Melhorado o diálogo de agendamento com foco inicial, contenção de foco por teclado, fechamento por Escape e restauração do foco.
- Adicionadas preferências de movimento reduzido e foco de teclado visível.

Essas melhorias de interface não substituem autenticação ou validação de regras no servidor.

## Achados

| ID | Prioridade | Área | Achado | Estado |
|---|---|---|---|---|
| A1 | P0 — bloqueador de produção | Segurança/RBAC | O seletor de papel é apenas demonstrativo. Não há login, autorização de servidor nem enforcement de escopo por empresa nesta interface. A matriz em `architecture.md` é proposta, não controle ativo. | Pendente; implementar antes de expor dados reais. |
| A2 | P0 — bloqueador de produção | Agendamento/financeiro | A reserva é mantida em estado local; horários, pagamentos, cancelamentos e comissões não são confirmados por serviço transacional. Não há proteção real contra dupla reserva, replay ou conciliação. | Pendente; API e regras server-side necessárias. |
| A3 | P1 — alto | Produto/analytics | KPIs, gráficos, agenda e exemplos de clientes incluem valores fixos ou calculados sobre dados fictícios. Não podem orientar decisões de negócio. | Explicitado como demonstrativo; conectar a métricas auditáveis. |
| A4 | P1 — alto | Operação | Cadastro, check-in, recebimento, gestão de empresas, suporte e outros módulos ainda têm ações de demonstração ou conteúdo sem persistência. A navegação até a tela não significa que a operação esteja implementada. | Parcial; priorizar ações por jornada e permissão. |
| A5 | P1 — alto | Deploy | O workflow GitHub Pages existente publica o protótipo HTML legado, não a aplicação Next.js. | Pendente; definir host Next.js ou estratégia de exportação/rotas antes da migração. |
| A6 | P2 — médio | Arquitetura | `efahub-app.tsx` concentra dashboards, navegação, tema, reservas e módulos; tipos de rota dependem de um tipo exportado pelo componente. Isso aumenta acoplamento e custo de manutenção. | Pendente; separar domínios e contratos sem duplicar componentes. |
| A7 | P2 — médio | UX/estados | Loading, erro recuperável, indisponibilidade, autorização negada e estados vazios não são consistentes entre as áreas; os formulários não cobrem todos os critérios de domínio do futuro backend. | Parcial; acrescentar estados ao conectar dados reais. |
| A8 | P2 — médio | Acessibilidade | Foram adicionados foco visível e suporte de teclado ao diálogo; contraste, navegação completa com leitor de tela e critérios WCAG 2.2 ainda não foram auditados formalmente. | Parcial; requer axe/tecnologia assistiva e revisão de contraste por estado. |
| A9 | P2 — médio | Design system | A paleta roxa está padronizada, mas várias telas ainda usam valores arbitrários de cor, raio e espaçamento em classes locais. | Parcial; consolidar os tokens CSS como fonte única. |
| A10 | P3 — baixo | Integrações | Fidelidade, cashback, WhatsApp, LGPD operacional, multiunidade e app mobile são itens de produto/arquitetura, não funcionalidades verificadas nesta UI. | Roadmap; não anunciar como disponíveis. |

## Verificações realizadas

- `npm.cmd run lint`: aprovado, sem avisos ou erros ESLint.
- `npm.cmd test`: 4 testes aprovados (utilitários de contato); não são testes de jornadas/rotas.
- `npm.cmd run build`: build Next.js 15 concluído.
- Navegação no navegador: perfil e serviços de empresa abriram as respectivas rotas; o diálogo fecha por Escape.
- Responsividade: páginas iniciais dos cinco perfis verificadas em 320, 375, 425, 768, 1024, 1280, 1440 e 1920 px; não foi detectado overflow horizontal do documento após os ajustes. Tabelas/elementos internos ainda podem usar rolagem própria.
- Tema: preferência claro/escuro/automático e armazenamento local verificados manualmente; a aparência automática usa o relógio local do navegador.

Não foram executados testes de contraste automatizados, auditoria completa de todas as telas, testes de leitor de tela, Core Web Vitals, carga, penetração ou verificação de produção.

## Roadmap — Impacto × esforço

| Categoria | Próxima entrega | Impacto | Esforço |
|---|---|---:|---:|
| **Quick Wins** | Adicionar testes automatizados para rotas por perfil, preferências de tema e operações de interface já implementadas. | Alto | Baixo |
| **Quick Wins** | Revisar estados vazios, rótulos e ações que ainda respondem somente com toast em cada fluxo. | Médio | Baixo |
| **Projetos Estratégicos** | Implementar autenticação, papéis, escopo por tenant e políticas/RPCs server-side; testar isolamento entre empresas e privilégios da plataforma. | Crítico | Alto |
| **Projetos Estratégicos** | Implementar disponibilidade e reserva atômica/idempotente, estados de cancelamento, pagamentos e conciliação. | Crítico | Alto |
| **Projetos Estratégicos** | Migrar módulos para domínios menores e conectar dashboards a consultas e métricas verificáveis. | Alto | Alto |
| **Projetos Estratégicos** | Definir e validar deploy Next.js, observabilidade, backups e resposta a falhas. | Alto | Médio/alto |
| **Ajustes Menores** | Consolidar tokens de cores, tipografia, espaçamento e bordas e revisar contrastes em ambos os temas. | Médio | Médio |
| **Ajustes Menores** | Executar auditoria WCAG 2.2 assistida por ferramentas e teclado/leitor de tela em todos os fluxos. | Alto | Médio |
| **Baixa Prioridade** | Evoluir fidelidade, cashback, marketplace e aplicativo mobile após validar as jornadas centrais e integrações. | Médio | Alto |

### Critério de liberação

Não conectar clientes ou dados reais até A1 e A2 estarem implementados e cobertos por testes de autorização, isolamento por empresa e concorrência de agendamento. Atualizar este relatório quando os fluxos deixarem de ser demonstrativos.
