import {
    jsonResponse,
    requireAuth,
    verifyPassword,
    hashPassword,
    generateSalt,
    logAudit
} from '../../_lib/auth.js';

// Change own password
export async function onRequestPost(context) {
    const { request, env } = context;
    const authResult = await requireAuth(env, request);
    if (!authResult.authorized) return authResult.response;

    try {
        const body = await request.json();
        const current = body.current_password || '';
        const newPass = body.new_password || '';

        if (!newPass || newPass.length < 12) {
            return jsonResponse({ error: 'كلمة المرور الجديدة قصيرة (12 حرفاً على الأقل)' }, 400);
        }

        const user = await env.DB.prepare(
            'SELECT password_hash, password_salt FROM users WHERE id = ?'
        ).bind(authResult.user.id).first();

        const valid = await verifyPassword(current, user.password_hash, user.password_salt);
        if (!valid) {
            return jsonResponse({ error: 'كلمة المرور الحالية خاطئة' }, 401);
        }

        const salt = await generateSalt();
        const hash = await hashPassword(newPass, salt);

        await env.DB.prepare(
            'UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?'
        ).bind(hash, salt, authResult.user.id).run();

        await logAudit(env, authResult.user.id, 'change_password', 'user', authResult.user.id, null, request);

        return jsonResponse({ ok: true });
    } catch (e) {
        console.error(e); return jsonResponse({ error: 'حدث خطأ في الخادم' }, 500);
    }
}
