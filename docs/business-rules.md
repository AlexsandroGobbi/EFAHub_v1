# Regras de negócio do EFAHub

Este documento consolida as regras informadas para o produto. A interface Next.js atual é uma demonstração: botões, estados e cadastros feitos nela não substituem autenticação, autorização, registros ou cobranças no servidor.

## Empresas e equipe

- O proprietário que contratar o EFAHub cria/cadastra a própria empresa no fluxo de adesão e fica responsável por ela.
- Administrador da empresa e administrador EFAHub podem criar, editar, remover e ativar/inativar funcionários e definir suas permissões.
- A equipe da plataforma só deve agir dentro da empresa selecionada e suas ações administrativas devem ser auditadas.
- O administrador EFAHub não é o proprietário da empresa.
- O administrador EFAHub pode criar o registro da empresa, mas deve associar o proprietário que contratou; isso não o torna dono.

## Papéis e acesso

- Cliente, profissional, recepcionista, administrador da empresa e administrador EFAHub têm permissões distintas, detalhadas na [matriz RBAC da arquitetura](./architecture.md#6-matriz-rbac-acordada).
- Profissionais podem criar/editar cadastros de clientes e operar a agenda completa da empresa; somente recepção e administradores podem excluir clientes.
- Profissional, recepcionista e administradores podem registrar no caixa pagamentos recebidos presencialmente depois da conclusão do atendimento. O profissional vê suas próprias comissões; recepção e administradores podem ver todas. Somente administradores configuram, ajustam ou estornam comissões.
- Cliente não tem acesso à equipe ou à agenda completa; só pode consultar e administrar os próprios dados e reservas.
- Administrador EFAHub é um papel global separado das associações de empresa. Não pode ser concedido por um administrador de empresa e suas ações devem entrar na auditoria.
- Para provar que uma reserva pertence ao cliente sem exigir senha, o cliente precisa autenticar o telefone por OTP antes de consultar, cancelar ou reagendar. O telefone digitado num formulário não serve como prova de identidade.

## Agendamentos

- O cliente pode criar, alterar e cancelar apenas os próprios agendamentos e deve respeitar as regras de antecedência configuradas pela empresa. Consulta e autoatendimento exigem verificação OTP do telefone.
- Administrador da empresa, recepcionista, profissional e administrador EFAHub podem criar, alterar e cancelar qualquer agendamento da empresa, conforme a matriz de permissões.
- Alterações feitas por um funcionário da empresa não devem voltar a aguardar aprovação do cliente ou da empresa sem uma regra explícita que determine isso.
- O administrador da empresa configura confirmação de presença, cancelamento e remarcação. As regras aplicáveis devem ser mostradas ao cliente antes de confirmar a reserva.
- O administrador da empresa configura o que fazer quando um profissional se atrasar ou faltar (por exemplo, avisar o cliente, remarcação pela recepção ou proposta de remarcação automática).

## Comissões

- Administrador da empresa e administrador EFAHub definem o cálculo, o momento de liberação e os ajustes/estornos de comissão.
- A regra pode variar por serviço, profissional, valor percentual ou fixo e forma de pagamento presencial.
- O profissional pode consultar os próprios ganhos, mas não corrigir as regras ou os valores calculados.
- Recepcionista e administradores podem consultar todas as comissões; profissional só pode consultar as próprias.
- A aplicação da regra e qualquer correção precisam gerar histórico auditável no backend.

## Pagamento do serviço e caixa

- O serviço é pago presencialmente, diretamente à empresa; o EFAHub não oferece checkout nem processa esse pagamento.
- Após a conclusão do atendimento e o recebimento no estabelecimento, profissional, recepcionista ou administrador pode anotar a forma de pagamento presencial (dinheiro, PIX, cartão ou transferência) e confirmar que recebeu.
- Recepção e administradores podem registrar sangria/suprimento e fechar caixa; somente administradores podem reabrir um caixa fechado.
- O registro no caixa é administrativo; não inicia cobrança, captura, transferência, conciliação ou estorno.
- As assinaturas recorrentes pagas pela empresa ao EFAHub são a única cobrança prevista dentro da plataforma.

## Assinatura EFAHub

- A assinatura renova automaticamente ao final do ciclo contratado, usando a forma de pagamento cadastrada.
- Em falha ou atraso, o EFAHub pode tentar cobrar novamente e notificar o assinante. O acesso pode ser parcialmente limitado ou suspenso até a regularização.
- O assinante pode solicitar cancelamento a qualquer momento. A assinatura continua ativa até o fim do período pago e não há novas cobranças após o cancelamento.
- Após o cancelamento, dados podem ser mantidos para eventual reativação e obrigações legais.

## Dados pessoais e retenção

- Coletar somente os dados necessários ao serviço contratado. Nome e telefone são normalmente usados; CPF, nascimento, e-mail ou endereço dependem da necessidade da empresa.
- Preferências de comunicação e consentimento para marketing devem ser separados da execução necessária do agendamento.
- Dados pessoais e históricos operacionais poderão ser mantidos por até 10 anos para obrigações legais, auditoria, segurança e histórico de atendimento. Depois do prazo, poderão ser anonimizados ou excluídos conforme a política de privacidade vigente.
- A política de retenção deve ser revisada juridicamente e implementada no backend antes de tratar dados reais. O prazo não deve ser interpretado como autorização para coletar ou conservar dados sem necessidade.

## O que a demonstração já mostra

- Cliente: exibe apenas a lista demonstrativa de agendamentos de João, mostra prazos e bloqueia no manipulador local cancelamento/remarcação fora da antecedência configurada.
- Empresa: configura prazos, check-in, resposta a atraso/falta e regras demonstrativas de comissão por serviço e profissional.
- Recepção e administrador da empresa: podem alterar, cancelar e concluir agendamentos de demonstração. O caixa só habilita registro para atendimentos concluídos e identifica a forma presencial.
- Administrador da empresa: pode convidar/remover funcionários de uma lista local e editar as regras demonstrativas; estado mantido temporariamente na sessão desta aba.
- Administrador EFAHub: pode abrir os detalhes da empresa de demonstração, gerenciar equipe e agenda, além de ver controles simulados de assinatura, tentativas e notificações.
- Assinatura: a tela representa renovação, atraso, limitação de acesso e cancelamento ao final do período; o estado é mantido temporariamente na sessão desta aba e não há cobrança real.
- Perfil do cliente: informa o prazo de retenção proposto e a necessidade de política de privacidade.
- As telas ainda são demonstrativas: o seletor de papel não aplica as permissões desta matriz nem faz OTP.

## Pendências para produção

- Não há login conectado, OTP ativo, autorização RBAC efetiva, isolamento entre empresas, persistência da interface, envio de convites/notificações nem provedor de cobrança conectado.
- A migração inicial não representa todos os papéis e poderes definidos aqui. A migração incremental [202611150001_rbac_foundation.sql](../supabase/migrations/202611150001_rbac_foundation.sql) prepara algumas estruturas de identidade OTP, administrador EFAHub separado, auditoria e permissões; ela ainda não cobre a matriz inteira e não foi aplicada nem testada contra um projeto Supabase. A execução requer confirmar o estado da migração anterior e validar todas as policies/RPCs num ambiente de teste.
- A migração incremental ainda não oferece um fluxo atômico para o Admin EFAHub criar a empresa e vincular o proprietário; nem implementa suspensão de empresa/funcionário e bloqueio efetivo de acesso.
- Ainda faltam operações de check-in/statuses de atendimento, sangria/suprimento e abertura/fechamento/reabertura de caixa, resgate de cupons, ajustes/estornos de comissões, configuração e entrega de notificações e integração de cobrança/retentativas da assinatura.
- Criar uma política de autorização no backend/RLS para cada ação, verificar o `business_id` e o proprietário/contrato ativo e cobrir tentativas indevidas com testes. Não confiar no seletor de papel nem em validação do navegador.
- Implementar convites revogáveis, cobrança recorrente, retentativas e estado de acesso no servidor; registrar mudanças de assinatura, comissões, consentimentos e ações de equipe em auditoria.
- Registrar recebimentos como eventos imutáveis ou corrigíveis com trilha de auditoria, sem transformar o caixa em processador de pagamentos.
- Definir prazos de cancelamento, remarcação, atrasos e faltas por empresa e validar novamente no servidor no momento de cada operação.
- Definir e testar retenção, anonimização e exclusão com revisão jurídica antes de armazenar dados pessoais reais.
