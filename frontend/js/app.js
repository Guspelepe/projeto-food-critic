const SUPABASE_URL = 'https://axsuovcijbumfgltjylh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4c3VvdmNpamJ1bWZnbHRqeWxoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM4MjkyOTYsImV4cCI6MjEwOTQwNTI5Nn0.ngZf5KtwAnfFtJDA-8iGPVMY1t_8-Eunf8ED4GyWs-0';
 
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let currentUser = null;
let allRestaurants = [];
let currentCategory = 'Todas';
let deleteTimeout = null;
let currentRestaurantId = null;

// --- 0. TOASTS ---
function showToast(message, type = 'info', undoAction = null) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    
    if (undoAction) {
        const btn = document.createElement('button');
        btn.innerText = 'Desfazer';
        btn.style.cssText = 'margin-left:15px; background:none; border:none; color:var(--primary); font-weight:bold; cursor:pointer; text-decoration:underline;';
        btn.onclick = () => { undoAction(); toast.remove(); };
        toast.appendChild(btn);
    }

    container.appendChild(toast);
    if (!undoAction) setTimeout(() => toast.remove(), 3500);
}

// --- 1. AUTH ---
supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (!session) {
        window.location.href = 'login.html';
    } else {
        currentUser = session.user;
        document.getElementById('profile-email').textContent = currentUser.email;
        document.getElementById('greeting-text').textContent = `Onde comer hoje, ${currentUser.email.split('@')[0]}?`;
        
        carregarRecomendacoes();
        carregarFeed();
        carregarRestaurantes();
        carregarDiario();
    }
});
 
async function fazerLogout() { await supabaseClient.auth.signOut(); }

// --- 2. RENDERIZAÇÃO ---

// STORIES (Recomendações)
async function carregarRecomendacoes() {
    const container = document.getElementById('recommendations-container');
    const { data } = await supabaseClient.rpc('get_recommendations_for_user', { user_id_param: currentUser.id });
    
    if (!data || data.length === 0) { 
        container.innerHTML = `<p class="text-light">Sem recomendações no momento.</p>`; 
        return; 
    }
    
    const storiesHTML = await Promise.all(data.map(async (rec) => {
        // Tenta achar uma foto real da review
        const { data: review } = await supabaseClient.from('reviews').select('food_photo_url').eq('restaurant_id', rec.restaurant_id).not('food_photo_url', 'is', null).limit(1).maybeSingle();
        
        // Fallback atualizado
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

// FEED (HOME)
async function carregarFeed() {
    const feedContainer = document.getElementById('home-feed-container');
    const { data } = await supabaseClient.from('reviews')
        .select(`*, restaurants (id, name), dishes (name), profiles (full_name)`)
        .order('created_at', { ascending: false })
        .limit(10);
 
    if (!data || data.length === 0) { 
        feedContainer.innerHTML = `<div class="text-center" style="padding: 40px;"><p class="text-light">Nenhuma avaliação ainda. Seja o primeiro!</p></div>`; 
        return; 
    }
 
    feedContainer.innerHTML = data.map(r => {
        const preco = r.price_paid ? r.price_paid.toFixed(2).replace('.', ',') : '0,00';
        const autor = r.profiles?.full_name || 'Alguém';
        const dataReview = new Date(r.created_at);
        const diffDias = Math.floor((new Date() - dataReview) / (1000 * 60 * 60 * 24));
        const tempo = diffDias === 0 ? 'hoje' : (diffDias === 1 ? 'ontem' : `em ${dataReview.getDate()}/${dataReview.getMonth()+1}`);

        return `
            <div class="feed-card">
                <!-- Clicar na imagem abre o modal do RESTAURANTE -->
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
                    <img src="https://ui-avatars.com/api/?name=${autor}&background=random" class="avatar-small" alt="Avatar">
                    <div class="author-info">
                        <span><strong>${autor}</strong> comeu aqui ${tempo}</span>
                        <p>"${r.review_text || 'Sem comentários.'}"</p>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// RESTAURANTES (GUIA)
async function carregarRestaurantes() {
    const container = document.getElementById('restaurants-list-container');
    // Adicionado 'food_photo_url' no select de reviews
    const { data, error } = await supabaseClient
        .from('restaurants')
        .select(`id, name, category, dishes (name, is_vegetarian, is_vegan), reviews (rating, food_photo_url)`)
        .order('name', { ascending: true });
 
    if (error || !data) { container.innerHTML = `<p class="text-light">Erro ao carregar.</p>`; return; }
    allRestaurants = data;
    renderizarRestaurantes();
    popularSelectRestaurantes();
}
 
function renderizarRestaurantes() {
    const container = document.getElementById('restaurants-list-container');
    let filtrados = allRestaurants.filter(rest => {
        const matchCategory = currentCategory === 'Todas' || rest.category === currentCategory || 
            (currentCategory === 'Vegetariano' && rest.dishes.some(d => d.is_vegetarian)) ||
            (currentCategory === 'Vegano' && rest.dishes.some(d => d.is_vegan));
        return matchCategory;
    });
 
    if (filtrados.length === 0) {
        container.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding: 40px;"><p class="text-light">Nenhum restaurante encontrado.</p></div>`;
        return;
    }
 
    container.innerHTML = filtrados.map(rest => {
        const pratosTexto = rest.dishes && rest.dishes.length > 0 
            ? rest.dishes.map(d => {
                let flag = d.is_vegan ? ' (Vegano)' : (d.is_vegetarian ? ' (Vegetariano)' : '');
                return `${d.name}${flag}`;
            }).join(', ')
            : 'Nenhum prato cadastrado';
 
        const totalReviews = rest.reviews ? rest.reviews.length : 0;
        const somaNotas = totalReviews > 0 ? rest.reviews.reduce((acc, curr) => acc + curr.rating, 0) : 0;
        const mediaNota = totalReviews > 0 ? (somaNotas / totalReviews).toFixed(1) : '--';
        
        // LÓGICA DA CAPA: Pega a primeira foto de review que existir. Se não tiver, usa um placeholder.
        let coverImg = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80'; 
        if (rest.reviews && rest.reviews.length > 0) {
            const reviewWithPhoto = rest.reviews.find(r => r.food_photo_url);
            if (reviewWithPhoto) coverImg = reviewWithPhoto.food_photo_url;
        }

        return `
            <div class="rest-card" onclick="openRestaurantDetails(${rest.id})">
                <img src="${coverImg}" class="rest-cover" alt="${rest.name}">
                <div class="rest-content">
                    <div class="rest-header">
                        <h3>${rest.name}</h3>
                    </div>
                    <div class="rest-stats">
                        <span class="star">★ ${mediaNota}</span> · <span>Provado por ${totalReviews} ${totalReviews === 1 ? 'pessoa' : 'pessoas'}</span>
                    </div>
                    <div class="rest-category">${rest.category || 'Geral'}</div>
                    <div class="rest-dishes-text">${pratosTexto}</div>
                </div>
            </div>
        `;
    }).join('');
}
// DIÁRIO
async function carregarDiario() {
    const { data } = await supabaseClient.from('reviews').select(`*, restaurants (name), dishes (name)`).eq('user_id', currentUser.id).order('created_at', { ascending: false });
    const grid = document.getElementById('diary-grid');
    
    document.getElementById('stat-reviews').innerText = data ? data.length : 0;
    document.getElementById('stat-restaurants').innerText = data ? new Set(data.map(r => r.restaurant_id)).size : 0;

    if (!data || data.length === 0) { 
        grid.innerHTML = `
            <div class="diary-empty">
                <div class="diary-empty-squares">
                    <div class="dashed-square"><i class="fas fa-plus"></i></div>
                    <div class="dashed-square"><i class="fas fa-plus"></i></div>
                    <div class="dashed-square"><i class="fas fa-plus"></i></div>
                </div>
                <h3>Seu diário está vazio</h3>
                <p class="text-light">Toque no botão + depois da próxima refeição.</p>
            </div>
        `; 
        return; 
    }
    
    grid.innerHTML = data.map(review => `
        <div class="grid-item" onclick="abrirDetalhesMinhaReview(${review.id})">
            <img src="${review.food_photo_url || ''}" alt="Foto do prato">
        </div>
    `).join('');
    window.minhasReviews = data;
}

// --- 3. O NOVO MODAL DE RESTAURANTE ---
async function openRestaurantDetails(restId) {
    currentRestaurantId = restId;
    const modal = document.getElementById('restaurant-details-modal');
    const dishesContainer = document.getElementById('rest-modal-dishes');
    
    dishesContainer.innerHTML = `<p class="text-light text-center">Carregando pratos...</p>`;
    openModal('restaurant-details-modal');

    // Busca info do Restaurante
    const { data: rest } = await supabaseClient.from('restaurants').select('*').eq('id', restId).single();
    
    // Busca as Reviews
    const { data: reviews } = await supabaseClient.from('reviews')
        .select(`*, dishes (id, name), profiles (full_name)`)
        .eq('restaurant_id', restId)
        .order('created_at', { ascending: false });

    // LÓGICA DA CAPA DO MODAL
    let coverImg = 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=800&q=80';
    if (reviews && reviews.length > 0) {
        const reviewWithPhoto = reviews.find(r => r.food_photo_url);
        if (reviewWithPhoto) coverImg = reviewWithPhoto.food_photo_url;
    }
    
    document.getElementById('rest-modal-img').src = coverImg;
    document.getElementById('rest-modal-name').innerText = rest.name;
    document.getElementById('rest-modal-category').innerText = rest.category || 'Geral';
    
    const totalReviews = reviews ? reviews.length : 0;
    document.getElementById('rest-modal-reviews').innerText = `Provado por ${totalReviews} ${totalReviews === 1 ? 'pessoa' : 'pessoas'}`;
    
    if (totalReviews > 0) {
        const soma = reviews.reduce((acc, curr) => acc + curr.rating, 0);
        document.getElementById('rest-modal-rating').innerText = `⭐ ${(soma / totalReviews).toFixed(1)}`;
    } else {
        document.getElementById('rest-modal-rating').innerText = `⭐ Sem notas`;
    }

    if (totalReviews === 0) {
        dishesContainer.innerHTML = `<p class="text-light text-center" style="padding: 20px;">Nenhum prato registrado ainda.</p>`;
        return;
    }

    dishesContainer.innerHTML = reviews.map(r => {
        const autor = r.profiles?.full_name || 'Anônimo';
        // Fallback para a foto do prato na lista interna
        const img = r.food_photo_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=200&q=80';
        
        return `
            <div class="dish-row">
                <img src="${img}" class="dish-row-img">
                <div class="dish-row-info">
                    <div class="dish-row-top">
                        <h4>${r.dishes?.name || 'Prato'}</h4>
                        <span class="dish-row-price">R$ ${r.price_paid.toFixed(2).replace('.', ',')}</span>
                    </div>
                    <div class="dish-row-rating">⭐ ${r.rating}</div>
                    <div class="dish-row-review">"${r.review_text || 'Sem comentários.'}"</div>
                    <div class="dish-row-author">
                        <img src="https://ui-avatars.com/api/?name=${autor}&background=random"> 
                        por ${autor}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function openNewReviewForRestaurant() {
    closeModal('restaurant-details-modal');
    openNewReviewModal();
    
    // Preenche o select com o restaurante atual (se ele existir na lista)
    setTimeout(() => {
        const restName = document.getElementById('rest-modal-name').innerText;
        const select = document.getElementById('review-location');
        if (select) select.value = restName;
    }, 100);
}

// --- 4. DETALHES DA MINHA REVIEW (DIÁRIO) ---
function abrirDetalhesMinhaReview(id) {
    const review = window.minhasReviews?.find(r => r.id === id);
    if (!review) return;

    // Usamos o mesmo modal de restaurante para simplificar, 
    // mas podemos focar na review específica.
    openRestaurantDetails(review.restaurant_id);
}

async function deletarReview(id) {
    closeModal('restaurant-details-modal');
    showToast("Avaliação excluída.", "success", async () => {
        clearTimeout(deleteTimeout);
        showToast("Exclusão cancelada.", "info");
        carregarFeed(); carregarDiario(); carregarRestaurantes();
    });

    deleteTimeout = setTimeout(async () => {
        await supabaseClient.from('reviews').delete().eq('id', id);
        carregarFeed(); carregarDiario(); carregarRestaurantes(); carregarRecomendacoes();
    }, 4000);
}

// --- 5. FORMULÁRIO DE NOVA REVIEW ---
function switchView(viewName, btn) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(n => n.classList.remove('active'));
    document.getElementById(`view-${viewName}`).classList.add('active');
    document.querySelectorAll(`.nav-btn[onclick*="'${viewName}'"]`).forEach(b => b.classList.add('active'));
}
 
function openModal(id) { 
    document.getElementById(id).classList.add('active'); 
    document.body.style.overflow = 'hidden'; // Trava o scroll do fundo
}

function closeModal(id) { 
    document.getElementById(id).classList.remove('active'); 
    document.body.style.overflow = ''; // Libera o scroll do fundo
    
    if (id === 'new-review-modal') {
        nextStep(1);
        document.getElementById('review-dish').value = '';
        document.getElementById('review-price').value = '';
        document.getElementById('review-text').value = '';
        document.getElementById('photo-upload').value = '';
        document.getElementById('photo-preview-area').innerHTML = `<i class="fas fa-camera"></i><span>Adicionar foto</span>`;
        document.getElementById('btn-next-1').disabled = true;
    }
}

function nextStep(step) {
    document.querySelectorAll('.form-step').forEach(s => s.classList.remove('active'));
    document.getElementById(`step-${step}`).classList.add('active');
}

function openNewReviewModal() {
    popularSelectRestaurantes();
    openModal('new-review-modal');
}

function popularSelectRestaurantes() {
    const select = document.getElementById('review-location');
    select.innerHTML = '<option value="" disabled selected>Selecione o restaurante...</option>';
    allRestaurants.forEach(rest => { select.innerHTML += `<option value="${rest.name}">${rest.name}</option>`; });
    select.innerHTML += `<option value="NEW_RESTAURANT" style="font-weight: bold; color: var(--primary);">+ Adicionar novo restaurante</option>`;
}

function toggleNovoRestaurante(select) {
    document.getElementById('new-rest-container').style.display = select.value === 'NEW_RESTAURANT' ? 'flex' : 'none';
}

function previewImage(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('photo-preview-area').innerHTML = `<img src="${e.target.result}">`;
            document.getElementById('btn-next-1').disabled = false;
        }
        reader.readAsDataURL(file);
    }
}
 
function applyCurrencyMask(input) {
    let value = input.value.replace(/\D/g, '');
    value = (value / 100).toFixed(2) + '';
    input.value = value.replace(".", ",");
}
 
async function saveReview() {
    if (!currentUser) return;

    const dish = document.getElementById('review-dish').value;
    const locationSelect = document.getElementById('review-location').value;
    const newRestName = document.getElementById('new-rest-name').value;
    const category = document.getElementById('review-category').value;
    const rating = parseInt(document.getElementById('review-rating').value);
    const priceText = document.getElementById('review-price').value;
    const text = document.getElementById('review-text').value;
    const file = document.getElementById('photo-upload').files[0];
    
    const isVeg = document.getElementById('dish-vegetarian').checked;
    const isVegan = document.getElementById('dish-vegan').checked;
 
    let location = locationSelect === 'NEW_RESTAURANT' ? newRestName : locationSelect;
    
    if (!file || !dish || !location || !category) return showToast("Preencha todos os campos obrigatórios.", "error");
 
    try {
        const options = { maxSizeMB: 1, maxWidthOrHeight: 1280, useWebWorker: true };
        const compressedFile = await imageCompression(file, options);

        const fileExt = compressedFile.name.split('.').pop();
        const fileName = `foods/${Date.now()}.${fileExt}`;
       
        const { error: uploadError } = await supabaseClient.storage.from('food-images').upload(fileName, compressedFile);
        if (uploadError) throw new Error("Erro no upload: " + uploadError.message);
        const { data: publicUrl } = supabaseClient.storage.from('food-images').getPublicUrl(fileName);
 
        let { data: rest } = await supabaseClient.from('restaurants').select('id').eq('name', location).maybeSingle();
        let restId = rest?.id;
        if (!restId) {
            const { data: newRest, error: restError } = await supabaseClient.from('restaurants').insert([{ name: location, category: category }]).select().single();
            if (restError) throw new Error("Erro restaurante: " + restError.message);
            restId = newRest.id;
        }
 
        let { data: dishData } = await supabaseClient.from('dishes').select('id').eq('restaurant_id', restId).eq('name', dish).maybeSingle();
        let dishId = dishData?.id;
        
        if (!dishId) {
            const { data: newDish, error: dishError } = await supabaseClient.from('dishes').insert([{ 
                restaurant_id: restId, 
                name: dish,
                is_vegetarian: isVeg,
                is_vegan: isVegan
            }]).select().single();
            if (dishError) throw new Error("Erro prato: " + dishError.message);
            dishId = newDish.id;
        } else {
            await supabaseClient.from('dishes').update({ is_vegetarian: isVeg, is_vegan: isVegan }).eq('id', dishId);
        }
 
        const priceNum = priceText ? parseFloat(priceText.replace(/\./g, '').replace(',', '.')) : 0;

        const { error: insertError } = await supabaseClient.from('reviews').insert([{
            user_id: currentUser.id,
            restaurant_id: restId,
            dish_id: dishId,
            food_photo_url: publicUrl.publicUrl,
            rating: rating,
            price_paid: priceNum,
            review_text: text
        }]);
 
        if (insertError) throw new Error("Erro no banco: " + insertError.message);
 
        showToast("Review salva com sucesso!", "success");
        closeModal('new-review-modal');
        
        carregarRecomendacoes();
        carregarFeed();
        carregarRestaurantes();
        carregarDiario();
 
    } catch (error) {
        console.error(error);
        showToast(error.message, "error");
    }
}