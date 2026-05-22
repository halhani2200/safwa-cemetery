import { jsonResponse, requireAuth } from '../_lib/auth.js';

export async function onRequestGet(context) {
    const { request, env } = context;
    const authResult = await requireAuth(env, request, ['admin', 'staff', 'volunteer']);
    if (!authResult.authorized) return authResult.response;

    try {
        const stats = {};

        const total = await env.DB.prepare('SELECT COUNT(*) as c FROM graves').first();
        stats.total_graves = total.c;

        const gender = await env.DB.prepare(`
            SELECT gender, COUNT(*) as c FROM graves WHERE gender IS NOT NULL GROUP BY gender
        `).all();
        stats.by_gender = gender.results;

        const sections = await env.DB.prepare(`
            SELECT section, COUNT(*) as c FROM graves WHERE section IS NOT NULL GROUP BY section
        `).all();
        stats.by_section = sections.results;

        if (authResult.user.role === 'admin') {
            const users = await env.DB.prepare(`
                SELECT role, COUNT(*) as c FROM users WHERE is_active = 1 GROUP BY role
            `).all();
            stats.users = users.results;

            const pendingReports = await env.DB.prepare(`
                SELECT COUNT(*) as c FROM error_reports WHERE status = 'pending'
            `).first();
            stats.pending_error_reports = pendingReports.c;
        }

        // Personal stats
        const myAdds = await env.DB.prepare(`
            SELECT COUNT(*) as c FROM graves WHERE created_by = ?
        `).bind(authResult.user.id).first();
        stats.my_additions = myAdds.c;

        return jsonResponse(stats);
    } catch (e) {
        console.error(e); return jsonResponse({ error: 'حدث خطأ في الخادم' }, 500);
    }
}
