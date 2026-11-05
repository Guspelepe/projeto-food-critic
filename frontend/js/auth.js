const SUPABASE_URL = 'https://axsuovcijbumfgltjylh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4c3VvdmNpamJ1bWZnbHRqeWxoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM4MjkyOTYsImV4cCI6MjEwOTQwNTI5Nn0.ngZf5KtwAnfFtJDA-8iGPVMY1t_8-Eunf8ED4GyWs-0';
 
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas ${type === 'error' ? 'fa-exclamation-circle' : 'fa-check-circle'}"></i> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}

async function fazerLogin() {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    if(!email || !password) return showToast("Preencha e-mail e senha.", "error");
    
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) showToast("Erro no login: " + error.message, "error");
    // O redirecionamento é feito pelo onAuthStateChange
}
 
async function fazerCadastro() {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    if(!email || !password) return showToast("Preencha e-mail e senha.", "error");
    
    const { error } = await supabaseClient.auth.signUp({ email, password, options: { data: { full_name: 'Novo Crítico' } } });
    if (error) showToast("Erro ao cadastrar: " + error.message, "error");
    else showToast("Conta criada! Faça login.", "success");
}

// Verifica se o usuário já está logado ao abrir a página
supabaseClient.auth.onAuthStateChange((event, session) => {
    if (session) {
        window.location.href = 'index.html'; // Redireciona para o app
    }
});