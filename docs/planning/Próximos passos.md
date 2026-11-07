# EFAHub: guia simples do que já existe e do que fazer em seguida

Este documento explica, sem presumir conhecimento técnico, em que estágio está o EFAHub e qual é a ordem segura para transformá-lo em um sistema real.

## 1. O que é o EFAHub hoje

O EFAHub tem uma demonstração web feita com Next.js. Você pode abrir o site pelo celular ou computador:

**[Abrir a demonstração do EFAHub](https://alexsandrogobbi.github.io/EFAHub_v1/)**

É possível navegar por áreas de cliente, profissional, recepção, administrador da empresa e administrador EFAHub. A interface tem páginas e exemplos para esses papéis, além de temas claro e escuro.

**Importante:** por enquanto, isso é uma demonstração, não um sistema pronto para atender clientes reais. Os dados são fictícios. Não cadastre informações verdadeiras de clientes, profissionais, empresas, pagamentos ou senhas.

Na prática, isso significa:

- Escolher um papel na interface não comprova sua identidade nem bloqueia o acesso de outras pessoas.
- A maior parte das informações exibidas é de exemplo e não está compartilhada entre usuários.
- Um botão que parece confirmar um pagamento ou agendamento não significa que houve uma operação real.
- O site publicado não tem um banco de dados conectado à interface.
- O projeto tem arquivos iniciais para estudar Supabase e WhatsApp, mas eles não estão implantados nem conectados ao site.
- O cliente paga pelo serviço diretamente no estabelecimento. O app não cobra nem processa pagamentos dos serviços.
- O único pagamento previsto dentro do EFAHub é a assinatura que a empresa paga ao EFAHub. Essa cobrança ainda não está conectada ou funcionando na demonstração.
- A empresa pode anotar no caixa que recebeu um pagamento presencial, se quiser. Essa anotação é só um registro de controle: o dinheiro é recebido fora do app.

## 2. O que já foi feito

- Criada a aplicação principal em Next.js, React, TypeScript e Tailwind CSS.
- Criadas páginas demonstrativas para os cinco papéis do EFAHub.
- Montada uma jornada de demonstração de agendamento e telas para agenda, clientes, equipe, serviços, financeiro, marketing, estoque, suporte e auditoria.
- Padronizada a identidade visual roxa e corrigidos contrastes e layouts em diferentes áreas.
- Adicionados os temas claro, escuro e automático.
- Configurada uma versão estática para demonstração no GitHub Pages.
- Guardado em `legacy/` o protótipo anterior, que não é a aplicação principal.
- Documentados o mapa de navegação, a auditoria e a publicação.

## 3. O que ainda não está pronto para uso real

Antes de atender pessoas de verdade, ainda é necessário desenvolver e testar:

- Cadastro, login e recuperação de senha.
- Um banco de dados conectado e cópias de segurança.
- Regras reais de acesso para cada pessoa e empresa.
- Agendamentos que sejam salvos e compartilhados entre dispositivos.
- Proteção contra duas pessoas reservarem o mesmo horário.
- Cobrança e confirmação das assinaturas do EFAHub. Os serviços das empresas são pagos diretamente no estabelecimento, fora do app.
- Se a empresa quiser, registro administrativo de um pagamento já recebido presencialmente; isso não é checkout nem processamento de pagamento.
- Cálculo financeiro conferido no servidor.
- Envio de mensagens e notificações, com consentimento e tratamento de falhas.
- Política de privacidade, suporte e processo para corrigir incidentes.
- Testes suficientes para provar que uma empresa não consegue acessar os dados de outra.

Uma tela bonita não substitui esses itens. Um sistema só pode ser considerado pronto quando as informações são salvas corretamente, as regras são aplicadas no servidor e os testes confirmam que os dados estão protegidos.

## 4. Vocabulário rápido

- **Frontend:** as telas e os botões que a pessoa vê e usa.
- **Backend:** o serviço que recebe pedidos, confere as regras e responde às telas.
- **Banco de dados:** o lugar onde as informações ficam guardadas.
- **API:** a forma organizada de a tela conversar com o backend.
- **Autenticação:** confirmar quem está entrando, por exemplo, com e-mail e senha.
- **Permissão:** definir o que aquela pessoa pode ver ou fazer.
- **Empresa ou estabelecimento:** o negócio que usa o EFAHub, como um salão.
- **Multiempresa:** vários negócios usam o mesmo sistema, mas cada um só pode acessar os próprios dados.
- **RLS:** regras do banco que limitam quais registros cada pessoa pode consultar ou alterar.
- **Deploy/publicação:** colocar uma versão do sistema em um endereço acessível pela internet.
- **Protótipo:** uma demonstração para testar ideias; não deve ser confundida com um serviço pronto.

## 5. Ordem recomendada: faça uma etapa de cada vez

Não comece criando mais telas ou aplicativos. Primeiro, construa a base que faz as informações serem confiáveis e seguras. Cada etapa abaixo informa o objetivo, o que precisa ser feito e como verificar se terminou.

### Etapa 1 — Escrever as regras do negócio

**Objetivo:** decidir claramente como o sistema deve funcionar antes de programar essas regras.

Anote respostas para perguntas como:

1. Quem pode criar uma empresa?
2. Quem pode convidar ou remover funcionários?
3. Quais informações cada papel pode ver?
4. Quem pode criar, alterar e cancelar um agendamento?
5. Até quando um cliente pode cancelar?
6. O que acontece se o profissional faltar ou se atrasar?
7. Quando uma comissão é calculada e quem pode corrigi-la?
8. Como a empresa vai anotar no caixa um pagamento que já recebeu presencialmente?
9. Quais são as regras de cobrança, renovação, atraso e cancelamento da assinatura do EFAHub?
10. Quais dados pessoais são realmente necessários e por quanto tempo serão guardados?

Crie uma tabela com uma linha para cada ação e uma coluna para cada papel: cliente, profissional, funcionário, administrador da empresa e administrador EFAHub. Marque **pode** ou **não pode**, e explique qualquer exceção.

**Pronto quando:** as regras não dependem de interpretação e a equipe consegue explicar quem pode fazer cada ação.

### Etapa 2 — Planejar dados e acesso

**Objetivo:** definir quais informações serão salvas e impedir que empresas vejam os dados umas das outras.

Liste as informações principais:

- Empresas e unidades.
- Contas de usuário e papéis.
- Clientes e profissionais.
- Serviços, preços e duração.
- Horários de funcionamento, pausas, folgas e bloqueios.
- Agendamentos e alterações feitas neles.
- Assinaturas e cobranças devidas ao EFAHub.
- Se necessário, anotações de pagamentos de serviços já recebidos presencialmente, sem movimentar dinheiro pelo app.
- Comissões e ajustes financeiros da empresa.
- Registros de auditoria, para saber quem fez cada mudança.

Cada informação pertencente a um negócio precisa estar associada à empresa certa. A identificação da empresa não pode ser confiada apenas ao que o navegador envia: o servidor e o banco precisam conferir o acesso.

O projeto já contém uma migração inicial em `supabase/migrations/202611030001_mvp_core.sql`. Ela é um ponto de partida para revisão, não prova de que o banco está pronto ou seguro. Antes de usá-la, confirme que as regras cobrem todos os papéis planejados, incluindo cliente e administrador EFAHub.

**Pronto quando:** o modelo de dados está documentado e os testes provam que uma conta da Empresa A não consegue ler nem alterar informações da Empresa B.

### Etapa 3 — Preparar o ambiente de desenvolvimento

**Objetivo:** conseguir abrir o projeto no próprio computador e verificar mudanças antes de publicá-las.

No PowerShell do Windows, abra a pasta do projeto. Se necessário, use:

```powershell
cd "C:\Users\aalex\OneDrive\Documentos\projeto_app\EFAHub"
```

Instale as dependências apenas se ainda não estiverem instaladas:

```powershell
npm.cmd install
```

Inicie o site de desenvolvimento:

```powershell
npm.cmd run dev
```

Abra no navegador o endereço mostrado no terminal, normalmente `http://localhost:3000`. Para parar o servidor, volte ao terminal e pressione `Ctrl+C`.

Neste computador, use `npm.cmd` em vez de `npm` se o PowerShell bloquear a execução do arquivo `npm.ps1`.

Antes de enviar uma mudança, rode:

```powershell
npm.cmd run lint
npm.cmd test
$env:NEXT_PUBLIC_BASE_PATH="/EFAHub_v1"; npm.cmd run build
```

O primeiro comando procura problemas de código; o segundo executa os testes existentes; o terceiro verifica a compilação e gera a versão estática. Se algum comando falhar, corrija o erro antes de publicar.

**Pronto quando:** o projeto abre localmente e os três comandos terminam sem erro.

### Etapa 4 — Conectar autenticação e permissões

**Objetivo:** garantir que a pessoa entrou com a própria conta e só pode usar as funções permitidas para ela.

Passos:

1. Criar e configurar o projeto de backend/Supabase em um ambiente de desenvolvimento.
2. Implementar cadastro, login, saída e recuperação de senha.
3. Associar cada conta a uma empresa e a um papel.
4. Fazer o servidor conferir a permissão em toda ação protegida.
5. Configurar as políticas RLS no banco para restringir os registros.
6. Testar acessos permitidos e negados para cada papel e empresa.

Esconder um botão na interface não protege os dados. A verificação precisa acontecer no servidor e no banco. Nunca coloque uma chave secreta de administrador, como `service_role`, no código enviado ao navegador.

**Pronto quando:** uma pessoa sem login não acessa páginas privadas, e mudar a URL ou os dados enviados pelo navegador não permite ultrapassar permissões.

### Etapa 5 — Fazer o primeiro fluxo real: agendamento

**Objetivo:** criar um agendamento que continue existindo depois que a pessoa fechar a página.

Implemente nessa ordem:

1. Buscar empresas e serviços ativos.
2. Mostrar profissionais habilitados para o serviço escolhido.
3. Pedir ao servidor as datas e os horários disponíveis.
4. Ao confirmar, o servidor verifica novamente se o horário continua livre.
5. Salvar o agendamento no banco.
6. Mostrar uma confirmação com os dados salvos.
7. Permitir consultar, cancelar ou remarcar conforme as regras definidas na Etapa 1.
8. Registrar quem criou ou alterou o agendamento.

Se duas pessoas tentarem reservar o mesmo horário ao mesmo tempo, apenas uma reserva deve ser confirmada. A disponibilidade exibida na tela não é suficiente: o servidor precisa conferir novamente no momento de salvar.

**Pronto quando:** o agendamento aparece para as pessoas autorizadas, continua salvo após recarregar e não há reservas duplicadas para o mesmo profissional e horário.

### Etapa 6 — Ligar os módulos operacionais

**Objetivo:** conectar as telas para que uma ação atualize os dados usados pelas outras áreas.

Comece por:

1. **Agenda e recepção:** ver o dia, confirmar chegada e registrar atrasos ou faltas.
2. **Atendimento:** iniciar e finalizar um serviço com horário e profissional registrados.
3. **Clientes:** consultar histórico apenas quando a pessoa tiver permissão.
4. **Serviços e equipe:** atualizar cadastros e horários que determinam a disponibilidade.
5. **Caixa da empresa:** se fizer parte do produto, anotar que o cliente pagou no estabelecimento e qual foi a forma usada. Esse registro é manual; o app não cobra, recebe, transfere ou estorna o valor do serviço.
6. **Comissões:** calcular a partir das regras definidas e dos atendimentos concluídos; deixar claro qual regra aprovada pela empresa é usada no cálculo.

O cliente paga pelo serviço diretamente no estabelecimento. Não criar checkout, cobrança por cartão ou Pix, carteira, repasse, split ou estorno de serviços dentro do app. O financeiro do estabelecimento serve para gestão e, se necessário, para registrar manualmente pagamentos recebidos fora dele. As cobranças dentro do EFAHub são apenas as assinaturas que as empresas pagam à plataforma.

**Pronto quando:** a mesma informação aparece corretamente nas áreas autorizadas, e alterações têm histórico de quem fez e quando.

### Etapa 7 — Ativar mensagens e notificações

**Objetivo:** avisar clientes e profissionais sem enviar mensagens duplicadas ou sem autorização.

Antes de ativar o WhatsApp ou notificações:

1. Defina quais mensagens serão enviadas e em que situações.
2. Obtenha e registre o consentimento necessário.
3. Guarde credenciais apenas em configurações secretas do servidor, nunca no frontend ou no Git.
4. Registre se cada mensagem está aguardando, foi enviada ou falhou.
5. Implemente novas tentativas com limite e evite enviar a mesma mensagem duas vezes.
6. Dê uma forma de ajustar preferências ou parar comunicações.

O projeto tem uma função e uma fila iniciais para WhatsApp, mas elas ainda precisam ser revisadas, configuradas e conectadas ao restante do sistema.

**Pronto quando:** os testes comprovam consentimento, envio, falha, nova tentativa e prevenção de duplicidade sem expor credenciais.

### Etapa 8 — Testar segurança, erros e recuperação

**Objetivo:** descobrir problemas antes que afetem um negócio ou um cliente.

Teste pelo menos:

- Login válido, senha inválida e recuperação de senha.
- Permissões de cada papel.
- Tentativas de acessar dados de outra empresa.
- Agendamentos simultâneos, cancelamentos e reagendamentos.
- Anotações manuais de recebimentos presenciais, cobranças das assinaturas do EFAHub e cálculos de comissão; o app não processa nem estorna o pagamento dos serviços.
- Falhas de rede e respostas lentas do backend.
- Telas em celular, computador e com teclado/leitor de tela.
- Backups e restauração dos dados.

Não registre senhas, tokens ou dados pessoais desnecessários nos logs. Registre erros de forma que a equipe consiga investigá-los sem expor informações sensíveis.

**Pronto quando:** os testes críticos passam, os acessos proibidos são bloqueados e existe um procedimento testado para restaurar dados.

### Etapa 9 — Fazer um piloto antes de abrir para todos

**Objetivo:** aprender com poucos usuários, em vez de lançar para todo mundo com problemas escondidos.

1. Escolha um pequeno grupo de negócios que aceite participar.
2. Use um ambiente de teste ou dados de teste; não misture dados fictícios com dados reais.
3. Explique que o sistema está em piloto e como pedir ajuda.
4. Acompanhe agendamentos, falhas, dúvidas e ações que não ficaram claras.
5. Corrija os problemas mais importantes antes de convidar mais negócios.
6. Só depois prepare a publicação oficial, suporte, política de privacidade e monitoramento.

**Pronto quando:** os participantes conseguem completar as tarefas principais, os problemas graves foram resolvidos e há um plano para atender incidentes.

## 6. O que fazer primeiro

Uma sequência curta e prática:

1. **Agora:** revisar as regras de negócio e completar a matriz de permissões.
2. **Em seguida:** revisar o esquema Supabase e planejar testes de isolamento entre empresas.
3. **Depois:** implementar login e permissões no backend.
4. **Então:** conectar e testar o fluxo de agendamento de ponta a ponta.
5. **Só depois:** conectar o financeiro administrativo da empresa, as cobranças de assinatura do EFAHub, mensagens, aplicativos mobile e outras funcionalidades. Não implementar pagamento dos serviços dentro do app.

Não comece pelos aplicativos mobile ou pela automação de marketing. Sem um backend seguro e regras definidas, esses canais apenas repetiriam os mesmos problemas em mais lugares.

## 7. Como publicar uma atualização da demonstração

O workflow do GitHub Pages publica a versão da demonstração quando as alterações são enviadas para a branch `main`.

1. Faça e teste a mudança no computador.
2. Envie a alteração para o GitHub.
3. No repositório, abra a aba **Actions**.
4. Abra a execução chamada **Deploy EFAHub to GitHub Pages**.
5. Espere aparecer que ela terminou com sucesso.
6. Abra o [site publicado](https://alexsandrogobbi.github.io/EFAHub_v1/) e confira a página atualizada.

O deploy do protótipo não transforma a aplicação em um sistema de produção. Continue usando apenas dados fictícios no site público.

## 8. Arquivos e documentos úteis

- `app/`: páginas e rotas da aplicação Next.js.
- `components/`: componentes visuais compartilhados.
- `lib/`: funções auxiliares usadas pela aplicação.
- `tests/`: testes automatizados existentes.
- `supabase/migrations/`: mudanças planejadas para a estrutura do banco.
- `supabase/functions/`: funções de backend, incluindo a integração inicial de WhatsApp.
- `legacy/`: protótipo antigo, mantido apenas como referência.
- [README do projeto](../../README.md): como abrir o projeto e quais são suas limitações.
- [Guia de publicação](../deployment.md): como funciona a demonstração no GitHub Pages.
- [Arquitetura e mapa de navegação](../architecture.md): páginas, fluxos e papéis planejados.
- [Relatório de auditoria](../audit-report.md): problemas e melhorias identificados.

## 9. Regra final

Se uma funcionalidade ainda usa dados de exemplo, não está conectada ao backend ou não teve suas permissões testadas, trate-a como demonstração. Não a use para controlar dinheiro, agenda ou informações de clientes reais.
