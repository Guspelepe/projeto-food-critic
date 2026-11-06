const SUPABASE_URL = 'https://axsuovcijbumfgltjylh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4c3VvdmNpamJ1bWZnbHRqeWxoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM4MjkyOTYsImV4cCI6MjEwOTQwNTI5Nn0.ngZf5KtwAnfFtJDA-8iGPVMY1t_8-Eunf8ED4GyWs-0';
 
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas ${type === 'error' ? 'fa-exclamation-circle' : 'fa-check-circle'}"></i> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}

// Verifica a sessão de forma segura para não criar loop
async function checkAuthState() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    const isAuthPage = window.location.pathname.includes('login.html') || window.location.pathname.includes('register.html');

    if (session && isAuthPage) {
        window.location.href = 'index.html'; // Se logado e na tela de login, vai pro app
    } else if (!session && !isAuthPage) {
        window.location.href = 'login.html'; // Se não logado e no app, vai pro login
    }
}
checkAuthState();

// --- LÓGICA DE LOGIN ---
async function fazerLogin() {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    if (!email || !password) return showToast("Preencha e-mail e senha.", "error");

    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) showToast("Erro no login: " + error.message, "error");
}

// --- LÓGICA DE CADASTRO ---
async function fazerCadastro() {
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    if (!name || !email || !password) return showToast("Preencha todos os campos.", "error");

    const { error } = await supabaseClient.auth.signUp({ 
        email, password, options: { data: { full_name: name } } 
    });
    
    if (error) {
        showToast("Erro ao cadastrar: " + error.message, "error");
    } else {
        showToast("Conta criada com sucesso! Faça login.", "success");
        setTimeout(() => window.location.href = 'login.html', 2000);
    }
}