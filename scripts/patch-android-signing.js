#!/usr/bin/env node
// Patches Capacitor-generated app/android/app/build.gradle to enable release signing
// from app/android/keystore.properties (written by the workflow's "Decode keystore" step).
// Idempotent: safe to run multiple times.

const fs = require('fs');

const gradleFile = 'app/android/app/build.gradle';

if (!fs.existsSync(gradleFile)) {
  console.error('✗ ' + gradleFile + ' not found. Did `npx cap add android` run first?');
  process.exit(1);
}

let content = fs.readFileSync(gradleFile, 'utf8');

if (content.includes('signingConfigs.release')) {
  console.log('✓ Already patched (signingConfigs.release present)');
  process.exit(0);
}

const signingBlock = `
    signingConfigs {
        release {
            def kpFile = rootProject.file("keystore.properties")
            if (kpFile.exists()) {
                def kp = new Properties()
                kp.load(new FileInputStream(kpFile))
                storeFile file(kp['storeFile'])
                storePassword kp['storePassword']
                keyAlias kp['keyAlias']
                keyPassword kp['keyPassword']
            }
        }
    }
`;

// 1. Insert signingConfigs immediately after the top-level "android {" line
const androidOpen = /^android\s*\{\s*$/m;
if (!androidOpen.test(content)) {
  console.error('✗ Could not locate top-level "android {" block in ' + gradleFile);
  process.exit(1);
}
content = content.replace(androidOpen, 'android {' + signingBlock);

// 2. Insert `signingConfig signingConfigs.release` as the first line inside `buildTypes.release { ... }`
const buildTypesRelease = /(buildTypes\s*\{[\s\S]*?release\s*\{)/;
if (!buildTypesRelease.test(content)) {
  console.error('✗ Could not locate buildTypes.release block in ' + gradleFile);
  process.exit(1);
}
content = content.replace(buildTypesRelease, '$1\n            signingConfig signingConfigs.release');

fs.writeFileSync(gradleFile, content);
console.log('✓ Patched ' + gradleFile + ' with release signing config');
