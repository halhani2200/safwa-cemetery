// Native Bridge — detects if running inside Capacitor app and provides
// wrappers around native APIs. Falls back to web APIs when in browser.

(function() {
    'use strict';

    const isNative = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
    const platform = isNative ? window.Capacitor.getPlatform() : 'web';

    window.SafwaNative = {
        isNative,
        platform,
        isAndroid: platform === 'android',
        isIOS: platform === 'ios',

        // ---------- Share ----------
        async share(opts) {
            // opts: { title, text, url, dialogTitle }
            if (isNative && window.Capacitor.Plugins.Share) {
                try {
                    await window.Capacitor.Plugins.Share.share({
                        title: opts.title,
                        text: opts.text,
                        url: opts.url,
                        dialogTitle: opts.dialogTitle || 'مشاركة'
                    });
                    return { success: true, native: true };
                } catch (e) {
                    if (e.message?.includes('cancel')) return { success: false, cancelled: true };
                    return { success: false, error: e.message };
                }
            }
            // Fallback to web share API
            if (navigator.share) {
                try {
                    await navigator.share({ title: opts.title, text: opts.text, url: opts.url });
                    return { success: true, native: false };
                } catch (e) {
                    return { success: false, error: e.message };
                }
            }
            // Last resort: clipboard
            try {
                await navigator.clipboard.writeText(opts.url || opts.text || '');
                return { success: true, copied: true };
            } catch (e) {
                return { success: false, error: 'مشاركة غير مدعومة' };
            }
        },

        // ---------- Push Notifications ----------
        async registerForPush() {
            if (!isNative || !window.Capacitor.Plugins.PushNotifications) {
                return { success: false, error: 'الإشعارات النيتف متاحة فقط في التطبيق' };
            }
            const Push = window.Capacitor.Plugins.PushNotifications;
            try {
                const perm = await Push.requestPermissions();
                if (perm.receive !== 'granted') {
                    return { success: false, error: 'تم رفض إذن الإشعارات' };
                }
                await Push.register();

                return new Promise((resolve) => {
                    const tokenHandler = Push.addListener('registration', async (token) => {
                        // Send token to backend
                        try {
                            const r = await fetch('/api/push/subscribe-fcm', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    token: token.value,
                                    platform: platform,
                                    app_version: '1.0.0'
                                })
                            });
                            const d = await r.json();
                            resolve({ success: true, token: token.value, registered: d.ok });
                        } catch (e) {
                            resolve({ success: false, error: e.message });
                        }
                        (await tokenHandler).remove();
                    });

                    const errHandler = Push.addListener('registrationError', async (e) => {
                        resolve({ success: false, error: e.error || 'فشل تسجيل الإشعارات' });
                        (await errHandler).remove();
                    });
                });
            } catch (e) {
                return { success: false, error: e.message };
            }
        },

        async setupPushListeners(onNotification) {
            if (!isNative || !window.Capacitor.Plugins.PushNotifications) return;
            const Push = window.Capacitor.Plugins.PushNotifications;
            // Notification received while app is in foreground
            Push.addListener('pushNotificationReceived', (notif) => {
                console.log('[Native] Push received:', notif);
                if (onNotification) onNotification(notif);
            });
            // User tapped a notification
            Push.addListener('pushNotificationActionPerformed', (action) => {
                console.log('[Native] Push action:', action);
                const url = action.notification?.data?.url;
                if (url) window.location.href = url;
            });
        },

        // ---------- Camera ----------
        async takePhoto(opts) {
            // opts: { quality (0-100), maxWidth, maxHeight }
            if (!isNative || !window.Capacitor.Plugins.Camera) {
                return { success: false, error: 'Camera native غير متاح' };
            }
            try {
                const photo = await window.Capacitor.Plugins.Camera.getPhoto({
                    quality: opts?.quality || 80,
                    width: opts?.maxWidth || 1280,
                    height: opts?.maxHeight || 1280,
                    allowEditing: false,
                    resultType: 'dataUrl',
                    source: opts?.source || 'PROMPT',
                    direction: 'REAR',
                    saveToGallery: false,
                    correctOrientation: true
                });
                return { success: true, dataUrl: photo.dataUrl, format: photo.format };
            } catch (e) {
                if (e.message?.includes('cancel')) return { success: false, cancelled: true };
                return { success: false, error: e.message };
            }
        },

        // ---------- Geolocation ----------
        async getCurrentPosition() {
            if (isNative && window.Capacitor.Plugins.Geolocation) {
                try {
                    const pos = await window.Capacitor.Plugins.Geolocation.getCurrentPosition({
                        enableHighAccuracy: true,
                        timeout: 15000,
                        maximumAge: 0
                    });
                    return { success: true, latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy };
                } catch (e) {
                    return { success: false, error: e.message };
                }
            }
            // Fallback to web Geolocation
            return new Promise((resolve) => {
                if (!navigator.geolocation) {
                    resolve({ success: false, error: 'GPS غير مدعوم' });
                    return;
                }
                navigator.geolocation.getCurrentPosition(
                    (pos) => resolve({
                        success: true,
                        latitude: pos.coords.latitude,
                        longitude: pos.coords.longitude,
                        accuracy: pos.coords.accuracy
                    }),
                    (err) => resolve({ success: false, error: err.message }),
                    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
                );
            });
        },

        // ---------- App Info ----------
        async getDeviceInfo() {
            if (isNative && window.Capacitor.Plugins.Device) {
                try {
                    return await window.Capacitor.Plugins.Device.getInfo();
                } catch (e) {
                    return { platform: 'unknown' };
                }
            }
            return {
                platform: 'web',
                model: navigator.userAgent,
                operatingSystem: navigator.platform,
                osVersion: 'unknown',
                webViewVersion: 'browser'
            };
        },

        // ---------- Network ----------
        async getNetworkStatus() {
            if (isNative && window.Capacitor.Plugins.Network) {
                try {
                    return await window.Capacitor.Plugins.Network.getStatus();
                } catch (e) {
                    return { connected: navigator.onLine, connectionType: 'unknown' };
                }
            }
            return { connected: navigator.onLine, connectionType: 'unknown' };
        },

        onNetworkChange(callback) {
            if (isNative && window.Capacitor.Plugins.Network) {
                window.Capacitor.Plugins.Network.addListener('networkStatusChange', callback);
            } else {
                window.addEventListener('online', () => callback({ connected: true }));
                window.addEventListener('offline', () => callback({ connected: false }));
            }
        },

        // ---------- Status Bar (native styling) ----------
        async setStatusBarStyle(dark) {
            if (isNative && window.Capacitor.Plugins.StatusBar) {
                try {
                    await window.Capacitor.Plugins.StatusBar.setStyle({
                        style: dark ? 'DARK' : 'LIGHT'
                    });
                } catch (e) {}
            }
        },

        // ---------- Splash Screen ----------
        async hideSplash() {
            if (isNative && window.Capacitor.Plugins.SplashScreen) {
                try {
                    await window.Capacitor.Plugins.SplashScreen.hide();
                } catch (e) {}
            }
        },

        // ---------- Browser (for external links) ----------
        async openExternal(url) {
            if (isNative && window.Capacitor.Plugins.Browser) {
                try {
                    await window.Capacitor.Plugins.Browser.open({ url });
                    return { success: true };
                } catch (e) {
                    return { success: false, error: e.message };
                }
            }
            window.open(url, '_blank', 'noopener');
            return { success: true };
        },

        // ---------- Local Preferences (offline storage) ----------
        async setPreference(key, value) {
            if (isNative && window.Capacitor.Plugins.Preferences) {
                await window.Capacitor.Plugins.Preferences.set({
                    key,
                    value: typeof value === 'string' ? value : JSON.stringify(value)
                });
            } else {
                try { localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value)); } catch (e) {}
            }
        },

        async getPreference(key) {
            if (isNative && window.Capacitor.Plugins.Preferences) {
                const r = await window.Capacitor.Plugins.Preferences.get({ key });
                return r.value;
            }
            try { return localStorage.getItem(key); } catch (e) { return null; }
        }
    };

    // Auto-hide splash after page loads
    if (isNative) {
        window.addEventListener('load', () => {
            setTimeout(() => window.SafwaNative.hideSplash(), 500);
        });

        // Set status bar style
        window.SafwaNative.setStatusBarStyle(true);

        // Log so we know we're in native
        console.log('[SafwaNative] Running on', platform);
    }
})();
