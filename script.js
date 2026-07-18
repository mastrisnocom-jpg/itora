const SUPABASE_URL = 'https://waaufoxlimqtesmmjhyw.supabase.co'; 
const SUPABASE_KEY = 'sb_publishable_X6icNByv3YFbekorwJ6kSw_SX0XUFM8'; 
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY); 

// Variabel Global Aplikasi
let liveNotifications = [ 
    { id: 1, icon: 'shield_person', user: 'Super Admin', type: 'admin', desc: 'Sistem Workspace Tech Social versi 2.4 berhasil diperbarui ke server cloud.', isUnread: true }, 
    { id: 2, icon: 'handshake', user: 'System', type: 'admin', desc: 'Fitur network teman aktif. Sekarang Anda dapat mencari user lain di halaman Eksplor.', isUnread: false } 
]; 
let activeChatFriendEmail = null; 
let activeChatFriendName = null; 
let composerAttachedImageFile = null; // Diubah untuk menampung objek File asli untuk Storage
let composerAttachedFileBase64 = null; 
let composerAttachedFileName = "Dokumen.bin"; 
let unreadMessageCounters = {}; 
let liveHeaderNotificationCount = 1; 
let headerSearchFilterQueryString = ""; 
let searchTimeout = null; 
const EMOJI_LIST = ['😊', '😂', '🔥', '👍', '🙌', '💯', '❤️', '👏', '🎉', '😮', '😢', '🙏']; 

const App = { 
    init() { 
        this.Theme.init(); 
        this.Clock.start(); 
        this.Network.listen(); 
        this.UI.bindGlobalEvents(); 
        this.Navigation.render(); 
        this.Auth.checkCurrentSession(); 
        this.Realtime.subscribePosts(); 
        this.Realtime.subscribeFriendsRequests();
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
            return localStorage.getItem('ns_user_avatar_base64') || 'https://i.pravatar.cc/150?img=12'; 
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
        saveCompressedAvatar(base64Image) { 
            localStorage.setItem('ns_user_avatar_base64', base64Image); 
            App.UI.syncGlobalAvatarAndName(); 
        } 
    }, 

    Realtime: { 
        subscribeFriendsRequests() {
            supabaseClient
                .channel('schema-friends-changes')
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'friends' }, async (payload) => {
                    const newRequest = payload.new;
                    const myEmail = localStorage.getItem('ns_user_email') || '';
                    if (newRequest.friend_email.toLowerCase() === myEmail.toLowerCase() && newRequest.status === 'pending') {
                        const senderName = newRequest.user_email.split('@')[0];
                        const exists = liveNotifications.some(n => n.friendRequestId === newRequest.id);
                        if (!exists) {
                            liveNotifications.unshift({
                                id: newRequest.id,
                                friendRequestId: newRequest.id,
                                icon: 'person_add',
                                user: senderName,
                                senderEmail: newRequest.user_email,
                                type: 'friend_request',
                                desc: `Mengajak Anda berteman.`,
                                isUnread: true
                            });
                            liveHeaderNotificationCount++;
                            App.UI.refreshHeaderNotificationBadgeDOM();
                            App.Toast.show(`Permintaan pertemanan baru dari ${senderName}!`, "info");
                        }
                    }
                })
                .subscribe();
        },

        subscribePosts() { 
            supabaseClient .channel('schema-db-changes') .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'friends' }, async () => {
                if(window.location.hash === '#/explore') App.Features.renderExploreUsers();
            }) .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, async (payload) => { 
                const newPost = payload.new; 
                const myCurrentName = App.ProfileState.getCurrentName(); 
                
                if (newPost.image === 'private_chat_type') { 
                    if (newPost.role.toLowerCase() === myCurrentName.toLowerCase()) { 
                        const searchFriendName = newPost.author.toLowerCase(); 
                        liveNotifications.unshift({ id: Date.now(), icon: 'chat', user: newPost.author, type: 'chat', desc: `Mengirimkan sebuah pesan pribadi baru: "${newPost.content.substring(0, 30)}..."`, isUnread: true }); 
                        liveHeaderNotificationCount++; 
                        App.UI.refreshHeaderNotificationBadgeDOM(); 
                        if (activeChatFriendName && activeChatFriendName.toLowerCase() === searchFriendName && document.getElementById('floating-chat-popup-box').classList.contains('active')) { 
                            App.Features.appendIncomingBubbleDOM(newPost.author, newPost.content); 
                        } else { 
                            unreadMessageCounters[searchFriendName] = (unreadMessageCounters[searchFriendName] || 0) + 1; 
                            App.Toast.show("Pesan baru dari " + newPost.author, "success"); 
                            App.UI.updateGlobalMessageNotificationBadgeCount(); 
                            if(document.getElementById('popup-friends-sidebar-items')) App.Features.loadPopupFriendsListSidebar(); 
                        } 
                    } 
                    return; 
                } 
                
                if (newPost.author.toLowerCase() !== myCurrentName.toLowerCase()) { 
                    const myEmail = localStorage.getItem('ns_user_email') || ''; 
                    const { data: friends } = await supabaseClient.from('friends').select('friend_email').eq('user_email', myEmail).eq('status', 'approved'); 
                    const friendListNames = friends ? friends.map(f => f.friend_email.split('@')[0].toLowerCase()) : []; 
                    if (friendListNames.includes(newPost.author.toLowerCase())) { 
                        liveNotifications.unshift({ id: Date.now(), icon: 'campaign', user: newPost.author, type: 'feed', desc: `Menerbitkan kiriman timeline baru: "${newPost.content.substring(0, 30)}..."`, isUnread: true }); 
                        liveHeaderNotificationCount++; 
                        App.UI.refreshHeaderNotificationBadgeDOM(); 
                        App.Toast.show(`Teman Anda (${newPost.author}) membuat postingan baru!`, "success"); 
                    } 
                    if (window.location.hash === '#/feed') App.Features.renderPosts(); 
                } 
            }) .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'posts' }, async (payload) => { 
                const updatedPost = payload.new; 
                const myCurrentName = App.ProfileState.getCurrentName(); 
                
                if (updatedPost.author.toLowerCase() === myCurrentName.toLowerCase() && updatedPost.image !== 'private_chat_type') { 
                    let parsedComments = []; 
                    try { 
                        if(updatedPost.role && updatedPost.role.startsWith('[')) parsedComments = JSON.parse(updatedPost.role); 
                    } catch(e) {} 
                    
                    if (parsedComments.length > 0) { 
                        const latestComment = parsedComments[parsedComments.length - 1]; 
                        if (latestComment.user.toLowerCase() !== myCurrentName.toLowerCase()) { 
                            liveNotifications.unshift({ id: Date.now(), icon: 'maps_ugc', user: latestComment.user, type: 'comment', desc: `Mengomentari postingan Anda: "${latestComment.text.substring(0, 25)}"`, isUnread: true }); 
                            liveHeaderNotificationCount++; 
                            App.UI.refreshHeaderNotificationBadgeDOM(); 
                        } 
                    } 
                } 
                if (window.location.hash === '#/feed') App.Features.renderPosts(); 
            }) .subscribe(); 
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
                    App.Features.fetchIncomingFriendRequestsSync(); 
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
                App.Features.fetchIncomingFriendRequestsSync(); 
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
            if(auth) auth.style.display = 'none'; 
            if(app) app.classList.add('active'); 
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
            { id: 'feed', label: 'News Feed', icon: 'home', mobile: true }, 
            { id: 'explore', label: 'Cari Teman', icon: 'person_search', mobile: true }, 
            { id: 'chat_trigger', label: 'Pesan', icon: 'chat', mobile: true }, 
            { id: 'groups', label: 'Komunitas', icon: 'groups', mobile: true }, 
            { id: 'settings', label: 'Pengaturan', icon: 'settings', mobile: false } 
        ], 
        render() { 
            const side = document.getElementById('sidebar-menu-list'); 
            const bottom = document.getElementById('bottom-nav-list'); 
            if(!side || !bottom) return;
            
            side.innerHTML = this.menuConfig.map(m => {
                if(m.id === 'chat_trigger') {
                    return `<li class="menu-item-wrapper"><a class="menu-item ripple-btn" onclick="App.UI.toggleChatPopup(true)"><span class="material-symbols-outlined">${m.icon}</span><span class="menu-text">${m.label}</span></a><div class="num-counter-badge" id="main-sidebar-chat-counter" style="display:none;">0</div></li>`;
                }
                return `<li><a class="menu-item ripple-btn" data-route="${m.id}" onclick="App.Router.navigate('${m.id}')"><span class="material-symbols-outlined">${m.icon}</span><span class="menu-text">${m.label}</span></a></li>`;
            }).join('') + `<li style="margin-top: auto;"><a class="menu-item ripple-btn" style="color: var(--danger);" onclick="App.Auth.logout()"><span class="material-symbols-outlined">logout</span><span class="menu-text">Keluar</span></a></li>`; 
            
            bottom.innerHTML = this.menuConfig.filter(m => m.mobile).map(m => {
                if(m.id === 'chat_trigger') {
                    return `<div class="bn-item-wrapper"><a class="bn-item ripple-btn" onclick="App.UI.toggleChatPopup(true)"><span class="material-symbols-outlined">${m.icon}</span></a><div class="bn-counter-badge" id="mobile-bn-chat-counter" style="display:none;">0</div></div>`;
                }
                return `<a class="bn-item ripple-btn" data-route="${m.id}" onclick="App.Router.navigate('${m.id}')"><span class="material-symbols-outlined">${m.icon}</span></a>`;
            }).join(''); 
        } 
    }, 

    Views: { 
        feed() { 
            const currentAvatar = App.ProfileState.getCurrentAvatar(); 
            return ` <div class="minimal-composer-bar" onclick="App.Features.openComposerModalPopupForm()"> <img src="${currentAvatar}" class="user-avatar user-avatar-reactive" style="width:40px; height:40px;" alt="Me"> <div class="minimal-composer-input-mock">Apa yang Anda pikirkan?</div> <span class="material-symbols-outlined minimal-composer-gallery-icon">image</span> </div> <div id="feed-stream"></div> `; 
        }, 
        explore() { 
            return ` <div class="glass-card"> <h2>Cari Koneksi & Teman</h2> <p style="color: var(--text-muted); font-size:0.85rem; margin-bottom: 24px;">Temukan pengguna Workspace lain dalam kluster cloud Anda.</p> <div id="explore-users-stream" class="user-grid"></div> </div> `; 
        }, 
        groups() { 
            return ` <div class="glass-card"> <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:24px; flex-wrap:wrap; gap:12px;"> <div> <h2>Komunitas Premium</h2> <p style="color:var(--text-muted); font-size:0.85rem;">Maksimal membuat 1 komunitas berbayar per akun.</p> </div> <button class="btn btn-primary" onclick="App.Features.triggerCreateCommunityPremiumModal()"><span class="material-symbols-outlined">add_circle</span> Buat Komunitas (Rp 50.000)</button> </div> <div class="community-list-container" id="community-hub-list-viewport"></div> </div> `; 
        }, 
        profil() { 
            const currentName = App.ProfileState.getCurrentName(); 
            const currentAvatar = App.ProfileState.getCurrentAvatar(); 
            const currentBioRole = App.ProfileState.getCurrentRoleBioStatus(); 
            const myEmail = (localStorage.getItem('ns_user_email') || '').toLowerCase(); 
            const isSuperAdmin = (myEmail === 'mastrisnocom@gmail.com'); 
            let adFormHTML = ''; 
            if (isSuperAdmin) { 
                adFormHTML = ` <div class="glass-card" style="margin-top: 24px; text-align: left; border: 1px solid var(--primary);"> <h3 style="margin-bottom: 8px; color: var(--primary); display: flex; align-items: center; gap: 8px;"> <span class="material-symbols-outlined">ads_click</span> Panel Pasang Iklan Super Admin </h3> <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 16px;">Teks iklan ini akan dipasang secara global tepat di bawah header aplikasi.</p> <form id="global-admin-ad-form" onsubmit="App.Features.saveAdminGlobalAdBannerAction(event)"> <div class="form-group" style="margin-bottom: 14px;"> <input type="text" class="form-input" id="admin-ad-text-input" placeholder=" " value="${localStorage.getItem('ns_ad_text_global') || ''}" required> <label class="form-label">Teks Pengumuman / Iklan Berjalan</label> </div> <button type="submit" class="btn btn-primary btn-full">Pasang & Publikasikan Iklan</button> </form> </div> `; 
            } 
            return ` <div class="glass-card profile-info-card" style="padding:0; overflow:hidden;"> <div class="profile-cover"></div> <img src="${currentAvatar}" class="profile-avatar-large user-avatar-reactive" alt="Profile"> <h2>${currentName} ${isSuperAdmin ? '<span style="font-size:0.75rem; background:var(--primary); color:white; padding:2px 8px; border-radius:10px; margin-left:6px; vertical-align:middle;">SUPER ADMIN</span>' : ''}</h2> <p style="color: var(--primary); font-weight: 600; margin-bottom: 12px;">${currentBioRole}</p> <div class="profile-stats"> <div class="stat-item"><span class="stat-val" id="profile-friends-count">0</span><span class="stat-lbl">Teman</span></div> <div class="stat-item"><span class="stat-val">2.5K</span><span class="stat-lbl">Pengikut</span></div> <div class="stat-item"><span class="stat-val">84</span><span class="stat-lbl">Postingan</span></div> </div> <div style="padding: 24px; display:flex; flex-direction:column; gap:12px; max-width:320px; margin:0 auto;"> <button class="btn btn-primary ripple-btn" onclick="App.Router.navigate('settings')">Edit Profil & Nama</button> <button class="btn btn-secondary ripple-btn" style="color:var(--danger); background:rgba(238,93,80,0.08)" onclick="App.Features.triggerChangePasswordAction()">Ganti Password Akun</button> </div> </div> ${adFormHTML} `; 
        }, 
        settings() { 
            const currentName = App.ProfileState.getCurrentName(); 
            const currentAvatar = App.ProfileState.getCurrentAvatar(); 
            const currentBioRole = App.ProfileState.getCurrentRoleBioStatus(); 
            const limitConfig = App.ProfileState.getLimitConfig(); 
            const remainingEdit = 3 - limitConfig.count; 
            return ` <div class="glass-card" style="max-width: 600px;"> <h2>Pengaturan Akun</h2> <div class="avatar-edit-container"> <div class="avatar-preview-wrapper"> <img src="${currentAvatar}" id="settings-avatar-preview" class="avatar-preview-circle user-avatar-reactive" alt="Preview"> <label for="avatar-file-input" class="avatar-upload-label"><span class="material-symbols-outlined" style="font-size:18px;">photo_camera</span></label> <input type="file" id="avatar-file-input" style="display:none;" accept="image/*" onchange="App.Features.handleAvatarSelection(event)"> </div> </div> <div class="form-group"> <input type="text" class="form-input" id="settings-display-name" placeholder=" " value="${currentName}"> <label class="form-label">Nama Tampilan</label> </div> <div class="form-group"> <input type="text" class="form-input" id="settings-bio-status" placeholder=" " value="${currentBioRole}"> <label class="form-label">Status Peran / Bio Profil</label> </div> <div style="margin-bottom: 24px; padding: 14px; border-radius: var(--radius-md); background: var(--primary-state); display: flex; align-items: center; justify-content: space-between;"> <span>Sisa Kuota Perubahan Data:</span> <span class="badge" style="display:inline-block; position:relative; padding: 6px 12px; font-weight: 800; border-radius: 8px; background: ${remainingEdit > 0 ? 'var(--primary)' : 'var(--danger)'}; color: white; border:none;">${remainingEdit} Kali</span> </div> <button class="btn btn-primary ripple-btn" onclick="App.Features.saveNameSettings()">Simpan Perubahan Profil</button> </div> `; 
        } 
    }, 

    ViewControllers: { 
        feed() { App.Features.renderPosts(); }, 
        explore() { App.Features.renderExploreUsers(); }, 
        groups() { App.Features.renderCommunityHubViewportList(); }, 
        profil() { App.Features.loadFriendsCount(); } 
    }, 

    Features: { 
        async fetchIncomingFriendRequestsSync() {
            const myEmail = localStorage.getItem('ns_user_email') || '';
            if(!myEmail) return;
            try {
                const { data, error } = await supabaseClient
                    .from('friends')
                    .select('*')
                    .eq('friend_email', myEmail)
                    .eq('status', 'pending');
                
                if(error) throw error;
                if(data) {
                    data.forEach(req => {
                        const senderUsername = req.user_email.split('@')[0];
                        if (!liveNotifications.some(n => n.friendRequestId === req.id)) {
                            liveNotifications.unshift({
                                id: req.id,
                                friendRequestId: req.id,
                                icon: 'person_add',
                                user: senderUsername,
                                senderEmail: req.user_email,
                                type: 'friend_request',
                                desc: `Mengajak Anda berteman.`,
                                isUnread: true
                            });
                            liveHeaderNotificationCount++;
                        }
                    });
                    App.UI.refreshHeaderNotificationBadgeDOM();
                }
            } catch(e) { console.error(e); }
        },

        async acceptFriendRequestAction(notiId, dbRequestId, senderEmail) {
            const myEmail = localStorage.getItem('ns_user_email') || '';
            try {
                await supabaseClient.from('friends').update({ status: 'approved' }).eq('id', dbRequestId);
                const { data: checkInverse } = await supabaseClient.from('friends').select('id').eq('user_email', myEmail).eq('friend_email', senderEmail);
                if(!checkInverse || checkInverse.length === 0) {
                    await supabaseClient.from('friends').insert([
                        { user_email: myEmail, friend_email: senderEmail, status: 'approved' }
                    ]);
                }
                liveNotifications = liveNotifications.filter(n => n.id !== notiId);
                App.Toast.show("Pertemanan dikonfirmasi!", "success");
                App.Modal.close();
                this.renderExploreUsers();
                this.loadPopupFriendsListSidebar();
            } catch(err) { console.error(err); }
        },

        async rejectFriendRequestAction(notiId, dbRequestId) {
            try {
                await supabaseClient.from('friends').delete().eq('id', dbRequestId);
                liveNotifications = liveNotifications.filter(n => n.id !== notiId);
                App.Toast.show("Permintaan pertemanan ditolak.", "warning");
                App.Modal.close();
                this.renderExploreUsers();
            } catch(e) { console.error(e); }
        },

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
            const popupFormHTML = ` <div style="text-align:left;"> <textarea class="form-input" id="composer-text" placeholder="Apa yang sedang Anda pikirkan, ${currentName}?" style="min-height:120px; padding-top:16px; resize:none; margin-bottom:14px; color:var(--text-main);"></textarea> <div id="composer-upload-preview-area" style="margin-bottom:12px;"></div> <div style="display:flex; justify-content:space-between; align-items:center;"> <div style="display:flex; gap:12px;"> <button type="button" class="icon-btn" style="color:var(--primary)" onclick="document.getElementById('composer-img-input').click()"><span class="material-symbols-outlined">image</span></button> <input type="file" id="composer-img-input" accept="image/*" style="display:none;" onchange="App.Features.handleComposerImageSelection(event)"> </div> <button type="button" class="btn btn-primary" onclick="App.Features.createPost()">Terbitkan Postingan</button> </div> </div> `; 
            App.Modal.open("Buat Postingan Baru", popupFormHTML); 
        }, 
        handleHeaderLiveSearchInput(event) { 
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                headerSearchFilterQueryString = event.target.value.trim().toLowerCase(); 
                if(window.location.hash === '#/feed') this.renderPosts(); 
            }, 500);
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
            composerAttachedImageFile = file; // Mengunci objek file asli
            const previewArea = document.getElementById('composer-upload-preview-area'); 
            if (previewArea) { 
                const objectUrl = URL.createObjectURL(file);
                previewArea.innerHTML = `<img src="${objectUrl}" style="max-height:120px; border-radius:8px; display:block; border:2px solid var(--primary);">`; 
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
            const modalHTML = ` <div style="display:flex; flex-direction:column; gap:12px; padding:12px 0;"> <a href="https://api.whatsapp.com/send?text=${encodedText}${encodedLink}" target="_blank" class="btn btn-full" style="background:#25D366; color:white; border-radius:12px;">Bagikan ke WhatsApp</a> <a href="https://t.telegram.org/share/url?url=${encodedLink}&text=${encodedText}" target="_blank" class="btn btn-full" style="background:#0088cc; color:white; border-radius:12px;">Bagikan ke Telegram</a> </div> `; 
            App.Modal.open("Bagikan Postingan", modalHTML); 
        }, 
        triggerCreateCommunityPremiumModal() { 
            if (localStorage.getItem('ns_has_created_community') === 'true') { 
                return App.Modal.open("Batas Akses", "Setiap akun hanya diperbolehkan mendaftarkan maksimal 1 Komunitas Premium."); 
            } 
            const invoiceHTML = ` <div style="text-align:left;"> <div class="form-group"><input type="text" class="form-input" id="new-comm-title" placeholder=" " required><label class="form-label">Nama Komunitas</label></div> <div style="background:var(--primary-state); padding:16px; border-radius:12px; margin-bottom:20px; border:1px solid var(--primary);"><strong>INVOICE BILLING MOCKUP:</strong><span style="font-weight:800; font-size:1.2rem; color:var(--primary); display:block;">Rp 50.000</span></div> <button class="btn btn-primary btn-full" onclick="App.Features.processPremiumCommunityPaymentAction()">Bayar Sekarang</button> </div> `; 
            App.Modal.open("Buat Komunitas Premium", invoiceHTML); 
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
            const container = document.getElementById('community-hub-list-viewport'); 
            if(!container) return; 
            let currentSavedList = JSON.parse(localStorage.getItem('ns_premium_communities_logs') || '[]'); 
            const myCurrentName = App.ProfileState.getCurrentName(); 
            if(currentSavedList.length === 0) { 
                container.innerHTML = `<p style="color:var(--text-muted); padding:20px 0;">Belum ada komunitas premium yang dibuat.</p>`; 
                return; 
            } 
            container.innerHTML = currentSavedList.map(c => { 
                let configButtonsHTML = ''; 
                if(c.creator === myCurrentName) { 
                    configButtonsHTML = ` <div style="display:flex; gap:8px; margin-top:8px;"> <button class="btn btn-secondary" style="padding:4px 10px; font-size:0.75rem; border-radius:6px;" onclick="event.stopPropagation(); App.Features.triggerEditCommunityAction(${c.id})">Edit</button> <button class="btn btn-secondary" style="padding:4px 10px; font-size:0.75rem; border-radius:6px; color:var(--danger);" onclick="event.stopPropagation(); App.Features.triggerDeleteCommunityAction(${c.id})">Hapus</button> </div>`; 
                } 
                return ` <div class="community-card-item" onclick="App.Features.openSpecificCommunityTimelineStreamArea(${c.id}, '${c.title.replace(/'/g, "\\'")}')"> <div class="community-avatar-box">${c.title.charAt(0).toUpperCase()}</div> <div style="text-align:left;"> <h3 style="font-size:1.05rem; font-weight:800; color:var(--text-main);">${c.title}</h3> <p style="font-size:0.8rem; color:var(--text-muted)">Pemilik: ${c.creator}</p> ${configButtonsHTML} </div> <span class="material-symbols-outlined" style="margin-left:auto; color:var(--text-muted)">chevron_right</span> </div> `; 
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
            const subTimelineHTML = ` <div style="text-align:left;"> <div style="display:flex; gap:10px; margin-bottom:20px;"> <input type="text" class="form-input" id="comm-sub-input-msg" placeholder="Tulis ide forum..." style="margin-bottom:0;"> <button class="btn btn-primary" onclick="App.Features.submitNewPostToCommunityTimeline(${commId})"><span class="material-symbols-outlined">send</span></button> </div> <div id="comm-posts-stream-box-node" style="max-height:300px; overflow-y:auto;">${communityFeedPostsHTML}</div> </div> `; 
            App.Modal.open(`Forum: ${commTitle}`, subTimelineHTML); 
        }, 
        submitNewPostToCommunityTimeline(commId) { 
            const input = document.getElementById('comm-sub-input-msg'); 
            if(!input || !input.value.trim()) return; 
            let currentSavedList = JSON.parse(localStorage.getItem('ns_premium_communities_logs') || '[]'); 
            let idx = currentSavedList.findIndex(x => x.id == commId); 
            if(idx === -1) return; 
            if(!currentSavedList[idx].posts) currentSavedList[idx].posts = []; 
            currentSavedList[idx].posts.unshift({ author: App.ProfileState.getCurrentName(), text: input.value.trim() }); 
            localStorage.setItem('ns_premium_communities_logs', JSON.stringify(currentSavedList)); 
            input.value = ''; 
            this.openSpecificCommunityTimelineStreamArea(commId, currentSavedList[idx].title); 
        }, 
        loadPopupFriendsListSidebar() { 
            const listContainer = document.getElementById('popup-friends-sidebar-items'); 
            if(!listContainer) return; 
            const myEmail = localStorage.getItem('ns_user_email') || ''; 
            supabaseClient.from('friends').select('friend_email').eq('user_email', myEmail).eq('status', 'approved').then(({data: friends, error}) => {
                if(error) return;
                listContainer.innerHTML = friends.map(f => { 
                    const displayName = f.friend_email.split('@')[0]; 
                    const isActive = activeChatFriendName && activeChatFriendName.toLowerCase() === displayName.toLowerCase() ? 'active' : ''; 
                    const normalizedKey = displayName.toLowerCase(); 
                    const unreadCount = unreadMessageCounters[normalizedKey] || 0; 
                    const counterBadgeHTML = unreadCount > 0 ? `<div class="popup-item-counter-dot">${unreadCount}</div>` : ''; 
                    return `<div class="popup-friend-item ${isActive}" onclick="App.Features.openSpecificFriendPopupObrolan('${f.friend_email}', '${displayName}')"><span class="friend-online-dot"></span><span style="flex:1; text-align:left; overflow:hidden; text-overflow:ellipsis;">${displayName}</span>${counterBadgeHTML}</div>`; 
                }).join(''); 
            });
        }, 
        async openSpecificFriendPopupObrolan(friendEmail, friendName) { 
            activeChatFriendEmail = friendEmail; 
            activeChatFriendName = friendName; 
            const headerTitle = document.getElementById('popup-chat-header-title'); 
            if (headerTitle) headerTitle.innerHTML = `Obrolan: <span style="text-decoration:underline;">${friendName}</span>`; 
            const normalizedKey = friendName.toLowerCase(); 
            unreadMessageCounters[normalizedKey] = 0; 
            App.UI.updateGlobalMessageNotificationBadgeCount(); 
            this.loadPopupFriendsListSidebar(); 
            const mainArea = document.getElementById('popup-chat-main-area-pane'); 
            if(!mainArea) return; 
            let chatEmojiHTML = EMOJI_LIST.map(em => `<button class="emoji-item-btn" onclick="App.Features.appendEmojiToInputField('popup-chat-input-field','chat-emoji-panel','${em}')">${em}</button>`).join(''); 
            mainArea.innerHTML = ` <div class="popup-msg-stream" id="popup-msg-stream-viewport"></div> <div class="popup-chat-input-row"> <div class="emoji-panel-trigger" onclick="App.Features.toggleEmojiPanelDOM('chat-emoji-panel')"><span class="material-symbols-outlined">mood</span></div> <div class="emoji-popup-box" id="chat-emoji-panel" style="display:none;">${chatEmojiHTML}</div> <input type="text" class="form-input" placeholder="Tulis pesan..." id="popup-chat-input-field" onkeypress="if(event.key==='Enter') App.Features.sendPopupChatCloudAction()"> <button class="btn btn-primary" style="padding:10px 14px;" onclick="App.Features.sendPopupChatCloudAction()">Kirim</button> </div> `; 
            try { 
                const myCurrentName = App.ProfileState.getCurrentName(); 
                const { data: messages, error } = await supabaseClient .from('posts') .select('*') .eq('image', 'private_chat_type') .order('created_at', { ascending: true }); 
                if (error) throw error; 
                const streamViewport = document.getElementById('popup-msg-stream-viewport'); 
                if(streamViewport && messages) { 
                    streamViewport.innerHTML = messages.filter(m => (m.author.toLowerCase() === myCurrentName.toLowerCase() && m.role.toLowerCase() === friendName.toLowerCase()) || (m.author.toLowerCase() === friendName.toLowerCase() && m.role.toLowerCase() === myCurrentName.toLowerCase())).map(msg => { 
                        const bubbleStyle = msg.author.toLowerCase() === myCurrentName.toLowerCase() ? 'out' : 'in'; 
                        return `<div class="bubble ${bubbleStyle}"><span>${msg.content}</span></div>`; 
                    }).join(''); 
                    streamViewport.scrollTop = streamViewport.scrollHeight; 
                } 
            } catch(err) { console.error(err); } 
        }, 
        redirectToTargetFriendProfile(targetName) { 
            App.UI.toggleChatPopup(false); 
            App.Router.navigate('explore'); 
            setTimeout(() => { 
                const globalSearchInput = document.getElementById('header-global-search'); 
                if (globalSearchInput) { 
                    globalSearchInput.value = targetName; 
                    App.Features.handleHeaderLiveSearchInput({ target: globalSearchInput }); 
                } 
            }, 400); 
        }, 
        viewFriendProfileFromChat() { 
            if (activeChatFriendName) this.redirectToTargetFriendProfile(activeChatFriendName); 
        }, 
        async sendPopupChatCloudAction() { 
            const input = document.getElementById('popup-chat-input-field'); 
            if(!input || !input.value.trim() || !activeChatFriendEmail) return; 
            const textVal = input.value.trim(); 
            const myCurrentName = App.ProfileState.getCurrentName(); 
            const myAvatar = App.ProfileState.getCurrentAvatar(); 
            try { 
                await supabaseClient.from('posts').insert([{ author: myCurrentName, role: activeChatFriendName, avatar: myAvatar, content: textVal, image: 'private_chat_type', likes: 0 }]); 
                const streamViewport = document.getElementById('popup-msg-stream-viewport'); 
                if(streamViewport) { 
                    const b = document.createElement('div'); 
                    b.className = 'bubble out'; 
                    b.innerHTML = `<span>${textVal}</span>`; 
                    streamViewport.appendChild(b); 
                    streamViewport.scrollTop = streamViewport.scrollHeight; 
                } 
                input.value = ''; 
            } catch(err) { console.error(err); } 
        }, 
        appendIncomingBubbleDOM(senderName, messageText) { 
            const streamViewport = document.getElementById('popup-msg-stream-viewport'); 
            if(streamViewport) { 
                const bIn = document.createElement('div'); 
                bIn.className = 'bubble in'; 
                bIn.innerHTML = `<span>${messageText}</span>`; 
                streamViewport.appendChild(bIn); 
                streamViewport.scrollTop = streamViewport.scrollHeight; 
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
            App.Modal.close(); 
            if(!confirm("Hapus gambar dari postingan?")) return; 
            try { 
                await supabaseClient.from('posts').update({ image: null }).eq('id', postId); 
                this.renderPosts(); 
            } catch(e) { console.error(e); } 
        }, 
        async renderExploreUsers() { 
            const container = document.getElementById('explore-users-stream'); 
            if(!container) return; 
            const myEmail = localStorage.getItem('ns_user_email') || ''; 
            const myUsername = App.ProfileState.getCurrentName().toLowerCase();
            try { 
                const { data: incomingReq } = await supabaseClient.from('friends').select('id, user_email, status').eq('friend_email', myEmail);
                const { data: outgoingReq } = await supabaseClient.from('friends').select('id, friend_email, status').eq('user_email', myEmail); 
                
                const relationMap = {}; const dbIdMap = {};
                if(outgoingReq) { outgoingReq.forEach(f => { const username = f.friend_email.split('@')[0].toLowerCase(); relationMap[username] = f.status; dbIdMap[username] = f.id; }); } 
                if(incomingReq) { incomingReq.forEach(f => { const username = f.user_email.split('@')[0].toLowerCase(); if(relationMap[username] !== 'approved' && f.status === 'pending') { relationMap[username] = 'incoming_pending'; dbIdMap[username] = f.id; } }); }
                
                const { data: posts } = await supabaseClient.from('posts').select('author, avatar').not('author', 'is', null); 
                const uniqueUsers = []; const map = new Map(); 
                
                if(posts) { 
                    for (const item of posts) { 
                        const authorLower = item.author.toLowerCase();
                        if(authorLower !== myUsername && !map.has(authorLower) && item.image !== 'private_chat_type') { 
                            map.set(authorLower, true); 
                            uniqueUsers.push({ name: item.author, avatar: item.avatar }); 
                        } 
                    } 
                } 
                
                container.innerHTML = uniqueUsers.map(u => { 
                    const username = u.name.toLowerCase(); const statusPertemanan = relationMap[username]; const targetDbId = dbIdMap[username]; let buttonHTML = ''; 
                    
                    if (statusPertemanan === 'approved') { 
                        buttonHTML = `<button class="btn btn-secondary" disabled>Teman</button>`; 
                    } else if (statusPertemanan === 'pending') { 
                        buttonHTML = `<button class="btn btn-secondary" disabled>Menunggu</button>`; 
                    } else if (statusPertemanan === 'incoming_pending') {
                        buttonHTML = `
                            <div style="display:flex; gap:4px;">
                                <button class="btn btn-primary" style="padding:6px 10px; font-size:0.8rem;" onclick="App.Features.acceptFriendRequestAction(Date.now(), ${targetDbId}, '${username}@gmail.com')">Setujui</button>
                                <button class="btn btn-secondary" style="padding:6px 10px; font-size:0.8rem; color:var(--danger);" onclick="App.Features.rejectFriendRequestAction(Date.now(), ${targetDbId})">Tolak</button>
                            </div>`;
                    } else { 
                        buttonHTML = `<button class="btn btn-primary" onclick="App.Features.toggleFriendAction('${username}')">Tambah</button>`; 
                    } 
                    return `<div class="user-follow-card"><h4>${u.name}</h4>${buttonHTML}</div>`; 
                }).join(''); 
            } catch(err) { console.error(err); } 
        }, 
        async toggleFriendAction(friendUsername) { 
            const myEmail = localStorage.getItem('ns_user_email') || ''; 
            try { 
                await supabaseClient.from('friends').insert([{ user_email: myEmail, friend_email: friendUsername + "@gmail.com", status: 'pending' }]); 
                this.renderExploreUsers(); 
            } catch(err) { console.error(err); } 
        }, 
        async loadFriendsCount() { 
            const countEl = document.getElementById('profile-friends-count'); if(!countEl) return; 
            const myEmail = localStorage.getItem('ns_user_email') || ''; 
            const { count } = await supabaseClient.from('friends').select('*', { count: 'exact', head: true }).eq('user_email', myEmail).eq('status', 'approved'); 
            if(count !== null) countEl.innerText = count; 
        }, 
        async renderPosts() { 
            const stream = document.getElementById('feed-stream'); if(!stream) return; 
            try { 
                const { data: posts, error } = await supabaseClient.from('posts').select('*').order('created_at', { ascending: false }); 
                if (error) throw error; 
                let filteredPosts = posts ? posts.filter(p => p.image !== 'private_chat_type') : []; 
                if(headerSearchFilterQueryString !== "") { 
                    filteredPosts = filteredPosts.filter(p => p.author.toLowerCase().includes(headerSearchFilterQueryString)); 
                } 
                if (filteredPosts.length === 0) { 
                    stream.innerHTML = `<div class="glass-card" style="text-align:center; color:var(--text-muted); padding:32px 16px;">Tidak ada postingan di linimasa.</div>`; 
                    return; 
                } 
                stream.innerHTML = filteredPosts.map(p => { 
                    let attachedMediaHTML = p.image ? `<img src="${p.image}" style="max-width:100%; border-radius:8px; margin-top:10px; display:block;">` : ''; 
                    const myCurrentName = App.ProfileState.getCurrentName();
                    let postMenuConfigHTML = p.author.toLowerCase() === myCurrentName.toLowerCase() ? `<span class="material-symbols-outlined" style="cursor:pointer;" onclick="App.Features.openPostActionMenuDOM(${p.id}, ${p.image ? true : false})">more_vert</span>` : ''; 
                    return `
                        <div class="glass-card" style="margin-bottom:15px; padding:15px;">
                            <div style="display:flex; align-items:center; justify-content:space-between;">
                                <div style="display:flex; align-items:center; gap:10px;">
                                    <img src="${p.avatar || 'https://i.pravatar.cc/150?img=12'}" style="width:34px; height:34px; border-radius:50%;">
                                    <h4>${p.author}</h4>
                                </div>
                                ${postMenuConfigHTML}
                            </div>
                            <p style="margin-top:10px;">${p.content || ''}</p>
                            ${attachedMediaHTML}
                        </div>`; 
                }).join(''); 
            } catch (err) { console.error(err); } 
        }, 
        showNotifications() { 
            liveHeaderNotificationCount = 0; App.UI.refreshHeaderNotificationBadgeDOM(); 
            if (liveNotifications.length === 0) { App.Modal.open("Notifikasi Workspace", `<p style="padding:12px; text-align:center; color:var(--text-muted);">Tidak ada pemberitahuan baru.</p>`); return; } 
            const notiHTML = liveNotifications.map(item => { 
                let actionsHTML = item.type === 'friend_request' ? `<div style="display:flex; gap:8px; margin-top:10px;"><button class="btn btn-primary" onclick="App.Features.acceptFriendRequestAction(${item.id}, ${item.friendRequestId}, '${item.senderEmail}')">Setujui</button><button class="btn btn-secondary" onclick="App.Features.rejectFriendRequestAction(${item.id}, ${item.friendRequestId})">Tolak</button></div>` : '';
                return `<div class="notification-item-card"><div><strong>${item.user}</strong><p>${item.desc}</p>${actionsHTML}</div></div>`; 
            }).join(''); 
            App.Modal.open("Notifikasi Workspace", notiHTML); 
        }, 
        saveNameSettings() { 
            const val = document.getElementById('settings-display-name')?.value.trim(); 
            if(val) { localStorage.setItem('ns_display_name', val); App.Router.navigate('feed'); } 
        } 
    }, 

    Theme: { 
        init() { document.documentElement.setAttribute('data-theme', localStorage.getItem('ns_theme') || 'light'); }, 
        toggle() { 
            const n = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light'; 
            document.documentElement.setAttribute('data-theme', n); localStorage.setItem('ns_theme', n); 
        } 
    }, 

    Clock: { start() { } }, 
    Network: { listen() {} }, 

    Modal: { 
        open(t, b) { 
            document.getElementById('modal-title').innerText=t; 
            document.getElementById('modal-body').innerHTML=b; 
            document.getElementById('global-modal').classList.add('active'); 
        }, 
        close() { document.getElementById('global-modal').classList.remove('active'); } 
    }, 

    Toast: { 
        show(m, t="info") { 
            const c = document.getElementById('toast-container'); if(!c) return;
            const b = document.createElement('div'); b.className = 'toast'; b.innerText = m; c.appendChild(b); 
            setTimeout(() => { b.remove(); }, 3000); 
        } 
    }, 

    UI: { 
        renderGlobalBannerAdIfExists() {}, 
        bindGlobalEvents() { 
            document.getElementById('btn-toggle-sidebar')?.addEventListener('click', () => { 
                const l = document.getElementById('app-layout'); if(l) l.classList.toggle('sidebar-mobile-open'); 
            }); 
            document.getElementById('btn-theme')?.addEventListener('click', () => App.Theme.toggle()); 
            document.getElementById('btn-refresh')?.addEventListener('click', () => { App.Router.handleRoute(); App.Toast.show("Diperbarui","success"); }); 
        }, 
        closeMobileSidebar() { document.getElementById('app-layout')?.classList.remove('sidebar-mobile-open'); }, 
        toggleChatPopup(shouldOpen) { const el = document.getElementById('floating-chat-popup-box'); if(el) { el.style.display = shouldOpen ? 'block' : 'none'; if(shouldOpen) App.Features.loadPopupFriendsListSidebar(); } }, 
        refreshHeaderNotificationBadgeDOM() { 
            const b = document.getElementById('noti-badge'); if (b) { b.innerText = liveHeaderNotificationCount; b.style.display = liveHeaderNotificationCount > 0 ? 'flex' : 'none'; } 
        }, 
        updateGlobalMessageNotificationBadgeCount() {}, 
        syncGlobalAvatarAndName() { 
            const name = App.ProfileState.getCurrentName(); 
            const sidebarNameEl = document.getElementById('sidebar-user-name'); if (sidebarNameEl) sidebarNameEl.innerText = name; 
        }, 
        showLoadingBtn(b) {} 
    } 
}; 

document.addEventListener('DOMContentLoaded', () => App.init());
