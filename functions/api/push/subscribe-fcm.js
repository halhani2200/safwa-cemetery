import { jsonResponse } from '../../_lib/auth.js';

// Public endpoint: native app stores Android FCM tokens and iOS APNs tokens.
export async function onRequestPost(context) {
    const { request, env } = context;
    try {
        const body = await request.json();
        const token = (body.token || '').trim();
        const platform = (body.platform || '').trim();
        const appVersion = (body.app_version || '').trim() || null;

        if (!token || token.length < 20) {
            return jsonResponse({ error: 'invalid token' }, 400);
        }
        if (!['android', 'ios'].includes(platform)) {
            return jsonResponse({ error: 'invalid platform' }, 400);
        }

        await env.DB.prepare(`
            INSERT INTO fcm_tokens (token, platform, app_version, last_seen_at, failure_count)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP, 0)
            ON CONFLICT(token) DO UPDATE SET
                platform = excluded.platform,
                app_version = excluded.app_version,
                last_seen_at = CURRENT_TIMESTAMP,
                failure_count = 0
        `).bind(token, platform, appVersion).run();

        return jsonResponse({ ok: true });
    } catch (e) {
        console.error(e);
        return jsonResponse({ error: 'حدث خطأ في الخادم' }, 500);
    }
}

export async function onRequestDelete(context) {
    const { request, env } = context;
    try {
        const body = await request.json();
        const token = (body.token || '').trim();
        if (!token) return jsonResponse({ error: 'invalid token' }, 400);
        await env.DB.prepare('DELETE FROM fcm_tokens WHERE token = ?').bind(token).run();
        return jsonResponse({ ok: true });
    } catch (e) {
        console.error(e);
        return jsonResponse({ error: 'حدث خطأ في الخادم' }, 500);
    }
}
