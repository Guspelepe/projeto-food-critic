const SUPABASE_URL = 'https://axsuovcijbumfgltjylh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4c3VvdmNpamJ1bWZnbHRqeWxoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM4MjkyOTYsImV4cCI6MjEwOTQwNTI5Nn0.ngZf5KtwAnfFtJDA-8iGPVMY1t_8-Eunf8ED4GyWs-0';

// Mudamos o nome para não conflitar com a biblioteca global
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 App Iniciado!");
    await carregarFeedPrimeiro(); // Carrega o feed primeiro, independente do login
    await tentarLogin();          // Tenta o login em paralelo
});

// --- 1. LOGIN ---
async function tentarLogin() {
    console.log("🔐 Verificando login...");
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (session) {
        currentUser = session.user;
        console.log("✅ Logado:", currentUser.email);
        return;
    }

    console.log("⏳ Criando usuário de teste...");
    const email = `teste_${Math.floor(Math.random() * 10000)}@foodcritic.com`;
    const password = 'senha123';
    
    // Tenta cadastrar e logar
    const { error: signUpError } = await supabaseClient.auth.signUp({ email, password });
    
    if (signUpError) {
        console.error("❌ Erro no cadastro:", signUpError.message);
        mostrarAvisoNaTela("Erro de Autenticação: " + signUpError.message);
        return;
    }

    const { data, error: loginError } = await supabaseClient.auth.signInWithPassword({ email, password });
    
    if (loginError) {
        console.error("❌ Erro no login:", loginError.message);
        // Aviso comum: "Email not confirmed". O Supabase exige confirmação por padrão.
        if (loginError.message.includes("Email not confirmed")) {
            mostrarAvisoNaTela("⚠️ Vá no painel do Supabase > Authentication > Providers > Email e desative 'Confirm email' para testar.");
        }
    } else {
        currentUser = data.user;
        console.log("✅ Login realizado com sucesso!");
    }
}

function mostrarAvisoNaTela(msg) {
    const feedContainer = document.getElementById('home-feed-container');
    feedContainer.innerHTML = `<p style="color:var(--primary); text-align:center; font-weight:bold; padding: 20px;">${msg}</p>`;
}

// --- 2. BUSCAR FEED (SEM PRECISAR DE LOGIN) ---
async function carregarFeedPrimeiro() {
    console.log("📦 Buscando dados do banco (Feed)...");
    const feedContainer = document.getElementById('home-feed-container');
    
    // A tabela reviews permite SELECT público (política do back-end)
    const { data, error } = await supabaseClient
        .from('reviews')
        .select(`*, restaurants (name, category), dishes (name)`)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("❌ Erro ao buscar feed:", error);
        feedContainer.innerHTML = `<p style="color:red; text-align:center;">Erro no banco: ${error.message}</p>`;
        return;
    }

    console.log("📊 Dados recebidos:", data);

    if (!data || data.length === 0) {
        feedContainer.innerHTML = `<p style="text-align:center; color:#888; padding: 20px;">O banco não retornou nenhuma avaliação.</p>`;
        return;
    }

    feedContainer.innerHTML = data.map(r => {
        const nomePrato = r.dishes?.name || 'Prato sem nome';
        const nomeRestaurante = r.restaurants?.name || 'Restaurante sem nome';
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

    console.log("✅ Feed renderizado com sucesso!");
}

// --- 3. NAVEGAÇÃO E MODAIS ---
function switchView(viewName, navElement) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(`view-${viewName}`).classList.add('active');
    if (navElement) navElement.classList.add('active');
}

function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

// --- 4. MÁSCARAS E PREVIEW ---
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

// --- 5. SALVAR REVIEW ---
async function saveReview() {
    if (!currentUser) {
        return alert("Você não está logado. Verifique o console (F12) para ver o motivo. (Dica: Desative a confirmação de e-mail no painel do Supabase).");
    }

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

        console.log("📤 Enviando foto...");
        const fileExt = file.name.split('.').pop();
        const fileName = `foods/${Date.now()}-${fileExt}`;
        const { error: uploadError } = await supabaseClient.storage.from('food-images').upload(fileName, file);
        if (uploadError) throw new Error("Erro no upload: " + uploadError.message);
        
        const { data: publicUrl } = supabaseClient.storage.from('food-images').getPublicUrl(fileName);

        console.log("🏪 Verificando restaurante...");
        let { data: rest } = await supabaseClient.from('restaurants').select('id').eq('name', location).single();
        let restId = rest?.id;
        if (!restId) {
            const { data: newRest } = await supabaseClient.from('restaurants').insert([{ name: location, category: category }]).select().single();
            restId = newRest.id;
        }

        console.log("🍔 Verificando prato...");
        let { data: dishData } = await supabaseClient.from('dishes').select('id').eq('restaurant_id', restId).eq('name', dish).single();
        let dishId = dishData?.id;
        if (!dishId) {
            const { data: newDish } = await supabaseClient.from('dishes').insert([{ restaurant_id: restId, name: dish }]).select().single();
            dishId = newDish.id;
        }

        console.log("📝 Salvando review...");
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
        
        // Recarrega a tela inicial
        carregarFeedPrimeiro(); 

    } catch (error) {
        console.error("❌ Erro no processo:", error);
        alert(error.message);
    }
}