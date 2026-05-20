import { jsonResponse, requireAuth, logAudit } from '../../_lib/auth.js';
import { sendPushToAll } from '../../_lib/webpush.js';

// Send a custom push notification to all subscribers (admin/staff only)
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

        const result = await sendPushToAll(env, payload);
        await logAudit(env, auth.user.id, 'broadcast', 'push', null, {
            title: body.title, type: body.type, result
        }, request);

        return jsonResponse({ ok: true, ...result });
    } catch (e) {
        return jsonResponse({ error: e.message }, 500);
    }
}
