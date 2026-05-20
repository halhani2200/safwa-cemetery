// Generate VAPID keys for Web Push using Node Web Crypto API
import { webcrypto } from 'node:crypto';

const crypto = webcrypto;

function b64url(buf) {
    return Buffer.from(buf).toString('base64')
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function main() {
    const kp = await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['sign', 'verify']
    );

    // Export public key as uncompressed (65 bytes, starts with 0x04)
    const rawPub = await crypto.subtle.exportKey('raw', kp.publicKey);
    const publicKeyB64 = b64url(rawPub);

    // Export private key
    const jwkPriv = await crypto.subtle.exportKey('jwk', kp.privateKey);

    console.log('VAPID Public Key (base64url, 65 bytes uncompressed):');
    console.log(publicKeyB64);
    console.log();
    console.log('VAPID Private Key (base64url, d component):');
    console.log(jwkPriv.d);
    console.log();
    console.log('Setup commands:');
    console.log(`  npx wrangler secret put VAPID_PUBLIC_KEY     # paste: ${publicKeyB64}`);
    console.log(`  npx wrangler secret put VAPID_PRIVATE_KEY    # paste: ${jwkPriv.d}`);
    console.log(`  npx wrangler secret put VAPID_SUBJECT        # paste: mailto:admin@safwa-cemetery.com`);
}

main().catch(console.error);
