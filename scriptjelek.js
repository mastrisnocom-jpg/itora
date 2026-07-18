const SUPABASE_URL = 'https://waaufoxlimqtesmmjhyw.supabase.co'; 
const SUPABASE_KEY = 'sb_publishable_X6icNByv3YFbekorwJ6kSw_SX0XUFM8'; 
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY); 

// Variabel Global Aplikasi
let liveNotifications = [ 
    { id: 1, icon: 'shield_person', user: 'Super Admin', type: 'admin', desc: 'Sistem Workspace Tech Social versi 2.4 berhasil diperbarui ke server cloud.', isUnread: true }
]; 
let activeChatFriendEmail = null; 
let activeChatFriendName = null; 
let composerAttachedImageBase64 = null; 
let unreadMessageCounters = {}; 
let liveHeaderNotificationCount = 1; 
let headerSearchFilterQueryString = ""; 
let searchTimeout = null; 
const EMOJI_LIST = ['😊', '😂', '🔥', '👍', '🙌', '💯', '❤️', '👏', '🎉', '😮', '😢', '🙏']; 

const App = { 
    init() { 
        this.Theme.init(); 
        this.UI.bindGlobalEvents(); 
        this.Navigation.render(); 
        this.Auth.checkCurrentSession(); 
        this.Realtime.subscribePosts(); 
        this.Realtime.subscribeFriendsRequests();
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
        }
    }, 

    Realtime: { 
        subscribeFriendsRequests() {
            supabaseClient.channel('schema-friends-changes').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'friends' }, async (payload) => {
                const newRequest = payload.new;
                const myUsername = App.ProfileState.getCurrentName().toLowerCase();
                if (newRequest.friend_email.split('@')[0].toLowerCase() === myUsername && newRequest.status === 'pending') {
                    const senderUsername = newRequest.user_email.split('@')[0];
                    if (!liveNotifications.some(n => n.friendRequestId === newRequest.id)) {
                        liveNotifications.unshift({ id: newRequest.id, friendRequestId: newRequest.id, icon: 'person_add', user: senderUsername, senderEmail: newRequest.user_email, type: 'friend_request', desc: `Mengajak Anda berteman.`, isUnread: true });
                        liveHeaderNotificationCount++; App.UI.refreshHeaderNotificationBadgeDOM();
                        App.Toast.show(`Permintaan pertemanan baru dari ${senderUsername}!`, "info");
                    }
                }
            }).subscribe();
        },
        subscribePosts() { 
            supabaseClient.channel('schema-db-changes').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, async (payload) => { 
                const newPost = payload.new; const myUsername = App.ProfileState.getCurrentName().toLowerCase(); 
                if (newPost.image === 'private_chat_type') { 
                    if (newPost.role.toLowerCase() === myUsername) { 
                        const searchFriendName = newPost.author.toLowerCase(); 
                        liveNotifications.unshift({ id: Date.now(), icon: 'chat', user: newPost.author, type: 'chat', desc: `Pesan baru dari ${newPost.author}`, isUnread: true }); 
                        liveHeaderNotificationCount++; App.UI.refreshHeaderNotificationBadgeDOM(); 
                        if (activeChatFriendName && activeChatFriendName.toLowerCase() === searchFriendName && document.getElementById('floating-chat-popup-box').classList.contains('active')) { 
                            App.Features.appendIncomingBubbleDOM(newPost.author, newPost.content); 
                        } else { 
                            unreadMessageCounters[searchFriendName] = (unreadMessageCounters[searchFriendName] || 0) + 1; 
                            App.UI.updateGlobalMessageNotificationBadgeCount(); 
                            App.Features.loadPopupFriendsListSidebar(); 
                        } 
                    } 
                    return; 
                } 
                if (window.location.hash === '#/feed') App.Features.renderPosts(); 
                if (window.location.hash === '#/explore') App.Features.renderExploreUsers(); 
            }).subscribe(); 
        } 
    }, 

    Auth: { 
        async checkCurrentSession() { 
            const { data } = await supabaseClient.auth.getSession(); 
            if(data?.session) { 
                localStorage.setItem('ns_logged_in', 'true'); localStorage.setItem('ns_user_email', data.session.user.email); 
                App.UI.syncGlobalAvatarAndName(); App.Auth.showApp(); App.Router.init(); App.Features.fetchIncomingFriendRequestsSync(); 
            } else { 
                localStorage.removeItem('ns_logged_in'); document.getElementById('auth-layout').style.display = 'flex'; 
            } 
        }, 
        toggleView(view) { 
            document.getElementById('login-view').style.display = view === 'login' ? 'block' : 'none'; 
            document.getElementById('signup-view').style.display = view === 'signup' ? 'block' : 'none'; 
        }, 
        async login(e) { 
            e.preventDefault(); const email = document.getElementById('login-email').value.trim(); const password = document.getElementById('login-pwd').value; 
            const { error } = await supabaseClient.auth.signInWithPassword({ email, password }); 
            if (error) alert(error.message); else this.checkCurrentSession();
        }, 
        async signup(e) { 
            e.preventDefault(); const email = document.getElementById('signup-email').value.trim(); const password = document.getElementById('signup-pwd').value; 
            const { error } = await supabaseClient.auth.signUp({ email, password }); 
            if (error) alert(error.message); else { alert("Pendaftaran sukses!"); this.toggleView('login'); }
        }, 
        async logout() { await supabaseClient.auth.signOut(); localStorage.clear(); window.location.reload(); }, 
        showApp() { document.getElementById('auth-layout').style.display = 'none'; document.getElementById('app-layout').style.display = 'block'; } 
    }, 

    Router: { 
        init() { window.addEventListener('hashchange', () => this.handleRoute()); if(!window.location.hash) window.location.hash = '#/feed'; this.handleRoute(); }, 
        navigate(path) { window.location.hash = `#/${path}`; App.UI.closeMobileSidebar(); }, 
        handleRoute() { 
            const hash = window.location.hash.replace('#/', '') || 'feed'; const viewport = document.getElementById('app-viewport'); if(!viewport) return;
            document.querySelectorAll('.menu-item, .bn-item').forEach(el => { if(el.getAttribute('data-route') === hash) el.classList.add('active'); else el.classList.remove('active'); }); 
            if(App.Views[hash]) { viewport.innerHTML = `<div class="view-container">${App.Views[hash]()}</div>`; if(App.ViewControllers[hash]) App.ViewControllers[hash](); } 
        } 
    }, 

    Navigation: { 
        menuConfig: [ 
            { id: 'feed', label: 'News Feed', icon: 'home', mobile: true }, 
            { id: 'explore', label: 'Cari Teman', icon: 'person_search', mobile: true }, 
            { id: 'chat_trigger', label: 'Pesan', icon: 'chat', mobile: true }, 
            { id: 'settings', label: 'Pengaturan', icon: 'settings', mobile: false } 
        ], 
        render() { 
            const side = document.getElementById('sidebar-menu-list'); const bottom = document.getElementById('bottom-nav-list'); if(!side || !bottom) return;
            side.innerHTML = this.menuConfig.map(m => m.id === 'chat_trigger' ? `<li><a class="menu-item" onclick="App.UI.toggleChatPopup(true)"><span class="material-symbols-outlined">${m.icon}</span><span class="menu-text">${m.label}</span></a></li>` : `<li><a class="menu-item" data-route="${m.id}" onclick="App.Router.navigate('${m.id}')"><span class="material-symbols-outlined">${m.icon}</span><span class="menu-text">${m.label}</span></a></li>`).join('') + `<li><a class="menu-item" style="color:var(--danger);" onclick="App.Auth.logout()"><span class="material-symbols-outlined">logout</span>Keluar</a></li>`; 
            bottom.innerHTML = this.menuConfig.filter(m => m.mobile).map(m => m.id === 'chat_trigger' ? `<a class="bn-item" onclick="App.UI.toggleChatPopup(true)"><span class="material-symbols-outlined">${m.icon}</span></a>` : `<a class="bn-item" data-route="${m.id}" onclick="App.Router.navigate('${m.id}')"><span class="material-symbols-outlined">${m.icon}</span></a>`).join(''); 
        } 
    }, 

    Views: { 
        feed() { return ` <div class="minimal-composer-bar" onclick="App.Features.openComposerModalPopupForm()"> <img src="${App.ProfileState.getCurrentAvatar()}" style="width:40px;height:40px;border-radius:50%;"> <div class="minimal-composer-input-mock">Apa yang Anda pikirkan?</div> </div> <div id="feed-stream"></div> `; }, 
        explore() { return ` <div class="glass-card"> <h2>Cari Koneksi & Teman</h2> <div id="explore-users-stream" class="user-grid"></div> </div> `; }, 
        settings() { return ` <div class="glass-card"> <h2>Pengaturan Akun</h2> <div class="form-group"><input type="text" class="form-input" id="settings-display-name" value="${App.ProfileState.getCurrentName()}"><label class="form-label">Nama Tampilan</label></div> <button class="btn btn-primary" onclick="App.Features.saveNameSettings()">Simpan</button></div> `; } 
    }, 

    ViewControllers: { feed() { App.Features.renderPosts(); }, explore() { App.Features.renderExploreUsers(); }, settings() {} }, 

    Features: { 
        async fetchIncomingFriendRequestsSync() {
            const myEmail = localStorage.getItem('ns_user_email') || ''; if(!myEmail) return;
            const { data } = await supabaseClient.from('friends').select('*').eq('friend_email', myEmail).eq('status', 'pending');
            if(data) { data.forEach(req => { const senderUsername = req.user_email.split('@')[0]; if (!liveNotifications.some(n => n.friendRequestId === req.id)) { liveNotifications.unshift({ id: req.id, friendRequestId: req.id, icon: 'person_add', user: senderUsername, senderEmail: req.user_email, type: 'friend_request', desc: `Mengajak Anda berteman.`, isUnread: true }); liveHeaderNotificationCount++; } }); App.UI.refreshHeaderNotificationBadgeDOM(); }
        },
        async acceptFriendRequestAction(notiId, dbRequestId, senderEmail) {
            const myEmail = localStorage.getItem('ns_user_email') || '';
            await supabaseClient.from('friends').update({ status: 'approved' }).eq('id', dbRequestId);
            await supabaseClient.from('friends').insert([{ user_email: myEmail, friend_email: senderEmail, status: 'approved' }]);
            liveNotifications = liveNotifications.filter(n => n.id !== notiId); App.Toast.show("Pertemanan dikonfirmasi!", "success"); App.Modal.close(); this.renderExploreUsers();
        },
        async rejectFriendRequestAction(notiId, dbRequestId) {
            await supabaseClient.from('friends').delete().eq('id', dbRequestId);
            liveNotifications = liveNotifications.filter(n => n.id !== notiId); App.Toast.show("Permintaan ditolak.", "warning"); App.Modal.close(); this.renderExploreUsers();
        },
        openComposerModalPopupForm() { 
            const html = ` <div style="text-align:left;"><textarea class="form-input" id="composer-text" placeholder="Tulis sesuatu..." style="min-height:100px; resize:none;"></textarea><div id="composer-upload-preview-area"></div><div style="display:flex; justify-content:space-between; margin-top:10px;"><input type="file" id="composer-img-input" accept="image/*" style="display:none;" onchange="App.Features.handleComposerImageSelection(event)"><button type="button" class="btn btn-secondary" onclick="document.getElementById('composer-img-input').click()">Pilih Gambar</button><button type="button" class="btn btn-primary" onclick="App.Features.createPost()">Kirim</button></div></div>`;
            App.Modal.open("Buat Postingan Baru", html); 
        }, 
        handleHeaderLiveSearchInput(event) { clearTimeout(searchTimeout); searchTimeout = setTimeout(() => { headerSearchFilterQueryString = event.target.value.trim().toLowerCase(); if(window.location.hash === '#/feed') this.renderPosts(); }, 500); }, 
        handleComposerImageSelection(event) { const file = event.target.files[0]; if (!file) return; composerAttachedImageBase64 = file; const previewArea = document.getElementById('composer-upload-preview-area'); if (previewArea) { previewArea.innerHTML = `<img src="${URL.createObjectURL(file)}" style="max-height:120px; margin-top:10px; border-radius:8px;">`; } }, 
        async createPost() { 
            const txt = document.getElementById('composer-text')?.value.trim(); let imageUrlResult = null;
            try { 
                if (composerAttachedImageBase64 instanceof File) {
                    const file = composerAttachedImageBase64; const fileName = `${Date.now()}_${file.name}`;
                    await supabaseClient.storage.from('posts-bucket').upload(fileName, file);
                    imageUrlResult = supabaseClient.storage.from('posts-bucket').getPublicUrl(fileName).data.publicUrl;
                }
                const myUsername = App.ProfileState.getCurrentName(); await supabaseClient.from('posts').insert([{ author: myUsername, content: txt, image: imageUrlResult, avatar: App.ProfileState.getCurrentAvatar() }]); 
                App.Modal.close(); App.Toast.show("Postingan dikirim!", "success"); this.renderPosts(); 
            } catch (err) { console.error(err); } 
        }, 
        async renderExploreUsers() { 
            const container = document.getElementById('explore-users-stream'); if(!container) return; 
            const myEmail = localStorage.getItem('ns_user_email') || ''; const myUsername = App.ProfileState.getCurrentName().toLowerCase(); 
            try { 
                const { data: incomingReq } = await supabaseClient.from('friends').select('id, user_email, status').eq('friend_email', myEmail);
                const { data: outgoingReq } = await supabaseClient.from('friends').select('id, friend_email, status').eq('user_email', myEmail); 
                const relationMap = {}; const dbIdMap = {};
                if(outgoingReq) { outgoingReq.forEach(f => { const username = f.friend_email.split('@')[0].toLowerCase(); relationMap[username] = f.status; dbIdMap[username] = f.id; }); } 
                if(incomingReq) { incomingReq.forEach(f => { const username = f.user_email.split('@')[0].toLowerCase(); if(relationMap[username] !== 'approved' && f.status === 'pending') { relationMap[username] = 'incoming_pending'; dbIdMap[username] = f.id; } }); }
                const { data: posts } = await supabaseClient.from('posts').select('author, avatar').not('author', 'is', null); 
                const uniqueUsers = []; const map = new Map(); 
                if(posts) { for (const item of posts) { const authorLower = item.author.toLowerCase(); if(authorLower !== myUsername && !map.has(authorLower)) { map.set(authorLower, true); uniqueUsers.push({ name: item.author, avatar: item.avatar }); } } } 
                container.innerHTML = uniqueUsers.map(u => { 
                    const username = u.name.toLowerCase(); const statusPertemanan = relationMap[username]; const targetDbId = dbIdMap[username]; let buttonHTML = ''; 
                    if (statusPertemanan === 'approved') buttonHTML = `<button class="btn btn-secondary" disabled>Teman</button>`; 
                    else if (statusPertemanan === 'pending') buttonHTML = `<button class="btn btn-secondary" disabled>Menunggu</button>`; 
                    else if (statusPertemanan === 'incoming_pending') buttonHTML = `<div style="display:flex; gap:4px;"><button class="btn btn-primary" onclick="App.Features.acceptFriendRequestAction(Date.now(), ${targetDbId}, '${username}@gmail.com')">Setujui</button><button class="btn btn-secondary" onclick="App.Features.rejectFriendRequestAction(Date.now(), ${targetDbId})">Tolak</button></div>`;
                    else buttonHTML = `<button class="btn btn-primary" onclick="App.Features.toggleFriendAction('${username}')">Tambah</button>`; 
                    return `<div class="user-follow-card"><h4>${u.name}</h4>${buttonHTML}</div>`; 
                }).join(''); 
            } catch(err) { console.error(err); } 
        }, 
        async toggleFriendAction(friendUsername) { const myEmail = localStorage.getItem('ns_user_email') || ''; await supabaseClient.from('friends').insert([{ user_email: myEmail, friend_email: friendUsername + "@gmail.com", status: 'pending' }]); this.renderExploreUsers(); }, 
        async loadFriendsCount() { 
            const myEmail = localStorage.getItem('ns_user_email') || ''; const { count } = await supabaseClient.from('friends').select('*', { count: 'exact', head: true }).eq('user_email', myEmail).eq('status', 'approved'); 
            if(document.getElementById('profile-friends-count')) document.getElementById('profile-friends-count').innerText = count || 0; 
        }, 
        async renderPosts() { 
            const stream = document.getElementById('feed-stream'); if(!stream) return; 
            try { 
                const { data: posts, error } = await supabaseClient.from('posts').select('*').order('created_at', { ascending: false }); if (error) throw error; 
                let filteredPosts = posts ? posts.filter(p => p.image !== 'private_chat_type') : []; 
                if(headerSearchFilterQueryString !== "") { filteredPosts = filteredPosts.filter(p => p.author.toLowerCase().includes(headerSearchFilterQueryString)); } 
                if (filteredPosts.length === 0) { stream.innerHTML = `<p style="text-align:center;padding:20px;">Linimasa kosong.</p>`; return; } 
                stream.innerHTML = filteredPosts.map(p => `<div class="glass-card"><div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;"><img src="${p.avatar || 'https://i.pravatar.cc/150?img=12'}" style="width:34px; height:34px; border-radius:50%;"><h4>${p.author}</h4></div><p>${p.content || ''}</p>${p.image ? `<img src="${p.image}" style="max-width:100%; border-radius:8px; margin-top:10px; display:block;">` : ''}</div>`).join(''); 
            } catch (err) { console.error(err); } 
        }, 
        loadPopupFriendsListSidebar() {
            const listContainer = document.getElementById('popup-friends-sidebar-items'); if(!listContainer) return; const myEmail = localStorage.getItem('ns_user_email') || ''; 
            supabaseClient.from('friends').select('friend_email').eq('user_email', myEmail).eq('status', 'approved').then(({data: friends}) => {
                if(!friends) return;
                listContainer.innerHTML = friends.map(f => { const name = f.friend_email.split('@')[0]; const isActive = activeChatFriendName === name ? 'active' : ''; return `<div class="popup-friend-item ${isActive}" onclick="App.Features.openSpecificFriendPopupObrolan('${f.friend_email}', '${name}')">${name}</div>`; }).join('');
            });
        },
        async openSpecificFriendPopupObrolan(friendEmail, friendName) {
            activeChatFriendEmail = friendEmail; activeChatFriendName = friendName; this.loadPopupFriendsListSidebar();
            const pane = document.getElementById('popup-chat-main-area-pane'); if(!pane) return;
            document.getElementById('popup-chat-header-title').innerText = `Obrolan: ${friendName}`;
            pane.innerHTML = `<div id="popup-msg-stream-viewport" style="flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:8px; padding:10px;"></div><div class="popup-chat-input-row"><input type="text" class="form-input" id="popup-chat-input-field" placeholder="Tulis pesan..." onkeypress="if(event.key==='Enter') App.Features.sendPopupChatCloudAction()"><button class="btn btn-primary" onclick="App.Features.sendPopupChatCloudAction()">Kirim</button></div>`;
            const { data: messages } = await supabaseClient.from('posts').select('*').eq('image', 'private_chat_type').order('created_at', { ascending: true });
            const view = document.getElementById('popup-msg-stream-viewport');
            if(messages && view) {
                const myName = App.ProfileState.getCurrentName();
                view.innerHTML = messages.filter(m => (m.author === myName && m.role === friendName) || (m.author === friendName && m.role === myName)).map(m => `<div class="bubble ${m.author === myName ? 'out' : 'in'}"><span>${m.content}</span></div>`).join('');
                view.scrollTop = view.scrollHeight;
            }
        },
        async sendPopupChatCloudAction() {
            const input = document.getElementById('popup-chat-input-field'); if(!input || !input.value.trim()) return;
            const myName = App.ProfileState.getCurrentName();
            await supabaseClient.from('posts').insert([{ author: myName, role: activeChatFriendName, content: input.value.trim(), image: 'private_chat_type' }]);
            const view = document.getElementById('popup-msg-stream-viewport');
            if(view) { const d = document.createElement('div'); d.className='bubble out'; d.innerHTML=`<span>${input.value.trim()}</span>`; view.appendChild(d); view.scrollTop = view.scrollHeight; }
            input.value = '';
        },
        appendIncomingBubbleDOM(senderName, msg) { const view = document.getElementById('popup-msg-stream-viewport'); if(view) { const d = document.createElement('div'); d.className='bubble in'; d.innerHTML=`<span>${msg}</span>`; view.appendChild(d); view.scrollTop = view.scrollHeight; } },
        showNotifications() { 
            liveHeaderNotificationCount = 0; this.refreshHeaderNotificationBadgeDOM(); if (liveNotifications.length === 0) { App.Modal.open("Notifikasi", `<p>Tidak ada pemberitahuan baru.</p>`); return; } 
            const notiHTML = liveNotifications.map(item => { let actionsHTML = item.type === 'friend_request' ? `<div style="display:flex; gap:8px; margin-top:10px;"><button class="btn btn-primary" onclick="App.Features.acceptFriendRequestAction(${item.id}, ${item.friendRequestId}, '${item.senderEmail}')">Setujui</button><button class="btn btn-secondary" onclick="App.Features.rejectFriendRequestAction(${item.id}, ${item.friendRequestId})">Tolak</button></div>` : ''; return `<div class="notification-item-card"><div><strong>${item.user}</strong><p>${item.desc}</p>${actionsHTML}</div></div>`; }).join(''); 
            App.Modal.open("Notifikasi Workspace", notiHTML); 
        },
        saveNameSettings() { const val = document.getElementById('settings-display-name')?.value.trim(); if(val) { localStorage.setItem('ns_display_name', val); App.Router.navigate('feed'); } }
    }, 

    UI: { 
        bindGlobalEvents() { 
            window.addEventListener('hashchange', () => App.Router.handleRoute()); 
            document.getElementById('btn-theme')?.addEventListener('click', () => { const current = document.documentElement.getAttribute('data-theme'); document.documentElement.setAttribute('data-theme', current === 'dark' ? 'light' : 'dark'); });
            document.getElementById('btn-refresh')?.addEventListener('click', () => { App.Router.handleRoute(); App.Toast.show("Diperbarui", "success"); });
        }, 
        closeMobileSidebar() { document.getElementById('app-layout')?.classList.remove('sidebar-mobile-open'); }, 
        toggleChatPopup(shouldOpen) { const el = document.getElementById('floating-chat-popup-box'); if(el) { el.style.display = shouldOpen ? 'block' : 'none'; if(shouldOpen) App.Features.loadPopupFriendsListSidebar(); } }, 
        refreshHeaderNotificationBadgeDOM() { const b = document.getElementById('noti-badge'); if (b) { b.innerText = liveHeaderNotificationCount; b.style.display = liveHeaderNotificationCount > 0 ? 'flex' : 'none'; } }, 
        updateGlobalMessageNotificationBadgeCount() {}, syncGlobalAvatarAndName() { const name = App.ProfileState.getCurrentName(); const sidebarNameEl = document.getElementById('sidebar-user-name'); if (sidebarNameEl) sidebarNameEl.innerText = name; }
    }, 
    Theme: { init() { document.documentElement.setAttribute('data-theme', localStorage.getItem('ns_theme') || 'light'); } }, 
    Modal: { open(t, b) { document.getElementById('modal-title').innerText=t; document.getElementById('modal-body').innerHTML=b; document.getElementById('global-modal').classList.add('active'); }, close() { document.getElementById('global-modal').classList.remove('active'); } }, 
    Toast: { show(m) { const c = document.getElementById('toast-container'); if(!c) return; const b = document.createElement('div'); b.className = 'toast'; b.innerText = m; c.appendChild(b); setTimeout(() => { b.remove(); }, 3000); } } 
}; 
document.addEventListener('DOMContentLoaded', () => App.init());
