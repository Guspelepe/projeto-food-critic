const SUPABASE_URL = 'https://axsuovcijbumfgltjylh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4c3VvdmNpamJ1bWZnbHRqeWxoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM4MjkyOTYsImV4cCI6MjEwOTQwNTI5Nn0.ngZf5KtwAnfFtJDA-8iGPVMY1t_8-Eunf8ED4GyWs-0';
 
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let currentUser = null;
let allRestaurants = [];
let currentCategory = 'Todas';

let map = null;
let mapMarkers = [];
let userPreferences = null; 
let favoriteFoods = []; 

let tempDiet = null;
let tempAvoid = [];
let pendingTagsSelection = [];
let formDirty = false;
let pendingDeleteTimer = null;
let pendingDeleteReview = null; // { id, data }
let myReviewsCache = []; // cache do diário para "Comi de novo"

const POPULAR_FOODS = [
    "Hambúrguer", "Pizza", "Sushi", "Feijoada", "Churrasco", "Lasanha", "Macarrão", "Tacos", "Burrito", "Hot Dog",
    "Sanduíche", "Salada", "Sopa", "Frango Grelhado", "Peixe", "Carne Bovina", "Carne Suína", "Costela", "Picanha", "Maminha",
    "Alcatra", "Cupim", "Frutos do Mar", "Camarão", "Lagosta", "Ostra", "Sashimi", "Temaki", "Yakisoba", "Lamen",
    "Udon", "Gyoza", "Ramen", "Curry", "Pad Thai", "Primavera", "Frango Frito", "Asa de Frango", "Batata Frita", "Onion Rings",
    "Nuggets", "Milkshake", "Açaí", "Sorvete", "Bolo", "Torta", "Pudim", "Mousse", "Brigadeiro", "Beijinho",
    "Pão de Queijo", "Coxinha", "Esfirra", "Quibe", "Empada", "Pastel", "Pizza Doce", "Crepe", "Waffle", "Panqueca",
    "Omelete", "Ovo", "Tapioca", "Cuscuz", "Polenta", "Risoto", "Nhoque", "Ravioli", "Fettuccine", "Carbonara",
    "Bolonhesa", "Pesto", "Margherita", "Calabresa", "Portuguesa", "Quatro Queijos", "Frango c/ Catupiry", "Vegetariana", "Vegana", "Comida Árabe",
    "Comida Mexicana", "Comida Chinesa", "Comida Indiana", "Comida Tailandesa", "Comida Coreana", "Comida Francesa", "Comida Italiana", "Comida Japonesa", "Comida Brasileira", "Comida Argentina",
    "Comida Peruana", "Comida Portuguesa", "Comida Espanhola", "Comida Grega", "Comida Turca", "Hambúrguer Artesanal", "Smash Burger", "Pizza Napolitana", "Sushi de Salmão", "Hot Roll",
    "Temaki de Camarão", "Yakisoba de Frango", "Ramen de Porco", "Lamen Vegano", "Feijoada Light", "Churrasco Vegano", "Lasanha de Berinjela", "Macarrão Integral", "Taco Vegano", "Burrito de Carne",
    "Cachorro Quente Completo", "Sanduíche Natural", "Salada Caesar", "Sopa de Cebola", "Frango à Parmegiana", "Filé de Peixe", "Picanha na Brasa", "Costela BBQ", "Camarão Empanado", "Polvo Grelhado",
    "Batata Rústica", "Mandioca Frita", "Pão de Alho", "Queijo Coalho", "Pastel de Carne", "Pastel de Queijo", "Coxinha Cremosa", "Bolinha de Queijo", "Brigadeiro Gourmet", "Pudim de Leite",
    "Bolo de Cenoura", "Torta de Limão", "Açaí com Granola", "Sorvete de Creme", "Milk Shake de Chocolate", "Café Gelado", "Suco Natural", "Água de Coco", "Chopp Artesanal", "Vinho Tinto"
];

function showToast(message, type = 'info', actionLabel = null, actionFn = null, duration = 4000) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    let html = `<span>${message}</span>`;
    if (actionLabel && actionFn) {
        const actionId = 'toast-action-' + Date.now();
        html += `<button class="toast-action" id="${actionId}">${actionLabel}</button>`;
        toast.innerHTML = html;
        container.appendChild(toast);
        document.getElementById(actionId).addEventListener('click', (e) => {
            e.stopPropagation();
            actionFn();
            toast.remove();
        });
    } else {
        toast.innerHTML = html;
        container.appendChild(toast);
    }
    setTimeout(() => { if (toast.parentNode) toast.remove(); }, duration);
}

function setBtnLoading(btn, isLoading, originalText = "Salvar") {
    if (!btn) return;
    if (isLoading) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Carregando...`;
    } else {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

// --- INICIALIZAÇÃO ---
async function initApp() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) { window.location.href = 'login.html'; return; }

    currentUser = session.user;
    const name = currentUser.user_metadata.full_name || currentUser.email.split('@')[0];
    document.getElementById('greeting-text').textContent = `Onde comer hoje, ${name}?`;
    
    await carregarPerfil(); // Isso agora carrega favoriteFoods do banco
    await carregarRestaurantes();

    if (!userPreferences || userPreferences.length === 0) {
        openModal('onboarding-modal');
    }

    // --- CORREÇÃO DA BUSCA: Dropdown sem perder o foco ---
    const searchInput = document.getElementById('search-rest');
    const searchDropdown = document.getElementById('search-dropdown');
    
    if (searchInput && searchDropdown) {
        searchInput.addEventListener('input', (e) => {
            const termo = e.target.value.toLowerCase().trim();
            if (termo.length < 1) {
                searchDropdown.classList.remove('active');
                return;
            }

            const resultados = allRestaurants.filter(rest => 
                rest.name.toLowerCase().includes(termo) || 
                (rest.category && rest.category.toLowerCase().includes(termo)) ||
                (rest.dishes && rest.dishes.some(d => d.name.toLowerCase().includes(termo)))
            ).slice(0, 5); // Limita a 5 resultados

            if (resultados.length === 0) {
                searchDropdown.innerHTML = `<div class="search-result-item" style="color:var(--text-light);">Nenhum resultado encontrado.</div>`;
            } else {
                searchDropdown.innerHTML = resultados.map(rest => `
                    <div class="search-result-item" onclick="openRestaurantDetails(${rest.id}); document.getElementById('search-dropdown').classList.remove('active'); document.getElementById('search-rest').value = '';">
                        <img src="https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=100&q=80">
                        <div>
                            <strong>${rest.name}</strong>
                            <span>${rest.category || 'Restaurante'}</span>
                        </div>
                    </div>
                `).join('');
            }
            searchDropdown.classList.add('active');
        });

        // Fecha o dropdown ao clicar fora
        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && !searchDropdown.contains(e.target)) {
                searchDropdown.classList.remove('active');
            }
        });
    }

    await carregarSugestoesSidebar();
    await carregarRecomendacoes();
    await carregarFeed();
    await carregarDiario();

    setupGlobalUX();
}
initApp();

// --- UX GLOBAL (Heurísticas 3 e 7) ---
function setupGlobalUX() {
    // Esc fecha modal ativo
    document.addEventListener('keydown', (e) => {
        const activeModal = document.querySelector('.modal-overlay.active');
        const tag = (e.target.tagName || '').toLowerCase();
        const typing = tag === 'input' || tag === 'textarea' || tag === 'select';

        if (e.key === 'Escape' && activeModal) {
            requestCloseModal(activeModal.id);
            return;
        }

        // Atalhos só fora de campos de texto
        if (typing) {
            // Ctrl/Cmd + Enter salva no modal de nova review
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && activeModal && activeModal.id === 'new-review-modal') {
                e.preventDefault();
                saveReview();
            }
            return;
        }

        if ((e.key === 'n' || e.key === 'N') && !activeModal) {
            e.preventDefault();
            openNewReviewModal();
        }
        if (e.key === '/' && !activeModal) {
            e.preventDefault();
            const search = document.getElementById('search-rest');
            if (search) { switchView('home'); search.focus(); }
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && activeModal && activeModal.id === 'new-review-modal') {
            e.preventDefault();
            saveReview();
        }
    });

    // Clique no overlay fecha (com checagem de dirty)
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) requestCloseModal(overlay.id);
        });
    });

    // Marca formulário de review como dirty
    ['review-dish', 'review-price', 'review-text', 'review-location', 'review-category', 'review-rating', 'photo-upload',
     'edit-review-dish', 'edit-review-price', 'edit-review-text', 'edit-review-date', 'edit-photo-upload'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('input', () => { formDirty = true; });
        el.addEventListener('change', () => { formDirty = true; });
    });

    // Drag and drop na área de foto
    const dropArea = document.getElementById('photo-preview-area');
    const fileInput = document.getElementById('photo-upload');
    if (dropArea && fileInput) {
        ['dragenter', 'dragover'].forEach(evt => {
            dropArea.addEventListener(evt, (e) => {
                e.preventDefault(); e.stopPropagation();
                dropArea.classList.add('drag-over');
            });
        });
        ['dragleave', 'drop'].forEach(evt => {
            dropArea.addEventListener(evt, (e) => {
                e.preventDefault(); e.stopPropagation();
                dropArea.classList.remove('drag-over');
            });
        });
        dropArea.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            if (files && files[0] && files[0].type.startsWith('image/')) {
                const dt = new DataTransfer();
                dt.items.add(files[0]);
                fileInput.files = dt.files;
                previewImage({ target: fileInput });
                formDirty = true;
            }
        });
    }
}

function requestCloseModal(id) {
    if (!id) return;
    const isDirtyForm = (id === 'new-review-modal' || id === 'edit-review-modal') && formDirty;
    if (isDirtyForm) {
        openUnsavedWarning(id);
        return;
    }
    closeModal(id);
}

function openUnsavedWarning(modalId) {
    const existing = document.getElementById('unsaved-warning');
    if (existing) existing.remove();
    const box = document.createElement('div');
    box.id = 'unsaved-warning';
    box.className = 'unsaved-warning-overlay';
    box.innerHTML = `
        <div class="unsaved-warning-card">
            <h3>Alterações não salvas</h3>
            <p>Você tem alterações que serão perdidas. Deseja sair mesmo assim?</p>
            <div class="unsaved-warning-actions">
                <button class="btn-text" id="unsaved-stay">Continuar editando</button>
                <button class="btn-danger" id="unsaved-leave">Sair e perder</button>
            </div>
        </div>`;
    document.body.appendChild(box);
    document.getElementById('unsaved-stay').onclick = () => box.remove();
    document.getElementById('unsaved-leave').onclick = () => {
        box.remove();
        formDirty = false;
        closeModal(modalId);
    };
}

function pularOnboarding() {
    closeModal('onboarding-modal');
    showToast('Você pode configurar preferências depois no perfil.', 'info');
}


async function fazerLogout() { 
    try { await supabaseClient.auth.signOut(); window.location.href = 'login.html'; } 
    catch (err) { window.location.href = 'login.html'; }
}

// --- PERFIL E TAGS ---
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

        // Puxa as preferências do banco
        userPreferences = data.food_preferences || [];
        
        // Puxa as tags de comidas favoritas do banco (NOVA COLUNA)
        favoriteFoods = data.favorite_foods || [];
        
        renderizarFavoritos();
        renderizarPreferencias();
        const favStat = document.getElementById('stat-favorites');
        if (favStat) favStat.innerText = favoriteFoods.length;
    }
}

function renderizarPreferencias() {
    const container = document.getElementById('prefs-chips-container');
    if (!container) return;
    const prefs = userPreferences || [];
    if (!prefs.length) {
        container.innerHTML = `<span class="text-light">Nenhuma preferência definida. <button class="btn-link" onclick="reabrirOnboarding()">Configurar</button></span>`;
        return;
    }
    const icons = {
        'Como de tudo': '🍖', 'Vegetariano': '🥗', 'Vegano': '🌱',
        'Sem Japonesa': '🍣', 'Sem Gordurosa': '🍔', 'Sem Doce': '🍰',
        'Sem Apimentada': '🌶️', 'Sem Frutos do Mar': '🦐'
    };
    container.innerHTML = prefs.map(p => {
        const icon = icons[p] || '✨';
        return `<span class="pref-chip">${icon} ${p}</span>`;
    }).join('');
}

function reabrirOnboarding() {
    // pré-seleciona chips atuais
    tempDiet = null;
    tempAvoid = [];
    document.querySelectorAll('#diet-options .preference-chip').forEach(c => {
        c.classList.remove('active');
        if ((userPreferences || []).includes(c.getAttribute('data-value'))) {
            c.classList.add('active');
            tempDiet = c.getAttribute('data-value');
        }
    });
    document.querySelectorAll('#avoid-options .preference-chip').forEach(c => {
        c.classList.remove('active');
        const v = c.getAttribute('data-value');
        if ((userPreferences || []).includes(v)) {
            c.classList.add('active');
            if (!tempAvoid.includes(v)) tempAvoid.push(v);
        }
    });
    openModal('onboarding-modal');
}


function openTagSelectionModal() {
    if (favoriteFoods.length >= 5) {
        return showToast("Você já tem 5 comidas favoritas. Remova alguma para adicionar outra.", "error");
    }
    pendingTagsSelection = [];
    const search = document.getElementById('search-tag-input');
    if (search) search.value = '';
    renderizarTagsDisponiveis();
    atualizarContadorTags();
    openModal('tag-selection-modal');
}

function renderizarTagsDisponiveis() {
    const grid = document.getElementById('tags-grid');
    if (!grid) return;
    const termo = (document.getElementById('search-tag-input')?.value || '').toLowerCase();
    const slotsRestantes = 5 - favoriteFoods.length;

    const disponiveis = POPULAR_FOODS.filter(f =>
        !favoriteFoods.some(ff => ff.toLowerCase() === f.toLowerCase()) &&
        f.toLowerCase().includes(termo)
    );

    if (disponiveis.length === 0) {
        grid.innerHTML = `<p class="text-light" style="grid-column:1/-1;text-align:center;padding:20px 0;">Nenhuma opção encontrada. Adicione uma personalizada abaixo!</p>`;
        return;
    }

    grid.innerHTML = disponiveis.map(food => {
        const selected = pendingTagsSelection.includes(food);
        const safe = food.replace(/'/g, "\\'");
        return `<div class="tag-option ${selected ? 'selected' : ''}" onclick="toggleTagSelection('${safe}')">
            <span>${food}</span>
            ${selected ? '<i class="fas fa-check"></i>' : ''}
        </div>`;
    }).join('');
}

function filtrarTagsDisponiveis() { renderizarTagsDisponiveis(); }

function toggleTagSelection(food) {
    const idx = pendingTagsSelection.indexOf(food);
    if (idx >= 0) {
        pendingTagsSelection.splice(idx, 1);
    } else {
        const total = favoriteFoods.length + pendingTagsSelection.length;
        if (total >= 5) {
            return showToast("Limite de 5 comidas favoritas.", "error");
        }
        // anti-conflito antes de marcar
        if (!validarTagSemConflito(food)) return;
        pendingTagsSelection.push(food);
    }
    renderizarTagsDisponiveis();
    atualizarContadorTags();
}

function atualizarContadorTags() {
    const el = document.getElementById('tag-selection-count');
    if (!el) return;
    const total = favoriteFoods.length + pendingTagsSelection.length;
    el.textContent = `${total}/5 selecionadas`;
    const btn = document.getElementById('btn-confirm-tags');
    if (btn) {
        btn.disabled = pendingTagsSelection.length === 0;
        btn.innerHTML = pendingTagsSelection.length
            ? `<i class="fas fa-check"></i> Confirmar (${pendingTagsSelection.length})`
            : `<i class="fas fa-check"></i> Confirmar seleção`;
    }
}

function validarTagSemConflito(newTag) {
    const tagLower = newTag.toLowerCase();
    const prefsLower = (userPreferences || []).map(p => p.toLowerCase());
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
    for (const [termo, restricoes] of Object.entries(conflitos)) {
        if (tagLower.includes(termo)) {
            const r = restricoes.find(x => prefsLower.includes(x));
            if (r) {
                let nome = r.replace('sem ', '').replace('japonesa', 'Comida Japonesa').replace('gordurosa', 'Comida Gordurosa');
                if (r === 'vegano') nome = 'Vegano';
                if (r === 'vegetariano') nome = 'Vegetariano';
                showToast(`Conflito! Você evita ${nome}, mas quer adicionar "${newTag}".`, "error");
                return false;
            }
        }
    }
    return true;
}

async function confirmarSelecaoTags() {
    if (pendingTagsSelection.length === 0) return;
    for (const tag of pendingTagsSelection) {
        if (favoriteFoods.length >= 5) break;
        if (!favoriteFoods.some(t => t.toLowerCase() === tag.toLowerCase())) {
            favoriteFoods.push(tag);
        }
    }
    pendingTagsSelection = [];
    await salvarFavoritosBanco();
    closeModal('tag-selection-modal');
    showToast("Comidas favoritas atualizadas!", "success");
}

function addCustomTag() {
    const input = document.getElementById('new-fav-tag');
    const val = (input?.value || '').trim();
    if (!val) return;
    if (favoriteFoods.length + pendingTagsSelection.length >= 5) {
        return showToast("Limite de 5 comidas favoritas.", "error");
    }
    if (favoriteFoods.some(t => t.toLowerCase() === val.toLowerCase()) || pendingTagsSelection.some(t => t.toLowerCase() === val.toLowerCase())) {
        return showToast("Você já adicionou essa comida.", "error");
    }
    if (!validarTagSemConflito(val)) return;
    pendingTagsSelection.push(val);
    input.value = '';
    renderizarTagsDisponiveis();
    atualizarContadorTags();
}

async function removerFavorito(index) {
    favoriteFoods.splice(index, 1);
    await salvarFavoritosBanco();
}

async function salvarFavoritosBanco() {
    renderizarFavoritos();
    // SALVA NO BANCO DE DADOS
    try {
        await supabaseClient.from('profiles').update({ favorite_foods: favoriteFoods }).eq('id', currentUser.id);
        carregarSugestoesSidebar();
        carregarFeed();
    } catch (e) {
        console.error("Erro ao salvar tags", e);
    }
}

function renderizarFavoritos() {
    const container = document.getElementById('favorite-tags-container');
    if (!container) return;

    const favStat = document.getElementById('stat-favorites');
    if (favStat) favStat.innerText = favoriteFoods.length;

    const warning = document.getElementById('tag-limit-warning');
    if (warning) warning.style.display = favoriteFoods.length >= 5 ? 'block' : 'none';

    if (!favoriteFoods.length) {
        container.innerHTML = `<p class="empty-inline">Nenhuma comida favorita ainda. Toque em <strong>Adicionar</strong> para personalizar o feed.</p>`;
        return;
    }

    container.innerHTML = favoriteFoods.map((tag, index) => `
        <span class="fav-tag">${tag} <i class="fas fa-times" onclick="removerFavorito(${index})" title="Remover"></i></span>
    `).join('');
}

// --- FILTROS ---
function filtrarRestaurantes(rests, prefs) {
    if (!prefs || prefs.length === 0) return rests; 
    try {
        return rests.filter(r => {
            if (prefs.includes('Vegano') && (!r.dishes || !r.dishes.some(d => d.is_vegan))) return false;
            if (prefs.includes('Vegetariano') && (!r.dishes || !r.dishes.some(d => d.is_vegan || d.is_vegetarian))) return false;
            if (prefs.includes('Sem Japonesa') && r.category === 'Japonesa') return false;
            if (prefs.includes('Sem Gordurosa') && r.category === 'Hamburguer') return false; 
            if (prefs.includes('Sem Doce') && r.category === 'Doces') return false;
            return true;
        });
    } catch (err) { return rests; }
}

function restauranteTemTagFavorita(rest) {
    if (!favoriteFoods || favoriteFoods.length === 0) return false;
    const categoria = (rest.category || '').toLowerCase();
    const nomesPratos = (rest.dishes || []).map(d => d.name.toLowerCase());
    const nomeRest = (rest.name || '').toLowerCase();
    return favoriteFoods.some(fav => {
        const f = fav.toLowerCase();
        return categoria.includes(f) || nomeRest.includes(f) || nomesPratos.some(prato => prato.includes(f));
    });
}

async function surpreendaMe() {
    const validRestaurants = filtrarRestaurantes(allRestaurants, userPreferences);
    if (validRestaurants.length === 0) return showToast("Nenhum restaurante atende às suas restrições.", "error");

    let opcoesFinais = validRestaurants.filter(r => restauranteTemTagFavorita(r));
    if (opcoesFinais.length === 0) opcoesFinais = validRestaurants;

    const escolhido = opcoesFinais[Math.floor(Math.random() * opcoesFinais.length)];
    const motivo = restauranteTemTagFavorita(escolhido) ? ` (Você ama ${escolhido.category}!)` : '';
    showToast(`Que tal comer em ${escolhido.name} hoje?${motivo}`, "success");
    openRestaurantDetails(escolhido.id);
}

// --- FEED ---
async function carregarSugestoesSidebar() {
    let validRestaurants = filtrarRestaurantes(allRestaurants, userPreferences);
    validRestaurants.sort((a, b) => (restauranteTemTagFavorita(b) ? 1 : 0) - (restauranteTemTagFavorita(a) ? 1 : 0));

    const sorteados = validRestaurants.slice(0, 4);
    const container = document.getElementById('sidebar-suggestions');
    if (sorteados.length === 0) { container.innerHTML = `<p class="text-light" style="font-size:12px;">Sem sugestões.</p>`; return; }

    container.innerHTML = sorteados.map(rest => {
        let img = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=100&q=80';
        if (rest.reviews && rest.reviews.length > 0 && rest.reviews[0].food_photo_url) img = rest.reviews[0].food_photo_url;
        return `
            <div class="suggestion-item">
                <img src="${img}" style="border-radius: 8px;">
                <div class="suggestion-info">
                    <strong>${rest.name}</strong><span>${rest.category || 'Restaurante'}</span>
                </div>
                <button class="btn-follow" onclick="openRestaurantDetails(${rest.id})">Ver</button>
            </div>
        `;
    }).join('');
}

async function carregarFeed() {
    const feedContainer = document.getElementById('home-feed-container');
    if (!feedContainer) return;
    try {
        const validRestaurants = filtrarRestaurantes(allRestaurants, userPreferences);
        let validIds = validRestaurants.length > 0 ? validRestaurants.map(r => r.id) : [];
        if (validIds.length === 0) { feedContainer.innerHTML = `<p class="text-light text-center">Sem avaliações para suas preferências.</p>`; return; }

        const { data, error } = await supabaseClient.from('reviews')
            .select(`*, restaurants (id, name, category), dishes (name), profiles (full_name, avatar_url)`)
            .in('restaurant_id', validIds).order('created_at', { ascending: false }).limit(15);
    
        if (error) throw error;
        if (!data || data.length === 0) { feedContainer.innerHTML = `<p class="text-light text-center">Nenhuma avaliação ainda.</p>`; return; }
    
        if (favoriteFoods.length > 0) {
            data.sort((a, b) => {
                const aFav = restauranteTemTagFavorita({category: a.restaurants?.category, name: a.restaurants?.name, dishes: [a.dishes]}) ? 1 : 0;
                const bFav = restauranteTemTagFavorita({category: b.restaurants?.category, name: b.restaurants?.name, dishes: [b.dishes]}) ? 1 : 0;
                return bFav - aFav;
            });
        }

        feedContainer.innerHTML = data.slice(0, 10).map(r => {
            const preco = r.price_paid ? Number(r.price_paid).toFixed(2).replace('.', ',') : '0,00';
            const autor = r.profiles?.full_name || 'Alguém';
            const avatarAutor = r.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${autor}&background=random`;
            const dataReview = new Date(r.created_at);
            const diffDias = Math.floor((new Date() - dataReview) / (1000 * 60 * 60 * 24));
            const tempo = diffDias === 0 ? 'hoje' : (diffDias === 1 ? 'ontem' : `há ${diffDias} dias`);

            const isMine = r.user_id === currentUser.id;
            const btnActions = isMine ? `
                <div class="feed-actions">
                    <button class="btn-icon" title="Comi de novo" onclick="event.stopPropagation(); repetirRefeicao(${r.id})"><i class="fas fa-redo"></i></button>
                    <button class="btn-icon" title="Editar" onclick="event.stopPropagation(); abrirModalEditarReview(${r.id})"><i class="fas fa-pen"></i></button>
                    <button class="btn-icon btn-icon-danger" title="Excluir" onclick="event.stopPropagation(); excluirReviewComUndo(${r.id})"><i class="fas fa-trash"></i></button>
                </div>` : '';

            return `
                <div class="feed-card" id="feed-card-${r.id}">
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
                        ${btnActions}
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        feedContainer.innerHTML = `<p class="text-light text-center">Erro ao carregar o feed.</p>`; 
    }
}

async function carregarRestaurantes() {
    const { data, error } = await supabaseClient
        .from('restaurants').select(`id, name, category, dishes (name, is_vegetarian, is_vegan), reviews (rating, food_photo_url)`).order('name', { ascending: true });
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
                    <div class="rest-stats"><span class="star">★ ${mediaNota}</span> · <span>Provado por ${totalReviews}</span></div>
                    <div class="rest-category">${rest.category || 'Geral'}</div>
                    <div class="rest-dishes-text">${pratosTexto}</div>
                </div>
            </div>
        `;
    }).join('');
}

async function carregarDiario() {
    const { data } = await supabaseClient.from('reviews').select(`*, restaurants (id, name, category), dishes (name)`).eq('user_id', currentUser.id).order('created_at', { ascending: false });
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
    myReviewsCache = data || [];
    grid.innerHTML = data.map(review => {
        const preco = review.price_paid != null ? Number(review.price_paid).toFixed(2).replace('.', ',') : '—';
        const dataStr = review.eaten_at
            ? new Date(review.eaten_at).toLocaleDateString('pt-BR')
            : new Date(review.created_at).toLocaleDateString('pt-BR');
        const prato = review.dishes?.name || 'Prato';
        const rest = review.restaurants?.name || 'Restaurante';
        const foto = review.food_photo_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=200&q=80';
        return `
        <div class="diary-card" id="diary-item-${review.id}">
            <img class="diary-card-img" src="${foto}" alt="${prato}" onclick="openRestaurantDetails(${review.restaurant_id})">
            <div class="diary-card-body">
                <div class="diary-card-top">
                    <h4 onclick="openRestaurantDetails(${review.restaurant_id})">${prato}</h4>
                    <span class="diary-card-rating">★ ${review.rating}</span>
                </div>
                <p class="diary-card-meta">${rest} · R$ ${preco} · ${dataStr}</p>
                <p class="diary-card-text">"${review.review_text || 'Sem comentário.'}"</p>
                <div class="diary-card-actions">
                    <button class="btn-chip" onclick="repetirRefeicao(${review.id})"><i class="fas fa-redo"></i> De novo</button>
                    <button class="btn-chip" onclick="abrirModalEditarReview(${review.id})"><i class="fas fa-pen"></i> Editar</button>
                    <button class="btn-chip btn-chip-danger" onclick="excluirReviewComUndo(${review.id})"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        </div>`;
    }).join('');
}

// --- EXCLUIR COM UNDO (Heurística 3) ---
async function excluirReviewComUndo(reviewId) {
    // busca dados para poder restaurar
    const { data: review, error } = await supabaseClient.from('reviews').select('*').eq('id', reviewId).single();
    if (error || !review) return showToast("Não foi possível excluir.", "error");

    // remove da UI imediatamente
    const feedCard = document.getElementById(`feed-card-${reviewId}`);
    const diaryItem = document.getElementById(`diary-item-${reviewId}`);
    if (feedCard) feedCard.style.display = 'none';
    if (diaryItem) diaryItem.style.display = 'none';

    // cancela delete pendente anterior
    if (pendingDeleteTimer) {
        clearTimeout(pendingDeleteTimer);
        // se havia outro pendente, confirma exclusão anterior agora
        if (pendingDeleteReview) {
            await supabaseClient.from('reviews').delete().eq('id', pendingDeleteReview.id);
        }
    }

    pendingDeleteReview = { id: reviewId, data: review };

    showToast("Avaliação excluída.", "info", "DESFAZER", () => {
        desfazerExclusaoReview();
    }, 5000);

    pendingDeleteTimer = setTimeout(async () => {
        if (pendingDeleteReview && pendingDeleteReview.id === reviewId) {
            await supabaseClient.from('reviews').delete().eq('id', reviewId);
            pendingDeleteReview = null;
            pendingDeleteTimer = null;
            carregarDiario();
            carregarRestaurantes();
        }
    }, 5000);
}

async function desfazerExclusaoReview() {
    if (!pendingDeleteReview) return;
    clearTimeout(pendingDeleteTimer);
    pendingDeleteTimer = null;

    const feedCard = document.getElementById(`feed-card-${pendingDeleteReview.id}`);
    const diaryItem = document.getElementById(`diary-item-${pendingDeleteReview.id}`);
    if (feedCard) feedCard.style.display = '';
    if (diaryItem) diaryItem.style.display = '';

    pendingDeleteReview = null;
    showToast("Exclusão desfeita.", "success");
}

// --- REPETIR REFEIÇÃO (Heurística 7) ---
async function repetirRefeicao(reviewId) {
    let review = myReviewsCache.find(r => r.id === reviewId);
    if (!review) {
        const { data } = await supabaseClient
            .from('reviews')
            .select(`*, restaurants (id, name, category), dishes (name)`)
            .eq('id', reviewId)
            .single();
        review = data;
    }
    if (!review) return showToast("Não foi possível carregar a refeição.", "error");

    openNewReviewModal();
    setTimeout(() => {
        const restName = review.restaurants?.name || '';
        const dishName = review.dishes?.name || '';
        const category = review.restaurants?.category || '';
        const price = review.price_paid != null ? Number(review.price_paid).toFixed(2).replace('.', ',') : '';

        const loc = document.getElementById('review-location');
        const dish = document.getElementById('review-dish');
        const cat = document.getElementById('review-category');
        const priceEl = document.getElementById('review-price');
        const rating = document.getElementById('review-rating');

        if (loc && restName) {
            // garante option
            if (![...loc.options].some(o => o.value === restName)) {
                loc.innerHTML += `<option value="${restName}">${restName}</option>`;
            }
            loc.value = restName;
        }
        if (dish) dish.value = dishName;
        if (cat && category) cat.value = category;
        if (priceEl) priceEl.value = price;
        if (rating) rating.value = review.rating || 5;
        formDirty = true;
        showToast("Dados preenchidos! Só tire a nova foto e salve.", "success");
    }, 150);
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

    if (totalReviews === 0) { dishesContainer.innerHTML = `<p class="text-light text-center" style="padding: 20px;">Nenhum prato.</p>`; return; }

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
            if (!map) { await carregarMapa(); } else { map.invalidateSize(); }
        }, 150);
    }
}
 
function openModal(id) {
    document.getElementById(id).classList.add('active');
    document.body.style.overflow = 'hidden';
}
function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
    document.body.style.overflow = '';
    if (id === 'new-review-modal' || id === 'edit-review-modal') formDirty = false;
}

function openNewReviewModal() {
    popularSelectRestaurantes();
    document.getElementById('review-dish').value = '';
    document.getElementById('review-price').value = '';
    document.getElementById('review-text').value = '';
    document.getElementById('photo-upload').value = '';
    document.getElementById('photo-preview-area').innerHTML = `<i class="fas fa-camera"></i><span>Adicionar foto do prato</span><small class="upload-hint">Clique ou arraste a imagem</small>`;
    document.getElementById('dish-vegetarian').checked = false;
    document.getElementById('dish-vegan').checked = false;
    document.getElementById('review-location').value = '';
    document.getElementById('review-category').value = '';
    document.getElementById('new-rest-container').style.display = 'none';
    document.getElementById('review-date').value = new Date().toISOString().split('T')[0];
    formDirty = false;
    openModal('new-review-modal');
}

function cancelarNovaReview() {
    requestCloseModal('new-review-modal');
}

function popularSelectRestaurantes() {
    const select = document.getElementById('review-location');
    select.innerHTML = '<option value="" disabled selected>Selecione o restaurante...</option>';
    allRestaurants.forEach(rest => {
        select.innerHTML += `<option value="${rest.name}" data-category="${rest.category || ''}">${rest.name}</option>`;
    });
}

function onRestaurantChange(select) {
    const opt = select.options[select.selectedIndex];
    const cat = opt?.getAttribute('data-category');
    const catSelect = document.getElementById('review-category');
    if (cat && catSelect) {
        // tenta casar categoria
        const match = [...catSelect.options].find(o => o.value === cat);
        if (match) catSelect.value = cat;
    }
    formDirty = true;
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
    const btn = document.querySelector('#new-review-modal .btn-primary.btn-block');
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
    
    setBtnLoading(btn, true, "Salvar no Diário");
 
    try {
        const compressedFile = await imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 1280, useWebWorker: true });
        const fileName = `foods/${Date.now()}.${compressedFile.name.split('.').pop()}`;
        const { error: uploadError } = await supabaseClient.storage.from('food-images').upload(fileName, compressedFile);
        if (uploadError) throw new Error("Erro no upload da foto.");
        
        const { data: publicUrl } = supabaseClient.storage.from('food-images').getPublicUrl(fileName);
 
        let { data: rest } = await supabaseClient.from('restaurants').select('id').eq('name', location).maybeSingle();
        
        let restId;
        if (rest?.id) {
            restId = rest.id;
        } else {
            // USA A NOVA RPC DO BACKEND
            const latBase = -26.2333; const lngBase = -51.0833;
            const latRandom = latBase + (Math.random() - 0.5) * 0.015;
            const lngRandom = lngBase + (Math.random() - 0.5) * 0.015;

            const { data: newRestId, error: restError } = await supabaseClient.rpc('create_restaurant', { 
                rest_name: location, 
                rest_category: category, 
                lat: latRandom, 
                lng: lngRandom 
            });
            
            if (restError) throw new Error("Erro ao criar restaurante: " + restError.message);
            restId = newRestId; // A RPC retorna o ID direto
        }
 
        let { data: dishData } = await supabaseClient.from('dishes').select('id').eq('restaurant_id', restId).eq('name', dish).maybeSingle();
        let dishId;
        if(dishData?.id) {
            dishId = dishData.id;
        } else {
            const { data: newDish, error: dishError } = await supabaseClient.from('dishes').insert([{ restaurant_id: restId, name: dish, is_vegetarian: document.getElementById('dish-vegetarian').checked, is_vegan: document.getElementById('dish-vegan').checked }]).select().single();
            if (dishError || !newDish) throw new Error("Erro ao criar prato.");
            dishId = newDish.id;
        }
 
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
    } finally {
        setBtnLoading(btn, false, "Salvar no Diário");
    }
}

// --- MAPA ---
async function carregarMapa() {
    const mapContainer = document.getElementById('map');
    if (!mapContainer || typeof L === 'undefined') return;

    if (!map) {
        map = L.map('map').setView([-26.2333, -51.0833], 14); 
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(map);
    }
    setTimeout(() => map.invalidateSize(), 100);

    const localizacoesFixas = {
        'Burger do Zé': [-26.2286, -51.0869], 'Sushi Yamato': [-26.2389, -51.0783],
        'Cantina da Nonna': [-26.2200, -51.0800], 'Churrascaria Gaúcha': [-26.2450, -51.0750],
        'Sushi União': [-26.2400, -51.0800], 'Burger da Fronteira': [-26.2250, -51.0850],
        'Pizzaria Forno a Lenha': [-26.2180, -51.0820], 'Restaurante do Porto': [-26.2420, -51.0720],
        'Vegano do Vale': [-26.2333, -51.0833]
    };

    const { data: rpcData } = await supabaseClient.rpc('get_restaurants_with_coords');
    const coordsMap = {};
    if (rpcData) rpcData.forEach(r => { coordsMap[r.id] = { lat: r.lat, lng: r.lng }; });
    
    mapMarkers.forEach(marker => map.removeLayer(marker));
    mapMarkers = [];

    allRestaurants.forEach(rest => {
        let lat = coordsMap[rest.id]?.lat;
        let lng = coordsMap[rest.id]?.lng;

        if (!lat || !lng) {
            if (localizacoesFixas[rest.name]) {
                lat = localizacoesFixas[rest.name][0]; lng = localizacoesFixas[rest.name][1];
            } else {
                lat = -26.2333 + (Math.random() - 0.5) * 0.015; lng = -51.0833 + (Math.random() - 0.5) * 0.015;
            }
        }

        if (lat && lng) {
            const marker = L.marker([lat, lng]).addTo(map);
            marker.bindPopup(`<strong>${rest.name}</strong><br>${rest.category || ''}<br>
                <button onclick="openRestaurantDetails(${rest.id})" style="margin-top:8px; cursor:pointer; background:#ff5a36; color:white; border:none; padding:6px 12px; border-radius:6px;">Ver detalhes</button>`);
            mapMarkers.push(marker);
        }
    });

    if (mapMarkers.length > 0) map.fitBounds(new L.featureGroup(mapMarkers).getBounds().pad(0.2));
}

// --- PERFIL E ONBOARDING ---
function openEditProfileModal() {
    document.getElementById('edit-profile-name').value = document.getElementById('profile-name-display').textContent;
    document.getElementById('avatar-preview-area').innerHTML = `<img src="${document.getElementById('profile-avatar-img').src}">`;
    openModal('edit-profile-modal');
}

function previewAvatar(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) { document.getElementById('avatar-preview-area').innerHTML = `<img src="${e.target.result}">`; }
        reader.readAsDataURL(file);
    }
}

async function salvarPerfil() {
    const btn = document.querySelector('#edit-profile-modal .btn-primary');
    const novoNome = document.getElementById('edit-profile-name').value;
    const file = document.getElementById('avatar-upload').files[0];
    let novaUrl = document.getElementById('profile-avatar-img').src;

    if (!novoNome) return showToast("O nome não pode ficar vazio.", "error");
    setBtnLoading(btn, true, "Salvar Alterações");

    try {
        if (file) {
            const compressedFile = await imageCompression(file, { maxSizeMB: 0.5, maxWidthOrHeight: 400, useWebWorker: true });
            const fileName = `${currentUser.id}-${Date.now()}.jpeg`;
            const { error: uploadError } = await supabaseClient.storage.from('avatars').upload(fileName, compressedFile);
            if (uploadError) throw new Error("Erro no upload da foto.");
            novaUrl = supabaseClient.storage.from('avatars').getPublicUrl(fileName).data.publicUrl;
        }

        const { error } = await supabaseClient.from('profiles').update({ full_name: novoNome, avatar_url: novaUrl }).eq('id', currentUser.id);
        if (error) throw error;

        showToast("Perfil atualizado!", "success");
        closeModal('edit-profile-modal');
        carregarPerfil();
        carregarFeed();
    } catch (error) {
        showToast(error.message, "error");
    } finally {
        setBtnLoading(btn, false, "Salvar Alterações");
    }
}

function selectSinglePreference(element, group) {
    const parent = element.parentElement;
    parent.querySelectorAll('.preference-chip').forEach(c => c.classList.remove('active'));
    element.classList.add('active');
    if (group === 'diet') tempDiet = element.getAttribute('data-value');
}

function toggleMultiPreference(element, group) {
    element.classList.toggle('active');
    const value = element.getAttribute('data-value');
    if (element.classList.contains('active')) { if (!tempAvoid.includes(value)) tempAvoid.push(value); } 
    else { tempAvoid = tempAvoid.filter(v => v !== value); }
}

async function salvarPreferencias() {
    if (!tempDiet) return showToast("Por favor, selecione sua dieta.", "error");
    const btn = document.querySelector('#onboarding-modal .btn-primary');
    setBtnLoading(btn, true, "Salvar e começar a explorar");

    try {
        const finalPrefs = [tempDiet, ...tempAvoid];
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
    } finally {
        setBtnLoading(btn, false, "Salvar e começar a explorar");
    }
}

async function carregarRecomendacoes() {
    let validRestaurants = filtrarRestaurantes(allRestaurants, userPreferences);
    const recs = validRestaurants.sort((a, b) => {
        const avgA = a.reviews?.length ? a.reviews.reduce((s, r) => s + r.rating, 0) / a.reviews.length : 0;
        const avgB = b.reviews?.length ? b.reviews.reduce((s, r) => s + r.rating, 0) / b.reviews.length : 0;
        const aFav = restauranteTemTagFavorita(a) ? 10 : 0; const bFav = restauranteTemTagFavorita(b) ? 10 : 0;
        return (avgB + bFav) - (avgA + aFav);
    }).slice(0, 5);

    const container = document.getElementById('recommendations-container');
    if (recs.length === 0) { container.innerHTML = `<p class="text-light" style="font-size:12px;">Sem recomendações.</p>`; return; }
    container.innerHTML = recs.map(rec => {
        let imgUrl = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=150&q=80';
        if (rec.reviews && rec.reviews.length > 0 && rec.reviews[0].food_photo_url) imgUrl = rec.reviews[0].food_photo_url;
        return `<div class="story" onclick="openRestaurantDetails(${rec.id})"><div class="story-ring"><img src="${imgUrl}" class="story-img" alt="${rec.name}"></div><span>${rec.name}</span></div>`;
    }).join('');
}

async function abrirModalEditarReview(id) {
    const { data, error } = await supabaseClient
        .from('reviews')
        .select(`*, dishes (id, name)`)
        .eq('id', id)
        .single();
    if (error || !data) return showToast("Erro ao carregar avaliação.", "error");

    document.getElementById('edit-review-id').value = id;
    document.getElementById('edit-review-photo-url').value = data.food_photo_url || '';
    document.getElementById('edit-review-dish').value = data.dishes?.name || '';
    document.getElementById('edit-review-text').value = data.review_text || '';
    document.getElementById('edit-review-rating').value = data.rating || 5;
    document.getElementById('edit-photo-upload').value = '';

    const price = data.price_paid != null ? Number(data.price_paid).toFixed(2).replace('.', ',') : '';
    document.getElementById('edit-review-price').value = price;

    const dateVal = data.eaten_at
        ? new Date(data.eaten_at).toISOString().split('T')[0]
        : new Date(data.created_at).toISOString().split('T')[0];
    document.getElementById('edit-review-date').value = dateVal;

    const preview = document.getElementById('edit-photo-preview-area');
    if (data.food_photo_url) {
        preview.innerHTML = `<img src="${data.food_photo_url}" alt="Foto">`;
    } else {
        preview.innerHTML = `<i class="fas fa-camera"></i><span>Trocar foto do prato</span><small class="upload-hint">Opcional</small>`;
    }

    setEditRating(data.rating || 5);
    updateEditCharCount();
    formDirty = false;
    openModal('edit-review-modal');
}

function setEditRating(v) {
    const val = Math.min(5, Math.max(1, parseInt(v) || 5));
    document.getElementById('edit-review-rating').value = val;
    document.querySelectorAll('#edit-star-picker button').forEach(btn => {
        const n = parseInt(btn.getAttribute('data-v'));
        btn.classList.toggle('active', n <= val);
    });
    formDirty = true;
}

function updateEditCharCount() {
    const t = document.getElementById('edit-review-text');
    const c = document.getElementById('edit-text-count');
    if (t && c) c.textContent = `${(t.value || '').length}/280`;
}

function previewEditImage(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        document.getElementById('edit-photo-preview-area').innerHTML = `<img src="${e.target.result}" alt="Nova foto">`;
    };
    reader.readAsDataURL(file);
    formDirty = true;
}

async function salvarEdicaoReview() {
    const btn = document.querySelector('#edit-review-modal .btn-primary');
    const id = document.getElementById('edit-review-id').value;
    const rating = parseInt(document.getElementById('edit-review-rating').value) || 5;
    const text = document.getElementById('edit-review-text').value;
    const dishName = document.getElementById('edit-review-dish').value.trim();
    const priceText = document.getElementById('edit-review-price').value;
    const dateInput = document.getElementById('edit-review-date').value;
    const file = document.getElementById('edit-photo-upload').files[0];
    let photoUrl = document.getElementById('edit-review-photo-url').value;

    if (!dishName) return showToast("Informe o nome do prato.", "error");
    if (rating < 1 || rating > 5) return showToast("Nota deve ser de 1 a 5.", "error");

    setBtnLoading(btn, true, "Salvar alterações");

    try {
        if (file) {
            const compressedFile = await imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 1280, useWebWorker: true });
            const fileName = `foods/${Date.now()}.${compressedFile.name.split('.').pop()}`;
            const { error: uploadError } = await supabaseClient.storage.from('food-images').upload(fileName, compressedFile);
            if (uploadError) throw new Error("Erro no upload da foto.");
            photoUrl = supabaseClient.storage.from('food-images').getPublicUrl(fileName).data.publicUrl;
        }

        // atualiza nome do prato se houver dish_id
        const { data: current } = await supabaseClient.from('reviews').select('dish_id').eq('id', id).single();
        if (current?.dish_id && dishName) {
            await supabaseClient.from('dishes').update({ name: dishName }).eq('id', current.dish_id);
        }

        const payload = {
            rating,
            review_text: text,
            food_photo_url: photoUrl || null,
            price_paid: priceText ? parseFloat(priceText.replace(',', '.')) : null,
            eaten_at: dateInput ? new Date(dateInput).toISOString() : null
        };

        const { error } = await supabaseClient.from('reviews').update(payload).eq('id', id);
        if (error) throw error;

        formDirty = false;
        showToast("Avaliação atualizada!", "success");
        closeModal('edit-review-modal');
        carregarFeed();
        carregarDiario();
        carregarRestaurantes();
    } catch (error) {
        showToast("Erro ao editar: " + error.message, "error");
    } finally {
        setBtnLoading(btn, false, "Salvar alterações");
    }
}