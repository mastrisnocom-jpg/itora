// INITIALIZE SUPABASE CLIENT
const SUPABASE_URL = "https://kmynkqlkhmryptzpxidq.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_WnHWZXwVatUB8WTgaKI2fg_eWY-T6b3";

// Proteksi inisialisasi UMD SDK dari CDN paket stabil
const supabaseClient = window.supabase ? window.supabase : null;
const supabase = supabaseClient ? supabaseClient.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

let products = [];
let cart = [];
let isSignUpMode = false;

document.addEventListener("DOMContentLoaded", () => {
    checkUserSession();

    const searchInput = document.getElementById('barcode-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            renderCatalog(e.target.value.toLowerCase());
        });
    }
});

// MEMPROSES TAMPILAN DAN HAK AKSES SISTEM AUTH
async function checkUserSession() {
    if (!supabase) return;
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        
        if (session && session.user) {
            document.getElementById('auth-gate').style.display = 'none';
            document.getElementById('user-display').innerText = session.user.email;
            loadServerData();
        } else {
            document.getElementById('auth-gate').style.display = 'flex';
        }
    } catch (e) {
        console.error("Session check error:", e);
        document.getElementById('auth-gate').style.display = 'flex';
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
    if (!supabase) return alert("Koneksi pustaka server Supabase terputus!");
    
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const submitBtn = document.getElementById('btn-auth-submit');
    
    submitBtn.disabled = true;
    submitBtn.innerText = "Memproses...";
    
    try {
        if (isSignUpMode) {
            const { data, error } = await supabase.auth.signUp({ email, password });
            if (error) throw error;
            
            // Cek jika akun langsung ter-login otomatis (jika konfirmasi email off di Supabase)
            if (data && data.session) {
                alert("Registrasi sukses! Toko Anda langsung diaktifkan.");
                checkUserSession();
            } else {
                alert("Registrasi berhasil diajukan! Silakan login menggunakan akun tersebut.");
                isSignUpMode = false;
                toggleAuthMode();
            }
        } else {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            checkUserSession();
        }
    } catch(err) {
        alert("Gagal Otentikasi: " + err.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = isSignUpMode ? "Daftar Toko Baru" : "Masuk Ke Sistem";
    }
}

async function handleLogout() {
    if (supabase) {
        await supabase.auth.signOut();
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
    if (!supabase) return;
    try {
        let { data, error } = await supabase.from('products').select('*').order('name', { ascending: true });
        if (!error && data) products = data;
        
        renderCatalog();
        renderInventory();
        calculateDashboardMetrics();
        loadRecentTransactions();
    } catch(e) { console.error("Load Server Data Error:", e); }
}

async function handleProductSubmit(e) {
    e.preventDefault();
    if (!supabase) return;

    const barcode = document.getElementById('prod-barcode').value.trim();
    const name = document.getElementById('prod-name').value.trim();
    const price = parseInt(document.getElementById('prod-price').value);
    const stock = parseInt(document.getElementById('prod-stock').value);
    const category = document.getElementById('prod-category').value.trim();

    try {
        const { error } = await supabase.from('products').upsert([
            { barcode, name, price, stock, category }
        ], { onConflict: 'user_id, barcode' });

        if (error) throw error;
        
        alert("Barang berhasil disimpan!");
        document.getElementById('product-form').reset();
        loadServerData();
    } catch(err) {
        alert("Gagal memproses barang: " + err.message);
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
        grid.innerHTML = `<p class="col-span-full text-center py-10 text-gray-500 text-xs">Stok kosong / tidak ditemukan</p>`;
        return;
    }
    
    filtered.forEach(p => {
        const isLow = p.stock <= 5;
        grid.innerHTML += `
            <div onclick="addToCart(${p.id})" class="bg-gray-800 border border-gray-700 hover:border-blue-500 rounded-xl p-3 cursor-pointer flex flex-col justify-between active:scale-95 shadow transition-all h-28 md:h-32">
                <div>
                    <div class="flex justify-between items-center mb-1">
                        <span class="text-[8px] bg-gray-700 text-gray-400 px-1 py-0.5 rounded font-mono">${p.barcode}</span>
                        <span class="text-[9px] ${isLow ? 'text-rose-400':'text-emerald-400'} font-bold">Stok:${p.stock}</span>
                    </div>
                    <h4 class="font-medium text-white text-xs line-clamp-2">${p.name}</h4>
                </div>
                <div class="mt-2 pt-1 border-t border-gray-700 flex justify-between items-center">
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
    if (document.getElementById('mobile-cart-count')) document.getElementById('mobile-cart-count').innerText = totalCount;
    
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
            <div class="bg-gray-750 p-2.5 rounded-lg border border-gray-700 flex justify-between items-center text-xs">
                <div class="truncate pr-2 flex-1">
                    <h5 class="text-white truncate font-medium">${item.name}</h5>
                    <span class="text-emerald-400">Rp ${item.price.toLocaleString('id-ID')}</span>
                </div>
                <div class="flex items-center bg-gray-900 rounded p-1 shrink-0">
                    <button onclick="updateCartQty(${item.id}, -1)" class="w-5 h-5 text-gray-400 hover:text-white cursor-pointer"><i class="fa-solid fa-minus text-[10px]"></i></button>
                    <span class="px-2 font-bold text-white font-mono">${item.quantity}</span>
                    <button onclick="updateCartQty(${item.id}, 1)" class="w-5 h-5 text-gray-400 hover:text-white cursor-pointer"><i class="fa-solid fa-plus text-[10px]"></i></button>
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
    
    if(supabase) {
        try {
            const { error: txError } = await supabase.from('transactions').insert([
                { invoice_number: invoiceNum, total_price: totalAmount, payment_method: method }
            ]);
            if(txError) throw txError;

            for(let item of cart) {
                const updatedStock = item.stock - item.quantity;
                await supabase.from('products').update({ stock: updatedStock }).eq('id', item.id);
            }
        } catch (err) {
            return alert("Gagal memproses Checkout: " + err.message);
        }
    }
    
    alert(`Transaksi Berhasil!\n${invoiceNum} - Total: Rp ${totalAmount.toLocaleString('id-ID')}`);
    clearCart();
    loadServerData();
}

async function loadRecentTransactions() {
    if (!supabase) return;
    try {
        let { data: transactions, error } = await supabase.from('transactions').select('*').order('created_at', { ascending: false }).limit(10);
            
        if (!error && transactions) {
            const table = document.getElementById('realtime-tx-table');
            if (!table) return;
            table.innerHTML = '';
            
            let totalRevenue = 0;
            transactions.forEach(t => {
                totalRevenue += t.total_price;
                const timeStr = new Date(t.created_at).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'});
                table.innerHTML += `
                    <tr class="border-b border-gray-700 text-xs">
                        <td class="py-2.5 px-3 text-blue-400 font-mono">${t.invoice_number}</td>
                        <td class="py-2.5 px-3">${timeStr}</td>
                        <td class="py-2.5 px-3"><span class="px-1.5 py-0.5 rounded text-[9px] bg-blue-900/40 text-blue-300 border border-blue-700/50">${t.payment_method}</span></td>
                        <td class="py-2.5 px-3 text-right text-white font-bold">Rp ${t.total_price.toLocaleString('id-ID')}</td>
                    </tr>
                `;
            });
            document.getElementById('dash-revenue').innerText = `Rp ${totalRevenue.toLocaleString('id-ID')}`;
            document.getElementById('dash-tx-count').innerText = `${transactions.length} Tx`;
        }
    } catch(e) { console.error("Recent Transactions error:", e); }
}

function calculateDashboardMetrics() {
    let lowStockCount = products.filter(p => p.stock <= 5).length;
    document.getElementById('dash-low-stock').innerText = `${lowStockCount} Item`;
}

function renderInventory() {
    const tbody = document.getElementById('inventory-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    products.forEach(p => {
        tbody.innerHTML += `
            <tr class="border-b border-gray-700 text-xs hover:bg-gray-800/40">
                <td class="py-3 px-4 font-mono text-gray-400">${p.barcode}</td>
                <td class="py-3 px-4 font-medium text-white">${p.name}</td>
                <td class="py-3 px-4 text-gray-400">${p.category}</td>
                <td class="py-3 px-4 text-right text-emerald-400">Rp ${p.price.toLocaleString('id-ID')}</td>
                <td class="py-3 px-4 text-center"><span class="px-2 py-0.5 rounded ${p.stock <= 5 ? 'bg-rose-500/20 text-rose-400':'bg-gray-700 text-gray-300'}">${p.stock} Pcs</span></td>
            </tr>
        `;
    });
}
