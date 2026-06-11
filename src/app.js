import { createClient } from '@supabase/supabase-js';
import { showToast, showConfirm } from './utils.js';

// App State
let groceryItems = [];
let currentFilter = 'all';
let searchQuery = '';
let editingItemId = null;

const defaultSuppliers = ['Lidl', 'Penny', 'Carrefour', 'Kaufland', 'aprozar', 'piata'];
let productSuggestions = [];

// Chart.js instances
let monthlyChart = null;
let supplierChart = null;

// DOM Elements - Navigation & Panels
const tabGrocery = document.getElementById('tab-grocery');
const tabStats = document.getElementById('tab-stats');
const panelGrocery = document.getElementById('panel-grocery');
const panelStats = document.getElementById('panel-stats');

// DOM Elements - Active Planner
const groceryForm = document.getElementById('grocery-form');
const itemNameInput = document.getElementById('item-name');
const itemQuantityInput = document.getElementById('item-quantity');
const itemUnitInput = document.getElementById('item-unit');
const itemSupplierInput = document.getElementById('item-supplier');
const groceryList = document.getElementById('grocery-list');
const emptyState = document.getElementById('empty-state');
const listActions = document.getElementById('list-actions');
const clearAllBtn = document.getElementById('clear-all-btn');
const checkoutBtn = document.getElementById('checkout-btn');
const totalCount = document.getElementById('total-count');
const completedCount = document.getElementById('completed-count');
const searchInput = document.getElementById('search-input');
const filterTabs = document.querySelectorAll('.filter-tab');

// Edit Mode DOM Elements
const formTitle = document.getElementById('form-title');
const submitBtnText = document.getElementById('submit-btn-text');
const addBtnIcon = document.getElementById('add-btn-icon');
const cancelBtn = document.getElementById('cancel-btn');

// Checkout Modal DOM Elements
const checkoutModal = document.getElementById('checkout-modal');
const checkoutForm = document.getElementById('checkout-form');
const checkoutItemsList = document.getElementById('checkout-items-list');
const closeModalBtn = document.getElementById('close-modal-btn');
const cancelCheckoutBtn = document.getElementById('cancel-checkout-btn');

// Image Upload State & DOM Elements
let currentImageBase64 = null;
const itemImageInput = document.getElementById('item-image');
const imagePreview = document.getElementById('image-preview');
const uploadIconPlaceholder = document.getElementById('upload-icon-placeholder');
const removeImageBtn = document.getElementById('remove-image-btn');

// Auth State & DOM Elements
let supabaseClient = null;
let isSignUpMode = false;

const appContainer = document.querySelector('.app-container');
const authContainer = document.getElementById('auth-container');
const authForm = document.getElementById('auth-form');
const authEmailInput = document.getElementById('auth-email');
const authPasswordInput = document.getElementById('auth-password');
const authSubmitBtn = document.getElementById('auth-submit-btn');
const authTitle = document.getElementById('auth-title');
const authSubtitle = document.getElementById('auth-subtitle');
const authSwitchLink = document.getElementById('auth-switch-link');
const authSwitchText = document.getElementById('auth-switch-text');

const userProfile = document.getElementById('user-profile');
const userEmailDisplay = document.getElementById('user-email-display');
const logoutBtn = document.getElementById('logout-btn');



let listenersSet = false;

// Initialize App
async function init() {
    await loadItems();
    if (!listenersSet) {
        setupEventListeners();
        listenersSet = true;
    }
    render();
}

// Initialize Supabase Authentication
async function initAuth() {
    try {
        const res = await fetch('/api/config');
        const config = await res.json();
        
        if (!config.supabaseUrl || !config.supabaseKey) {
            console.error('Supabase key configuration not returned by server API.');
            showToast('Eroare de configurare server.', 'error');
            return;
        }

        supabaseClient = createClient(config.supabaseUrl, config.supabaseKey);

        // Listen for authentication state changes
        supabaseClient.auth.onAuthStateChange((event, session) => {
            if (session) {
                // User logged in
                userEmailDisplay.textContent = session.user.email;
                userProfile.style.display = 'flex';
                authContainer.style.display = 'none';
                appContainer.style.display = 'block';
                
                // Initialize app data
                init();
            } else {
                // User logged out
                userProfile.style.display = 'none';
                appContainer.style.display = 'none';
                authContainer.style.display = 'flex';
                
                // Reset states
                groceryItems = [];
                render();
            }
        });
    } catch (err) {
        console.error('Failed to initialize Supabase client auth:', err);
        showToast('Eroare la conectarea cu serviciul de autentificare.', 'error');
    }
}

// Authorized fetch helper wrapping default fetch requests with Authorization headers
async function authorizedFetch(url, options = {}) {
    if (!supabaseClient) {
        return fetch(url, options);
    }
    
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        const token = session?.access_token;
        
        const headers = {
            ...options.headers,
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        };
        
        return fetch(url, {
            ...options,
            headers
        });
    } catch (err) {
        console.error('Error in authorizedFetch session retrieval:', err);
        return fetch(url, options);
    }
}

// Load items from backend database
async function loadItems() {
    try {
        const resGroceries = await authorizedFetch('/api/groceries');
        groceryItems = await resGroceries.json();

        const resProducts = await authorizedFetch('/api/products');
        productSuggestions = await resProducts.json();
    } catch (err) {
        console.error('Failed to load items from server:', err);
        groceryItems = [];
        productSuggestions = [];
    }
}

// Setup Event Listeners
function setupEventListeners() {
    // Tab Switching
    tabGrocery.addEventListener('click', () => switchTab('grocery'));
    tabStats.addEventListener('click', () => switchTab('stats'));

    // Form Submit (Add or Edit Item)
    groceryForm.addEventListener('submit', (e) => {
        e.preventDefault();
        addItem();
    });

    // Clear All Items
    clearAllBtn.addEventListener('click', clearAllItems);

    // Cancel Edit Mode
    cancelBtn.addEventListener('click', cancelEdit);

    // Checkout Trigger
    checkoutBtn.addEventListener('click', openCheckoutModal);
    closeModalBtn.addEventListener('click', closeCheckoutModal);
    cancelCheckoutBtn.addEventListener('click', closeCheckoutModal);
    checkoutForm.addEventListener('submit', handleCheckoutSubmit);

    // Image Upload Events
    if (itemImageInput) {
        itemImageInput.addEventListener('change', handleImageSelect);
    }
    if (removeImageBtn) {
        removeImageBtn.addEventListener('click', removeImage);
    }

    // Search Input
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        render();
    });

    // Filter Tabs
    filterTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            filterTabs.forEach(t => t.classList.remove('active'));
            e.target.classList.add('active');
            currentFilter = e.target.dataset.filter;
            render();
        });
    });

    // Global Lightbox Event Delegation
    document.addEventListener('click', (e) => {
        if (e.target && (
            e.target.classList.contains('item-thumbnail') || 
            e.target.classList.contains('checkout-item-thumbnail') || 
            e.target.classList.contains('history-item-thumbnail')
        )) {
            openLightbox(e.target.src);
        }
    });

    // Auth Event Listeners
    if (authForm) {
        authForm.addEventListener('submit', handleAuthSubmit);
    }
    if (authSwitchLink) {
        authSwitchLink.addEventListener('click', toggleAuthMode);
    }
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
}

// Image Select and Compression Logic
function handleImageSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            const max_size = 300;

            if (width > height) {
                if (width > max_size) {
                    height *= max_size / width;
                    width = max_size;
                }
            } else {
                if (height > max_size) {
                    width *= max_size / height;
                    height = max_size;
                }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            currentImageBase64 = canvas.toDataURL('image/jpeg', 0.75);

            imagePreview.src = currentImageBase64;
            imagePreview.style.display = 'block';
            uploadIconPlaceholder.style.display = 'none';
            removeImageBtn.style.display = 'flex';
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

// --- Auth Actions & Switch handlers ---

async function handleAuthSubmit(e) {
    e.preventDefault();
    const email = authEmailInput.value.trim();
    const password = authPasswordInput.value;

    if (!email || !password) return;

    authSubmitBtn.disabled = true;
    const originalText = authSubmitBtn.textContent;
    authSubmitBtn.textContent = isSignUpMode ? 'Se înregistrează...' : 'Se conectează...';

    try {
        if (isSignUpMode) {
            const { data, error } = await supabaseClient.auth.signUp({ email, password });
            if (error) throw error;
            showToast('Înregistrare reușită! Verifică-ți adresa de email pentru confirmare.', 'warning', 6000);
            authForm.reset();
        } else {
            const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
            if (error) throw error;
            showToast('Conectare reușită!', 'success');
        }
    } catch (err) {
        console.error('Auth action failed:', err);
        showToast(err.message || 'A apărut o eroare de autentificare.', 'error');
    } finally {
        authSubmitBtn.disabled = false;
        authSubmitBtn.textContent = originalText;
    }
}

function toggleAuthMode(e) {
    e.preventDefault();
    isSignUpMode = !isSignUpMode;

    if (isSignUpMode) {
        authTitle.textContent = 'Creare cont';
        authSubtitle.textContent = 'Înregistrează-te pentru a-ți crea o listă proprie';
        authSubmitBtn.textContent = 'Creează contul';
        authSwitchText.textContent = 'Ai deja cont?';
        authSwitchLink.textContent = 'Conectează-te';
    } else {
        authTitle.textContent = 'Autentificare';
        authSubtitle.textContent = 'Conectează-te pentru a-ți accesa lista de cumpărături';
        authSubmitBtn.textContent = 'Conectează-te';
        authSwitchText.textContent = 'Nu ai cont?';
        authSwitchLink.textContent = 'Înregistrează-te';
    }
    authForm.reset();
}

async function handleLogout() {
    if (await showConfirm('Deconectare', 'Ești sigur că vrei să te deconectezi?', 'Deconectare', 'Anulează')) {
        try {
            const { error } = await supabaseClient.auth.signOut();
            if (error) throw error;
            showToast('Deconectat cu succes.', 'success');
        } catch (err) {
            console.error('Failed to log out:', err);
            showToast('Eroare la deconectare.', 'error');
        }
    }
}

// Remove Selected Image preview
function removeImage() {
    currentImageBase64 = null;
    if (itemImageInput) itemImageInput.value = '';
    if (imagePreview) {
        imagePreview.src = '';
        imagePreview.style.display = 'none';
    }
    if (uploadIconPlaceholder) uploadIconPlaceholder.style.display = 'flex';
    if (removeImageBtn) removeImageBtn.style.display = 'none';
}

// Switch navigation tabs
function switchTab(tabName) {
    if (tabName === 'grocery') {
        tabGrocery.classList.add('active');
        tabStats.classList.remove('active');
        panelGrocery.classList.add('active');
        panelStats.classList.remove('active');
        render();
    } else {
        tabStats.classList.add('active');
        tabGrocery.classList.remove('active');
        panelStats.classList.add('active');
        panelGrocery.classList.remove('active');
        loadAndRenderStats();
    }
}

// Add or Edit Grocery Item
async function addItem() {
    const name = itemNameInput.value.trim();
    const quantity = parseFloat(itemQuantityInput.value) || 1;
    const unit = itemUnitInput.value || 'buc.';
    const supplier = itemSupplierInput.value.trim();

    if (!name) return;

    const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);
    
    // Save product suggestion if new
    if (!productSuggestions.includes(capitalizedName)) {
        productSuggestions.push(capitalizedName);
        productSuggestions.sort((a, b) => a.localeCompare(b, 'ro'));
        try {
            await authorizedFetch('/api/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: capitalizedName })
            });
        } catch (err) {
            console.error('Failed to save product suggestion to server:', err);
        }
    }

    if (editingItemId) {
        // Edit Mode
        const updatedItem = {
            name: capitalizedName,
            quantity,
            unit,
            supplier: supplier || null,
            completed: false,
            image: currentImageBase64
        };

        const existing = groceryItems.find(i => i.id === editingItemId);
        if (existing) {
            updatedItem.completed = existing.completed;
        }

        try {
            await authorizedFetch(`/api/groceries/${editingItemId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedItem)
            });

            groceryItems = groceryItems.map(item => {
                if (item.id === editingItemId) {
                    return { ...item, ...updatedItem };
                }
                return item;
            });
        } catch (err) {
            console.error('Failed to update item on server:', err);
        }
        
        editingItemId = null;
        
        // Reset UI Title/Buttons
        formTitle.textContent = 'Adaugă alimente';
        submitBtnText.textContent = 'Adaugă în listă';
        addBtnIcon.innerHTML = `
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
        `;
        cancelBtn.style.display = 'none';
    } else {
        // Create Mode
        const newItem = {
            id: 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            name: capitalizedName,
            quantity,
            unit,
            supplier: supplier || null,
            completed: false,
            createdAt: new Date().toISOString(),
            image: currentImageBase64
        };

        try {
            await authorizedFetch('/api/groceries', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newItem)
            });
            groceryItems.unshift(newItem);
        } catch (err) {
            console.error('Failed to save item to server:', err);
        }
    }

    render();

    // Reset Form
    groceryForm.reset();
    removeImage();
    itemQuantityInput.value = 1;
    itemUnitInput.value = 'buc.';
    itemNameInput.focus();
}

// Start Editing an Item
function startEdit(id) {
    const item = groceryItems.find(i => i.id === id);
    if (!item) return;

    editingItemId = id;

    // Populate inputs
    itemNameInput.value = item.name;
    itemQuantityInput.value = item.quantity;
    itemUnitInput.value = item.unit || 'buc.';
    itemSupplierInput.value = item.supplier || '';

    // Populate image upload preview if existing
    if (item.image) {
        currentImageBase64 = item.image;
        imagePreview.src = item.image;
        imagePreview.style.display = 'block';
        uploadIconPlaceholder.style.display = 'none';
        removeImageBtn.style.display = 'flex';
    } else {
        removeImage();
    }

    // Transform form header and buttons
    formTitle.textContent = 'Editează alimentul';
    submitBtnText.textContent = 'Salvează modificările';
    addBtnIcon.innerHTML = `
        <polyline points="20 6 9 17 4 12"></polyline>
    `;
    cancelBtn.style.display = 'block';

    // Smoothly scroll to the form (useful on mobile viewports)
    document.querySelector('.form-section').scrollIntoView({ behavior: 'smooth' });
    itemNameInput.focus();
}

// Cancel Editing Mode
function cancelEdit() {
    editingItemId = null;
    groceryForm.reset();
    removeImage();
    itemQuantityInput.value = 1;
    itemUnitInput.value = 'buc.';

    // Reset form title and action buttons
    formTitle.textContent = 'Adaugă alimente';
    submitBtnText.textContent = 'Adaugă în listă';
    addBtnIcon.innerHTML = `
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
    `;
    cancelBtn.style.display = 'none';
}

// Toggle Complete Status
async function toggleComplete(id) {
    const item = groceryItems.find(i => i.id === id);
    if (!item) return;

    const updatedCompleted = !item.completed;

    try {
        await authorizedFetch(`/api/groceries/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: item.name,
                quantity: item.quantity,
                unit: item.unit,
                supplier: item.supplier,
                completed: updatedCompleted,
                image: item.image || null
            })
        });

        groceryItems = groceryItems.map(i => {
            if (i.id === id) {
                return { ...i, completed: updatedCompleted };
            }
            return i;
        });
        render();
    } catch (err) {
        console.error('Failed to update status on server:', err);
    }
}

// Delete Item
async function deleteItem(id) {
    if (editingItemId === id) {
        cancelEdit();
    }

    const itemEl = document.querySelector(`[data-id="${id}"]`);
    if (itemEl) {
        itemEl.style.opacity = '0';
        itemEl.style.transform = 'translateY(10px)';
        itemEl.style.transition = 'all 0.2s ease-out';
    }

    try {
        await authorizedFetch(`/api/groceries/${id}`, {
            method: 'DELETE'
        });

        setTimeout(() => {
            groceryItems = groceryItems.filter(item => item.id !== id);
            render();
        }, itemEl ? 200 : 0);
    } catch (err) {
        console.error('Failed to delete item from server:', err);
        render();
    }
}

// Clear All Items
async function clearAllItems() {
    if (await showConfirm('Șterge lista', 'Ești sigur că vrei să ștergi întreaga listă de cumpărături?', 'Șterge tot', 'Anulează')) {
        editingItemId = null;
        cancelEdit();
        
        try {
            await authorizedFetch('/api/groceries', {
                method: 'DELETE'
            });
            groceryItems = [];
            render();
            showToast('Lista de cumpărături a fost ștearsă cu succes!', 'success');
        } catch (err) {
            console.error('Failed to clear list on server:', err);
            showToast('A apărut o eroare la ștergerea listei.', 'error');
        }
    }
}

// --- Checkout Modal Handlers ---

// Open checkout modal and populate items
function openCheckoutModal() {
    const checkedItems = groceryItems.filter(item => item.completed);
    if (checkedItems.length === 0) return;

    checkoutItemsList.innerHTML = '';
    
    checkedItems.forEach(item => {
        const div = document.createElement('div');
        div.className = 'checkout-item-row';
        const imageMarkup = item.image 
            ? `<img src="${item.image}" class="checkout-item-thumbnail" alt="${escapeHTML(item.name)}">`
            : `<div class="checkout-item-thumbnail" style="display: flex; align-items: center; justify-content: center; background: rgba(99, 102, 241, 0.05); color: var(--accent-violet);">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                    <polyline points="21 15 16 10 5 21"></polyline>
                </svg>
               </div>`;
        div.innerHTML = `
            <div class="checkout-item-left">
                ${imageMarkup}
                <div class="checkout-item-info">
                    <span class="checkout-item-name">${escapeHTML(item.name)}</span>
                    <span class="checkout-item-meta">Qty: ${item.quantity} ${escapeHTML(item.unit || 'buc.')} ${item.supplier ? `• ${escapeHTML(item.supplier)}` : ''}</span>
                </div>
            </div>
            <div class="checkout-item-price-input">
                <input type="number" id="price-${item.id}" min="0" step="0.01" placeholder="0.00" required>
                <span class="price-currency-label">RON</span>
            </div>
        `;
        checkoutItemsList.appendChild(div);
    });

    checkoutModal.style.display = 'flex';
}

// Close checkout modal
function closeCheckoutModal() {
    checkoutModal.style.display = 'none';
}

// Handle checkout submission
async function handleCheckoutSubmit(e) {
    e.preventDefault();
    const checkedItems = groceryItems.filter(item => item.completed);
    if (checkedItems.length === 0) return;

    const purchaseDate = new Date().toISOString();
    
    const checkoutData = checkedItems.map(item => {
        const priceInput = document.getElementById(`price-${item.id}`);
        return {
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            supplier: item.supplier || null,
            price: parseFloat(priceInput.value) || 0,
            purchaseDate: purchaseDate,
            image: item.image || null,
            activeId: item.id
        };
    });

    try {
        const res = await authorizedFetch('/api/history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(checkoutData)
        });

        if (res.ok) {
            closeCheckoutModal();
            await loadItems();
            render();
            showToast('Cumpărăturile au fost finalizate și salvate cu succes în istoric!', 'success');
        }
    } catch (err) {
        console.error('Failed to complete checkout:', err);
        showToast('A apărut o eroare la finalizarea cumpărăturilor.', 'error');
    }
}

// --- Stats and Charts rendering logic ---

// Load stats data from server and render UI / Charts
async function loadAndRenderStats() {
    try {
        const resStats = await authorizedFetch('/api/statistics');
        const stats = await resStats.json();

        const resHistory = await authorizedFetch('/api/history');
        const history = await resHistory.json();

        // Update statistics summary badges
        document.getElementById('stat-total-spent').textContent = `${parseFloat(stats.totalSpent).toFixed(2)} RON`;
        document.getElementById('stat-total-purchases').textContent = `${history.length} produse`;

        // Render History Table
        const tbody = document.getElementById('history-tbody');
        const emptyStateTable = document.getElementById('history-empty');
        tbody.innerHTML = '';

        if (history.length === 0) {
            emptyStateTable.style.display = 'flex';
        } else {
            emptyStateTable.style.display = 'none';
            history.forEach(row => {
                const date = new Date(row.purchaseDate).toLocaleDateString('ro-RO', {
                    year: 'numeric', month: 'short', day: 'numeric'
                });
                const tr = document.createElement('tr');
                const imageMarkup = row.image
                    ? `<img src="${row.image}" class="history-item-thumbnail" alt="${escapeHTML(row.name)}">`
                    : `<div class="history-item-thumbnail" style="display: flex; align-items: center; justify-content: center; background: rgba(99, 102, 241, 0.05); color: var(--accent-violet);">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                            <circle cx="8.5" cy="8.5" r="1.5"></circle>
                            <polyline points="21 15 16 10 5 21"></polyline>
                        </svg>
                       </div>`;
                tr.innerHTML = `
                    <td>${date}</td>
                    <td>
                        <div class="history-item-with-thumb">
                            ${imageMarkup}
                            <strong>${escapeHTML(row.name)}</strong>
                        </div>
                    </td>
                    <td>${row.quantity} ${escapeHTML(row.unit || 'buc.')}</td>
                    <td>${row.supplier ? `<span class="supplier-tag">${escapeHTML(row.supplier)}</span>` : '—'}</td>
                    <td class="text-right font-weight-bold" style="color: var(--accent-violet); font-weight: 700;">${parseFloat(row.price).toFixed(2)} RON</td>
                `;
                tbody.appendChild(tr);
            });
        }

        // Render Charts using Chart.js
        renderCharts(stats);

    } catch (err) {
        console.error('Failed to load stats details:', err);
    }
}

// Build or update Chart.js canvas elements
function renderCharts(statsData) {
    if (monthlyChart) monthlyChart.destroy();
    if (supplierChart) supplierChart.destroy();

    // 1. Monthly Expense Evolution Chart
    const monthlyCtx = document.getElementById('monthly-chart-canvas').getContext('2d');
    const monthlyLabels = statsData.monthly.map(m => m.month);
    const monthlyTotals = statsData.monthly.map(m => m.total);

    monthlyChart = new Chart(monthlyCtx, {
        type: 'bar',
        data: {
            labels: monthlyLabels.length > 0 ? monthlyLabels : ['Nicio dată'],
            datasets: [{
                label: 'Cheltuieli (RON)',
                data: monthlyTotals.length > 0 ? monthlyTotals : [0],
                backgroundColor: 'rgba(99, 102, 241, 0.75)',
                borderColor: 'rgb(99, 102, 241)',
                borderWidth: 2,
                borderRadius: 8,
                borderSkipped: false,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    padding: 12,
                    backgroundColor: 'rgba(30, 41, 59, 0.95)',
                    titleFont: { family: 'Inter', size: 13 },
                    bodyFont: { family: 'Inter', size: 14, weight: 'bold' }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(0, 0, 0, 0.04)' },
                    ticks: { font: { family: 'Inter', weight: '500' } }
                },
                x: {
                    grid: { display: false },
                    ticks: { font: { family: 'Inter', weight: '500' } }
                }
            }
        }
    });

    // 2. Spending Distribution by Supplier Chart
    const supplierCtx = document.getElementById('supplier-chart-canvas').getContext('2d');
    const supplierLabels = statsData.supplier.map(s => s.supplier);
    const supplierTotals = statsData.supplier.map(s => s.total);

    supplierChart = new Chart(supplierCtx, {
        type: 'doughnut',
        data: {
            labels: supplierLabels.length > 0 ? supplierLabels : ['Fără date'],
            datasets: [{
                data: supplierTotals.length > 0 ? supplierTotals : [1],
                backgroundColor: [
                    'rgba(99, 102, 241, 0.8)',
                    'rgba(16, 185, 129, 0.8)',
                    'rgba(245, 158, 11, 0.8)',
                    'rgba(239, 68, 68, 0.8)',
                    'rgba(6, 182, 212, 0.8)',
                    'rgba(139, 92, 246, 0.8)'
                ],
                borderWidth: 3,
                borderColor: '#ffffff',
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        boxWidth: 12,
                        padding: 15,
                        font: { family: 'Inter', size: 11, weight: '600' }
                    }
                },
                tooltip: {
                    padding: 12,
                    backgroundColor: 'rgba(30, 41, 59, 0.95)',
                    titleFont: { family: 'Inter', size: 13 },
                    bodyFont: { family: 'Inter', size: 14, weight: 'bold' }
                }
            },
            cutout: '65%'
        }
    });
}

// Filter and Search Logic
function getFilteredItems() {
    return groceryItems.filter(item => {
        if (currentFilter === 'active' && item.completed) return false;
        if (currentFilter === 'completed' && !item.completed) return false;

        if (searchQuery) {
            const matchesName = item.name.toLowerCase().includes(searchQuery);
            const matchesSupplier = item.supplier && item.supplier.toLowerCase().includes(searchQuery);
            return matchesName || matchesSupplier;
        }

        return true;
    });
}

// Update unique suppliers in datalist
function updateSupplierDatalist() {
    const datalist = document.getElementById('suppliers-list');
    if (!datalist) return;
    
    const activeSuppliers = groceryItems
        .map(item => item.supplier)
        .filter(supplier => supplier && !defaultSuppliers.includes(supplier));
    
    const allSuppliers = [...new Set([...defaultSuppliers, ...activeSuppliers])];
    
    datalist.innerHTML = allSuppliers
        .map(supplier => `<option value="${escapeHTML(supplier)}">`)
        .join('');
}

// Update products datalist suggestions
function updateProductDatalist() {
    const datalist = document.getElementById('products-list');
    if (!datalist) return;

    datalist.innerHTML = productSuggestions
        .map(prod => `<option value="${escapeHTML(prod)}">`)
        .join('');
}

// Render UI
function render() {
    updateSupplierDatalist();
    updateProductDatalist();
    const filtered = getFilteredItems();
    
    groceryList.innerHTML = '';

    const total = groceryItems.length;
    const completed = groceryItems.filter(item => item.completed).length;
    totalCount.textContent = total;
    completedCount.textContent = completed;

    if (completed > 0) {
        checkoutBtn.style.display = 'inline-flex';
    } else {
        checkoutBtn.style.display = 'none';
    }

    if (total === 0) {
        emptyState.style.display = 'flex';
        listActions.style.display = 'none';
        groceryList.style.display = 'none';
    } else {
        emptyState.style.display = 'none';
        listActions.style.display = 'flex';
        groceryList.style.display = 'flex';
        
        if (filtered.length === 0) {
            groceryList.innerHTML = `
                <div class="empty-state" style="padding: 2rem 0;">
                    <p class="empty-text">Nu s-au găsit produse potrivite</p>
                    <p class="empty-subtext">Încearcă să modifici filtrele sau termenii căutați</p>
                </div>
            `;
        } else {
            filtered.forEach(item => {
                const li = document.createElement('li');
                li.className = `grocery-item ${item.completed ? 'completed' : ''}`;
                li.setAttribute('data-id', item.id);

                const imageMarkup = item.image 
                    ? `<img src="${item.image}" class="item-thumbnail" alt="${escapeHTML(item.name)}">`
                    : `<div class="item-thumbnail-placeholder">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                            <circle cx="8.5" cy="8.5" r="1.5"></circle>
                            <polyline points="21 15 16 10 5 21"></polyline>
                        </svg>
                       </div>`;

                const supplierMarkup = item.supplier 
                    ? `<span class="meta-divider">•</span><span class="supplier-tag">${escapeHTML(item.supplier)}</span>`
                    : '';

                li.innerHTML = `
                    <div class="item-left">
                        <label class="checkbox-container">
                            <input type="checkbox" ${item.completed ? 'checked' : ''} onchange="toggleComplete('${item.id}')">
                            <span class="checkmark"></span>
                        </label>
                        ${imageMarkup}
                        <div class="item-info">
                            <span class="item-name-text">${escapeHTML(item.name)}</span>
                            <div class="item-meta">
                                <span>Cantitate: ${item.quantity} ${escapeHTML(item.unit || 'buc.')}</span>
                                ${supplierMarkup}
                            </div>
                        </div>
                    </div>
                    <div class="item-actions">
                        <button class="edit-btn" onclick="startEdit('${item.id}')" title="Editează produsul">
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                        <button class="delete-btn" onclick="deleteItem('${item.id}')" title="Șterge produsul">
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </div>
                `;
                groceryList.appendChild(li);
            });
        }
    }
}

// Helper: Escape HTML
function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

// Image Lightbox Functions
const lightboxModal = document.getElementById('lightbox-modal');
const lightboxImg = document.getElementById('lightbox-img');

function openLightbox(src) {
    if (!src || !lightboxModal || !lightboxImg) return;
    lightboxImg.src = src;
    lightboxModal.style.display = 'flex';
}

function closeLightbox() {
    if (!lightboxModal || !lightboxImg) return;
    lightboxModal.style.display = 'none';
    lightboxImg.src = '';
}

// Expose handlers globally
window.toggleComplete = toggleComplete;
window.deleteItem = deleteItem;
window.startEdit = startEdit;
window.cancelEdit = cancelEdit;
window.openLightbox = openLightbox;
window.closeLightbox = closeLightbox;

// Run Application
document.addEventListener('DOMContentLoaded', initAuth);
