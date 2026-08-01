# Como configurar (uma vez só)

Isso cria um link público, tipo `https://seu-usuario.github.io/aneis-pandora/`,
que mostra sempre o resultado mais recente da busca de anéis — sem dar
acesso à sua planilha, sua chave de API, nem ao resto do projeto.

**Essa pasta (`publicar-aneis`) vira um repositório Git PRÓPRIO, separado
do resto do projeto.** Nunca copie `.env` ou `credentials.json` pra cá.

## 1. Criar o repositório no GitHub

1. Acesse https://github.com/new
2. Nome sugerido: `aneis-pandora`
3. Marque como **Public** (o plano gratuito do GitHub Pages exige isso)
4. Não marque nenhuma opção de "adicionar README" — crie vazio
5. Clique em "Create repository"

## 2. Conectar essa pasta ao repositório

Copie a URL que o GitHub mostrar e rode, dentro desta pasta (`publicar-aneis`):

\`\`\`bash
cd publicar-aneis
git init
git add index.html
git commit -m "Primeira versao"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/aneis-pandora.git
git push -u origin main
\`\`\`

Se o Git pedir login, use seu usuário do GitHub e, no lugar de senha, um
**Personal Access Token** (Settings → Developer settings → Personal access
tokens → Generate new token, com permissão `repo`).

## 3. Ativar o GitHub Pages

1. No repositório, vá em **Settings → Pages**
2. Em "Source", escolha **Deploy from a branch**
3. Branch: **main**, pasta: **/ (root)**
4. Salvar

Depois de 1-2 minutos, seu link aparece ali mesmo (formato
`https://seu-usuario.github.io/aneis-pandora/`).

## 4. Testar

\`\`\`bash
npm run aneis
\`\`\`

Se aparecer "📤 Publicado no GitHub com sucesso.", espera 1-2 minutos e
recarrega o link.