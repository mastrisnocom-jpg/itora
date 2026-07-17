// INISIALISASI SUPABASE
const SUPABASE_URL = "https://kmynkqlkhmryptzpxidq.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_WnHWZXwVatUB8WTgaKI2fg_eWY-T6b3";
const db = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// STATE UTAMA
let products = [];
let serverTransactions = [];
let cart = [];
let isSignUpMode = false;
let currentShopEmail = "";

// STATE PENGATURAN SYSTEM (CLOUD)
let appSettings = {
    shopName: "LitePOS Store",
    receiptDateOverride: "",
    darkMode: true
};
let currentUserRole = "Kasir"; 

// FITUR ANTI LAG PENCARIAN
let searchDebounceTimeout;

document.addEventListener("DOMContentLoaded", () => {
    startLiveClock();
    checkUserSession();

    // Event Listener dengan sistem Anti-Lag
    const searchInput = document.getElementById('barcode-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchDebounceTimeout);
            searchDebounceTimeout = setTimeout(() => {
                renderCatalog(e.target.value.toLowerCase());
            }, 250); 
        });
    }

    const disInput = document.getElementById('input-discount');
    const taxInput = document.getElementById('input-tax');
    if(disInput) disInput.addEventListener('input', () => calculateTotal());
    if(taxInput) taxInput.addEventListener('input', () => calculateTotal());
});

async function syncSettingsAndRole() {
    if(!db) return;
    try {
        // Ambil profil / role berdasarkan email
        const { data: profile } = await db.from('profiles').select('role').eq('email', currentShopEmail).single();
        if (profile) {
            currentUserRole = profile.role;
        } else {
            await db.from('profiles').insert([{ email: currentShopEmail, role: 'Kasir' }]);
            currentUserRole = 'Kasir';
        }

        // Ambil Global Settings Toko
        const { data: settings } = await db.from('settings').select('*').eq('id', 1).single();
        if (settings) {
            appSettings.shopName = settings.shop_name;
            appSettings.receiptDateOverride = settings.receipt_date;
            appSettings.darkMode = settings.dark_mode;
        }

        applySettingsUI();
    } catch (e) {
        console.error("Gagal sinkronisasi data cloud:", e);
    }
}

function applySettingsUI() {
    document.getElementById('set-shop-name').value = appSettings.shopName;
    document.getElementById('set-receipt-date').value = appSettings.receiptDateOverride;
    document.getElementById('set-user-role').value = currentUserRole;
    document.getElementById('set-dark-mode').checked = appSettings.darkMode;
    
    document.getElementById('role-display').innerText = currentUserRole;

    if (appSettings.darkMode) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }

    // SISTEM KEAMANAN & ANTI LOCKOUT
    const restrictedElements = document.querySelectorAll('.role-restricted');
    
    // Khusus mastrisnocom@gmail.com kebal terhadap penguncian menu
    if (currentUserRole === "Kasir" && currentShopEmail !== "mastrisnocom@gmail.com") {
        restrictedElements.forEach(el => el.classList.add('hidden'));
        switchTab('pos'); 
    } else {
        restrictedElements.forEach(el => el.classList.remove('hidden'));
    }
}

async function saveSettings() {
    const sName = document.getElementById('set-shop-name').value.trim();
    const sDate = document.getElementById('set-receipt-date').value;
    const sDark = document.getElementById('set-dark-mode').checked;
    const sRole = document.getElementById('set-user-role').value;

    try {
        await db.from('settings').update({ shop_name: sName || "LitePOS Store", receipt_date: sDate, dark_mode: sDark }).eq('id', 1);
        await db.from('profiles').update({ role: sRole }).eq('email', currentShopEmail);

        appSettings = { shopName: sName, receiptDateOverride: sDate, darkMode: sDark };
        currentUserRole = sRole;
        
        applySettingsUI();
        showToast("Pengaturan & Role berhasil disimpan ke Cloud!");
    } catch(err) {
        showCustomModal("Error Simpan", "Gagal menyimpan ke Supabase", "error");
    }
}

function startLiveClock() {
    const clockEl = document.getElementById('live-clock');
    if (!clockEl) return;
    setInterval(() => {
        const now = new Date();
        const options = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' };
        clockEl.innerText = now.toLocaleDateString('id-ID', options).replace(/\./g, ':');
    }, 1000);
}

// UI UTILITIES
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
    toast.className = "px-4 py-2.5 rounded-xl text-xs font-bold shadow-xl border bg-slate-900 border-slate-700 text-white dark:bg-emerald-900/90 dark:border-emerald-700 dark:text-emerald-300 flex items-center gap-2 transform translate-y-2 opacity-0 transition-all duration-300 z-50";
    toast.innerHTML = `<i class="fa-solid fa-cloud-check text-blue-400 dark:text-emerald-400"></i> ${message}`;
    container.appendChild(toast);
    setTimeout(() => { toast.classList.remove('translate-y-2', 'opacity-0'); }, 10);
    setTimeout(() => { toast.classList.add('opacity-0', 'translate-x-2'); setTimeout(() => toast.remove(), 300); }, 3000);
}

// OTENTIKASI SISTEM
async function checkUserSession() {
    const authGate = document.getElementById('auth-gate');
    if (!db) return;
    try {
        const { data: { session }, error } = await db.auth.getSession();
        if (session && session.user) {
            currentShopEmail = session.user.email;
            authGate.classList.add('hidden'); authGate.classList.remove('flex');
            
            await syncSettingsAndRole();
            loadServerData();
        } else {
            authGate.classList.remove('hidden'); authGate.classList.add('flex');
        }
    } catch (e) { authGate.classList.remove('hidden'); authGate.classList.add('flex'); }
}

function toggleAuthMode() {
    isSignUpMode = !isSignUpMode;
    document.getElementById('auth-title').innerText = isSignUpMode ? "Registrasi Akun" : "LitePOS Pro Login";
    document.getElementById('btn-auth-submit').innerText = isSignUpMode ? "Daftar Toko Baru" : "Masuk Sistem";
    document.getElementById('btn-auth-toggle').innerText = isSignUpMode ? "Sudah punya akun? Login" : "Belum punya akun? Daftar";
}

async function handleAuth(e) {
    e.preventDefault();
    if(!db) return showCustomModal("Error", "Koneksi database terputus!", "error");
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const btn = document.getElementById('btn-auth-submit');
    
    btn.disabled = true; btn.innerText = "Memproses...";
    try {
        const { error } = isSignUpMode ? await db.auth.signUp({ email, password }) : await db.auth.signInWithPassword({ email, password });
        if (error) throw error;
        checkUserSession();
    } catch(err) { 
        showCustomModal("Otentikasi Gagal", err.message, "error"); 
    } finally {
        btn.disabled = false; btn.innerText = isSignUpMode ? "Daftar Toko Baru" : "Masuk Sistem";
    }
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
    
    const sidebar = document.getElementById('cart-sidebar');
    if (sidebar && window.innerWidth < 1024) sidebar.classList.add('translate-x-full');
}

function toggleMobileCart() {
    const sidebar = document.getElementById('cart-sidebar');
    if (sidebar) sidebar.classList.toggle('translate-x-full');
}

// LOGIKA DATABASE & TRANSAKSI
async function loadServerData() {
    if(!db) return;
    const { data } = await db.from('products').select('*').order('name');
    if(data) products = data;
    renderCatalog();
    
    if(currentUserRole !== "Kasir" || currentShopEmail === "mastrisnocom@gmail.com"){
        const tx = await db.from('transactions').select('*').order('created_at', { ascending: false });
        if(tx.data) {
            serverTransactions = tx.data;
            let totalRev = serverTransactions.reduce((sum, t) => sum + t.total_price, 0);
            document.getElementById('dash-revenue').innerText = `Rp ${totalRev.toLocaleString('id-ID')}`;
            document.getElementById('dash-tx-count').innerText = `${serverTransactions.length} Tx`;
            
            document.getElementById('realtime-tx-table').innerHTML = serverTransactions.map(t => 
                `<tr class="border-b border-slate-200 dark:border-slate-700/50 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td class="py-2.5 px-3 font-mono text-blue-500">${t.invoice_number}</td>
                    <td class="py-2.5 px-3">${new Date(t.created_at).toLocaleDateString('id-ID')}</td>
                    <td class="py-2.5 px-3 text-right font-semibold">Rp ${t.total_price.toLocaleString('id-ID')}</td>
                </tr>`
            ).join('');
        }
    }
}

// RENDERING KATALOG
function renderCatalog(filter = '') {
    const grid = document.getElementById('product-grid');
    if(!grid) return;
    const filtered = products.filter(p => p.name.toLowerCase().includes(filter) || p.barcode.toLowerCase().includes(filter));
    
    if(filtered.length === 0) {
        grid.innerHTML = `<p class="col-span-full text-center py-10 text-slate-400 text-xs">Pencarian tidak menemukan hasil</p>`;
        return;
    }

    grid.innerHTML = filtered.map(p => {
        const isLow = p.stock <= 5;
        return `
        <div onclick="addToCart(${p.id})" class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-400 rounded-xl p-3 cursor-pointer flex flex-col justify-between active:scale-95 shadow-sm hover:shadow transition-all h-28 md:h-32">
            <div>
                <div class="flex justify-between items-center mb-1.5">
                    <span class="text-[8px] bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded font-mono border border-slate-200 dark:border-slate-700">${p.barcode}</span>
                    <span class="text-[9px] ${isLow ? 'text-rose-500':'text-emerald-500'} font-bold">Stok: ${p.stock}</span>
                </div>
                <h4 class="font-medium text-slate-800 dark:text-white text-xs line-clamp-2 leading-tight">${p.name}</h4>
            </div>
            <div class="mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-700/50 flex justify-between items-center">
                <span class="text-blue-600 dark:text-emerald-400 font-bold text-xs">Rp ${p.price.toLocaleString('id-ID')}</span>
                <span class="w-5 h-5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-white text-[10px] rounded-full flex items-center justify-center hover:bg-blue-600 hover:text-white hover:border-blue-500 transition-colors"><i class="fa-solid fa-plus"></i></span>
            </div>
        </div>
        `
    }).join('');
}

// LOGIKA KERANJANG
function addToCart(id) {
    const prod = products.find(p => p.id === id);
    if (!prod || prod.stock <= 0) return showToast("Stok barang habis!");
    
    const item = cart.find(i => i.id === id);
    if (item) {
        if (item.quantity >= prod.stock) return showToast("Maksimal stok tercapai!");
        item.quantity++;
    } else {
        cart.push({...prod, quantity: 1});
    }
    updateCartUI();
    showToast(`Berhasil menambah ${prod.name}`);
}

function updateCartQty(productId, delta) {
    const item = cart.find(i => i.id === productId);
    if (!item) return;
    
    const prod = products.find(p => p.id === productId);
    if (delta > 0 && item.quantity >= prod.stock) return showToast("Maksimal stok tercapai!");

    item.quantity += delta;
    if (item.quantity <= 0) {
        cart = cart.filter(i => i.id !== productId);
    }
    updateCartUI();
}

function clearCart() { cart = []; updateCartUI(); }

function calculateTotal() {
    let subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    let inputDis = document.getElementById('input-discount').value;
    let inputTax = document.getElementById('input-tax').value;
    let discount = parseFloat(inputDis === "" ? 0 : inputDis);
    let taxRate = parseFloat(inputTax === "" ? 0 : inputTax);
    
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
    const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    if (document.getElementById('mobile-cart-count')) document.getElementById('mobile-cart-count').innerText = totalCount;

    if(cart.length === 0) {
        container.innerHTML = `<p class="text-center py-6 text-slate-400 text-xs">Keranjang kosong, klik barang untuk menambah.</p>`;
        calculateTotal();
        return;
    }

    container.innerHTML = cart.map(item => `
        <div class="bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 flex justify-between items-center text-xs shadow-sm">
            <div class="truncate pr-2 flex-1">
                <h5 class="text-slate-900 dark:text-white truncate font-bold">${item.name}</h5>
                <span class="text-blue-600 dark:text-emerald-400 font-medium">Rp ${item.price.toLocaleString('id-ID')}</span>
            </div>
            <div class="flex items-center bg-white dark:bg-slate-900 rounded-lg p-1 border border-slate-200 dark:border-slate-700 shrink-0 shadow-inner">
                <button onclick="updateCartQty(${item.id}, -1)" class="w-6 h-6 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer transition-colors bg-slate-100 dark:bg-slate-800 rounded"><i class="fa-solid fa-minus text-[10px]"></i></button>
                <span class="px-3 font-bold text-slate-800 dark:text-white font-mono">${item.quantity}</span>
                <button onclick="updateCartQty(${item.id}, 1)" class="w-6 h-6 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer transition-colors bg-slate-100 dark:bg-slate-800 rounded"><i class="fa-solid fa-plus text-[10px]"></i></button>
            </div>
        </div>
    `).join('');
    
    calculateTotal();
}

async function handleProductSubmit(e) {
    e.preventDefault();
    if (!db) return;
    const barcode = document.getElementById('prod-barcode').value.trim();
    const name = document.getElementById('prod-name').value.trim();
    const price = parseInt(document.getElementById('prod-price').value);
    const stock = parseInt(document.getElementById('prod-stock').value);

    try {
        const { error } = await db.from('products').upsert([{ barcode, name, price, stock, category: "UMUM" }], { onConflict: 'barcode' });
        if (error) throw error;
        showToast("Barang master berhasil disimpan!");
        document.getElementById('product-form').reset();
        loadServerData();
    } catch(err) {
        showCustomModal("Gagal Menyimpan", err.message, "error");
    }
}

async function checkout(method) {
    if(cart.length === 0) return showCustomModal("Peringatan", "Pilih barang terlebih dahulu!", "error");
    const { subtotal, discount, taxAmount, finalTotal } = calculateTotal();
    const invoiceNum = "INV-" + Date.now().toString().slice(-5);
    
    if(db) {
        try {
            await db.from('transactions').insert([{ invoice_number: invoiceNum, total_price: finalTotal, payment_method: method }]);
            
            for(let item of cart) {
                const updatedStock = item.stock - item.quantity;
                await db.from('products').update({ stock: updatedStock }).eq('id', item.id);
            }
        } catch(e) { 
            return showCustomModal("Error Server", "Transaksi gagal direkam ke database", "error"); 
        }
    }
    
    document.getElementById('p-shop-name').innerText = appSettings.shopName;
    let dateStr = appSettings.receiptDateOverride ? new Date(appSettings.receiptDateOverride).toLocaleDateString('id-ID') : new Date().toLocaleString('id-ID');
    
    document.getElementById('p-date').innerText = "Waktu: " + dateStr;
    document.getElementById('p-invoice').innerText = invoiceNum;
    
    document.getElementById('p-items').innerHTML = cart.map(item => `
        <div class="flex justify-between font-mono">
            <span class="truncate max-w-[140px]">${item.name} (x${item.quantity})</span>
            <span>Rp ${(item.price * item.quantity).toLocaleString('id-ID')}</span>
        </div>
    `).join('');
    
    document.getElementById('p-subtotal').innerText = "Rp " + subtotal.toLocaleString('id-ID');
    document.getElementById('p-discount').innerText = "- Rp " + discount.toLocaleString('id-ID');
    document.getElementById('p-tax').innerText = "+ Rp " + taxAmount.toLocaleString('id-ID');
    document.getElementById('p-total').innerText = "Rp " + finalTotal.toLocaleString('id-ID');
    document.getElementById('p-method').innerText = method;
    document.getElementById('p-cashier').innerText = currentUserRole;
    
    showCustomModal("Transaksi Berhasil", `Invoice: ${invoiceNum}\nTotal: Rp ${finalTotal.toLocaleString('id-ID')}`, "success");
    
    setTimeout(() => { window.print(); clearCart(); loadServerData(); }, 300);
}
