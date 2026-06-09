// App State
let groceryItems = [];
let currentFilter = 'all';
let searchQuery = '';
let editingItemId = null;

const defaultSuppliers = ['Lidl', 'Penny', 'Carrefour', 'Kaufland', 'aprozar', 'piata'];
let productSuggestions = [];

// DOM Elements
const groceryForm = document.getElementById('grocery-form');
const itemNameInput = document.getElementById('item-name');
const itemQuantityInput = document.getElementById('item-quantity');
const itemUnitInput = document.getElementById('item-unit');
const itemSupplierInput = document.getElementById('item-supplier');
const groceryList = document.getElementById('grocery-list');
const emptyState = document.getElementById('empty-state');
const listActions = document.getElementById('list-actions');
const clearAllBtn = document.getElementById('clear-all-btn');
const totalCount = document.getElementById('total-count');
const completedCount = document.getElementById('completed-count');
const searchInput = document.getElementById('search-input');
const filterTabs = document.querySelectorAll('.filter-tab');

// Edit Mode DOM Elements
const formTitle = document.getElementById('form-title');
const submitBtnText = document.getElementById('submit-btn-text');
const addBtnIcon = document.getElementById('add-btn-icon');
const cancelBtn = document.getElementById('cancel-btn');

// Initialize App
async function init() {
    await loadItems();
    setupEventListeners();
    render();
}

// Load items from backend database
async function loadItems() {
    try {
        const resGroceries = await fetch('/api/groceries');
        groceryItems = await resGroceries.json();

        const resProducts = await fetch('/api/products');
        productSuggestions = await resProducts.json();
    } catch (err) {
        console.error('Failed to load items from server:', err);
        groceryItems = [];
        productSuggestions = [];
    }
}

// Setup Event Listeners
function setupEventListeners() {
    // Form Submit (Add or Edit Item)
    groceryForm.addEventListener('submit', (e) => {
        e.preventDefault();
        addItem();
    });

    // Clear All Items
    clearAllBtn.addEventListener('click', clearAllItems);

    // Cancel Edit Mode
    cancelBtn.addEventListener('click', cancelEdit);

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
}

// Add or Edit Grocery Item
async function addItem() {
    const name = itemNameInput.value.trim();
    const quantity = parseFloat(itemQuantityInput.value) || 1;
    const unit = itemUnitInput.value || 'buc.';
    const supplier = itemSupplierInput.value.trim();

    if (!name) return;

    // Capitalize first letter of product suggestion
    const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);
    
    // Save product suggestion if new
    if (!productSuggestions.includes(capitalizedName)) {
        productSuggestions.push(capitalizedName);
        productSuggestions.sort((a, b) => a.localeCompare(b, 'ro'));
        try {
            await fetch('/api/products', {
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
            completed: false
        };

        // Retain existing completion status
        const existing = groceryItems.find(i => i.id === editingItemId);
        if (existing) {
            updatedItem.completed = existing.completed;
        }

        try {
            await fetch(`/api/groceries/${editingItemId}`, {
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
            createdAt: new Date().toISOString()
        };

        try {
            await fetch('/api/groceries', {
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
        await fetch(`/api/groceries/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: item.name,
                quantity: item.quantity,
                unit: item.unit,
                supplier: item.supplier,
                completed: updatedCompleted
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
    // If deleted item was currently being edited, cancel edit mode first
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
        await fetch(`/api/groceries/${id}`, {
            method: 'DELETE'
        });

        setTimeout(() => {
            groceryItems = groceryItems.filter(item => item.id !== id);
            render();
        }, itemEl ? 200 : 0);
    } catch (err) {
        console.error('Failed to delete item from server:', err);
        render(); // Re-render to restore layout state
    }
}

// Clear All Items
async function clearAllItems() {
    if (confirm('Ești sigur că vrei să ștergi întreaga listă de cumpărături?')) {
        editingItemId = null;
        cancelEdit();
        
        try {
            await fetch('/api/groceries', {
                method: 'DELETE'
            });
            groceryItems = [];
            render();
        } catch (err) {
            console.error('Failed to clear list on server:', err);
        }
    }
}

// Filter and Search Logic
function getFilteredItems() {
    return groceryItems.filter(item => {
        // Apply Filter Tabs
        if (currentFilter === 'active' && item.completed) return false;
        if (currentFilter === 'completed' && !item.completed) return false;

        // Apply Search Query
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
    
    // Get unique suppliers from items that are not in default list
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

    // Generate option list elements
    datalist.innerHTML = productSuggestions
        .map(prod => `<option value="${escapeHTML(prod)}">`)
        .join('');
}

// Render UI
function render() {
    updateSupplierDatalist();
    updateProductDatalist();
    const filtered = getFilteredItems();
    
    // Clear list
    groceryList.innerHTML = '';

    // Render Stats
    const total = groceryItems.length;
    const completed = groceryItems.filter(item => item.completed).length;
    totalCount.textContent = total;
    completedCount.textContent = completed;

    // Show/Hide List Actions & Container Empty State
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
            // Render Items
            filtered.forEach(item => {
                const li = document.createElement('li');
                li.className = `grocery-item ${item.completed ? 'completed' : ''}`;
                li.setAttribute('data-id', item.id);

                // Supplier markup if it exists
                const supplierMarkup = item.supplier 
                    ? `<span class="meta-divider">•</span><span class="supplier-tag">${escapeHTML(item.supplier)}</span>`
                    : '';

                li.innerHTML = `
                    <div class="item-left">
                        <label class="checkbox-container">
                            <input type="checkbox" ${item.completed ? 'checked' : ''} onchange="toggleComplete('${item.id}')">
                            <span class="checkmark"></span>
                        </label>
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

// Expose handlers globally since they are inline attributes in HTML
window.toggleComplete = toggleComplete;
window.deleteItem = deleteItem;
window.startEdit = startEdit;
window.cancelEdit = cancelEdit;

// Run Application
document.addEventListener('DOMContentLoaded', init);
