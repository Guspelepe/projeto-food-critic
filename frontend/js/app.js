const SUPABASE_URL = 'https://axsuovcijbumfgltjylh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4c3VvdmNpamJ1bWZnbHRqeWxoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM4MjkyOTYsImV4cCI6MjEwOTQwNTI5Nn0.ngZf5KtwAnfFtJDA-8iGPVMY1t_8-Eunf8ED4GyWs-0';
 
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let currentUser = null;
 
// Variáveis de Filtro
let allRestaurants = [];
let currentSearch = '';
let currentCategory = 'Todas';
 
// --- 1. AUTH ---
async function fazerLogin() {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    if(!email || !password) return alert("Preencha e-mail e senha.");
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) alert("Erro no login: " + error.message);
}
 
async function fazerCadastro() {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    if(!email || !password) return alert("Preencha e-mail e senha.");
    const { error } = await supabaseClient.auth.signUp({ email, password, options: { data: { full_name: 'Novo Crítico' } } });
    if (error) alert("Erro ao cadastrar: " + error.message);
    else alert("Conta criada com sucesso!");
}
 
async function fazerLogout() { await supabaseClient.auth.signOut(); }
 
supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (session) {
        currentUser = session.user;
        document.getElementById('auth-screen').classList.remove('active');
        document.getElementById('main-screen').style.display = 'flex';
        document.getElementById('profile-email').textContent = currentUser.email;
       
        await checarOnboarding();
        carregarRecomendacoes();
        carregarFeed();
        carregarRestaurantes();
        carregarDiario();
    } else {
        currentUser = null;
        document.getElementById('auth-screen').classList.add('active');
        document.getElementById('main-screen').style.display = 'none';
    }
});
 
// --- 2. ONBOARDING ---
async function checarOnboarding() {
    // CORRIGIDO: maybeSingle() evita erro caso o perfil ainda não tenha sido criado pelo trigger
    const { data } = await supabaseClient.from('profiles').select('food_preferences').eq('id', currentUser.id).maybeSingle();
    if (!data || !data.food_preferences || data.food_preferences.length === 0) openModal('onboarding-modal');
}
 
async function salvarOnboarding() {
    const budget = document.getElementById('onboarding-budget').value;
    const restriction = document.getElementById('onboarding-restriction').value;
    const { error } = await supabaseClient.from('profiles').update({ food_preferences: [budget, restriction] }).eq('id', currentUser.id);
    if (!error) { closeModal('onboarding-modal'); alert("Preferências salvas!"); }
}
 
// --- 3. BUSCAR DADOS ---
async function carregarRestaurantes() {
    const container = document.getElementById('restaurants-list-container');
   
    // CORRIGIDO: Removido o "!inner". Agora traz todos os restaurantes, com ou sem avaliações.
    const { data, error } = await supabaseClient
        .from('restaurants')
        .select(`id, name, category, dishes (name), reviews (rating)`)
        .order('name', { ascending: true });
 
    if (error) { container.innerHTML = `<p style="color:red;">Erro ao carregar.</p>`; return; }
    if (!data || data.length === 0) { container.innerHTML = `<p style="text-align:center; color:#888;">Nenhum restaurante cadastrado.</p>`; return; }
 
    allRestaurants = data;
    renderizarRestaurantes();
}
 
function renderizarRestaurantes() {
    const container = document.getElementById('restaurants-list-container');
   
    let filtrados = allRestaurants.filter(rest => {
        const matchSearch = rest.name.toLowerCase().includes(currentSearch.toLowerCase());
        const matchCategory = currentCategory === 'Todas' || rest.category === currentCategory;
        return matchSearch && matchCategory;
    });
 
    if (filtrados.length === 0) {
        container.innerHTML = `<p style="text-align:center; color:#888; padding: 20px;">Nenhum restaurante encontrado com esse filtro.</p>`;
        return;
    }
 
    container.innerHTML = filtrados.map(rest => {
        // Monta a lista de pratos
        const pratosHTML = rest.dishes && rest.dishes.length > 0
            ? rest.dishes.map(d => `<span class="dish-tag">${d.name}</span>`).join('')
            : '<span style="font-size: 12px; color: #aaa;">Nenhum prato</span>';
 
        // CORRIGIDO: Tratamento para quando não há avaliações
        const totalReviews = rest.reviews ? rest.reviews.length : 0;
        const somaNotas = totalReviews > 0 ? rest.reviews.reduce((acc, curr) => acc + curr.rating, 0) : 0;
        const mediaNota = totalReviews > 0 ? (somaNotas / totalReviews).toFixed(1) : '--';
 
        return `
            <div class="rest-card" onclick="openRestaurantDetails(${rest.id})">
                <div class="rest-header">
                    <h3>${rest.name}</h3>
                    <span class="rest-category">${rest.category || 'Geral'}</span>
                </div>
                <div class="rest-stats">
                    <span><i class="fas fa-star" style="color: gold;"></i> ${mediaNota}</span>
                    <span><i class="fas fa-comment-dots"></i> ${totalReviews} avaliações</span>
                </div>
                <div style="font-size: 0.85rem; color: var(--text-light); margin-top: 10px;">Pratos:</div>
                <div class="dish-list">${pratosHTML}</div>
            </div>
        `;
    }).join('');
}
 
// Eventos de busca e filtro
function filtrarRestaurantes() {
    currentSearch = document.getElementById('search-rest').value;
    renderizarRestaurantes();
}
 
function setFiltroCategoria(cat, btn) {
    currentCategory = cat;
    document.querySelectorAll('#category-filters .chip').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    renderizarRestaurantes();
}
 
async function carregarRecomendacoes() {
    const container = document.getElementById('recommendations-container');
    const { data } = await supabaseClient.rpc('get_recommendations_for_user', { user_id_param: currentUser.id });
    if (!data || data.length === 0) { container.innerHTML = `<p style="font-size: 12px; color: #888;">Sem recomendações.</p>`; return; }
    container.innerHTML = data.map(rec => `<div class="rec-card"><h4>${rec.restaurant_name}</h4><p>⭐ ${rec.avg_rating} · ${rec.category}</p></div>`).join('');
}
 
async function carregarFeed() {
    const feedContainer = document.getElementById('home-feed-container');
    const { data } = await supabaseClient.from('reviews').select(`*, restaurants (name, category), dishes (name)`).order('created_at', { ascending: false });
 
    if (!data || data.length === 0) { feedContainer.innerHTML = `<p style="text-align:center; color:#888;">Nenhuma avaliação ainda.</p>`; return; }
 
    feedContainer.innerHTML = data.map(r => {
        const preco = r.price_paid ? r.price_paid.toFixed(2).replace('.', ',') : '0,00';
        return `
            <div class="card">
                <img src="${r.food_photo_url || 'https://via.placeholder.com/400x200?text=Sem+Foto'}">
                <div class="card-content">
                    <div class="card-header">
                        <h3>${r.dishes?.name || 'Prato'}</h3>
                        <span class="card-price">R$ ${preco}</span>
                    </div>
                    <div class="card-info">
                        <span><i class="fas fa-map-marker-alt"></i> ${r.restaurants?.name || 'Local'}</span>
                        <span><i class="fas fa-star" style="color: gold;"></i> ${r.rating}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}
 
async function carregarDiario() {
    const { data } = await supabaseClient.from('reviews').select(`*, restaurants (name), dishes (name)`).eq('user_id', currentUser.id).order('created_at', { ascending: false });
    const grid = document.getElementById('diary-grid');
    if (!data || data.length === 0) { grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center;">Nenhuma foto no diário.</div>`; return; }
    grid.innerHTML = data.map(review => `<div class="grid-item" onclick="openReviewDetails(${review.id})"><img src="${review.food_photo_url || ''}"></div>`).join('');
    window.minhasReviews = data;
}
 
// --- 4. MODAIS E DETALHES ---
function switchView(viewName, navElement) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(`view-${viewName}`).classList.add('active');
    if (navElement) navElement.classList.add('active');
}
 
function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }
 
// Abre o modal com todas as reviews do restaurante
async function openRestaurantDetails(restId) {
    const content = document.getElementById('restaurant-details-content');
    content.innerHTML = `<p>Carregando...</p>`;
    openModal('restaurant-details-modal');
 
    const { data, error } = await supabaseClient
        .from('reviews')
        .select(`*, dishes (name), profiles (full_name)`)
        .eq('restaurant_id', restId)
        .order('created_at', { ascending: false });
 
    // CORRIGIDO: Se não houver reviews, mostra mensagem amigável
    if (error || !data || data.length === 0) {
        const rest = allRestaurants.find(r => r.id === restId);
        content.innerHTML = `
            <h2 style="color: var(--primary); margin-bottom: 15px;">${rest ? rest.name : 'Restaurante'}</h2>
            <p style="text-align:center; color:#888;">Nenhuma avaliação detalhada ainda.</p>
        `;
        return;
    }
 
    const rest = allRestaurants.find(r => r.id === restId);
   
    content.innerHTML = `
        <h2 style="color: var(--primary); margin-bottom: 15px;">${rest.name}</h2>
        ${data.map(r => `
            <div style="display: flex; gap: 15px; border-bottom: 1px solid var(--border); padding-bottom: 15px; margin-bottom: 15px;">
                <img src="${r.food_photo_url || 'https://via.placeholder.com/80?text=Foto'}" style="width: 80px; height: 80px; border-radius: 8px; object-fit: cover;">
                <div>
                    <h4 style="margin-bottom: 2px;">${r.dishes?.name || 'Prato'}</h4>
                    <div style="font-size: 12px; color: var(--text-light); margin-bottom: 5px;">Por: ${r.profiles?.full_name || 'Anônimo'}</div>
                    <div style="color: gold; font-size: 14px; margin-bottom: 5px;">${'⭐'.repeat(r.rating)}</div>
                    <p style="font-size: 13px; font-style: italic;">"${r.review_text || 'Sem comentários.'}"</p>
                    <div style="font-weight: bold; color: var(--primary); font-size: 13px; margin-top: 5px;">R$ ${r.price_paid.toFixed(2).replace('.', ',')}</div>
                </div>
            </div>
        `).join('')}
    `;
}
 
function openReviewDetails(id) {
    if(!window.minhasReviews) return;
    const review = window.minhasReviews.find(r => r.id === id);
    if (!review) return;
 
    const content = document.getElementById('details-content');
    content.innerHTML = `
        <img src="${review.food_photo_url}" class="review-img">
        <h2 style="margin-top: 15px;">${review.dishes?.name || 'Prato'}</h2>
        <p style="color: var(--text-light);"><i class="fas fa-map-marker-alt"></i> ${review.restaurants?.name || 'Local'}</p>
       
        <div class="review-meta">
            <div><span>NOTA</span><strong>⭐ ${review.rating}</strong></div>
            <div><span>QUANTO PAGOU</span><strong>R$ ${review.price_paid.toFixed(2).replace('.', ',')}</strong></div>
        </div>
       
        <div class="review-text">"${review.review_text || 'Sem comentários.'}"</div>
       
        <button class="btn-danger" onclick="deletarReview(${review.id})">
            <i class="fas fa-trash"></i> Excluir Avaliação
        </button>
    `;
    openModal('details-modal');
}
 
async function deletarReview(id) {
    if (!confirm("Tem certeza que deseja apagar essa avaliação do seu diário?")) return;
 
    try {
        const { error } = await supabaseClient.from('reviews').delete().eq('id', id);
        if (error) throw error;
 
        alert("Avaliação excluída com sucesso!");
        closeModal('details-modal');
       
        carregarRecomendacoes();
        carregarFeed();
        carregarRestaurantes();
        carregarDiario();
    } catch (err) {
        alert("Erro ao excluir: " + err.message);
    }
}
 
// --- 5. HELPERS (MÁSCARAS E FOTO) ---
function previewImage(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const previewArea = document.getElementById('photo-preview-area');
            previewArea.innerHTML = `<img src="${e.target.result}">`;
            previewArea.style.border = "none";
        }
        reader.readAsDataURL(file);
    }
}
 
function applyCurrencyMask(input) {
    let value = input.value.replace(/\D/g, '');
    value = (value / 100).toFixed(2) + '';
    value = value.replace(".", ",");
    input.value = value;
}
 
// --- 6. SALVAR NOVA REVIEW ---
async function saveReview() {
    if (!currentUser) return;
    const dish = document.getElementById('review-dish').value;
    const location = document.getElementById('review-location').value;
    const category = document.getElementById('review-category').value;
    const rating = parseInt(document.getElementById('review-rating').value);
    const priceText = document.getElementById('review-price').value;
    const text = document.getElementById('review-text').value;
    const file = document.getElementById('photo-upload').files[0];
 
    if (!file || !dish || !location) return alert("Por favor, tire a foto, e preencha o prato e o local.");
 
    try {
        const priceNum = priceText ? parseFloat(priceText.replace(/\./g, '').replace(',', '.')) : 0;
        const fileExt = file.name.split('.').pop();
        const fileName = `foods/${Date.now()}.${fileExt}`;
       
        const { error: uploadError } = await supabaseClient.storage.from('food-images').upload(fileName, file);
        if (uploadError) throw new Error("Erro no upload: " + uploadError.message);
        const { data: publicUrl } = supabaseClient.storage.from('food-images').getPublicUrl(fileName);
 
        let { data: rest } = await supabaseClient.from('restaurants').select('id').eq('name', location).maybeSingle();
        let restId = rest?.id;
        if (!restId) {
            const { data: newRest, error: restError } = await supabaseClient.from('restaurants').insert([{ name: location, category: category }]).select().single();
            if (restError) throw new Error("Erro ao criar restaurante: " + restError.message);
            restId = newRest.id;
        }
 
        let { data: dishData } = await supabaseClient.from('dishes').select('id').eq('restaurant_id', restId).eq('name', dish).maybeSingle();
        let dishId = dishData?.id;
        if (!dishId) {
            const { data: newDish, error: dishError } = await supabaseClient.from('dishes').insert([{ restaurant_id: restId, name: dish }]).select().single();
            if (dishError) throw new Error("Erro ao criar prato: " + dishError.message);
            dishId = newDish.id;
        }
 
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
 
        alert("Review salva com sucesso!");
        document.getElementById('review-dish').value = '';
        document.getElementById('review-location').value = '';
        document.getElementById('review-price').value = '';
        document.getElementById('review-text').value = '';
        document.getElementById('photo-upload').value = '';
        document.getElementById('photo-preview-area').innerHTML = `<i class="fas fa-camera"></i><span>Toque para tirar foto</span>`;
        document.getElementById('photo-preview-area').style.border = "2px dashed var(--border)";
 
        closeModal('new-review-modal');
       
        carregarRecomendacoes();
        carregarFeed();
        carregarRestaurantes();
        carregarDiario();
 
    } catch (error) {
        console.error("❌ Erro no processo:", error);
        alert(error.message);
    }
}