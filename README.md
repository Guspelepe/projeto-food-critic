# 🍽️ FoodCritic

**Fotografe. Avalie. Descubra.**

Diário de refeições com recomendações personalizadas, mapa de restaurantes e feed social.

🌐 **Acesse o app:** [https://ronaldokaras.github.io/projeto-food-critic/](https://ronaldokaras.github.io/projeto-food-critic/)

---

## Sobre o projeto

O **FoodCritic** é uma aplicação web full-stack para registrar, avaliar e descobrir refeições. O usuário fotografa o prato, dá uma nota, escreve uma resenha e o sistema aprende as preferências alimentares para filtrar o feed, sugerir restaurantes e priorizar o que a pessoa mais gosta.

Desenvolvido como projeto acadêmico com front-end em HTML/CSS/JavaScript e back-end em **Supabase** (PostgreSQL + Auth + Storage + PostGIS).

---

## Funcionalidades

### Conta e perfil
- Cadastro e login com e-mail e senha (Supabase Auth)
- Edição de nome e foto de perfil
- Onboarding de preferências (dieta + o que evitar), com opção de pular
- Comidas favoritas (até 5 tags) com validação anti-conflito
- Diário pessoal com cards de avaliações

### Feed e descoberta
- Feed de avaliações filtrado pelas preferências
- Stories / recomendações no topo
- Busca por restaurante, categoria ou prato
- Botão **Surpreenda-me!** para sugestão aleatória
- Filtros por categoria (Hambúrguer, Japonesa, Italiana, Vegano…)

### Avaliações
- Registrar refeição com foto, prato, preço, data, nota e comentário
- Editar avaliação completa (foto, prato, preço, data, nota, texto)
- Excluir com **Desfazer** (toast de 5 segundos)
- **Comi de novo** — repete dados de uma refeição anterior
- Compressão de imagem no client antes do upload

### Mapa
- Mapa interativo (Leaflet + OpenStreetMap)
- Coordenadas via PostGIS (`get_restaurants_with_coords`)

### UX (heurísticas de Nielsen)
- Fechar modal com `Esc`, clique no overlay ou botão Cancelar
- Aviso de alterações não salvas
- Atalhos: `N` (nova avaliação), `/` (busca), `Ctrl+Enter` (salvar)
- Drag and drop de foto
- Layout responsivo (mobile + desktop estilo Instagram)

---

## Tecnologias

| Camada | Stack |
|--------|--------|
| Front-end | HTML5, CSS3, JavaScript (vanilla) |
| UI | Font Awesome, Google Fonts (Fraunces + Nunito Sans) |
| Mapa | Leaflet + OpenStreetMap |
| Back-end | Supabase (PostgreSQL, Auth, Storage, RLS) |
| Geo | PostGIS |
| Deploy | GitHub Pages |

---

## Estrutura do repositório

```text
projeto-food-critic/
├── index.html          # App principal (após login)
├── login.html          # Tela de entrada
├── register.html       # Cadastro
├── css/
│   └── style.css
├── js/
│   ├── app.js          # Lógica do app
│   └── auth.js         # Login / cadastro / sessão
└── README.md
```

---

## Como rodar localmente

1. Clone o repositório:
   ```bash
   git clone https://github.com/ronaldokaras/projeto-food-critic.git
   cd projeto-food-critic
   ```

2. Abra com um servidor local (recomendado, por causa de módulos/CORS):
   ```bash
   # Python
   python -m http.server 5500

   # ou VS Code / Live Server
   ```

3. Acesse `http://localhost:5500/login.html`.

> O app usa o projeto Supabase já configurado nas constantes de `js/app.js` e `js/auth.js`. Para usar seu próprio projeto, troque `SUPABASE_URL` e `SUPABASE_ANON_KEY`.

---

## Back-end (Supabase)

Principais recursos:

- **Tabelas:** `profiles`, `restaurants`, `dishes`, `reviews`
- **Auth:** e-mail/senha + trigger que cria perfil em `profiles`
- **Storage:** buckets `food-images` e `avatars`
- **RLS:** leitura pública de feed/restaurantes; insert/update/delete de reviews só do dono
- **RPCs:**
  - `get_restaurants_with_coords` — lat/lng para o mapa
  - `create_restaurant` — cria local com ponto geográfico (opcional)
  - `get_recommendations_for_user` — ranking por média (disponível no banco)

Preferências e favoritos ficam em `profiles.food_preferences` e `profiles.favorite_foods` (`text[]`).

---

## Link do projeto

| Ambiente | URL |
|----------|-----|
| **Produção (GitHub Pages)** | [https://ronaldokaras.github.io/projeto-food-critic/](https://ronaldokaras.github.io/projeto-food-critic/) |
| Repositório | [https://github.com/ronaldokaras/projeto-food-critic](https://github.com/ronaldokaras/projeto-food-critic) |

---

## Autores

Projeto desenvolvido para fins acadêmicos.

---

## Licença

Uso educacional. Código do front disponível neste repositório.
