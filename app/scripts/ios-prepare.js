// Run in iOS CI ONLY (Codemagic), before `cap sync ios`.
// Switches the Capacitor config from remote (server.url live-reload) to a
// locally-bundled UI, and enables Capgo OTA. The COMMITTED capacitor.config.json
// keeps server.url so the existing Android build is untouched — this transforms
// the config in-place during the iOS build only.

const fs = require('fs');
const path = require('path');

const cfgPath = path.resolve(__dirname, '..', 'capacitor.config.json');
const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));

// 1) Drop the remote server URL → the app loads bundled `www` (fixes Guideline 4.2).
if (cfg.server && cfg.server.url) {
    delete cfg.server.url;
    console.log('• removed server.url (iOS now loads bundled www)');
}

// 2) iOS shell polish: avoid WebView auto-insetting plus CSS safe-area at the
// same time. That double inset made the header float too low and left a green
// strip below the tab bar on iPhone screenshots.
cfg.ios = cfg.ios || {};
cfg.ios.contentInset = 'never';
cfg.ios.scrollEnabled = true;
cfg.ios.backgroundColor = '#FAF6EE';
console.log('• disabled iOS automatic content insets; CSS owns safe-area spacing');

// 3) Keep the green app header under the iOS status bar with light icons.
cfg.plugins = cfg.plugins || {};
cfg.plugins.StatusBar = {
    ...(cfg.plugins.StatusBar || {}),
    style: 'LIGHT',
    backgroundColor: '#0E4D3F',
    overlaysWebView: true
};
console.log('• configured iOS status bar overlay for a native full-screen feel');

// 4) Enable Capgo OTA — light JS/HTML/CSS updates only (no native code via OTA).
cfg.plugins.CapacitorUpdater = { autoUpdate: true };
console.log('• enabled CapacitorUpdater (Capgo OTA)');

fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
console.log('✓ iOS Capacitor config prepared');
