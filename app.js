// INITIALIZE SUPABASE CLIENT
const SUPABASE_URL = "https://kmynkqlkhmryptzpxidq.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_WnHWZXwVatUB8WTgaKI2fg_eWY-T6b3";
const db = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// STATE VARIABLES
let products = [];
let serverTransactions = [];
let cart = [];
let isSignUpMode = false;
let currentShopEmail = "";

// PENGATURAN SYSTEM STATE
let appSettings = {
    shopName: localStorage.getItem('pos_shopName') || "LitePOS Store",
    receiptDateOverride: localStorage.getItem('pos_receiptDate') || "",
    userRole: localStorage.getItem('pos_userRole') || "Super Admin",
    darkMode: localStorage.getItem('pos_darkMode') === 'false' ? false : true
};

document.addEventListener("DOMContentLoaded", () => {
    applySettingsOnLoad();
    startLiveClock(); // Memulai jam realtime
    checkUserSession();

    const searchInput = document.getElementById('barcode-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            renderCatalog(e.target.value.toLowerCase());
        });
    }
});

// PENGATURAN & TEMA SYSTEM
function applySettingsOnLoad() {
    document.getElementById('set-shop-name').value = appSettings.shopName;
    document.getElementById('set-receipt-date').value = appSettings.receiptDateOverride;
    document.getElementById('set-user-role').value = appSettings.userRole;
    document.getElementById('set-dark-mode').checked = appSettings.darkMode;
    
    document.getElementById('role-display').innerText = appSettings.userRole;

    if (appSettings.darkMode) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }

    // Role Based Access Control (RBAC) Simulasi Frontend
    const restrictedElements = document.querySelectorAll('.role-restricted');
    if (appSettings.userRole === "Kasir") {
        restrictedElements.forEach(el => el.classList.add('hidden'));
        switchTab('pos'); // Paksa pindah ke kasir
    } else {
        restrictedElements.forEach(el => el.classList.remove('hidden'));
    }
}

function saveSettings() {
    const sName = document.getElementById('set-shop-name').value.trim();
    const sDate = document.getElementById('set-receipt-date').value;
    const sRole = document.getElementById('set-user-role').value;
    const sDark = document.getElementById('set-dark-mode').checked;

    localStorage.setItem('pos_shopName', sName || "LitePOS Store");
    localStorage.setItem('pos_receiptDate', sDate);
    localStorage.setItem('pos_userRole', sRole);
    localStorage.setItem('pos_darkMode', sDark);

    appSettings = { shopName: sName, receiptDateOverride: sDate, userRole: sRole, darkMode: sDark };
    applySettingsOnLoad();
    showToast("Pengaturan sistem berhasil disimpan!");
}

// JAM & TANGGAL REALTIME
function startLiveClock() {
    const clockEl = document.getElementById('live-clock');
    if (!clockEl) return;
    setInterval(() => {
        const now = new Date();
        const options = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' };
        clockEl.innerText = now.toLocaleDateString('id-ID', options).replace(/\./g, ':');
    }, 1000);
}

// MODAL NOTIFIKASI
function showCustomModal(title, message, type = 'success') {
    const modal = document.getElementById('custom-modal');
    document.getElementById('modal-title').innerText = title;
    document.getElementById('modal-message').innerText = message;
    const mIconContainer = document.getElementById('modal-icon-container');
    const mIcon = document.getElementById('modal-icon');

    mIconContainer.className = "mx-auto w-12 h-12 rounded-full flex items-center justify-center text-xl mb-4";
    mIcon.className = "fa-solid";
    if (type === 'success') { mIconContainer.classList.add('bg-emerald-100', 'dark:bg-emerald-500/20', 'text-emerald-500'); mIcon.classList.add('fa-check'); }
    else { mIconContainer.classList.add('bg-rose-100', 'dark:bg-rose-500/20', 'text-rose-500'); mIcon.classList.add('fa-times'); }

    modal.classList.remove('hidden'); modal.classList.add('flex');
    setTimeout(() => { modal.firstElementChild.classList.remove('scale-95'); }, 10);
}

function closeCustomModal() {
    const modal = document.getElementById('custom-modal');
    modal.firstElementChild.classList.add('scale-95');
    setTimeout(() => { modal.classList.add('hidden'); modal.classList.remove('flex'); }, 150);
}

function showToast(message) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = "px-4 py-2.5 rounded-xl text-xs font-semibold shadow-xl border bg-emerald-100 border-emerald-300 text-emerald-800 dark:bg-emerald-900/90 dark:border-emerald-700 dark:text-emerald-300 flex items-center gap-2 transform translate-y-2 opacity-0 transition-all duration-300 z-50";
    toast.innerHTML = `<i class="fa-solid fa-check-circle"></i> ${message}`;
    container.appendChild(toast);
    setTimeout(() => { toast.classList.remove('translate-y-2', 'opacity-0'); }, 10);
    setTimeout(() => { toast.classList.add('opacity-0', 'translate-x-2'); setTimeout(() => toast.remove(), 300); }, 3000);
}

// OTENTIKASI
async function checkUserSession() {
    const authGate = document.getElementById('auth-gate');
    if (!db) return;
    try {
        const { data: { session }, error } = await db.auth.getSession();
        if (session && session.user) {
            currentShopEmail = session.user.email;
            authGate.classList.add('hidden'); authGate.classList.remove('flex');
            loadServerData();
        } else {
            authGate.classList.remove('hidden'); authGate.classList.add('flex');
        }
    } catch (e) { authGate.classList.remove('hidden'); authGate.classList.add('flex'); }
}

async function handleAuth(e) {
    e.preventDefault();
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    try {
        const { error } = isSignUpMode ? await db.auth.signUp({ email, password }) : await db.auth.signInWithPassword({ email, password });
        if (error) throw error;
        checkUserSession();
    } catch(err) { showCustomModal("Error", err.message, "error"); }
}

async function handleLogout() { if(db){ await db.auth.signOut(); window.location.reload(); } }

function switchTab(tabId) {
    const tabs = ['dashboard', 'pos', 'products', 'settings'];
    tabs.forEach(id => {
        const view = document.getElementById(`view-${id}`);
        const btn = document.getElementById(`btn-${id}`);
        if(view) view.classList.add('hidden');
        if(btn) btn.classList.remove('active-menu');
    });
    document.getElementById(`view-${tabId}`)?.classList.remove('hidden');
    document.getElementById(`btn-${tabId}`)?.classList.add('active-menu');
}

// TRANSAKSI & KALKULASI PAJAK, DISKON
async function loadServerData() {
    if(!db) return;
    const { data } = await db.from('products').select('*').order('name');
    if(data) products = data;
    renderCatalog();
    
    // Khusus Admin/Super Admin tarik log transaksi
    if(appSettings.userRole !== "Kasir"){
        const tx = await db.from('transactions').select('*').order('created_at', { ascending: false });
        if(tx.data) {
            serverTransactions = tx.data;
            let totalRev = serverTransactions.reduce((sum, t) => sum + t.total_price, 0);
            document.getElementById('dash-revenue').innerText = `Rp ${totalRev.toLocaleString('id-ID')}`;
            document.getElementById('dash-tx-count').innerText = `${serverTransactions.length} Tx`;
            // Simple render tx list (abbreviated for size constraints)
            document.getElementById('realtime-tx-table').innerHTML = serverTransactions.map(t => 
                `<tr class="border-b dark:border-slate-700 text-xs">
                    <td class="py-2">${t.invoice_number}</td><td class="py-2">${new Date(t.created_at).toLocaleDateString('id-ID')}</td>
                    <td class="py-2 text-right">Rp ${t.total_price.toLocaleString('id-ID')}</td>
                </tr>`
            ).join('');
        }
    }
}

function renderCatalog(filter = '') {
    const grid = document.getElementById('product-grid');
    if(!grid) return;
    const filtered = products.filter(p => p.name.toLowerCase().includes(filter));
    grid.innerHTML = filtered.map(p => `
        <div onclick="addToCart(${p.id})" class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 cursor-pointer shadow-sm active:scale-95 transition-transform flex flex-col justify-between">
            <h4 class="font-bold text-xs line-clamp-2 text-slate-800 dark:text-white">${p.name}</h4>
            <div class="mt-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs">Rp ${p.price.toLocaleString('id-ID')}</div>
        </div>
    `).join('');
}

function addToCart(id) {
    const prod = products.find(p => p.id === id);
    const item = cart.find(i => i.id === id);
    if(item) item.quantity++; else cart.push({...prod, quantity: 1});
    updateCartUI();
}

function clearCart() { cart = []; updateCartUI(); }

function calculateTotal() {
    let subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    let discount = parseFloat(document.getElementById('input-discount').value) || 0;
    let taxRate = parseFloat(document.getElementById('input-tax').value) || 0;
    
    let afterDiscount = subtotal - discount;
    if(afterDiscount < 0) afterDiscount = 0;
    
    let taxAmount = afterDiscount * (taxRate / 100);
    let finalTotal = afterDiscount + taxAmount;
    
    document.getElementById('cart-subtotal').innerText = `Rp ${subtotal.toLocaleString('id-ID')}`;
    document.getElementById('cart-final-total').innerText = `Rp ${finalTotal.toLocaleString('id-ID')}`;
    
    return { subtotal, discount, taxAmount, finalTotal };
}

function updateCartUI() {
    const container = document.getElementById('cart-items');
    container.innerHTML = cart.map(item => `
        <div class="bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg border border-slate-200 dark:border-slate-700 flex justify-between items-center text-xs">
            <div class="truncate">
                <div class="font-bold text-slate-900 dark:text-white">${item.name}</div>
                <div class="text-emerald-600 dark:text-emerald-400">Rp ${item.price.toLocaleString()} x ${item.quantity}</div>
            </div>
        </div>
    `).join('');
    calculateTotal();
}

async function checkout(method) {
    if(cart.length === 0) return showToast("Keranjang kosong!");
    const { subtotal, discount, taxAmount, finalTotal } = calculateTotal();
    const invoiceNum = "INV-" + Date.now().toString().slice(-5);
    
    if(db) {
        try {
            await db.from('transactions').insert([{ invoice_number: invoiceNum, total_price: finalTotal, payment_method: method }]);
        } catch(e) { return showCustomModal("Error", "Gagal ke database", "error"); }
    }
    
    // CETAK STRUK PDF DENGAN DATA LENGKAP
    document.getElementById('p-shop-name').innerText = appSettings.shopName;
    
    // Gunakan tanggal override jika disetting, kalau tidak gunakan realtime
    let dateStr = appSettings.receiptDateOverride ? new Date(appSettings.receiptDateOverride).toLocaleDateString('id-ID') : new Date().toLocaleString('id-ID');
    document.getElementById('p-date').innerText = "Waktu: " + dateStr;
    document.getElementById('p-invoice').innerText = invoiceNum;
    
    document.getElementById('p-items').innerHTML = cart.map(item => `
        <div class="flex justify-between font-mono">
            <span class="truncate max-w-[120px]">${item.name} (x${item.quantity})</span>
            <span>Rp ${(item.price * item.quantity).toLocaleString()}</span>
        </div>
    `).join('');
    
    document.getElementById('p-subtotal').innerText = "Rp " + subtotal.toLocaleString('id-ID');
    document.getElementById('p-discount').innerText = "- Rp " + discount.toLocaleString('id-ID');
    document.getElementById('p-tax').innerText = "+ Rp " + taxAmount.toLocaleString('id-ID');
    document.getElementById('p-total').innerText = "Rp " + finalTotal.toLocaleString('id-ID');
    document.getElementById('p-method').innerText = method;
    document.getElementById('p-cashier').innerText = appSettings.userRole;
    
    setTimeout(() => { window.print(); clearCart(); loadServerData(); }, 300);
}
