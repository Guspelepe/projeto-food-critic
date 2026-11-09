const SUPABASE_URL = 'https://axsuovcijbumfgltjylh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4c3VvdmNpamJ1bWZnbHRqeWxoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM4MjkyOTYsImV4cCI6MjEwOTQwNTI5Nn0.ngZf5KtwAnfFtJDA-8iGPVMY1t_8-Eunf8ED4GyWs-0';
 
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let currentUser = null;
let allRestaurants = [];
let currentCategory = 'Todas';

let map = null;
let mapMarkers = [];
let userPreferences = null; 
let favoriteFoods = []; // Guarda as comidas favoritas (agora via localStorage)

// Variáveis do Onboarding
let tempDiet = null;
let tempAvoid = [];

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

// --- INICIALIZAÇÃO ---
async function initApp() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) { window.location.href = 'login.html'; return; }

    currentUser = session.user;
    const name = currentUser.user_metadata.full_name || currentUser.email.split('@')[0];
    document.getElementById('greeting-text').textContent = `Onde comer hoje, ${name}?`;
    
    // Carrega favoritos do LocalStorage
    const savedFavs = localStorage.getItem(`favs_${currentUser.id}`);
    favoriteFoods = savedFavs ? JSON.parse(savedFavs) : [];
    
    await carregarPerfil(); 
    await carregarRestaurantes();

    // Se for usuário novo e não tiver preferências, abre modal de onboarding
    if (!userPreferences || userPreferences.length === 0) {
        openModal('onboarding-modal');
    }

    await carregarSugestoesSidebar();
    await carregarRecomendacoes();
    await carregarFeed();
    await carregarDiario();
}
initApp();

async function fazerLogout() { 
    // Limpa as tags do localStorage ao sair? (Opcional, mas mantém se quiser que persistam)
    // localStorage.removeItem(`favs_${currentUser.id}`);
    await supabaseClient.auth.signOut(); 
}

// --- SISTEMA DE PREFERÊNCIAS E TAGS ---
async function carregarPerfil() {
    const { data } = await supabaseClient.from('profiles').select('*').eq('id', currentUser.id).maybeSingle();
    
    if (data) {
        // 1. Nome e Avatar
        const nome = data.full_name || currentUser.email.split('@')[0];
        const avatarUrl = data.avatar_url || `https://ui-avatars.com/api/?name=${nome}&background=ff5a36&color=fff`;
        document.getElementById('sidebar-user-name').textContent = nome;
        document.getElementById('sidebar-user-email').textContent = currentUser.email;
        document.getElementById('sidebar-avatar-img').src = avatarUrl;
        document.getElementById('profile-name-display').textContent = nome;
        document.getElementById('profile-email').textContent = currentUser.email;
        document.getElementById('profile-avatar-img').src = avatarUrl;

        // 2. Preferências (Onboarding) - Puxadas do banco
        let prefs = data.food_preferences || [];
        if (typeof prefs === 'string') {
            if (prefs.startsWith('{') && prefs.endsWith('}')) {
                prefs = prefs.slice(1, -1).split(',').map(s => s.replace(/"/g, '').trim());
            } else if (prefs !== '') {
                prefs = prefs.split(',').map(s => s.trim());
            }
        }
        userPreferences = Array.isArray(prefs) ? prefs : [];

        // 3. Renderiza as tags favoritas (do localStorage)
        renderizarFavoritos();
    }
}

// --- LÓGICA DAS TAGS DE COMIDA FAVORITA (LOCALSTORAGE) ---
function renderizarFavoritos() {
    const container = document.getElementById('favorite-tags-container');
    const inputGroup = document.getElementById('add-tag-group');
    const warning = document.getElementById('tag-limit-warning');

    if (!container) return; // Caso a view não tenha sido carregada ainda

    container.innerHTML = favoriteFoods.map((tag, index) => `
        <span class="fav-tag">
            ${tag} 
            <i class="fas fa-times" onclick="removerFavorito(${index})" title="Remover"></i>
        </span>
    `).join('');

    if (favoriteFoods.length >= 5) {
        inputGroup.style.display = 'none';
        warning.style.display = 'block';
    } else {
        inputGroup.style.display = 'flex';
        warning.style.display = 'none';
    }
}

function addFavoriteTag() {
    const input = document.getElementById('new-fav-tag');
    const newTag = input.value.trim();

    if (!newTag) return;
    if (favoriteFoods.length >= 5) return showToast("Limite de 5 comidas favoritas atingido.", "error");
    if (favoriteFoods.some(t => t.toLowerCase() === newTag.toLowerCase())) return showToast("Você já adicionou essa comida.", "error");

    // 🚨 SISTEMA ANTI-CONFLITO 🚨
    const tagLower = newTag.toLowerCase();
    const prefsLower = userPreferences.map(p => p.toLowerCase());

    const conflitos = {
        'sushi': ['sem japonesa', 'vegano', 'vegetariano'],
        'temaki': ['sem japonesa', 'vegano', 'vegetariano'],
        'yakisoba': ['sem japonesa', 'vegetariano'],
        'hamburguer': ['sem gordurosa', 'vegano', 'vegetariano'],
        'burger': ['sem gordurosa', 'vegano', 'vegetariano'],
        'pizza': ['sem gordurosa', 'vegano'],
        'carne': ['vegano', 'vegetariano', 'sem gordurosa'],
        'churrasco': ['vegano', 'vegetariano', 'sem gordurosa'],
        'bacon': ['vegano', 'vegetariano']
    };

    let conflitoDetectado = null;

    for (const [termo, restricoes] of Object.entries(conflitos)) {
        if (tagLower.includes(termo)) {
            const restricaoEncontrada = restricoes.find(r => prefsLower.includes(r));
            if (restricaoEncontrada) {
                conflitoDetectado = restricaoEncontrada;
                break;
            }
        }
    }

    if (conflitoDetectado) {
        let nomeRestricao = conflitoDetectado.replace('sem ', '').replace('japonesa', 'Comida Japonesa').replace('gordurosa', 'Comida Gordurosa');
        if (conflitoDetectado === 'vegano') nomeRestricao = 'Vegano';
        if (conflitoDetectado === 'vegetariano') nomeRestricao = 'Vegetariano';

        return showToast(`Conflito! Você adicionou "${newTag}" mas nas suas preferências diz que evita ${nomeRestricao}.`, "error");
    }

    // Se passou, adiciona e salva localmente
    favoriteFoods.push(newTag);
    salvarFavoritosLocal();
    input.value = '';
}

function removerFavorito(index) {
    favoriteFoods.splice(index, 1);
    salvarFavoritosLocal();
}

function salvarFavoritosLocal() {
    renderizarFavoritos(); // Atualiza a tela na hora
    // Salva no navegador vinculado ao ID do usuário
    localStorage.setItem(`favs_${currentUser.id}`, JSON.stringify(favoriteFoods));
    
    // Recarrega as telas para refletir as novas tags
    carregarSugestoesSidebar();
    carregarFeed();
}

// --- FILTRO E INTELIGÊNCIA DE RECOMENDAÇÃO ---
function filtrarRestaurantes(rests, prefs) {
    if (!prefs || prefs.length === 0) return rests; 

    try {
        return rests.filter(r => {
            // 1. Filtro Dieta (Obrigatório)
            if (prefs.includes('Vegano')) {
                if (!r.dishes || !r.dishes.some(d => d.is_vegan)) return false;
            } else if (prefs.includes('Vegetariano')) {
                if (!r.dishes || !r.dishes.some(d => d.is_vegan || d.is_vegetarian)) return false;
            }

            // 2. Filtro "O que Evitar"
            if (prefs.includes('Sem Japonesa') && r.category === 'Japonesa') return false;
            if (prefs.includes('Sem Gordurosa') && r.category === 'Hamburguer') return false; 
            if (prefs.includes('Sem Doce') && r.category === 'Doces') return false;
            if (prefs.includes('Sem Apimentada') && r.category === 'Apimentada') return false;
            if (prefs.includes('Sem Frutos do Mar') && r.category === 'Frutos do Mar') return false;

            return true;
        });
    } catch (err) {
        return rests;
    }
}

// Verifica se o restaurante bate com alguma tag favorita
function restauranteTemTagFavorita(rest) {
    if (!favoriteFoods || favoriteFoods.length === 0) return false;
    
    const categoria = (rest.category || '').toLowerCase();
    const nomesPratos = (rest.dishes || []).map(d => d.name.toLowerCase());
    const nomeRest = (rest.name || '').toLowerCase();

    return favoriteFoods.some(fav => {
        const f = fav.toLowerCase();
        return categoria.includes(f) || 
               nomeRest.includes(f) || 
               nomesPratos.some(prato => prato.includes(f));
    });
}

// --- BOTÃO SURPREENDA-ME ---
async function surpreendaMe() {
    const validRestaurants = filtrarRestaurantes(allRestaurants, userPreferences);
    
    if (validRestaurants.length === 0) {
        return showToast("Nenhum restaurante atende às suas restrições.", "error");
    }

    let opcoesFinais = validRestaurants.filter(r => restauranteTemTagFavorita(r));
    if (opcoesFinais.length === 0) {
        opcoesFinais = validRestaurants;
    }

    const escolhido = opcoesFinais[Math.floor(Math.random() * opcoesFinais.length)];
    const motivo = restauranteTemTagFavorita(escolhido) ? ` (Você ama ${escolhido.category}!)` : '';
    
    showToast(`Que tal comer em ${escolhido.name} hoje?${motivo}`, "success");
    openRestaurantDetails(escolhido.id);
}

// --- FEED E RESTAURANTES ---
async function carregarSugestoesSidebar() {
    let validRestaurants = filtrarRestaurantes(allRestaurants, userPreferences);
    
    // Puxa os favoritos para o topo da sidebar
    validRestaurants.sort((a, b) => {
        const aFav = restauranteTemTagFavorita(a) ? 1 : 0;
        const bFav = restauranteTemTagFavorita(b) ? 1 : 0;
        return bFav - aFav;
    });

    const sorteados = validRestaurants.slice(0, 4);
    const container = document.getElementById('sidebar-suggestions');
    
    if (sorteados.length === 0) {
        container.innerHTML = `<p class="text-light" style="font-size:12px;">Sem sugestões no momento.</p>`;
        return;
    }

    container.innerHTML = sorteados.map(rest => {
        let img = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=100&q=80';
        if (rest.reviews && rest.reviews.length > 0 && rest.reviews[0].food_photo_url) {
            img = rest.reviews[0].food_photo_url;
        }
        return `
            <div class="suggestion-item">
                <img src="${img}" style="border-radius: 8px;">
                <div class="suggestion-info">
                    <strong>${rest.name}</strong>
                    <span>${rest.category || 'Restaurante'}</span>
                </div>
                <button class="btn-follow" onclick="openRestaurantDetails(${rest.id})">Ver</button>
            </div>
        `;
    }).join('');
}

async function carregarRecomendacoes() {
    let validRestaurants = filtrarRestaurantes(allRestaurants, userPreferences);
    
    const recs = validRestaurants.sort((a, b) => {
        const avgA = a.reviews?.length ? a.reviews.reduce((s, r) => s + r.rating, 0) / a.reviews.length : 0;
        const avgB = b.reviews?.length ? b.reviews.reduce((s, r) => s + r.rating, 0) / b.reviews.length : 0;
        
        const aFav = restauranteTemTagFavorita(a) ? 10 : 0;
        const bFav = restauranteTemTagFavorita(b) ? 10 : 0;

        return (avgB + bFav) - (avgA + aFav);
    }).slice(0, 5);

    const container = document.getElementById('recommendations-container');
    if (recs.length === 0) { 
        container.innerHTML = `<p class="text-light" style="font-size:12px;">Sem recomendações no momento.</p>`; 
        return; 
    }
    
    const storiesHTML = recs.map(rec => {
        let imgUrl = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=150&q=80';
        if (rec.reviews && rec.reviews.length > 0 && rec.reviews[0].food_photo_url) {
            imgUrl = rec.reviews[0].food_photo_url;
        }
        return `
            <div class="story" onclick="openRestaurantDetails(${rec.id})">
                <div class="story-ring"><img src="${imgUrl}" class="story-img" alt="${rec.name}"></div>
                <span>${rec.name}</span>
            </div>
        `;
    });
    container.innerHTML = storiesHTML.join('');
}

async function carregarFeed() {
    const feedContainer = document.getElementById('home-feed-container');
    if (!feedContainer) return;

    try {
        const validRestaurants = filtrarRestaurantes(allRestaurants, userPreferences);
        let validIds = validRestaurants.length > 0 ? validRestaurants.map(r => r.id) : [];

        if (validIds.length === 0) {
            feedContainer.innerHTML = `<div class="text-center" style="padding: 40px;"><p class="text-light">Nenhuma avaliação encontrada para suas preferências.</p></div>`;
            return;
        }

        const { data, error } = await supabaseClient.from('reviews')
            .select(`*, restaurants (id, name, category), dishes (name), profiles (full_name, avatar_url)`)
            .in('restaurant_id', validIds)
            .order('created_at', { ascending: false })
            .limit(15);
    
        if (error) throw error;

        if (!data || data.length === 0) { 
            feedContainer.innerHTML = `<div class="text-center" style="padding: 40px;"><p class="text-light">Nenhuma avaliação ainda.</p></div>`; 
            return; 
        }
    
        // Reordena o feed para colocar as comidas favoritas no topo
        if (favoriteFoods.length > 0) {
            data.sort((a, b) => {
                const restA = { category: a.restaurants?.category, name: a.restaurants?.name, dishes: [a.dishes] };
                const restB = { category: b.restaurants?.category, name: b.restaurants?.name, dishes: [b.dishes] };
                
                const aFav = restauranteTemTagFavorita(restA) ? 1 : 0;
                const bFav = restauranteTemTagFavorita(restB) ? 1 : 0;
                return bFav - aFav;
            });
        }

        feedContainer.innerHTML = data.slice(0, 10).map(r => {
            const preco = r.price_paid ? Number(r.price_paid).toFixed(2).replace('.', ',') : '0,00';
            const autor = r.profiles?.full_name || 'Alguém';
            const avatarAutor = r.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${autor}&background=random`;
            const dataReview = new Date(r.created_at);
            const tempo = Math.floor((new Date() - dataReview) / (1000 * 60 * 60 * 24)) === 0 ? 'hoje' : 'ontem';

            const btnEdit = r.user_id === currentUser.id 
                ? `<button class="btn-edit-review" onclick="event.stopPropagation(); openEditReviewModal(${r.id}, ${r.rating}, '${r.review_text ? r.review_text.replace(/'/g, "\\'") : ''}')"><i class="fas fa-pen"></i></button>` 
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
        feedContainer.innerHTML = `<div class="text-center" style="padding: 40px;"><p class="text-light">Ocorreu um erro ao carregar o feed.</p></div>`; 
    }
}

// --- ONBOARDING ---
function selectSinglePreference(element, group) {
    const parent = element.parentElement;
    parent.querySelectorAll('.preference-chip').forEach(c => c.classList.remove('active'));
    element.classList.add('active');
    if (group === 'diet') tempDiet = element.getAttribute('data-value');
}

function toggleMultiPreference(element, group) {
    element.classList.toggle('active');
    const value = element.getAttribute('data-value');
    if (element.classList.contains('active')) {
        if (!tempAvoid.includes(value)) tempAvoid.push(value);
    } else {
        tempAvoid = tempAvoid.filter(v => v !== value);
    }
}

async function salvarPreferencias() {
    if (!tempDiet) return showToast("Por favor, selecione sua dieta.", "error");
    const finalPrefs = [tempDiet, ...tempAvoid];

    try {
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
    }
}

// --- RESTAURANTES E DIÁRIO ---
async function carregarRestaurantes() {
    const container = document.getElementById('restaurants-list-container');
    const { data, error } = await supabaseClient
        .from('restaurants')
        .select(`id, name, category, dishes (name, is_vegetarian, is_vegan), reviews (rating, food_photo_url)`)
        .order('name', { ascending: true });
 
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
                    <div class="rest-stats"><span class="star">★ ${mediaNota}</span> · <span>Provado por ${totalReviews} pessoas</span></div>
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

// --- MODAIS E OUTRAS FUNÇÕES ---
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

    if (totalReviews === 0) {
        dishesContainer.innerHTML = `<p class="text-light text-center" style="padding: 20px;">Nenhum prato registrado.</p>`;
        return;
    }

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
            if (!map) {
                await carregarMapa();
            } else {
                map.invalidateSize();
            }
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
    select.innerHTML += `<option value="NEW_RESTAURANT" style="font-weight: bold; color: var(--primary);">+ Novo restaurante</option>`;
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
 
    try {
        const compressedFile = await imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 1280, useWebWorker: true });
        const fileName = `foods/${Date.now()}.${compressedFile.name.split('.').pop()}`;
        const { error: uploadError } = await supabaseClient.storage.from('food-images').upload(fileName, compressedFile);
        if (uploadError) throw new Error("Erro no upload.");
        
        const { data: publicUrl } = supabaseClient.storage.from('food-images').getPublicUrl(fileName);
 
        let { data: rest } = await supabaseClient.from('restaurants').select('id').eq('name', location).maybeSingle();
        
        let restId;
        if (rest?.id) {
            restId = rest.id;
        } else {
            const latBase = -26.2333;
            const lngBase = -51.0833;
            const latRandom = latBase + (Math.random() - 0.5) * 0.015;
            const lngRandom = lngBase + (Math.random() - 0.5) * 0.015;
            
            const locationWKT = `SRID=4326;POINT(${lngRandom} ${latRandom})`;

            const { data: newRest } = await supabaseClient.from('restaurants').insert([{ 
                name: location, 
                category,
                location: locationWKT
            }]).select().single();
            restId = newRest.id;
        }
 
        let { data: dishData } = await supabaseClient.from('dishes').select('id').eq('restaurant_id', restId).eq('name', dish).maybeSingle();
        let dishId = dishData?.id || (await supabaseClient.from('dishes').insert([{ restaurant_id: restId, name: dish, is_vegetarian: document.getElementById('dish-vegetarian').checked, is_vegan: document.getElementById('dish-vegan').checked }]).select().single()).data.id;
 
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
    }
}

// --- MAPA (Leaflet) ---
async function carregarMapa() {
    const mapContainer = document.getElementById('map');
    if (!mapContainer || typeof L === 'undefined') return;

    if (!map) {
        map = L.map('map').setView([-26.2333, -51.0833], 14); 
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);
    }

    setTimeout(() => map.invalidateSize(), 100);

    const localizacoesFixas = {
        'Burger do Zé': [-26.2286, -51.0869],
        'Sushi Yamato': [-26.2389, -51.0783],
        'Cantina da Nonna': [-26.2200, -51.0800],
        'Churrascaria Gaúcha': [-26.2450, -51.0750],
        'Sushi União': [-26.2400, -51.0800],
        'Burger da Fronteira': [-26.2250, -51.0850],
        'Pizzaria Forno a Lenha': [-26.2180, -51.0820],
        'Restaurante do Porto': [-26.2420, -51.0720],
        'Vegano do Vale': [-26.2333, -51.0833]
    };

    const { data: rpcData } = await supabaseClient.rpc('get_restaurants_with_coords');
    const coordsMap = {};
    if (rpcData) {
        rpcData.forEach(r => { coordsMap[r.id] = { lat: r.lat, lng: r.lng }; });
    }
    
    mapMarkers.forEach(marker => map.removeLayer(marker));
    mapMarkers = [];

    allRestaurants.forEach(rest => {
        let lat = coordsMap[rest.id]?.lat;
        let lng = coordsMap[rest.id]?.lng;

        if (!lat || !lng) {
            if (localizacoesFixas[rest.name]) {
                lat = localizacoesFixas[rest.name][0];
                lng = localizacoesFixas[rest.name][1];
            } else {
                const latBase = -26.2333;
                const lngBase = -51.0833;
                lat = latBase + (Math.random() - 0.5) * 0.015;
                lng = lngBase + (Math.random() - 0.5) * 0.015;
            }
        }

        if (lat && lng) {
            const marker = L.marker([lat, lng]).addTo(map);
            marker.bindPopup(`
                <strong>${rest.name}</strong><br>
                ${rest.category || ''}<br>
                <button onclick="openRestaurantDetails(${rest.id})" 
                        style="margin-top:8px; cursor:pointer; background:#ff5a36; color:white; border:none; padding:6px 12px; border-radius:6px;">
                    Ver detalhes
                </button>
            `);
            mapMarkers.push(marker);
        }
    });

    if (mapMarkers.length > 0) {
        const group = new L.featureGroup(mapMarkers);
        map.fitBounds(group.getBounds().pad(0.2));
    }
}

// --- EDIÇÃO DE PERFIL ---
function openEditProfileModal() {
    const nome = document.getElementById('profile-name-display').textContent;
    document.getElementById('edit-profile-name').value = nome;
    document.getElementById('avatar-preview-area').innerHTML = `<img src="${document.getElementById('profile-avatar-img').src}">`;
    openModal('edit-profile-modal');
}

function previewAvatar(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('avatar-preview-area').innerHTML = `<img src="${e.target.result}">`;
        }
        reader.readAsDataURL(file);
    }
}

async function salvarPerfil() {
    const novoNome = document.getElementById('edit-profile-name').value;
    const file = document.getElementById('avatar-upload').files[0];
    let novaUrl = document.getElementById('profile-avatar-img').src;

    if (!novoNome) return showToast("O nome não pode ficar vazio.", "error");

    try {
        if (file) {
            const options = { maxSizeMB: 0.5, maxWidthOrHeight: 400, useWebWorker: true };
            const compressedFile = await imageCompression(file, options);
            const fileName = `${currentUser.id}-${Date.now()}.jpeg`;
            
            const { error: uploadError } = await supabaseClient.storage.from('avatars').upload(fileName, compressedFile);
            if (uploadError) throw new Error("Erro no upload: " + uploadError.message);
            
            const { data: publicUrl } = supabaseClient.storage.from('avatars').getPublicUrl(fileName);
            novaUrl = publicUrl.publicUrl;
        }

        const { error } = await supabaseClient.from('profiles').update({ 
            full_name: novoNome,
            avatar_url: novaUrl
        }).eq('id', currentUser.id);

        if (error) throw error;

        showToast("Perfil atualizado!", "success");
        closeModal('edit-profile-modal');
        carregarPerfil();
        carregarFeed();

    } catch (error) {
        showToast(error.message, "error");
    }
}

// --- EDIÇÃO DE REVIEW ---
function openEditReviewModal(id, rating, text) {
    document.getElementById('edit-review-id').value = id;
    document.getElementById('edit-review-rating').value = rating;
    document.getElementById('edit-review-text').value = text;
    openModal('edit-review-modal');
}

async function salvarEdicaoReview() {
    const id = document.getElementById('edit-review-id').value;
    const rating = parseInt(document.getElementById('edit-review-rating').value);
    const text = document.getElementById('edit-review-text').value;

    try {
        const { error } = await supabaseClient.from('reviews').update({ 
            rating: rating, review_text: text 
        }).eq('id', id);

        if (error) throw error;

        showToast("Avaliação atualizada!", "success");
        closeModal('edit-review-modal');
        carregarFeed();
        carregarDiario();
        carregarRestaurantes();
    } catch (error) {
        showToast("Erro ao editar: " + error.message, "error");
    }
}