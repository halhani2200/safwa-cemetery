import { jsonResponse, requireAuth, logAudit } from '../../_lib/auth.js';
import { sendPushToAll } from '../../_lib/webpush.js';
import { sendFCM } from '../../_lib/fcm.js';

// Send a custom push notification to all subscribers (admin/staff only)
// Broadcasts to BOTH Web Push subscribers AND Native FCM subscribers
export async function onRequestPost(context) {
    const { request, env } = context;
    const auth = await requireAuth(env, request, ['admin', 'staff']);
    if (!auth.authorized) return auth.response;

    try {
        const body = await request.json();
        if (!body.title || !body.title.trim()) {
            return jsonResponse({ error: 'العنوان مطلوب' }, 400);
        }
        if (!body.body || !body.body.trim()) {
            return jsonResponse({ error: 'نص الإشعار مطلوب' }, 400);
        }

        const payload = {
            title: body.title.trim(),
            body: body.body.trim(),
            url: body.url || '/',
            tag: `broadcast-${Date.now()}`,
            type: body.type || 'general'
        };

        // 1) Web Push (existing)
        const webResult = await sendPushToAll(env, payload);

        // 2) Native FCM (Android + iOS apps) — only if Firebase is configured
        let fcmResult = { skipped: true };
        try {
            const tokensResult = await env.DB.prepare('SELECT token FROM fcm_tokens').all();
            const tokens = (tokensResult.results || []).map(r => r.token);
            if (tokens.length > 0) {
                fcmResult = await sendFCM(env, tokens, {
                    title: payload.title,
                    body: payload.body
                }, { url: payload.url, type: payload.type });
            } else {
                fcmResult = { sent: 0, failed: 0, removed: 0, reason: 'no FCM tokens registered yet' };
            }
        } catch (e) {
            fcmResult = { error: e.message };
        }

        const combined = {
            web: webResult,
            fcm: fcmResult,
            total_sent: (webResult.sent || 0) + (fcmResult.sent || 0)
        };

        await logAudit(env, auth.user.id, 'broadcast', 'push', null, {
            title: body.title, type: body.type, result: combined
        }, request);

        return jsonResponse({ ok: true, ...combined });
    } catch (e) {
        console.error(e); return jsonResponse({ error: 'حدث خطأ في الخادم' }, 500);
    }
}
