// Run after `npx cap sync ios` in CI.
// Capacitor's generated Xcode project can default to Universal (iPhone+iPad).
// This forces every build configuration back to iPhone-only so App Store Connect
// reports Device Family: iPhone, and does not require iPad screenshots/layout QA.

const fs = require('fs');
const path = require('path');

const projectPath = path.resolve(__dirname, '..', 'ios', 'App', 'App.xcodeproj', 'project.pbxproj');

if (!fs.existsSync(projectPath)) {
    console.error('Missing Xcode project:', projectPath);
    process.exit(1);
}

let text = fs.readFileSync(projectPath, 'utf8');
let replacements = 0;

text = text.replace(/TARGETED_DEVICE_FAMILY = [^;]+;/g, () => {
    replacements += 1;
    return 'TARGETED_DEVICE_FAMILY = 1;';
});

if (replacements === 0) {
    text = text.replace(/(buildSettings = \{\r?\n)/g, '$1\t\t\t\tTARGETED_DEVICE_FAMILY = 1;\n');
    replacements = (text.match(/TARGETED_DEVICE_FAMILY = 1;/g) || []).length;
}

fs.writeFileSync(projectPath, text);
console.log(`Forced TARGETED_DEVICE_FAMILY=1 in ${replacements} build setting block(s).`);
