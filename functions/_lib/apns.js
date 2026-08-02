// APNs HTTP/2 provider client for iOS native push tokens.
// Required Cloudflare secrets:
//   APNS_KEY_ID, APNS_TEAM_ID, APNS_PRIVATE_KEY
// Optional:
//   APNS_BUNDLE_ID (defaults to com.safwacemetery.app)
//   APNS_ENV (production|development, defaults to production)

function base64UrlEncode(input) {
    let bytes;
    if (typeof input === 'string') {
        bytes = new TextEncoder().encode(input);
    } else {
        bytes = input;
    }

    let str = '';
    for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
    return btoa(str).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function cleanPrivateKey(pem) {
    return String(pem || '')
        .replace(/\\n/g, '\n')
        .replace(/\r/g, '')
        .trim();
}

async function importApnsPrivateKey(pem) {
    const body = cleanPrivateKey(pem)
        .replace(/-----BEGIN PRIVATE KEY-----/, '')
        .replace(/-----END PRIVATE KEY-----/, '')
        .replace(/\s+/g, '');

    if (!body) throw new Error('empty APNS_PRIVATE_KEY');

    const der = Uint8Array.from(atob(body), c => c.charCodeAt(0));
    return crypto.subtle.importKey(
        'pkcs8',
        der,
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['sign']
    );
}

async function createProviderJwt(env) {
    const keyId = String(env.APNS_KEY_ID || '').trim();
    const teamId = String(env.APNS_TEAM_ID || '').trim();
    const privateKey = cleanPrivateKey(env.APNS_PRIVATE_KEY);

    if (!keyId || !teamId || !privateKey) {
        throw new Error('APNs secrets not configured');
    }

    const now = Math.floor(Date.now() / 1000);
    const header = base64UrlEncode(JSON.stringify({ alg: 'ES256', kid: keyId }));
    const claims = base64UrlEncode(JSON.stringify({ iss: teamId, iat: now }));
    const unsigned = `${header}.${claims}`;

    const key = await importApnsPrivateKey(privateKey);
    const signature = await crypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        key,
        new TextEncoder().encode(unsigned)
    );

    return `${unsigned}.${base64UrlEncode(new Uint8Array(signature))}`;
}

function apnsHost(env) {
    return String(env.APNS_ENV || 'production').toLowerCase() === 'development'
        ? 'https://api.sandbox.push.apple.com'
        : 'https://api.push.apple.com';
}

function shouldRemoveToken(status, reason) {
    return status === 410 ||
        reason === 'BadDeviceToken' ||
        reason === 'DeviceTokenNotForTopic' ||
        reason === 'Unregistered';
}

export async function sendAPNs(env, tokens, notification, data = {}) {
    if (!tokens || tokens.length === 0) {
        return { sent: 0, failed: 0, removed: 0, reason: 'no APNs tokens registered yet' };
    }
    if (!env.APNS_KEY_ID || !env.APNS_TEAM_ID || !env.APNS_PRIVATE_KEY) {
        return { skipped: true, reason: 'APNs secrets not configured' };
    }

    const topic = String(env.APNS_BUNDLE_ID || 'com.safwacemetery.app').trim();
    const jwt = await createProviderJwt(env);
    const results = { sent: 0, failed: 0, removed: 0, errors: [] };
    const body = JSON.stringify({
        aps: {
            alert: {
                title: notification.title,
                body: notification.body
            },
            sound: 'default',
            badge: 1
        },
        ...data
    });

    await Promise.all(tokens.map(async (token) => {
        try {
            const resp = await fetch(`${apnsHost(env)}/3/device/${token}`, {
                method: 'POST',
                headers: {
                    authorization: `bearer ${jwt}`,
                    'apns-topic': topic,
                    'apns-push-type': 'alert',
                    'apns-priority': '10',
                    'content-type': 'application/json'
                },
                body
            });

            if (resp.ok) {
                results.sent += 1;
                return;
            }

            const err = await resp.json().catch(() => ({}));
            const reason = err.reason || resp.status;
            if (shouldRemoveToken(resp.status, reason)) {
                await env.DB.prepare('DELETE FROM fcm_tokens WHERE token = ?').bind(token).run().catch(() => {});
                results.removed += 1;
            } else {
                results.failed += 1;
                if (results.errors.length < 5) results.errors.push(reason);
            }
        } catch (e) {
            results.failed += 1;
            if (results.errors.length < 5) results.errors.push(e.message);
        }
    }));

    return results;
}
