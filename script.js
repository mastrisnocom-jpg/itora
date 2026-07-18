const SUPABASE_URL = 'https://waaufoxlimqtesmmjhyw.supabase.co';
const SUPABASE_KEY = 'sb_publishable_X6icNByv3YFbekorwJ6kSw_SX0XUFM8';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let liveNotifications = [
    { id: 1, icon: 'shield_person', user: 'Super Admin', type: 'admin', desc: 'Sistem Workspace Tech Social versi 2.4 berhasil diperbarui ke server cloud.', isUnread: true },
    { id: 2, icon: 'handshake', user: 'System', type: 'admin', desc: 'Fitur network teman aktif. Sekarang Anda dapat mencari user lain di halaman Eksplor.', isUnread: false }
];

let activeChatFriendEmail = null;
let activeChatFriendName = null;

let composerAttachedImageBase64 = null;
let unreadMessageCounters = {}; 
let liveHeaderNotificationCount = 1; 
let headerSearchFilterQueryString = ""; 

// State penampung data profile cloud aktif agar tidak bolak-balik fetch data
let cachedUserProfileData = {
    display_name: 'User',
    bio_status: 'Tech Workspace Member',
    avatar_base64: 'https://i.pravatar.cc/150?img=12',
    job: 'Belum diisi',
    address: 'Belum diisi',
    location: 'Tidak diketahui',
    edit_count: 0,
    last_edit_month: new Date().getMonth()
};

const EMOJI_LIST = ['😊', '😂', '🔥', '👍', '🙌', '💯', '❤️', '👏', '🎉', '😮', '😢', '🙏'];

const App = {
    async init() {
        this.Theme.init();
        this.Network.listen();
        this.UI.bindGlobalEvents();
        this.Navigation.render();
        await this.Auth.checkCurrentSession();
        this.Realtime.subscribePosts();
        
        App.UI.refreshHeaderNotificationBadgeDOM();
        await App.UI.renderGlobalBannerAdIfExists();
    },

    ProfileState: {
        async fetchAndSyncProfileFromServer(userId, userEmail) {
            try {
                let { data, error } = await supabaseClient.from('profiles').select('*').eq('id', userId).single();
                
                // Jika data profile di tabel profiles belum ada, buat baris baru secara otomatis (Auto-Registration)
                if (error && error.code === 'PGRST116') {
                    const defaultName = userEmail.split('@')[0];
                    const defaultProfile = {
                        id: userId,
                        display_name: defaultName,
                        bio_status: userEmail.toLowerCase() === 'mastrisnocom@gmail.com' ? 'Super Administrator' : 'Tech Workspace Member',
                        avatar_base64: 'https://i.pravatar.cc/150?img=12',
                        job: '',
                        address: '',
                        location: '',
                        edit_count: 0,
                        last_edit_month: new Date().getMonth()
                    };
                    await supabaseClient.from('profiles').insert([defaultProfile]);
                    cachedUserProfileData = defaultProfile;
                } else if (data) {
                    cachedUserProfileData = data;
                }
                
                App.UI.syncGlobalAvatarAndName();
            } catch (err) {
                console.error("Gagal sinkronisasi profil cloud:", err);
            }
        },
        getCurrentName() { return cachedUserProfileData.display_name || 'User'; },
        getCurrentRoleBioStatus() { return cachedUserProfileData.bio_status || 'Tech Workspace Member'; },
        getCurrentAvatar() { return cachedUserProfileData.avatar_base64 || 'https://i.pravatar.cc/150?img=12'; },
        
        async updateProfileDataConfiguration(newName, newBio, address, job, location) {
            const currentMonth = new Date().getMonth();
            let editCount = cachedUserProfileData.edit_count || 0;
            
            // Reset kuota bulanan jika sudah berganti bulan di cloud
            if (cachedUserProfileData.last_edit_month !== currentMonth) {
                editCount = 0;
            }

            if (editCount >= 3) {
                return { success: false, message: "Kuota modifikasi bulanan (3x) cloud Anda sudah habis." };
            }

            try {
                const { data: sessionData } = await supabaseClient.auth.getSession();
                const userId = sessionData?.session?.user?.id;
                if (!userId) return { success: false, message: "Sesi tidak valid." };

                const updatedFields = {
                    display_name: newName,
                    bio_status: newBio,
                    address: address,
                    job: job,
                    location: location,
                    edit_count: editCount + 1,
                    last_edit_month: currentMonth
                };

                const { error } = await supabaseClient.from('profiles').update(updatedFields).eq('id', userId);
                if (error) throw error;

                // Update cache lokal jika transmisi server berhasil
                cachedUserProfileData = { ...cachedUserProfileData, ...updatedFields };
                App.UI.syncGlobalAvatarAndName();
                return { success: true };
            } catch (err) {
                return { success: false, message: err.message };
            }
        },
        
        async saveCompressedAvatar(base64Image) {
            try {
                const { data: sessionData } = await supabaseClient.auth.getSession();
                const userId = sessionData?.session?.user?.id;
                if (!userId) return;

                await supabaseClient.from('profiles').update({ avatar_base64: base64Image }).eq('id', userId);
                cachedUserProfileData.avatar_base64 = base64Image;
                App.UI.syncGlobalAvatarAndName();
            } catch (err) {
                console.error(err);
            }
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
                        if (window.location.hash === '#/feed') App.Features.renderPosts();
                    }
                })
                .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'posts' }, async (payload) => {
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
                    await App.ProfileState.fetchAndSyncProfileFromServer(data.session.user.id, data.session.user.email);
                    App.Auth.showApp();
                    App.Router.init();
                } else {
                    document.getElementById('auth-layout').style.display = 'flex';
                }
            } catch (err) {
                document.getElementById('auth-layout').style.display = 'flex';
            }
        },
        toggleView(view) {
            document.getElementById('login-view').style.display = view === 'login' ? 'block' : 'none';
            document.getElementById('signup-view').style.display = view === 'signup' ? 'block' : 'none';
        },
        async login(e) {
            if (e && e.preventDefault) e.preventDefault();
            const email = document.getElementById('login-email').value.trim();
            const password = document.getElementById('login-pwd').value;
            const btn = e.target.querySelector('button[type="submit"]');
            App.UI.showLoadingBtn(btn);
            try {
                const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
                if (error) throw error;
                await App.ProfileState.fetchAndSyncProfileFromServer(data.user.id, data.user.email);
                this.showApp();
                App.Router.init();
            } catch (error) {
                alert("Gagal Masuk: " + error.message);
                window.location.reload();
            }
        },
        async signup(e) {
            if (e && e.preventDefault) e.preventDefault();
            const email = document.getElementById('signup-email').value.trim();
            const password = document.getElementById('signup-pwd').value;
            const btn = e.target.querySelector('button[type="submit"]');
            App.UI.showLoadingBtn(btn);
            try {
                const { error } = await supabaseClient.auth.signUp({ email, password });
                if (error) throw error;
                App.Modal.open("Pendaftaran", "Akun berhasil dibuat. Silakan masuk.");
                this.toggleView('login');
            } catch (error) {
                alert(error.message);
            }
        },
        async logout() {
            try { await supabaseClient.auth.signOut(); } catch(e){}
            window.location.hash = '';
            window.location.reload();
        },
        showApp() {
            document.getElementById('auth-layout').style.opacity = '0';
            setTimeout(() => { document.getElementById('auth-layout').style.display = 'none'; document.getElementById('app-layout').classList.add('active'); }, 400);
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
                    if(m.mobile) bottomHTML += `<div class="bn-item-wrapper"><a class="bn-item ripple-btn" onclick="App.UI.toggleChatPopup(true)"><span class="material-symbols-outlined">${m.icon}</span><span>${m.label}</span></a><div class="bn-counter-badge" id="mobile-bn-chat-counter" style="display:none;">0</div></div>`;
                } else {
                    sideHTML += `<li><a class="menu-item ripple-btn" data-route="${m.id}" onclick="App.Router.navigate('${m.id}')"><span class="material-symbols-outlined">${m.icon}</span><span class="menu-text">${m.label}</span></a></li>`;
                    if(m.mobile) bottomHTML += `<a class="bn-item ripple-btn" data-route="${m.id}" onclick="App.Router.navigate('${m.id}')"><span class="material-symbols-outlined">${m.icon}</span><span>${m.label}</span></a>`;
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
                    <img src="${currentAvatar}" class="user-avatar user-avatar-reactive" style="width:40px; height:40px;">
                    <div class="minimal-composer-input-mock">Apa yang Anda pikirkan?</div>
                    <span class="material-symbols-outlined minimal-composer-gallery-icon">image</span>
                </div>
                <div id="feed-stream"></div>
            `;
        },
        explore() {
            return `<div class="glass-card"><h2>Cari Koneksi & Teman</h2><div id="explore-users-stream" class="user-grid"></div></div>`;
        },
        groups() {
            return `<div class="glass-card"><div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;"><h2 style="margin:0;">Komunitas Premium</h2><button class="btn btn-primary" onclick="App.Features.triggerCreateCommunityPremiumModal()">Buat Komunitas</button></div><div class="community-list-container" id="community-hub-list-viewport"></div></div>`;
        },
        profil() {
            const currentName = App.ProfileState.getCurrentName();
            const currentAvatar = App.ProfileState.getCurrentAvatar();
            const currentBioRole = App.ProfileState.getCurrentRoleBioStatus();
            const address = cachedUserProfileData.address || 'Belum diisi';
            const job = cachedUserProfileData.job || 'Belum diisi';
            const location = cachedUserProfileData.location || 'Tidak diketahui';
            const isSuperAdmin = (cachedUserProfileData.display_name === 'mastrisnocom');

            let adFormHTML = '';
            if (isSuperAdmin) {
                adFormHTML = `
                    <div class="glass-card" style="margin-top: 24px; text-align: left; border: 1px solid var(--primary);">
                        <h3 style="margin-bottom: 8px; color: var(--primary); display: flex; align-items: center; gap: 8px;">
                            <span class="material-symbols-outlined">ads_click</span> Panel Pasang Iklan Super Admin
                        </h3>
                        <form id="global-admin-ad-form" onsubmit="App.Features.saveAdminGlobalAdBannerAction(event)">
                            <div class="form-group" style="margin-bottom: 14px;">
                                <input type="text" class="form-input" id="admin-ad-text-input" placeholder=" ">
                                <label class="form-label">Teks Pengumuman Global Cloud</label>
                            </div>
                            <button type="submit" class="btn btn-primary btn-full">Pasang & Publikasikan Iklan</button>
                        </form>
                    </div>
                `;
            }

            return `
                <div class="glass-card profile-info-card" style="padding:0; overflow:hidden;">
                    <div class="profile-cover"></div>
                    <img src="${currentAvatar}" class="profile-avatar-large user-avatar-reactive">
                    <h2>${currentName}</h2>
                    <p style="color: var(--primary); font-weight: 600; margin-bottom: 8px;">${currentBioRole}</p>
                    
                    <div style="padding:0 24px; text-align:left; font-size:0.85rem; color:var(--text-main); display:flex; flex-direction:column; gap:6px; margin-bottom:16px;">
                        <div><strong>💼 Pekerjaan:</strong> ${job}</div>
                        <div><strong>📍 Alamat Rumah:</strong> ${address}</div>
                        <div><strong>🛰️ Koordinat Geolokasi:</strong> <span style="font-family:monospace; color:var(--primary);">${location}</span></div>
                    </div>

                    <div class="profile-stats">
                        <div class="stat-item"><span class="stat-val" id="profile-friends-count">0</span><span class="stat-lbl">Teman</span></div>
                        <div class="stat-item"><span class="stat-val">2.5K</span><span class="stat-lbl">Pengikut</span></div>
                        <div class="stat-item"><span class="stat-val">84</span><span class="stat-lbl">Postingan</span></div>
                    </div>
                    <div style="padding: 24px; display:flex; flex-direction:column; gap:12px; max-width:320px; margin:0 auto;">
                        <button class="btn btn-primary" onclick="App.Router.navigate('settings')">Edit Profil & Detail</button>
                        <button class="btn btn-secondary" style="color:var(--danger); background:rgba(238,93,80,0.08)" onclick="App.Auth.logout()"><span class="material-symbols-outlined" style="font-size:18px;">logout</span> Keluar Akun</button>
                    </div>
                </div>
                ${adFormHTML}
            `;
        },
        settings() {
            const currentName = App.ProfileState.getCurrentName();
            const currentAvatar = App.ProfileState.getCurrentAvatar();
            const currentBioRole = App.ProfileState.getCurrentRoleBioStatus();
            const address = cachedUserProfileData.address || '';
            const job = cachedUserProfileData.job || '';
            const location = cachedUserProfileData.location || '';
            const remainingEdit = 3 - (cachedUserProfileData.edit_count || 0);
            return `
                <div class="glass-card" style="max-width: 600px;">
                    <h2>Pengaturan Data Profil (Cloud Database)</h2>
                    <div class="avatar-edit-container">
                        <div class="avatar-preview-wrapper">
                            <img src="${currentAvatar}" id="settings-avatar-preview" class="avatar-preview-circle user-avatar-reactive">
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
                        <label class="form-label">Status Peran / Bio</label>
                    </div>
                    <div class="form-group">
                        <input type="text" class="form-input" id="settings-job" placeholder=" " value="${job}">
                        <label class="form-label">Pekerjaan</label>
                    </div>
                    <div class="form-group">
                        <input type="text" class="form-input" id="settings-address" placeholder=" " value="${address}">
                        <label class="form-label">Alamat Lengkap</label>
                    </div>
                    <div class="form-group" style="display:flex; gap:10px; align-items:center;">
                        <div style="flex:1; position:relative;">
                            <input type="text" class="form-input" id="settings-location" placeholder=" " value="${location}" readonly style="background:var(--bg-body);">
                            <label class="form-label">Koordinat Lokasi Otomatis</label>
                        </div>
                        <button type="button" class="btn btn-secondary" onclick="App.Features.fetchUserCurrentGPSLocation()" style="height:54px; border-radius:12px;"><span class="material-symbols-outlined">my_location</span></button>
                    </div>
                    <div style="margin-bottom: 24px; padding: 14px; border-radius: var(--radius-md); background: var(--primary-state); display: flex; align-items: center; justify-content: space-between;">
                        <span>Sisa Kuota Perubahan Bulan Ini:</span>
                        <span class="badge" style="display:inline-block; position:relative; padding: 6px 12px; background: var(--primary); color: white; border:none;">${remainingEdit > 0 ? remainingEdit : 0} Kali</span>
                    </div>
                    <button class="btn btn-primary ripple-btn" onclick="App.Features.saveNameSettings()">Simpan Perubahan</button>
                </div>
            `;
        }
    },

    ViewControllers: {
        feed() { App.Features.renderPosts(); },
        explore() { App.Features.renderExploreUsers(); },
        groups() { App.Features.renderCommunityHubViewportList(); },
        profil() { 
            App.Features.loadFriendsCount(); 
            const txtNode = document.getElementById('admin-ad-text-input');
            if(txtNode) {
                supabaseClient.from('global_settings').select('value').eq('key', 'ad_text_global').single().then(({data}) => {
                    if(data) txtNode.value = data.value;
                });
            }
        }
    },

    Features: {
        async saveAdminGlobalAdBannerAction(event) {
            if(event) event.preventDefault();
            const txtNode = document.getElementById('admin-ad-text-input');
            if(!txtNode) return;
            const textValue = txtNode.value.trim();
            
            await supabaseClient.from('global_settings').upsert([{ key: 'ad_text_global', value: textValue }]);
            App.Toast.show("Iklan global cloud diperbarui!", "success");
            await App.UI.renderGlobalBannerAdIfExists();
        },

        fetchUserCurrentGPSLocation() {
            const locInput = document.getElementById('settings-location');
            if(!navigator.geolocation) { return App.Toast.show("Geolokasi tidak didukung browser.", "warning"); }
            if(locInput) locInput.value = "Mencari lokasi perangkat...";
            navigator.geolocation.getCurrentPosition((pos) => {
                if(locInput) locInput.value = `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`;
                App.Toast.show("Lokasi disinkronkan!", "success");
            }, (err) => {
                if(locInput) locInput.value = "";
                App.Toast.show("Gagal mengambil GPS: " + err.message, "danger");
            }, { enableHighAccuracy: true });
        },

        openComposerModalPopupForm() {
            const currentName = App.ProfileState.getCurrentName();
            composerAttachedImageBase64 = null;
            const popupFormHTML = `
                <div style="text-align:left;">
                    <textarea class="form-input" id="composer-text" placeholder="Apa yang sedang Anda pikirkan, ${currentName}?" style="min-height:120px; padding-top:16px; resize:none; margin-bottom:14px; color:var(--text-main);"></textarea>
                    <div id="composer-upload-preview-area" style="margin-bottom:12px;"></div>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <button type="button" class="icon-btn" style="color:var(--primary)" onclick="document.getElementById('composer-img-input').click()"><span class="material-symbols-outlined">image</span></button>
                        <input type="file" id="composer-img-input" accept="image/*" style="display:none;" onchange="App.Features.handleComposerImageSelection(event)">
                        <button type="button" class="btn btn-primary" onclick="App.Features.createPost()">Terbitkan Postingan</button>
                    </div>
                </div>
            `;
            App.Modal.open("Buat Postingan Baru", popupFormHTML);
            if(document.getElementById('modal-ok-btn')) document.getElementById('modal-ok-btn').style.display = 'none'; 
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
                composerAttachedImageBase64 = e.target.result;
                const p = document.getElementById('composer-upload-preview-area');
                if(p) p.innerHTML = `<img src="${e.target.result}" style="max-height:120px; border-radius:8px; border:2px solid var(--primary);">`;
            };
        },

        openSocialMediaShareSheetModal(postId, textContext) {
            const encodedLink = encodeURIComponent(window.location.origin + window.location.pathname + "?post=" + postId);
            const encodedText = encodeURIComponent(`Lihat postingan menarik ini di Tech Social: "${textContext.substring(0,60)}..." \n\n`);
            App.Modal.open("Bagikan", `<div style="display:flex; flex-direction:column; gap:12px;"><a href="https://api.whatsapp.com/send?text=${encodedText}${encodedLink}" target="_blank" class="btn btn-full" style="background:#25D366; color:white;">WhatsApp</a></div>`);
        },

        async triggerPostTextEditAction(postId) {
            App.Modal.close();
            const { data } = await supabaseClient.from('posts').select('content').eq('id', postId).single();
            const newTxt = prompt("Edit teks kiriman:", data?.content || '');
            if(!newTxt || !newTxt.trim()) return;
            await supabaseClient.from('posts').update({ content: newTxt.trim() }).eq('id', postId);
            this.renderPosts();
        },

        async triggerPostDeleteAction(postId) {
            App.Modal.close();
            if(!confirm("Yakin ingin menghapus postingan ini secara permanen?")) return;
            await supabaseClient.from('posts').delete().eq('id', postId);
            App.Toast.show("Postingan berhasil dihapus", "success");
            this.renderPosts();
        },

        openPostActionMenuDOM(postId, hasImage) {
            let menuHTML = `<button class="btn btn-secondary btn-full" style="margin-bottom:8px;" onclick="App.Features.triggerPostTextEditAction(${postId})">Edit Teks</button>`;
            menuHTML += `<button class="btn btn-secondary btn-full" style="color:var(--danger);" onclick="App.Features.triggerPostDeleteAction(${postId})">Hapus Postingan</button>`;
            App.Modal.open("Manajemen Postingan", menuHTML);
        },

        async loadPopupFriendsListSidebar() {
            const listContainer = document.getElementById('popup-friends-sidebar-items'); if(!listContainer) return;
            const myEmail = localStorage.getItem('ns_user_email') || '';
            const { data: friends } = await supabaseClient.from('friends').select('friend_email').eq('user_email', myEmail);
            if(!friends) return;
            listContainer.innerHTML = friends.map(f => {
                const displayName = f.friend_email.split('@')[0];
                const normalizedKey = displayName.toLowerCase() + "@nexsocial.id";
                const unreadCount = unreadMessageCounters[normalizedKey] || 0;
                const counterBadgeHTML = unreadCount > 0 ? `<div class="popup-item-counter-dot">${unreadCount}</div>` : '';
                
                return `
                    <div class="popup-friend-item" onclick="App.Features.openSpecificFriendPopupObrolan('${f.friend_email}', '${displayName}')">
                        <img src="https://i.pravatar.cc/150?img=${Math.abs(displayName.hashCode() % 70)}" class="friend-avatar-node" onclick="event.stopPropagation(); App.Features.triggerPopupFriendMetaCardModal('${displayName}','${f.friend_email}')">
                        <span class="friend-online-dot"></span>
                        ${counterBadgeHTML}
                    </div>
                `;
            }).join('');
        },

        triggerPopupFriendMetaCardModal(name, email) {
            const infoCard = `
                <div style="text-align:center; padding:12px 0;">
                    <img src="https://i.pravatar.cc/150?img=${Math.abs(name.hashCode() % 70)}" style="width:80px; height:80px; border-radius:50%; margin-bottom:12px; border:2px solid var(--primary);">
                    <h3 style="color:var(--text-main); margin-bottom:4px;">${name}</h3>
                    <p style="font-size:0.8rem; color:var(--text-muted); margin-bottom:14px;">${email}</p>
                    <button type="button" class="btn btn-primary btn-full" onclick="App.Modal.close(); App.Features.openSpecificFriendPopupObrolan('${email}', '${name}')">Kirim Pesan</button>
                </div>
            `;
            App.Modal.open("Profil Anggota Jaringan", infoCard);
            if(document.getElementById('modal-ok-btn')) document.getElementById('modal-ok-btn').style.display = 'none';
        },

        async openSpecificFriendPopupObrolan(friendEmail, friendName) {
            activeChatFriendEmail = friendEmail; activeChatFriendName = friendName;
            
            const friendAvatarUrl = `https://i.pravatar.cc/150?img=${Math.abs(friendName.hashCode() % 70)}`;
            
            const headerBox = document.getElementById('dynamic-chat-header-node');
            if (headerBox) {
                headerBox.innerHTML = `
                    <div class="chat-user-profile-header">
                        <button type="button" class="icon-btn" style="color:var(--text-main); width:32px; height:32px; padding:0;" onclick="App.UI.toggleChatPopup(false)">
                            <span class="material-symbols-outlined">arrow_back</span>
                        </button>
                        <div class="chat-header-avatar-wrap">
                            <img src="${friendAvatarUrl}">
                            <span class="friend-online-dot" style="bottom:0; right:0; width:8px; height:8px;"></span>
                        </div>
                        <div class="chat-header-info">
                            <h4>${friendName}</h4>
                            <span>Sedang Aktif</span>
                        </div>
                    </div>
                    <div class="chat-header-actions">
                        <button type="button" class="icon-btn"><span class="material-symbols-outlined">local_offer</span></button>
                        <button type="button" class="icon-btn"><span class="material-symbols-outlined">call</span></button>
                        <button type="button" class="icon-btn"><span class="material-symbols-outlined">videocam</span></button>
                    </div>
                `;
            }

            unreadMessageCounters[friendName.toLowerCase() + "@nexsocial.id"] = 0;
            App.UI.updateGlobalMessageNotificationBadgeCount();
            this.loadPopupFriendsListSidebar();

            const mainArea = document.getElementById('popup-chat-main-area-pane'); if(!mainArea) return;

            let chatEmojiHTML = EMOJI_LIST.map(em => `<button type="button" class="emoji-item-btn" onclick="App.Features.appendEmojiToInputField('popup-chat-input-field','popup-chat-emoji-panel','${em}')">${em}</button>`).join('');

            mainArea.innerHTML = `
                <div class="popup-msg-stream" id="popup-msg-stream-viewport">
                    <div class="chat-stream-profile-banner">
                        <div class="chat-banner-avatar-wrap">
                            <img src="${friendAvatarUrl}">
                            <span class="friend-online-dot"></span>
                        </div>
                        <h3>${friendName}</h3>
                        <button type="button" class="btn btn-secondary" style="padding:6px 16px; font-size:0.8rem; border-radius:8px;" onclick="App.Features.triggerPopupFriendMetaCardModal('${friendName}','${friendEmail}')">Lihat profil</button>
                    </div>
                    <div id="chat-messages-embedded-target-stream" style="display:flex; flex-direction:column; gap:10px;"></div>
                </div>
                <div class="popup-chat-input-row" style="position:relative;">
                    <div class="emoji-popup-box" id="popup-chat-emoji-panel" style="display:none; bottom:55px; right:40px;">${chatEmojiHTML}</div>
                    
                    <div class="chat-input-media-group">
                        <button type="button" class="icon-btn"><span class="material-symbols-outlined">add_circle</span></button>
                        <button type="button" class="icon-btn"><span class="material-symbols-outlined">photo_camera</span></button>
                        <button type="button" class="icon-btn"><span class="material-symbols-outlined">image</span></button>
                        <button type="button" class="icon-btn"><span class="material-symbols-outlined">mic</span></button>
                    </div>
                    <div class="chat-input-capsule-wrap">
                        <input type="text" placeholder="Pesan" id="popup-chat-input-field" onkeypress="if(event.key==='Enter') App.Features.sendPopupChatCloudAction()">
                        <span class="material-symbols-outlined capsule-emoji-trigger" onclick="App.Features.toggleEmojiPanelDOM('popup-chat-emoji-panel')">mood</span>
                    </div>
                    <div class="chat-footer-right-action" onclick="App.Features.sendPopupChatCloudAction()">
                        <button type="button" class="icon-btn"><span class="material-symbols-outlined">thumb_up</span></button>
                    </div>
                </div>
            `;

            try {
                const myCurrentName = App.ProfileState.getCurrentName();
                const { data: messages, error } = await supabaseClient
                    .from('posts')
                    .select('*')
                    .eq('image', 'private_chat_type')
                    .order('created_at', { ascending: true });

                if (error) throw error;

                const filtered = messages ? messages.filter(msg => 
                    (msg.author === myCurrentName && msg.role === friendName) || 
                    (msg.author === friendName && msg.role === myCurrentName)
                ) : [];
                
                const embeddedStream = document.getElementById('chat-messages-embedded-target-stream');
                const streamViewport = document.getElementById('popup-msg-stream-viewport');
                
                if(embeddedStream) {
                    embeddedStream.innerHTML = filtered.map(msg => {
                        return `<div class="bubble ${msg.author === myCurrentName ? 'out' : 'in'}"><span class="bubble-sender-name">${msg.author}</span><span>${msg.content}</span></div>`;
                    }).join('');
                    if(streamViewport) streamViewport.scrollTop = streamViewport.scrollHeight;
                }
            } catch(err) { console.error("Gagal memuat pesan:", err); }
        },

        async sendPopupChatCloudAction() {
            const input = document.getElementById('popup-chat-input-field'); 
            if(!input || !input.value.trim() || !activeChatFriendName) return;
            
            const textVal = input.value.trim(); 
            const myCurrentName = App.ProfileState.getCurrentName();

            try {
                const { error } = await supabaseClient
                    .from('posts')
                    .insert([{ 
                        author: myCurrentName, 
                        role: activeChatFriendName, 
                        avatar: App.ProfileState.getCurrentAvatar(), 
                        content: textVal, 
                        image: 'private_chat_type', 
                        likes: 0,
                        dislikes: 0
                    }]);

                if (error) throw error;

                const embeddedStream = document.getElementById('chat-messages-embedded-target-stream');
                const streamViewport = document.getElementById('popup-msg-stream-viewport');
                
                if(embeddedStream) {
                    const b = document.createElement('div'); 
                    b.className = 'bubble out';
                    b.innerHTML = `<span class="bubble-sender-name">${myCurrentName}</span><span>${textVal}</span>`;
                    embeddedStream.appendChild(b); 
                    if(streamViewport) streamViewport.scrollTop = streamViewport.scrollHeight;
                }
                input.value = '';
            } catch(err) {
                console.error("Gagal mengirim pesan:", err);
            }
        },

        triggerCreateCommunityPremiumModal() {
            const invoiceHTML = `
                <div style="text-align:left;">
                    <div class="form-group"><input type="text" class="form-input" id="new-comm-title" placeholder=" " required><label class="form-label">Nama Komunitas</label></div>
                    <div style="background:var(--primary-state); padding:16px; border-radius:12px; margin-bottom:20px; border:1px solid var(--primary);"><strong>INVOICE MOCKUP:</strong><span style="font-weight:800; font-size:1.2rem; color:var(--primary); display:block;">Rp 50.000</span></div>
                    <button class="btn btn-primary btn-full" onclick="App.Features.processPremiumCommunityPaymentAction()">Bayar & Buat (Cloud)</button>
                </div>
            `;
            App.Modal.open("Buat Komunitas Premium", invoiceHTML);
            if(document.getElementById('modal-ok-btn')) document.getElementById('modal-ok-btn').style.display = 'none';
        },

        async processPremiumCommunityPaymentAction() {
            const titleInput = document.getElementById('new-comm-title');
            if(!titleInput || !titleInput.value.trim()) return App.Toast.show("Nama komunitas wajib diisi.", "warning");
            
            await supabaseClient.from('communities').insert([{ title: titleInput.value.trim(), creator: App.ProfileState.getCurrentName(), posts: '[]' }]);
            App.Toast.show("Komunitas premium cloud aktif.", "success");
            App.Modal.close();
            this.renderCommunityHubViewportList();
        },

        async triggerEditCommunityAction(commId) {
            const newName = prompt("Masukkan nama baru komunitas:");
            if(!newName || !newName.trim()) return;
            await supabaseClient.from('communities').update({ title: newName.trim() }).eq('id', commId);
            App.Toast.show("Nama komunitas diperbarui.", "success");
            this.renderCommunityHubViewportList();
        },

        async triggerDeleteCommunityAction(commId) {
            if(!confirm("Hapus komunitas premium ini secara permanen dari server?")) return;
            await supabaseClient.from('communities').delete().eq('id', commId);
            App.Toast.show("Komunitas premium berhasil dihapus.", "warning");
            this.renderCommunityHubViewportList();
        },

        async renderCommunityHubViewportList() {
            const container = document.getElementById('community-hub-list-viewport'); if(!container) return;
            const myCurrentName = App.ProfileState.getCurrentName();
            
            let { data: currentSavedList } = await supabaseClient.from('communities').select('*').order('created_at', { ascending: false });
            if(!currentSavedList || currentSavedList.length === 0) {
                container.innerHTML = `<p style="color:var(--text-muted); padding:20px 0;">Belum ada komunitas premium di server cloud.</p>`;
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

        async openSpecificCommunityTimelineStreamArea(commId, commTitle) {
            let { data: commObj } = await supabaseClient.from('communities').select('*').eq('id', commId).single();
            if(!commObj) return;

            let parsedPosts = [];
            try { if(commObj.posts && commObj.posts.startsWith('[')) parsedPosts = JSON.parse(commObj.posts); } catch(e){}

            let communityFeedPostsHTML = '<p style="color:var(--text-muted); font-size:0.9rem; padding:12px 0;">Belum ada diskusi.</p>';
            if(parsedPosts.length > 0) {
                communityFeedPostsHTML = parsedPosts.map(p => `<div class="glass-card" style="margin-bottom:14px; padding:16px;"><strong style="color:var(--primary); display:block; margin-bottom:4px; font-size:0.9rem;">${p.author}</strong><p style="font-size:0.95rem;">${p.text}</p></div>`).join('');
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
        },

        async submitNewPostToCommunityTimeline(commId) {
            const input = document.getElementById('comm-sub-input-msg'); if(!input || !input.value.trim()) return;
            let { data: commObj } = await supabaseClient.from('communities').select('*').eq('id', commId).single();
            if(!commObj) return;

            let parsedPosts = [];
            try { if(commObj.posts && commObj.posts.startsWith('[')) parsedPosts = JSON.parse(commObj.posts); } catch(e){}
            
            parsedPosts.unshift({ author: App.ProfileState.getCurrentName(), text: input.value.trim() });
            
            await supabaseClient.from('communities').update({ posts: JSON.stringify(parsedPosts) }).eq('id', commId);
            input.value = '';
            this.openSpecificCommunityTimelineStreamArea(commId, commObj.title);
        },

        async renderPosts() {
            const stream = document.getElementById('feed-stream'); if(!stream) return;
            const myCurrentName = App.ProfileState.getCurrentName();
            const isSuperAdmin = (cachedUserProfileData.display_name === 'mastrisnocom');
            const myEmail = localStorage.getItem('ns_user_email') || '';

            const { data: posts, error } = await supabaseClient.from('posts').select('*').order('created_at', { ascending: false });
            if (error) return;
            let filteredPosts = posts ? posts.filter(p => p.image !== 'private_chat_type') : [];
            if(headerSearchFilterQueryString !== "") { filteredPosts = filteredPosts.filter(p => p.author.toLowerCase().includes(headerSearchFilterQueryString)); }

            const { data: myInteractions } = await supabaseClient.from('post_interactions').select('post_id, type').eq('user_email', myEmail);
            const userLikedPostIds = myInteractions ? myInteractions.filter(x => x.type === 'like').map(x => x.post_id) : [];
            const userDislikedPostIds = myInteractions ? myInteractions.filter(x => x.type === 'dislike').map(x => x.post_id) : [];

            stream.innerHTML = filteredPosts.map(p => {
                const pId = p.id;
                let attachedMediaHTML = p.image && p.image.startsWith('data:image') ? `<img src="${p.image}" class="post-attached-image">` : '';
                
                let postMenuConfigHTML = '';
                if(p.author === myCurrentName || isSuperAdmin) {
                    postMenuConfigHTML = `<span class="material-symbols-outlined post-menu-trigger" onclick="App.Features.openPostActionMenuDOM(${pId}, ${p.image ? true : false})">more_vert</span>`;
                }

                let parsedComments = [];
                try { if(p.role && p.role.startsWith('[')) parsedComments = JSON.parse(p.role); } catch(e) {}

                let commentsListHTML = parsedComments.map(c => `
                    <div class="comment-item-wrapper ${c.user === myCurrentName ? 'my-comment' : 'other-comment'}">
                        <div class="comment-bubble"><strong>${c.user}</strong><span>${c.text}</span></div>
                    </div>
                `).join('');

                const postDateObj = p.created_at ? new Date(p.created_at) : new Date();
                const formattedFullTimestamp = postDateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) + ' - ' + postDateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WIB';

                return `
                    <div class="glass-card post-card" id="post-card-container-${pId}">
                        <div class="post-header">
                            <div class="post-author">
                                <img src="${p.avatar || 'https://i.pravatar.cc/150?img=12'}" class="post-avatar">
                                <div class="post-meta">
                                    <h4>${p.author}</h4>
                                    <span>${formattedFullTimestamp}</span>
                                </div>
                            </div>
                            ${postMenuConfigHTML}
                        </div>
                        <div class="post-content">${p.content || ''}</div>
                        ${attachedMediaHTML}
                        
                        <div class="post-actions-bar">
                            <div class="post-action-item ${userLikedPostIds.includes(pId) ? 'liked' : ''}" onclick="App.Features.toggleLike(${pId}, ${p.likes || 0}, ${p.dislikes || 0}, ${userLikedPostIds.includes(pId)}, ${userDislikedPostIds.includes(pId)})">
                                <span class="material-symbols-outlined">thumb_up</span><span id="like-count-node-${pId}">${p.likes || 0}</span>
                            </div>
                            <div class="post-action-item ${userDislikedPostIds.includes(pId) ? 'disliked' : ''}" onclick="App.Features.toggleDislike(${pId}, ${p.likes || 0}, ${p.dislikes || 0}, ${userLikedPostIds.includes(pId)}, ${userDislikedPostIds.includes(pId)})">
                                <span class="material-symbols-outlined">thumb_down</span><span id="dislike-count-node-${pId}">${p.dislikes || 0}</span>
                            </div>
                            <div class="post-action-item" onclick="App.Features.togglePostCommentsVisibility(${pId})">
                                <span class="material-symbols-outlined">comment</span><span>${parsedComments.length}</span>
                            </div>
                            <div class="post-action-item" onclick="App.Features.openSocialMediaShareSheetModal(${pId}, '${(p.content || "").replace(/'/g, "\\'")}')">
                                <span class="material-symbols-outlined">share</span>
                            </div>
                        </div>

                        <div class="comments-section" id="comments-section-container-${pId}">
                            <div class="comments-stream">${commentsListHTML}</div>
                            <div class="comment-row">
                                <input type="text" class="form-input" placeholder="Tulis komentar..." id="comment-input-field-${pId}">
                                <button type="button" class="icon-btn" style="background:var(--primary); color:white; width:34px; height:34px; border-radius:50%; flex-shrink:0;" onclick="App.Features.submitPostCommentAction(${pId})"><span class="material-symbols-outlined" style="font-size:16px;">send</span></button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        },

        async createPost() {
            const txt = document.getElementById('composer-text'); const textValue = txt ? txt.value.trim() : "";
            if(!textValue && !composerAttachedImageBase64) return App.Toast.show("Kiriman kosong.", "warning");
            
            await supabaseClient.from('posts').insert([{ author: App.ProfileState.getCurrentName(), role: '[]', avatar: App.ProfileState.getCurrentAvatar(), content: textValue, image: composerAttachedImageBase64, likes: 0, dislikes: 0 }]);
            
            composerAttachedImageBase64 = null;
            App.Modal.close();
            App.Toast.show("Postingan berhasil diterbitkan!", "success");
            this.renderPosts();
        },

        async toggleLike(id, currentLikes, currentDislikes, isAlreadyLiked, isAlreadyDisliked) {
            const myEmail = localStorage.getItem('ns_user_email') || '';
            const likeNode = document.getElementById(`like-count-node-${id}`);
            const dislikeNode = document.getElementById(`dislike-count-node-${id}`);

            if(isAlreadyLiked) {
                if(likeNode) likeNode.innerText = Math.max(0, currentLikes - 1);
                await supabaseClient.from('post_interactions').delete().eq('user_email', myEmail).eq('post_id', id);
                await supabaseClient.from('posts').update({ likes: Math.max(0, currentLikes - 1) }).eq('id', id);
            } else {
                if(likeNode) likeNode.innerText = currentLikes + 1;
                let finalDislikes = currentDislikes;
                if(isAlreadyDisliked) {
                    finalDislikes = Math.max(0, currentDislikes - 1);
                    if(dislikeNode) dislikeNode.innerText = finalDislikes;
                }
                await supabaseClient.from('post_interactions').upsert([{ user_email: myEmail, post_id: id, type: 'like' }]);
                await supabaseClient.from('posts').update({ likes: currentLikes + 1, dislikes: finalDislikes }).eq('id', id);
            }
            this.renderPosts();
        },

        async toggleDislike(id, currentLikes, currentDislikes, isAlreadyLiked, isAlreadyDisliked) {
            const myEmail = localStorage.getItem('ns_user_email') || '';
            const likeNode = document.getElementById(`like-count-node-${id}`);
            const dislikeNode = document.getElementById(`dislike-count-node-${id}`);

            if(isAlreadyDisliked) {
                if(dislikeNode) dislikeNode.innerText = Math.max(0, currentDislikes - 1);
                await supabaseClient.from('post_interactions').delete().eq('user_email', myEmail).eq('post_id', id);
                await supabaseClient.from('posts').update({ dislikes: Math.max(0, currentDislikes - 1) }).eq('id', id);
            } else {
                if(dislikeNode) dislikeNode.innerText = currentDislikes + 1;
                let finalLikes = currentLikes;
                if(isAlreadyLiked) {
                    finalLikes = Math.max(0, currentLikes - 1);
                    if(likeNode) likeNode.innerText = finalLikes;
                }
                await supabaseClient.from('post_interactions').upsert([{ user_email: myEmail, post_id: id, type: 'dislike' }]);
                await supabaseClient.from('posts').update({ dislikes: currentDislikes + 1, likes: finalLikes }).eq('id', id);
            }
            this.renderPosts();
        },

        showNotifications() {
            liveHeaderNotificationCount = 0;
            App.UI.refreshHeaderNotificationBadgeDOM();

            if (liveNotifications.length === 0) {
                App.Modal.open("Notifikasi", `<p style="text-align:center; padding:12px;">Tidak ada pemberitahuan baru.</p>`);
                return;
            }
            const notiHTML = liveNotifications.map(item => `
                <div class="notification-item-card">
                    <div style="flex:1;">
                        <strong>${item.user}</strong>
                        <p style="font-size:0.85rem; margin-top:4px;">${item.desc}</p>
                    </div>
                </div>
            `).join('');
            App.Modal.open("Notifikasi Jaringan Teman", `<div>${notiHTML}</div>`);
        },

        togglePostCommentsVisibility(postId) {
            const c = document.getElementById(`comments-section-container-${postId}`);
            if(c) c.style.display = window.getComputedStyle(c).display === 'none' ? 'block' : 'none';
        },
        handleAvatarSelection(event) {
            const file = event.target.files[0]; if (!file) return;
            const reader = new FileReader(); reader.readAsDataURL(file);
            reader.onload = function (e) {
                App.ProfileState.saveCompressedAvatar(e.target.result);
                const preview = document.getElementById('settings-avatar-preview'); if(preview) preview.src = e.target.result;
            };
        },
        async saveNameSettings() {
            const name = document.getElementById('settings-display-name').value.trim();
            const bio = document.getElementById('settings-bio-status').value.trim();
            const job = document.getElementById('settings-job').value.trim();
            const address = document.getElementById('settings-address').value.trim();
            const location = document.getElementById('settings-location').value.trim();
            if(!name) return App.Toast.show("Nama wajib diisi", "warning");
            
            let res = await App.ProfileState.updateProfileDataConfiguration(name, bio, address, job, location);
            if(res.success) {
                App.Toast.show("Profil diperbarui di database!", "success"); 
                App.Router.navigate('profil');
            } else {
                App.Modal.open("Batas Kuota", res.message);
            }
        },
        async submitPostCommentAction(postId) {
            const input = document.getElementById(`comment-input-field-${postId}`); if(!input || !input.value.trim()) return;
            const txt = input.value.trim();
            const { data } = await supabaseClient.from('posts').select('role').eq('id', postId).single();
            let commentArray = [];
            try { if(data?.role && data.role.startsWith('[')) commentArray = JSON.parse(data.role); } catch(ex){}
            commentArray.push({ user: App.ProfileState.getCurrentName(), text: txt, date: Date.now() });
            await supabaseClient.from('posts').update({ role: JSON.stringify(commentArray) }).eq('id', postId);
            input.value = ''; this.renderPosts();
        }
    },

    Theme: {
        init() { document.documentElement.setAttribute('data-theme', localStorage.getItem('ns_theme') || 'light'); },
        toggle() {
            const n = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', n); localStorage.setItem('ns_theme', n);
        }
    },

    Modal: { open(t, b) { document.getElementById('modal-title').innerText=t; document.getElementById('modal-body').innerHTML=b; document.getElementById('global-modal').classList.add('active'); }, close() { document.getElementById('global-modal').classList.remove('active'); } },
    Toast: {
        show(m, t="info") {
            const c = document.getElementById('toast-container'), b = document.createElement('div'); b.className = 'toast';
            b.innerHTML = `<span>${m}</span>`; c.appendChild(b);
            setTimeout(() => { b.style.opacity='0'; setTimeout(()=>b.remove(), 300); }, 3000);
        }
    },

    UI: {
        async renderGlobalBannerAdIfExists() {
            const container = document.getElementById('global-superadmin-ad-slot-container');
            if(!container) return;
            
            let { data } = await supabaseClient.from('global_settings').select('value').eq('key', 'ad_text_global').single();
            if(data && data.value.trim() !== "") {
                container.innerHTML = `
                    <div class="global-workspace-ad-banner">
                        <span class="material-symbols-outlined" style="color:var(--primary); animation: pulse 2s infinite;">campaign</span>
                        <div style="font-size:0.85rem; font-weight:600; color:var(--text-main); flex:1;"><marquee scrollamount="4">${data.value}</marquee></div>
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
        },
        closeMobileSidebar() {
            document.getElementById('app-layout')?.classList.remove('sidebar-mobile-open');
            document.getElementById('mobile-overlay')?.classList.remove('active');
        },
        toggleProfileRouteViewportState() {
            if(window.location.hash === '#/profil') App.Router.navigate('feed'); else App.Router.navigate('profil');
        },
        toggleChatPopup(shouldOpen) {
            const chatBox = document.getElementById('floating-chat-popup-box'); if(!chatBox) return;
            if(shouldOpen) { chatBox.classList.add('active'); App.Features.loadPopupFriendsListSidebar(); } 
            else { chatBox.classList.remove('active'); activeChatFriendEmail = null; activeChatFriendName = null; }
        },
        refreshHeaderNotificationBadgeDOM() {
            const badge = document.getElementById('noti-badge');
            if (badge) { badge.innerText = liveHeaderNotificationCount; badge.style.display = liveHeaderNotificationCount > 0 ? 'flex' : 'none'; }
        },
        updateGlobalMessageNotificationBadgeCount() {
            let total = 0; for (const k in unreadMessageCounters) { total += unreadMessageCounters[k]; }
            const s = document.getElementById('main-sidebar-chat-counter'), m = document.getElementById('mobile-bn-chat-counter');
            if(s) { s.innerText = total; s.style.display = total > 0 ? 'flex' : 'none'; }
            if(m) { m.innerText = total; m.style.display = total > 0 ? 'flex' : 'none'; }
        },
        syncGlobalAvatarAndName() {
            const name = App.ProfileState.getCurrentName(); const avatar = App.ProfileState.getCurrentAvatar(); const bio = App.ProfileState.getCurrentRoleBioStatus();
            if(document.getElementById('sidebar-user-name')) document.getElementById('sidebar-user-name').innerText = name;
            if(document.getElementById('sidebar-user-role-label')) document.getElementById('sidebar-user-role-label').innerText = bio;
            document.querySelectorAll('.id-user-avatar-element, .user-avatar-reactive').forEach(img => { img.src = avatar; });
        },
        showLoadingBtn(b) { if(b) { b.innerText = 'Mohon Tunggu...'; b.style.pointerEvents='none'; } }
    }
};

String.prototype.hashCode = function() {
    let hash = 0; for (let i = 0; i < this.length; i++) { hash = this.charCodeAt(i) + ((hash << 5) - hash); } return hash;
};

document.addEventListener('DOMContentLoaded', () => App.init());
