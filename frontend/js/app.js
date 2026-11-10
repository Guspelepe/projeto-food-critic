const SUPABASE_URL = 'https://axsuovcijbumfgltjylh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4c3VvdmNpamJ1bWZnbHRqeWxoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM4MjkyOTYsImV4cCI6MjEwOTQwNTI5Nn0.ngZf5KtwAnfFtJDA-8iGPVMY1t_8-Eunf8ED4GyWs-0';
 
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let currentUser = null;
let allRestaurants = [];
let currentCategory = 'Todas';

let map = null;
let mapMarkers = [];
let userPreferences = null; 
let favoriteFoods = []; 

let tempDiet = null;
let tempAvoid = [];

const POPULAR_FOODS = [
    "Hambúrguer", "Pizza", "Sushi", "Feijoada", "Churrasco", "Lasanha", "Macarrão", "Tacos", "Burrito", "Hot Dog",
    "Sanduíche", "Salada", "Sopa", "Frango Grelhado", "Peixe", "Carne Bovina", "Carne Suína", "Costela", "Picanha", "Maminha",
    "Alcatra", "Cupim", "Frutos do Mar", "Camarão", "Lagosta", "Ostra", "Sashimi", "Temaki", "Yakisoba", "Lamen",
    "Udon", "Gyoza", "Ramen", "Curry", "Pad Thai", "Primavera", "Frango Frito", "Asa de Frango", "Batata Frita", "Onion Rings",
    "Nuggets", "Milkshake", "Açaí", "Sorvete", "Bolo", "Torta", "Pudim", "Mousse", "Brigadeiro", "Beijinho",
    "Pão de Queijo", "Coxinha", "Esfirra", "Quibe", "Empada", "Pastel", "Pizza Doce", "Crepe", "Waffle", "Panqueca",
    "Omelete", "Ovo", "Tapioca", "Cuscuz", "Polenta", "Risoto", "Nhoque", "Ravioli", "Fettuccine", "Carbonara",
    "Bolonhesa", "Pesto", "Margherita", "Calabresa", "Portuguesa", "Quatro Queijos", "Frango c/ Catupiry", "Vegetariana", "Vegana", "Comida Árabe",
    "Comida Mexicana", "Comida Chinesa", "Comida Indiana", "Comida Tailandesa", "Comida Coreana", "Comida Francesa", "Comida Italiana", "Comida Japonesa", "Comida Brasileira", "Comida Argentina",
    "Comida Peruana", "Comida Portuguesa", "Comida Espanhola", "Comida Grega", "Comida Turca", "Hambúrguer Artesanal", "Smash Burger", "Pizza Napolitana", "Sushi de Salmão", "Hot Roll",
    "Temaki de Camarão", "Yakisoba de Frango", "Ramen de Porco", "Lamen Vegano", "Feijoada Light", "Churrasco Vegano", "Lasanha de Berinjela", "Macarrão Integral", "Taco Vegano", "Burrito de Carne",
    "Cachorro Quente Completo", "Sanduíche Natural", "Salada Caesar", "Sopa de Cebola", "Frango à Parmegiana", "Filé de Peixe", "Picanha na Brasa", "Costela BBQ", "Camarão Empanado", "Polvo Grelhado",
    "Batata Rústica", "Mandioca Frita", "Pão de Alho", "Queijo Coalho", "Pastel de Carne", "Pastel de Queijo", "Coxinha Cremosa", "Bolinha de Queijo", "Brigadeiro Gourmet", "Pudim de Leite",
    "Bolo de Cenoura", "Torta de Limão", "Açaí com Granola", "Sorvete de Creme", "Milk Shake de Chocolate", "Café Gelado", "Suco Natural", "Água de Coco", "Chopp Artesanal", "Vinho Tinto"
];

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

function setBtnLoading(btn, isLoading, originalText = "Salvar") {
    if (!btn) return;
    if (isLoading) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Carregando...`;
    } else {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

// --- INICIALIZAÇÃO ---
async function initApp() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) { window.location.href = 'login.html'; return; }

    currentUser = session.user;
    const name = currentUser.user_metadata.full_name || currentUser.email.split('@')[0];
    document.getElementById('greeting-text').textContent = `Onde comer hoje, ${name}?`;
    
    await carregarPerfil(); // Isso agora carrega favoriteFoods do banco
    await carregarRestaurantes();

    if (!userPreferences || userPreferences.length === 0) {
        openModal('onboarding-modal');
    }

    // --- CORREÇÃO DA BUSCA: Dropdown sem perder o foco ---
    const searchInput = document.getElementById('search-rest');
    const searchDropdown = document.getElementById('search-dropdown');
    
    if (searchInput && searchDropdown) {
        searchInput.addEventListener('input', (e) => {
            const termo = e.target.value.toLowerCase().trim();
            if (termo.length < 1) {
                searchDropdown.classList.remove('active');
                return;
            }

            const resultados = allRestaurants.filter(rest => 
                rest.name.toLowerCase().includes(termo) || 
                (rest.category && rest.category.toLowerCase().includes(termo)) ||
                (rest.dishes && rest.dishes.some(d => d.name.toLowerCase().includes(termo)))
            ).slice(0, 5); // Limita a 5 resultados

            if (resultados.length === 0) {
                searchDropdown.innerHTML = `<div class="search-result-item" style="color:var(--text-light);">Nenhum resultado encontrado.</div>`;
            } else {
                searchDropdown.innerHTML = resultados.map(rest => `
                    <div class="search-result-item" onclick="openRestaurantDetails(${rest.id}); document.getElementById('search-dropdown').classList.remove('active'); document.getElementById('search-rest').value = '';">
                        <img src="https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=100&q=80">
                        <div>
                            <strong>${rest.name}</strong>
                            <span>${rest.category || 'Restaurante'}</span>
                        </div>
                    </div>
                `).join('');
            }
            searchDropdown.classList.add('active');
        });

        // Fecha o dropdown ao clicar fora
        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && !searchDropdown.contains(e.target)) {
                searchDropdown.classList.remove('active');
            }
        });
    }

    await carregarSugestoesSidebar();
    await carregarRecomendacoes();
    await carregarFeed();
    await carregarDiario();
}
initApp();

async function fazerLogout() { 
    try { await supabaseClient.auth.signOut(); window.location.href = 'login.html'; } 
    catch (err) { window.location.href = 'login.html'; }
}

// --- PERFIL E TAGS ---
async function carregarPerfil() {
    const { data } = await supabaseClient.from('profiles').select('*').eq('id', currentUser.id).maybeSingle();
    
    if (data) {
        const nome = data.full_name || currentUser.email.split('@')[0];
        const avatarUrl = data.avatar_url || `https://ui-avatars.com/api/?name=${nome}&background=ff5a36&color=fff`;
        document.getElementById('sidebar-user-name').textContent = nome;
        document.getElementById('sidebar-user-email').textContent = currentUser.email;
        document.getElementById('sidebar-avatar-img').src = avatarUrl;
        document.getElementById('profile-name-display').textContent = nome;
        document.getElementById('profile-email').textContent = currentUser.email;
        document.getElementById('profile-avatar-img').src = avatarUrl;

        // Puxa as preferências do banco
        userPreferences = data.food_preferences || [];
        
        // Puxa as tags de comidas favoritas do banco (NOVA COLUNA)
        favoriteFoods = data.favorite_foods || [];
        
        renderizarFavoritos();
    }
}

function openTagSelectionModal() {
    if (favoriteFoods.length >= 5) {
        return showToast("Você já tem 5 comidas favoritas. Remova alguma para adicionar outra.", "error");
    }
    document.getElementById('search-tag-input').value = '';
    renderizarTagsDisponiveis();
    openModal('tag-selection-modal');
}

function renderizarTagsDisponiveis() {
    const grid = document.getElementById('tags-grid');
    const termo = document.getElementById('search-tag-input').value.toLowerCase();
    
    const disponiveis = POPULAR_FOODS.filter(f => 
        !favoriteFoods.includes(f) && f.toLowerCase().includes(termo)
    );

    if (disponiveis.length === 0) {
        grid.innerHTML = `<p class="text-light" style="grid-column: 1/-1; text-align: center;">Nenhuma opção encontrada. Adicione uma personalizada abaixo!</p>`;
        return;
    }

    grid.innerHTML = disponiveis.map(food => `
        <div class="tag-option" onclick="selecionarTagDisponivel('${food}')">${food}</div>
    `).join('');
}

function filtrarTagsDisponiveis() { renderizarTagsDisponiveis(); }

async function validarEAdicionarTag(newTag) {
    if (!newTag) return;
    if (favoriteFoods.length >= 5) return showToast("Limite de 5 comidas favoritas atingido.", "error");
    if (favoriteFoods.some(t => t.toLowerCase() === newTag.toLowerCase())) return showToast("Você já adicionou essa comida.", "error");

    // ANTI-CONFLITO
    const tagLower = newTag.toLowerCase();
    const prefsLower = userPreferences.map(p => p.toLowerCase());
    const conflitos = {
        'sushi': ['sem japonesa', 'vegano', 'vegetariano'], 'temaki': ['sem japonesa', 'vegano', 'vegetariano'],
        'yakisoba': ['sem japonesa', 'vegetariano'], 'hamburguer': ['sem gordurosa', 'vegano', 'vegetariano'],
        'burger': ['sem gordurosa', 'vegano', 'vegetariano'], 'pizza': ['sem gordurosa', 'vegano'],
        'carne': ['vegano', 'vegetariano', 'sem gordurosa'], 'churrasco': ['vegano', 'vegetariano', 'sem gordurosa'], 'bacon': ['vegano', 'vegetariano']
    };

    let conflitoDetectado = null;
    for (const [termo, restricoes] of Object.entries(conflitos)) {
        if (tagLower.includes(termo)) {
            const restricaoEncontrada = restricoes.find(r => prefsLower.includes(r));
            if (restricaoEncontrada) { conflitoDetectado = restricaoEncontrada; break; }
        }
    }

    if (conflitoDetectado) {
        let nomeRestricao = conflitoDetectado.replace('sem ', '').replace('japonesa', 'Comida Japonesa').replace('gordurosa', 'Comida Gordurosa');
        if (conflitoDetectado === 'vegano') nomeRestricao = 'Vegano';
        if (conflitoDetectado === 'vegetariano') nomeRestricao = 'Vegetariano';
        return showToast(`Conflito! Você evita ${nomeRestricao}, mas quer adicionar "${newTag}".`, "error");
    }

    favoriteFoods.push(newTag);
    await salvarFavoritosBanco();
    renderizarTagsDisponiveis(); 
}

function selecionarTagDisponivel(food) { validarEAdicionarTag(food); }

function addCustomTag() {
    const input = document.getElementById('new-fav-tag');
    validarEAdicionarTag(input.value.trim());
    input.value = '';
}

async function removerFavorito(index) {
    favoriteFoods.splice(index, 1);
    await salvarFavoritosBanco();
    renderizarTagsDisponiveis();
}

async function salvarFavoritosBanco() {
    renderizarFavoritos();
    // SALVA NO BANCO DE DADOS
    try {
        await supabaseClient.from('profiles').update({ favorite_foods: favoriteFoods }).eq('id', currentUser.id);
        carregarSugestoesSidebar();
        carregarFeed();
    } catch (e) {
        console.error("Erro ao salvar tags", e);
    }
}

function renderizarFavoritos() {
    const container = document.getElementById('favorite-tags-container');
    if (!container) return; 
    
    container.innerHTML = favoriteFoods.map((tag, index) => `
        <span class="fav-tag">${tag} <i class="fas fa-times" onclick="removerFavorito(${index})" title="Remover"></i></span>
    `).join('');
}

// --- FILTROS ---
function filtrarRestaurantes(rests, prefs) {
    if (!prefs || prefs.length === 0) return rests; 
    try {
        return rests.filter(r => {
            if (prefs.includes('Vegano') && (!r.dishes || !r.dishes.some(d => d.is_vegan))) return false;
            if (prefs.includes('Vegetariano') && (!r.dishes || !r.dishes.some(d => d.is_vegan || d.is_vegetarian))) return false;
            if (prefs.includes('Sem Japonesa') && r.category === 'Japonesa') return false;
            if (prefs.includes('Sem Gordurosa') && r.category === 'Hamburguer') return false; 
            if (prefs.includes('Sem Doce') && r.category === 'Doces') return false;
            return true;
        });
    } catch (err) { return rests; }
}

function restauranteTemTagFavorita(rest) {
    if (!favoriteFoods || favoriteFoods.length === 0) return false;
    const categoria = (rest.category || '').toLowerCase();
    const nomesPratos = (rest.dishes || []).map(d => d.name.toLowerCase());
    const nomeRest = (rest.name || '').toLowerCase();
    return favoriteFoods.some(fav => {
        const f = fav.toLowerCase();
        return categoria.includes(f) || nomeRest.includes(f) || nomesPratos.some(prato => prato.includes(f));
    });
}

async function surpreendaMe() {
    const validRestaurants = filtrarRestaurantes(allRestaurants, userPreferences);
    if (validRestaurants.length === 0) return showToast("Nenhum restaurante atende às suas restrições.", "error");

    let opcoesFinais = validRestaurants.filter(r => restauranteTemTagFavorita(r));
    if (opcoesFinais.length === 0) opcoesFinais = validRestaurants;

    const escolhido = opcoesFinais[Math.floor(Math.random() * opcoesFinais.length)];
    const motivo = restauranteTemTagFavorita(escolhido) ? ` (Você ama ${escolhido.category}!)` : '';
    showToast(`Que tal comer em ${escolhido.name} hoje?${motivo}`, "success");
    openRestaurantDetails(escolhido.id);
}

// --- FEED ---
async function carregarSugestoesSidebar() {
    let validRestaurants = filtrarRestaurantes(allRestaurants, userPreferences);
    validRestaurants.sort((a, b) => (restauranteTemTagFavorita(b) ? 1 : 0) - (restauranteTemTagFavorita(a) ? 1 : 0));

    const sorteados = validRestaurants.slice(0, 4);
    const container = document.getElementById('sidebar-suggestions');
    if (sorteados.length === 0) { container.innerHTML = `<p class="text-light" style="font-size:12px;">Sem sugestões.</p>`; return; }

    container.innerHTML = sorteados.map(rest => {
        let img = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=100&q=80';
        if (rest.reviews && rest.reviews.length > 0 && rest.reviews[0].food_photo_url) img = rest.reviews[0].food_photo_url;
        return `
            <div class="suggestion-item">
                <img src="${img}" style="border-radius: 8px;">
                <div class="suggestion-info">
                    <strong>${rest.name}</strong><span>${rest.category || 'Restaurante'}</span>
                </div>
                <button class="btn-follow" onclick="openRestaurantDetails(${rest.id})">Ver</button>
            </div>
        `;
    }).join('');
}

async function carregarFeed() {
    const feedContainer = document.getElementById('home-feed-container');
    if (!feedContainer) return;
    try {
        const validRestaurants = filtrarRestaurantes(allRestaurants, userPreferences);
        let validIds = validRestaurants.length > 0 ? validRestaurants.map(r => r.id) : [];
        if (validIds.length === 0) { feedContainer.innerHTML = `<p class="text-light text-center">Sem avaliações para suas preferências.</p>`; return; }

        const { data, error } = await supabaseClient.from('reviews')
            .select(`*, restaurants (id, name, category), dishes (name), profiles (full_name, avatar_url)`)
            .in('restaurant_id', validIds).order('created_at', { ascending: false }).limit(15);
    
        if (error) throw error;
        if (!data || data.length === 0) { feedContainer.innerHTML = `<p class="text-light text-center">Nenhuma avaliação ainda.</p>`; return; }
    
        if (favoriteFoods.length > 0) {
            data.sort((a, b) => {
                const aFav = restauranteTemTagFavorita({category: a.restaurants?.category, name: a.restaurants?.name, dishes: [a.dishes]}) ? 1 : 0;
                const bFav = restauranteTemTagFavorita({category: b.restaurants?.category, name: b.restaurants?.name, dishes: [b.dishes]}) ? 1 : 0;
                return bFav - aFav;
            });
        }

        feedContainer.innerHTML = data.slice(0, 10).map(r => {
            const preco = r.price_paid ? Number(r.price_paid).toFixed(2).replace('.', ',') : '0,00';
            const autor = r.profiles?.full_name || 'Alguém';
            const avatarAutor = r.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${autor}&background=random`;
            const dataReview = new Date(r.created_at);
            const diffDias = Math.floor((new Date() - dataReview) / (1000 * 60 * 60 * 24));
            const tempo = diffDias === 0 ? 'hoje' : (diffDias === 1 ? 'ontem' : `há ${diffDias} dias`);

            const btnEdit = r.user_id === currentUser.id 
                ? `<button class="btn-edit-review" onclick="event.stopPropagation(); abrirModalEditarReview(${r.id})"><i class="fas fa-pen"></i></button>` 
                : '';

            return `
                <div class="feed-card">
                    <div class="feed-image-wrapper" onclick="openRestaurantDetails(${r.restaurant_id})">
                        <img src="${r.food_photo_url || 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0'}" alt="${r.dishes?.name}">
                        <div class="feed-overlay">
                            <h3 class="card-title">${r.dishes?.name || 'Prato Especial'}</h3>
                            <div class="feed-meta">
                                <span>R$ ${preco}</span> · <span>${r.restaurants?.name}</span> · <span class="star">★ ${r.rating}</span>
                            </div>
                        </div>
                    </div>
                    <div class="feed-author">
                        <img src="${avatarAutor}" class="avatar-small" alt="Avatar">
                        <div class="author-info">
                            <span><strong>${autor}</strong> comeu aqui ${tempo}</span>
                            <p>"${r.review_text || 'Sem comentários.'}"</p>
                        </div>
                        ${btnEdit}
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        feedContainer.innerHTML = `<p class="text-light text-center">Erro ao carregar o feed.</p>`; 
    }
}

async function carregarRestaurantes() {
    const { data, error } = await supabaseClient
        .from('restaurants').select(`id, name, category, dishes (name, is_vegetarian, is_vegan), reviews (rating, food_photo_url)`).order('name', { ascending: true });
    if (error || !data) return;
    allRestaurants = data; 
    renderizarRestaurantes();
    popularSelectRestaurantes();
}
 
function setFiltroCategoria(cat, btn) {
    currentCategory = cat;
    document.querySelectorAll('.filter-chips .chip').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    renderizarRestaurantes();
}

function renderizarRestaurantes() {
    const container = document.getElementById('restaurants-list-container');
    
    let filtrados = allRestaurants.filter(rest => {
        if (currentCategory === 'Todas') return true;
        if (currentCategory === 'Vegetariano') return rest.dishes && rest.dishes.some(d => d.is_vegetarian || d.is_vegan);
        if (currentCategory === 'Vegano') return rest.dishes && rest.dishes.some(d => d.is_vegan);
        return rest.category === currentCategory;
    });
 
    if (filtrados.length === 0) {
        container.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding: 40px;"><p class="text-light">Nenhum restaurante encontrado.</p></div>`;
        return;
    }
 
    container.innerHTML = filtrados.map(rest => {
        const pratosTexto = rest.dishes && rest.dishes.length > 0 
            ? rest.dishes.map(d => `${d.name}${d.is_vegan ? ' (Vegano)' : (d.is_vegetarian ? ' (Vegetariano)' : '')}`).join(', ')
            : 'Nenhum prato cadastrado';
        const totalReviews = rest.reviews ? rest.reviews.length : 0;
        const somaNotas = totalReviews > 0 ? rest.reviews.reduce((acc, curr) => acc + curr.rating, 0) : 0;
        const mediaNota = totalReviews > 0 ? (somaNotas / totalReviews).toFixed(1) : '--';
        let coverImg = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80'; 
        if (rest.reviews && rest.reviews.length > 0) {
            const reviewWithPhoto = rest.reviews.find(r => r.food_photo_url);
            if (reviewWithPhoto) coverImg = reviewWithPhoto.food_photo_url;
        }
        return `
            <div class="rest-card" onclick="openRestaurantDetails(${rest.id})">
                <img src="${coverImg}" class="rest-cover" alt="${rest.name}">
                <div class="rest-content">
                    <div class="rest-header"><h3>${rest.name}</h3></div>
                    <div class="rest-stats"><span class="star">★ ${mediaNota}</span> · <span>Provado por ${totalReviews}</span></div>
                    <div class="rest-category">${rest.category || 'Geral'}</div>
                    <div class="rest-dishes-text">${pratosTexto}</div>
                </div>
            </div>
        `;
    }).join('');
}

async function carregarDiario() {
    const { data } = await supabaseClient.from('reviews').select(`*, restaurants (name)`).eq('user_id', currentUser.id).order('created_at', { ascending: false });
    const grid = document.getElementById('diary-grid');
    const messageEl = document.getElementById('profile-message');
    const numReviews = data ? data.length : 0;
    document.getElementById('stat-reviews').innerText = numReviews;
    document.getElementById('stat-restaurants').innerText = data ? new Set(data.map(r => r.restaurant_id)).size : 0;
    if (numReviews === 0) messageEl.innerText = "Você ainda não tem avaliações.";
    else if (numReviews === 1) messageEl.innerText = "Você tem 1 avaliação!";
    else messageEl.innerText = `Você tem ${numReviews} avaliações!`;
    if (numReviews === 0) { 
        grid.innerHTML = `<div class="diary-empty"><div class="diary-empty-squares"><div class="dashed-square"><i class="fas fa-plus"></i></div><div class="dashed-square"><i class="fas fa-plus"></i></div><div class="dashed-square"><i class="fas fa-plus"></i></div></div><h3>Seu diário está vazio</h3></div>`; 
        return; 
    }
    grid.innerHTML = data.map(review => `<div class="grid-item" onclick="openRestaurantDetails(${review.restaurant_id})"><img src="${review.food_photo_url || ''}" alt="Foto"></div>`).join('');
}

// --- MODAIS ---
async function openRestaurantDetails(restId) {
    const dishesContainer = document.getElementById('rest-modal-dishes');
    dishesContainer.innerHTML = `<p class="text-light text-center" style="padding: 20px;">Carregando...</p>`;
    openModal('restaurant-details-modal');

    const { data: rest } = await supabaseClient.from('restaurants').select('*').eq('id', restId).single();
    const { data: reviews } = await supabaseClient.from('reviews').select(`*, dishes (id, name), profiles (full_name, avatar_url)`).eq('restaurant_id', restId).order('created_at', { ascending: false });

    let coverImg = 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=800&q=80';
    if (reviews && reviews.length > 0 && reviews.find(r => r.food_photo_url)) coverImg = reviews.find(r => r.food_photo_url).food_photo_url;
    
    document.getElementById('rest-modal-img').src = coverImg;
    document.getElementById('rest-modal-name').innerText = rest.name;
    document.getElementById('rest-modal-category').innerText = rest.category || 'Geral';
    
    const totalReviews = reviews ? reviews.length : 0;
    document.getElementById('rest-modal-reviews').innerText = `Provado por ${totalReviews} pessoas`;
    document.getElementById('rest-modal-rating').innerText = totalReviews > 0 ? `⭐ ${(reviews.reduce((acc, curr) => acc + curr.rating, 0) / totalReviews).toFixed(1)}` : `⭐ Sem notas`;

    if (totalReviews === 0) { dishesContainer.innerHTML = `<p class="text-light text-center" style="padding: 20px;">Nenhum prato.</p>`; return; }

    dishesContainer.innerHTML = reviews.map(r => {
        const autor = r.profiles?.full_name || 'Anônimo';
        const avatar = r.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${autor}&background=random`;
        const preco = r.price_paid ? Number(r.price_paid).toFixed(2).replace('.', ',') : '0,00';
        return `
            <div class="dish-row">
                <img src="${r.food_photo_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=200&q=80'}" class="dish-row-img">
                <div class="dish-row-info">
                    <div class="dish-row-top"><h4>${r.dishes?.name}</h4><span class="dish-row-price">R$ ${preco}</span></div>
                    <div class="dish-row-rating">⭐ ${r.rating}</div>
                    <div class="dish-row-review">"${r.review_text || 'Sem comentários.'}"</div>
                    <div class="dish-row-author"><img src="${avatar}"> por ${autor}</div>
                </div>
            </div>
        `;
    }).join('');
}

function openNewReviewForRestaurant() {
    closeModal('restaurant-details-modal');
    openNewReviewModal();
    setTimeout(() => {
        const select = document.getElementById('review-location');
        if (select) select.value = document.getElementById('rest-modal-name').innerText;
    }, 100);
}

function switchView(viewName) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(n => n.classList.remove('active'));
    document.getElementById(`view-${viewName}`).classList.add('active');
    document.querySelectorAll(`.nav-btn[onclick*="'${viewName}'"]`).forEach(b => b.classList.add('active'));

    if (viewName === 'restaurants') {
        setTimeout(async () => {
            if (!map) { await carregarMapa(); } else { map.invalidateSize(); }
        }, 150);
    }
}
 
function openModal(id) { document.getElementById(id).classList.add('active'); document.body.style.overflow = 'hidden'; }
function closeModal(id) { document.getElementById(id).classList.remove('active'); document.body.style.overflow = ''; }

function openNewReviewModal() {
    popularSelectRestaurantes();
    document.getElementById('review-dish').value = '';
    document.getElementById('review-price').value = '';
    document.getElementById('review-text').value = '';
    document.getElementById('photo-upload').value = '';
    document.getElementById('photo-preview-area').innerHTML = `<i class="fas fa-camera"></i><span>Adicionar foto</span>`;
    document.getElementById('dish-vegetarian').checked = false;
    document.getElementById('dish-vegan').checked = false;
    document.getElementById('review-location').value = '';
    document.getElementById('review-category').value = '';
    document.getElementById('new-rest-container').style.display = 'none';
    document.getElementById('review-date').value = new Date().toISOString().split('T')[0];
    openModal('new-review-modal');
}

function popularSelectRestaurantes() {
    const select = document.getElementById('review-location');
    select.innerHTML = '<option value="" disabled selected>Selecione o restaurante...</option>';
    allRestaurants.forEach(rest => { select.innerHTML += `<option value="${rest.name}">${rest.name}</option>`; });
}

function toggleNovoRestaurante(select) {
    document.getElementById('new-rest-container').style.display = select.value === 'NEW_RESTAURANT' ? 'flex' : 'none';
}

function previewImage(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) { document.getElementById('photo-preview-area').innerHTML = `<img src="${e.target.result}">`; }
        reader.readAsDataURL(file);
    }
}
 
function applyCurrencyMask(input) {
    let value = input.value.replace(/\D/g, '');
    value = (value / 100).toFixed(2) + '';
    input.value = value.replace(".", ",");
}
 
async function saveReview() {
    const btn = document.querySelector('#new-review-modal .btn-primary.btn-block');
    const dish = document.getElementById('review-dish').value;
    const locationSelect = document.getElementById('review-location').value;
    const newRestName = document.getElementById('new-rest-name').value;
    const category = document.getElementById('review-category').value;
    const rating = parseInt(document.getElementById('review-rating').value);
    const priceText = document.getElementById('review-price').value;
    const text = document.getElementById('review-text').value;
    const file = document.getElementById('photo-upload').files[0];
    const dateInput = document.getElementById('review-date').value;
    
    let location = locationSelect === 'NEW_RESTAURANT' ? newRestName : locationSelect;
    if (!file || !dish || !location || !category) return showToast("Preencha os campos obrigatórios.", "error");
    
    setBtnLoading(btn, true, "Salvar no Diário");
 
    try {
        const compressedFile = await imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 1280, useWebWorker: true });
        const fileName = `foods/${Date.now()}.${compressedFile.name.split('.').pop()}`;
        const { error: uploadError } = await supabaseClient.storage.from('food-images').upload(fileName, compressedFile);
        if (uploadError) throw new Error("Erro no upload da foto.");
        
        const { data: publicUrl } = supabaseClient.storage.from('food-images').getPublicUrl(fileName);
 
        let { data: rest } = await supabaseClient.from('restaurants').select('id').eq('name', location).maybeSingle();
        
        let restId;
        if (rest?.id) {
            restId = rest.id;
        } else {
            // USA A NOVA RPC DO BACKEND
            const latBase = -26.2333; const lngBase = -51.0833;
            const latRandom = latBase + (Math.random() - 0.5) * 0.015;
            const lngRandom = lngBase + (Math.random() - 0.5) * 0.015;

            const { data: newRestId, error: restError } = await supabaseClient.rpc('create_restaurant', { 
                rest_name: location, 
                rest_category: category, 
                lat: latRandom, 
                lng: lngRandom 
            });
            
            if (restError) throw new Error("Erro ao criar restaurante: " + restError.message);
            restId = newRestId; // A RPC retorna o ID direto
        }
 
        let { data: dishData } = await supabaseClient.from('dishes').select('id').eq('restaurant_id', restId).eq('name', dish).maybeSingle();
        let dishId;
        if(dishData?.id) {
            dishId = dishData.id;
        } else {
            const { data: newDish, error: dishError } = await supabaseClient.from('dishes').insert([{ restaurant_id: restId, name: dish, is_vegetarian: document.getElementById('dish-vegetarian').checked, is_vegan: document.getElementById('dish-vegan').checked }]).select().single();
            if (dishError || !newDish) throw new Error("Erro ao criar prato.");
            dishId = newDish.id;
        }
 
        const { error: insertError } = await supabaseClient.from('reviews').insert([{
            user_id: currentUser.id, restaurant_id: restId, dish_id: dishId,
            food_photo_url: publicUrl.publicUrl, rating, price_paid: parseFloat(priceText.replace(',', '.')), review_text: text,
            eaten_at: new Date(dateInput).toISOString()
        }]);
 
        if (insertError) throw new Error(insertError.message);
 
        showToast("Salvo com sucesso!", "success");
        closeModal('new-review-modal');
        
        await carregarRestaurantes();
        await carregarFeed(); 
        await carregarDiario();
        if (map) carregarMapa();
 
    } catch (error) {
        showToast(error.message, "error");
    } finally {
        setBtnLoading(btn, false, "Salvar no Diário");
    }
}

// --- MAPA ---
async function carregarMapa() {
    const mapContainer = document.getElementById('map');
    if (!mapContainer || typeof L === 'undefined') return;

    if (!map) {
        map = L.map('map').setView([-26.2333, -51.0833], 14); 
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(map);
    }
    setTimeout(() => map.invalidateSize(), 100);

    const localizacoesFixas = {
        'Burger do Zé': [-26.2286, -51.0869], 'Sushi Yamato': [-26.2389, -51.0783],
        'Cantina da Nonna': [-26.2200, -51.0800], 'Churrascaria Gaúcha': [-26.2450, -51.0750],
        'Sushi União': [-26.2400, -51.0800], 'Burger da Fronteira': [-26.2250, -51.0850],
        'Pizzaria Forno a Lenha': [-26.2180, -51.0820], 'Restaurante do Porto': [-26.2420, -51.0720],
        'Vegano do Vale': [-26.2333, -51.0833]
    };

    const { data: rpcData } = await supabaseClient.rpc('get_restaurants_with_coords');
    const coordsMap = {};
    if (rpcData) rpcData.forEach(r => { coordsMap[r.id] = { lat: r.lat, lng: r.lng }; });
    
    mapMarkers.forEach(marker => map.removeLayer(marker));
    mapMarkers = [];

    allRestaurants.forEach(rest => {
        let lat = coordsMap[rest.id]?.lat;
        let lng = coordsMap[rest.id]?.lng;

        if (!lat || !lng) {
            if (localizacoesFixas[rest.name]) {
                lat = localizacoesFixas[rest.name][0]; lng = localizacoesFixas[rest.name][1];
            } else {
                lat = -26.2333 + (Math.random() - 0.5) * 0.015; lng = -51.0833 + (Math.random() - 0.5) * 0.015;
            }
        }

        if (lat && lng) {
            const marker = L.marker([lat, lng]).addTo(map);
            marker.bindPopup(`<strong>${rest.name}</strong><br>${rest.category || ''}<br>
                <button onclick="openRestaurantDetails(${rest.id})" style="margin-top:8px; cursor:pointer; background:#ff5a36; color:white; border:none; padding:6px 12px; border-radius:6px;">Ver detalhes</button>`);
            mapMarkers.push(marker);
        }
    });

    if (mapMarkers.length > 0) map.fitBounds(new L.featureGroup(mapMarkers).getBounds().pad(0.2));
}

// --- PERFIL E ONBOARDING ---
function openEditProfileModal() {
    document.getElementById('edit-profile-name').value = document.getElementById('profile-name-display').textContent;
    document.getElementById('avatar-preview-area').innerHTML = `<img src="${document.getElementById('profile-avatar-img').src}">`;
    openModal('edit-profile-modal');
}

function previewAvatar(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) { document.getElementById('avatar-preview-area').innerHTML = `<img src="${e.target.result}">`; }
        reader.readAsDataURL(file);
    }
}

async function salvarPerfil() {
    const btn = document.querySelector('#edit-profile-modal .btn-primary');
    const novoNome = document.getElementById('edit-profile-name').value;
    const file = document.getElementById('avatar-upload').files[0];
    let novaUrl = document.getElementById('profile-avatar-img').src;

    if (!novoNome) return showToast("O nome não pode ficar vazio.", "error");
    setBtnLoading(btn, true, "Salvar Alterações");

    try {
        if (file) {
            const compressedFile = await imageCompression(file, { maxSizeMB: 0.5, maxWidthOrHeight: 400, useWebWorker: true });
            const fileName = `${currentUser.id}-${Date.now()}.jpeg`;
            const { error: uploadError } = await supabaseClient.storage.from('avatars').upload(fileName, compressedFile);
            if (uploadError) throw new Error("Erro no upload da foto.");
            novaUrl = supabaseClient.storage.from('avatars').getPublicUrl(fileName).data.publicUrl;
        }

        const { error } = await supabaseClient.from('profiles').update({ full_name: novoNome, avatar_url: novaUrl }).eq('id', currentUser.id);
        if (error) throw error;

        showToast("Perfil atualizado!", "success");
        closeModal('edit-profile-modal');
        carregarPerfil();
        carregarFeed();
    } catch (error) {
        showToast(error.message, "error");
    } finally {
        setBtnLoading(btn, false, "Salvar Alterações");
    }
}

function selectSinglePreference(element, group) {
    const parent = element.parentElement;
    parent.querySelectorAll('.preference-chip').forEach(c => c.classList.remove('active'));
    element.classList.add('active');
    if (group === 'diet') tempDiet = element.getAttribute('data-value');
}

function toggleMultiPreference(element, group) {
    element.classList.toggle('active');
    const value = element.getAttribute('data-value');
    if (element.classList.contains('active')) { if (!tempAvoid.includes(value)) tempAvoid.push(value); } 
    else { tempAvoid = tempAvoid.filter(v => v !== value); }
}

async function salvarPreferencias() {
    if (!tempDiet) return showToast("Por favor, selecione sua dieta.", "error");
    const btn = document.querySelector('#onboarding-modal .btn-primary');
    setBtnLoading(btn, true, "Salvar e começar a explorar");

    try {
        const finalPrefs = [tempDiet, ...tempAvoid];
        const { error } = await supabaseClient.from('profiles').update({ food_preferences: finalPrefs }).eq('id', currentUser.id);
        if (error) throw error;

        userPreferences = finalPrefs;
        showToast("Preferências salvas com sucesso!", "success");
        closeModal('onboarding-modal');
        await carregarSugestoesSidebar();
        await carregarRecomendacoes();
        await carregarFeed();
    } catch (err) {
        showToast("Erro ao salvar preferências: " + err.message, "error");
    } finally {
        setBtnLoading(btn, false, "Salvar e começar a explorar");
    }
}

async function carregarRecomendacoes() {
    let validRestaurants = filtrarRestaurantes(allRestaurants, userPreferences);
    const recs = validRestaurants.sort((a, b) => {
        const avgA = a.reviews?.length ? a.reviews.reduce((s, r) => s + r.rating, 0) / a.reviews.length : 0;
        const avgB = b.reviews?.length ? b.reviews.reduce((s, r) => s + r.rating, 0) / b.reviews.length : 0;
        const aFav = restauranteTemTagFavorita(a) ? 10 : 0; const bFav = restauranteTemTagFavorita(b) ? 10 : 0;
        return (avgB + bFav) - (avgA + aFav);
    }).slice(0, 5);

    const container = document.getElementById('recommendations-container');
    if (recs.length === 0) { container.innerHTML = `<p class="text-light" style="font-size:12px;">Sem recomendações.</p>`; return; }
    container.innerHTML = recs.map(rec => {
        let imgUrl = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=150&q=80';
        if (rec.reviews && rec.reviews.length > 0 && rec.reviews[0].food_photo_url) imgUrl = rec.reviews[0].food_photo_url;
        return `<div class="story" onclick="openRestaurantDetails(${rec.id})"><div class="story-ring"><img src="${imgUrl}" class="story-img" alt="${rec.name}"></div><span>${rec.name}</span></div>`;
    }).join('');
}

async function abrirModalEditarReview(id) {
    const { data, error } = await supabaseClient.from('reviews').select('rating, review_text').eq('id', id).single();
    if (error || !data) return showToast("Erro ao carregar avaliação.", "error");
    
    document.getElementById('edit-review-id').value = id;
    document.getElementById('edit-review-rating').value = data.rating;
    document.getElementById('edit-review-text').value = data.review_text || '';
    openModal('edit-review-modal');
}

async function salvarEdicaoReview() {
    const btn = document.querySelector('#edit-review-modal .btn-primary');
    const id = document.getElementById('edit-review-id').value;
    const rating = parseInt(document.getElementById('edit-review-rating').value);
    const text = document.getElementById('edit-review-text').value;
    setBtnLoading(btn, true, "Atualizar Avaliação");

    try {
        const { error } = await supabaseClient.from('reviews').update({ rating: rating, review_text: text }).eq('id', id);
        if (error) throw error;
        showToast("Avaliação atualizada!", "success");
        closeModal('edit-review-modal');
        carregarFeed(); carregarDiario(); carregarRestaurantes();
    } catch (error) {
        showToast("Erro ao editar: " + error.message, "error");
    } finally {
        setBtnLoading(btn, false, "Atualizar Avaliação");
    }
}