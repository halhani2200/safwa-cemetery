// Run after `npx cap sync ios`.
// Adds the APNs entitlement required for iOS PushNotifications registration.

const fs = require('fs');
const path = require('path');

const iosRoot = path.resolve(__dirname, '..', 'ios', 'App');
const projectPath = path.join(iosRoot, 'App.xcodeproj', 'project.pbxproj');
const entitlementsPath = path.join(iosRoot, 'App', 'App.entitlements');
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
