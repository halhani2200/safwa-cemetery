import { jsonResponse, requireAuth } from '../_lib/auth.js';

// List all error reports (admin only)
export async function onRequestGet(context) {
    const { request, env } = context;
    const authResult = await requireAuth(env, request, ['admin']);
    if (!authResult.authorized) return authResult.response;

    try {
        const result = await env.DB.prepare(`
            SELECT r.id, r.grave_id, r.description, r.reporter_name, r.reporter_phone,
                   r.status, r.created_at, r.reviewed_at,
                   g.name as grave_name
            FROM error_reports r
            LEFT JOIN graves g ON g.id = r.grave_id
            ORDER BY
                CASE WHEN r.status = 'pending' THEN 0 ELSE 1 END,
                r.created_at DESC
            LIMIT 200
        `).all();
        return jsonResponse({ count: result.results.length, results: result.results });
    } catch (e) {
        return jsonResponse({ error: e.message }, 500);
    }
}
