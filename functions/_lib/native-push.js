import { sendFCM } from './fcm.js';
import { sendAPNs } from './apns.js';

export async function sendNativePushToAll(env, notification, data = {}) {
    let tokenRows;
    try {
        tokenRows = await env.DB.prepare('SELECT token, platform FROM fcm_tokens').all();
    } catch (e) {
        return {
            error: e.message,
            fcm: { skipped: true },
            apns: { skipped: true },
            total_sent: 0
        };
    }

    const rows = tokenRows.results || [];
    const androidTokens = rows
        .filter(r => (r.platform || '').toLowerCase() !== 'ios')
        .map(r => r.token)
        .filter(Boolean);
    const iosTokens = rows
        .filter(r => (r.platform || '').toLowerCase() === 'ios')
        .map(r => r.token)
        .filter(Boolean);

    const [fcm, apns] = await Promise.all([
        androidTokens.length
            ? sendFCM(env, androidTokens, notification, data)
            : Promise.resolve({ sent: 0, failed: 0, removed: 0, reason: 'no Android FCM tokens registered yet' }),
        iosTokens.length
            ? sendAPNs(env, iosTokens, notification, data)
            : Promise.resolve({ sent: 0, failed: 0, removed: 0, reason: 'no iOS APNs tokens registered yet' })
    ]);

    return {
        fcm,
        apns,
        total_sent: (fcm.sent || 0) + (apns.sent || 0),
        total_failed: (fcm.failed || 0) + (apns.failed || 0),
        total_removed: (fcm.removed || 0) + (apns.removed || 0),
        token_count: rows.length,
        android_token_count: androidTokens.length,
        ios_token_count: iosTokens.length
    };
}
