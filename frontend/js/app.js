// 🔥 COLOQUE SUAS CREDENCIAIS DO SUPABASE AQUI
const SUPABASE_URL = 'https://axsuovcijbumfgltjylh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4c3VvdmNpamJ1bWZnbHRqeWxoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM4MjkyOTYsImV4cCI6MjEwOTQwNTI5Nn0.ngZf5KtwAnfFtJDA-8iGPVMY1t_8-Eunf8ED4GyWs-0';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;

// Elementos da UI
const authScreen = document.getElementById('auth-screen');
const appScreen = document.getElementById('app-screen');
const feedEl = document.getElementById('feed');
const recListEl = document.getElementById('recommendations-list');
const modal = document.getElementById('review-modal');
const userEmailEl = document.getElementById('user-name');

// --- 1. AUTENTICAÇÃO ---
async function login() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert("Erro no login: " + error.message);
}

async function signup() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const { error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: { data: { full_name: 'Novo Crítico' } } 
    });
    if (error) alert("Erro ao criar conta: " + error.message);
    else alert("Conta criada! Verifique o e-mail se a confirmação estiver ativada.");
}

async function logout() {
    await supabase.auth.signOut();
}

// Monitorar Estado de Login
supabase.auth.onAuthStateChange((event, session) => {
    if (session) {
        currentUser = session.user;
        authScreen.classList.remove('active');
        appScreen.classList.add('active');
        userEmailEl.textContent = currentUser.email;
        loadFeed();
        loadRecommendations();
    } else {
        currentUser = null;
        authScreen.classList.add('active');
        appScreen.classList.remove('active');
    }
});

// --- 2. UI E MODAL ---
function openModal() { modal.style.display = 'flex'; }
function closeModal() { modal.style.display = 'none'; }

// --- 3. HELPERS DE UPLOAD E BANCO ---
async function uploadImage(file, folder) {
    if (!file) return null;
    const fileExt = file.name.split('.').pop();
    const fileName = `${folder}/${currentUser.id}-${Date.now()}.${fileExt}`;
    
    const { error } = await supabase.storage.from('food-images').upload(fileName, file);
    if (error) throw new Error("Erro no upload: " + error.message);
    
    const { data } = supabase.storage.from('food-images').getPublicUrl(fileName);
    return data.publicUrl;
}

// Busca ou Cria o Restaurante e o Prato
async function getRestaurantAndDish(restName, category, dishName) {
    // Tenta achar restaurante pelo nome
    let { data: rest } = await supabase.from('restaurants').select('id').eq('name', restName).single();
    let restId = rest?.id;

    if (!restId) {
        const { data: newRest } = await supabase.from('restaurants')
            .insert([{ name: restName, category: category }]).select().single();
        restId = newRest.id;
    }

    // Tenta achar o prato nesse restaurante
    let { data: dish } = await supabase.from('dishes')
        .select('id').eq('restaurant_id', restId).eq('name', dishName).single();
    let dishId = dish?.id;

    if (!dishId) {
        const { data: newDish } = await supabase.from('dishes')
            .insert([{ restaurant_id: restId, name: dishName }]).select().single();
        dishId = newDish.id;
    }

    return { restId, dishId };
}

// --- 4. ENVIAR AVALIAÇÃO (O Fluxo Completo) ---
async function submitReview(event) {
    event.preventDefault();
    const btn = document.getElementById('submit-btn');
    btn.textContent = "Enviando..."; btn.disabled = true;

    try {
        const restName = document.getElementById('rest-name').value;
        const category = document.getElementById('rest-category').value;
        const dishName = document.getElementById('dish-name').value;
        const price = parseFloat(document.getElementById('price-paid').value);
        const rating = parseInt(document.getElementById('rating').value);
        const text = document.getElementById('review-text').value;
        
        const foodFile = document.getElementById('food-photo').files[0];
        const menuFile = document.getElementById('menu-photo').files[0];

        // 1. Upload das fotos
        const foodUrl = await uploadImage(foodFile, 'foods');
        const menuUrl = await uploadImage(menuFile, 'menus');

        // 2. Busca/Cria IDs de Restaurante e Prato
        const { restId, dishId } = await getRestaurantAndDish(restName, category, dishName);

        // 3. Salva a Review no Banco
        const { error } = await supabase.from('reviews').insert([{
            user_id: currentUser.id,
            restaurant_id: restId,
            dish_id: dishId,
            food_photo_url: foodUrl,
            menu_photo_url: menuUrl,
            rating: rating,
            price_paid: price,
            review_text: text
        }]);

        if (error) throw error;

        alert("Avaliação publicada com sucesso!");
        document.getElementById('review-form').reset();
        closeModal();
        loadFeed(); // Recarrega a tela
        loadRecommendations();

    } catch (err) {
        alert(err.message);
    } finally {
        btn.textContent = "Publicar Crítica"; btn.disabled = false;
    }
}

// --- 5. CARREGAR FEED (GET) ---
async function loadFeed() {
    feedEl.innerHTML = '<p class="loading">Carregando feed...</p>';
    
    // Join com Restaurantes, Pratos e Perfis
    const { data, error } = await supabase
        .from('reviews')
        .select(`
            *,
            restaurants (name, category),
            dishes (name),
            profiles (full_name)
        `)
        .order('created_at', { ascending: false });

    if (error) { feedEl.innerHTML = '<p>Erro ao carregar o feed.</p>'; return; }
    if (data.length === 0) { feedEl.innerHTML = '<p class="loading">Nenhuma avaliação ainda. Seja o primeiro!</p>'; return; }

    feedEl.innerHTML = data.map(r => `
        <div class="review-card">
            <img src="${r.food_photo_url || 'https://via.placeholder.com/200'}" alt="Comida">
            <div class="review-content">
                <h3>${r.dishes?.name || 'Prato não especificado'}</h3>
                <div class="review-meta">
                    <span>📍 ${r.restaurants?.name} (${r.restaurants?.category})</span>
                    <span>👤 ${r.profiles?.full_name || 'Anônimo'}</span>
                    <span class="stars">${'⭐'.repeat(r.rating)}</span>
                </div>
                <p class="review-text">"${r.review_text}"</p>
                <div class="price">R$ ${r.price_paid.toFixed(2).replace('.', ',')}</div>
            </div>
        </div>
    `).join('');
}

// --- 6. CARREGAR RECOMENDAÇÕES (RPC) ---
async function loadRecommendations() {
    recListEl.innerHTML = '<p class="loading">Calculando...</p>';

    const { data, error } = await supabase.rpc('get_recommendations_for_user', {
        user_id_param: currentUser.id
    });

    if (error) { recListEl.innerHTML = '<p>Erro ao carregar.</p>'; return; }
    
    if (data.length === 0) {
        recListEl.innerHTML = '<p style="font-size:14px; color:#888;">Avalie mais lugares para gerar recomendações.</p>';
        return;
    }

    recListEl.innerHTML = data.map(rec => `
        <div class="rec-card">
            <h3>${rec.restaurant_name}</h3>
            <p>⭐ ${rec.avg_rating} · ${rec.category}</p>
        </div>
    `).join('');
}