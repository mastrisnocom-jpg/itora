const SUPABASE_URL = 'https://waaufoxlimqtesmmjhyw.supabase.co';
const SUPABASE_KEY = 'sb_publishable_X6icNByv3YFbekorwJ6kSw_SX0XUFM8';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let liveNotifications = [
    { id: 1, icon: 'shield_person', user: 'Super Admin', type: 'admin', desc: 'Sistem Workspace Tech Social versi 2.4 berhasil diperbarui ke server cloud.', isUnread: true },
    { id: 2, icon: 'handshake', user: 'System', type: 'admin', desc: 'Fitur network teman aktif. Sekarang Anda dapat mencari user lain di halaman Eksplor.', isUnread: false }
];

let activeChatFriendEmail = null;
let activeChatFriendName = null;

// Mengubah tipe penampung berkas dari string Base64 ke Object File asli / mentah
let composerAttachedImageFile = null;
let composerAttachedCustomFile = null;
let composerAttachedFileName = "Dokumen.bin";

let unreadMessageCounters = {}; 
let liveHeaderNotificationCount = 1; 
let headerSearchFilterQueryString = ""; 

const EMOJI_LIST = ['😊', '😂', '🔥', '👍', '🙌', '💯', '❤️', '👏', '🎉', '😮', '😢', '🙏'];

// Helper Global untuk proses unggah data biner ke Supabase Storage (posts-bucket)
async function uploadFileToSupabaseStorage(folderPath, fileObject) {
    if (!fileObject) return null;
    
    const fileExtension = fileObject.name.split('.').pop();
    const uniqueFileName = `${folderPath}/${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${fileExtension}`;
    
    const { data, error } = await supabaseClient.storage
        .from('posts-bucket')
        .upload(uniqueFileName, fileObject, {
            cacheControl: '3600',
            upsert: false
        });
        
    if (error) {
        console.error("Gagal mengunggah berkas ke Storage:", error.message);
        throw error;
    }
    
    const { data: publicUrlData } = supabaseClient.storage
        .from('posts-bucket')
        .getPublicUrl(uniqueFileName);
        
    return publicUrlData.publicUrl;
}

const App = {
    init() {
        this.Theme.init();
        this.Clock.start();
        this.Network.listen();
        this.UI.bindGlobalEvents();
        this.Navigation.render();
        this.Auth.checkCurrentSession();
        this.Realtime.subscribePosts();
        
        App.UI.refreshHeaderNotificationBadgeDOM();
        App.UI.renderGlobalBannerAdIfExists();
    },

    ProfileState: {
        getCurrentName() {
            const savedName = localStorage.getItem('ns_display_name');
            if (savedName) return savedName;
            return (localStorage.getItem('ns_user_email') || 'User').split('@')[0];
        },
        getCurrentRoleBioStatus() {
            const email = (localStorage.getItem('ns_user_email') || '').toLowerCase();
            if(email === 'mastrisnocom@gmail.com') return 'Super Administrator';
            return localStorage.getItem('ns_user_bio_status') || 'Tech Workspace Member';
        },
        getCurrentAvatar() {
            return localStorage.getItem('ns_user_avatar_url') || 'https://i.pravatar.cc/150?img=12';
        },
        getLimitConfig() {
            const defaultLimit = { count: 0, month: new Date().getMonth() };
            const saved = localStorage.getItem('ns_edit_limit_log');
            if (!saved) return defaultLimit;
            const parsed = JSON.parse(saved);
            if (parsed.month !== new Date().getMonth()) return defaultLimit;
            return parsed;
        },
        updateProfileDataConfiguration(newName, newBio) {
            const config = this.getLimitConfig();
            if(config.count >= 3) return { success: false, message: "Kuota modifikasi bulanan Anda habis." };
            config.count += 1;
            config.month = new Date().getMonth();
            localStorage.setItem('ns_display_name', newName);
            localStorage.setItem('ns_user_bio_status', newBio);
            localStorage.setItem('ns_edit_limit_log', JSON.stringify(config));
            App.UI.syncGlobalAvatarAndName();
            return { success: true };
        },
        saveCompressedAvatar(avatarPublicUrl) {
            localStorage.setItem('ns_user_avatar_url', avatarPublicUrl);
            App.UI.syncGlobalAvatarAndName();
        }
    },

    Realtime: {
        subscribePosts() {
            supabaseClient
                .channel('schema-db-changes')
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, async (payload) => {
                    const newPost = payload.new;
                    const myCurrentName = App.ProfileState.getCurrentName();

                    if (newPost.image === 'private_chat_type') {
                        if (newPost.role === myCurrentName) {
                            const searchFriendEmail = newPost.author.toLowerCase() + "@nexsocial.id";
                            
                            liveNotifications.unshift({
                                id: Date.now(),
                                icon: 'chat',
                                user: newPost.author,
                                type: 'chat',
                                desc: `Mengirimkan sebuah pesan pribadi baru: "${newPost.content.substring(0, 30)}..."`,
                                isUnread: true
                            });
                            
                            liveHeaderNotificationCount++;
                            App.UI.refreshHeaderNotificationBadgeDOM();

                            if (activeChatFriendName === newPost.author && document.getElementById('floating-chat-popup-box').classList.contains('active')) {
                                App.Features.appendIncomingBubbleDOM(newPost.author, newPost.content);
                            } else {
                                unreadMessageCounters[searchFriendEmail] = (unreadMessageCounters[searchFriendEmail] || 0) + 1;
                                App.Toast.show("Pesan baru dari " + newPost.author, "success");
                                App.UI.updateGlobalMessageNotificationBadgeCount();
                                if(document.getElementById('popup-friends-sidebar-items')) App.Features.loadPopupFriendsListSidebar();
                            }
                        }
                        return;
                    }

                    if (newPost.author !== myCurrentName) {
                        const myEmail = localStorage.getItem('ns_user_email') || '';
                        const { data: friends } = await supabaseClient.from('friends').select('friend_email').eq('user_email', myEmail);
                        const friendListNames = friends ? friends.map(f => f.friend_email.split('@')[0]) : [];

                        if (friendListNames.includes(newPost.author)) {
                            liveNotifications.unshift({
                                id: Date.now(),
                                icon: 'campaign',
                                user: newPost.author,
                                type: 'feed',
                                desc: `Menerbitkan kiriman timeline baru: "${newPost.content.substring(0, 30)}..."`,
                                isUnread: true
                            });

                            liveHeaderNotificationCount++;
                            App.UI.refreshHeaderNotificationBadgeDOM();
                            App.Toast.show(`Teman Anda (${newPost.author}) membuat postingan baru!`, "success");
                        }
                        if (window.location.hash === '#/feed') App.Features.renderPosts();
                    }
                })
                .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'posts' }, async (payload) => {
                    const updatedPost = payload.new;
                    const myCurrentName = App.ProfileState.getCurrentName();

                    if (updatedPost.author === myCurrentName && updatedPost.image !== 'private_chat_type') {
                        let parsedComments = [];
                        try { if(updatedPost.role && updatedPost.role.startsWith('[')) parsedComments = JSON.parse(updatedPost.role); } catch(e) {}
                        
                        if (parsedComments.length > 0) {
                            const latestComment = parsedComments[parsedComments.length - 1];
                            if (latestComment.user !== myCurrentName) {
                                liveNotifications.unshift({
                                    id: Date.now(),
                                    icon: 'maps_ugc',
                                    user: latestComment.user,
                                    type: 'comment',
                                    desc: `Mengomentari postingan Anda: "${latestComment.text.substring(0, 25)}"`,
                                    isUnread: true
                                });
                                liveHeaderNotificationCount++;
                                App.UI.refreshHeaderNotificationBadgeDOM();
                            }
                        }
                    }
                    if (window.location.hash === '#/feed') App.Features.renderPosts();
                })
                .subscribe();
        }
    },

    Auth: {
        async checkCurrentSession() {
            try {
                const { data, error } = await supabaseClient.auth.getSession();
                if (error) throw error;

                if(data?.session) {
                    localStorage.setItem('ns_logged_in', 'true');
                    localStorage.setItem('ns_user_email', data.session.user.email);
                    App.UI.syncGlobalAvatarAndName();
                    App.Auth.showApp();
                    App.Router.init();
                } else {
                    localStorage.removeItem('ns_logged_in');
                    localStorage.removeItem('ns_user_email');
                    const authLayout = document.getElementById('auth-layout');
                    if (authLayout) authLayout.style.display = 'flex';
                }
            } catch (err) {
                console.error("Session check error:", err.message);
                localStorage.clear();
                const authLayout = document.getElementById('auth-layout');
                if (authLayout) authLayout.style.display = 'flex';
            }
        },
        toggleView(view) {
            const loginView = document.getElementById('login-view');
            const signupView = document.getElementById('signup-view');
            if (loginView) loginView.style.display = view === 'login' ? 'block' : 'none';
            if (signupView) signupView.style.display = view === 'signup' ? 'block' : 'none';
        },
        async login(e) {
            if (e && e.preventDefault) e.preventDefault();
            
            const emailInput = document.getElementById('login-email');
            const pwdInput = document.getElementById('login-pwd');
            
            if (!emailInput || !pwdInput) {
                alert("Elemen form login tidak ditemukan di DOM!");
                return;
            }

            const email = emailInput.value.trim();
            const password = pwdInput.value;
            
            if (!email || !password) {
                alert("Email dan password wajib diisi!");
                return;
            }

            const btn = e && e.target ? e.target.querySelector('button[type="submit"]') : null;
            if (btn) App.UI.showLoadingBtn(btn);
            
            try {
                const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
                if (error) throw error;
                
                localStorage.setItem('ns_logged_in', 'true');
                localStorage.setItem('ns_user_email', data.user.email);
                
                App.UI.syncGlobalAvatarAndName();
                this.showApp();
                App.Router.init();
                App.Toast.show("Selamat datang kembali!", "success");
            } catch (error) {
                console.error("Login error:", error.message);
                alert("Gagal Masuk!\nAlasan: " + error.message);
                App.Toast.show(error.message, "danger");
            }
        },
        async signup(e) {
            if (e && e.preventDefault) e.preventDefault();
            
            const emailInput = document.getElementById('signup-email');
            const pwdInput = document.getElementById('signup-pwd');
            
            if (!emailInput || !pwdInput) return;

            const email = emailInput.value.trim();
            const password = pwdInput.value;
            
            const btn = e && e.target ? e.target.querySelector('button[type="submit"]') : null;
            if (btn) App.UI.showLoadingBtn(btn);
            
            try {
                const { data, error } = await supabaseClient.auth.signUp({ email, password });
                if (error) throw error;
                
                if (data?.user && data.user.identities && data.user.identities.length === 0) {
                    App.Modal.open("Email Sudah Terdaftar", "Email ini sudah terikat dengan akun lain. Silakan langsung masuk.");
                } else {
                    App.Modal.open("Pendaftaran Berhasil", "Akun Anda telah terdaftar. Silakan cek inbox/spam email Anda.");
                }
                this.toggleView('login');
            } catch (error) {
                console.error("Signup error:", error.message);
                alert("Gagal Mendaftar!\nAlasan: " + error.message);
                App.Toast.show(error.message, "danger");
            }
        },
        async logout() {
            try { await supabaseClient.auth.signOut(); } catch(e){}
            localStorage.clear();
            window.location.hash = '';
            window.location.reload();
        },
        showApp() {
            const auth = document.getElementById('auth-layout');
            const app = document.getElementById('app-layout');
            if(auth) auth.style.opacity = '0';
            setTimeout(() => { 
                if(auth) auth.style.display = 'none'; 
                if(app) app.classList.add('active'); 
            }, 400);
        }
    },

    Router: {
        init() {
            window.addEventListener('hashchange', () => this.handleRoute());
            if(!window.location.hash) window.location.hash = '#/feed';
            this.handleRoute();
        },
        navigate(path) {
            App.UI.toggleChatPopup(false); 
            window.location.hash = `#/${path}`;
            App.UI.closeMobileSidebar();
        },
        handleRoute() {
            const hash = window.location.hash.replace('#/', '') || 'feed';
            const viewport = document.getElementById('app-viewport');
            
            document.querySelectorAll('.menu-item, .bn-item').forEach(el => {
                if(el.getAttribute('data-route') === hash) el.classList.add('active');
                else el.classList.remove('active');
            });

            if(App.Views[hash]) {
                viewport.innerHTML = `<div class="view-container">${App.Views[hash]()}</div>`;
                if(App.ViewControllers[hash]) App.ViewControllers[hash]();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                viewport.innerHTML = `<div class="glass-card"><h2>404 Not Found</h2></div>`;
            }
        }
    },

    Navigation: {
        menuConfig: [
            { id: 'feed', label: 'News Feed', icon: 'home', mobile: true, isChatTrigger: false },
            { id: 'explore', label: 'Cari Teman', icon: 'person_search', mobile: true, isChatTrigger: false },
            { id: 'chat_trigger', label: 'Pesan', icon: 'chat', mobile: true, isChatTrigger: true }, 
            { id: 'groups', label: 'Komunitas', icon: 'groups', mobile: true, isChatTrigger: false },
            { id: 'settings', label: 'Pengaturan', icon: 'settings', mobile: false, isChatTrigger: false }
        ],
        render() {
            const side = document.getElementById('sidebar-menu-list');
            const bottom = document.getElementById('bottom-nav-list');
            let sideHTML = '', bottomHTML = '';

            this.menuConfig.forEach(m => {
                if(m.isChatTrigger) {
                    sideHTML += `<li class="menu-item-wrapper"><a class="menu-item ripple-btn" onclick="App.UI.toggleChatPopup(true)"><span class="material-symbols-outlined">${m.icon}</span><span class="menu-text">${m.label}</span></a><div class="num-counter-badge" id="main-sidebar-chat-counter" style="display:none;">0</div></li>`;
                    if(m.mobile) bottomHTML += `<div class="bn-item-wrapper"><a class="bn-item ripple-btn" onclick="App.UI.toggleChatPopup(true)"><span class="material-symbols-outlined">${m.icon}</span><span style="font-size: 0.7rem;">${m.label}</span></a><div class="bn-counter-badge" id="mobile-bn-chat-counter" style="display:none;">0</div></div>`;
                } else {
                    sideHTML += `<li><a class="menu-item ripple-btn" data-route="${m.id}" onclick="App.Router.navigate('${m.id}')"><span class="material-symbols-outlined">${m.icon}</span><span class="menu-text">${m.label}</span></a></li>`;
                    if(m.mobile) bottomHTML += `<a class="bn-item ripple-btn" data-route="${m.id}" onclick="App.Router.navigate('${m.id}')"><span class="material-symbols-outlined">${m.icon}</span><span style="font-size: 0.7rem;">${m.label}</span></a>`;
                }
            });
            sideHTML += `<li style="margin-top: auto;"><a class="menu-item ripple-btn" style="color: var(--danger);" onclick="App.Auth.logout()"><span class="material-symbols-outlined">logout</span><span class="menu-text">Keluar</span></a></li>`;
            side.innerHTML = sideHTML; bottom.innerHTML = bottomHTML;
        }
    },

    Views: {
        feed() {
            const currentAvatar = App.ProfileState.getCurrentAvatar();
            return `
                <div class="minimal-composer-bar" onclick="App.Features.openComposerModalPopupForm()">
                    <img src="${currentAvatar}" class="user-avatar user-avatar-reactive" style="width:40px; height:40px;" alt="Me">
                    <div class="minimal-composer-input-mock">Apa yang Anda pikirkan?</div>
                    <span class="material-symbols-outlined minimal-composer-gallery-icon">image</span>
                </div>
                <div id="feed-stream"></div>
            `;
        },
        explore() {
            return `
                <div class="glass-card">
                    <h2>Cari Koneksi & Teman</h2>
                    <p style="color: var(--text-muted); font-size:0.85rem; margin-bottom: 24px;">Temukan pengguna Workspace lain dalam kluster cloud Anda.</p>
                    <div id="explore-users-stream" class="user-grid"></div>
                </div>
            `;
        },
        groups() {
            return `
                <div class="glass-card">
                    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:24px; flex-wrap:wrap; gap:12px;">
                        <div>
                            <h2>Komunitas Premium</h2>
                            <p style="color:var(--text-muted); font-size:0.85rem;">Maksimal membuat 1 komunitas berbayar per akun.</p>
                        </div>
                        <button class="btn btn-primary" onclick="App.Features.triggerCreateCommunityPremiumModal()"><span class="material-symbols-outlined">add_circle</span> Buat Komunitas (Rp 50.000)</button>
                    </div>
                    <div class="community-list-container" id="community-hub-list-viewport"></div>
                </div>
            `;
        },
        profil() {
            const currentName = App.ProfileState.getCurrentName();
            const currentAvatar = App.ProfileState.getCurrentAvatar();
            const currentBioRole = App.ProfileState.getCurrentRoleBioStatus();
            
            const myEmail = (localStorage.getItem('ns_user_email') || '').toLowerCase();
            const isSuperAdmin = (myEmail === 'mastrisnocom@gmail.com');
            
            let adFormHTML = '';
            if (isSuperAdmin) {
                adFormHTML = `
                    <div class="glass-card" style="margin-top: 24px; text-align: left; border: 1px solid var(--primary);">
                        <h3 style="margin-bottom: 8px; color: var(--primary); display: flex; align-items: center; gap: 8px;">
                            <span class="material-symbols-outlined">ads_click</span> Panel Pasang Iklan Super Admin
                        </h3>
                        <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 16px;">Teks iklan ini akan dipasang secara global tepat di bawah header aplikasi.</p>
                        
                        <form id="global-admin-ad-form" onsubmit="App.Features.saveAdminGlobalAdBannerAction(event)">
                            <div class="form-group" style="margin-bottom: 14px;">
                                <input type="text" class="form-input" id="admin-ad-text-input" placeholder=" " value="${localStorage.getItem('ns_ad_text_global') || ''}" required>
                                <label class="form-label">Teks Pengumuman / Iklan Berjalan</label>
                            </div>
                            <button type="submit" class="btn btn-primary btn-full">Pasang & Publikasikan Iklan</button>
                        </form>
                    </div>
                `;
            }

            return `
                <div class="glass-card profile-info-card" style="padding:0; overflow:hidden;">
                    <div class="profile-cover"></div>
                    <img src="${currentAvatar}" class="profile-avatar-large user-avatar-reactive" alt="Profile">
                    <h2>${currentName} ${isSuperAdmin ? '<span style="font-size:0.75rem; background:var(--primary); color:white; padding:2px 8px; border-radius:10px; margin-left:6px; vertical-align:middle;">SUPER ADMIN</span>' : ''}</h2>
                    <p style="color: var(--primary); font-weight: 600; margin-bottom: 12px;">${currentBioRole}</p>
                    <div class="profile-stats">
                        <div class="stat-item"><span class="stat-val" id="profile-friends-count">0</span><span class="stat-lbl">Teman</span></div>
                        <div class="stat-item"><span class="stat-val">2.5K</span><span class="stat-lbl">Pengikut</span></div>
                        <div class="stat-item"><span class="stat-val">84</span><span class="stat-lbl">Postingan</span></div>
                    </div>
                    <div style="padding: 24px; display:flex; flex-direction:column; gap:12px; max-width:320px; margin:0 auto;">
                        <button class="btn btn-primary ripple-btn" onclick="App.Router.navigate('settings')">Edit Profil & Nama</button>
                        <button class="btn btn-secondary ripple-btn" style="color:var(--danger); background:rgba(238,93,80,0.08)" onclick="App.Features.triggerChangePasswordAction()">Ganti Password Akun</button>
                    </div>
                </div>
                ${adFormHTML}
            `;
        },
        settings() {
            const currentName = App.ProfileState.getCurrentName();
            const currentAvatar = App.ProfileState.getCurrentAvatar();
            const currentBioRole = App.ProfileState.getCurrentRoleBioStatus();
            const limitConfig = App.ProfileState.getLimitConfig();
            const remainingEdit = 3 - limitConfig.count;
            return `
                <div class="glass-card" style="max-width: 600px;">
                    <h2>Pengaturan Akun</h2>
                    <div class="avatar-edit-container">
                        <div class="avatar-preview-wrapper">
                            <img src="${currentAvatar}" id="settings-avatar-preview" class="avatar-preview-circle user-avatar-reactive" alt="Preview">
                            <label for="avatar-file-input" class="avatar-upload-label"><span class="material-symbols-outlined" style="font-size:18px;">photo_camera</span></label>
                            <input type="file" id="avatar-file-input" style="display:none;" accept="image/*" onchange="App.Features.handleAvatarSelection(event)">
                        </div>
                    </div>
                    <div class="form-group">
                        <input type="text" class="form-input" id="settings-display-name" placeholder=" " value="${currentName}">
                        <label class="form-label">Nama Tampilan</label>
                    </div>
                    <div class="form-group">
                        <input type="text" class="form-input" id="settings-bio-status" placeholder=" " value="${currentBioRole}">
                        <label class="form-label">Status Peran / Bio Profil</label>
                    </div>
                    <div style="margin-bottom: 24px; padding: 14px; border-radius: var(--radius-md); background: var(--primary-state); display: flex; align-items: center; justify-content: space-between;">
                        <span>Sisa Kuota Perubahan Data:</span>
                        <span class="badge" style="display:inline-block; position:relative; padding: 6px 12px; font-weight: 800; border-radius: 8px; background: ${remainingEdit > 0 ? 'var(--primary)' : 'var(--danger)'}; color: white; border:none;">${remainingEdit} Kali</span>
                    </div>
                    <button class="btn btn-primary ripple-btn" onclick="App.Features.saveNameSettings()">Simpan Perubahan Profil</button>
                </div>
            `;
        }
    },

    ViewControllers: {
        feed() { App.Features.renderPosts(); },
        explore() { App.Features.renderExploreUsers(); },
        groups() { App.Features.renderCommunityHubViewportList(); },
        profil() { App.Features.loadFriendsCount(); }
    },

    Features: {
        saveAdminGlobalAdBannerAction(event) {
            if(event) event.preventDefault(); 
            const txtNode = document.getElementById('admin-ad-text-input');
            if(!txtNode) return;
            
            localStorage.setItem('ns_ad_text_global', txtNode.value.trim());
            App.Toast.show("Iklan global berhasil diperbarui oleh Super Admin!", "success");
            App.UI.renderGlobalBannerAdIfExists();
        },

        openComposerModalPopupForm() {
            const currentName = App.ProfileState.getCurrentName();
            
            composerAttachedImageFile = null;
            composerAttachedCustomFile = null;

            const popupFormHTML = `
                <div style="text-align:left;">
                    <textarea class="form-input" id="composer-text" placeholder="Apa yang sedang Anda pikirkan, ${currentName}?" style="min-height:120px; padding-top:16px; resize:none; margin-bottom:14px; color:var(--text-main);"></textarea>
                    <div id="composer-upload-preview-area" style="margin-bottom:12px;"></div>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div style="display:flex; gap:12px;">
                            <button type="button" class="icon-btn" style="color:var(--primary)" onclick="document.getElementById('composer-img-input').click()"><span class="material-symbols-outlined">image</span></button>
                            <button type="button" class="icon-btn" style="color:var(--warning)" onclick="document.getElementById('composer-file-input').click()"><span class="material-symbols-outlined">attachment</span></button>
                            <input type="file" id="composer-img-input" accept="image/*" style="display:none;" onchange="App.Features.handleComposerImageSelection(event)">
                            <input type="file" id="composer-file-input" style="display:none;" onchange="App.Features.handleComposerFileSelection(event)">
                        </div>
                        <button type="button" class="btn btn-primary" onclick="App.Features.createPost()">Terbitkan Postingan</button>
                    </div>
                </div>
            `;
            
            App.Modal.open("Buat Postingan Baru", popupFormHTML);
            
            const okBtn = document.getElementById('modal-ok-btn');
            if (okBtn) okBtn.style.display = 'none'; 
        },

        handleHeaderLiveSearchInput(event) {
            headerSearchFilterQueryString = event.target.value.trim().toLowerCase();
            if(window.location.hash === '#/feed') this.renderPosts();
        },

        toggleEmojiPanelDOM(panelId) {
            const el = document.getElementById(panelId);
            if(el) el.style.display = el.style.display === 'none' ? 'grid' : 'none';
        },
        appendEmojiToInputField(inputId, panelId, emojiChar) {
            const field = document.getElementById(inputId);
            if(field) { field.value += emojiChar; field.focus(); }
            this.toggleEmojiPanelDOM(panelId);
        },

        handleComposerImageSelection(event) {
            const file = event.target.files[0]; if (!file) return;
            const reader = new FileReader(); reader.readAsDataURL(file);
            reader.onload = function (e) {
                const img = new Image(); img.src = e.target.result;
                img.onload = function () {
                    const canvas = document.createElement('canvas');
                    let width = img.width; let height = img.height;
                    if (width > 1000) { height *= 1000 / width; width = 1000; }
                    canvas.width = width; canvas.height = height;
                    const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, width, height);
                    
                    canvas.toBlob((blob) => {
                        composerAttachedImageFile = new File([blob], file.name, { type: "image/jpeg" });
                        const previewArea = document.getElementById('composer-upload-preview-area');
                        if (previewArea) {
                            const objectUrl = URL.createObjectURL(composerAttachedImageFile);
                            previewArea.innerHTML = `<img src="${objectUrl}" style="max-height:120px; border-radius:8px; display:block; border:2px solid var(--primary);">`;
                            previewArea.querySelector('img').onload = () => URL.revokeObjectURL(objectUrl);
                        }
                    }, 'image/jpeg', 0.65);
                };
            };
        },
        handleComposerFileSelection(event) {
            const file = event.target.files[0]; if (!file) return;
            composerAttachedFileName = file.name;
            composerAttachedCustomFile = file;
            
            const previewArea = document.getElementById('composer-upload-preview-area');
            if (previewArea) {
                previewArea.innerHTML = `<div style="background:var(--primary-state); padding:8px 12px; border-radius:8px; display:inline-flex; align-items:center; gap:8px; font-size:0.85rem; font-weight:700;"><span class="material-symbols-outlined">description</span> ${file.name}</div>`;
            }
        },

        async triggerChangePasswordAction() {
            const currentPwd = prompt("Masukkan password baru Anda:");
            if(!currentPwd || currentPwd.trim().length < 6) return App.Toast.show("Password minimal 6 karakter.", "warning");
            try {
                const { error } = await supabaseClient.auth.updateUser({ password: currentPwd.trim() });
                if(error) throw error;
                App.Toast.show("Password akun diperbarui!", "success");
            } catch(err) { App.Toast.show(err.message, "danger"); }
        },

        openSocialMediaShareSheetModal(postId, textContext) {
            const encodedLink = encodeURIComponent(window.location.origin + window.location.pathname + "?post=" + postId);
            const encodedText = encodeURIComponent(`Lihat postingan menarik ini di Tech Social: "${textContext.substring(0,60)}..." \n\n`);
            const modalHTML = `
                <div style="display:flex; flex-direction:column; gap:12px; padding:12px 0;">
                    <a href="https://api.whatsapp.com/send?text=${encodedText}${encodedLink}" target="_blank" class="btn btn-full" style="background:#25D366; color:white; border-radius:12px;">Bagikan ke WhatsApp</a>
                    <a href="https://t.telegram.org/share/url?url=${encodedLink}&text=${encodedText}" target="_blank" class="btn btn-full" style="background:#0088cc; color:white; border-radius:12px;">Bagikan ke Telegram</a>
                </div>
            `;
            App.Modal.open("Bagikan Postingan", modalHTML);
        },

        triggerCreateCommunityPremiumModal() {
            if (localStorage.getItem('ns_has_created_community') === 'true') {
                return App.Modal.open("Batas Akses", "Setiap akun hanya diperbolehkan mendaftarkan maksimal 1 Komunitas Premium.");
            }
            const invoiceHTML = `
                <div style="text-align:left;">
                    <div class="form-group"><input type="text" class="form-input" id="new-comm-title" placeholder=" " required><label class="form-label">Nama Komunitas</label></div>
                    <div style="background:var(--primary-state); padding:16px; border-radius:12px; margin-bottom:20px; border:1px solid var(--primary);"><strong>INVOICE BILLING MOCKUP:</strong><span style="font-weight:800; font-size:1.2rem; color:var(--primary); display:block;">Rp 50.000</span></div>
                    <button class="btn btn-primary btn-full" onclick="App.Features.processPremiumCommunityPaymentAction()">Bayar Sekarang</button>
                </div>
            `;
            App.Modal.open("Buat Komunitas Premium", invoiceHTML);
            document.getElementById('modal-ok-btn').style.display = 'none';
        },

        processPremiumCommunityPaymentAction() {
            const titleInput = document.getElementById('new-comm-title');
            if(!titleInput || !titleInput.value.trim()) return App.Toast.show("Nama komunitas wajib diisi.", "warning");
            let currentSavedList = JSON.parse(localStorage.getItem('ns_premium_communities_logs') || '[]');
            currentSavedList.push({ id: Date.now(), title: titleInput.value.trim(), creator: App.ProfileState.getCurrentName(), posts: [] });
            localStorage.setItem('ns_premium_communities_logs', JSON.stringify(currentSavedList));
            localStorage.setItem('ns_has_created_community', 'true');
            App.Toast.show("Komunitas premium aktif.", "success");
            App.Modal.close();
            this.renderCommunityHubViewportList();
        },

        triggerEditCommunityAction(commId) {
            let currentSavedList = JSON.parse(localStorage.getItem('ns_premium_communities_logs') || '[]');
            let idx = currentSavedList.findIndex(x => x.id == commId);
            if(idx === -1) return;

            const newName = prompt("Masukkan nama baru untuk komunitas ini:", currentSavedList[idx].title);
            if(!newName || !newName.trim()) return;

            currentSavedList[idx].title = newName.trim();
            localStorage.setItem('ns_premium_communities_logs', JSON.stringify(currentSavedList));
            App.Toast.show("Nama komunitas diperbarui.", "success");
            this.renderCommunityHubViewportList();
        },

        triggerDeleteCommunityAction(commId) {
            if(!confirm("Apakah Anda yakin ingin menghapus komunitas premium ini?")) return;
            let currentSavedList = JSON.parse(localStorage.getItem('ns_premium_communities_logs') || '[]');
            let filteredList = currentSavedList.filter(x => x.id != commId);
            
            localStorage.setItem('ns_premium_communities_logs', JSON.stringify(filteredList));
            localStorage.removeItem('ns_has_created_community');
            App.Toast.show("Komunitas premium berhasil dihapus.", "warning");
            this.renderCommunityHubViewportList();
        },

        renderCommunityHubViewportList() {
            const container = document.getElementById('community-hub-list-viewport'); if(!container) return;
            let currentSavedList = JSON.parse(localStorage.getItem('ns_premium_communities_logs') || '[]');
            const myCurrentName = App.ProfileState.getCurrentName();

            if(currentSavedList.length === 0) {
                container.innerHTML = `<p style="color:var(--text-muted); padding:20px 0;">Belum ada komunitas premium yang dibuat.</p>`;
                return;
            }

            container.innerHTML = currentSavedList.map(c => {
                let configButtonsHTML = '';
                if(c.creator === myCurrentName) {
                    configButtonsHTML = `
                        <div style="display:flex; gap:8px; margin-top:8px;">
                            <button class="btn btn-secondary" style="padding:4px 10px; font-size:0.75rem; border-radius:6px;" onclick="event.stopPropagation(); App.Features.triggerEditCommunityAction(${c.id})">Edit</button>
                            <button class="btn btn-secondary" style="padding:4px 10px; font-size:0.75rem; border-radius:6px; color:var(--danger);" onclick="event.stopPropagation(); App.Features.triggerDeleteCommunityAction(${c.id})">Hapus</button>
                        </div>`;
                }
                return `
                    <div class="community-card-item" onclick="App.Features.openSpecificCommunityTimelineStreamArea(${c.id}, '${c.title.replace(/'/g, "\\'")}')">
                        <div class="community-avatar-box">${c.title.charAt(0).toUpperCase()}</div>
                        <div style="text-align:left;">
                            <h3 style="font-size:1.05rem; font-weight:800; color:var(--text-main);">${c.title}</h3>
                            <p style="font-size:0.8rem; color:var(--text-muted)">Pemilik: ${c.creator}</p>
                            ${configButtonsHTML}
                        </div>
                        <span class="material-symbols-outlined" style="margin-left:auto; color:var(--text-muted)">chevron_right</span>
                    </div>
                `;
            }).join('');
        },

        openSpecificCommunityTimelineStreamArea(commId, commTitle) {
            let currentSavedList = JSON.parse(localStorage.getItem('ns_premium_communities_logs') || '[]');
            let commObj = currentSavedList.find(x => x.id == commId);
            if(!commObj) return;

            let communityFeedPostsHTML = '<p style="color:var(--text-muted); font-size:0.9rem; padding:12px 0;">Belum ada diskusi.</p>';
            if(commObj.posts && commObj.posts.length > 0) {
                communityFeedPostsHTML = commObj.posts.map(p => `<div class="glass-card" style="margin-bottom:14px; padding:16px;"><strong style="color:var(--primary); display:block; margin-bottom:4px; font-size:0.9rem;">${p.author}</strong><p style="font-size:0.95rem;">${p.text}</p></div>`).join('');
            }

            const subTimelineHTML = `
                <div style="text-align:left;">
                    <div style="display:flex; gap:10px; margin-bottom:20px;">
                        <input type="text" class="form-input" id="comm-sub-input-msg" placeholder="Tulis ide forum..." style="margin-bottom:0;">
                        <button class="btn btn-primary" onclick="App.Features.submitNewPostToCommunityTimeline(${commId})"><span class="material-symbols-outlined">send</span></button>
                    </div>
                    <div id="comm-posts-stream-box-node" style="max-height:300px; overflow-y:auto;">${communityFeedPostsHTML}</div>
                </div>
            `;
            App.Modal.open(`Forum: ${commTitle}`, subTimelineHTML);
            document.getElementById('modal-ok-btn').style.display = 'inline-flex';
        },

        submitNewPostToCommunityTimeline(commId) {
            const input = document.getElementById('comm-sub-input-msg'); if(!input || !input.value.trim()) return;
            let currentSavedList = JSON.parse(localStorage.getItem('ns_premium_communities_logs') || '[]');
            let idx = currentSavedList.findIndex(x => x.id == commId); if(idx === -1) return;

            if(!currentSavedList[idx].posts) currentSavedList[idx].posts = [];
            currentSavedList[idx].posts.unshift({ author: App.ProfileState.getCurrentName(), text: input.value.trim() });
            localStorage.setItem('ns_premium_communities_logs', JSON.stringify(currentSavedList));
            input.value = '';
            this.openSpecificCommunityTimelineStreamArea(commId, currentSavedList[idx].title);
        },

        async loadPopupFriendsListSidebar() {
            const listContainer = document.getElementById('popup-friends-sidebar-items'); if(!listContainer) return;
            const myEmail = localStorage.getItem('ns_user_email') || '';
            try {
                const { data: friends, error } = await supabaseClient.from('friends').select('friend_email').eq('user_email', myEmail);
                if(error) throw error;
                listContainer.innerHTML = friends.map(f => {
                    const displayName = f.friend_email.split('@')[0];
                    const isActive = activeChatFriendEmail === f.friend_email ? 'active' : '';
                    const normalizedKey = displayName.toLowerCase() + "@nexsocial.id";
                    const unreadCount = unreadMessageCounters[normalizedKey] || 0;
                    const counterBadgeHTML = unreadCount > 0 ? `<div class="popup-item-counter-dot">${unreadCount}</div>` : '';
                    return `<div class="popup-friend-item ${isActive}" onclick="App.Features.openSpecificFriendPopupObrolan('${f.friend_email}', '${displayName}')"><span class="friend-online-dot"></span><span style="flex:1; text-align:left; overflow:hidden; text-overflow:ellipsis;">${displayName}</span>${counterBadgeHTML}</div>`;
                }).join('');
            } catch(err) { console.error(err); }
        },

        async openSpecificFriendPopupObrolan(friendEmail, friendName) {
            activeChatFriendEmail = friendEmail; activeChatFriendName = friendName;
            const headerTitle = document.getElementById('popup-chat-header-title');
            if (headerTitle) headerTitle.innerHTML = `Obrolan: <span style="text-decoration:underline;">${friendName}</span>`;

            const normalizedKey = friendName.toLowerCase() + "@nexsocial.id";
            unreadMessageCounters[normalizedKey] = 0;
            App.UI.updateGlobalMessageNotificationBadgeCount();
            this.loadPopupFriendsListSidebar();

            const mainArea = document.getElementById('popup-chat-main-area-pane'); if(!mainArea) return;
            let chatEmojiHTML = EMOJI_LIST.map(em => `<button class="emoji-item-btn" onclick="App.Features.appendEmojiToInputField('popup-chat-input-field','chat-emoji-panel','${em}')">${em}</button>`).join('');

            mainArea.innerHTML = `
                <div class="popup-msg-stream" id="popup-msg-stream-viewport"></div>
                <div class="popup-chat-input-row">
                    <div class="emoji-panel-trigger" onclick="App.Features.toggleEmojiPanelDOM('chat-emoji-panel')"><span class="material-symbols-outlined">mood</span></div>
                    <div class="emoji-popup-box" id="chat-emoji-panel" style="display:none;">${chatEmojiHTML}</div>
                    <input type="text" class="form-input" placeholder="Tulis pesan..." id="popup-chat-input-field" onkeypress="if(event.key==='Enter') App.Features.sendPopupChatCloudAction()">
                    <button class="icon-btn" style="background:var(--primary); color:white; width:34px; height:34px;" onclick="App.Features.sendPopupChatCloudAction()"><span class="material-symbols-outlined" style="font-size:16px;">send</span></button>
                </div>
            `;

            try {
                const myCurrentName = App.ProfileState.getCurrentName();
                const { data: messages, error } = await supabaseClient
                    .from('posts')
                    .select('*')
                    .eq('image', 'private_chat_type')
                    .or(`and(author.eq.${myCurrentName},role.eq.${friendName}),and(author.eq.${friendName},role.eq.${myCurrentName})`)
                    .order('created_at', { ascending: true });

                if (error) throw error;
                const streamViewport = document.getElementById('popup-msg-stream-viewport');
                if(streamViewport && messages) {
                    streamViewport.innerHTML = messages.map(msg => {
                        const bubbleStyle = msg.author === myCurrentName ? 'out' : 'in';
                        return `<div class="bubble ${bubbleStyle}"><span class="bubble-sender-name" onclick="App.Features.redirectToTargetFriendProfile('${msg.author}')">${msg.author}</span><span>${msg.content}</span></div>`;
                    }).join('');
                    streamViewport.scrollTop = streamViewport.scrollHeight;
                }
            } catch(err) { console.error(err); }
        },

        redirectToTargetFriendProfile(targetName) {
            App.UI.toggleChatPopup(false); App.Router.navigate('explore');
            setTimeout(() => {
                const globalSearchInput = document.getElementById('header-global-search');
                if (globalSearchInput) { globalSearchInput.value = targetName; App.Features.handleHeaderLiveSearchInput({ target: globalSearchInput }); }
            }, 400);
        },

        viewFriendProfileFromChat() { if (activeChatFriendName) this.redirectToTargetFriendProfile(activeChatFriendName); },

        async sendPopupChatCloudAction() {
            const input = document.getElementById('popup-chat-input-field');
            if(!input || !input.value.trim() || !activeChatFriendEmail) return;
            const textVal = input.value.trim(); const myCurrentName = App.ProfileState.getCurrentName(); const myAvatar = App.ProfileState.getCurrentAvatar();

            try {
                const { error } = await supabaseClient.from('posts').insert([{ author: myCurrentName, role: activeChatFriendName, avatar: myAvatar, content: textVal, image: 'private_chat_type', likes: 0 }]);
                if (error) throw error;
                const streamViewport = document.getElementById('popup-msg-stream-viewport');
                if(streamViewport) {
                    const b = document.createElement('div'); b.className = 'toast bubble out';
                    b.innerHTML = `<span class="bubble-sender-name" onclick="App.Features.redirectToTargetFriendProfile('${myCurrentName}')">${myCurrentName}</span><span>${textVal}</span>`;
                    streamViewport.appendChild(b); streamViewport.scrollTop = streamViewport.scrollHeight;
                }
                input.value = '';
            } catch(err) { console.error(err); }
        },

        appendIncomingBubbleDOM(senderName, messageText) {
            const streamViewport = document.getElementById('popup-msg-stream-viewport');
            if(streamViewport) {
                const bIn = document.createElement('div'); bIn.className = 'bubble in'; 
                bIn.innerHTML = `<span class="bubble-sender-name" onclick="App.Features.redirectToTargetFriendProfile('${senderName}')">${senderName}</span><span>${messageText}</span>`;
                streamViewport.appendChild(bIn); streamViewport.scrollTop = streamViewport.scrollHeight;
            }
        },

        openPostActionMenuDOM(postId, hasImage) {
            let menuBodyHTML = `<button class="btn btn-secondary btn-full" style="margin-bottom:8px; border-radius:10px;" onclick="App.Features.triggerPostTextEditAction(${postId})">Edit Teks</button>`;
            if(hasImage) menuBodyHTML += `<button class="btn btn-secondary btn-full" style="color:var(--danger); background:rgba(238,93,80,0.08); border-radius:10px;" onclick="App.Features.triggerPostImageDeleteAction(${postId})">Hapus Gambar</button>`;
            App.Modal.open("Manajemen Postingan", menuBodyHTML);
        },

        async triggerPostTextEditAction(postId) {
            App.Modal.close();
            try {
                const { data: currentPost } = await supabaseClient.from('posts').select('content').eq('id', postId).single();
                const newTxt = prompt("Edit konten teks postingan:", currentPost.content);
                if(!newTxt || !newTxt.trim()) return;
                await supabaseClient.from('posts').update({ content: newTxt.trim() }).eq('id', postId);
                this.renderPosts();
            } catch(e) { console.error(e); }
        },

        async triggerPostImageDeleteAction(postId) {
            App.Modal.close(); if(!confirm("Hapus gambar dari postingan?")) return;
            try {
                await supabaseClient.from('posts').update({ image: null }).eq('id', postId);
                this.renderPosts();
            } catch(e) { console.error(e); }
        },

        async renderExploreUsers() {
            const container = document.getElementById('explore-users-stream'); if(!container) return;
            const myEmail = localStorage.getItem('ns_user_email') || '';
            try {
                const { data: myFriends } = await supabaseClient.from('friends').select('friend_email').eq('user_email', myEmail);
                const friendList = myFriends ? myFriends.map(f => f.friend_email) : [];
                const { data: posts } = await supabaseClient.from('posts').select('author, avatar').not('author', 'is', null);
                const uniqueUsers = []; const map = new Map(); const myCurrentName = App.ProfileState.getCurrentName();
                if(posts) {
                    for (const item of posts) {
                        if(item.author !== myCurrentName && !map.has(item.author) && item.image !== 'private_chat_type') {
                            map.set(item.author, true); uniqueUsers.push({ name: item.author, avatar: item.avatar || 'https://i.pravatar.cc/150?img=11', email: item.author.toLowerCase() + "@nexsocial.id" });
                        }
                    }
                }
                container.innerHTML = uniqueUsers.map(u => {
                    const isFriend = friendList.includes(u.email);
                    return `<div class="user-follow-card"><img src="${u.avatar}" class="user-avatar" style="width:44px; height:44px; border:none;"><div class="user-follow-info"><h4 onclick="App.Features.redirectToTargetFriendProfile('${u.name}')">${u.name}</h4><p>${u.email}</p></div><button class="btn ${isFriend ? 'btn-secondary' : 'btn-primary'}" style="padding:6px 14px; font-size:0.8rem;" onclick="App.Features.toggleFriendAction('${u.email}', ${isFriend})">${isFriend ? 'Teman' : 'Tambah'}</button></div>`;
                }).join('');
            } catch(err) { console.error(err); }
        },

        async toggleFriendAction(friendEmail, isFriend) {
            const myEmail = localStorage.getItem('ns_user_email') || ''; if(!myEmail) return;
            try {
                if (isFriend) {
                    await supabaseClient.from('friends').delete().eq('user_email', myEmail).eq('friend_email', friendEmail);
                } else {
                    await supabaseClient.from('friends').insert([{ user_email: myEmail, friend_email: friendEmail }]);
                }
                this.renderExploreUsers(); this.loadPopupFriendsListSidebar();
            } catch(err) { console.error(err); }
        },

        async loadFriendsCount() {
            const countEl = document.getElementById('profile-friends-count'); if(!countEl) return;
            const myEmail = localStorage.getItem('ns_user_email') || '';
            const { count } = await supabaseClient.from('friends').select('*', { count: 'exact', head: true }).eq('user_email', myEmail);
            if(count !== null) countEl.innerText = count;
        },

        async renderPosts() {
            const stream = document.getElementById('feed-stream'); if(!stream) return;
            const myEmail = localStorage.getItem('ns_user_email') || ''; const myCurrentName = App.ProfileState.getCurrentName();

            try {
                const { data: myFriends } = await supabaseClient.from('friends').select('friend_email').eq('user_email', myEmail);
                const allowedNames = myFriends ? myFriends.map(f => f.friend_email.split('@')[0]) : [];
                allowedNames.push(myCurrentName); 

                const { data: posts, error } = await supabaseClient
                    .from('posts')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (error) throw error;
                
                let filteredPosts = posts ? posts.filter(p => p.image !== 'private_chat_type' && allowedNames.includes(p.author)) : [];

                if(headerSearchFilterQueryString !== "") {
                    filteredPosts = filteredPosts.filter(p => p.author.toLowerCase().includes(headerSearchFilterQueryString));
                }

                if (filteredPosts.length === 0) {
                    stream.innerHTML = `<div class="glass-card" style="text-align:center; color:var(--text-muted); padding:32px 16px;">Tidak ada postingan di linimasa.</div>`;
                    return;
                }

                const likedLogs = JSON.parse(localStorage.getItem('ns_liked_posts_ids') || '[]');
                const dislikedLogs = JSON.parse(localStorage.getItem('ns_disliked_posts_ids') || '[]');

                stream.innerHTML = filteredPosts.map(p => {
                    const pId = p.id; 
                    const isLikedActive = likedLogs.includes(pId) ? 'liked' : '';
                    const isDislikedActive = dislikedLogs.includes(pId) ? 'disliked' : '';
                    
                    let attachedMediaHTML = ''; let hasImage = false;
                    // Membaca attachment berdasarkan URL Supabase Storage
                    if (p.image) {
                        const isImageFile = p.image.match(/\.(jpeg|jpg|gif|png|webp)/i) || p.image.includes('posts/images');
                        if (isImageFile) {
                            attachedMediaHTML = `<img src="${p.image}" class="post-attached-image" alt="Media">`;
                            hasImage = true;
                        } else {
                            attachedMediaHTML = `<div class="post-attached-file-box"><span class="material-symbols-outlined" style="color:var(--primary)">download_for_offline</span><a href="${p.image}" target="_blank" download style="color:var(--primary); text-decoration:underline;">Unduh Lampiran Berkas</a></div>`;
                        }
                    }

                    let postMenuConfigHTML = '';
                    if(p.author === myCurrentName) {
                        postMenuConfigHTML = `<span class="material-symbols-outlined post-menu-trigger" onclick="App.Features.openPostActionMenuDOM(${pId}, ${hasImage})">more_vert</span>`;
                    }

                    let parsedComments = [];
                    try { if(p.role && p.role.startsWith('[')) parsedComments = JSON.parse(p.role); } catch(e) { parsedComments = []; }
                    const commentCountValue = parsedComments.length;

                    let commentsListHTML = parsedComments.map(c => {
                        const alignmentClass = c.user === myCurrentName ? 'my-comment' : 'other-comment';
                        return `
                            <div class="comment-item-wrapper ${alignmentClass}">
                                <div class="comment-bubble">
                                    <strong onclick="App.Features.redirectToTargetFriendProfile('${c.user}')">${c.user}</strong>
                                    <span>${c.text}</span>
                                </div>
                            </div>
                        `;
                    }).join('');

                    let commentEmojiHTML = EMOJI_LIST.map(em => `<button class="emoji-item-btn" onclick="App.Features.appendEmojiToInputField('comment-input-field-${pId}','comment-panel-${pId}','${em}')">${em}</button>`).join('');

                    const postDateObj = p.created_at ? new Date(p.created_at) : new Date();
                    const formattedFullTimestamp = postDateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) + ' - ' + postDateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WIB';

                    return `
                        <div class="glass-card post-card" id="post-card-container-${pId}">
                            <div class="post-header">
                                <div class="post-author">
                                    <img src="${p.avatar || 'https://i.pravatar.cc/150?img=12'}" class="post-avatar">
                                    <div class="post-meta">
                                        <h4 onclick="App.Features.redirectToTargetFriendProfile('${p.author}')">${p.author}</h4>
                                        <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 500;">${formattedFullTimestamp}</span>
                                    </div>
                                </div>
                                ${postMenuConfigHTML}
                            </div>
                            <div class="post-content">${p.content || ''}</div>
                            ${attachedMediaHTML}
                            
                            <div class="post-actions-bar">
                                <div class="post-action-item ${isLikedActive}" onclick="App.Features.toggleLike(${pId}, ${p.likes || 0}, ${p.dislikes || 0})">
                                    <span class="material-symbols-outlined">thumb_up</span>
                                    <span>${p.likes || 0}</span>
                                </div>
                                
                                <div class="post-action-item ${isDislikedActive}" onclick="App.Features.toggleDislike(${pId}, ${p.likes || 0}, ${p.dislikes || 0})">
                                    <span class="material-symbols-outlined">thumb_down</span>
                                    <span>${p.dislikes || 0}</span>
                                </div>

                                <div class="post-action-item" onclick="App.Features.togglePostCommentsVisibility(${pId})">
                                    <span class="material-symbols-outlined">comment</span>
                                    <span>${commentCountValue}</span>
                                </div>
                                
                                <div class="post-action-item" onclick="App.Features.openSocialMediaShareSheetModal(${pId}, '${(p.content || "").replace(/'/g, "\\'")}')">
                                    <span class="material-symbols-outlined">share</span>
                                </div>
                            </div>

                            <div class="comments-section" id="comments-section-container-${pId}">
                                <div class="comments-stream">${commentsListHTML}</div>
                                <div class="comment-row">
                                    <div class="emoji-popup-box" id="comment-panel-${pId}" style="display:none; bottom:45px; left:0;">${commentEmojiHTML}</div>
                                    <div class="emoji-panel-trigger" onclick="App.Features.toggleEmojiPanelDOM('comment-panel-${pId}')"><span class="material-symbols-outlined">mood</span></div>
                                    <input type="text" class="form-input" placeholder="Tulis komentar..." style="padding:10px 14px; border-radius:20px; font-size:0.85rem;" id="comment-input-field-${pId}">
                                    <button class="icon-btn" style="background:var(--primary); color:white; width:34px; height:34px; border-radius:50%; flex-shrink:0;" onclick="App.Features.submitPostCommentAction(${pId})"><span class="material-symbols-outlined" style="font-size:16px;">send</span></button>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');
            } catch (err) { console.error(err); }
        },

        async createPost() {
            const txt = document.getElementById('composer-text'); 
            const textValue = txt ? txt.value.trim() : "";

            if(!textValue && !composerAttachedImageFile && !composerAttachedCustomFile) {
                return App.Toast.show("Konten kiriman Anda masih kosong.", "warning");
            }

            App.Toast.show("Memproses berkas ke cloud storage...", "info");
            let payloadAssetUrl = null;

            try {
                // Proses pengunggahan biner asli ke folder spesifik di posts-bucket
                if (composerAttachedImageFile) {
                    payloadAssetUrl = await uploadFileToSupabaseStorage('posts/images', composerAttachedImageFile);
                } else if (composerAttachedCustomFile) {
                    payloadAssetUrl = await uploadFileToSupabaseStorage('posts/files', composerAttachedCustomFile);
                }

                const myCurrentName = App.ProfileState.getCurrentName();
                const myAvatar = App.ProfileState.getCurrentAvatar();

                let postPayload = {
                    author: myCurrentName, 
                    avatar: myAvatar, 
                    content: textValue, 
                    image: payloadAssetUrl, 
                    likes: 0
                };

                const { error } = await supabaseClient
                    .from('posts')
                    .insert([postPayload]);

                if (error) throw error;
                
                composerAttachedImageFile = null; 
                composerAttachedCustomFile = null;
                
                App.Modal.close();
                const modalOverlay = document.getElementById('global-modal');
                if(modalOverlay) modalOverlay.classList.remove('active');
                
                App.Toast.show("Postingan berhasil diterbitkan ke News Feed!", "success"); 
                this.renderPosts();
            } catch (err) { 
                console.error(err); 
                App.Toast.show("Gagal mengirim data: " + err.message, "danger");
            }
        },

        async toggleLike(id, currentLikes, currentDislikes) {
            let likedLogs = JSON.parse(localStorage.getItem('ns_liked_posts_ids') || '[]');
            let dislikedLogs = JSON.parse(localStorage.getItem('ns_disliked_posts_ids') || '[]');
            const myCurrentName = App.ProfileState.getCurrentName();

            if (likedLogs.includes(id)) {
                likedLogs = likedLogs.filter(x => x !== id);
                await supabaseClient.from('posts').update({ likes: Math.max(0, currentLikes - 1) }).eq('id', id);
            } else {
                likedLogs.push(id);
                let updatePayload = { likes: currentLikes + 1 };
                if (dislikedLogs.includes(id)) {
                    dislikedLogs = dislikedLogs.filter(x => x !== id);
                    try { updatePayload.dislikes = Math.max(0, currentDislikes - 1); } catch(e){}
                }
                await supabaseClient.from('posts').update(updatePayload).eq('id', id);

                liveNotifications.unshift({
                    id: Date.now(),
                    icon: 'thumb_up',
                    user: myCurrentName,
                    type: 'like',
                    desc: `Menyukai postingan ID #${id} Anda di Newsfeed.`,
                    isUnread: true
                });
                liveHeaderNotificationCount++;
                App.UI.refreshHeaderNotificationBadgeDOM();
            }

            localStorage.setItem('ns_liked_posts_ids', JSON.stringify(likedLogs));
            localStorage.setItem('ns_disliked_posts_ids', JSON.stringify(dislikedLogs));
            this.renderPosts();
        },

        async toggleDislike(id, currentLikes, currentDislikes) {
            let likedLogs = JSON.parse(localStorage.getItem('ns_liked_posts_ids') || '[]');
            let dislikedLogs = JSON.parse(localStorage.getItem('ns_disliked_posts_ids') || '[]');
            const myCurrentName = App.ProfileState.getCurrentName();

            if (dislikedLogs.includes(id)) {
                dislikedLogs = dislikedLogs.filter(x => x !== id);
                try { await supabaseClient.from('posts').update({ dislikes: Math.max(0, currentDislikes - 1) }).eq('id', id); } catch(e){}
            } else {
                dislikedLogs.push(id);
                let updatePayload = {};
                try { updatePayload.dislikes = currentDislikes + 1; } catch(e){}
                if (likedLogs.includes(id)) {
                    likedLogs = likedLogs.filter(x => x !== id);
                    updatePayload.likes = Math.max(0, currentLikes - 1);
                }
                await supabaseClient.from('posts').update(updatePayload).eq('id', id);

                liveNotifications.unshift({
                    id: Date.now(),
                    icon: 'thumb_down',
                    user: myCurrentName,
                    type: 'like',
                    desc: `Memberikan dislike pada postingan ID #${id} Anda di Newsfeed.`,
                    isUnread: true
                });
                liveHeaderNotificationCount++;
                App.UI.refreshHeaderNotificationBadgeDOM();
            }

            localStorage.setItem('ns_liked_posts_ids', JSON.stringify(likedLogs));
            localStorage.setItem('ns_disliked_posts_ids', JSON.stringify(dislikedLogs));
            this.renderPosts();
        },

        showNotifications() {
            liveHeaderNotificationCount = 0; 
            App.UI.refreshHeaderNotificationBadgeDOM();

            if (liveNotifications.length === 0) {
                App.Modal.open("Notifikasi Jaringan Teman", `<p style="padding:12px; text-align:center; color:var(--text-muted);">Tidak ada pemberitahuan baru.</p>`);
                return;
            }

            const notiHTML = liveNotifications.map(item => {
                const unreadClass = item.isUnread ? 'unread' : '';
                let tagLabel = 'FEED'; let tagColorClass = 'meta-tag-feed';
                if(item.type === 'chat') { tagLabel = 'PESAN'; tagColorClass = 'meta-tag-chat'; }
                if(item.type === 'admin') { tagLabel = 'SUPER ADMIN'; tagColorClass = 'meta-tag-admin'; }
                if(item.type === 'like') { tagLabel = 'LIKE / DISLIKE'; tagColorClass = 'meta-tag-like'; }
                if(item.type === 'comment') { tagLabel = 'KOMENTAR'; tagColorClass = 'meta-tag-comment'; }

                item.isUnread = false; 

                return `
                    <div class="notification-item-card ${unreadClass}">
                        <div class="notification-icon-wrapper" style="margin-top:2px;">
                            <span class="material-symbols-outlined">${item.icon || 'notifications'}</span>
                        </div>
                        <div style="flex:1;">
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <strong style="color:var(--text-main); font-size:0.95rem; cursor:pointer;" onclick="App.Modal.close(); App.Features.redirectToTargetFriendProfile('${item.user}')">${item.user}</strong>
                            </div>
                            <p style="font-size:0.85rem; color:var(--text-main); margin-top:4px; line-height:1.4;">${item.desc}</p>
                            <span class="notification-meta-tag ${tagColorClass}">${tagLabel}</span>
                        </div>
                    </div>
                `;
            }).join('');

            App.Modal.open("Notifikasi Jaringan Teman", `<div style="padding:4px 0;">${notiHTML}</div>`);
            document.getElementById('modal-ok-btn').style.display = 'inline-flex';
        },

        togglePostCommentsVisibility(postId) {
            const commentSection = document.getElementById(`comments-section-container-${postId}`);
            if (commentSection) {
                const isHidden = window.getComputedStyle(commentSection).display === 'none';
                commentSection.style.display = isHidden ? 'block' : 'none';
            }
        },
        handleAvatarSelection(event) {
            const file = event.target.files[0]; if (!file) return;
            const reader = new FileReader(); reader.readAsDataURL(file);
            reader.onload = function (e) {
                const img = new Image(); img.src = e.target.result;
                img.onload = function () {
                    const canvas = document.createElement('canvas'); canvas.width = 150; canvas.height = 150;
                    const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, 150, 150);
                    
                    canvas.toBlob(async (blob) => {
                        const avatarFile = new File([blob], `avatar-${Date.now()}.jpg`, { type: "image/jpeg" });
                        App.Toast.show("Memperbarui avatar ke server...", "info");
                        
                        try {
                            const avatarPublicUrl = await uploadFileToSupabaseStorage('avatars', avatarFile);
                            if(avatarPublicUrl) {
                                App.ProfileState.saveCompressedAvatar(avatarPublicUrl);
                                const p = document.getElementById('settings-avatar-preview'); 
                                if(p) p.src = avatarPublicUrl;
                                App.Toast.show("Avatar berhasil diperbarui!", "success");
                            }
                        } catch(err) {
                            App.Toast.show("Gagal mengunggah avatar.", "danger");
                        }
                    }, 'image/jpeg', 0.8);
                };
            };
        },
        saveNameSettings() {
            const nameInput = document.getElementById('settings-display-name');
            const bioInput = document.getElementById('settings-bio-status');
            if(!nameInput || !nameInput.value.trim()) return App.Toast.show("Nama wajib diisi.", "warning");
            const res = App.ProfileState.updateProfileDataConfiguration(nameInput.value.trim(), bioInput.value.trim());
            if(res.success) { App.Toast.show("Profil disimpan!", "success"); App.Router.navigate('profil'); }
            else App.Modal.open("Limit Tercapai", res.message);
        },
        async submitPostCommentAction(postId) {
            const input = document.getElementById(`comment-input-field-${postId}`);
            if (!input || !input.value.trim()) return;
            const commentText = input.value.trim(); const currentUserName = App.ProfileState.getCurrentName();

            try {
                const { data: postData } = await supabaseClient.from('posts').select('role').eq('id', postId).single();
                let commentArray = [];
                try { if(postData && postData.role && postData.role.startsWith('[')) commentArray = JSON.parse(postData.role); } catch(ex) { commentArray = []; }
                commentArray.push({ user: currentUserName, text: commentText, date: new Date().getTime() });
                await supabaseClient.from('posts').update({ role: JSON.stringify(commentArray) }).eq('id', postId);
                input.value = ''; this.renderPosts();
            } catch(err) { console.error(err); }
        }
    },

    Theme: {
        init() { document.documentElement.setAttribute('data-theme', localStorage.getItem('ns_theme') || 'light'); },
        toggle() {
            const n = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', n); localStorage.setItem('ns_theme', n);
        }
    },

    Clock: { start() { /* JAM DAN TANGGAL HEADER DIHILANGKAN SESUAI REQUEST */ } },
    Network: { listen() { window.addEventListener('online', ()=>document.getElementById('network-text').innerText='Online'); window.addEventListener('offline', ()=>App.Toast.show("Offline","danger")); } },
    Modal: { open(t, b) { document.getElementById('modal-title').innerText=t; document.getElementById('modal-body').innerHTML=b; document.getElementById('modal-ok-btn').style.display = 'inline-flex'; document.getElementById('global-modal').classList.add('active'); }, close() { document.getElementById('global-modal').classList.remove('active'); } },
    Toast: {
        show(m, t="info") {
            const c = document.getElementById('toast-container'), b = document.createElement('div');
            b.className = 'toast'; b.style.borderLeftColor = t==='success'?'var(--secondary)':t==='danger'?'var(--danger)':'var(--primary)';
            b.innerHTML = `<span>${m}</span>`; c.appendChild(b);
            setTimeout(() => { b.style.opacity='0'; setTimeout(()=>b.remove(), 300); }, 3000);
        }
    },

    UI: {
        renderGlobalBannerAdIfExists() {
            const container = document.getElementById('global-superadmin-ad-slot-container');
            if(!container) return;
            const savedAdText = localStorage.getItem('ns_ad_text_global');
            if(savedAdText && savedAdText.trim() !== "") {
                container.innerHTML = `
                    <div class="global-workspace-ad-banner">
                        <span class="material-symbols-outlined" style="color:var(--primary); animation: pulse 2s infinite;">campaign</span>
                        <div style="font-size:0.85rem; font-weight:600; color:var(--text-main);"><marquee scrollamount="4">${savedAdText}</marquee></div>
                    </div>
                `;
            } else {
                container.innerHTML = '';
            }
        },
        bindGlobalEvents() {
            document.getElementById('btn-toggle-sidebar')?.addEventListener('click', () => {
                const l = document.getElementById('app-layout'), o = document.getElementById('mobile-overlay');
                if(window.innerWidth <= 768) { l.classList.toggle('sidebar-mobile-open'); o.classList.toggle('active'); }
                else l.classList.toggle('sidebar-collapsed');
            });
            document.getElementById('mobile-overlay')?.addEventListener('click', this.closeMobileSidebar);
            document.getElementById('btn-theme')?.addEventListener('click', () => App.Theme.toggle());
            document.getElementById('btn-refresh')?.addEventListener('click', () => { App.Router.handleRoute(); App.Toast.show("Diperbarui","success"); });
            document.getElementById('global-modal').addEventListener('click', (e) => { if(e.target.id==='global-modal') App.Modal.close(); });
        },
        closeMobileSidebar() {
            document.getElementById('app-layout')?.classList.remove('sidebar-mobile-open');
            document.getElementById('mobile-overlay')?.classList.remove('active');
        },
        toggleProfileRouteViewportState() {
            if(window.location.hash === '#/profil') App.Router.navigate('feed');
            else App.Router.navigate('profil');
        },
        toggleChatPopup(shouldOpen) {
            const chatBox = document.getElementById('floating-chat-popup-box'); if(!chatBox) return;
            if(shouldOpen) { chatBox.classList.add('active'); App.Features.loadPopupFriendsListSidebar(); } 
            else { chatBox.classList.remove('active'); activeChatFriendEmail = null; activeChatFriendName = null; }
        },
        refreshHeaderNotificationBadgeDOM() {
            const headerBadge = document.getElementById('noti-badge');
            if (headerBadge) {
                if (liveHeaderNotificationCount > 0) {
                    headerBadge.innerText = liveHeaderNotificationCount;
                    headerBadge.style.display = 'flex';
                } else {
                    headerBadge.style.display = 'none';
                }
            }
        },
        updateGlobalMessageNotificationBadgeCount() {
            let totalUnread = 0; for (const email in unreadMessageCounters) { totalUnread += unreadMessageCounters[email]; }
            const sidebarCounter = document.getElementById('main-sidebar-chat-counter'); const mobileCounter = document.getElementById('mobile-bn-chat-counter');
            if(totalUnread > 0) {
                if(sidebarCounter) { sidebarCounter.innerText = totalUnread; sidebarCounter.style.display = 'flex'; }
                if(mobileCounter) { mobileCounter.innerText = totalUnread; mobileCounter.style.display = 'flex'; }
            } else {
                if(sidebarCounter) sidebarCounter.style.display = 'none'; if(mobileCounter) mobileCounter.style.display = 'none';
            }
        },
        syncGlobalAvatarAndName() {
            const name = App.ProfileState.getCurrentName(); const avatar = App.ProfileState.getCurrentAvatar(); const bio = App.ProfileState.getCurrentRoleBioStatus();
            const sidebarNameEl = document.getElementById('sidebar-user-name'); if (sidebarNameEl) sidebarNameEl.innerText = name;
            const sidebarRoleEl = document.getElementById('sidebar-user-role-label'); if(sidebarRoleEl) sidebarRoleEl.innerText = bio;
            document.querySelectorAll('.id-user-avatar-element, .user-avatar-reactive').forEach(img => { img.src = avatar; });
        },
        showLoadingBtn(b) {
            if (!b) return;
            const ot = b.innerText; b.innerHTML = 'Loading...'; b.style.pointerEvents='none'; b.style.opacity='0.8';
            setTimeout(() => { b.innerHTML = ot; b.style.pointerEvents='auto'; b.style.opacity='1'; }, 1000);
        }
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());
