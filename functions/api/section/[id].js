import { jsonResponse, requireAuth, logAudit } from '../../_lib/auth.js';

// Admin only: update section
export async function onRequestPut(context) {
    const { request, env, params } = context;
    const auth = await requireAuth(env, request, ['admin']);
    if (!auth.authorized) return auth.response;

    const id = parseInt(params.id);
    if (!id) return jsonResponse({ error: 'invalid id' }, 400);

    try {
        const body = await request.json();
        await env.DB.prepare(`
            UPDATE sections SET
                code = ?, name = ?,
                nw_lat = ?, nw_lng = ?, ne_lat = ?, ne_lng = ?,
                sw_lat = ?, sw_lng = ?, se_lat = ?, se_lng = ?,
                rows_count = ?, cols_count = ?, notes = ?,
                updated_at = ?
            WHERE id = ?
        `).bind(
            body.code, body.name,
            body.nw_lat, body.nw_lng, body.ne_lat, body.ne_lng,
            body.sw_lat, body.sw_lng, body.se_lat, body.se_lng,
            body.rows_count || 11, body.cols_count || 17, body.notes || null,
            new Date().toISOString(), id
        ).run();

        await logAudit(env, auth.user.id, 'update', 'section', id, body, request);
        return jsonResponse({ ok: true });
    } catch (e) {
        return jsonResponse({ error: e.message }, 500);
    }
}

// Admin only: delete section
export async function onRequestDelete(context) {
    const { request, env, params } = context;
    const auth = await requireAuth(env, request, ['admin']);
    if (!auth.authorized) return auth.response;

    const id = parseInt(params.id);
    if (!id) return jsonResponse({ error: 'invalid id' }, 400);

    try {
        // Check if any graves reference this section
        const sec = await env.DB.prepare(`SELECT code FROM sections WHERE id = ?`).bind(id).first();
        if (!sec) return jsonResponse({ error: 'المنطقة غير موجودة' }, 404);
        const count = await env.DB.prepare(`SELECT COUNT(*) as cnt FROM graves WHERE section = ?`).bind(sec.code).first();
        if (count && count.cnt > 0) {
            return jsonResponse({ error: `لا يمكن الحذف — يوجد ${count.cnt} قبر مسجل بهذه المنطقة` }, 400);
        }
        await env.DB.prepare(`DELETE FROM sections WHERE id = ?`).bind(id).run();
        await logAudit(env, auth.user.id, 'delete', 'section', id, { code: sec.code }, request);
        return jsonResponse({ ok: true });
    } catch (e) {
        return jsonResponse({ error: e.message }, 500);
    }
}
