// INITIALIZE SUPABASE CLIENT (Silakan ganti URL dan KEY dengan akun Supabase Anda)
const SUPABASE_URL = "https://kmynkqlkhmryptzpxidq.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_WnHWZXwVatUB8WTgaKI2fg_eWY-T6b3";
const supabase = (typeof supabase !== 'undefined') ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

let products = [];
let cart = [];

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("current-date").innerText = new Date().toLocaleDateString('id-ID', { month: 'short', day: 'numeric' });
    loadMockOrSupabaseData();
});

// FUNGSI NAVIGASI MENU UTAMA (Desktop & Mobile)
function switchTab(tabId) {
    const tabs = ['dashboard', 'pos', 'products'];
    
    tabs.forEach(id => {
        const viewElement = document.getElementById(`view-${id}`);
        const btnElement = document.getElementById(`btn-${id}`);
        
        if (viewElement) viewElement.classList.add('hidden');
        if (btnElement) btnElement.classList.remove('active-menu');
    });
    
    const activeView = document.getElementById(`view-${tabId}`);
    const activeBtn = document.getElementById(`btn-${tabId}`);
    
    if (activeView) activeView.classList.remove('hidden');
    if (activeBtn) activeBtn.classList.add('active-menu');
    
    const titles = { 
        'dashboard': 'Dashboard Overview', 
        'pos': 'Mesin Kasir / POS', 
        'products': 'Inventori Stok' 
    };
    document.getElementById('page-title').innerText = titles[tabId] || 'LitePOS';
    
    // Tutup drawer cart otomatis di mobile saat ganti halaman
    const sidebar = document.getElementById('cart-sidebar');
    if (sidebar) sidebar.classList.add('translate-x-full');
    
    if (tabId === 'pos') {
        setTimeout(() => {
            const searchInput = document.getElementById('barcode-search');
            if (searchInput) searchInput.focus();
        }, 50);
    }
}

// Buka/Tutup Keranjang di Mobile
function toggleMobileCart() {
    const sidebar = document.getElementById('cart-sidebar');
    sidebar.classList.toggle('translate-x-full');
}

async function loadMockOrSupabaseData() {
    products = [
        { id: 1, barcode: '8991001', name: 'Kopi Susu Instan', price: 15000, stock: 42, category: 'Minuman' },
        { id: 2, barcode: '8991002', name: 'Keripik Singkong BBQ', price: 12000, stock: 3, category: 'Makanan' },
        { id: 3, barcode: '8991003', name: 'Air Mineral 600ml', price: 5000, stock: 98, category: 'Minuman' },
        { id: 4, barcode: '8991004', name: 'Roti Bakar Cokelat', price: 18000, stock: 12, category: 'Makanan' }
    ];

    if (supabase && SUPABASE_URL !== "https://YOUR_PROJECT_REF.supabase.co") {
        try {
            let { data, error } = await supabase.from('products').select('*');
            if (!error && data.length > 0) products = data;
        } catch(e) { console.log("Using Mock Data."); }
    }
    renderCatalog();
    renderInventory();
    calculateDashboardMetrics();
}

function renderCatalog() {
    const grid = document.getElementById('product-grid');
    grid.innerHTML = '';
    
    products.forEach(p => {
        const isLow = p.stock <= 5;
        grid.innerHTML += `
            <div onclick="addToCart(${p.id})" class="bg-gray-800 border border-gray-700 hover:border-blue-500 rounded-xl p-3 cursor-pointer flex flex-col justify-between active:scale-95 shadow transition-all">
                <div>
                    <div class="flex justify-between items-center mb-1.5">
                        <span class="text-[9px] bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded font-mono">${p.barcode}</span>
                        <span class="text-[9px] ${isLow ? 'text-rose-400':'text-emerald-400'} font-bold">Stok:${p.stock}</span>
                    </div>
                    <h4 class="font-medium text-white text-xs line-clamp-2">${p.name}</h4>
                </div>
                <div class="mt-3 pt-1.5 border-t border-gray-700 flex justify-between items-center">
                    <span class="text-emerald-400 font-bold text-xs">Rp ${p.price.toLocaleString('id-ID')}</span>
                    <span class="w-5 h-5 bg-gray-700 text-white text-[10px] rounded-full flex items-center justify-center"><i class="fa-solid fa-plus"></i></span>
                </div>
            </div>
        `;
    });
}

function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    if (!product || product.stock <= 0) return alert("Stok habis!");

    const cartItem = cart.find(item => item.id === productId);
    if (cartItem) {
        if (cartItem.quantity >= product.stock) return alert("Stok tidak mencukupi!");
        cartItem.quantity++;
    } else {
        cart.push({ ...product, quantity: 1 });
    }
    updateCartUI();
}

function updateCartQty(productId, delta) {
    const item = cart.find(i => i.id === productId);
    if (!item) return;
    item.quantity += delta;
    if (item.quantity <= 0) cart = cart.filter(i => i.id !== productId);
    updateCartUI();
}

function updateCartUI() {
    const container = document.getElementById('cart-items');
    const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    
    document.getElementById('mobile-cart-count').innerText = totalCount;
    
    if(cart.length === 0) {
        container.innerHTML = `<p class="text-center py-6 text-gray-500 text-xs">Keranjang kosong</p>`;
        document.getElementById('cart-total').innerText = "Rp 0";
        return;
    }

    container.innerHTML = '';
    let total = 0;
    
    cart.forEach(item => {
        total += item.price * item.quantity;
        container.innerHTML += `
            <div class="bg-gray-750 p-2 rounded-lg border border-gray-750 flex justify-between items-center text-xs">
                <div class="truncate pr-2 flex-1">
                    <h5 class="text-white truncate font-medium">${item.name}</h5>
                    <span class="text-emerald-400">Rp ${item.price.toLocaleString('id-ID')}</span>
                </div>
                <div class="flex items-center bg-gray-900 rounded p-1">
                    <button onclick="updateCartQty(${item.id}, -1)" class="w-4 h-4 text-gray-400"><i class="fa-solid fa-minus text-[10px]"></i></button>
                    <span class="px-2 font-bold text-white">${item.quantity}</span>
                    <button onclick="updateCartQty(${item.id}, 1)" class="w-4 h-4 text-gray-400"><i class="fa-solid fa-plus text-[10px]"></i></button>
                </div>
            </div>
        `;
    });
    document.getElementById('cart-total').innerText = `Rp ${total.toLocaleString('id-ID')}`;
}

function clearCart() { cart = []; updateCartUI(); }

async function checkout(method) {
    if(cart.length === 0) return alert("Keranjang kosong!");
    const invoiceNum = "INV-" + Date.now().toString().slice(-5);
    let totalAmount = cart.reduce((acc, i) => acc + (i.price * i.quantity), 0);
    
    if(supabase && SUPABASE_URL !== "https://YOUR_PROJECT_REF.supabase.co") {
        await supabase.from('transactions').insert([{ invoice_number: invoiceNum, total_price: totalAmount, payment_method: method }]);
    }
    
    alert(`Sukses! ${invoiceNum} - Total: Rp ${totalAmount.toLocaleString('id-ID')}`);
    
    cart.forEach(item => { let p = products.find(prod => prod.id === item.id); if(p) p.stock -= item.quantity; });
    
    const table = document.getElementById('realtime-tx-table');
    if (table.innerHTML.includes('Belum ada transaksi')) table.innerHTML = '';
    const timeStr = new Date().toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'});
    
    table.innerHTML = `
        <tr class="border-b border-gray-700 text-xs">
            <td class="py-2 px-3 text-blue-400 font-mono">${invoiceNum}</td>
            <td class="py-2 px-3">${timeStr}</td>
            <td class="py-2 px-3"><span class="px-1.5 py-0.5 rounded text-[9px] bg-gray-700 text-white">${method}</span></td>
            <td class="py-2 px-3 text-right text-white font-bold">Rp ${totalAmount.toLocaleString('id-ID')}</td>
        </tr>
    ` + table.innerHTML;

    clearCart();
    renderCatalog();
    renderInventory();
    calculateDashboardMetrics();
    document.getElementById('cart-sidebar').classList.add('translate-x-full');
}

function calculateDashboardMetrics() {
    let lowStockCount = products.filter(p => p.stock <= 5).length;
    document.getElementById('dash-low-stock').innerText = `${lowStockCount} Item`;
}

function renderInventory() {
    const tbody = document.getElementById('inventory-table-body');
    tbody.innerHTML = '';
    products.forEach(p => {
        tbody.innerHTML += `
            <tr class="border-b border-gray-700 text-xs">
                <td class="py-2.5 px-4 font-medium text-white">${p.name}</td>
                <td class="py-2.5 px-4 text-gray-400">${p.category}</td>
                <td class="py-2.5 px-4 text-right text-emerald-400">Rp ${p.price.toLocaleString('id-ID')}</td>
                <td class="py-2.5 px-4 text-center"><span class="px-2 py-0.5 rounded ${p.stock <= 5 ? 'bg-rose-500/20 text-rose-400':'bg-gray-700'}">${p.stock} Pcs</span></td>
            </tr>
        `;
    });
}
