const SUPABASE_URL = 'https://waaufoxlimqtesmmjhyw.supabase.co'; 
const SUPABASE_KEY = 'sb_publishable_X6icNByv3YFbekorwJ6kSw_SX0XUFM8'; 
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY); 

// Variabel Global Aplikasi
let liveNotifications = [ 
    { id: 1, icon: 'shield_person', user: 'Super Admin', type: 'admin', desc: 'Sistem Workspace Tech Social versi 2.4 berhasil diperbarui ke server cloud.', isUnread: true }
]; 
let activeChatFriendEmail = null; 
let activeChatFriendName = null; 
let composerAttachedImageBase64 = null; // Menampung objek File asli untuk diunggah ke Storage
let composerAttachedFileBase64 = null; 
let composerAttachedFileName = "Dokumen.bin"; 
let unreadMessageCounters = {}; 
let liveHeaderNotificationCount = 1; 
let headerSearchFilterQueryString = ""; 
let searchTimeout = null; // Timer untuk Debounce pencarian
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
                    const myUsername = App.ProfileState.getCurrentName().toLowerCase();
                    if (newRequest.friend_email.split('@')[0].toLowerCase() === myUsername && newRequest.status === 'pending') {
                        const senderUsername = newRequest.user_email.split('@')[0];
                        const exists = liveNotifications.some(n => n.friendRequestId === newRequest.id);
                        if (!exists) {
                            liveNotifications.unshift({
                                id: newRequest.id,
                                friendRequestId: newRequest.id,
                                icon: 'person_add',
                                user: senderUsername,
                                senderEmail: newRequest.user_email,
                                type: 'friend_request',
                                desc: `Mengajak Anda berteman.`,
                                isUnread: true
                            });
                            liveHeaderNotificationCount++;
                            App.UI.refreshHeaderNotificationBadgeDOM();
                            App.Toast.show(`Permintaan pertemanan baru dari ${senderUsername}!`, "info");
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
                const myUsername = App.ProfileState.getCurrentName().toLowerCase(); 
                
                if (newPost.image === 'private_chat_type') { 
                    if (newPost.role.toLowerCase() === myUsername) { 
                        const searchFriendName = newPost.author.toLowerCase(); 
                        liveNotifications.unshift({ id: Date.now(), icon: 'chat', user: newPost.author, type: 'chat', desc: `Mengirimkan sebuah pesan pribadi baru: "${newPost.content.substring(0, 30)}..."`, isUnread: true }); 
                        liveHeaderNotificationCount++; 
                        App.UI.refreshHeaderNotificationBadgeDOM(); 
                        if (activeChatFriendName.toLowerCase() === searchFriendName && document.getElementById('floating-chat-popup-box').classList.contains('active')) { 
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
                
                if (newPost.author.toLowerCase() !== myUsername) { 
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
            const email = document.getElementById('login-email').value.trim(); 
            const password = document.getElementById('login-pwd').value; 
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
                alert("Gagal Masuk!\nAlasan: " + error.message); 
            } 
        }, 
        async signup(e) { 
            if (e && e.preventDefault) e.preventDefault(); 
            const email = document.getElementById('signup-email').value.trim(); 
            const password = document.getElementById('signup-pwd').value; 
            const btn = e && e.target ? e.target.querySelector('button[type="submit"]') : null; 
            if (btn) App.UI.showLoadingBtn(btn); 
            try { 
                const { error } = await supabaseClient.auth.signUp({ email, password }); 
                if (error) throw error; 
                App.Modal.open("Pendaftaran Berhasil", "Akun Anda telah terdaftar. Silakan cek email Anda."); 
                this.toggleView('login'); 
            } catch (error) { 
                alert("Gagal Mendaftar!\nAlasan: " + error.message); 
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
            } 
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
            const side = document.getElementById('sidebar-menu-list'); 
            const bottom = document.getElementById('bottom-nav-list'); 
            if(!side || !bottom) return;
            
            side.innerHTML = this.menuConfig.map(m => {
                if(m.id === 'chat_trigger') {
                    return `<li><a class="menu-item ripple-btn" onclick="App.UI.toggleChatPopup(true)"><span class="material-symbols-outlined">${m.icon}</span><span class="menu-text">${m.label}</span></a></li>`;
                }
                return `<li><a class="menu-item ripple-btn" data-route="${m.id}" onclick="App.Router.navigate('${m.id}')"><span class="material-symbols-outlined">${m.icon}</span><span class="menu-text">${m.label}</span></a></li>`;
            }).join('') + `<li style="margin-top: auto;"><a class="menu-item ripple-btn" style="color: var(--danger);" onclick="App.Auth.logout()"><span class="material-symbols-outlined">logout</span><span class="menu-text">Keluar</span></a></li>`; 
            
            bottom.innerHTML = this.menuConfig.filter(m => m.mobile).map(m => {
                if(m.id === 'chat_trigger') {
                    return `<a class="bn-item ripple-btn" onclick="App.UI.toggleChatPopup(true)"><span class="material-symbols-outlined">${m.icon}</span></a>`;
                }
                return `<a class="bn-item ripple-btn" data-route="${m.id}" onclick="App.Router.navigate('${m.id}')"><span class="material-symbols-outlined">${m.icon}</span></a>`;
            }).join(''); 
        } 
    }, 

    Views: { 
        feed() { 
            const currentAvatar = App.ProfileState.getCurrentAvatar(); 
            return ` <div class="minimal-composer-bar" onclick="App.Features.openComposerModalPopupForm()"> <img src="${currentAvatar}" class="user-avatar" style="width:40px; height:40px;"> <div class="minimal-composer-input-mock">Apa yang Anda pikirkan?</div> </div> <div id="feed-stream"></div> `; 
        }, 
        explore() { 
            return ` <div class="glass-card"> <h2>Cari Koneksi & Teman</h2> <div id="explore-users-stream" class="user-grid"></div> </div> `; 
        }, 
        profil() { 
            const currentName = App.ProfileState.getCurrentName(); 
            const currentAvatar = App.ProfileState.getCurrentAvatar(); 
            return ` <div class="glass-card profile-info-card" style="text-align:center; padding:20px;"> <img src="${currentAvatar}" class="profile-avatar-large" style="width:100px; height:100px; border-radius:50%;"> <h2>${currentName}</h2> <div class="profile-stats"> <div><span id="profile-friends-count">0</span> Teman</div> </div> </div> `; 
        }, 
        settings() { 
            const currentName = App.ProfileState.getCurrentName(); 
            return ` <div class="glass-card"> <h2>Pengaturan Akun</h2> <div class="form-group"><input type="text" class="form-input" id="settings-display-name" value="${currentName}"><label class="form-label">Nama Tampilan</label></div> <button class="btn btn-primary" onclick="App.Features.saveNameSettings()">Simpan</button> </div> `; 
        } 
    }, 

    ViewControllers: { 
        feed() { App.Features.renderPosts(); }, 
        explore() { App.Features.renderExploreUsers(); }, 
        profil() { App.Features.loadFriendsCount(); } 
    }, 

    Features: { 
        async fetchIncomingFriendRequestsSync() {
            const myEmail = localStorage.getItem('ns_user_email') || '';
            if(!myEmail) return;
            try {
                const { data } = await supabaseClient.from('friends').select('*').eq('friend_email', myEmail).eq('status', 'pending');
                if(data) {
                    data.forEach(req => {
                        const senderUsername = req.user_email.split('@')[0];
                        if (!liveNotifications.some(n => n.friendRequestId === req.id)) {
                            liveNotifications.unshift({ id: req.id, friendRequestId: req.id, icon: 'person_add', user: senderUsername, senderEmail: req.user_email, type: 'friend_request', desc: `Mengajak Anda berteman.`, isUnread: true });
                            liveHeaderNotificationCount++;
                        }
                    });
                    App.UI.refreshHeaderNotificationBadgeDOM();
                }
            } catch(e) {}
        },

        async acceptFriendRequestAction(notiId, dbRequestId, senderUsername) {
            const myEmail = localStorage.getItem('ns_user_email') || '';
            try {
                await supabaseClient.from('friends').update({ status: 'approved' }).eq('id', dbRequestId);
                await supabaseClient.from('friends').insert([{ user_email: myEmail, friend_email: senderUsername + "@workspace", status: 'approved' }]);
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
                App.Toast.show("Permintaan ditolak.", "warning");
                App.Modal.close();
                this.renderExploreUsers();
            } catch(e) { console.error(e); }
        },

        openComposerModalPopupForm() { 
            const currentName = App.ProfileState.getCurrentName(); 
            composerAttachedImageBase64 = null; 
            const popupFormHTML = ` <div style="text-align:left;"> <textarea class="form-input" id="composer-text" placeholder="Apa yang Anda pikirkan, ${currentName}?" style="min-height:100px; resize:none;"></textarea> <div id="composer-upload-preview-area" style="margin:10px 0;"></div> <div style="display:flex; justify-content:space-between; align-items:center;"> <input type="file" id="composer-img-input" accept="image/*" style="display:none;" onchange="App.Features.handleComposerImageSelection(event)"> <button type="button" class="btn btn-secondary" onclick="document.getElementById('composer-img-input').click()">Pilih Gambar</button> <button type="button" class="btn btn-primary" onclick="App.Features.createPost()">Kirim</button> </div> </div> `; 
            App.Modal.open("Buat Postingan", popupFormHTML); 
        }, 

        handleHeaderLiveSearchInput(event) { 
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                headerSearchFilterQueryString = event.target.value.trim().toLowerCase(); 
                if(window.location.hash === '#/feed') this.renderPosts(); 
            }, 500);
        }, 

        handleComposerImageSelection(event) { 
            const file = event.target.files[0]; 
            if (!file) return; 
            composerAttachedImageBase64 = file; 
            const previewArea = document.getElementById('composer-upload-preview-area'); 
            if (previewArea) { 
                const objectUrl = URL.createObjectURL(file);
                previewArea.innerHTML = `<img src="${objectUrl}" style="max-height:100px; border-radius:8px;">`; 
            } 
        }, 

        async createPost() { 
            const txt = document.getElementById('composer-text')?.value.trim(); 
            let imageUrlResult = null;
            try { 
                if (composerAttachedImageBase64 instanceof File) {
                    const file = composerAttachedImageBase64;
                    const fileName = `${Date.now()}_${file.name}`;
                    const { error: storageError } = await supabaseClient.storage.from('posts-bucket').upload(fileName, file);
                    if (storageError) throw storageError;
                    imageUrlResult = supabaseClient.storage.from('posts-bucket').getPublicUrl(fileName).data.publicUrl;
                }
                const myUsername = App.ProfileState.getCurrentName(); 
                const myAvatar = App.ProfileState.getCurrentAvatar(); 
                await supabaseClient.from('posts').insert([{ author: myUsername, avatar: myAvatar, content: txt, image: imageUrlResult, likes: 0 }]); 
                App.Modal.close(); 
                App.Toast.show("Berhasil posting!", "success"); 
                this.renderPosts(); 
            } catch (err) { console.error(err); } 
        }, 

        async renderExploreUsers() { 
            const container = document.getElementById('explore-users-stream'); if(!container) return; 
            const myEmail = localStorage.getItem('ns_user_email') || ''; 
            const myUsername = App.ProfileState.getCurrentName().toLowerCase(); 
            try { 
                const { data: incomingFriends } = await supabaseClient.from('friends').select('id, user_email, status').eq('friend_email', myEmail);
                const { data: outgoingFriends } = await supabaseClient.from('friends').select('id, friend_email, status').eq('user_email', myEmail); 
                
                const statusMap = {}; const dbIdMap = {};
                if(outgoingFriends) { outgoingFriends.forEach(f => { const user = f.friend_email.split('@')[0].toLowerCase(); statusMap[user] = f.status; dbIdMap[user] = f.id; }); } 
                if(incomingFriends) { incomingFriends.forEach(f => { const user = f.user_email.split('@')[0].toLowerCase(); if(statusMap[user] !== 'approved' && f.status === 'pending') { statusMap[user] = 'incoming_pending'; dbIdMap[user] = f.id; } }); }
                
                const { data: posts } = await supabaseClient.from('posts').select('author, avatar').not('author', 'is', null); 
                const uniqueUsers = []; const map = new Map(); 
                if(posts) { 
                    for (const item of posts) { 
                        const authorLower = item.author.toLowerCase();
                        if(authorLower !== myUsername && !map.has(authorLower)) { map.set(authorLower, true); uniqueUsers.push({ name: item.author, avatar: item.avatar || 'https://i.pravatar.cc/150?img=11' }); } 
                    } 
                } 
                container.innerHTML = uniqueUsers.map(u => { 
                    const username = u.name.toLowerCase(); const status = statusMap[username]; const dbId = dbIdMap[username];
                    let btn = `<button class="btn btn-primary" onclick="App.Features.toggleFriendAction('${username}', 'none')">Tambah</button>`; 
                    if (status === 'approved') btn = `<button class="btn btn-secondary" disabled>Teman</button>`; 
                    else if (status === 'pending') btn = `<button class="btn btn-secondary" disabled>Menunggu</button>`; 
                    else if (status === 'incoming_pending') btn = `<div style="display:flex; gap:4px;"><button class="btn btn-primary" onclick="App.Features.acceptFriendRequestAction(Date.now(), ${dbId}, '${username}')">Setujui</button><button class="btn btn-secondary" onclick="App.Features.rejectFriendRequestAction(Date.now(), ${dbId})">Tolak</button></div>`;
                    return `<div class="user-follow-card"><h4>${u.name}</h4>${btn}</div>`; 
                }).join(''); 
            } catch(err) { console.error(err); } 
        }, 

        async toggleFriendAction(username, status) { 
            const myEmail = localStorage.getItem('ns_user_email'); 
            await supabaseClient.from('friends').insert([{ user_email: myEmail, friend_email: username + "@workspace", status: 'pending' }]); 
            this.renderExploreUsers(); 
        }, 

        async loadFriendsCount() { 
            const myEmail = localStorage.getItem('ns_user_email'); 
            const { count } = await supabaseClient.from('friends').select('*', { count: 'exact' }).eq('user_email', myEmail).eq('status', 'approved'); 
            if(document.getElementById('profile-friends-count')) document.getElementById('profile-friends-count').innerText = count || 0; 
        }, 

        async renderPosts() { 
            const stream = document.getElementById('feed-stream'); if(!stream) return; 
            const myCurrentName = App.ProfileState.getCurrentName().toLowerCase(); 
            try { 
                const { data: posts, error } = await supabaseClient.from('posts').select('*').order('created_at', { ascending: false }); 
                if (error) throw error; 
                let filteredPosts = posts ? posts.filter(p => p.image !== 'private_chat_type') : []; 
                if (filteredPosts.length === 0) { 
                    stream.innerHTML = `<p style="text-align:center; padding:20px;">Linimasa kosong.</p>`; return; 
                } 
                stream.innerHTML = filteredPosts.map(p => { 
                    let mediaHTML = p.image ? `<img src="${p.image}" class="post-attached-image" style="max-width:100%; border-radius:8px; margin-top:10px;">` : ''; 
                    let parsedComments = []; try { if(p.role && p.role.startsWith('[')) parsedComments = JSON.parse(p.role); } catch(e){}
                    let commentsHTML = parsedComments.map(c => `<div><strong>${c.user}</strong>: ${c.text}</div>`).join('');
                    return `
                        <div class="glass-card post-card" style="margin-bottom:15px; padding:15px;">
                            <div style="display:flex; align-items:center; gap:10px;">
                                <img src="${p.avatar || 'https://i.pravatar.cc/150?img=12'}" style="width:34px; height:34px; border-radius:50%;">
                                <h4>${p.author}</h4>
                            </div>
                            <p style="margin-top:10px;">${p.content || ''}</p>
                            ${mediaHTML}
                            <div style="margin-top:10px; display:flex; gap:15px; font-size:0.85rem;">
                                <span onclick="App.Features.toggleLike(${p.id}, ${p.likes || 0})">👍 ${p.likes || 0}</span>
                                <span onclick="App.Features.togglePostCommentsVisibility(${p.id})">💬 ${parsedComments.length} Komentar</span>
                            </div>
                            <div id="comments-section-container-${p.id}" style="display:none; margin-top:10px; background:rgba(0,0,0,0.02); padding:10px; border-radius:8px;">
                                <div class="comments-stream">${commentsHTML}</div>
                                <div style="display:flex; gap:5px; margin-top:10px;">
                                    <input type="text" class="form-input" placeholder="Tulis komentar..." id="comment-input-field-${p.id}" style="margin:0;">
                                    <button class="btn btn-primary" onclick="App.Features.submitPostCommentAction(${p.id})">Kirim</button>
                                </div>
                            </div>
                        </div>`; 
                }).join(''); 
            } catch (err) { console.error(err); } 
        }, 

        async toggleLike(id, currentLikes) { 
            await supabaseClient.from('posts').update({ likes: currentLikes + 1 }).eq('id', id); 
            this.renderPosts(); 
        }, 

        togglePostCommentsVisibility(postId) { 
            const commentSection = document.getElementById(`comments-section-container-${postId}`); 
            if (commentSection) { 
                commentSection.style.display = commentSection.style.display === 'none' ? 'block' : 'none'; 
            } 
        }, 

        async submitPostCommentAction(postId) { 
            const input = document.getElementById(`comment-input-field-${postId}`); 
            if (!input || !input.value.trim()) return; 
            const commentText = input.value.trim(); 
            const currentUserName = App.ProfileState.getCurrentName(); 
            try { 
                const { data: postData } = await supabaseClient.from('posts').select('role').eq('id', postId).single(); 
                let commentArray = []; 
                try { if(postData && postData.role && postData.role.startsWith('[')) commentArray = JSON.parse(postData.role); } catch(ex) {} 
                commentArray.push({ user: currentUserName, text: commentText, date: Date.now() }); 
                await supabaseClient.from('posts').update({ role: JSON.stringify(commentArray) }).eq('id', postId); 
                input.value = ''; this.renderPosts(); 
            } catch(err) { console.error(err); } 
        },

        loadPopupFriendsListSidebar() {},
        showNotifications() {
            if(liveNotifications.length === 0) return alert("Tidak ada notifikasi.");
            let list = liveNotifications.map(n => `<div><strong>${n.user}</strong>: ${n.desc}</div>`).join('');
            App.Modal.open("Notifikasi", list);
        },
        saveNameSettings() {
            const val = document.getElementById('settings-display-name')?.value.trim();
            if(val) { localStorage.setItem('ns_display_name', val); App.Router.navigate('profil'); }
        }
    }, 

    UI: { 
        renderGlobalBannerAdIfExists() {}, 
        bindGlobalEvents() { 
            document.getElementById('btn-refresh')?.addEventListener('click', () => { App.Router.handleRoute(); }); 
            document.getElementById('btn-theme')?.addEventListener('click', () => { App.Theme.toggle(); });
        }, 
        closeMobileSidebar() {}, 
        toggleChatPopup(shouldOpen) { if(shouldOpen) alert("Fitur chat pop-up/pesan dibuka."); }, 
        refreshHeaderNotificationBadgeDOM() { 
            const b = document.getElementById('noti-badge'); 
            if(b) { b.innerText = liveHeaderNotificationCount; b.style.display = liveHeaderNotificationCount > 0 ? 'flex' : 'none'; }
        }, 
        updateGlobalMessageNotificationBadgeCount() {}, 
        syncGlobalAvatarAndName() {} 
    }, 
    Theme: { init() {}, toggle() { alert("Fitur ganti tema."); } }, 
    Clock: { start() {} }, 
    Network: { listen() {} }, 
    Modal: { 
        open(t, b) { 
            const title = document.getElementById('modal-title');
            const body = document.getElementById('modal-body');
            const modal = document.getElementById('global-modal');
            if(title && body && modal) { title.innerText=t; body.innerHTML=b; modal.classList.add('active'); }
        }, 
        close() { document.getElementById('global-modal')?.classList.remove('active'); } 
    }, 
    Toast: { show(m) { alert(m); } } 
}; 

document.addEventListener('DOMContentLoaded', () => App.init());
