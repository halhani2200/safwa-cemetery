import { jsonResponse, requireAuth } from '../_lib/auth.js';

// Get current user's grave additions
export async function onRequestGet(context) {
    const { request, env } = context;
    const authResult = await requireAuth(env, request);
    if (!authResult.authorized) return authResult.response;

    try {
        const result = await env.DB.prepare(`
            SELECT id, name, gender, section, row_number, grave_number, grave_reference, created_at
            FROM graves
            WHERE created_by = ?
            ORDER BY created_at DESC
            LIMIT 50
        `).bind(authResult.user.id).all();
        return jsonResponse({ count: result.results.length, results: result.results });
    } catch (e) {
        console.error(e); return jsonResponse({ error: 'حدث خطأ في الخادم' }, 500);
    }
}
