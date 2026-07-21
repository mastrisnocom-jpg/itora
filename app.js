const SUPABASE_URL = 'https://acgyaugbyatlwkfwagyy.supabase.co';
const SUPABASE_KEY = 'sb_publishable_1MQZs2Z7yOjywmGpYOk_Uw_Y9wZ7CXk'; 
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const DEFAULT_AVATAR_IMAGE = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iIzE4NzdGMiI+PHBhdGggZD0iTTEyIDJDNi44OCAyIDIgNi44OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40QBITCDEwLVNEUy41MiAy IDEyIDJ6bTAgNGMxLjkzIDAgMy41IDEuNTcgMy41IDMuNVMxMy45MyAxMyAxMiAxM3MtMy41LTEuNTctMy41LTMuNVMxMC4wNyA2 IDEyIDZ6bTAgMTRjLTIuMDMgMC0zLjguODUtNS4wNS0yLjIuMDMtMS42OCAzLjM3LTIuNiA1LjA1LTIuNnM1LjAyLjkyIDUuMDUgMi42QzE1LjggMTkuMTUgMTQuMDMgMjAgMTIgMjB6Ii8+PC9zdmc+';
const DEFAULT_BANNER_IMAGE = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=1000&auto=format&fit=crop';

let liveNotifications = [];
let activeChatFriendEmail = localStorage.getItem('ns_active_chat_email') || null;
let activeChatFriendName = localStorage.getItem('ns_active_chat_name') || null;

let composerSelectedFile = null; 
let unreadMessageCounters = {}; 
let liveHeaderNotificationCount = 0; 
let headerSearchFilterQueryString = ""; 

let currentComposerBgColor = "#ffffff";
let activeComposerLocation = "";

let activeBottomSheetPostId = null;
let activeReplyTargetCommentId = null;
let activeReplyTargetUser = null;

let deferredPwaPrompt = null;

let feedCurrentPage = 0;
const FEED_PAGE_SIZE = 10;
let feedHasMorePosts = true;
let feedIsLoadingMore = false;

window.mySupabaseProfileCache = {
    avatar_url: DEFAULT_AVATAR_IMAGE,
    banner_url: DEFAULT_BANNER_IMAGE,
    display_name: '',
    bio_status: 'Hallo👋',
    category: 'Profil · Kreator digital',
    domisili: 'Bandar Lampung',
    pendidikan: 'SMA Negri 1 kalirejo',
    gender: 'Perempuan',
    birth_date: ''
};

window.userFriendsList = [];
window.registeredUsersList = [];
window.profilesCacheMap = {};

if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
    Notification.requestPermission();
}

function triggerNativeDevicePushNotification(title, bodyText) {
    if ('Notification' in window && Notification.permission === 'granted') {
        try {
            new Notification(title, {
                body: bodyText,
                icon: './manifest.json'
            });
        } catch(e) {}
    }
}

if (localStorage.getItem('ns_logged_in') === 'true') {
    const appLayout = document.getElementById('app-layout');
    if (appLayout) {
        appLayout.style.display = 'grid';
        appLayout.style.opacity = '1';
        appLayout.classList.add('active');
    }
} else {
    const authLayout = document.getElementById('auth-layout');
    if (authLayout) authLayout.style.display = 'flex';
}

function sanitizeHTML(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/* ==========================================================================
   HITUNG HARI PASARAN JAWA (WETON)
   ========================================================================== */
function getWetonJawa(dateInput) {
    if (!dateInput) return "";
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return "";

    const hariIndo = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    const pasaranIndo = ["Legi", "Pahing", "Pon", "Wage", "Kliwon"];

    const namaHari = hariIndo[date.getDay()];
    
    // Anchor Date: 1 Jan 1970 = Kamis Wage (Index Pasaran 3)
    const utcMs = date.getTime() + (date.getTimezoneOffset() * 60000);
    const targetDateLocal = new Date(utcMs + (7 * 3600000)); 
    
    const dayDiff = Math.floor(targetDateLocal.getTime() / (24 * 3600 * 1000));
    const pasaranIdx = (dayDiff + 3) % 5;
    const positivePasaranIdx = (pasaranIdx + 5) % 5;
    
    return `${namaHari} ${pasaranIndo[positivePasaranIdx]}`;
}

/* ==========================================================================
   CEK ULANG TAHUN PENGGUNA (🎂)
   ========================================================================== */
function isBirthdayToday(birthDateStr) {
    if (!birthDateStr) return false;
    const birth = new Date(birthDateStr);
    if (isNaN(birth.getTime())) return false;
    
    const today = new Date();
    return today.getDate() === birth.getDate() && today.getMonth() === birth.getMonth();
}

function compressImageNative(file, maxWidth = 1080, quality = 0.75) {
    return new Promise((resolve) => {
        if (!file || !file.type.startsWith('image/')) return resolve(file);
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    if (!blob) return resolve(file);
                    const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, ".jpg"), {
                        type: 'image/jpeg',
                        lastModified: Date.now()
                    });
                    resolve(compressedFile);
                }, 'image/jpeg', quality);
            };
            img.onerror = () => resolve(file);
        };
        reader.onerror = () => resolve(file);
    });
}

function escapeJSString(str) {
    return String(str || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

async function fetchRegisteredUsersListFromSupabase() {
    try {
        const { data } = await supabaseClient.from('profiles').select('display_name, avatar_url, birth_date');
        if (data) {
            window.registeredUsersList = data.map(u => u.display_name).filter(Boolean);
            data.forEach(p => {
                if (p.display_name) {
                    window.profilesCacheMap[p.display_name.toLowerCase()] = p;
                }
            });
        }
    } catch(e) {
        window.registeredUsersList = [];
    }
}

function parseMentionsToClickableLinks(text) {
    if (!text) return "";
    const safeText = sanitizeHTML(text);
    return safeText.replace(/@([a-zA-Z0-9_]+)/g, function(match, username) {
        const safeUser = escapeJSString(username);
        const isRegistered = window.registeredUsersList && window.registeredUsersList.some(u => u.toLowerCase() === username.toLowerCase());
        
        if (isRegistered) {
            return `<span class="user-mention-link" onclick="App.Features.closeCommentsBottomSheet(); App.Router.navigate('profil?name=${encodeURIComponent(safeUser)}')">@${username}</span>`;
        }
        return `@${username}`;
    });
}

async function detectAndNotifyMentions(textContext, actionType = 'mention', postId = null) {
    if (!textContext) return;
    const matches = textContext.match(/@([a-zA-Z0-9_]+)/g);
    if (matches && matches.length > 0) {
        const myName = App.ProfileState.getCurrentName();
        const uniqueMentionedUsers = [...new Set(matches.map(m => m.replace('@', '')))];
        
        for (const targetUser of uniqueMentionedUsers) {
            const isRegistered = window.registeredUsersList && window.registeredUsersList.some(u => u.toLowerCase() === targetUser.toLowerCase());
            if (isRegistered && targetUser.toLowerCase() !== myName.toLowerCase()) {
                const matchedProfile = window.registeredUsersList.find(u => u.toLowerCase() === targetUser.toLowerCase());
                await App.Features.pushCloudNotificationPayload(matchedProfile || targetUser, 'mention', `menyebut (@mention) Anda dalam sebuah kiriman.`, postId);
            }
        }
    }
}

const App = {
    async init() {
        this.PWA.init();
        this.Theme.init();
        this.Network.listen();
        this.UI.bindGlobalEvents();
        this.Navigation.render();
        await this.Auth.checkCurrentSession();
        await fetchRegisteredUsersListFromSupabase();
        this.Realtime.subscribeRealtimeChannels();
        this.Features.fetchMyFriendsData(); 
        this.Features.initCommentsSwipeToCloseGesture();
        this.UI.initInfiniteScrollListener();
        this.UI.initBackButtonCloseSystem();
        this.Call.init();
        
        App.UI.renderGlobalBannerAdIfExists();

        setInterval(() => {
            if (window.location.hash.includes('#/feed')) {
                document.querySelectorAll('.post-live-time-tracker').forEach(el => {
                    const ts = el.getAttribute('data-timestamp');
                    if (ts) el.innerText = App.UI.calculateRelativeTimeAgo(ts);
                });
            }
            if (window.location.hash.includes('#/notifications')) {
                App.Features.renderNotificationsView();
            }
        }, 5000);
    },

    PWA: {
        init() {
            this.registerServiceWorker();
            this.checkStrictInstallationStatus();
        },
        registerServiceWorker() {
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.register('./sw.js')
                    .then(() => console.log("PWA Service Worker terdaftar!"))
                    .catch((err) => console.log("Gagal mendaftarkan Service Worker:", err));
            }
        },
        checkStrictInstallationStatus() {
            const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
                || window.navigator.standalone === true 
                || window.location.search.includes('utm_source=pwa');

            const isAlreadyInstalled = localStorage.getItem('pwa_is_installed') === 'true';

            if (isStandalone || isAlreadyInstalled) {
                this.dismissInstallPrompt();
            } else {
                this.listenInstallPrompt();
            }

            window.addEventListener('appinstalled', () => {
                localStorage.setItem('pwa_is_installed', 'true');
                this.dismissInstallPrompt();
            });
        },
        listenInstallPrompt() {
            window.addEventListener('beforeinstallprompt', (e) => {
                e.preventDefault();
                const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
                if (isStandalone || localStorage.getItem('pwa_is_installed') === 'true') {
                    this.dismissInstallPrompt();
                    return;
                }

                deferredPwaPrompt = e;
                const banner = document.getElementById('pwa-install-banner-node');
                if (banner) banner.classList.add('active');
            });
        },
        triggerInstall() {
            if (deferredPwaPrompt) {
                deferredPwaPrompt.prompt();
                deferredPwaPrompt.userChoice.then((choiceResult) => {
                    if (choiceResult.outcome === 'accepted') {
                        localStorage.setItem('pwa_is_installed', 'true');
                    }
                    deferredPwaPrompt = null;
                    this.dismissInstallPrompt();
                });
            }
        },
        dismissInstallPrompt() {
            const banner = document.getElementById('pwa-install-banner-node');
            if (banner) {
                banner.classList.remove('active');
                banner.style.display = 'none';
            }
        }
    },

    Call: {
        peerConnection: null,
        localStream: null,
        remoteStream: null,
        callChannel: null,
        currentCaller: null,
        pendingOffer: null,

        rtcConfig: {
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        },

        init() {
            const myName = App.ProfileState.getCurrentName();
            if (!myName) return;

            this.callChannel = supabaseClient.channel(`call_signaling_${myName.toLowerCase()}`);
            this.callChannel
                .on('broadcast', { event: 'call-offer' }, payload => this.handleIncomingOffer(payload.payload))
                .on('broadcast', { event: 'call-answer' }, payload => this.handleCallAnswer(payload.payload))
                .on('broadcast', { event: 'ice-candidate' }, payload => this.handleNewICECandidate(payload.payload))
                .on('broadcast', { event: 'call-end' }, () => this.endCall(false))
                .subscribe();
        },

        async startCall() {
            if (!activeChatFriendName || activeChatFriendName === 'Mastrisno_AI') {
                App.Toast.show("Fitur panggilan suara tidak dapat digunakan dengan Bot AI", "info");
                return;
            }

            try {
                this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
                this.currentCaller = activeChatFriendName;
                this.setupPeerConnection();

                this.localStream.getTracks().forEach(track => {
                    this.peerConnection.addTrack(track, this.localStream);
                });

                const offer = await this.peerConnection.createOffer();
                await this.peerConnection.setLocalDescription(offer);

                const targetChannel = supabaseClient.channel(`call_signaling_${activeChatFriendName.toLowerCase()}`);
                await targetChannel.subscribe();
                await targetChannel.send({
                    type: 'broadcast',
                    event: 'call-offer',
                    payload: {
                        caller: App.ProfileState.getCurrentName(),
                        callerAvatar: App.ProfileState.getCurrentAvatar(),
                        offer: offer
                    }
                });

                this.showCallUI(activeChatFriendName, App.ProfileState.getCurrentAvatar(), 'Memanggil...', 'outgoing');
            } catch (err) {
                App.Toast.show("Gagal mengakses mikrofon HP Anda: " + err.message, "danger");
                this.endCall(false);
            }
        },

        setupPeerConnection() {
            this.peerConnection = new RTCPeerConnection(this.rtcConfig);

            this.peerConnection.onicecandidate = (event) => {
                if (event.candidate && this.currentCaller) {
                    const targetChannel = supabaseClient.channel(`call_signaling_${this.currentCaller.toLowerCase()}`);
                    targetChannel.send({
                        type: 'broadcast',
                        event: 'ice-candidate',
                        payload: { candidate: event.candidate }
                    });
                }
            };

            this.peerConnection.ontrack = (event) => {
                const remoteAudio = document.getElementById('remote-rtc-audio');
                if (remoteAudio) {
                    remoteAudio.srcObject = event.streams[0];
                }
            };
        },

        async handleIncomingOffer(payload) {
            this.currentCaller = payload.caller;
            this.pendingOffer = payload.offer;

            triggerNativeDevicePushNotification("Panggilan Suara Masuk", `${payload.caller} memanggil Anda...`);
            this.showCallUI(payload.caller, payload.callerAvatar || DEFAULT_AVATAR_IMAGE, 'Panggilan suara masuk...', 'incoming');
        },

        async acceptCall() {
            try {
                this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
                this.setupPeerConnection();

                this.localStream.getTracks().forEach(track => {
                    this.peerConnection.addTrack(track, this.localStream);
                });

                await this.peerConnection.setRemoteDescription(new RTCSessionDescription(this.pendingOffer));
                const answer = await this.peerConnection.createAnswer();
                await this.peerConnection.setLocalDescription(answer);

                const targetChannel = supabaseClient.channel(`call_signaling_${this.currentCaller.toLowerCase()}`);
                await targetChannel.send({
                    type: 'broadcast',
                    event: 'call-answer',
                    payload: { answer: answer }
                });

                document.getElementById('call-status-text').innerText = 'Terhubung 00:00';
                this.renderActiveCallButtons();
            } catch (err) {
                App.Toast.show("Gagal menerima panggilan.", "danger");
                this.endCall(true);
            }
        },

        async handleCallAnswer(payload) {
            if (this.peerConnection) {
                await this.peerConnection.setRemoteDescription(new RTCSessionDescription(payload.answer));
                document.getElementById('call-status-text').innerText = 'Terhubung 00:00';
                this.renderActiveCallButtons();
            }
        },

        async handleNewICECandidate(payload) {
            if (this.peerConnection && payload.candidate) {
                try {
                    await this.peerConnection.addIceCandidate(new RTCIceCandidate(payload.candidate));
                } catch(e) {}
            }
        },

        endCall(notifyRemote = true) {
            if (notifyRemote && this.currentCaller) {
                const targetChannel = supabaseClient.channel(`call_signaling_${this.currentCaller.toLowerCase()}`);
                targetChannel.send({
                    type: 'broadcast',
                    event: 'call-end',
                    payload: {}
                });
            }

            if (this.localStream) {
                this.localStream.getTracks().forEach(track => track.stop());
                this.localStream = null;
            }
            if (this.peerConnection) {
                this.peerConnection.close();
                this.peerConnection = null;
            }

            this.currentCaller = null;
            this.pendingOffer = null;

            const modal = document.getElementById('call-overlay-modal');
            if (modal) modal.style.display = 'none';
            App.Toast.show("Panggilan berakhir", "info");
        },

        toggleMuteMic(btn) {
            if (this.localStream) {
                const audioTrack = this.localStream.getAudioTracks()[0];
                if (audioTrack) {
                    audioTrack.enabled = !audioTrack.enabled;
                    btn.style.background = audioTrack.enabled ? 'rgba(255,255,255,0.2)' : 'var(--danger)';
                    App.Toast.show(audioTrack.enabled ? "Mikrofon Aktif" : "Mikrofon Diheningkan", "info");
                }
            }
        },

        showCallUI(name, avatar, statusText, type = 'outgoing') {
            const modal = document.getElementById('call-overlay-modal');
            document.getElementById('call-user-name').innerText = name;
            document.getElementById('call-user-avatar').src = avatar;
            document.getElementById('call-status-text').innerText = statusText;

            const buttonsRow = document.getElementById('call-action-buttons-row');
            if (type === 'incoming') {
                buttonsRow.innerHTML = `
                    <button class="btn btn-danger" style="border-radius:50%; width:56px; height:56px; padding:0;" onclick="App.Call.endCall(true)">
                        <span class="material-symbols-outlined" style="font-size:28px;">call_end</span>
                    </button>
                    <button class="btn btn-primary" style="border-radius:50%; width:56px; height:56px; padding:0; background:#10B981;" onclick="App.Call.acceptCall()">
                        <span class="material-symbols-outlined" style="font-size:28px;">call</span>
                    </button>
                `;
            } else {
                buttonsRow.innerHTML = `
                    <button class="btn btn-danger" style="border-radius:50%; width:56px; height:56px; padding:0;" onclick="App.Call.endCall(true)">
                        <span class="material-symbols-outlined" style="font-size:28px;">call_end</span>
                    </button>
                `;
            }
            modal.style.display = 'flex';
        },

        renderActiveCallButtons() {
            const buttonsRow = document.getElementById('call-action-buttons-row');
            buttonsRow.innerHTML = `
                <button class="btn" style="border-radius:50%; width:52px; height:52px; padding:0; background:rgba(255,255,255,0.2); color:white;" onclick="App.Call.toggleMuteMic(this)">
                    <span class="material-symbols-outlined" style="font-size:24px;">mic</span>
                </button>
                <button class="btn btn-danger" style="border-radius:50%; width:56px; height:56px; padding:0;" onclick="App.Call.endCall(true)">
                    <span class="material-symbols-outlined" style="font-size:28px;">call_end</span>
                </button>
            `;
        }
    },

    ProfileState: {
        async syncUserProfileFromSupabase() {
            const userId = localStorage.getItem('ns_user_id');
            const userEmail = localStorage.getItem('ns_user_email');
            if (!userId) return;

            try {
                let { data: profile } = await supabaseClient
                    .from('profiles')
                    .select('*')
                    .eq('id', userId)
                    .maybeSingle();

                if (!profile) {
                    const defaultDisplayName = (userEmail || 'User').split('@')[0];
                    const { data: newProfile } = await supabaseClient
                        .from('profiles')
                        .insert([{
                            id: userId,
                            email: userEmail,
                            display_name: defaultDisplayName,
                            avatar_url: DEFAULT_AVATAR_IMAGE,
                            banner_url: DEFAULT_BANNER_IMAGE,
                            bio_status: 'Hallo👋',
                            category: 'Profil · Kreator digital',
                            domisili: 'Bandar Lampung',
                            pendidikan: 'SMA Negri 1 kalirejo',
                            gender: 'Perempuan',
                            birth_date: ''
                        }])
                        .select()
                        .single();

                    profile = newProfile;
                }

                if (profile) {
                    window.mySupabaseProfileCache = {
                        display_name: profile.display_name || (userEmail || 'User').split('@')[0],
                        avatar_url: (profile.avatar_url && profile.avatar_url !== 'null' && profile.avatar_url !== 'undefined') ? profile.avatar_url : DEFAULT_AVATAR_IMAGE,
                        banner_url: (profile.banner_url && profile.banner_url !== 'null' && profile.banner_url !== 'undefined') ? profile.banner_url : DEFAULT_BANNER_IMAGE,
                        bio_status: profile.bio_status || 'Hallo👋',
                        category: profile.category || 'Profil · Kreator digital',
                        domisili: profile.domisili || 'Bandar Lampung',
                        pendidikan: profile.pendidikan || 'SMA Negri 1 kalirejo',
                        gender: profile.gender || 'Perempuan',
                        birth_date: profile.birth_date || ''
                    };
                    App.UI.syncGlobalAvatarAndName();
                }
            } catch (e) {}
        },

        isSuperAdmin() {
            const email = (localStorage.getItem('ns_user_email') || '').toLowerCase();
            return email === 'mastrisnocom@gmail.com';
        },

        getCurrentName() {
            return window.mySupabaseProfileCache.display_name || (localStorage.getItem('ns_user_email') || 'User').split('@')[0];
        },
        getCurrentRoleBioStatus() {
            return window.mySupabaseProfileCache.bio_status || 'Hallo👋';
        },
        getCurrentCategory() {
            return window.mySupabaseProfileCache.category || 'Profil · Kreator digital';
        },
        getCurrentDomisili() {
            return window.mySupabaseProfileCache.domisili || 'Bandar Lampung';
        },
        getCurrentPendidikan() {
            return window.mySupabaseProfileCache.pendidikan || 'SMA Negri 1 kalirejo';
        },
        getCurrentGender() {
            return window.mySupabaseProfileCache.gender || 'Perempuan';
        },
        getCurrentBirthDate() {
            return window.mySupabaseProfileCache.birth_date || '';
        },
        getCurrentAvatar() {
            const av = window.mySupabaseProfileCache.avatar_url;
            return (av && av !== 'null' && av !== 'undefined') ? av : DEFAULT_AVATAR_IMAGE;
        },
        getCurrentBanner() {
            const bn = window.mySupabaseProfileCache.banner_url;
            return (bn && bn !== 'null' && bn !== 'undefined') ? bn : DEFAULT_BANNER_IMAGE;
        },
        getJoinDateText() {
            let dateStr = localStorage.getItem('ns_user_join_date');
            if(!dateStr) {
                const now = new Date();
                dateStr = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
                localStorage.setItem('ns_user_join_date', dateStr);
            }
            return dateStr;
        },
        getLimitConfig() {
            const defaultLimit = { count: 0, month: new Date().getMonth() };
            const saved = localStorage.getItem('ns_edit_limit_log');
            if (!saved) return defaultLimit;
            const parsed = JSON.parse(saved);
            if (parsed.month !== new Date().getMonth()) return defaultLimit;
            return parsed;
        },
        async updateProfileDataConfiguration(newData) {
            const config = this.getLimitConfig();
            if(config.count >= 5 && !this.isSuperAdmin()) return { success: false, message: "Batas pengeditan data profil bulan ini (5x) telah habis." };
            
            const userId = localStorage.getItem('ns_user_id');
            const oldName = this.getCurrentName();
            const newName = newData.display_name;

            try {
                const { error } = await supabaseClient
                    .from('profiles')
                    .upsert({
                        id: userId,
                        ...newData,
                        updated_at: new Date()
                    });

                if (error) throw error;

                if (oldName && newName && oldName !== newName) {
                    await supabaseClient.from('posts').update({ author: newName }).eq('author', oldName);
                    await supabaseClient.from('comments').update({ user_name: newName }).eq('user_name', oldName);
                    await supabaseClient.from('follows').update({ follower: newName }).eq('follower', oldName);
                    await supabaseClient.from('follows').update({ following: newName }).eq('following', oldName);
                    await supabaseClient.from('chats').update({ sender: newName }).eq('sender', oldName);
                    await supabaseClient.from('chats').update({ receiver: newName }).eq('receiver', oldName);
                    await supabaseClient.from('notifications').update({ sender: newName }).eq('sender', oldName);
                    await supabaseClient.from('notifications').update({ receiver: newName }).eq('receiver', oldName);
                }

                config.count += 1;
                localStorage.setItem('ns_edit_limit_log', JSON.stringify(config));
                
                await fetchRegisteredUsersListFromSupabase();
                await this.syncUserProfileFromSupabase();
                return { success: true };
            } catch(err) {
                return { success: false, message: "Gagal menyimpan ke database Supabase: " + err.message };
            }
        },
        async saveAvatarUrlToSupabase(publicUrl) {
            const userId = localStorage.getItem('ns_user_id');
            try {
                await supabaseClient
                    .from('profiles')
                    .upsert({
                        id: userId,
                        avatar_url: publicUrl,
                        updated_at: new Date()
                    });

                window.mySupabaseProfileCache.avatar_url = publicUrl;
                App.UI.syncGlobalAvatarAndName();
            } catch(e) {}
        },
        async saveBannerUrlToSupabase(publicUrl) {
            const userId = localStorage.getItem('ns_user_id');
            try {
                await supabaseClient
                    .from('profiles')
                    .upsert({
                        id: userId,
                        banner_url: publicUrl,
                        updated_at: new Date()
                    });

                window.mySupabaseProfileCache.banner_url = publicUrl;
            } catch(e) {}
        }
    },

    Realtime: {
        subscribeRealtimeChannels() {
            supabaseClient
                .channel('realtime-posts')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, async () => {
                    if (window.location.hash === '#/feed' || window.location.hash === '') {
                        App.Features.renderPosts(false);
                        App.Features.renderRealtimeStoriesCarousel();
                    }
                    if (window.location.hash.includes('#/profil')) App.Router.handleRoute();
                })
                .subscribe();

            supabaseClient
                .channel('realtime-profiles')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, async () => {
                    await fetchRegisteredUsersListFromSupabase();
                    await App.ProfileState.syncUserProfileFromSupabase();
                    if (window.location.hash.includes('#/profil')) App.Router.handleRoute();
                })
                .subscribe();

            supabaseClient
                .channel('realtime-comments')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, async () => {
                    if (activeBottomSheetPostId) App.Features.reloadCommentsBottomSheetStreamOnly();
                    App.Features.renderPosts(false);
                    if (window.location.hash.includes('#/profil')) App.Router.handleRoute();
                })
                .subscribe();

            supabaseClient
                .channel('realtime-chats')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'chats' }, async (payload) => {
                    const myName = App.ProfileState.getCurrentName();
                    if (activeChatFriendName) {
                        App.Features.fetchChatMessagesAndRenderStream();
                    } else if (payload.new && payload.new.receiver === myName) {
                        unreadMessageCounters[payload.new.sender.toLowerCase()] = (unreadMessageCounters[payload.new.sender.toLowerCase()] || 0) + 1;
                        App.Features.loadPopupFriendsListSidebar();
                        App.Navigation.updateChatBadgeDOM();
                        triggerNativeDevicePushNotification(`Pesan baru dari ${payload.new.sender}`, payload.new.message);
                    }
                })
                .subscribe();

            supabaseClient
                .channel('realtime-notifications')
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, async (payload) => {
                    const myName = App.ProfileState.getCurrentName();
                    if (payload.new && payload.new.receiver === myName) {
                        triggerNativeDevicePushNotification(`Notifikasi Tech Social`, `${payload.new.sender} ${payload.new.description}`);
                    }
                    await App.Features.fetchCloudNotificationsDataZone();
                    if (window.location.hash.includes('#/notifications')) {
                        App.Features.renderNotificationsView();
                    }
                })
                .subscribe();

            supabaseClient
                .channel('realtime-follows')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'follows' }, async () => {
                    await App.Features.fetchMyFriendsData();
                    if (window.location.hash === '#/explore') App.Features.renderExploreUsers();
                    if (window.location.hash.includes('#/profil')) App.Router.handleRoute();
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
                    localStorage.setItem('ns_user_id', data.session.user.id); 
                    localStorage.setItem('ns_user_email', data.session.user.email);
                    
                    await App.ProfileState.syncUserProfileFromSupabase();
                    App.ProfileState.getJoinDateText();
                    App.Auth.showApp();
                    App.Features.fetchCloudNotificationsDataZone();
                    App.Router.init();
                } else {
                    localStorage.removeItem('ns_logged_in');
                    const app = document.getElementById('app-layout');
                    if (app) { app.style.display = 'none'; app.classList.remove('active'); }
                    document.getElementById('auth-layout').style.display = 'flex';
                }
            } catch (err) {
                const app = document.getElementById('app-layout');
                if (app) { app.style.display = 'none'; app.classList.remove('active'); }
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
            App.UI.showLoadingBtn(e.target.querySelector('button'));
            try {
                const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
                if (error) throw error;
                if (!data.user) throw new Error("Pengguna tidak ditemukan");
                
                localStorage.setItem('ns_logged_in', 'true');
                localStorage.setItem('ns_user_id', data.user.id);
                localStorage.setItem('ns_user_email', data.user.email);
                
                await App.ProfileState.syncUserProfileFromSupabase();
                this.showApp();
                App.Features.fetchCloudNotificationsDataZone();
                App.Router.init();
            } catch (error) { 
                alert("Masuk gagal: " + error.message); 
                const btn = e.target.querySelector('button');
                if(btn) btn.innerHTML = 'Masuk ke Aplikasi';
            }
        },
        async signup(e) {
            if (e && e.preventDefault) e.preventDefault();
            const email = document.getElementById('signup-email').value.trim();
            const password = document.getElementById('signup-pwd').value;
            App.UI.showLoadingBtn(e.target.querySelector('button'));
            try {
                await supabaseClient.auth.signUp({ email, password });
                alert("Pendaftaran Sukses! Silakan langsung masuk.");
                this.toggleView('login');
            } catch (error) { alert("Pendaftaran gagal: " + error.message); }
        },
        showApp() {
            const auth = document.getElementById('auth-layout');
            const app = document.getElementById('app-layout');
            if(auth) auth.style.opacity = '0';
            setTimeout(() => { 
                if(auth) auth.style.display = 'none'; 
                if(app) {
                    app.style.display = 'grid';
                    app.classList.add('active'); 
                }
            }, 300);
        },
        async logout() {
            try { await supabaseClient.auth.signOut(); } catch(e){}
            localStorage.clear();
            window.location.hash = '';
            window.location.reload();
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
        async handleRoute() {
            const fullHash = window.location.hash.replace('#/', '') || 'feed';
            const baseRoute = fullHash.split('?')[0];
            const viewport = document.getElementById('app-viewport');
            
            document.querySelectorAll('.menu-item, .mobile-menu-tab-btn').forEach(el => {
                if(el.getAttribute('data-route') === baseRoute) el.classList.add('active');
                else el.classList.remove('active');
            });

            if (fullHash.startsWith('profil?name=')) {
                const targetUserDecoded = decodeURIComponent(fullHash.split('=')[1]);
                viewport.innerHTML = `<div class="view-container">${await App.Views.profil(targetUserDecoded)}</div>`;
                App.ViewControllers.profil(targetUserDecoded);
                window.scrollTo({ top: 0, behavior: 'smooth' });
                return;
            }

            if(App.Views[baseRoute]) {
                const result = App.Views[baseRoute]();
                viewport.innerHTML = `<div class="view-container">${(result instanceof Promise) ? await result : result}</div>`;
                if(App.ViewControllers[baseRoute]) App.ViewControllers[baseRoute]();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }
    },

    Navigation: {
        menuConfig: [
            { id: 'feed', label: 'Status', icon: 'home', isChatTrigger: false },
            { id: 'explore', label: 'Cari Teman', icon: 'person_search', isChatTrigger: false },
            { id: 'chat_trigger', label: 'Pesan', icon: 'chat', isChatTrigger: true }, 
            { id: 'groups', label: 'Komunitas', icon: 'groups', isChatTrigger: false },
            { id: 'edit_profile', label: 'Edit Profil', icon: 'edit_note', isChatTrigger: false },
            { id: 'settings', label: 'Pengaturan', icon: 'settings', isChatTrigger: false }
        ],
        render() {
            const side = document.getElementById('sidebar-menu-list');
            const topInjectedNode = document.getElementById('header-mobile-injected-tabs');
            let sideHTML = '', topInjectedHTML = '';

            this.menuConfig.forEach(m => {
                if(m.isChatTrigger) {
                    sideHTML += `<li class="menu-item-wrapper"><a class="menu-item chat-tab-btn ripple-btn" onclick="App.UI.toggleChatPopup(true)"><span class="material-symbols-outlined">${m.icon}</span><span class="menu-text">${m.label}</span><span class="badge" id="sidebar-chat-badge">0</span></a></li>`;
                    topInjectedHTML += `<div class="mobile-menu-tab-btn chat-tab-btn" onclick="App.UI.toggleChatPopup(true)" title="${m.label}"><span class="material-symbols-outlined">${m.icon}</span><span class="badge" id="mobile-chat-badge">0</span></div>`;
                } else {
                    sideHTML += `<li><a class="menu-item option-node-link ripple-btn" data-route="${m.id}" onclick="App.Router.navigate('${m.id}')"><span class="material-symbols-outlined">${m.icon}</span><span class="menu-text">${m.label}</span></a></li>`;
                    topInjectedHTML += `<div class="mobile-menu-tab-btn" data-route="${m.id}" onclick="App.Router.navigate('${m.id}')" title="${m.label}"><span class="material-symbols-outlined">${m.icon}</span></div>`;
                }
            });
            
            sideHTML += `<li style="margin-top: auto;"><a class="menu-item ripple-btn" style="color: var(--danger);" onclick="App.Auth.logout()"><span class="material-symbols-outlined">logout</span><span class="menu-text">Keluar</span></a></li>`;
            
            if (side) side.innerHTML = sideHTML; 
            if (topInjectedNode) topInjectedNode.innerHTML = topInjectedHTML;
            this.updateChatBadgeDOM();
        },
        updateChatBadgeDOM() {
            let totalUnread = 0;
            Object.values(unreadMessageCounters).forEach(cnt => totalUnread += (cnt || 0));
            
            const sideBadge = document.getElementById('sidebar-chat-badge');
            const mobBadge = document.getElementById('mobile-chat-badge');
            
            if(sideBadge) {
                sideBadge.innerText = totalUnread;
                sideBadge.style.display = totalUnread > 0 ? 'flex' : 'none';
            }
            if(mobBadge) {
                mobBadge.innerText = totalUnread;
                mobBadge.style.display = totalUnread > 0 ? 'flex' : 'none';
            }
        }
    },

    Views: {
        feed() {
            const myAvatar = App.ProfileState.getCurrentAvatar();
            return `
                <div class="fb-composer-box">
                    <div id="composer-avatar-slot">
                        <img src="${myAvatar}" class="user-avatar" style="width:40px; height:40px; object-fit:cover;" onclick="App.Router.navigate('profil')">
                    </div>
                    <div class="fb-composer-input" onclick="App.Features.openComposerModalPopupForm()">Apa yang Anda pikirkan?</div>
                    <span class="material-symbols-outlined fb-composer-gallery-icon" onclick="document.getElementById('global-composer-direct-file-input').click()">image</span>
                </div>

                <div class="stories-container" id="stories-carousel-stream">
                    <div class="story-card story-create-card" onclick="document.getElementById('global-composer-direct-file-input').click()">
                        <img src="${myAvatar}" class="story-create-img-top" alt="Buat cerita">
                        <div class="story-create-plus-wrapper">
                            <span class="material-symbols-outlined" style="font-size:20px;">add</span>
                        </div>
                        <div class="story-create-label">Buat cerita</div>
                    </div>
                    <div id="dynamic-stories-list-slot" style="display:flex; gap:10px;"></div>
                </div>

                <div id="feed-stream"></div>
                <div id="feed-infinite-loading-spinner" style="display:none; text-align:center; padding:16px; color:var(--text-muted); font-size:0.85rem;">
                    Memuat postingan lainnya...
                </div>
            `;
        },
        explore() {
            return `
                <div class="glass-card" style="border:none;">
                    <h2 style="font-weight:800; margin-bottom:4px; color:#050505;">Cari Jaringan Pengguna Asli</h2>
                    <p style="color: var(--text-muted); font-size:0.85rem; margin-bottom: 24px;">Berikut adalah akun asli anggota ekosistem Tech Social.</p>
                    <div id="explore-users-stream" class="user-grid"></div>
                </div>
            `;
        },
        notifications() {
            return `
                <div class="notification-page-container">
                    <div class="noti-header-row">
                        <h2 class="noti-header-title">Notifikasi</h2>
                    </div>
                    <div class="noti-section-title">Terdahulu</div>
                    <div id="notifications-viewport-list"></div>
                </div>
            `;
        },
        groups() {
            return `
                <div class="glass-card" style="border:none;">
                    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:24px;">
                        <h2 style="font-weight:800; color:#050505;">Komunitas Premium</h2>
                        <button class="btn btn-primary" onclick="App.Features.triggerCreateCommunityPremiumModal()"><span class="material-symbols-outlined">add_circle</span> Buat</button>
                    </div>
                    <div class="community-list-container" id="community-hub-list-viewport"></div>
                </div>
            `;
        },
        async profil(specifiedTargetName = null) {
            const loggedInUser = App.ProfileState.getCurrentName();
            const isOwnProfile = (!specifiedTargetName || specifiedTargetName === loggedInUser);
            const isSuperAdmin = App.ProfileState.isSuperAdmin();
            const targetName = isOwnProfile ? loggedInUser : specifiedTargetName;
            
            let targetAvatar = DEFAULT_AVATAR_IMAGE;
            let targetBanner = DEFAULT_BANNER_IMAGE;
            let targetCategory = 'Profil · Kreator digital';
            let targetBioStatus = 'Hallo👋';
            let targetDomisili = 'Bandar Lampung';
            let targetPendidikan = 'SMA Negri 1 kalirejo';
            let targetGender = 'Perempuan';
            let targetBirthDate = '';
            
            if (isOwnProfile) {
                targetAvatar = App.ProfileState.getCurrentAvatar();
                targetBanner = App.ProfileState.getCurrentBanner();
                targetBioStatus = App.ProfileState.getCurrentRoleBioStatus();
                targetCategory = App.ProfileState.getCurrentCategory();
                targetDomisili = App.ProfileState.getCurrentDomisili();
                targetPendidikan = App.ProfileState.getCurrentPendidikan();
                targetGender = App.ProfileState.getCurrentGender();
                targetBirthDate = App.ProfileState.getCurrentBirthDate();
            } else {
                try {
                    const { data: profile } = await supabaseClient
                        .from('profiles')
                        .select('avatar_url, banner_url, bio_status, category, domisili, pendidikan, gender, birth_date')
                        .eq('display_name', targetName)
                        .maybeSingle();

                    if (profile) {
                        if (profile.avatar_url && profile.avatar_url !== 'null' && profile.avatar_url !== 'undefined') targetAvatar = profile.avatar_url;
                        if (profile.banner_url && profile.banner_url !== 'null' && profile.banner_url !== 'undefined') targetBanner = profile.banner_url;
                        if (profile.bio_status) targetBioStatus = profile.bio_status;
                        if (profile.category) targetCategory = profile.category;
                        if (profile.domisili) targetDomisili = profile.domisili;
                        if (profile.pendidikan) targetPendidikan = profile.pendidikan;
                        if (profile.gender) targetGender = profile.gender;
                        if (profile.birth_date) targetBirthDate = profile.birth_date;
                    } else {
                        const { data: pData } = await supabaseClient.from('posts').select('avatar').eq('author', targetName).not('avatar', 'is', null).order('created_at', { ascending: false }).limit(1);
                        if (pData && pData.length > 0 && pData[0].avatar) targetAvatar = pData[0].avatar;
                    }
                } catch (err) {}
            }
            
            const isFollowing = window.userFriendsList.includes(targetName);
            const safeTargetName = escapeJSString(targetName);
            const birthdayIcon = isBirthdayToday(targetBirthDate) ? ' 🎂' : '';

            return `
                <div class="social-profile-view">
                    <div class="social-profile-banner-container">
                        <img src="${targetBanner}" class="social-profile-banner-img" alt="Banner Profil">
                        <div class="social-banner-nav-actions">
                            <button class="social-banner-nav-btn" onclick="window.history.back()" title="Kembali">
                                <span class="material-symbols-outlined" style="font-size:20px;">chevron_left</span>
                            </button>
                            <div style="display:flex; gap:10px;">
                                <button class="social-banner-nav-btn" onclick="App.Router.navigate('explore')" title="Cari">
                                    <span class="material-symbols-outlined" style="font-size:20px;">search</span>
                                </button>
                                <button class="social-banner-nav-btn" onclick="App.Features.openPostActionMenuDOM(0, '${safeTargetName}')" title="Opsi">
                                    <span class="material-symbols-outlined" style="font-size:20px;">more_vert</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    <div class="social-profile-body-wrapper">
                        <div class="social-profile-avatar-row">
                            <img src="${targetAvatar}" class="social-profile-avatar-node" alt="${sanitizeHTML(targetName)}">
                        </div>

                        <h1 class="social-profile-name-title">${sanitizeHTML(targetName)}${birthdayIcon}</h1>

                        <div class="social-profile-stats-inline">
                            <span onclick="App.Features.openFollowersModalAction('${safeTargetName}')"><strong id="profile-followers-count">...</strong> pengikut</span> · 
                            <span onclick="App.Features.openFollowingModalAction('${safeTargetName}')"><strong id="profile-friends-count">...</strong> mengikuti</span> · 
                            <span onclick="document.getElementById('profile-posts-stream')?.scrollIntoView({behavior:'smooth'})"><strong id="profile-posts-count">...</strong> postingan</span>
                        </div>

                        <div class="social-profile-meta-category">${sanitizeHTML(targetCategory)}</div>
                        <div class="social-profile-bio-text">${sanitizeHTML(targetBioStatus)}</div>

                        <div class="social-profile-highlights-row">
                            <div class="social-highlight-item">
                                <span class="material-symbols-outlined">work</span>
                                <span>${sanitizeHTML(targetCategory.replace('Profil · ', ''))}</span>
                            </div>
                            <div class="social-highlight-item">
                                <span class="material-symbols-outlined">location_on</span>
                                <span>${sanitizeHTML(targetDomisili)}</span>
                            </div>
                            <div class="social-highlight-item">
                                <span class="material-symbols-outlined">school</span>
                                <span>${sanitizeHTML(targetPendidikan)}</span>
                            </div>
                        </div>

                        <div class="social-profile-action-btns">
                            ${!isOwnProfile ? `
                                <button class="social-btn-gray" onclick="App.Features.toggleFollowInFollowFromProfileDOM('${safeTargetName}', this)">
                                    <span class="material-symbols-outlined" style="font-size:20px;">${isFollowing ? 'check_box' : 'add'}</span>
                                    <span>${isFollowing ? 'Mengikuti' : 'Ikuti'}</span>
                                </button>
                                <button class="social-btn-blue" onclick="App.UI.toggleChatPopup(true); App.Features.openSpecificFriendPopupObrolan('${escapeJSString(targetName.toLowerCase())}@nexsocial.id', '${safeTargetName}')">
                                    <span class="material-symbols-outlined" style="font-size:20px;">storefront</span>
                                    <span>Storefront</span>
                                </button>
                                ${isSuperAdmin ? `
                                    <button class="btn btn-danger" onclick="App.Features.adminDeleteTargetUserAccount('${safeTargetName}')" style="font-size:0.85rem; padding:8px 12px; border-radius:8px;">
                                        <span class="material-symbols-outlined" style="font-size:18px;">admin_panel_settings</span> Banned Akun
                                    </button>
                                ` : ''}
                            ` : `
                                <button class="social-btn-gray" onclick="App.Router.navigate('edit_profile')">
                                    <span class="material-symbols-outlined" style="font-size:20px;">edit</span>
                                    <span>Edit profil</span>
                                </button>
                                <button class="social-btn-blue" onclick="App.Features.openComposerModalPopupForm()">
                                    <span class="material-symbols-outlined" style="font-size:20px;">add</span>
                                    <span>Buat Postingan</span>
                                </button>
                            `}
                        </div>

                        <div class="social-profile-tabs-scroll">
                            <div class="social-tab-pill active">Semua</div>
                            <div class="social-tab-pill">Reels</div>
                            <div class="social-tab-pill">Foto</div>
                        </div>

                        <div class="social-section-title">Detail pribadi</div>
                        <div class="social-detail-list">
                            <div class="social-detail-row">
                                <div class="social-detail-icon-circle"><span class="material-symbols-outlined">location_on</span></div>
                                <div>${sanitizeHTML(targetDomisili)}</div>
                            </div>
                            <div class="social-detail-row">
                                <div class="social-detail-icon-circle"><span class="material-symbols-outlined">home</span></div>
                                <div>${sanitizeHTML(targetDomisili)}</div>
                            </div>
                            <div class="social-detail-row">
                                <div class="social-detail-icon-circle"><span class="material-symbols-outlined">group</span></div>
                                <div>${sanitizeHTML(targetGender)}</div>
                            </div>
                            ${targetBirthDate ? `
                            <div class="social-detail-row">
                                <div class="social-detail-icon-circle"><span class="material-symbols-outlined">cake</span></div>
                                <div>${new Date(targetBirthDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                            </div>
                            ` : ''}
                        </div>
                        <div class="social-link-see-more">Lihat detail selengkapnya</div>

                        <div class="social-section-title" style="margin-top:24px;">Pendidikan</div>
                        <div class="social-detail-list">
                            <div class="social-detail-row">
                                <div class="social-detail-icon-circle" style="border-radius:10px;"><span class="material-symbols-outlined">school</span></div>
                                <div>${sanitizeHTML(targetPendidikan)}</div>
                            </div>
                        </div>
                        <div class="social-link-see-more" style="margin-bottom:24px;">Lihat pendidikan lainnya</div>
                    </div>
                </div>

                <div style="padding: 0 4px; margin-bottom: 12px; font-weight: 800; font-size: 1.05rem; color: var(--text-main); text-align: left;">
                    Postingan ${sanitizeHTML(targetName)}
                </div>
                <div id="profile-posts-stream"></div>
            `;
        },

        /* EDIT PROFIL */
        edit_profile() {
            const currentName = App.ProfileState.getCurrentName();
            const currentAvatar = App.ProfileState.getCurrentAvatar();
            const currentBanner = App.ProfileState.getCurrentBanner();
            const currentBioStatus = App.ProfileState.getCurrentRoleBioStatus();
            const currentCategory = App.ProfileState.getCurrentCategory();
            const currentDomisili = App.ProfileState.getCurrentDomisili();
            const currentPendidikan = App.ProfileState.getCurrentPendidikan();
            const currentGender = App.ProfileState.getCurrentGender();
            const currentBirthDate = App.ProfileState.getCurrentBirthDate();

            return `
                <div style="max-width: 650px; margin: 0 auto;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px;">
                        <h2 style="font-weight:800; font-size:1.5rem; color:#050505; display:flex; align-items:center; gap:10px;">
                            <span class="material-symbols-outlined" style="font-size:32px; color:var(--primary);">edit_note</span>
                            <span>Edit Profil Anda</span>
                        </h2>
                    </div>

                    <div class="settings-section-card">
                        <div class="settings-section-title">
                            <span class="material-symbols-outlined">image</span>
                            <span>Foto Profil & Banner Cover</span>
                        </div>
                        
                        <div style="margin-bottom: 20px;">
                            <label style="font-size:0.85rem; font-weight:700; color:var(--text-muted); display:block; margin-bottom:8px;">Foto Sampul / Banner</label>
                            <div style="position:relative; width:100%; height:130px; border-radius:12px; overflow:hidden; border:1px solid var(--border-color); background:#e2e8f0;">
                                <img src="${currentBanner}" id="settings-banner-preview" style="width:100%; height:100%; object-fit:cover;">
                                <label for="banner-file-input" style="position:absolute; bottom:10px; right:10px; background:rgba(0,0,0,0.6); color:white; padding:6px 12px; border-radius:20px; font-size:0.8rem; font-weight:700; cursor:pointer; display:flex; align-items:center; gap:6px;">
                                    <span class="material-symbols-outlined" style="font-size:16px;">photo_camera</span> Ubah Sampul
                                </label>
                                <input type="file" id="banner-file-input" style="display:none;" accept="image/*" onchange="App.Features.handleBannerSelection(event)">
                            </div>
                        </div>

                        <div class="avatar-edit-container" style="margin-bottom: 20px;">
                            <div class="avatar-preview-wrapper" style="width: 100px; height: 100px;">
                                <img src="${currentAvatar}" id="settings-avatar-preview" class="avatar-preview-circle" style="background:#f0f2f5;" alt="Preview">
                                <label for="avatar-file-input" class="avatar-upload-label" title="Ganti Foto Profil">
                                    <span class="material-symbols-outlined" style="font-size:18px;">photo_camera</span>
                                </label>
                                <input type="file" id="avatar-file-input" style="display:none;" accept="image/*" onchange="App.Features.handleAvatarSelection(event)">
                            </div>
                            <span style="font-size:0.8rem; color:var(--text-muted); font-weight:600;">Maksimal upload foto/banner: 5MB</span>
                        </div>
                    </div>

                    <div class="settings-section-card">
                        <div class="settings-section-title">
                            <span class="material-symbols-outlined">person</span>
                            <span>Informasi Diri</span>
                        </div>
                        <div class="form-group"><input type="text" class="form-input" id="settings-display-name" placeholder=" " value="${sanitizeHTML(currentName)}"><label class="form-label">Nama Lengkap</label></div>
                        <div class="form-group"><input type="text" class="form-input" id="settings-category" placeholder=" " value="${sanitizeHTML(currentCategory)}"><label class="form-label">Kategori (Cth: Profil · Kreator digital)</label></div>
                        <div class="form-group"><input type="text" class="form-input" id="settings-bio-status" placeholder=" " value="${sanitizeHTML(currentBioStatus)}"><label class="form-label">Bio Singkat (Cth: Hallo👋)</label></div>
                        <div class="form-group"><input type="text" class="form-input" id="settings-domisili" placeholder=" " value="${sanitizeHTML(currentDomisili)}"><label class="form-label">Kota / Tempat Tinggal</label></div>
                        <div class="form-group"><input type="text" class="form-input" id="settings-pendidikan" placeholder=" " value="${sanitizeHTML(currentPendidikan)}"><label class="form-label">Riwayat Pendidikan</label></div>
                        
                        <div class="form-group">
                            <input type="date" class="form-input" id="settings-birth-date" value="${currentBirthDate}">
                            <label class="form-label" style="top:12px; font-size:0.75rem; color:var(--primary); font-weight:700;">Tanggal Lahir</label>
                        </div>

                        <div class="form-group" style="margin-bottom:20px;">
                            <select id="settings-gender" class="form-input" style="padding-top:16px; cursor:pointer;">
                                <option value="Perempuan" ${currentGender === 'Perempuan' ? 'selected' : ''}>Perempuan</option>
                                <option value="Laki-laki" ${currentGender === 'Laki-laki' ? 'selected' : ''}>Laki-laki</option>
                            </select>
                            <label class="form-label" style="top:12px; font-size:0.75rem; color:var(--primary); font-weight:700;">Jenis Kelamin</label>
                        </div>

                        <button class="btn btn-primary ripple-btn btn-full" onclick="App.Features.saveNameSettings()">Simpan Perubahan Profil</button>
                    </div>
                </div>
            `;
        },

        /* PENGATURAN UI GRID IKON RINGKAS */
        settings() {
            const isSuperAdmin = App.ProfileState.isSuperAdmin();
            const defaultPrivacy = localStorage.getItem('ns_default_privacy') || 'public';

            return `
                <div style="max-width: 650px; margin: 0 auto;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px;">
                        <h2 style="font-weight:800; font-size:1.5rem; color:#050505; display:flex; align-items:center; gap:10px;">
                            <span class="material-symbols-outlined" style="font-size:32px; color:var(--primary);">tune</span>
                            <span>Pengaturan Aplikasi</span>
                        </h2>
                        ${isSuperAdmin ? '<span style="background:var(--danger); color:white; font-size:0.75rem; font-weight:800; padding:4px 10px; border-radius:12px;">SUPER ADMIN</span>' : ''}
                    </div>

                    <div class="settings-compact-grid">
                        <div class="settings-grid-item" onclick="App.Features.openGeminiApiKeyModalForm()">
                            <span class="material-symbols-outlined">smart_toy</span>
                            <span class="lbl">API Gemini</span>
                        </div>
                        <div class="settings-grid-item" onclick="App.Features.requestNotificationPermissionAction()">
                            <span class="material-symbols-outlined">notifications_active</span>
                            <span class="lbl">Notifikasi HP</span>
                        </div>
                        <div class="settings-grid-item" onclick="App.Features.changeUserPasswordAction()">
                            <span class="material-symbols-outlined">lock_reset</span>
                            <span class="lbl">Ganti Sandi</span>
                        </div>
                        <div class="settings-grid-item" onclick="App.Features.clearAppLocalCacheAction()">
                            <span class="material-symbols-outlined">cleaning_services</span>
                            <span class="lbl">Hapus Cache</span>
                        </div>
                        ${isSuperAdmin ? `
                        <div class="settings-grid-item" onclick="App.Features.openAdminAdModalForm()">
                            <span class="material-symbols-outlined">campaign</span>
                            <span class="lbl">Iklan Global</span>
                        </div>
                        ` : ''}
                        <div class="settings-grid-item" onclick="App.Auth.logout()">
                            <span class="material-symbols-outlined">logout</span>
                            <span class="lbl">Keluar Akun</span>
                        </div>
                        <div class="settings-grid-item danger" onclick="App.Features.deleteAccountPermanently()">
                            <span class="material-symbols-outlined">delete_forever</span>
                            <span class="lbl">Hapus Akun</span>
                        </div>
                    </div>

                    <div class="settings-section-card" style="margin-top: 24px;">
                        <div class="settings-section-title">
                            <span class="material-symbols-outlined">visibility</span>
                            <span>Privasi Posting Default</span>
                        </div>
                        <div class="form-group" style="margin-bottom:0;">
                            <select id="settings-default-privacy-select" class="form-input" style="padding-top:16px; cursor:pointer;" onchange="localStorage.setItem('ns_default_privacy', this.value); App.Toast.show('Privasi default diperbarui!', 'success');">
                                <option value="public" ${defaultPrivacy === 'public' ? 'selected' : ''}>Publik (Bisa dilihat semua orang)</option>
                                <option value="friends" ${defaultPrivacy === 'friends' ? 'selected' : ''}>Teman (Hanya pengguna yang diikuti)</option>
                                <option value="private" ${defaultPrivacy === 'private' ? 'selected' : ''}>Privat (Hanya Saya)</option>
                            </select>
                        </div>
                    </div>
                </div>
            `;
        }
    },

    ViewControllers: {
        feed() { 
            App.UI.syncGlobalAvatarAndName(); 
            feedCurrentPage = 0;
            feedHasMorePosts = true;
            App.Features.renderPosts(false); 
            App.Features.renderRealtimeStoriesCarousel();
        },
        explore() { App.Features.renderExploreUsers(); },
        notifications() { App.Features.renderNotificationsView(); },
        groups() { App.Features.renderCommunityHubViewportList(); },
        profil(targetName = null) { 
            App.Features.loadProfileStatsFromSupabase(targetName); 
            App.Features.renderProfilePosts(targetName);
        },
        edit_profile() {},
        settings() {}
    },

    Features: {
        async adminDeleteTargetUserAccount(targetName) {
            if (!App.ProfileState.isSuperAdmin()) {
                App.Toast.show("Akses ditolak. Anda bukan Super Admin.", "danger");
                return;
            }

            if (!confirm(`[SUPER ADMIN] Apakah Anda yakin ingin BANNED / Hapus Akun '${targetName}' secara permanen?`)) return;

            App.Toast.show(`Memproses penghapusan akun '${targetName}'...`, "info");

            try {
                await supabaseClient.from('posts').delete().eq('author', targetName);
                await supabaseClient.from('comments').delete().eq('user_name', targetName);
                await supabaseClient.from('follows').delete().or(`follower.eq."${targetName}",following.eq."${targetName}"`);
                await supabaseClient.from('chats').delete().or(`sender.eq."${targetName}",receiver.eq."${targetName}"`);
                await supabaseClient.from('notifications').delete().or(`sender.eq."${targetName}",receiver.eq."${targetName}"`);
                await supabaseClient.from('profiles').delete().eq('display_name', targetName);

                App.Toast.show(`Akun '${targetName}' berhasil dihapus dari sistem!`, "success");
                setTimeout(() => App.Router.navigate('feed'), 1000);
            } catch(err) {
                App.Toast.show("Gagal menghapus akun pengguna: " + err.message, "danger");
            }
        },

        async deleteAccountPermanently() {
            const myName = App.ProfileState.getCurrentName();
            const userId = localStorage.getItem('ns_user_id');

            const confirmFirst = confirm(`Peringatan! Apakah Anda yakin ingin menghapus akun '${myName}' secara permanen?`);
            if (!confirmFirst) return;

            const confirmWord = prompt(`Ketik nama akun Anda [${myName}] untuk konfirmasi:`);
            if (confirmWord !== myName) {
                App.Toast.show("Konfirmasi gagal. Nama tidak cocok.", "danger");
                return;
            }

            App.Toast.show("Menghapus seluruh data akun Anda...", "info");

            try {
                await supabaseClient.from('posts').delete().eq('author', myName);
                await supabaseClient.from('comments').delete().eq('user_name', myName);
                await supabaseClient.from('follows').delete().or(`follower.eq."${myName}",following.eq."${myName}"`);
                await supabaseClient.from('chats').delete().or(`sender.eq."${myName}",receiver.eq."${myName}"`);
                await supabaseClient.from('notifications').delete().or(`sender.eq."${myName}",receiver.eq."${myName}"`);

                if (userId) {
                    await supabaseClient.from('profiles').delete().eq('id', userId);
                } else {
                    await supabaseClient.from('profiles').delete().eq('display_name', myName);
                }

                App.Toast.show("Akun Anda berhasil dihapus.", "success");
                setTimeout(async () => { await App.Auth.logout(); }, 1200);
            } catch (err) {
                App.Toast.show("Gagal menghapus akun: " + err.message, "danger");
            }
        },

        async requestNotificationPermissionAction() {
            if (!('Notification' in window)) {
                App.Toast.show("Browser tidak mendukung notifikasi push.", "danger");
                return;
            }
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                App.Toast.show("Notifikasi HP berhasil diizinkan!", "success");
            } else if (permission === 'denied') {
                App.Toast.show("Izin notifikasi ditolak.", "danger");
            }
        },

        async changeUserPasswordAction() {
            const newPassword = prompt("Masukkan password baru Anda (minimal 6 karakter):");
            if (!newPassword) return;
            if (newPassword.length < 6) {
                App.Toast.show("Password minimal harus 6 karakter!", "danger");
                return;
            }
            try {
                const { error } = await supabaseClient.auth.updateUser({ password: newPassword });
                if (error) throw error;
                App.Toast.show("Password akun berhasil diperbarui!", "success");
            } catch (err) {
                App.Toast.show("Gagal mengubah password: " + err.message, "danger");
            }
        },

        clearAppLocalCacheAction() {
            if (confirm("Bersihkan cache lokal aplikasi?")) {
                const apiKey = localStorage.getItem('ns_gemini_api_key');
                const loggedIn = localStorage.getItem('ns_logged_in');
                const userId = localStorage.getItem('ns_user_id');
                const userEmail = localStorage.getItem('ns_user_email');

                localStorage.clear();

                if (apiKey) localStorage.setItem('ns_gemini_api_key', apiKey);
                if (loggedIn) localStorage.setItem('ns_logged_in', loggedIn);
                if (userId) localStorage.setItem('ns_user_id', userId);
                if (userEmail) localStorage.setItem('ns_user_email', userEmail);

                App.Toast.show("Cache berhasil dibersihkan!", "success");
                setTimeout(() => window.location.reload(), 800);
            }
        },

        toggleAudioPhotoPlayback(postId, audioUrl) {
            const audioEl = document.getElementById(`photo-audio-${postId}`);
            const badgeEl = document.getElementById(`audio-badge-${postId}`);
            if (!audioEl) return;

            document.querySelectorAll('.post-audio-node').forEach(a => {
                if (a.id !== `photo-audio-${postId}`) {
                    a.pause();
                    a.currentTime = 0;
                    const otherId = a.id.replace('photo-audio-', '');
                    const otherBadge = document.getElementById(`audio-badge-${otherId}`);
                    if (otherBadge) {
                        otherBadge.classList.remove('playing');
                        otherBadge.querySelector('.material-symbols-outlined').innerText = 'music_note';
                        otherBadge.querySelector('.audio-text-lbl').innerText = 'Klik Foto Untuk Lagu 🎵';
                    }
                }
            });

            if (audioEl.paused) {
                audioEl.play();
                if (badgeEl) {
                    badgeEl.classList.add('playing');
                    badgeEl.querySelector('.material-symbols-outlined').innerText = 'graphic_eq';
                    badgeEl.querySelector('.audio-text-lbl').innerText = 'Memutar Musik... 🎵';
                }
            } else {
                audioEl.pause();
                if (badgeEl) {
                    badgeEl.classList.remove('playing');
                    badgeEl.querySelector('.material-symbols-outlined').innerText = 'music_note';
                    badgeEl.querySelector('.audio-text-lbl').innerText = 'Klik Foto Untuk Lagu 🎵';
                }
            }
        },

        formatStatNumber(num) {
            if (!num) return '0';
            if (num >= 1000000) return (num / 1000000).toFixed(1).replace('.0', '') + ' jt';
            if (num >= 1000) return (num / 1000).toFixed(1).replace('.0', '') + ' rb';
            return num.toString();
        },

        async loadProfileStatsFromSupabase(targetName = null) {
            const name = targetName || App.ProfileState.getCurrentName();
            const followingEl = document.getElementById('profile-friends-count');
            try {
                const { count: followingCount } = await supabaseClient
                    .from('follows')
                    .select('*', { count: 'exact', head: true })
                    .eq('follower', name);
                if (followingEl) followingEl.innerText = this.formatStatNumber(followingCount || 0);
            } catch(e) { if (followingEl) followingEl.innerText = '0'; }

            const followersEl = document.getElementById('profile-followers-count');
            try {
                const { count: followersCount } = await supabaseClient
                    .from('follows')
                    .select('*', { count: 'exact', head: true })
                    .eq('following', name);
                if (followersEl) followersEl.innerText = this.formatStatNumber(followersCount || 0);
            } catch(e) { if (followersEl) followersEl.innerText = '0'; }

            const postsEl = document.getElementById('profile-posts-count');
            try {
                const { count: postsCount } = await supabaseClient
                    .from('posts')
                    .select('*', { count: 'exact', head: true })
                    .eq('author', name);
                if (postsEl) postsEl.innerText = this.formatStatNumber(postsCount || 0);
            } catch(e) { if (postsEl) postsEl.innerText = '0'; }
        },

        async openFollowingModalAction(targetUser) {
            try {
                const { data: followsData } = await supabaseClient.from('follows').select('following').eq('follower', targetUser);
                const list = followsData ? followsData.map(f => f.following) : [];
                if (list.length === 0) {
                    App.Modal.open(`Pengguna yang Diikuti`, `<div style="text-align:center; padding:20px; color:var(--text-muted);">${sanitizeHTML(targetUser)} belum mengikuti siapa pun.</div>`, true, false);
                    return;
                }

                const { data: profiles } = await supabaseClient.from('profiles').select('display_name, avatar_url, bio_status');
                const profMap = {};
                if (profiles) profiles.forEach(p => profMap[p.display_name] = p);

                const htmlList = list.map(uName => {
                    const p = profMap[uName] || {};
                    const av = (p.avatar_url && p.avatar_url !== 'null') ? p.avatar_url : DEFAULT_AVATAR_IMAGE;
                    const isFollowing = window.userFriendsList.includes(uName);
                    const safeUName = escapeJSString(uName);

                    return `
                        <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; padding:10px 0; border-bottom:1px solid var(--border-color);">
                            <div style="display:flex; align-items:center; gap:10px; cursor:pointer;" onclick="App.Modal.close(); App.Router.navigate('profil?name=${encodeURIComponent(uName)}')">
                                <img src="${av}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;">
                                <div>
                                    <strong style="font-size:0.9rem; color:#050505; display:block;">${sanitizeHTML(uName)}</strong>
                                    <span style="font-size:0.75rem; color:var(--text-muted);">${sanitizeHTML(p.bio_status || 'Member')}</span>
                                </div>
                            </div>
                            <button class="btn ${isFollowing ? 'btn-secondary' : 'btn-primary'}" style="padding:6px 12px; font-size:0.75rem;" onclick="App.Features.toggleFollowInFollowFromProfileDOM('${safeUName}', this)">
                                ${isFollowing ? 'Mengikuti' : 'Ikuti'}
                            </button>
                        </div>`;
                }).join('');

                App.Modal.open(`Pengguna yang Diikuti (${list.length})`, `<div style="max-height:60vh; overflow-y:auto;">${htmlList}</div>`, true, false);
            } catch(e) {}
        },

        async openFollowersModalAction(targetUser) {
            try {
                const { data: followersData } = await supabaseClient.from('follows').select('follower').eq('following', targetUser);
                const list = followersData ? followersData.map(f => f.follower) : [];
                if (list.length === 0) {
                    App.Modal.open(`Pengikut ${targetUser}`, `<div style="text-align:center; padding:20px; color:var(--text-muted);">${sanitizeHTML(targetUser)} belum memiliki pengikut.</div>`, true, false);
                    return;
                }

                const { data: profiles } = await supabaseClient.from('profiles').select('display_name, avatar_url, bio_status');
                const profMap = {};
                if (profiles) profiles.forEach(p => profMap[p.display_name] = p);

                const htmlList = list.map(uName => {
                    const p = profMap[uName] || {};
                    const av = (p.avatar_url && p.avatar_url !== 'null') ? p.avatar_url : DEFAULT_AVATAR_IMAGE;
                    const isFollowing = window.userFriendsList.includes(uName);
                    const safeUName = escapeJSString(uName);

                    return `
                        <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; padding:10px 0; border-bottom:1px solid var(--border-color);">
                            <div style="display:flex; align-items:center; gap:10px; cursor:pointer;" onclick="App.Modal.close(); App.Router.navigate('profil?name=${encodeURIComponent(uName)}')">
                                <img src="${av}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;">
                                <div>
                                    <strong style="font-size:0.9rem; color:#050505; display:block;">${sanitizeHTML(uName)}</strong>
                                    <span style="font-size:0.75rem; color:var(--text-muted);">${sanitizeHTML(p.bio_status || 'Member')}</span>
                                </div>
                            </div>
                            <button class="btn ${isFollowing ? 'btn-secondary' : 'btn-primary'}" style="padding:6px 12px; font-size:0.75rem;" onclick="App.Features.toggleFollowInFollowFromProfileDOM('${safeUName}', this)">
                                ${isFollowing ? 'Mengikuti' : 'Ikuti'}
                            </button>
                        </div>`;
                }).join('');

                App.Modal.open(`Pengikut (${list.length})`, `<div style="max-height:60vh; overflow-y:auto;">${htmlList}</div>`, true, false);
            } catch(e) {}
        },

        async renderRealtimeStoriesCarousel() {
            const slot = document.getElementById('dynamic-stories-list-slot');
            if (!slot) return;

            try {
                const { data: postsWithImages } = await supabaseClient
                    .from('posts')
                    .select('author, avatar, image, created_at')
                    .not('image', 'is', null)
                    .order('created_at', { ascending: false })
                    .limit(10);

                if (!postsWithImages || postsWithImages.length === 0) {
                    slot.innerHTML = '';
                    return;
                }

                const uniqueStoriesMap = {};
                postsWithImages.forEach(p => {
                    if (p.image && !uniqueStoriesMap[p.author]) {
                        uniqueStoriesMap[p.author] = p;
                    }
                });

                const uniqueStories = Object.values(uniqueStoriesMap);

                slot.innerHTML = uniqueStories.map(story => {
                    const storyAvatar = (story.avatar && story.avatar !== 'null') ? story.avatar : DEFAULT_AVATAR_IMAGE;

                    return `
                        <div class="story-card" onclick="App.Router.navigate('profil?name=${encodeURIComponent(story.author)}')">
                            <img src="${story.image}" class="story-card-bg" alt="Cerita ${sanitizeHTML(story.author)}">
                            <div class="story-gradient-overlay"></div>
                            <img src="${storyAvatar}" class="story-user-avatar-ring" alt="${sanitizeHTML(story.author)}">
                            <span class="story-user-name">${sanitizeHTML(story.author)}</span>
                        </div>
                    `;
                }).join('');
            } catch(e) { slot.innerHTML = ''; }
        },

        async renderProfilePosts(targetName = null) {
            const stream = document.getElementById('profile-posts-stream');
            if (!stream) return;
            const profileUser = targetName || App.ProfileState.getCurrentName();
            const myName = App.ProfileState.getCurrentName();

            try {
                const { data: posts } = await supabaseClient.from('posts').select('*').order('created_at', { ascending: false });
                const { data: commentsData } = await supabaseClient.from('comments').select('*');
                const allComments = commentsData || [];

                let filtered = (posts || []).filter(p => {
                    const isAuthor = p.author === profileUser;
                    const isMentioned = p.content && p.content.toLowerCase().includes(`@${profileUser.toLowerCase()}`);
                    return isAuthor || isMentioned;
                });

                if (filtered.length === 0) {
                    stream.innerHTML = `<div class="glass-card" style="text-align:center; color:var(--text-muted); padding:32px 16px; border:none; background:transparent;">Belum ada riwayat postingan untuk ${sanitizeHTML(profileUser)}.</div>`;
                    return;
                }

                stream.innerHTML = `<div class="feed-container">` + filtered.map(p => {
                    const postComments = allComments.filter(c => c.post_id === p.id);
                    let totalCommentsCount = postComments.length;
                    postComments.forEach(c => { if (c.replies && Array.isArray(c.replies)) totalCommentsCount += c.replies.length; });

                    let postLikesArray = p.liked_users || [];
                    const hasLiked = postLikesArray.includes(myName) ? 'liked' : '';
                    const hasLoved = (p.loved_users || []).includes(myName) ? 'loved' : '';
                    
                    const safeAuthor = escapeJSString(p.author);
                    const postAvatar = (p.avatar && p.avatar !== 'null') ? p.avatar : DEFAULT_AVATAR_IMAGE;
                    const mediaHTML = this.extractAndRenderEmbeddedMedia(p.content || "", p.media_url, p.image, p.id, safeAuthor, postAvatar);

                    const privacyType = p.privacy || 'public';
                    const privacyIcon = privacyType === 'private' ? 'lock' : (privacyType === 'friends' ? 'group' : 'public');
                    const privacyTitle = privacyType === 'private' ? 'Privat' : (privacyType === 'friends' ? 'Teman' : 'Publik');

                    const formattedPostText = this.cleanTextContentForDisplay(p.content || '', p.id);
                    const wetonStr = getWetonJawa(p.created_at);
                    
                    const pUserObj = window.profilesCacheMap[p.author.toLowerCase()];
                    const birthdayIcon = (pUserObj && isBirthdayToday(pUserObj.birth_date)) ? ' 🎂' : '';

                    return `
                        <div class="post-card" id="post-element-node-${p.id}">
                            <div class="post-header">
                                <div class="post-author">
                                    <img src="${postAvatar}" class="post-avatar" onclick="App.Router.navigate('profil?name=${encodeURIComponent(p.author)}')">
                                    <div class="post-meta-container">
                                        <div class="post-author-row">
                                            <h4 onclick="App.Router.navigate('profil?name=${encodeURIComponent(p.author)}')">${sanitizeHTML(p.author)}${birthdayIcon}</h4>
                                            <span class="post-meta-dot">•</span>
                                            <span class="post-live-time-tracker" data-timestamp="${new Date(p.created_at).getTime()}">${App.UI.calculateRelativeTimeAgo(new Date(p.created_at).getTime())}</span>
                                            <span class="post-meta-dot">•</span>
                                            <span class="material-symbols-outlined" style="font-size:14px; color:var(--text-muted); vertical-align:middle;" title="${privacyTitle}">${privacyIcon}</span>
                                        </div>
                                        ${wetonStr ? `<div class="post-weton-tag">${wetonStr}</div>` : ''}
                                    </div>
                                </div>
                                <button class="post-menu-trigger" onclick="App.Features.openPostActionMenuDOM(${p.id}, '${safeAuthor}')"><span class="material-symbols-outlined">more_vert</span></button>
                            </div>
                            <div class="post-content">${formattedPostText}</div>
                            ${mediaHTML}
                            <div class="post-actions-bar">
                                <div class="post-action-item ${hasLiked}" id="like-btn-node-${p.id}" onclick="App.Features.toggleLike(${p.id}, '${safeAuthor}')"><span class="material-symbols-outlined">thumb_up</span><span id="like-count-node-${p.id}"> ${postLikesArray.length}</span></div>
                                <div class="post-action-item ${hasLoved}" id="love-btn-node-${p.id}" onclick="App.Features.toggleLoveReaction(${p.id}, '${safeAuthor}')"><span class="material-symbols-outlined">favorite</span><span id="love-count-node-${p.id}"> ${(p.loved_users || []).length}</span></div>
                                <div class="post-action-item" onclick="App.Features.openCommentsBottomSheet(${p.id}, '${safeAuthor}')"><span class="material-symbols-outlined">comment</span><span id="comment-count-node-${p.id}"> Komentar (${totalCommentsCount})</span></div>
                                <div class="post-action-item" onclick="App.Features.openSocialMediaShareSheetModal(${p.id}, '${safeAuthor}', '${(p.content || "").replace(/'/g, "\\'")}', ${!!p.image})"><span class="material-symbols-outlined">share</span><span> ${p.shared_count || 0}</span></div>
                            </div>
                        </div>`;
                }).join('') + `</div>`;
            } catch(e) {}
        },

        openAdminAdModalForm() {
            const savedAdHTML = localStorage.getItem('ns_ad_html_global') || '';
            const html = `
                <form id="global-admin-ad-form" onsubmit="App.Features.saveAdminGlobalAdBannerAction(event)">
                    <div class="form-group" style="margin-bottom: 14px;">
                        <textarea class="form-input" id="admin-ad-html-input" placeholder=" " required style="min-height: 120px;">${savedAdHTML}</textarea>
                        <label class="form-label">Kode Iklan HTML/JS</label>
                    </div>
                    <button type="submit" class="btn btn-primary btn-full">Rilis Iklan Secara Global</button>
                </form>
            `;
            App.Modal.open("Panel Iklan Global", html, true, false);
        },

        openGeminiApiKeyModalForm() {
            const currentKey = localStorage.getItem('ns_gemini_api_key') || '';
            const html = `
                <div style="display:flex; flex-direction:column; gap:16px; text-align:left;">
                    <p style="font-size:0.88rem; color:var(--text-muted); line-height:1.5;">
                        Untuk menggunakan <strong>Mastrisno AI 🤖</strong>, masukkan <strong>Google Gemini API Key</strong> Anda.
                    </p>
                    <div class="form-group" style="margin-bottom:0;">
                        <input type="password" id="modal-gemini-key-input-field" class="form-input" placeholder=" " value="${currentKey}">
                        <label class="form-label">Gemini API Key</label>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                        <a href="https://aistudio.google.com/app/apikey" target="_blank" style="font-size:0.8rem; color:var(--primary); font-weight:700; text-decoration:underline;">Dapatkan Key Gratis di AI Studio</a>
                        <button class="btn btn-primary" onclick="App.Features.saveGeminiApiKeyFromModalAction()">Simpan API Key</button>
                    </div>
                </div>
            `;
            App.Modal.open("API Key Mastrisno AI", html, true, false);
        },

        saveGeminiApiKeyFromModalAction() {
            const inputKey = document.getElementById('modal-gemini-key-input-field')?.value.trim();
            if(!inputKey) { App.Toast.show("API Key tidak boleh kosong!", "danger"); return; }
            localStorage.setItem('ns_gemini_api_key', inputKey);
            App.Modal.close();
            App.Toast.show("API Key Gemini berhasil disimpan!", "success");
        },

        async handleGlobalDirectFileSelection(event) {
            const file = event.target.files[0]; if (!file) return;
            if (file.size > 5 * 1024 * 1024) { App.Toast.show("Ukuran foto melebihi batas 5MB!", "danger"); event.target.value = ''; return; }
            App.Toast.show("Mengompresi gambar...", "info");
            const compressedFile = await compressImageNative(file, 1080, 0.75);
            composerSelectedFile = compressedFile;

            const reader = new FileReader(); 
            reader.readAsDataURL(compressedFile); 
            reader.onload = function (e) {
                App.Features.openComposerModalPopupForm();
                const previewArea = document.getElementById('composer-upload-preview-area');
                if(previewArea) previewArea.innerHTML = `<img src="${e.target.result}">`;
                App.Features.syncComposerSubmitButtonState();
                event.target.value = '';
            };
        },

        openComposerModalPopupForm() {
            const currentName = App.ProfileState.getCurrentName();
            const avatarHTML = App.UI.generateAvatarHTML(currentName, App.ProfileState.getCurrentAvatar(), false, 0, '52px', false);
            currentComposerBgColor = "#ffffff"; activeComposerLocation = "";
            const defaultPrivacy = localStorage.getItem('ns_default_privacy') || 'public';

            const popupFormHTML = `
                <div class="pic-composer-card">
                    <div class="pic-composer-header">
                        <span class="pic-composer-title">Postingan baru</span>
                        <button class="pic-composer-next-btn" id="pic-submit-btn" onclick="App.Features.createPost()">Kirim</button>
                    </div>
                    <div class="pic-composer-profile-row">
                        ${avatarHTML}
                        <div style="display:flex; flex-direction:column; gap:2px; margin-left: 8px;">
                            <span class="pic-composer-username">${sanitizeHTML(currentName)}</span>
                            <div class="pic-status-pill" style="border:1px solid var(--border-color); display:inline-flex; align-items:center; border-radius:12px; background:#f0f2f5;">
                                <span class="material-symbols-outlined" style="margin-left: 8px; font-size: 14px; color:var(--primary);" id="composer-privacy-icon">${defaultPrivacy === 'private' ? 'lock' : (defaultPrivacy === 'friends' ? 'group' : 'public')}</span>
                                <select id="composer-privacy-select" onchange="document.getElementById('composer-privacy-icon').innerText = this.options[this.selectedIndex].getAttribute('data-icon')" style="background:transparent; border:none; font-weight:700; color:#050505; font-size:0.75rem; padding:4px 8px 4px 4px; outline:none; cursor:pointer;">
                                    <option value="public" data-icon="public" ${defaultPrivacy === 'public' ? 'selected' : ''}>Publik</option>
                                    <option value="friends" data-icon="group" ${defaultPrivacy === 'friends' ? 'selected' : ''}>Teman</option>
                                    <option value="private" data-icon="lock" ${defaultPrivacy === 'private' ? 'selected' : ''}>Privat</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    <div class="pic-composer-body">
                        <textarea class="pic-composer-textarea" id="composer-text" placeholder="Apa yang Anda pikirkan? Tempel link YouTube, Facebook Video, atau MP3 di sini." oninput="App.Features.handleComposerLiveTextChange()"></textarea>
                        <div id="composer-upload-preview-area" class="pic-composer-preview-box"></div>
                        <div id="composer-location-badge-preview-slot" style="margin-top:8px; text-align:left;"></div>
                    </div>
                    <div class="pic-composer-dock-grid">
                        <div class="pic-dock-icon-only-item" onclick="document.getElementById('global-composer-direct-file-input').click()" title="Gambar"><span class="material-symbols-outlined" style="color:#10B981;">photo_library</span></div>
                        <div class="pic-dock-icon-only-item" onclick="App.Features.triggerEmbeddedLinkModalPopup('youtube')" title="YouTube"><span class="material-symbols-outlined" style="color:#FF0000;">play_circle</span></div>
                        <div class="pic-dock-icon-only-item" onclick="App.Features.triggerEmbeddedLinkModalPopup('facebook')" title="FB Video"><span class="material-symbols-outlined" style="color:#1877F2;">smart_display</span></div>
                        <div class="pic-dock-icon-only-item" onclick="App.Features.openNativeLocationPickerPopupModal()" title="Lokasi"><span class="material-symbols-outlined" style="color:#EA4335;">location_on</span></div>
                        <div class="pic-dock-icon-only-item" onclick="App.Features.triggerEmbeddedLinkModalPopup('all')" title="Link Media"><span class="material-symbols-outlined">link</span></div>
                    </div>
                </div>
            `;
            App.Modal.open(null, popupFormHTML, true, true);
            App.Features.syncComposerSubmitButtonState();
        },

        handleComposerLiveTextChange() {
            this.syncComposerSubmitButtonState();
            const txt = document.getElementById('composer-text')?.value || '';
            const previewArea = document.getElementById('composer-upload-preview-area');
            if (!composerSelectedFile && previewArea) {
                const embedHTML = this.extractAndRenderEmbeddedMedia(txt, window.lastEmbeddedMediaUrl);
                previewArea.innerHTML = embedHTML || '';
            }
        },

        syncComposerSubmitButtonState() {
            const txt = document.getElementById('composer-text')?.value.trim();
            const submitBtn = document.getElementById('pic-submit-btn');
            if (!submitBtn) return;
            if (txt || composerSelectedFile || window.lastEmbeddedMediaUrl) submitBtn.classList.add('ready');
            else submitBtn.classList.remove('ready');
        },

        closeComposerAndClearCache() { composerSelectedFile = null; activeComposerLocation = ""; App.Modal.close(); },

        openNativeLocationPickerPopupModal() {
            const locationModalHTML = `
                <div style="display:flex; flex-direction:column; gap:16px; text-align:center; padding:12px;">
                    <span class="material-symbols-outlined" style="font-size:48px; color:var(--primary);">gps_fixed</span>
                    <h3 style="font-size:1.1rem; font-weight:800;">Verifikasi Lokasi Sensor</h3>
                    <p style="font-size:0.88rem; color:var(--text-muted);">Sistem menandai lokasi riil GPS Handphone Anda.</p>
                    <button class="btn btn-primary btn-full" onclick="App.Features.detectDeviceGPSLocationAction()">Ambil Lokasi HP Sekarang</button>
                </div>`;
            App.Modal.openSecondary("Kunci Koordinat", locationModalHTML);
        },

        detectDeviceGPSLocationAction() {
            if (navigator.geolocation) {
                App.Toast.show("Menghubungi satelit GPS...", "info");
                navigator.geolocation.getCurrentPosition(async (position) => {
                    const lat = position.coords.latitude;
                    const lon = position.coords.longitude;
                    try {
                        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
                        const data = await response.json();
                        if (data && data.display_name) {
                            activeComposerLocation = data.display_name;
                            App.Features.renderComposerLocationBadgeDOM(data.display_name.split(',')[0]);
                        } else {
                            activeComposerLocation = `Lokasi HP (${lat.toFixed(3)}, ${lon.toFixed(3)})`;
                            App.Features.renderComposerLocationBadgeDOM(activeComposerLocation);
                        }
                    } catch(e) {
                        activeComposerLocation = `Lokasi HP (${lat.toFixed(3)}, ${lon.toFixed(3)})`;
                        App.Features.renderComposerLocationBadgeDOM(activeComposerLocation);
                    }
                    App.Modal.closeSecondaryPopupModal();
                }, () => {
                    activeComposerLocation = App.ProfileState.getCurrentDomisili();
                    App.Features.renderComposerLocationBadgeDOM(activeComposerLocation);
                    App.Modal.closeSecondaryPopupModal();
                });
            }
        },

        renderComposerLocationBadgeDOM(shortName) {
            const previewBadgeSlot = document.getElementById('composer-location-badge-preview-slot');
            if (previewBadgeSlot) {
                previewBadgeSlot.innerHTML = `
                    <div style="display: inline-flex; align-items: center; gap: 4px; background: rgba(24, 119, 242, 0.1); color: var(--primary); padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: 700;">
                        <span class="material-symbols-outlined" style="font-size: 14px;">location_on</span>
                        ${sanitizeHTML(shortName)}
                    </div>`;
            }
        },

        triggerEmbeddedLinkModalPopup(type = 'all') {
            let title = "Sematkan Link Media";
            let label = "URL Youtube / FB Video / MP3";
            let placeholder = "https://...";
            const html = `
                <div style="display:flex; flex-direction:column; gap:14px;">
                    <div class="form-group" style="margin-bottom:0;">
                        <input type="text" id="popup-sub-media-url-field" class="form-input" placeholder="${placeholder}">
                        <label class="form-label">${label}</label>
                    </div>
                    <button class="btn btn-primary btn-full" onclick="App.Features.saveEmbeddedLinkFromPopup()">Sematkan</button>
                </div>`;
            App.Modal.openSecondary(title, html);
        },

        saveEmbeddedLinkFromPopup() {
            const url = document.getElementById('popup-sub-media-url-field')?.value.trim();
            window.lastEmbeddedMediaUrl = url || "";
            App.Modal.closeSecondaryPopupModal();
            if(url) { App.Toast.show("Link media tersemat", "success"); App.Features.handleComposerLiveTextChange(); }
        },

        handleHeaderLiveSearchInput(event) { 
            headerSearchFilterQueryString = event.target.value.trim().toLowerCase(); 
            if(window.location.hash !== '#/feed' && window.location.hash !== '') App.Router.navigate('feed');
            else { feedCurrentPage = 0; feedHasMorePosts = true; this.renderPosts(false); }
        },

        openSocialMediaShareSheetModal(postId, postAuthor, textContext, hasImage) {
            App.Features.incrementGlobalShareCounter(postId, postAuthor);
            const encodedLink = "https://mastrisno.my.id/?share";
            const textToShare = `Lihat di Tech Social: "${textContext.substring(0,40)}..."`;
            if (navigator.share && /Android|iPhone|iPad/i.test(navigator.userAgent)) {
                navigator.share({ title: 'Tech Social', text: textToShare, url: encodedLink }); return;
            }
            const modalHTML = `
                <div class="share-grid-sheet">
                    <div class="share-item-node" onclick="App.Features.copyPostLinkToClipboardAction('${encodedLink}')"><div class="share-icon-circle" style="background:#64748b;"><span class="material-symbols-outlined">link</span></div><span>Salin</span></div>
                    <a href="https://api.whatsapp.com/send?text=${encodeURIComponent(textToShare)}%20${encodeURIComponent(encodedLink)}" target="_blank" class="share-item-node" onclick="App.Modal.close()"><div class="share-icon-circle" style="background:#25D366;"><span class="material-symbols-outlined">chat</span></div><span>WhatsApp</span></a>
                </div>`;
            App.Modal.open("Bagikan Konten", modalHTML, true, false);
        },

        async incrementGlobalShareCounter(postId, postAuthor) {
            try {
                const { data } = await supabaseClient.from('posts').select('shared_count').eq('id', Number(postId)).single();
                const currentCount = data ? (data.shared_count || 0) : 0;
                await supabaseClient.from('posts').update({ shared_count: currentCount + 1 }).eq('id', Number(postId));
                if (postAuthor !== App.ProfileState.getCurrentName()) {
                    await App.Features.pushCloudNotificationPayload(postAuthor, 'share', `membagikan postingan Anda.`, postId);
                }
                this.renderPosts(false);
            } catch(e) {}
        },

        copyPostLinkToClipboardAction(url) { navigator.clipboard.writeText(url); App.Toast.show("Tautan disalin!", "success"); App.Modal.close(); },

        triggerCreateCommunityPremiumModal() {
            const html = `<div class="form-group"><input type="text" class="form-input" id="new-comm-title" placeholder=" " required><label class="form-label">Nama Komunitas</label></div><button class="btn btn-primary btn-full" onclick="App.Features.processPremiumCommunityPaymentAction()">Buat</button>`;
            App.Modal.open("Buat Komunitas", html, true, false);
        },

        processPremiumCommunityPaymentAction() {
            const title = document.getElementById('new-comm-title')?.value.trim(); if(!title) return;
            let list = JSON.parse(localStorage.getItem('ns_premium_communities_logs') || '[]');
            list.push({ id: Date.now(), title, creator: App.ProfileState.getCurrentName() });
            localStorage.setItem('ns_premium_communities_logs', JSON.stringify(list)); App.Modal.close(); this.renderCommunityHubViewportList();
        },

        renderCommunityHubViewportList() {
            const container = document.getElementById('community-hub-list-viewport'); if(!container) return;
            let list = JSON.parse(localStorage.getItem('ns_premium_communities_logs') || '[]');
            container.innerHTML = list.map(c => `<div class="community-card-item glass-card" style="display:flex; align-items:center; gap:16px; padding:16px; margin-bottom:12px;"><div style="width:50px; height:50px; background:#f0f2f5; display:flex; align-items:center; justify-content:center; border-radius:12px; font-weight:800; color:var(--primary); font-size:1.2rem;">${c.title.charAt(0).toUpperCase()}</div><div><h3>${sanitizeHTML(c.title)}</h3><p style="font-size:0.8rem; color:var(--text-muted);">Pemilik: ${sanitizeHTML(c.creator)}</p></div></div>`).join('');
        },

        async fetchMyFriendsData() { 
            try {
                const myName = App.ProfileState.getCurrentName();
                const { data } = await supabaseClient.from('follows').select('following').eq('follower', myName);
                if(data) window.userFriendsList = data.map(item => item.following);
            } catch(e) { window.userFriendsList = []; }
        }, 

        async loadPopupFriendsListSidebar() {
            const container = document.getElementById('popup-friends-sidebar-items'); if(!container) return;
            await App.Features.fetchMyFriendsData();
            await fetchRegisteredUsersListFromSupabase();
            
            let dynamicContacts = window.userFriendsList.length > 0 ? ['Mastrisno_AI', ...window.userFriendsList] : ['Mastrisno_AI', 'Agung_Taufiq'];
            
            container.innerHTML = dynamicContacts.map(name => {
                const hasUnread = unreadMessageCounters[name.toLowerCase()] || 0;
                const safeName = escapeJSString(name);
                const isAI = (name === 'Mastrisno_AI');
                
                const pObj = window.profilesCacheMap[name.toLowerCase()];
                let contactAvatar = DEFAULT_AVATAR_IMAGE;
                if (isAI) contactAvatar = 'https://cdn-icons-png.flaticon.com/512/8943/8943377.png';
                else if (pObj && pObj.avatar_url) contactAvatar = pObj.avatar_url;

                return `
                    <div class="popup-friend-item" onclick="App.Features.openSpecificFriendPopupObrolan('${safeName.toLowerCase()}@nexsocial.id', '${safeName}')">
                        <div class="friend-avatar-wrapper">
                            <img src="${contactAvatar}" class="friend-avatar-node" onclick="event.stopPropagation(); App.UI.toggleChatPopup(false); App.Router.navigate('profil?name=${encodeURIComponent(safeName)}')">
                            <span class="friend-online-dot"></span>
                        </div>
                        <div class="friend-chat-meta-info">
                            <div class="friend-chat-meta-top"><strong onclick="event.stopPropagation(); App.UI.toggleChatPopup(false); App.Router.navigate('profil?name=${encodeURIComponent(safeName)}')">${name === 'Mastrisno_AI' ? 'Mastrisno AI' : sanitizeHTML(name)} ${isAI ? '🤖' : ''}</strong></div>
                            <div class="friend-chat-meta-bottom"><span class="friend-chat-meta-preview">${isAI ? 'Asisten AI' : 'Klik untuk mengobrol'}</span>${hasUnread > 0 ? `<div class="chat-unread-badge">${hasUnread}</div>` : ''}</div>
                        </div>
                    </div>`;
            }).join('');
        },

        async openSpecificFriendPopupObrolan(friendEmail, friendName) {
            activeChatFriendEmail = friendEmail; activeChatFriendName = friendName;
            localStorage.setItem('ns_active_chat_email', friendEmail);
            localStorage.setItem('ns_active_chat_name', friendName);

            unreadMessageCounters[friendName.toLowerCase()] = 0;
            App.Navigation.updateChatBadgeDOM();

            document.getElementById('chat-contacts-list-sidebar-container').classList.add('hidden');
            document.getElementById('popup-chat-header-title').innerText = (friendName === 'Mastrisno_AI' ? 'Mastrisno AI 🤖' : friendName);
            document.getElementById('chat-back-to-list-btn').style.display = "inline-flex";
            
            const actionSlot = document.getElementById('chat-header-actions-slot');
            if(actionSlot) actionSlot.style.display = "flex";

            const mainArea = document.getElementById('popup-chat-main-area-pane'); if(!mainArea) return;
            mainArea.classList.add('active');
            
            mainArea.innerHTML = `
                <div class="popup-msg-stream" id="popup-msg-stream-viewport">
                    <div style="flex:1; display:flex; align-items:center; justify-content:center; color:var(--text-muted); font-size:0.85rem;">Memuat...</div>
                </div>
                <div class="popup-chat-input-row">
                    <input type="text" class="form-input" placeholder="Ketik pesan..." id="popup-chat-input-field" onkeypress="if(event.key==='Enter') App.Features.sendPopupChatCloudAction()" style="border-radius:20px; padding:10px 14px; margin-bottom:0; font-size:0.9rem; background:#f0f2f5;">
                    <button class="icon-btn" style="background:var(--primary); color:white; width:34px; height:34px;" onclick="App.Features.sendPopupChatCloudAction()"><span class="material-symbols-outlined" style="font-size:16px;">send</span></button>
                </div>`;
            
            await App.Features.fetchChatMessagesAndRenderStream();
        },

        async fetchChatMessagesAndRenderStream() {
            const viewport = document.getElementById('popup-msg-stream-viewport');
            if (!viewport || !activeChatFriendName) return;
            
            const myName = App.ProfileState.getCurrentName();
            const myAvatar = App.ProfileState.getCurrentAvatar();
            let friendAvatar = (activeChatFriendName === 'Mastrisno_AI') ? 'https://cdn-icons-png.flaticon.com/512/8943/8943377.png' : DEFAULT_AVATAR_IMAGE;

            try {
                if(activeChatFriendName !== 'Mastrisno_AI') {
                    const { data: fProfile } = await supabaseClient.from('profiles').select('avatar_url').eq('display_name', activeChatFriendName).maybeSingle();
                    if (fProfile && fProfile.avatar_url) friendAvatar = fProfile.avatar_url;
                }

                const { data: messages, error } = await supabaseClient
                    .from('chats')
                    .select('*')
                    .or(`and(sender.eq."${myName}",receiver.eq."${activeChatFriendName}"),and(sender.eq."${activeChatFriendName}",receiver.eq."${myName}")`)
                    .order('created_at', { ascending: true });

                if (error) throw error;

                if (!messages || messages.length === 0) {
                    viewport.innerHTML = `<div style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; color:var(--text-muted); font-size:0.85rem; padding:20px; text-align:center;">Belum ada pesan dengan <strong>${sanitizeHTML(activeChatFriendName)}</strong>.</div>`;
                    return;
                }

                viewport.innerHTML = messages.map(m => {
                    const isOut = m.sender === myName;
                    const timeStr = m.created_at ? new Date(m.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : 'Baru saja';
                    const safeMsg = escapeJSString(m.message);
                    const parsedChatText = parseMentionsToClickableLinks(m.message);
                    const safeSender = escapeJSString(m.sender);

                    return `
                        <div class="chat-row-item ${isOut ? 'out' : 'in'}">
                            <div class="chat-user-header">
                                <img src="${isOut ? myAvatar : friendAvatar}" class="chat-avatar-mini" alt="${sanitizeHTML(m.sender)}" onclick="App.UI.toggleChatPopup(false); App.Router.navigate('profil?name=${encodeURIComponent(safeSender)}')">
                                <span class="chat-user-name" onclick="App.UI.toggleChatPopup(false); App.Router.navigate('profil?name=${encodeURIComponent(safeSender)}')">${isOut ? sanitizeHTML(myName) : sanitizeHTML(m.sender)}</span>
                            </div>
                            <div class="bubble-wrapper ${isOut ? 'out' : 'in'}">
                                <div class="bubble ${isOut ? 'out' : 'in'}"><span>${parsedChatText}</span></div>
                                <div class="chat-time-stamp">
                                    <span>${timeStr}</span>
                                    ${isOut || App.ProfileState.isSuperAdmin() ? `
                                        • <button class="bubble-action-btn" onclick="App.Features.editSingleChatMessageAction(${m.id}, '${safeMsg}')">Edit</button>
                                        • <button class="bubble-action-btn delete" onclick="App.Features.deleteSingleChatMessageAction(${m.id})">Hapus</button>
                                    ` : ''}
                                </div>
                            </div>
                        </div>`;
                }).join('');
                viewport.scrollTop = viewport.scrollHeight;
            } catch(err) {}
        },

        async sendPopupChatCloudAction() {
            const input = document.getElementById('popup-chat-input-field'); 
            if (!input || !input.value.trim() || !activeChatFriendName) return;
            const msgText = input.value.trim(); const myName = App.ProfileState.getCurrentName();
            
            if(activeChatFriendName === 'Mastrisno_AI' && !localStorage.getItem('ns_gemini_api_key')) {
                App.Features.openGeminiApiKeyModalForm(); return;
            }
            input.value = '';

            try {
                await supabaseClient.from('chats').insert([{ sender: myName, receiver: activeChatFriendName, message: msgText }]);
                await detectAndNotifyMentions(msgText, 'mention');
                await App.Features.fetchChatMessagesAndRenderStream();

                if(activeChatFriendName === 'Mastrisno_AI') {
                    const userApiKey = localStorage.getItem('ns_gemini_api_key');
                    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${userApiKey}`;
                    
                    try {
                        const response = await fetch(url, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ contents: [{ parts: [{ text: msgText }] }] })
                        });
                        const data = await response.json();
                        let replyAI = data?.candidates?.[0]?.content?.parts?.[0]?.text || "Maaf, AI tidak merespons.";
                        await supabaseClient.from('chats').insert([{ sender: 'Mastrisno_AI', receiver: myName, message: replyAI }]);
                        await App.Features.fetchChatMessagesAndRenderStream();
                    } catch (aiErr) {
                        await supabaseClient.from('chats').insert([{ sender: 'Mastrisno_AI', receiver: myName, message: "Koneksi AI gagal." }]);
                        await App.Features.fetchChatMessagesAndRenderStream();
                    }
                }
            } catch(err) {}
        },

        async editSingleChatMessageAction(messageId, currentText) {
            const newText = prompt("Edit pesan:", currentText);
            if (newText === null || !newText.trim() || newText.trim() === currentText) return;
            try {
                await supabaseClient.from('chats').update({ message: newText.trim() }).eq('id', messageId);
                App.Toast.show("Pesan diperbarui!", "success");
                await App.Features.fetchChatMessagesAndRenderStream();
            } catch(err) { App.Toast.show("Gagal mengedit", "danger"); }
        },

        async deleteSingleChatMessageAction(messageId) {
            if (!confirm("Hapus pesan ini?")) return;
            try {
                await supabaseClient.from('chats').delete().eq('id', messageId);
                App.Toast.show("Pesan dihapus", "info");
                await App.Features.fetchChatMessagesAndRenderStream();
            } catch(err) { App.Toast.show("Gagal menghapus", "danger"); }
        },

        async triggerDeleteChatHistoryAction() {
            if (!activeChatFriendName) return;
            if (!confirm(`Hapus seluruh riwayat percakapan?`)) return;
            const myName = App.ProfileState.getCurrentName();
            try {
                await supabaseClient.from('chats').delete().or(`and(sender.eq."${myName}",receiver.eq."${activeChatFriendName}"),and(sender.eq."${activeChatFriendName}",receiver.eq."${myName}")`);
                App.Toast.show("Riwayat dibersihkan", "success");
                await App.Features.fetchChatMessagesAndRenderStream();
            } catch(err) { App.Toast.show("Gagal membersihkan", "danger"); }
        },

        closeActiveChatSessionAndReturnToList() {
            activeChatFriendEmail = null; activeChatFriendName = null;
            localStorage.removeItem('ns_active_chat_email'); localStorage.removeItem('ns_active_chat_name');
            document.getElementById('chat-contacts-list-sidebar-container').classList.remove('hidden');
            document.getElementById('popup-chat-main-area-pane').classList.remove('active');
            document.getElementById('popup-chat-header-title').innerText = "Obrolan";
            document.getElementById('chat-back-to-list-btn').style.display = "none";
            const actionSlot = document.getElementById('chat-header-actions-slot');
            if(actionSlot) actionSlot.style.display = "none";
            this.loadPopupFriendsListSidebar();
        },

        openPostActionMenuDOM(postId, postAuthor) {
            const myName = App.ProfileState.getCurrentName();
            const isSuperAdmin = App.ProfileState.isSuperAdmin();
            let html = '';
            const safeAuthor = escapeJSString(postAuthor);
            
            if (postAuthor === myName || isSuperAdmin) {
                html = `
                    <div style="display:flex; flex-direction:column; gap:10px;">
                        <button class="btn btn-secondary btn-full" onclick="App.Features.updatePostPrivacy(${postId}, 'public')"><span class="material-symbols-outlined">public</span> Privasi: Publik</button>
                        <button class="btn btn-secondary btn-full" onclick="App.Features.updatePostPrivacy(${postId}, 'friends')"><span class="material-symbols-outlined">group</span> Privasi: Teman</button>
                        <button class="btn btn-secondary btn-full" onclick="App.Features.updatePostPrivacy(${postId}, 'private')"><span class="material-symbols-outlined">lock</span> Privasi: Privat</button>
                        <button class="btn btn-secondary btn-full" onclick="App.Features.triggerPostTextEditAction(${postId})"><span class="material-symbols-outlined">edit</span> Edit Konten</button>
                        <button class="btn btn-secondary btn-full" style="color:var(--danger);" onclick="App.Features.triggerPostAbsoluteDeleteAction(${postId})"><span class="material-symbols-outlined">delete</span> Hapus Postingan</button>
                    </div>`;
            } else {
                html = `
                    <div style="display:flex; flex-direction:column; gap:10px;">
                        <button class="btn btn-secondary btn-full" onclick="App.Modal.close(); App.Features.toggleLike(${postId}, '${safeAuthor}')"><span class="material-symbols-outlined">thumb_up</span> Sukai Postingan</button>
                        <button class="btn btn-secondary btn-full" onclick="App.Modal.close(); App.Router.navigate('profil?name=${encodeURIComponent(postAuthor)}')"><span class="material-symbols-outlined">account_circle</span> Lihat Profil ${sanitizeHTML(postAuthor)}</button>
                    </div>`;
            }
            App.Modal.open("Opsi Pengaturan", html, true, false);
        },

        async updatePostPrivacy(postId, val) {
            App.Modal.close();
            try {
                await supabaseClient.from('posts').update({ privacy: val }).eq('id', Number(postId));
                App.Toast.show("Privasi diperbarui", "success"); this.renderPosts(false);
            } catch (e) {}
        },

        async triggerPostTextEditAction(postId) {
            App.Modal.close(); 
            try {
                const { data: post } = await supabaseClient.from('posts').select('content').eq('id', Number(postId)).single();
                if (!post) return;

                const editFormHTML = `
                    <div style="text-align: left; display: flex; flex-direction: column; gap: 16px;">
                        <div class="form-group" style="margin-bottom: 0;">
                            <textarea id="custom-edit-textarea-field" class="form-input" style="min-height: 150px; padding-top: 16px; resize: none;" required>${post.content || ''}</textarea>
                        </div>
                        <button class="btn btn-primary btn-full" onclick="App.Features.submitCustomEditedContentCloudAction(${postId})">Simpan Perubahan</button>
                    </div>`;

                App.Modal.open("Edit Konten Status", editFormHTML, true, false);
            } catch(err) { App.Toast.show("Gagal memuat konten pos", "danger"); }
        },

        async submitCustomEditedContentCloudAction(postId) {
            const editedTextValue = document.getElementById('custom-edit-textarea-field')?.value.trim();
            if (!editedTextValue) { App.Toast.show("Teks tidak boleh kosong!", "danger"); return; }
            try {
                await supabaseClient.from('posts').update({ content: editedTextValue }).eq('id', Number(postId));
                await detectAndNotifyMentions(editedTextValue, 'mention', postId);
                App.Modal.close(); App.Toast.show("Berhasil diperbarui!", "success"); this.renderPosts(false);
            } catch(err) { App.Toast.show("Gagal memperbarui status", "danger"); }
        },

        async triggerPostAbsoluteDeleteAction(postId) {
            App.Modal.close(); 
            if(!confirm("Hapus postingan ini?")) return;
            try {
                await supabaseClient.from('comments').delete().eq('post_id', Number(postId));
                await supabaseClient.from('posts').delete().eq('id', Number(postId));
                App.Toast.show("Postingan dihapus", "success"); 
                setTimeout(() => { this.renderPosts(false); this.renderRealtimeStoriesCarousel(); }, 200);
            } catch(e) { App.Toast.show("Gagal menghapus", "danger"); }
        },

        extractAndRenderEmbeddedMedia(contentString, directMediaUrl, attachedImage = null, postId = null, postAuthor = '', postAvatar = '') {
            let textToCheck = contentString || "";
            let combinedUrl = directMediaUrl || "";
            
            if (!combinedUrl) {
                const youtubeRegex = /(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)[^\s]+)/gi;
                const facebookRegex = /(https?:\/\/(?:www\.)?(?:facebook\.com\/[^\s]+\/videos\/[^\s]+|facebook\.com\/watch[^\s]*|fb\.watch\/[^\s]+))/gi;
                const mp3Regex = /(https?:\/\/[^\s]+\.(?:mp3|wav|ogg))/gi;
                
                const ytMatch = textToCheck.match(youtubeRegex);
                const fbMatch = textToCheck.match(facebookRegex);
                const mp3Match = textToCheck.match(mp3Regex);
                
                if (ytMatch && ytMatch.length > 0) combinedUrl = ytMatch[0];
                else if (fbMatch && fbMatch.length > 0) combinedUrl = fbMatch[0];
                else if (mp3Match && mp3Match.length > 0) combinedUrl = mp3Match[0];
            }

            if (attachedImage && combinedUrl && /\.(mp3|wav|ogg)/i.test(combinedUrl)) {
                return `
                    <div class="post-image-audio-wrapper" onclick="App.Features.toggleAudioPhotoPlayback('${postId}', '${combinedUrl}')">
                        <img src="${attachedImage}" class="post-attached-image">
                        <div class="audio-photo-badge" id="audio-badge-${postId}">
                            <span class="material-symbols-outlined">music_note</span>
                            <span class="audio-text-lbl">Klik Foto Untuk Lagu 🎵</span>
                        </div>
                        <audio id="photo-audio-${postId}" class="post-audio-node" src="${combinedUrl}" preload="none" loop></audio>
                    </div>`;
            }

            if (combinedUrl) {
                if (combinedUrl.includes('youtube.com') || combinedUrl.includes('youtu.be')) {
                    let videoId = "";
                    if (combinedUrl.includes('v=')) videoId = combinedUrl.split('v=')[1].split('&')[0];
                    else if (combinedUrl.includes('youtu.be/')) videoId = combinedUrl.split('youtu.be/')[1].split('?')[0];
                    return videoId ? `<iframe src="https://www.youtube.com/embed/${videoId}?modestbranding=1&rel=0&showinfo=0" allowfullscreen style="width:100%; height:260px; border-radius:12px;"></iframe>` : '';
                } else if (combinedUrl.includes('facebook.com') || combinedUrl.includes('fb.watch')) {
                    const fbEmbedUrl = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(combinedUrl)}&show_text=false&width=500`;
                    return `<iframe src="${fbEmbedUrl}" style="border:none;overflow:hidden; width:100%; height:260px; border-radius:12px;" scrolling="no" frameborder="0" allowfullscreen="true"></iframe>`;
                } else if (/\.(mp3|wav|ogg)/i.test(combinedUrl)) {
                    return `<audio controls style="width:100%; margin: 12px 0;"><source src="${combinedUrl}"></audio>`;
                }
            }

            if (attachedImage) {
                return `<img src="${attachedImage}" class="post-attached-image" onclick="App.UI.openImageLightbox('${attachedImage}', ${postId}, '${postAuthor}', '${postAvatar}')">`;
            }

            return "";
        },

        /* EXPAND TEXT UNTUK POSTINGAN PANJANG (>140 KARAKTER) */
        cleanTextContentForDisplay(rawText, postId = null) {
            if (!rawText) return "";
            const youtubeRegex = /(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)[^\s]+)/gi;
            const facebookRegex = /(https?:\/\/(?:www\.)?(?:facebook\.com\/[^\s]+\/videos\/[^\s]+|facebook\.com\/watch[^\s]*|fb\.watch\/[^\s]+))/gi;
            const mp3Regex = /(https?:\/\/[^\s]+\.(?:mp3|wav|ogg))/gi;
            
            let cleaned = rawText.replace(youtubeRegex, '').replace(facebookRegex, '').replace(mp3Regex, '').trim();
            const parsedMentions = parseMentionsToClickableLinks(cleaned);

            if (cleaned.length > 140 && postId) {
                const shortCleaned = cleaned.substring(0, 140);
                const parsedShort = parseMentionsToClickableLinks(shortCleaned);
                
                return `
                    <span id="post-text-short-${postId}">${parsedShort}... <span class="post-expand-btn" onclick="document.getElementById('post-text-short-${postId}').style.display='none'; document.getElementById('post-text-full-${postId}').style.display='inline';">... lainnya</span></span>
                    <span id="post-text-full-${postId}" style="display:none;">${parsedMentions}</span>
                `;
            }

            return parsedMentions;
        },

        async renderPosts(append = false) {
            const stream = document.getElementById('feed-stream'); if(!stream) return;
            if (feedIsLoadingMore) return;
            feedIsLoadingMore = true;

            if (!append) feedCurrentPage = 0;
            const fromRange = feedCurrentPage * FEED_PAGE_SIZE;
            const toRange = fromRange + FEED_PAGE_SIZE - 1;

            try {
                const { data: posts } = await supabaseClient
                    .from('posts')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .range(fromRange, toRange);
                
                const { data: commentsData } = await supabaseClient.from('comments').select('*');
                const allComments = commentsData || [];
                const myName = App.ProfileState.getCurrentName();
                let fetched = posts || [];

                if (fetched.length < FEED_PAGE_SIZE) feedHasMorePosts = false;
                await App.Features.fetchMyFriendsData();

                fetched = fetched.filter(p => {
                    if (!p.privacy || p.privacy === 'public' || App.ProfileState.isSuperAdmin()) return true;
                    if (p.privacy === 'private') return p.author === myName;
                    if (p.privacy === 'friends') return (p.author === myName || window.userFriendsList.includes(p.author));
                    return true;
                });

                if (headerSearchFilterQueryString) {
                    fetched = fetched.filter(p => (p.content || '').toLowerCase().includes(headerSearchFilterQueryString) || (p.author || '').toLowerCase().includes(headerSearchFilterQueryString));
                }

                if (!append && fetched.length === 0) {
                    stream.innerHTML = `<div class="glass-card" style="text-align:center; color:var(--text-muted); padding:32px 16px; border:none; background:transparent;">Belum ada status.</div>`; 
                    feedIsLoadingMore = false;
                    return;
                }

                const generatedHTML = fetched.map(p => {
                    const postComments = allComments.filter(c => c.post_id === p.id);
                    let totalCommentsCount = postComments.length;
                    postComments.forEach(c => { if (c.replies && Array.isArray(c.replies)) totalCommentsCount += c.replies.length; });

                    let postLikesArray = p.liked_users || [];
                    const hasLiked = postLikesArray.includes(myName) ? 'liked' : '';
                    const hasLoved = (p.loved_users || []).includes(myName) ? 'loved' : '';
                    
                    const safeAuthor = escapeJSString(p.author);
                    const postAvatar = (p.avatar && p.avatar !== 'null') ? p.avatar : DEFAULT_AVATAR_IMAGE;
                    const mediaHTML = this.extractAndRenderEmbeddedMedia(p.content || "", p.media_url, p.image, p.id, safeAuthor, postAvatar);

                    const privacyType = p.privacy || 'public';
                    const privacyIcon = privacyType === 'private' ? 'lock' : (privacyType === 'friends' ? 'group' : 'public');
                    const privacyTitle = privacyType === 'private' ? 'Privat' : (privacyType === 'friends' ? 'Teman' : 'Publik');

                    const formattedPostText = this.cleanTextContentForDisplay(p.content || '', p.id);
                    const wetonStr = getWetonJawa(p.created_at);
                    
                    const pUserObj = window.profilesCacheMap[p.author.toLowerCase()];
                    const birthdayIcon = (pUserObj && isBirthdayToday(pUserObj.birth_date)) ? ' 🎂' : '';

                    return `
                        <div class="post-card" id="post-element-node-${p.id}">
                            <div class="post-header">
                                <div class="post-author">
                                    <img src="${postAvatar}" class="post-avatar" onclick="App.Router.navigate('profil?name=${encodeURIComponent(p.author)}')">
                                    <div class="post-meta-container">
                                        <div class="post-author-row">
                                            <h4 onclick="App.Router.navigate('profil?name=${encodeURIComponent(p.author)}')">${sanitizeHTML(p.author)}${birthdayIcon}</h4>
                                            <span class="post-meta-dot">•</span>
                                            <span class="post-live-time-tracker" data-timestamp="${new Date(p.created_at).getTime()}">${App.UI.calculateRelativeTimeAgo(new Date(p.created_at).getTime())}</span>
                                            <span class="post-meta-dot">•</span>
                                            <span class="material-symbols-outlined" style="font-size:14px; color:var(--text-muted); vertical-align:middle;" title="${privacyTitle}">${privacyIcon}</span>
                                        </div>
                                        ${wetonStr ? `<div class="post-weton-tag">${wetonStr}</div>` : ''}
                                    </div>
                                </div>
                                <button class="post-menu-trigger" onclick="App.Features.openPostActionMenuDOM(${p.id}, '${safeAuthor}')"><span class="material-symbols-outlined">more_vert</span></button>
                            </div>
                            <div class="post-content">${formattedPostText}</div>
                            ${mediaHTML}
                            <div class="post-actions-bar">
                                <div class="post-action-item ${hasLiked}" id="like-btn-node-${p.id}" onclick="App.Features.toggleLike(${p.id}, '${safeAuthor}')"><span class="material-symbols-outlined">thumb_up</span><span id="like-count-node-${p.id}"> ${postLikesArray.length}</span></div>
                                <div class="post-action-item ${hasLoved}" id="love-btn-node-${p.id}" onclick="App.Features.toggleLoveReaction(${p.id}, '${safeAuthor}')"><span class="material-symbols-outlined">favorite</span><span id="love-count-node-${p.id}"> ${(p.loved_users || []).length}</span></div>
                                <div class="post-action-item" onclick="App.Features.openCommentsBottomSheet(${p.id}, '${safeAuthor}')"><span class="material-symbols-outlined">comment</span><span id="comment-count-node-${p.id}"> Komentar (${totalCommentsCount})</span></div>
                                <div class="post-action-item" onclick="App.Features.openSocialMediaShareSheetModal(${p.id}, '${safeAuthor}', '${(p.content || "").replace(/'/g, "\\'")}', ${!!p.image})"><span class="material-symbols-outlined">share</span><span> ${p.shared_count || 0}</span></div>
                            </div>
                        </div>`;
                }).join('');

                if (append) {
                    const container = stream.querySelector('.feed-container');
                    if (container) container.insertAdjacentHTML('beforeend', generatedHTML);
                } else {
                    stream.innerHTML = `<div class="feed-container">${generatedHTML}</div>`;
                }
            } catch (err) {}
            
            feedIsLoadingMore = false;
        },

        async toggleLike(postId, postAuthor) {
            const myName = App.ProfileState.getCurrentName();
            try {
                const { data: post } = await supabaseClient.from('posts').select('liked_users').eq('id', Number(postId)).single();
                let currentLikes = post?.liked_users || [];
                let isAdding = false;
                if (currentLikes.includes(myName)) {
                    currentLikes = currentLikes.filter(u => u !== myName);
                } else {
                    currentLikes.push(myName);
                    isAdding = true;
                }
                await supabaseClient.from('posts').update({ liked_users: currentLikes }).eq('id', Number(postId));
                if (isAdding && postAuthor !== myName) {
                    await App.Features.pushCloudNotificationPayload(postAuthor, 'like', 'menyukai postingan Anda.', postId);
                }
                this.renderPosts(false);
                if (window.location.hash.includes('#/profil')) App.Router.handleRoute();
            } catch(e) {}
        },

        async toggleLoveReaction(postId, postAuthor) {
            const myName = App.ProfileState.getCurrentName();
            try {
                const { data: post } = await supabaseClient.from('posts').select('loved_users').eq('id', Number(postId)).single();
                let currentLoves = post?.loved_users || [];
                let isAdding = false;
                if (currentLoves.includes(myName)) {
                    currentLoves = currentLoves.filter(u => u !== myName);
                } else {
                    currentLoves.push(myName);
                    isAdding = true;
                }
                await supabaseClient.from('posts').update({ loved_users: currentLoves }).eq('id', Number(postId));
                if (isAdding && postAuthor !== myName) {
                    await App.Features.pushCloudNotificationPayload(postAuthor, 'love', 'memberikan reaksi cinta pada postingan Anda.', postId);
                }
                this.renderPosts(false);
                if (window.location.hash.includes('#/profil')) App.Router.handleRoute();
            } catch(e) {}
        },

        async toggleCommentLikeAction(commentId, commentAuthor) {
            const myName = App.ProfileState.getCurrentName();
            try {
                const { data: comment } = await supabaseClient.from('comments').select('likes, post_id').eq('id', commentId).single();
                let currentLikes = comment?.likes || [];
                let isAdding = false;
                if (currentLikes.includes(myName)) currentLikes = currentLikes.filter(u => u !== myName);
                else { currentLikes.push(myName); isAdding = true; }
                await supabaseClient.from('comments').update({ likes: currentLikes }).eq('id', commentId);
                if (isAdding && commentAuthor !== myName) {
                    await App.Features.pushCloudNotificationPayload(commentAuthor, 'like_sub_comment', 'menyukai komentar Anda.', comment?.post_id);
                }
                this.reloadCommentsBottomSheetStreamOnly();
            } catch(e) {}
        },

        async toggleReplyLikeAction(commentId, replyId, replyAuthor) {
            const myName = App.ProfileState.getCurrentName();
            try {
                const { data: comment } = await supabaseClient.from('comments').select('replies, post_id').eq('id', commentId).single();
                let replies = comment?.replies || [];
                let isAdding = false;
                replies = replies.map(r => {
                    if (r.id === replyId) {
                        let likes = r.likes || [];
                        if (likes.includes(myName)) likes = likes.filter(u => u !== myName);
                        else { likes.push(myName); isAdding = true; }
                        return { ...r, likes: likes };
                    }
                    return r;
                });
                await supabaseClient.from('comments').update({ replies: replies }).eq('id', commentId);
                if (isAdding && replyAuthor !== myName) {
                    await App.Features.pushCloudNotificationPayload(replyAuthor, 'like_sub_comment', 'menyukai balasan komentar Anda.', comment?.post_id);
                }
                this.reloadCommentsBottomSheetStreamOnly();
            } catch(e) {}
        },

        async editSingleCommentAction(commentId, currentText) {
            const newText = prompt("Edit komentar:", currentText);
            if (newText === null || !newText.trim() || newText.trim() === currentText) return;
            try {
                await supabaseClient.from('comments').update({ text: newText.trim() }).eq('id', commentId);
                App.Toast.show("Komentar diperbarui", "success");
                this.reloadCommentsBottomSheetStreamOnly();
            } catch(e) { App.Toast.show("Gagal mengedit komentar", "danger"); }
        },

        async deleteSingleCommentAction(commentId) {
            if (!confirm("Hapus komentar ini?")) return;
            try {
                await supabaseClient.from('comments').delete().eq('id', commentId);
                App.Toast.show("Komentar dihapus", "info");
                this.reloadCommentsBottomSheetStreamOnly();
            } catch(e) { App.Toast.show("Gagal menghapus komentar", "danger"); }
        },

        openCommentsBottomSheet(postId, postAuthor) {
            activeBottomSheetPostId = postId; 
            activeReplyTargetCommentId = null; activeReplyTargetUser = null;
            document.getElementById('comments-overlay-bottom-sheet').classList.add('active');
            App.UI.pushModalStateToHistory();
            App.Features.renderBottomSheetInputBar(postAuthor);
            App.Features.reloadCommentsBottomSheetStreamOnly();
        },

        renderBottomSheetInputBar(postAuthor = "") {
            const dockForm = document.getElementById('comments-sheet-input-dock-form'); if (!dockForm) return;
            const safeAuthor = escapeJSString(postAuthor);
            const placeholderText = activeReplyTargetUser ? `Membalas @${activeReplyTargetUser}...` : 'Ketik komentar...';
            
            dockForm.innerHTML = `
                <input type="text" class="form-input" placeholder="${placeholderText}" id="sheet-comment-input-field" style="border-radius:20px; padding:10px 14px; margin-bottom:0; font-size:0.9rem; background:#f0f2f5; color:#050505;">
                <button class="icon-btn" style="background:var(--primary); color:white; width:34px; height:34px;" onclick="App.Features.submitBottomSheetCommentAction('${safeAuthor}')"><span class="material-symbols-outlined" style="font-size:16px;">send</span></button>
            `;
            document.getElementById('sheet-comment-input-field').addEventListener('keypress', (e) => { if (e.key === 'Enter') App.Features.submitBottomSheetCommentAction(postAuthor); });
        },

        async reloadCommentsBottomSheetStreamOnly() {
            if (!activeBottomSheetPostId) return;
            const stream = document.getElementById('comments-sheet-stream-injector'); if (!stream) return;
            try {
                const { data: comments } = await supabaseClient.from('comments').select('*').eq('post_id', activeBottomSheetPostId).order('created_at', { ascending: true });
                const myName = App.ProfileState.getCurrentName();
                const isSuperAdmin = App.ProfileState.isSuperAdmin();

                if (!comments || comments.length === 0) {
                    stream.innerHTML = `<div style="text-align:center; padding:32px; color:var(--text-muted);">Belum ada komentar.</div>`; return;
                }
                stream.innerHTML = comments.map(c => {
                    const isCommentLiked = (c.likes || []).includes(myName) ? 'active' : '';
                    const commentLikesCount = (c.likes || []).length;
                    const commentLikeBadgeHTML = commentLikesCount > 0 ? `👍 ${commentLikesCount}` : `Suka`;
                    const subRepliesList = c.replies || [];
                    const isMyComment = c.user_name === myName;
                    const safeCommentText = escapeJSString(c.text);
                    const safeCommentUser = escapeJSString(c.user_name);
                    
                    const cProfile = window.profilesCacheMap[c.user_name.toLowerCase()];
                    const commentAvatar = (cProfile && cProfile.avatar_url) ? cProfile.avatar_url : DEFAULT_AVATAR_IMAGE;

                    let nestedRepliesHTML = subRepliesList.map(r => {
                        const isReplyLiked = (r.likes || []).includes(myName) ? 'active' : '';
                        const replyLikesCount = (r.likes || []).length;
                        const replyLikeBadgeHTML = replyLikesCount > 0 ? `👍 ${replyLikesCount}` : `Suka`;
                        const safeReplyUser = escapeJSString(r.user);

                        const rProfile = window.profilesCacheMap[r.user.toLowerCase()];
                        const replyAvatar = (rProfile && rProfile.avatar_url) ? rProfile.avatar_url : DEFAULT_AVATAR_IMAGE;

                        return `
                            <div style="display:flex; gap:8px; align-items:flex-start; margin-top:8px; padding-left:12px; border-left:2px solid var(--border-color);">
                                <img src="${replyAvatar}" style="width:26px; height:26px; border-radius:50%; object-fit:cover; cursor:pointer;" onclick="App.Features.closeCommentsBottomSheet(); App.Router.navigate('profil?name=${encodeURIComponent(safeReplyUser)}')">
                                <div>
                                    <div style="background:#f0f2f5; padding:6px 10px; border-radius:12px; border:1px solid var(--border-color);">
                                        <strong style="color:#050505; cursor:pointer;" onclick="App.Features.closeCommentsBottomSheet(); App.Router.navigate('profil?name=${encodeURIComponent(safeReplyUser)}')">${parseMentionsToClickableLinks(r.user)}</strong>
                                        <p style="font-size:0.85rem; margin-top:2px; color:var(--text-main);">${parseMentionsToClickableLinks(r.text)}</p>
                                    </div>
                                    <div style="display:flex; gap:12px; font-size:0.7rem; color:var(--text-muted); margin-top:3px; font-weight:700;">
                                        <span class="reply-like-btn ${isReplyLiked}" style="cursor:pointer;color:var(--primary);" onclick="App.Features.toggleReplyLikeAction('${c.id}', '${r.id}', '${escapeJSString(r.user)}')">${replyLikeBadgeHTML}</span>
                                        <span style="cursor:pointer;" onclick="activeReplyTargetCommentId='${c.id}'; activeReplyTargetUser='${escapeJSString(r.user)}'; App.Features.renderBottomSheetInputBar();">Balas</span>
                                    </div>
                                </div>
                            </div>`;
                    }).join('');

                    return `
                    <div style="display:flex; gap:10px; margin-bottom:12px; text-align:left; flex-direction:column;">
                        <div style="display:flex; gap:10px; align-items:flex-start;">
                            <img src="${commentAvatar}" style="width:34px; height:34px; border-radius:50%; object-fit:cover; cursor:pointer;" onclick="App.Features.closeCommentsBottomSheet(); App.Router.navigate('profil?name=${encodeURIComponent(safeCommentUser)}')">
                            <div>
                                <div style="background:#f0f2f5; padding:8px 12px; border-radius:14px; border:1px solid var(--border-color);">
                                    <strong style="color:#050505; cursor:pointer;" onclick="App.Features.closeCommentsBottomSheet(); App.Router.navigate('profil?name=${encodeURIComponent(safeCommentUser)}')">${parseMentionsToClickableLinks(c.user_name)}</strong>
                                    <p style="font-size:0.9rem; margin-top:2px; color:var(--text-main);">${parseMentionsToClickableLinks(c.text)}</p>
                                </div>
                                <div style="font-size:0.75rem; color:var(--text-muted); margin-top:4px; margin-left:6px; display:flex; gap:12px; font-weight:700;">
                                    <span class="comment-like-btn ${isCommentLiked}" style="cursor:pointer;color:var(--primary);" onclick="App.Features.toggleCommentLikeAction('${c.id}', '${escapeJSString(c.user_name)}')">${commentLikeBadgeHTML}</span>
                                    <span style="cursor:pointer;" onclick="activeReplyTargetCommentId='${c.id}'; activeReplyTargetUser='${escapeJSString(c.user_name)}'; App.Features.renderBottomSheetInputBar();">Balas</span>
                                    ${isMyComment || isSuperAdmin ? `
                                        <span style="cursor:pointer;" onclick="App.Features.editSingleCommentAction('${c.id}', '${safeCommentText}')">Edit</span>
                                        <span style="cursor:pointer; color:var(--danger);" onclick="App.Features.deleteSingleCommentAction('${c.id}')">Hapus</span>
                                    ` : ''}
                                </div>
                            </div>
                        </div>
                        <div style="padding-left:44px;">${nestedRepliesHTML}</div>
                    </div>`;
                }).join('');
                stream.scrollTop = stream.scrollHeight;
            } catch(ex) {}
        },

        async submitBottomSheetCommentAction(postAuthor) {
            const input = document.getElementById('sheet-comment-input-field'); if (!input || !input.value.trim()) return;
            let text = input.value.trim(); const myName = App.ProfileState.getCurrentName();
            try {
                if (activeReplyTargetCommentId) {
                    text = `@${activeReplyTargetUser} ${text}`;
                    const { data } = await supabaseClient.from('comments').select('user_name, replies').eq('id', activeReplyTargetCommentId).single();
                    let currentReplies = data?.replies || [];
                    currentReplies.push({ id: `r_${Date.now()}`, user: myName, text: text, date: Date.now(), likes: [] });
                    await supabaseClient.from('comments').update({ replies: currentReplies }).eq('id', activeReplyTargetCommentId);
                    
                    await this.pushCloudNotificationPayload(activeReplyTargetUser, 'sub_comment', 'membalas komentar Anda.', activeBottomSheetPostId);
                    await detectAndNotifyMentions(text, 'mention', activeBottomSheetPostId);
                    activeReplyTargetCommentId = null; activeReplyTargetUser = null;
                } else {
                    await supabaseClient.from('comments').insert([{ post_id: activeBottomSheetPostId, user_name: myName, text: text, likes: [], replies: [] }]);
                    await this.pushCloudNotificationPayload(postAuthor, 'comment', 'mengomentari postingan Anda.', activeBottomSheetPostId);
                    await detectAndNotifyMentions(text, 'mention', activeBottomSheetPostId);
                }
                input.value = ''; this.renderBottomSheetInputBar(postAuthor); this.reloadCommentsBottomSheetStreamOnly();
            } catch(err) {}
        },

        async pushCloudNotificationPayload(targetUser, actionType, textDesc, postId = null) {
            if(!targetUser || targetUser === App.ProfileState.getCurrentName()) return;
            try {
                await supabaseClient.from('notifications').insert([{ 
                    sender: App.ProfileState.getCurrentName(), 
                    receiver: targetUser, 
                    action_type: actionType, 
                    description: textDesc,
                    is_unread: true,
                    post_id: postId ? Number(postId) : null
                }]);
            } catch (ex) {}
        },

        async fetchCloudNotificationsDataZone() {
            const myName = App.ProfileState.getCurrentName();
            try {
                const { data } = await supabaseClient
                    .from('notifications')
                    .select('*')
                    .eq('receiver', myName)
                    .order('created_at', { ascending: false });
                
                liveNotifications = data || [];
                liveHeaderNotificationCount = liveNotifications.filter(n => n.is_unread).length;
                App.UI.refreshHeaderNotificationBadgeDOM();
            } catch(e) {}
        },

        async markSingleNotificationAsRead(notifId, senderName, actionType, postId = null) {
            try {
                await supabaseClient.from('notifications').update({ is_unread: false }).eq('id', notifId);
                await this.fetchCloudNotificationsDataZone();
                
                if (actionType === 'follow') App.Router.navigate(`profil?name=${encodeURIComponent(senderName)}`);
                else if (postId) { App.Router.navigate('feed'); await this.scrollToPostAndHighlight(postId, actionType); }
                else App.Router.navigate('feed');
            } catch(e) {}
        },

        async scrollToPostAndHighlight(postId, actionType) {
            const numericPostId = Number(postId);
            let targetEl = document.getElementById(`post-element-node-${numericPostId}`);

            if (!targetEl) {
                await new Promise(resolve => setTimeout(resolve, 300));
                targetEl = document.getElementById(`post-element-node-${numericPostId}`);
            }

            if (targetEl) {
                targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                targetEl.style.backgroundColor = '#e7f3ff';
                setTimeout(() => { targetEl.style.backgroundColor = '#ffffff'; }, 2500);
            }
        },

        async renderNotificationsView() {
            const viewport = document.getElementById('notifications-viewport-list'); if(!viewport) return;
            await this.fetchCloudNotificationsDataZone();
            
            if (liveNotifications.length === 0) {
                viewport.innerHTML = `<div style="text-align:center; padding:32px; color:var(--text-muted);">Belum ada notifikasi.</div>`;
                return;
            }

            const { data: profiles } = await supabaseClient.from('profiles').select('display_name, avatar_url');
            const profileMap = {};
            if (profiles) profiles.forEach(p => { if (p.avatar_url) profileMap[p.display_name] = p.avatar_url; });

            viewport.innerHTML = liveNotifications.map(n => {
                const isUnread = n.is_unread ? 'unread' : '';
                const timeStr = n.created_at ? App.UI.calculateRelativeTimeAgo(new Date(n.created_at).getTime()) : 'Baru saja';
                const senderAvatar = profileMap[n.sender] || DEFAULT_AVATAR_IMAGE;
                const safeSender = escapeJSString(n.sender);
                const targetPostId = n.post_id || 'null';

                return `
                    <div class="noti-item-card ${isUnread}" onclick="App.Features.markSingleNotificationAsRead(${n.id}, '${safeSender}', '${n.action_type}', ${targetPostId})">
                        <div class="noti-avatar-box">
                            <img src="${senderAvatar}" alt="${sanitizeHTML(n.sender)}">
                        </div>
                        <div class="noti-content-text">
                            <span class="noti-user-link">${sanitizeHTML(n.sender)}</span>
                            <span class="noti-action-text"> ${sanitizeHTML(n.description)}</span>
                            <div class="noti-time-text">${timeStr}</div>
                        </div>
                    </div>`;
            }).join('');
        },

        async renderExploreUsers() {
            const container = document.getElementById('explore-users-stream'); if(!container) return;
            const myName = App.ProfileState.getCurrentName();
            
            try {
                const { data: usersProfileData } = await supabaseClient.from('profiles').select('display_name, avatar_url');
                let uniqueUsersMap = {};
                
                if (usersProfileData) {
                    usersProfileData.forEach(u => {
                        if (u.display_name && u.display_name !== myName) {
                            uniqueUsersMap[u.display_name] = (u.avatar_url && u.avatar_url !== 'null') ? u.avatar_url : DEFAULT_AVATAR_IMAGE;
                        }
                    });
                }

                const userKeys = Object.keys(uniqueUsersMap);
                if (userKeys.length === 0) {
                    container.innerHTML = `<div style="grid-column: 1/-1; text-align:center; color:var(--text-muted); padding:20px;">Belum ada anggota lain.</div>`;
                    return;
                }

                container.innerHTML = userKeys.map(name => {
                    const isFollowing = window.userFriendsList.includes(name);
                    const safeName = escapeJSString(name);
                    return `
                        <div class="user-follow-card">
                            <img src="${uniqueUsersMap[name]}" style="width:46px; height:46px; border-radius:50%; object-fit:cover;" onclick="App.Router.navigate('profil?name=${encodeURIComponent(name)}')">
                            <div style="flex:1; overflow:hidden;">
                                <strong style="display:block; text-overflow:ellipsis; overflow:hidden; white-space:nowrap; cursor:pointer;" onclick="App.Router.navigate('profil?name=${encodeURIComponent(name)}')">${sanitizeHTML(name)}</strong>
                                <span style="font-size:0.75rem; color:var(--text-muted);">Anggota Aktif</span>
                            </div>
                            <button class="btn ${isFollowing ? 'btn-secondary' : 'btn-primary'}" style="padding:6px 12px; font-size:0.8rem;" onclick="App.Features.toggleFollowInFollowFromProfileDOM('${safeName}', this)">
                                ${isFollowing ? 'Mengikuti' : 'Ikuti'}
                            </button>
                        </div>`;
                }).join('');
            } catch(e) {}
        },

        async toggleFollowInFollowFromProfileDOM(targetUser, btnElement) {
            const myName = App.ProfileState.getCurrentName();
            try {
                const isFollowing = window.userFriendsList.includes(targetUser);
                if (isFollowing) {
                    await supabaseClient.from('follows').delete().eq('follower', myName).eq('following', targetUser);
                    window.userFriendsList = window.userFriendsList.filter(u => u !== targetUser);
                    App.Toast.show(`Berhenti mengikuti ${targetUser}`, "info");
                } else {
                    await supabaseClient.from('follows').insert([{ follower: myName, following: targetUser }]);
                    window.userFriendsList.push(targetUser);
                    await this.pushCloudNotificationPayload(targetUser, 'follow', 'mulai mengikuti Anda.');
                    App.Toast.show(`Sekarang mengikuti ${targetUser}`, "success");
                }
                
                await App.Features.fetchMyFriendsData();

                if (btnElement) {
                    const nowFollowing = window.userFriendsList.includes(targetUser);
                    btnElement.className = nowFollowing ? 'social-btn-gray' : 'social-btn-blue';
                    btnElement.innerHTML = nowFollowing ? '<span>Mengikuti</span>' : '<span>Ikuti</span>';
                }
            } catch(e) {}
        },

        closeCommentsBottomSheet() { document.getElementById('comments-overlay-bottom-sheet').classList.remove('active'); activeBottomSheetPostId = null; },
        
        initCommentsSwipeToCloseGesture() {
            const dragZone = document.getElementById('comments-sheet-drag-zone'), sheet = document.getElementById('comments-sheet-content-node');
            let startY = 0; if(!dragZone || !sheet) return;
            dragZone.addEventListener('touchstart', (e) => { startY = e.touches[0].clientY; }, {passive:true});
            dragZone.addEventListener('touchend', (e) => { if(e.changedTouches[0].clientY - startY > 150) App.Features.closeCommentsBottomSheet(); }, {passive:true});
        },

        async handleAvatarSelection(event) {
            const file = event.target.files[0]; if (!file) return;
            if (file.size > 5 * 1024 * 1024) { App.Toast.show("Ukuran foto melebihi 5MB!", "danger"); return; }
            App.Toast.show("Mengunggah foto...", "info");

            try {
                const compressedFile = await compressImageNative(file, 600, 0.8);
                const fileExt = compressedFile.name.split('.').pop();
                const fileName = `${Date.now()}_avatar.${fileExt}`;

                const { error: uploadError } = await supabaseClient.storage.from('avatars').upload(fileName, compressedFile, { upsert: true });
                if (uploadError) throw uploadError;

                const { data: urlData } = supabaseClient.storage.from('avatars').getPublicUrl(fileName);
                const publicAvatarUrl = urlData.publicUrl;

                await App.ProfileState.saveAvatarUrlToSupabase(publicAvatarUrl);
                const imgPreview = document.getElementById('settings-avatar-preview');
                if (imgPreview) imgPreview.src = publicAvatarUrl;
                
                await supabaseClient.from('posts').update({ avatar: publicAvatarUrl }).eq('author', App.ProfileState.getCurrentName());
                App.Toast.show("Foto profil disimpan!", "success");
            } catch(err) { App.Toast.show("Gagal mengunggah foto profil.", "danger"); }
        },

        async handleBannerSelection(event) {
            const file = event.target.files[0]; if (!file) return;
            if (file.size > 5 * 1024 * 1024) { App.Toast.show("Ukuran sampul melebihi 5MB!", "danger"); return; }
            App.Toast.show("Mengunggah sampul...", "info");

            try {
                const compressedFile = await compressImageNative(file, 1200, 0.8);
                const fileExt = compressedFile.name.split('.').pop();
                const fileName = `${Date.now()}_banner.${fileExt}`;

                const { error: uploadError } = await supabaseClient.storage.from('avatars').upload(fileName, compressedFile, { upsert: true });
                if (uploadError) throw uploadError;

                const { data: urlData } = supabaseClient.storage.from('avatars').getPublicUrl(fileName);
                const publicBannerUrl = urlData.publicUrl;

                await App.ProfileState.saveBannerUrlToSupabase(publicBannerUrl);
                const bannerPreview = document.getElementById('settings-banner-preview');
                if (bannerPreview) bannerPreview.src = publicBannerUrl;
                
                App.Toast.show("Foto sampul disimpan!", "success");
            } catch(err) { App.Toast.show("Gagal mengunggah sampul.", "danger"); }
        },

        async createPost() {
            const content = document.getElementById('composer-text').value.trim();
            const mediaUrl = window.lastEmbeddedMediaUrl || '';
            let publicImageUrl = null;

            if(!content && !composerSelectedFile && !mediaUrl) return;

            const submitBtn = document.getElementById('pic-submit-btn');
            if (submitBtn) submitBtn.innerText = "Mengunggah...";

            try {
                if (composerSelectedFile) {
                    const fileExt = composerSelectedFile.name.split('.').pop();
                    const fileName = `${Date.now()}_post.${fileExt}`;
                    const { error: uploadError } = await supabaseClient.storage.from('posts_images').upload(fileName, composerSelectedFile);
                    if (uploadError) throw uploadError;

                    const { data: urlData } = supabaseClient.storage.from('posts_images').getPublicUrl(fileName);
                    publicImageUrl = urlData.publicUrl; 
                }

                const myName = App.ProfileState.getCurrentName();
                const myUuidId = localStorage.getItem('ns_user_id'); 
                
                const { data: createdPost } = await supabaseClient.from('posts').insert([{ 
                    user_id: myUuidId, 
                    author: myName, 
                    avatar: App.ProfileState.getCurrentAvatar(), 
                    content, 
                    image: publicImageUrl, 
                    privacy: document.getElementById('composer-privacy-select').value, 
                    location: activeComposerLocation, 
                    media_url: mediaUrl, 
                    bg_color: currentComposerBgColor, 
                    liked_users: [], 
                    loved_users: [], 
                    shared_count: 0 
                }]).select().single();

                const newPostId = createdPost ? createdPost.id : null;
                await detectAndNotifyMentions(content, 'mention', newPostId);

                composerSelectedFile = null; window.lastEmbeddedMediaUrl = ""; activeComposerLocation = "";
                App.Modal.closeAllModalsSystem();
                App.Toast.show("Status diterbitkan!", "success"); 
                
                if (window.location.hash.includes('#/profil')) App.Router.handleRoute();
                else { this.renderPosts(false); this.renderRealtimeStoriesCarousel(); }
            } catch (err) {
                App.Toast.show("Gagal membuat postingan.", "danger");
                if (submitBtn) submitBtn.innerText = "Kirim";
            }
        },

        async saveNameSettings() {
            const display_name = document.getElementById('settings-display-name').value.trim();
            const category = document.getElementById('settings-category').value.trim();
            const bio_status = document.getElementById('settings-bio-status').value.trim();
            const domisili = document.getElementById('settings-domisili').value.trim();
            const pendidikan = document.getElementById('settings-pendidikan').value.trim();
            const gender = document.getElementById('settings-gender').value;
            const birth_date = document.getElementById('settings-birth-date').value;

            if(!display_name) { App.Toast.show("Nama tidak boleh kosong!", "danger"); return; }
            
            const res = await App.ProfileState.updateProfileDataConfiguration({
                display_name, category, bio_status, domisili, pendidikan, gender, birth_date
            });

            if(res.success) { 
                App.Toast.show("Profil berhasil diperbarui!", "success"); 
                App.Router.navigate('profil'); 
            } else App.Toast.show(res.message || "Gagal menyimpan profil", "danger");
        },

        saveAdminGlobalAdBannerAction(event) {
            event.preventDefault(); const code = document.getElementById('admin-ad-html-input').value.trim();
            localStorage.setItem('ns_ad_html_global', code); App.Toast.show("Iklan dirilis!", "success"); App.UI.renderGlobalBannerAdIfExists();
        }
    },

    Theme: {
        init() { document.documentElement.setAttribute('data-theme', 'light'); },
        toggle() { App.Toast.show("Tema dikunci pada mode Putih Bersih.", "info"); }
    },

    Network: { listen() { window.addEventListener('offline', ()=>App.Toast.show("Koneksi Offline.","danger")); } },
    
    Modal: { 
        open(title, bodyHTML, hideFooter = false, rawMode = false) { 
            const area = document.getElementById('modal-content-area'), tEl = document.getElementById('modal-title'), bEl = document.getElementById('modal-body'), fEl = document.getElementById('modal-footer-actions');
            if (rawMode) { area.style.padding = '0'; area.style.background = '#ffffff'; tEl.style.display = 'none'; fEl.style.display = 'none'; } 
            else { area.style.padding = '24px'; area.style.background = '#ffffff'; tEl.style.display = title ? 'block' : 'none'; tEl.innerText = title || ''; fEl.style.display = hideFooter ? 'none' : 'flex'; }
            bEl.innerHTML = bodyHTML; document.getElementById('global-modal').classList.add('active'); 
            App.UI.pushModalStateToHistory();
        },
        openSecondary(title, innerHTML) {
            App.Modal.closeSecondaryPopupModal();
            const secondaryOverlay = document.createElement('div');
            secondaryOverlay.id = 'premium-secondary-modal-overlay';
            secondaryOverlay.style = 'position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.4); backdrop-filter:blur(4px); z-index:4500; display:flex; align-items:center; justify-content:center; padding:20px;';
            
            secondaryOverlay.innerHTML = `
                <div class="glass-card" style="width:100%; max-width:440px; margin:0; padding:24px; background: #ffffff; border: 1px solid var(--border-color);">
                    <h2 style="margin-bottom:16px; font-size:1.2rem; font-weight:800; text-align:left; color:var(--text-main);">${title}</h2>
                    <div>${innerHTML}</div>
                </div>`;
            document.body.appendChild(secondaryOverlay);
            App.UI.pushModalStateToHistory();
        },
        closeSecondaryPopupModal() { document.getElementById('premium-secondary-modal-overlay')?.remove(); },
        closeAllModalsSystem() { this.closeSecondaryPopupModal(); this.close(); },
        close() { document.getElementById('global-modal').classList.remove('active'); }
    },

    Toast: {
        show(m, t="info") {
            const c = document.getElementById('toast-container'), b = document.createElement('div');
            b.className = 'toast'; b.style.borderLeftColor = t==='success'?'var(--secondary)':t==='danger'?'var(--danger)':'var(--primary)';
            b.innerHTML = `<span>${sanitizeHTML(m)}</span>`; c.appendChild(b);
            setTimeout(() => { b.style.opacity='0'; setTimeout(()=>b.remove(), 300); }, 3000);
        }
    },

    UI: {
        generateAvatarHTML(name, url, isPremium, level, size = '42px', inPost = false) {
            const src = (url && url !== 'null') ? url : DEFAULT_AVATAR_IMAGE;
            return `<div class="avatar-wrapper" onclick="App.Router.navigate('${inPost ? 'profil?name=' + encodeURIComponent(name) : 'profil'}')"><img src="${src}" class="user-avatar" style="width:${size}; height:${size}; object-fit:cover;" alt="Avatar"></div>`;
        },

        openImageLightbox(imageUrl, postId = null, authorName = '', authorAvatar = '') {
            const container = document.getElementById('fullscreen-lightbox-container'); if (!container) return;
            const safeAuthor = escapeJSString(authorName);
            const avSrc = (authorAvatar && authorAvatar !== 'null') ? authorAvatar : DEFAULT_AVATAR_IMAGE;

            container.innerHTML = `
                <div class="fullscreen-lightbox-overlay">
                    <div class="lightbox-top-header">
                        <div class="lightbox-author-info" onclick="App.UI.closeImageLightbox(); App.Router.navigate('profil?name=${encodeURIComponent(authorName)}')">
                            <img src="${avSrc}" class="lightbox-author-avatar">
                            <strong style="font-size:1rem;">${sanitizeHTML(authorName)}</strong>
                        </div>
                        <button class="icon-btn" style="background:rgba(255,255,255,0.2); color:white;" onclick="App.UI.closeImageLightbox()">
                            <span class="material-symbols-outlined">close</span>
                        </button>
                    </div>
                    <div class="lightbox-image-center-stage" onclick="App.UI.closeImageLightbox()">
                        <img src="${imageUrl}" onclick="event.stopPropagation()">
                    </div>
                </div>`;
            App.UI.pushModalStateToHistory();
        },

        closeImageLightbox() {
            const container = document.getElementById('fullscreen-lightbox-container');
            if (container) container.innerHTML = '';
        },

        calculateRelativeTimeAgo(ts) {
            const sec = Math.floor((Date.now() - parseInt(ts)) / 1000);
            if (sec < 60) return `Baru saja`;
            if (sec < 3600) return `${Math.floor(sec/60)}m`;
            if (sec < 86400) return `${Math.floor(sec/3600)}j`;
            return `${Math.floor(sec/86400)}h`;
        },

        renderGlobalBannerAdIfExists() {
            const container = document.getElementById('global-superadmin-ad-slot-container'); if(!container) return;
            const ad = localStorage.getItem('ns_ad_html_global');
            container.innerHTML = ad ? `<div class="global-workspace-ad-banner">${ad}</div>` : '';
        },

        initInfiniteScrollListener() {
            window.addEventListener('scroll', () => {
                if (window.location.hash !== '#/feed' && window.location.hash !== '') return;
                if (!feedHasMorePosts || feedIsLoadingMore) return;

                if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 400) {
                    feedCurrentPage++;
                    const spinner = document.getElementById('feed-infinite-loading-spinner');
                    if (spinner) spinner.style.display = 'block';
                    App.Features.renderPosts(true).then(() => { if (spinner) spinner.style.display = 'none'; });
                }
            });
        },

        pushModalStateToHistory() { window.history.pushState({ modalOpen: true }, ""); },
        hasAnyActiveModalOrPopup() {
            return document.getElementById('global-modal')?.classList.contains('active') ||
                   !!document.getElementById('premium-secondary-modal-overlay') ||
                   document.getElementById('comments-overlay-bottom-sheet')?.classList.contains('active') ||
                   document.getElementById('floating-chat-popup-box')?.classList.contains('active');
        },

        closeTopmostModalOrPopup() {
            if (document.getElementById('premium-secondary-modal-overlay')) { App.Modal.closeSecondaryPopupModal(); return true; }
            if (document.getElementById('global-modal')?.classList.contains('active')) { App.Modal.close(); return true; }
            if (document.getElementById('comments-overlay-bottom-sheet')?.classList.contains('active')) { App.Features.closeCommentsBottomSheet(); return true; }
            if (document.getElementById('floating-chat-popup-box')?.classList.contains('active')) { this.toggleChatPopup(false); return true; }
            return false;
        },

        initBackButtonCloseSystem() {
            window.addEventListener('popstate', () => { if (this.hasAnyActiveModalOrPopup()) this.closeTopmostModalOrPopup(); });
        },

        bindGlobalEvents() {
            document.getElementById('btn-toggle-sidebar')?.addEventListener('click', () => { if(window.innerWidth > 768) document.getElementById('app-layout').classList.toggle('sidebar-collapsed'); });
            document.getElementById('btn-refresh')?.addEventListener('click', () => { App.Router.handleRoute(); App.Toast.show("Diperbarui","success"); });
            
            document.getElementById('global-modal')?.addEventListener('click', (e) => {
                if (e.target.id === 'global-modal') App.Modal.close();
            });
        },

        closeMobileSidebar() { document.getElementById('app-layout')?.classList.remove('sidebar-mobile-open'); document.getElementById('mobile-overlay')?.classList.remove('active'); },
        
        toggleChatPopup(open) {
            const box = document.getElementById('floating-chat-popup-box'); if(!box) return;
            if(open) { 
                box.classList.add('active'); 
                App.UI.pushModalStateToHistory();
                if (activeChatFriendName && activeChatFriendEmail) {
                    App.Features.openSpecificFriendPopupObrolan(activeChatFriendEmail, activeChatFriendName);
                } else App.Features.closeActiveChatSessionAndReturnToList(); 
            } else box.classList.remove('active');
        },

        refreshHeaderNotificationBadgeDOM() {
            const badge = document.getElementById('noti-badge');
            if(badge) { badge.innerText = liveHeaderNotificationCount; badge.style.display = liveHeaderNotificationCount > 0 ? 'flex' : 'none'; }
        },

        syncGlobalAvatarAndName() {
            const name = App.ProfileState.getCurrentName(), avatar = App.ProfileState.getCurrentAvatar();
            const html = App.UI.generateAvatarHTML(name, avatar, false, 0, '40px', false);
            const header = document.getElementById('header-avatar-toggle-node'); if (header) header.innerHTML = html;
            const comp = document.getElementById('composer-avatar-slot'); if (comp) comp.innerHTML = html;
        },

        showLoadingBtn(b) { if(b) b.innerHTML = 'Memproses...'; setTimeout(() => { if(b) b.innerHTML = 'Masuk'; }, 1500); }
    }
};

App.Features.toggleFollowInExploreFromProfileDOM = App.Features.toggleFollowInFollowFromProfileDOM;
document.addEventListener('DOMContentLoaded', () => App.init());
