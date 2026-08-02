// Run after `npx cap sync ios`.
// Adds the APNs entitlement required for iOS PushNotifications registration.

const fs = require('fs');
const path = require('path');

const iosRoot = path.resolve(__dirname, '..', 'ios', 'App');
const projectPath = path.join(iosRoot, 'App.xcodeproj', 'project.pbxproj');
const entitlementsPath = path.join(iosRoot, 'App', 'App.entitlements');
const appDelegatePath = path.join(iosRoot, 'App', 'AppDelegate.swift');
const entitlementsRel = 'App/App.entitlements';

if (!fs.existsSync(projectPath)) {
    console.error('Missing Xcode project:', projectPath);
    process.exit(1);
}

const entitlementsXml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>aps-environment</key>
    <string>production</string>
</dict>
</plist>
`;

fs.writeFileSync(entitlementsPath, entitlementsXml);

let text = fs.readFileSync(projectPath, 'utf8');
let replacements = 0;

text = text.replace(/CODE_SIGN_ENTITLEMENTS = [^;]+;/g, () => {
    replacements += 1;
    return `CODE_SIGN_ENTITLEMENTS = ${entitlementsRel};`;
});

if (replacements === 0) {
    text = text.replace(/(buildSettings = \{\r?\n)/g, `$1\t\t\t\tCODE_SIGN_ENTITLEMENTS = ${entitlementsRel};\n`);
    replacements = (text.match(/CODE_SIGN_ENTITLEMENTS = App\/App\.entitlements;/g) || []).length;
}

fs.writeFileSync(projectPath, text);
console.log(`Enabled iOS APNs entitlement in ${replacements} build setting block(s).`);

if (!fs.existsSync(appDelegatePath)) {
    console.error('Missing AppDelegate:', appDelegatePath);
    process.exit(1);
}

let delegate = fs.readFileSync(appDelegatePath, 'utf8');
if (!delegate.includes('capacitorDidRegisterForRemoteNotifications')) {
    if (!delegate.includes('import Capacitor')) {
        delegate = delegate.replace('import UIKit', 'import UIKit\nimport Capacitor');
    }

    const callbacks = `
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }
`;

    const lastBrace = delegate.lastIndexOf('}');
    if (lastBrace === -1) {
        console.error('Could not patch AppDelegate.swift: missing class closing brace');
        process.exit(1);
    }
    delegate = delegate.slice(0, lastBrace) + callbacks + delegate.slice(lastBrace);
    fs.writeFileSync(appDelegatePath, delegate);
    console.log('Patched AppDelegate.swift to forward APNs registration callbacks to Capacitor.');
} else {
    console.log('AppDelegate.swift already forwards APNs registration callbacks.');
}
