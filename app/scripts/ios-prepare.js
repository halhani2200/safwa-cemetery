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

// 2) Enable Capgo OTA — light JS/HTML/CSS updates only (no native code via OTA).
cfg.plugins = cfg.plugins || {};
cfg.plugins.CapacitorUpdater = { autoUpdate: true };
console.log('• enabled CapacitorUpdater (Capgo OTA)');

fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
console.log('✓ iOS Capacitor config prepared');
