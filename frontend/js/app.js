const SUPABASE_URL = 'https://axsuovcijbumfgltjylh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4c3VvdmNpamJ1bWZnbHRqeWxoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM4MjkyOTYsImV4cCI6MjEwOTQwNTI5Nn0.ngZf5KtwAnfFtJDA-8iGPVMY1t_8-Eunf8ED4GyWs-0';
 
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let currentUser = null;
let allRestaurants = [];
let currentCategory = 'Todas';

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}

// --- INICIALIZAÇÃO SEGURA ---
async function initApp() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (!session) {
        window.location.href = 'login.html';
        return;
    }

    currentUser = session.user;
    const name = currentUser.user_metadata.full_name || currentUser.email.split('@')[0];
    
    document.getElementById('greeting-text').textContent = `Onde comer hoje, ${name}?`;
    
    // Chama as funções de carregamento
    await carregarPerfil();
    await carregarSugestoesSidebar();
    await carregarRecomendacoes();
    await carregarFeed();
    await carregarRestaurantes();
    await carregarDiario();
}

// Inicia o app
initApp();

async function fazerLogout() { await supabaseClient.auth.signOut(); }

// --- PERFIL ---
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
    }
}

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
            if (uploadError) throw new Error("Erro no upload (Crie o bucket 'avatars' no Supabase): " + uploadError.message);
            
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

// --- REVIEWS (EDITAR E EXCLUIR) ---
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

// --- FEED E RESTAURANTES ---
async function carregarSugestoesSidebar() {
    const { data } = await supabaseClient.from('restaurants').select('id, name, category, reviews (food_photo_url)').limit(4);
    if (!data) return;

    const container = document.getElementById('sidebar-suggestions');
    container.innerHTML = data.map(rest => {
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
    const container = document.getElementById('recommendations-container');
    const { data } = await supabaseClient.rpc('get_recommendations_for_user', { user_id_param: currentUser.id });
    
    if (!data || data.length === 0) { 
        container.innerHTML = `<p class="text-light" style="font-size:12px;">Sem recomendações no momento.</p>`; 
        return; 
    }
    
    const storiesHTML = await Promise.all(data.map(async (rec) => {
        const { data: review } = await supabaseClient.from('reviews').select('food_photo_url').eq('restaurant_id', rec.restaurant_id).not('food_photo_url', 'is', null).limit(1).maybeSingle();
        const imgUrl = review?.food_photo_url || 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=150&q=80';
        
        return `
            <div class="story" onclick="openRestaurantDetails(${rec.restaurant_id})">
                <div class="story-ring"><img src="${imgUrl}" class="story-img" alt="${rec.restaurant_name}"></div>
                <span>${rec.restaurant_name}</span>
            </div>
        `;
    }));
    container.innerHTML = storiesHTML.join('');
}

async function carregarFeed() {
    const feedContainer = document.getElementById('home-feed-container');
    const { data } = await supabaseClient.from('reviews')
        .select(`*, restaurants (id, name), dishes (name), profiles (full_name, avatar_url)`)
        .order('created_at', { ascending: false })
        .limit(10);
 
    if (!data || data.length === 0) { 
        feedContainer.innerHTML = `<div class="text-center" style="padding: 40px;"><p class="text-light">Nenhuma avaliação ainda.</p></div>`; 
        return; 
    }
 
    feedContainer.innerHTML = data.map(r => {
        const preco = r.price_paid ? r.price_paid.toFixed(2).replace('.', ',') : '0,00';
        const autor = r.profiles?.full_name || 'Alguém';
        const avatarAutor = r.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${autor}&background=random`;
        const dataReview = new Date(r.created_at);
        const tempo = Math.floor((new Date() - dataReview) / (1000 * 60 * 60 * 24)) === 0 ? 'hoje' : 'ontem';

        // Botão de Editar (Apenas se for o autor)
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
}

async function carregarRestaurantes() {
    const container = document.getElementById('restaurants-list-container');
    const { data } = await supabaseClient
        .from('restaurants')
        .select(`id, name, category, dishes (name, is_vegetarian, is_vegan), reviews (rating, food_photo_url)`)
        .order('name', { ascending: true });
 
    if (!data) return;
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
    
    grid.innerHTML = data.map(review => `
        <div class="grid-item" onclick="openRestaurantDetails(${review.restaurant_id})">
            <img src="${review.food_photo_url || ''}" alt="Foto">
        </div>
    `).join('');
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

    if (totalReviews === 0) {
        dishesContainer.innerHTML = `<p class="text-light text-center" style="padding: 20px;">Nenhum prato registrado.</p>`;
        return;
    }

    dishesContainer.innerHTML = reviews.map(r => {
        const autor = r.profiles?.full_name || 'Anônimo';
        const avatar = r.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${autor}&background=random`;
        return `
            <div class="dish-row">
                <img src="${r.food_photo_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=200&q=80'}" class="dish-row-img">
                <div class="dish-row-info">
                    <div class="dish-row-top"><h4>${r.dishes?.name}</h4><span class="dish-row-price">R$ ${r.price_paid.toFixed(2).replace('.', ',')}</span></div>
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
        let restId = rest?.id || (await supabaseClient.from('restaurants').insert([{ name: location, category }]).select().single()).data.id;
 
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
        carregarFeed(); carregarRestaurantes(); carregarDiario();
 
    } catch (error) {
        showToast(error.message, "error");
    }
}