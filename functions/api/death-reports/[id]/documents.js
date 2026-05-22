import { jsonResponse } from '../../../_lib/auth.js';

const MAX_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

// PUBLIC (token-gated): family uploads a document to the PRIVATE DOCS bucket.
// Requires the report's edit_token (?token= or X-Report-Token header) — only the reporter can attach.
export async function onRequestPost(context) {
    const { request, env, params } = context;
    const id = parseInt(params.id);
    if (!id) return jsonResponse({ error: 'invalid id' }, 400);
    try {
        const url = new URL(request.url);
        const token = url.searchParams.get('token') || request.headers.get('X-Report-Token');
        const rep = await env.DB.prepare(`SELECT id, edit_token FROM death_reports WHERE id = ?`).bind(id).first();
        if (!rep) return jsonResponse({ error: 'not found' }, 404);
        if (!token || token !== rep.edit_token) return jsonResponse({ error: 'forbidden' }, 403);

        const ct = request.headers.get('Content-Type') || '';
        if (!ct.includes('multipart/form-data')) return jsonResponse({ error: 'multipart required' }, 400);
        const form = await request.formData();
        const file = form.get('file');
        const kind = (form.get('kind') || '').toString();
        if (!file || typeof file === 'string') return jsonResponse({ error: 'لم يتم إرسال ملف' }, 400);
        if (!ALLOWED.includes(file.type)) return jsonResponse({ error: 'صيغة غير مدعومة (صورة أو PDF)' }, 400);
        if (file.size > MAX_BYTES) return jsonResponse({ error: 'حجم الملف يجب أن يكون أقل من 8 ميجابايت' }, 400);

        const ext = file.type === 'application/pdf' ? 'pdf'
            : file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
        const rand = crypto.getRandomValues(new Uint8Array(6));
        const hex = Array.from(rand).map(b => b.toString(16).padStart(2, '0')).join('');
        const key = `reports/${id}/${Date.now()}-${hex}.${ext}`;

        await env.DOCS.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
        await env.DB.prepare(
            `INSERT INTO report_documents (report_id, kind, r2_key, filename, size, content_type)
             VALUES (?,?,?,?,?,?)`
        ).bind(id, kind || null, key, file.name || null, file.size, file.type).run();

        return jsonResponse({ ok: true });
    } catch (e) {
        return jsonResponse({ error: 'server_error' }, 500);
    }
}
