import { jsonResponse, requireAuth, logAudit } from '../../_lib/auth.js';

// Update report status (admin only)
export async function onRequestPut(context) {
    const { request, env, params } = context;
    const authResult = await requireAuth(env, request, ['admin']);
    if (!authResult.authorized) return authResult.response;

    const id = parseInt(params.id);
    if (!id) return jsonResponse({ error: 'invalid id' }, 400);

    try {
        const body = await request.json();
        const status = body.status;
        if (!['pending', 'reviewed', 'resolved'].includes(status)) {
            return jsonResponse({ error: 'invalid status' }, 400);
        }

        await env.DB.prepare(`
            UPDATE error_reports SET status = ?, reviewed_at = ?, reviewed_by = ? WHERE id = ?
        `).bind(status, new Date().toISOString(), authResult.user.id, id).run();

        await logAudit(env, authResult.user.id, 'update', 'error_report', id, { status }, request);
        return jsonResponse({ ok: true });
    } catch (e) {
        console.error(e); return jsonResponse({ error: 'حدث خطأ في الخادم' }, 500);
    }
}
