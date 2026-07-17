// INITIALIZE SUPABASE CLIENT (Lebih kokoh untuk menghindari error variabel)
const SUPABASE_URL = "https://kmynkqlkhmryptzpxidq.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_WnHWZXwVatUB8WTgaKI2fg_eWY-T6b3";

const db = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

let products = [];
let serverTransactions = [];
let cart = [];
let isSignUpMode = false;
let currentShopEmail = "";

document.addEventListener("DOMContentLoaded", () => {
    checkUserSession();

    const searchInput = document.getElementById('barcode-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            renderCatalog(e.target.value.toLowerCase());
        });
    }

    document.getElementById('search-tx-input')?.addEventListener('input', filterTransactions);
    document.getElementById('filter-tx-method')?.addEventListener('change', filterTransactions);

    document.getElementById('search-stock-input')?.addEventListener('input', (e) => {
        renderInventory(e.target.value.toLowerCase());
    });
});

// ENGINE NOTIFIKASI KUSTOM ELEGAN
function showCustomModal(title, message, type = 'success') {
    const modal = document.getElementById('custom-modal');
    const mTitle = document.getElementById('modal-title');
    const mMsg = document.getElementById('modal-message');
    const mIconContainer = document.getElementById('modal-icon-container');
    const mIcon = document.getElementById('modal-icon');

    mTitle.innerText = title;
    mMsg.innerText = message;

    mIconContainer.className = "mx-auto w-12 h-12 rounded-full flex items-center justify-center text-xl mb-4";
    mIcon.className = "fa-solid";

    if (type === 'success') {
        mIconContainer.classList.add('bg-emerald-500/10', 'text-emerald-400');
        mIcon.classList.add('fa-circle-check');
    } else if (type === 'error') {
        mIconContainer.classList.add('bg-rose-500/10', 'text-rose-400');
        mIcon.classList.add('fa-circle-xmark');
    } else {
        mIconContainer.classList.add('bg-blue-500/10', 'text-blue-400');
        mIcon.classList.add('fa-circle-info');
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => { modal.firstElementChild.classList.remove('scale-95'); }, 10);
}

function closeCustomModal() {
    const modal = document.getElementById('custom-modal');
    modal.firstElementChild.classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }, 150);
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = "px-4 py-2.5 rounded-xl text-xs font-semibold shadow-2xl border flex items-center gap-2 transform translate-y-2 opacity-0 transition-all duration-300 pointer-events-auto min-w-[200px]";
    
    if (type === 'success') {
        toast.className += " bg-emerald-950 border-emerald-800 text-emerald-400";
        toast.innerHTML = `<i class="fa-solid fa-check-circle text-sm"></i> ${message}`;
    } else {
        toast.className += " bg-rose-950 border-rose-800 text-rose-400";
        toast.innerHTML = `<i class="fa-solid fa-exclamation-circle text-sm"></i> ${message}`;
    }

    container.appendChild(toast);
    setTimeout(() => { toast.classList.remove('translate-y-2', 'opacity-0'); }, 10);

    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-x-2');
        setTimeout(() => { toast.remove(); }, 300);
    }, 3000);
}

// SYSTEM AUTHENTICATION ENGINE
async function checkUserSession() {
    const authGate = document.getElementById('auth-gate');
    if (!db) return;
    try {
        const { data: { session }, error } = await db.auth.getSession();
        if (error) throw error;
        
        if (session && session.user) {
            currentShopEmail = session.user.email;
            
            // Menyembunyikan form login dengan aman via Tailwind classes
            authGate.classList.add('hidden');
            authGate.classList.remove('flex');
            
            document.getElementById('user-display').innerText = currentShopEmail;
            loadServerData();
        } else {
            authGate.classList.remove('hidden');
            authGate.classList.add('flex');
        }
    } catch (e) {
        authGate.classList.remove('hidden');
        authGate.classList.add('flex');
    }
}

function toggleAuthMode() {
    isSignUpMode = !isSignUpMode;
    const title = document.getElementById('auth-title');
    const subtitle = document.getElementById('auth-subtitle');
    const submitBtn = document.getElementById('btn-auth-submit');
    const toggleBtn = document.getElementById('btn-auth-toggle');

    if (isSignUpMode) {
        title.innerText = "LitePOS Pro Registrasi";
        subtitle.innerText = "Buat akun toko baru untuk usaha Anda";
        submitBtn.innerText = "Daftar Toko Baru";
        toggleBtn.innerText = "Sudah punya akun toko? Login disini";
    } else {
        title.innerText = "LitePOS Pro Login";
        subtitle.innerText = "Masuk untuk mengelola kasir & toko Anda";
        submitBtn.innerText = "Masuk Ke Sistem";
        toggleBtn.innerText = "Belum punya akun? Daftar Toko Baru";
    }
}

async function handleAuth(e) {
    e.preventDefault();
    if (!db) return showCustomModal("Sistem Error", "Koneksi ke server terputus!", "error");
    
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const submitBtn = document.getElementById('btn-auth-submit');
    
    submitBtn.disabled = true;
    submitBtn.innerText = "Memproses...";
    
    try {
        if (isSignUpMode) {
            const { data, error } = await db.auth.signUp({ email, password });
            if (error) throw error;
            
            if (data && data.session) {
                showToast("Registrasi sukses! Toko langsung aktif.");
                checkUserSession();
            } else {
                showCustomModal("Registrasi Berhasil", "Toko berhasil terdaftar! Silakan lakukan login.", "success");
                isSignUpMode = false;
                toggleAuthMode();
            }
        } else {
            const { error } = await db.auth.signInWithPassword({ email, password });
            if (error) throw error;
            showToast("Berhasil masuk sistem!");
            checkUserSession();
        }
    } catch(err) {
        showCustomModal("Otentikasi Gagal", err.message, "error");
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = isSignUpMode ? "Daftar Toko Baru" : "Masuk Ke Sistem";
    }
}

async function handleLogout() {
    if (db) {
        await db.auth.signOut();
        window.location.reload();
    }
}

// ROUTING SPA NAVIGASI INTERAKTIF
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
    
    const titles = { 'dashboard': 'Dashboard Overview', 'pos': 'Mesin Kasir / POS', 'products': 'Inventori Stok' };
    document.getElementById('page-title').innerText = titles[tabId] || 'LitePOS Pro';
    
    const sidebar = document.getElementById('cart-sidebar');
    if (sidebar) sidebar.classList.add('translate-x-full');
}

function toggleMobileCart() {
    const sidebar = document.getElementById('cart-sidebar');
    if (sidebar) sidebar.classList.toggle('translate-x-full');
}

// REAL SERVERSIDE CRUD & CALCULATION ENGINE
async function loadServerData() {
    if (!db) return;
    try {
        let { data, error } = await db.from('products').select('*').order('name', { ascending: true });
        if (!error && data) products = data;
        
        renderCatalog();
        renderInventory();
        calculateDashboardMetrics();
        loadRecentTransactions();
    } catch(e) { console.error(e); }
}

async function handleProductSubmit(e) {
    e.preventDefault();
    if (!db) return;

    const barcode = document.getElementById('prod-barcode').value.trim();
    const name = document.getElementById('prod-name').value.trim();
    const price = parseInt(document.getElementById('prod-price').value);
    const stock = parseInt(document.getElementById('prod-stock').value);
    const category = document.getElementById('prod-category').value.trim();

    try {
        const { error } = await db.from('products').upsert([
            { barcode, name, price, stock, category }
        ], { onConflict: 'barcode' });

        if (error) throw error;
        
        showToast("Barang berhasil disimpan!");
        document.getElementById('product-form').reset();
        loadServerData();
    } catch(err) {
        showCustomModal("Gagal Menyimpan", err.message, "error");
    }
}

function renderCatalog(filterKeyword = '') {
    const grid = document.getElementById('product-grid');
    if (!grid) return;
    grid.innerHTML = '';
    
    const filtered = products.filter(p => 
        p.name.toLowerCase().includes(filterKeyword) || p.barcode.toLowerCase().includes(filterKeyword)
    );

    if (filtered.length === 0) {
        grid.innerHTML = `<p class="col-span-full text-center py-10 text-slate-500 text-xs">Stok kosong / tidak ditemukan</p>`;
        return;
    }
    
    filtered.forEach(p => {
        const isLow = p.stock <= 5;
        grid.innerHTML += `
            <div onclick="addToCart(${p.id})" class="bg-slate-800 border border-slate-700 hover:border-blue-500 rounded-xl p-3 cursor-pointer flex flex-col justify-between active:scale-95 shadow transition-all h-28 md:h-32">
                <div>
                    <div class="flex justify-between items-center mb-1">
                        <span class="text-[8px] bg-slate-900 text-slate-400 px-1.5 py-0.5 rounded font-mono border border-slate-700">${p.barcode}</span>
                        <span class="text-[9px] ${isLow ? 'text-rose-400':'text-emerald-400'} font-bold">Stok: ${p.stock}</span>
                    </div>
                    <h4 class="font-medium text-white text-xs line-clamp-2">${p.name}</h4>
                </div>
                <div class="mt-2 pt-1 border-t border-slate-700/50 flex justify-between items-center">
                    <span class="text-emerald-400 font-bold text-xs">Rp ${p.price.toLocaleString('id-ID')}</span>
                    <span class="w-5 h-5 bg-slate-900 border border-slate-700 text-white text-[10px] rounded-full flex items-center justify-center hover:bg-blue-600 hover:border-blue-500 transition-colors"><i class="fa-solid fa-plus"></i></span>
                </div>
            </div>
        `;
    });
}

function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    if (!product || product.stock <= 0) return showToast("Stok barang habis!", "error");

    const cartItem = cart.find(item => item.id === productId);
    if (cartItem) {
        if (cartItem.quantity >= product.stock) return showToast("Stok tidak mencukupi!", "error");
        cartItem.quantity++;
    } else {
        cart.push({ ...product, quantity: 1 });
    }
    updateCartUI();
    showToast(`Ditambahkan: ${product.name}`);
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
    if (document.getElementById('mobile-cart-count')) document.getElementById('mobile-cart-count').innerText = totalCount;
    
    if(cart.length === 0) {
        container.innerHTML = `<p class="text-center py-6 text-slate-500 text-xs">Keranjang kosong</p>`;
        document.getElementById('cart-total').innerText = "Rp 0";
        return;
    }

    container.innerHTML = '';
    let total = 0;
    cart.forEach(item => {
        total += item.price * item.quantity;
        container.innerHTML += `
            <div class="bg-slate-900/50 p-2.5 rounded-lg border border-slate-700 flex justify-between items-center text-xs">
                <div class="truncate pr-2 flex-1">
                    <h5 class="text-white truncate font-medium">${item.name}</h5>
                    <span class="text-emerald-400 font-medium">Rp ${item.price.toLocaleString('id-ID')}</span>
                </div>
                <div class="flex items-center bg-slate-900 rounded-lg p-1 border border-slate-700 shrink-0">
                    <button onclick="updateCartQty(${item.id}, -1)" class="w-5 h-5 text-slate-400 hover:text-white cursor-pointer"><i class="fa-solid fa-minus text-[10px]"></i></button>
                    <span class="px-2 font-bold text-white font-mono">${item.quantity}</span>
                    <button onclick="updateCartQty(${item.id}, 1)" class="w-5 h-5 text-slate-400 hover:text-white cursor-pointer"><i class="fa-solid fa-plus text-[10px]"></i></button>
                </div>
            </div>
        `;
    });
    document.getElementById('cart-total').innerText = `Rp ${total.toLocaleString('id-ID')}`;
}

function clearCart() { cart = []; updateCartUI(); }

async function checkout(method) {
    if(cart.length === 0) return showToast("Keranjang belanja kosong!", "error");
    const invoiceNum = "INV-" + Date.now().toString().slice(-5);
    let totalAmount = cart.reduce((acc, i) => acc + (i.price * i.quantity), 0);
    
    if(db) {
        try {
            const { error: txError } = await db.from('transactions').insert([
                { invoice_number: invoiceNum, total_price: totalAmount, payment_method: method }
            ]);
            if(txError) throw txError;

            for(let item of cart) {
                const updatedStock = item.stock - item.quantity;
                await db.from('products').update({ stock: updatedStock }).eq('id', item.id);
            }
        } catch (err) {
            return showCustomModal("Gagal Transaksi", err.message, "error");
        }
    }
    
    // Pemicu Struk Cetak PDF Otomatis
    printReceiptPDF(invoiceNum, totalAmount, method, cart);
    
    // Notifikasi Sukses Elegan In-App Modal
    showCustomModal("Transaksi Sukses", `Nomor Nota: ${invoiceNum}\nTotal Belanja: Rp ${totalAmount.toLocaleString('id-ID')}`, "success");
    
    clearCart();
    loadServerData();
}

function printReceiptPDF(invoice, total, method, itemsArray) {
    const shopNameElement = document.getElementById('p-shop-name');
    if(shopNameElement && currentShopEmail) {
        shopNameElement.innerText = currentShopEmail.split('@')[0].toUpperCase() + " STORE";
    }
    
    document.getElementById('p-invoice').innerText = invoice;
    document.getElementById('p-date').innerText = "Waktu: " + new Date().toLocaleString('id-ID');
    document.getElementById('p-total').innerText = "Rp " + total.toLocaleString('id-ID');
    document.getElementById('p-method').innerText = method;
    
    const itemsContainer = document.getElementById('p-items');
    itemsContainer.innerHTML = '';
    
    itemsArray.forEach(item => {
        itemsContainer.innerHTML += `
            <div class="flex justify-between text-xs font-mono">
                <span class="truncate max-w-[150px]">${item.name} (x${item.quantity || 1})</span>
                <span>Rp ${(item.price * (item.quantity || 1)).toLocaleString('id-ID')}</span>
            </div>
        `;
    });
    
    setTimeout(() => { window.print(); }, 300);
}

async function loadRecentTransactions() {
    if (!db) return;
    try {
        let { data: transactions, error } = await db.from('transactions').select('*').order('created_at', { ascending: false });
            
        if (!error && transactions) {
            serverTransactions = transactions;
            
            let totalRevenue = serverTransactions.reduce((sum, t) => sum + t.total_price, 0);
            document.getElementById('dash-revenue').innerText = `Rp ${totalRevenue.toLocaleString('id-ID')}`;
            document.getElementById('dash-tx-count').innerText = `${serverTransactions.length} Tx`;
            
            renderTransactionsTable(serverTransactions);
        }
    } catch(e) { console.error(e); }
}

function renderTransactionsTable(dataArray) {
    const table = document.getElementById('realtime-tx-table');
    if (!table) return;
    table.innerHTML = '';
    
    if(dataArray.length === 0) {
        table.innerHTML = `<tr><td colspan="5" class="py-4 text-center text-slate-500">Data nota tidak ditemukan</td></tr>`;
        return;
    }

    dataArray.forEach(t => {
        const timeStr = new Date(t.created_at).toLocaleDateString('id-ID', {day: 'numeric', month: 'short'}) + " " + new Date(t.created_at).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'});
        table.innerHTML += `
            <tr class="border-b border-slate-700/50 text-xs hover:bg-slate-800/40 transition-colors">
                <td class="py-3 px-3 text-blue-400 font-mono font-semibold">${t.invoice_number}</td>
                <td class="py-3 px-3">${timeStr}</td>
                <td class="py-3 px-3"><span class="px-2 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20">${t.payment_method}</span></td>
                <td class="py-3 px-3 text-right text-white font-bold">Rp ${t.total_price.toLocaleString('id-ID')}</td>
                <td class="py-3 px-3 text-center">
                    <button onclick="reprintInvoice('${t.invoice_number}')" class="px-3 py-1 bg-slate-700 hover:bg-blue-600 text-white rounded-lg text-[10px] cursor-pointer transition-all">
                        <i class="fa-solid fa-print mr-1"></i> Cetak Struk
                    </button>
                </td>
            </tr>
        `;
    });
}

function reprintInvoice(invoiceNum) {
    const targetTx = serverTransactions.find(t => t.invoice_number === invoiceNum);
    if(!targetTx) return showToast("Transaksi tidak ditemukan!", "error");
    
    const dummyItems = [{ name: "Belanjaan Toko", price: targetTx.total_price, quantity: 1 }];
    printReceiptPDF(targetTx.invoice_number, targetTx.total_price, targetTx.payment_method, dummyItems);
    showToast("Mencetak ulang struk lama...");
}

function filterTransactions() {
    const keyword = document.getElementById('search-tx-input').value.toLowerCase();
    const method = document.getElementById('filter-tx-method').value;
    
    const filtered = serverTransactions.filter(t => {
        const matchKeyword = t.invoice_number.toLowerCase().includes(keyword);
        const matchMethod = method === "" || t.payment_method === method;
        return matchKeyword && matchMethod;
    });
    
    renderTransactionsTable(filtered);
}

function calculateDashboardMetrics() {
    let lowStockCount = products.filter(p => p.stock <= 5).length;
    document.getElementById('dash-low-stock').innerText = `${lowStockCount} Item`;
}

function renderInventory(searchKeyword = '') {
    const tbody = document.getElementById('inventory-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    const filtered = products.filter(p => 
        p.name.toLowerCase().includes(searchKeyword) || p.barcode.toLowerCase().includes(searchKeyword)
    );

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="py-4 text-center text-slate-500">Master barang tidak ditemukan</td></tr>`;
        return;
    }

    filtered.forEach(p => {
        tbody.innerHTML += `
            <tr class="border-b border-slate-700/50 text-xs hover:bg-slate-800/40 transition-colors">
                <td class="py-3 px-4 font-mono text-slate-400">${p.barcode}</td>
                <td class="py-3 px-4 font-medium text-white">${p.name}</td>
                <td class="py-3 px-4 text-slate-400">${p.category}</td>
                <td class="py-3 px-4 text-right text-emerald-400">Rp ${p.price.toLocaleString('id-ID')}</td>
                <td class="py-3 px-4 text-center"><span class="px-2 py-0.5 rounded ${p.stock <= 5 ? 'bg-rose-500/20 text-rose-400':'bg-slate-700 text-slate-300'}">${p.stock} Pcs</span></td>
            </tr>
        `;
    });
}
