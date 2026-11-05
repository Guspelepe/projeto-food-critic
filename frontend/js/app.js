const SUPABASE_URL = 'https://axsuovcijbumfgltjylh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4c3VvdmNpamJ1bWZnbHRqeWxoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM4MjkyOTYsImV4cCI6MjEwOTQwNTI5Nn0.ngZf5KtwAnfFtJDA-8iGPVMY1t_8-Eunf8ED4GyWs-0';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let currentUser = null;

// --- 1. GERENCIAMENTO DE AUTENTICAÇÃO ---
async function fazerLogin() {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    
    if(!email || !password) return alert("Preencha e-mail e senha.");

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    
    if (error) {
        alert("Erro no login: " + error.message);
    } else {
        console.log("✅ Logado com sucesso!");
    }
}

async function fazerCadastro() {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    
    if(!email || !password) return alert("Preencha e-mail e senha para cadastrar.");

    const { data, error } = await supabaseClient.auth.signUp({ 
        email, 
        password,
        options: { data: { full_name: 'Novo Crítico' } } 
    });
    
    if (error) {
        alert("Erro ao cadastrar: " + error.message);
    } else {
        alert("Conta criada com sucesso! Você já está logado.");
    }
}

async function fazerLogout() {
    await supabaseClient.auth.signOut();
}

// Fica "ouvindo" o estado do usuário (logado ou deslogado)
supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (session) {
        currentUser = session.user;
        document.getElementById('auth-screen').classList.remove('active');
        document.getElementById('main-screen').style.display = 'flex';
        document.getElementById('profile-email').textContent = currentUser.email;
        
        // Verifica se é um usuário novo (Onboarding)
        await checarOnboarding();
        
        // Puxa os dados
        carregarFeed();
        carregarDiario();
    } else {
        currentUser = null;
        document.getElementById('auth-screen').classList.add('active');
        document.getElementById('main-screen').style.display = 'none';
    }
});

// --- 2. ONBOARDING ---
async function checarOnboarding() {
    const { data, error } = await supabaseClient
        .from('profiles')
        .select('food_preferences')
        .eq('id', currentUser.id)
        .single();

    // Se o usuário não tem preferências salvas, mostra o modal
    if (!data || !data.food_preferences || data.food_preferences.length === 0) {
        openModal('onboarding-modal');
    }
}

async function salvarOnboarding() {
    const budget = document.getElementById('onboarding-budget').value;
    const restriction = document.getElementById('onboarding-restriction').value;

    // Atualiza a tabela profiles no Supabase
    const { error } = await supabaseClient
        .from('profiles')
        .update({ food_preferences: [budget, restriction] }) // Salvando como array (padrão do banco)
        .eq('id', currentUser.id);

    if (error) {
        console.error("Erro no onboarding:", error);
        alert("Erro ao salvar preferências.");
    } else {
        closeModal('onboarding-modal');
        alert("Preferências salvas! As recomendações foram atualizadas.");
    }
}

// --- 3. BUSCAR DADOS (FEED E DIÁRIO) ---
async function carregarFeed() {
    console.log("📦 Buscando dados do banco...");
    const feedContainer = document.getElementById('home-feed-container');
    
    const { data, error } = await supabaseClient
        .from('reviews')
        .select(`*, restaurants (name, category), dishes (name)`)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("❌ Erro no feed:", error);
        feedContainer.innerHTML = `<p style="color:red; text-align:center;">Erro no banco: ${error.message}</p>`;
        return;
    }

    console.log("📊 Dados do Feed recebidos:", data);

    if (!data || data.length === 0) {
        feedContainer.innerHTML = `<p style="text-align:center; color:#888; padding: 20px;">Nenhuma avaliação ainda. Seja o primeiro!</p>`;
        return;
    }

    feedContainer.innerHTML = data.map(r => {
        const nomePrato = r.dishes?.name || 'Prato sem nome';
        const nomeRestaurante = r.restaurants?.name || 'Restaurante';
        const preco = r.price_paid ? r.price_paid.toFixed(2).replace('.', ',') : '0,00';
        const foto = r.food_photo_url || 'https://via.placeholder.com/400x200?text=Sem+Foto';

        return `
            <div class="card">
                <img src="${foto}" alt="${nomePrato}">
                <div class="card-content">
                    <div class="card-header">
                        <h3>${nomePrato}</h3>
                        <span class="card-price">R$ ${preco}</span>
                    </div>
                    <div class="card-info">
                        <span><i class="fas fa-map-marker-alt"></i> ${nomeRestaurante}</span>
                        <span><i class="fas fa-star" style="color: gold;"></i> ${r.rating}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

async function carregarDiario() {
    if (!currentUser) return;
    
    // Busca apenas as reviews do usuário logado
    const { data, error } = await supabaseClient
        .from('reviews')
        .select(`*, restaurants (name), dishes (name)`)
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

    const grid = document.getElementById('diary-grid');

    if (error || !data || data.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-light); padding: 20px;">Nenhuma foto no seu diário ainda.</div>`;
        return;
    }

    grid.innerHTML = data.map(review => `
        <div class="grid-item" onclick="openReviewDetails(${review.id})">
            <img src="${review.food_photo_url || ''}" alt="Foto">
        </div>
    `).join('');

    window.minhasReviews = data; // Salva global para o modal
}

// --- 4. NAVEGAÇÃO E MODAIS ---
function switchView(viewName, navElement) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(`view-${viewName}`).classList.add('active');
    if (navElement) navElement.classList.add('active');
}

function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

// --- 5. HELPERS (MÁSCARAS E FOTO) ---
function previewImage(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const previewArea = document.getElementById('photo-preview-area');
            previewArea.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
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

    if (!file || !dish || !location) {
        return alert("Por favor, tire a foto, e preencha o prato e o local.");
    }

    try {
        const priceNum = priceText ? parseFloat(priceText.replace(/\./g, '').replace(',', '.')) : 0;

        // 1. Upload da Foto
        const fileExt = file.name.split('.').pop();
        const fileName = `foods/${Date.now()}-${fileExt}`;
        const { error: uploadError } = await supabaseClient.storage.from('food-images').upload(fileName, file);
        if (uploadError) throw new Error("Erro no upload: " + uploadError.message);
        
        const { data: publicUrl } = supabaseClient.storage.from('food-images').getPublicUrl(fileName);

        // 2. Busca/Cria Restaurante
        let { data: rest } = await supabaseClient.from('restaurants').select('id').eq('name', location).single();
        let restId = rest?.id;
        if (!restId) {
            const { data: newRest } = await supabaseClient.from('restaurants').insert([{ name: location, category: category }]).select().single();
            restId = newRest.id;
        }

        // 3. Busca/Cria Prato
        let { data: dishData } = await supabaseClient.from('dishes').select('id').eq('restaurant_id', restId).eq('name', dish).single();
        let dishId = dishData?.id;
        if (!dishId) {
            const { data: newDish } = await supabaseClient.from('dishes').insert([{ restaurant_id: restId, name: dish }]).select().single();
            dishId = newDish.id;
        }

        // 4. Salva a Review
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
        
        // Limpa o formulário
        document.getElementById('review-dish').value = '';
        document.getElementById('review-location').value = '';
        document.getElementById('review-price').value = '';
        document.getElementById('review-text').value = '';
        document.getElementById('photo-upload').value = '';
        document.getElementById('photo-preview-area').innerHTML = `<i class="fas fa-camera"></i><span>Toque para tirar foto</span>`;
        document.getElementById('photo-preview-area').style.border = "2px dashed var(--border)";

        closeModal('new-review-modal');
        
        // Atualiza as telas
        carregarFeed(); 
        carregarDiario();

    } catch (error) {
        console.error("❌ Erro no processo:", error);
        alert(error.message);
    }
}

// --- 7. DETALHES DA REVIEW ---
function openReviewDetails(id) {
    if(!window.minhasReviews) return;
    const review = window.minhasReviews.find(r => r.id === id);
    if (!review) return;

    const content = document.getElementById('details-content');
    content.innerHTML = `
        <img src="${review.food_photo_url}" class="review-img" alt="Foto">
        <h2 style="margin-top: 15px;">${review.dishes?.name || 'Prato'}</h2>
        <p style="color: var(--text-light);"><i class="fas fa-map-marker-alt"></i> ${review.restaurants?.name || 'Local'}</p>
        
        <div class="review-meta">
            <div>
                <span>NOTA</span>
                <strong>⭐ ${review.rating}</strong>
            </div>
            <div>
                <span>QUANTO PAGOU</span>
                <strong>R$ ${review.price_paid.toFixed(2).replace('.', ',')}</strong>
            </div>
        </div>
        
        <div class="review-text">
            "${review.review_text || 'Sem comentários.'}"
        </div>
    `;
    openModal('details-modal');
}