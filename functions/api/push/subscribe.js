import { jsonResponse } from '../../_lib/auth.js';

// Public: save a push subscription
export async function onRequestPost(context) {
    const { request, env } = context;
    try {
        const body = await request.json();
        const { endpoint, keys } = body;
        if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
            return jsonResponse({ error: 'invalid subscription' }, 400);
        }
        const ua = request.headers.get('user-agent') || '';
        await env.DB.prepare(`
            INSERT INTO push_subscriptions (endpoint, p256dh, auth, user_agent, last_used_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(endpoint) DO UPDATE SET
                p256dh = excluded.p256dh,
                auth = excluded.auth,
                user_agent = excluded.user_agent,
                last_used_at = excluded.last_used_at,
                failure_count = 0
        `).bind(endpoint, keys.p256dh, keys.auth, ua, new Date().toISOString()).run();
        return jsonResponse({ ok: true });
    } catch (e) {
        console.error(e); return jsonResponse({ error: 'حدث خطأ في الخادم' }, 500);
    }
}
