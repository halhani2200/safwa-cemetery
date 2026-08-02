import { jsonResponse } from '../../_lib/auth.js';
import { sendPushToAll } from '../../_lib/webpush.js';
import { sendNativePushToAll } from '../../_lib/native-push.js';

// Server-to-server endpoint used by the announcement sync worker.
// Requires PUSH_SYNC_SECRET in both Cloudflare Pages and the sync worker.
export async function onRequestPost(context) {
    const { request, env } = context;
    const secret = String(env.PUSH_SYNC_SECRET || '').trim();
    const auth = request.headers.get('Authorization') || '';

    if (!secret || auth !== `Bearer ${secret}`) {
        return jsonResponse({ error: 'forbidden' }, 403);
    }

    try {
        const body = await request.json();
        const deceasedName = String(body.deceased_name || '').trim();
        if (!deceasedName) {
            return jsonResponse({ error: 'deceased_name required' }, 400);
        }

        const payload = {
            title: 'إعلان وفاة',
            body: `إنا لله وإنا إليه راجعون - ${deceasedName}`,
            url: '/',
            tag: `announcement-${body.source_ref || Date.now()}`,
            type: 'announcement'
        };

        const [web, native] = await Promise.all([
            sendPushToAll(env, payload).catch(e => ({ sent: 0, failed: 0, removed: 0, error: e.message })),
            sendNativePushToAll(env, {
                title: payload.title,
                body: payload.body
            }, { url: payload.url, type: payload.type, source_ref: body.source_ref || '' })
        ]);

        return jsonResponse({
            ok: true,
            web,
            native,
            total_sent: (web.sent || 0) + (native.total_sent || 0)
        });
    } catch (e) {
        console.error(e);
        return jsonResponse({ error: 'حدث خطأ في الخادم' }, 500);
    }
}
