// FCM HTTP v1 API client for Cloudflare Workers
// Requires Firebase Service Account JSON stored as FIREBASE_SERVICE_ACCOUNT env secret
//
// Generate access token from service account → POST to FCM v1 endpoint
// Reference: https://firebase.google.com/docs/cloud-messaging/auth-server

async function importPrivateKey(pem) {
    const pemContents = pem
        .replace(/-----BEGIN PRIVATE KEY-----/, '')
        .replace(/-----END PRIVATE KEY-----/, '')
        .replace(/\s+/g, '');
    const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
    return crypto.subtle.importKey(
        'pkcs8',
        binaryDer,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['sign']
    );
}

function base64UrlEncode(input) {
    let b64;
    if (typeof input === 'string') {
        b64 = btoa(unescape(encodeURIComponent(input)));
    } else {
        let str = '';
        for (let i = 0; i < input.length; i++) str += String.fromCharCode(input[i]);
        b64 = btoa(str);
    }
    return b64.replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function getAccessToken(serviceAccount) {
    const now = Math.floor(Date.now() / 1000);
    const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const payload = base64UrlEncode(JSON.stringify({
        iss: serviceAccount.client_email,
        scope: 'https://www.googleapis.com/auth/firebase.messaging',
        aud: 'https://oauth2.googleapis.com/token',
        exp: now + 3600,
        iat: now
    }));
    const unsigned = `${header}.${payload}`;

    const key = await importPrivateKey(serviceAccount.private_key);
    const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
    const sigB64 = base64UrlEncode(new Uint8Array(signature));
    const jwt = `${unsigned}.${sigB64}`;

    const r = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
    });
    const data = await r.json();
    if (!data.access_token) throw new Error('FCM auth failed: ' + JSON.stringify(data));
    return data.access_token;
}

export async function sendFCM(env, tokens, notification, data) {
    // notification = { title, body }
    // data = { url, ... }  (optional, stringified per FCM spec)
    if (!env.FIREBASE_SERVICE_ACCOUNT) {
        return { skipped: true, reason: 'FIREBASE_SERVICE_ACCOUNT not configured' };
    }

    let serviceAccount;
    try {
        serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
    } catch (e) {
        return { skipped: true, reason: 'invalid FIREBASE_SERVICE_ACCOUNT JSON' };
    }

    const projectId = serviceAccount.project_id;
    const accessToken = await getAccessToken(serviceAccount);
    const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    const dataStr = {};
    if (data) {
        for (const [k, v] of Object.entries(data)) {
            dataStr[k] = String(v);
        }
    }

    const results = { sent: 0, failed: 0, removed: 0, errors: [] };

    // Send one-by-one (FCM v1 doesn't support batch in the same way as legacy)
    // For large lists, consider using subprocess-style /batch endpoint
    await Promise.all(tokens.map(async (token) => {
        try {
            const resp = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: {
                        token,
                        notification: { title: notification.title, body: notification.body },
                        data: dataStr,
                        android: {
                            priority: 'high',
                            notification: {
                                sound: 'default',
                                click_action: 'FCM_PLUGIN_ACTIVITY'
                            }
                        },
                        apns: {
                            payload: {
                                aps: {
                                    alert: { title: notification.title, body: notification.body },
                                    sound: 'default',
                                    badge: 1
                                }
                            }
                        }
                    }
                })
            });
            if (resp.ok) {
                results.sent++;
            } else {
                const err = await resp.json().catch(() => ({}));
                const code = err?.error?.details?.[0]?.errorCode || err?.error?.status;
                if (code === 'UNREGISTERED' || code === 'INVALID_ARGUMENT') {
                    // Token is invalid — remove it
                    await env.DB.prepare('DELETE FROM fcm_tokens WHERE token = ?').bind(token).run().catch(() => {});
                    results.removed++;
                } else {
                    results.failed++;
                    if (results.errors.length < 5) results.errors.push(code || resp.status);
                }
            }
        } catch (e) {
            results.failed++;
            if (results.errors.length < 5) results.errors.push(e.message);
        }
    }));

    return results;
}
