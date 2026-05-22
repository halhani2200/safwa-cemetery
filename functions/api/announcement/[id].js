import { jsonResponse, requireAuth, logAudit } from '../../_lib/auth.js';
import { sendPushToAll } from '../../_lib/webpush.js';

// PUT: update announcement (admin only)
export async function onRequestPut(context) {
    const { request, env, params } = context;
    const auth = await requireAuth(env, request, ['admin']);
    if (!auth.authorized) return auth.response;

    const id = parseInt(params.id);
    if (!id) return jsonResponse({ error: 'invalid id' }, 400);

    try {
        const body = await request.json();
        await env.DB.prepare(`
            UPDATE announcements SET
                deceased_name = ?, kunya = ?, family = ?, message = ?,
                funeral_info = ?, burial_info = ?, condolence_men = ?, condolence_women = ?,
                grave_id = ?, is_active = ?, expires_at = ?, updated_at = ?
            WHERE id = ?
        `).bind(
            body.deceased_name, body.kunya || null, body.family || null, body.message || null,
            body.funeral_info || null, body.burial_info || null,
            body.condolence_men || null, body.condolence_women || null,
            body.grave_id || null, body.is_active === false ? 0 : 1, body.expires_at || null,
            new Date().toISOString(), id
        ).run();
        await logAudit(env, auth.user.id, 'update', 'announcement', id, { name: body.deceased_name }, request);

        let pushResult = null;
        if (body.send_notification) {
            const payload = {
                title: 'إعلان وفاة',
                body: `إنا لله وإنا إليه راجعون — ${body.deceased_name}${body.kunya ? ' (' + body.kunya + ')' : ''}`,
                url: '/',
                tag: `announcement-${id}`,
                announcement_id: id
            };
            pushResult = await sendPushToAll(env, payload);
            await env.DB.prepare('UPDATE announcements SET notification_sent = 1 WHERE id = ?').bind(id).run();
        }

        return jsonResponse({ ok: true, push: pushResult });
    } catch (e) {
        console.error(e); return jsonResponse({ error: 'حدث خطأ في الخادم' }, 500);
    }
}

// DELETE: remove announcement (admin only)
export async function onRequestDelete(context) {
    const { request, env, params } = context;
    const auth = await requireAuth(env, request, ['admin']);
    if (!auth.authorized) return auth.response;

    const id = parseInt(params.id);
    if (!id) return jsonResponse({ error: 'invalid id' }, 400);

    try {
        await env.DB.prepare('DELETE FROM announcements WHERE id = ?').bind(id).run();
        await logAudit(env, auth.user.id, 'delete', 'announcement', id, {}, request);
        return jsonResponse({ ok: true });
    } catch (e) {
        console.error(e); return jsonResponse({ error: 'حدث خطأ في الخادم' }, 500);
    }
}
