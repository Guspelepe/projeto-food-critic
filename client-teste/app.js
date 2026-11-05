// 🔥 COLOQUE SUAS CREDENCIAIS AQUI
const SUPABASE_URL = 'https://axsuovcijbumfgltjylh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4c3VvdmNpamJ1bWZnbHRqeWxoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM4MjkyOTYsImV4cCI6MjEwOTQwNTI5Nn0.ngZf5KtwAnfFtJDA-8iGPVMY1t_8-Eunf8ED4GyWs-0';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let testRestaurantId = null;
let testDishId = null;

// Monitorar Login
supabase.auth.onAuthStateChange((event, session) => {
    if (session) {
        currentUser = session.user;
        document.getElementById('auth-section').style.display = 'none';
        document.getElementById('app-section').style.display = 'block';
        document.getElementById('user-email').textContent = currentUser.email;
    } else {
        currentUser = null;
        document.getElementById('auth-section').style.display = 'block';
        document.getElementById('app-section').style.display = 'none';
    }
});

// --- Auth ---
async function signup() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const { error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: { data: { full_name: 'Usuário de Teste' } } 
    });
    if (error) alert("Erro ao cadastrar: " + error.message);
    else alert("Cadastrado! Se pedir confirmação de e-mail, confirme e faça login.");
}

async function login() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert("Erro no login: " + error.message);
}

async function logout() {
    await supabase.auth.signOut();
}

// --- PREPARAR DADOS (Para não dar erro de Foreign Key) ---
async function prepararDadosTeste() {
    try {
        // 1. Insere um Restaurante de Teste
        const { data: rest, error: errRest } = await supabase.from('restaurants')
            .insert([{ name: 'Teste Burger', category: 'Hamburguer' }]).select().single();
        
        if (errRest) throw errRest;
        testRestaurantId = rest.id;

        // 2. Insere um Prato de Teste ligado ao Restaurante
        const { data: dish, error: errDish } = await supabase.from('dishes')
            .insert([{ restaurant_id: testRestaurantId, name: 'Teste Burger Duplo' }]).select().single();
        
        if (errDish) throw errDish;
        testDishId = dish.id;

        // 3. Atualiza as preferências do usuário no perfil (Para o Motor de Recomendação funcionar)
        await supabase.from('profiles')
            .update({ food_preferences: ['Hamburguer', 'Italiana'] })
            .eq('id', currentUser.id);

        alert(`Dados criados!\nRestaurante ID: ${testRestaurantId}\nPrato ID: ${testDishId}\nPreferências atualizadas.`);
    } catch (err) {
        console.error(err);
        alert("Erro ao preparar dados: " + err.message);
    }
}

// --- TESTE 1: Upload e Insert na tabela Reviews ---
async function testarReview() {
    const fileInput = document.getElementById('food-photo');
    if (fileInput.files.length === 0) return alert("Selecione uma foto!");
    if (!testRestaurantId) return alert("Clique em 'Preparar Dados de Teste' primeiro!");

    const file = fileInput.files[0];
    const fileName = `teste-${Date.now()}.${file.name.split('.').pop()}`;

    try {
        // 1. Upload para o Storage
        const { error: uploadError } = await supabase.storage
            .from('food-images')
            .upload(fileName, file);

        if (uploadError) throw uploadError;

        // 2. Pega a URL Pública
        const { data: publicUrl } = supabase.storage.from('food-images').getPublicUrl(fileName);

        // 3. Insere a Review
        const { error: insertError } = await supabase.from('reviews').insert([{
            user_id: currentUser.id,
            restaurant_id: testRestaurantId,
            dish_id: testDishId,
            food_photo_url: publicUrl.publicUrl,
            rating: parseInt(document.getElementById('rating').value),
            price_paid: parseFloat(document.getElementById('price').value),
            review_text: document.getElementById('review-text').value
        }]);

        if (insertError) throw insertError;

        alert("Sucesso! Review salva e foto enviada.");
    } catch (err) {
        console.error(err);
        alert("Erro no teste de review: " + err.message);
    }
}

// --- TESTE 2: RPC (Motor de Recomendação) ---
async function testarRecomendacao() {
    const pre = document.getElementById('resultado-rpc');
    pre.textContent = "Buscando...";

    try {
        const { data, error } = await supabase.rpc('get_recommendations_for_user', {
            user_id_param: currentUser.id
        });

        if (error) throw error;

        pre.textContent = JSON.stringify(data, null, 2);
    } catch (err) {
        pre.textContent = "Erro: " + err.message;
    }
}