import { jsonResponse, requireAuth, logAudit } from '../../_lib/auth.js';

// STAFF: view a single report (full, incl. sensitive fields) + its documents (metadata only).
export async function onRequestGet(context) {
    const { request, env, params } = context;
    const auth = await requireAuth(env, request, ['admin', 'staff']);
    if (!auth.authorized) return auth.response;
    const id = parseInt(params.id);
    if (!id) return jsonResponse({ error: 'invalid id' }, 400);
    const rep = await env.DB.prepare(`SELECT * FROM death_reports WHERE id = ?`).bind(id).first();
    if (!rep) return jsonResponse({ error: 'not found' }, 404);
    delete rep.edit_token; // never expose the family token to staff UI
    const docs = await env.DB.prepare(
        `SELECT id, kind, filename, size, content_type, created_at FROM report_documents WHERE report_id = ? ORDER BY id`
    ).bind(id).all();
    return jsonResponse({ ...rep, documents: docs.results || [] });
}

// STAFF: update status / notes (received → staff_review → confirmed → published / rejected).
export async function onRequestPut(context) {
    const { request, env, params } = context;
    const auth = await requireAuth(env, request, ['admin', 'staff']);
    if (!auth.authorized) return auth.response;
    const id = parseInt(params.id);
    if (!id) return jsonResponse({ error: 'invalid id' }, 400);
    try {
        const b = await request.json();
        const allowed = ['received', 'staff_review', 'confirmed', 'published', 'rejected'];
        if (b.status && !allowed.includes(b.status)) return jsonResponse({ error: 'حالة غير صحيحة' }, 400);
        await env.DB.prepare(
            `UPDATE death_reports SET status = COALESCE(?, status), notes = COALESCE(?, notes),
                    updated_at = ?, reviewed_by = ? WHERE id = ?`
        ).bind(b.status ?? null, b.notes ?? null, new Date().toISOString(), auth.user.id, id).run();
        await logAudit(env, auth.user.id, 'update', 'death_report', id, { status: b.status }, request);
        return jsonResponse({ ok: true });
    } catch (e) {
        return jsonResponse({ error: 'server_error' }, 500);
    }
}
