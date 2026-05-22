import {
    jsonResponse,
    requireAuth,
    hashPassword,
    generateSalt,
    logAudit
} from '../_lib/auth.js';

// List all users (admin only)
export async function onRequestGet(context) {
    const { request, env } = context;
    const authResult = await requireAuth(env, request, ['admin']);
    if (!authResult.authorized) return authResult.response;

    try {
        const result = await env.DB.prepare(`
            SELECT u.id, u.username, u.full_name, u.role, u.is_active,
                   u.last_login_at, u.created_at,
                   (SELECT COUNT(*) FROM graves WHERE created_by = u.id) as graves_added
            FROM users u
            ORDER BY u.role, u.username
        `).all();

        return jsonResponse({ count: result.results.length, results: result.results });
    } catch (e) {
        console.error(e); return jsonResponse({ error: 'حدث خطأ في الخادم' }, 500);
    }
}

// Add new user (admin only)
export async function onRequestPost(context) {
    const { request, env } = context;
    const authResult = await requireAuth(env, request, ['admin']);
    if (!authResult.authorized) return authResult.response;

    try {
        const body = await request.json();
        const username = (body.username || '').trim();
        const password = body.password || '';
        const fullName = (body.full_name || '').trim();
        const role = body.role;

        if (!username || !password || !role) {
            return jsonResponse({ error: 'بيانات ناقصة' }, 400);
        }
        if (!['admin', 'staff', 'volunteer'].includes(role)) {
            return jsonResponse({ error: 'الدور غير صحيح' }, 400);
        }
        if (password.length < 12) {
            return jsonResponse({ error: 'كلمة المرور يجب أن تكون 12 حرفاً على الأقل' }, 400);
        }

        const existing = await env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).first();
        if (existing) {
            return jsonResponse({ error: 'اسم المستخدم مستخدم بالفعل' }, 400);
        }

        const salt = await generateSalt();
        const hash = await hashPassword(password, salt);

        const result = await env.DB.prepare(`
            INSERT INTO users (username, password_hash, password_salt, full_name, role, is_active, created_by)
            VALUES (?, ?, ?, ?, ?, 1, ?)
        `).bind(username, hash, salt, fullName || null, role, authResult.user.id).run();

        await logAudit(env, authResult.user.id, 'create', 'user', result.meta.last_row_id, { username, role }, request);

        return jsonResponse({ ok: true, id: result.meta.last_row_id }, 201);
    } catch (e) {
        console.error(e); return jsonResponse({ error: 'حدث خطأ في الخادم' }, 500);
    }
}

// Update or delete via /api/users/[id]
