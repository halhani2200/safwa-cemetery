import { jsonResponse, requireAuth } from '../_lib/auth.js';

// List audit log entries - admin only
// Query params:
//   user_id: filter by user
//   action: filter by action (login, create, update, delete, etc.)
//   entity_type: filter by entity (grave, user, announcement, etc.)
//   limit (default 100, max 500)
//   offset (for pagination)
export async function onRequestGet(context) {
    const { request, env } = context;
    const auth = await requireAuth(env, request, ['admin']);
    if (!auth.authorized) return auth.response;

    try {
        const url = new URL(request.url);
        const userIdFilter = url.searchParams.get('user_id');
        const actionFilter = url.searchParams.get('action');
        const entityFilter = url.searchParams.get('entity_type');
        const limit = Math.min(500, parseInt(url.searchParams.get('limit') || '100'));
        const offset = parseInt(url.searchParams.get('offset') || '0');

        const where = [];
        const params = [];
        if (userIdFilter) { where.push('a.user_id = ?'); params.push(parseInt(userIdFilter)); }
        if (actionFilter) { where.push('a.action = ?'); params.push(actionFilter); }
        if (entityFilter) { where.push('a.entity_type = ?'); params.push(entityFilter); }
        const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

        const result = await env.DB.prepare(`
            SELECT a.id, a.user_id, u.username, u.full_name, u.role,
                   a.action, a.entity_type, a.entity_id, a.details, a.ip_address, a.created_at
            FROM audit_log a
            LEFT JOIN users u ON u.id = a.user_id
            ${whereSql}
            ORDER BY a.id DESC
            LIMIT ? OFFSET ?
        `).bind(...params, limit, offset).all();

        // Aggregate counts per user
        const stats = await env.DB.prepare(`
            SELECT u.id as user_id, u.username, u.full_name, u.role,
                   COUNT(a.id) as actions_count,
                   MAX(a.created_at) as last_action_at,
                   u.last_login_at
            FROM users u
            LEFT JOIN audit_log a ON a.user_id = u.id
            GROUP BY u.id
            ORDER BY actions_count DESC
        `).all();

        return jsonResponse({
            count: result.results.length,
            results: result.results,
            user_stats: stats.results
        });
    } catch (e) {
        console.error(e); return jsonResponse({ error: 'حدث خطأ في الخادم' }, 500);
    }
}
