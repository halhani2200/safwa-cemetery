import {
    jsonResponse,
    requireAuth,
    hashPassword,
    generateSalt,
    logAudit
} from '../../_lib/auth.js';

// Update user (admin only - usually for password change or activation)
export async function onRequestPut(context) {
    const { request, env, params } = context;
    const authResult = await requireAuth(env, request, ['admin']);
    if (!authResult.authorized) return authResult.response;

    const id = parseInt(params.id);
    if (!id) return jsonResponse({ error: 'invalid id' }, 400);

    try {
        const body = await request.json();
        const updates = [];
        const bindings = [];

        if (body.full_name !== undefined) {
            updates.push('full_name = ?');
            bindings.push(body.full_name);
        }
        if (body.role !== undefined) {
            if (!['admin', 'staff', 'volunteer'].includes(body.role)) {
                return jsonResponse({ error: 'دور غير صحيح' }, 400);
            }
            updates.push('role = ?');
            bindings.push(body.role);
        }
        if (body.is_active !== undefined) {
            updates.push('is_active = ?');
            bindings.push(body.is_active ? 1 : 0);
        }
        if (body.password) {
            if (body.password.length < 6) {
                return jsonResponse({ error: 'كلمة المرور قصيرة جداً' }, 400);
            }
            const salt = await generateSalt();
            const hash = await hashPassword(body.password, salt);
            updates.push('password_hash = ?', 'password_salt = ?');
            bindings.push(hash, salt);
        }

        if (updates.length === 0) {
            return jsonResponse({ error: 'لا يوجد تغييرات' }, 400);
        }

        bindings.push(id);

        await env.DB.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).bind(...bindings).run();
        await logAudit(env, authResult.user.id, 'update', 'user', id, { changes: Object.keys(body) }, request);

        return jsonResponse({ ok: true });
    } catch (e) {
        return jsonResponse({ error: e.message }, 500);
    }
}

// Delete user (admin only - can't delete self or the last remaining admin)
export async function onRequestDelete(context) {
    const { request, env, params } = context;
    const authResult = await requireAuth(env, request, ['admin']);
    if (!authResult.authorized) return authResult.response;

    const id = parseInt(params.id);
    if (!id) return jsonResponse({ error: 'invalid id' }, 400);
    if (id === authResult.user.id) {
        return jsonResponse({ error: 'لا يمكن حذف حسابك' }, 400);
    }

    try {
        const target = await env.DB.prepare('SELECT role FROM users WHERE id = ?').bind(id).first();
        if (!target) return jsonResponse({ error: 'المستخدم غير موجود' }, 404);

        if (target.role === 'admin') {
            const adminCount = await env.DB.prepare(
                "SELECT COUNT(*) as c FROM users WHERE role = 'admin' AND is_active = 1"
            ).first();
            if ((adminCount?.c ?? 0) <= 1) {
                return jsonResponse({ error: 'لا يمكن حذف آخر مدير في النظام' }, 400);
            }
        }

        await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
        await logAudit(env, authResult.user.id, 'delete', 'user', id, null, request);
        return jsonResponse({ ok: true });
    } catch (e) {
        return jsonResponse({ error: e.message }, 500);
    }
}
