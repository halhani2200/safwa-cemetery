import { jsonResponse, getUserFromSession, requireAuth, logAudit } from '../_lib/auth.js';

// Public: list sections (read-only for everyone)
export async function onRequestGet(context) {
    const { env } = context;
    try {
        const result = await env.DB.prepare(`
            SELECT id, code, name, nw_lat, nw_lng, ne_lat, ne_lng, sw_lat, sw_lng, se_lat, se_lng,
                   rows_count, cols_count, notes, created_at, updated_at
            FROM sections
            ORDER BY code
        `).all();
        return jsonResponse({ count: result.results.length, results: result.results });
    } catch (e) {
        console.error(e); return jsonResponse({ error: 'حدث خطأ في الخادم' }, 500);
    }
}

// Admin only: create section
export async function onRequestPost(context) {
    const { request, env } = context;
    const auth = await requireAuth(env, request, ['admin']);
    if (!auth.authorized) return auth.response;

    try {
        const body = await request.json();
        const code = (body.code || '').trim();
        const name = (body.name || '').trim();
        if (!code || !name) return jsonResponse({ error: 'الرمز والاسم مطلوبان' }, 400);

        const result = await env.DB.prepare(`
            INSERT INTO sections (code, name, nw_lat, nw_lng, ne_lat, ne_lng, sw_lat, sw_lng, se_lat, se_lng, rows_count, cols_count, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            code, name,
            body.nw_lat || null, body.nw_lng || null,
            body.ne_lat || null, body.ne_lng || null,
            body.sw_lat || null, body.sw_lng || null,
            body.se_lat || null, body.se_lng || null,
            body.rows_count || 11, body.cols_count || 17,
            body.notes || null
        ).run();

        await logAudit(env, auth.user.id, 'create', 'section', result.meta.last_row_id, { code, name }, request);

        return jsonResponse({ ok: true, id: result.meta.last_row_id });
    } catch (e) {
        if (String(e.message || '').includes('UNIQUE')) {
            return jsonResponse({ error: 'رمز المنطقة موجود مسبقاً' }, 400);
        }
        console.error(e); return jsonResponse({ error: 'حدث خطأ في الخادم' }, 500);
    }
}
