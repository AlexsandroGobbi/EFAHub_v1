# Publicar a demonstração no GitHub Pages

## Endereço

Depois que o GitHub Pages estiver habilitado e o workflow concluir sem erros:

<https://alexsandrogobbi.github.io/EFAHub_v1/>

O Pages é público para visitantes. A aplicação contém apenas informações fictícias e não tem autenticação; não inclua dados reais.

## Habilitar e publicar

1. No GitHub, abra `AlexsandroGobbi/EFAHub_v1` → **Settings** → **Pages**.
2. Em **Build and deployment**, selecione **GitHub Actions** como fonte.
3. Envie a branch `main` com as alterações e abra a aba **Actions**.
4. Aguarde **Deploy EFAHub to GitHub Pages** terminar com sucesso e abra a URL indicada no job.

O repositório está privado. O Pages a partir de uma fonte privada depende do plano GitHub. Se a conta não permitir essa configuração, tornar o repositório público expõe o código e o histórico Git; revise isso antes de alterar a visibilidade. A publicação do site em si é pública.

## Estrutura publicada

O workflow instala dependências com `npm ci`, executa `npm run build` com `NEXT_PUBLIC_BASE_PATH=/EFAHub` e publica o diretório `out/`. As rotas demonstrativas são geradas antecipadamente para que links diretos e recarregamento de páginas funcionem no host estático.

## Teste local

Para desenvolver localmente, use `npm.cmd run dev`. Para conferir a exportação de Pages, execute `npm.cmd run build` com `NEXT_PUBLIC_BASE_PATH=/EFAHub`; o artefato estático resultante fica em `out/`. Não use `next start` para servir o export estático.
