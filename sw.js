PWA: {
    init() {
        this.registerServiceWorker();
        this.checkStrictInstallationStatus();
    },
    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('./sw.js')
                .then(() => console.log("Service Worker Aktif"))
                .catch((err) => console.log("SW Error:", err));
        }
    },
    checkStrictInstallationStatus() {
        // 1. Cek apakah dibuka langsung dari aplikasi PWA (Standalone Mode)
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
            || window.navigator.standalone === true 
            || window.location.search.includes('utm_source=pwa');

        // 2. Cek apakah pengguna sudah pernah mengklik install / menolak
        const isAlreadyInstalled = localStorage.getItem('pwa_is_installed') === 'true';

        if (isStandalone || isAlreadyInstalled) {
            // Sembunyikan banner selamanya jika sudah terinstall / berjalan sebagai PWA
            this.dismissInstallPrompt();
        } else {
            this.listenInstallPrompt();
        }

        // Tangkap event ketika proses instalasi selesai secara resmi di HP
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
                    // Tandai di storage agar tidak pernah diminta lagi
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
            banner.style.display = 'none'; // Dipaksa hilang dari DOM
        }
    }
}
