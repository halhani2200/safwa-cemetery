// Minimal Web Push implementation for Cloudflare Workers
// Implements RFC 8291 (encryption) + RFC 8292 (VAPID) using Web Crypto API

function b64urlEncode(buf) {
    let s = '';
    const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s) {
    s = String(s).replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    const binary = atob(s);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

function concatBytes(...arrays) {
    let total = 0;
    for (const a of arrays) total += a.length;
    const out = new Uint8Array(total);
    let offset = 0;
    for (const a of arrays) { out.set(a, offset); offset += a.length; }
    return out;
}

// Import VAPID private key (d value) + public key (uncompressed 65 bytes) as ECDSA signing key
async function importVapidPrivateKey(publicKeyB64, privateKeyB64) {
    const pub = b64urlDecode(publicKeyB64);  // 65 bytes: 0x04 || X(32) || Y(32)
    if (pub.length !== 65 || pub[0] !== 0x04) throw new Error('invalid public key');
    const x = b64urlEncode(pub.slice(1, 33));
    const y = b64urlEncode(pub.slice(33, 65));
    return crypto.subtle.importKey(
        'jwk',
        { kty: 'EC', crv: 'P-256', x, y, d: privateKeyB64, ext: true },
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['sign']
    );
}

async function buildVapidJwt(endpoint, subject, publicKeyB64, privateKeyB64) {
    const u = new URL(endpoint);
    const audience = `${u.protocol}//${u.host}`;
    const header = { typ: 'JWT', alg: 'ES256' };
    const payload = {
        aud: audience,
        exp: Math.floor(Date.now() / 1000) + 12 * 3600,
        sub: subject || 'mailto:admin@example.com'
    };
    const enc = new TextEncoder();
    const headerB64 = b64urlEncode(enc.encode(JSON.stringify(header)));
    const payloadB64 = b64urlEncode(enc.encode(JSON.stringify(payload)));
    const signingInput = `${headerB64}.${payloadB64}`;
    const key = await importVapidPrivateKey(publicKeyB64, privateKeyB64);
    const sig = await crypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        key,
        enc.encode(signingInput)
    );
    return `${signingInput}.${b64urlEncode(sig)}`;
}

// HKDF helpers
async function hkdfExtract(salt, ikm) {
    const key = await crypto.subtle.importKey('raw', salt, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return new Uint8Array(await crypto.subtle.sign('HMAC', key, ikm));
}
async function hkdfExpand(prk, info, length) {
    const infoBuf = concatBytes(info, new Uint8Array([1]));
    const key = await crypto.subtle.importKey('raw', prk, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const out = new Uint8Array(await crypto.subtle.sign('HMAC', key, infoBuf));
    return out.slice(0, length);
}

// Encrypt payload using aes128gcm content encoding (RFC 8188 + 8291)
async function encryptPayload(payload, p256dhB64, authB64) {
    const enc = new TextEncoder();
    const data = typeof payload === 'string' ? enc.encode(payload) : payload;

    // 1. Generate ephemeral ECDH keypair
    const localKp = await crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        ['deriveBits']
    );
    const localPubRaw = new Uint8Array(await crypto.subtle.exportKey('raw', localKp.publicKey)); // 65 bytes

    // 2. Import recipient's public key
    const recipPubRaw = b64urlDecode(p256dhB64);
    const recipPub = await crypto.subtle.importKey(
        'raw', recipPubRaw,
        { name: 'ECDH', namedCurve: 'P-256' },
        false, []
    );

    // 3. ECDH shared secret
    const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits(
        { name: 'ECDH', public: recipPub }, localKp.privateKey, 256
    ));

    // 4. Auth secret
    const authSecret = b64urlDecode(authB64);

    // 5. Generate random salt (16 bytes)
    const salt = crypto.getRandomValues(new Uint8Array(16));

    // 6. PRK_key = HKDF(authSecret, sharedSecret, "WebPush: info\0" + recipPub + localPub, 32)
    const keyInfo = concatBytes(
        enc.encode('WebPush: info\0'),
        recipPubRaw,
        localPubRaw
    );
    const prkKey = await hkdfExtract(authSecret, sharedSecret);
    const ikm = await hkdfExpand(prkKey, keyInfo, 32);

    // 7. PRK = HKDF(salt, ikm)
    const prk = await hkdfExtract(salt, ikm);

    // 8. CEK = HKDF(PRK, "Content-Encoding: aes128gcm\0", 16)
    const cek = await hkdfExpand(prk, enc.encode('Content-Encoding: aes128gcm\0'), 16);

    // 9. Nonce = HKDF(PRK, "Content-Encoding: nonce\0", 12)
    const nonce = await hkdfExpand(prk, enc.encode('Content-Encoding: nonce\0'), 12);

    // 10. Pad: data || 0x02 || padding (we use single record)
    const padded = concatBytes(data, new Uint8Array([0x02]));

    // 11. Encrypt with AES-128-GCM
    const cekKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM', length: 128 }, false, ['encrypt']);
    const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: nonce }, cekKey, padded
    ));

    // 12. Header: salt(16) || rs(4, BE) || idlen(1) || keyid(65)
    const rs = new Uint8Array(4);
    new DataView(rs.buffer).setUint32(0, 4096, false); // record size
    const header = concatBytes(salt, rs, new Uint8Array([65]), localPubRaw);

    return concatBytes(header, ciphertext);
}

// Strip BOM and whitespace from secrets (defensive)
function cleanSecret(s) {
    if (!s) return s;
    return String(s).replace(/^﻿/, '').trim();
}

// Send a push notification to a single subscription
export async function sendPushNotification(env, subscription, payloadObj) {
    const publicKey = cleanSecret(env.VAPID_PUBLIC_KEY);
    const privateKey = cleanSecret(env.VAPID_PRIVATE_KEY);
    const subject = cleanSecret(env.VAPID_SUBJECT) || 'mailto:admin@safwa-cemetery.com';

    if (!publicKey || !privateKey) {
        return { ok: false, error: 'VAPID keys not configured', status: 0 };
    }
    try {
        const payloadStr = JSON.stringify(payloadObj);
        const encrypted = await encryptPayload(payloadStr, subscription.p256dh, subscription.auth);
        const jwt = await buildVapidJwt(
            subscription.endpoint,
            subject,
            publicKey,
            privateKey
        );
        const response = await fetch(subscription.endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `vapid t=${jwt}, k=${publicKey}`,
                'Content-Encoding': 'aes128gcm',
                'Content-Type': 'application/octet-stream',
                'TTL': '86400'
            },
            body: encrypted
        });
        return { ok: response.ok, status: response.status, statusText: response.statusText };
    } catch (e) {
        return { ok: false, error: e.message, status: 0 };
    }
}

// Send to all active subscriptions in DB. Removes dead subscriptions (404/410).
export async function sendPushToAll(env, payloadObj) {
    const subs = await env.DB.prepare('SELECT id, endpoint, p256dh, auth FROM push_subscriptions').all();
    let sent = 0, failed = 0, removed = 0;
    for (const sub of subs.results) {
        const result = await sendPushNotification(env, sub, payloadObj);
        if (result.ok) {
            sent++;
            await env.DB.prepare('UPDATE push_subscriptions SET last_used_at = ?, failure_count = 0 WHERE id = ?')
                .bind(new Date().toISOString(), sub.id).run();
        } else if (result.status === 404 || result.status === 410) {
            await env.DB.prepare('DELETE FROM push_subscriptions WHERE id = ?').bind(sub.id).run();
            removed++;
        } else {
            failed++;
            await env.DB.prepare('UPDATE push_subscriptions SET failure_count = failure_count + 1 WHERE id = ?').bind(sub.id).run();
        }
    }
    return { sent, failed, removed, total: subs.results.length };
}
