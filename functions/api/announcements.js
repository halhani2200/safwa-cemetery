import { jsonResponse, getUserFromSession, requireAuth, logAudit } from '../_lib/auth.js';
import { sendPushToAll } from '../_lib/webpush.js';
import { sendNativePushToAll } from '../_lib/native-push.js';

// GET: list announcements
// - Admin sees all (active + inactive + expired)
// - Public sees only active and unexpired
export async function onRequestGet(context) {
    const { request, env } = context;
    const user = await getUserFromSession(env, request);

    try {
        let sql;
        if (user && user.role === 'admin') {
            sql = 'SELECT * FROM announcements ORDER BY created_at DESC LIMIT 200';
        } else {
            const now = new Date().toISOString();
            sql = `SELECT id, deceased_name, kunya, family, message, funeral_info, burial_info,
                          condolence_men, condolence_women, grave_id, created_at
                   FROM announcements
                   WHERE is_active = 1 AND (expires_at IS NULL OR expires_at > '${now}')
                   ORDER BY created_at DESC LIMIT 50`;
        }
        const result = await env.DB.prepare(sql).all();
        return jsonResponse({ count: result.results.length, results: result.results });
    } catch (e) {
        console.error(e);
        return jsonResponse({ error: 'حدث خطأ في الخادم' }, 500);
    }
}

// POST: create announcement (admin/staff)
export async function onRequestPost(context) {
    const { request, env } = context;
    const auth = await requireAuth(env, request, ['admin', 'staff']);
    if (!auth.authorized) return auth.response;

    try {
        const body = await request.json();
        if (!body.deceased_name || !body.deceased_name.trim()) {
            return jsonResponse({ error: 'اسم المتوفى مطلوب' }, 400);
        }

        const result = await env.DB.prepare(`
            INSERT INTO announcements (
                deceased_name, kunya, family, message,
                funeral_info, burial_info, condolence_men, condolence_women,
                grave_id, is_active, expires_at, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            body.deceased_name.trim(),
            body.kunya || null,
            body.family || null,
            body.message || null,
            body.funeral_info || null,
            body.burial_info || null,
            body.condolence_men || null,
            body.condolence_women || null,
            body.grave_id || null,
            body.is_active === false ? 0 : 1,
            body.expires_at || null,
            auth.user.id
        ).run();

        const id = result.meta.last_row_id;
        await logAudit(env, auth.user.id, 'create', 'announcement', id, { name: body.deceased_name }, request);

        let pushResult = null;
        if (body.send_notification) {
            const payload = {
                title: 'إعلان وفاة',
                body: `إنا لله وإنا إليه راجعون - ${body.deceased_name}${body.kunya ? ' (' + body.kunya + ')' : ''}`,
                url: '/',
                tag: `announcement-${id}`,
                announcement_id: id
            };
            const [web, native] = await Promise.all([
                sendPushToAll(env, payload).catch(e => ({ sent: 0, failed: 0, removed: 0, error: e.message })),
                sendNativePushToAll(env, {
                    title: payload.title,
                    body: payload.body
                }, { url: payload.url, type: 'announcement', announcement_id: id })
            ]);
            pushResult = {
                web,
                native,
                total_sent: (web.sent || 0) + (native.total_sent || 0)
            };
            await env.DB.prepare('UPDATE announcements SET notification_sent = 1 WHERE id = ?').bind(id).run();
        }

        return jsonResponse({ ok: true, id, push: pushResult });
    } catch (e) {
        console.error(e);
        return jsonResponse({ error: 'حدث خطأ في الخادم' }, 500);
    }
}
