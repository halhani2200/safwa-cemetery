import { jsonResponse, requireAuth, logAudit } from '../../_lib/auth.js';
import { sendPushToAll } from '../../_lib/webpush.js';
import { sendNativePushToAll } from '../../_lib/native-push.js';

// Send a custom push notification to all subscribers (admin/staff only).
// Broadcasts to both Web Push subscribers and native app subscribers.
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

        let webResult = { sent: 0, failed: 0, removed: 0 };
        try {
            webResult = await sendPushToAll(env, payload);
        } catch (e) {
            webResult = { sent: 0, failed: 0, removed: 0, error: e.message };
        }

        let nativeResult = { skipped: true };
        try {
            nativeResult = await sendNativePushToAll(env, {
                title: payload.title,
                body: payload.body
            }, { url: payload.url, type: payload.type });
        } catch (e) {
            nativeResult = { error: e.message };
        }

        const combined = {
            web: webResult,
            native: nativeResult,
            total_sent: (webResult.sent || 0) + (nativeResult.total_sent || 0)
        };

        await logAudit(env, auth.user.id, 'broadcast', 'push', null, {
            title: body.title,
            type: body.type,
            result: combined
        }, request);

        return jsonResponse({ ok: true, ...combined });
    } catch (e) {
        console.error(e);
        return jsonResponse({ error: 'حدث خطأ في الخادم' }, 500);
    }
}
