import { requireAuth } from '../../../../_lib/auth.js';

// STAFF ONLY: stream a private report document from the DOCS bucket.
// The DOCS bucket has NO public access — documents are reachable only through this auth-gated endpoint.
export async function onRequestGet(context) {
    const { request, env, params } = context;
    const auth = await requireAuth(env, request, ['admin', 'staff']);
    if (!auth.authorized) return auth.response;

    const id = parseInt(params.id);
    const docId = parseInt(params.docId);
    if (!id || !docId) return new Response('bad request', { status: 400 });

    const doc = await env.DB.prepare(
        `SELECT r2_key, content_type, filename FROM report_documents WHERE id = ? AND report_id = ?`
    ).bind(docId, id).first();
    if (!doc) return new Response('not found', { status: 404 });

    const obj = await env.DOCS.get(doc.r2_key);
    if (!obj) return new Response('not found', { status: 404 });

    return new Response(obj.body, {
        headers: {
            'Content-Type': doc.content_type || 'application/octet-stream',
            'Cache-Control': 'private, no-store',
            'X-Robots-Tag': 'noindex',
            'Content-Disposition': `inline; filename="${(doc.filename || 'document').replace(/[^\w.\-]/g, '_')}"`
        }
    });
}
