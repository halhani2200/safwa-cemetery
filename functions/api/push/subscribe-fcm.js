import { jsonResponse } from '../../_lib/auth.js';

// Public endpoint — users can subscribe their device for FCM push from native app
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

        // Upsert — same token means same device (FCM tokens are stable per install)
        await env.DB.prepare(`
            INSERT INTO fcm_tokens (token, platform, app_version, last_seen_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(token) DO UPDATE SET
                platform = excluded.platform,
                app_version = excluded.app_version,
                last_seen_at = CURRENT_TIMESTAMP
        `).bind(token, platform, appVersion).run();

        return jsonResponse({ ok: true });
    } catch (e) {
        console.error(e); return jsonResponse({ error: 'حدث خطأ في الخادم' }, 500);
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
        console.error(e); return jsonResponse({ error: 'حدث خطأ في الخادم' }, 500);
    }
}
