import {
    verifyPassword,
    createSession,
    sessionCookieHeader,
    checkAndIncrementFailedLogin,
    resetFailedLogin,
    logAudit,
    jsonResponse
} from '../../_lib/auth.js';

export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        const body = await request.json();
        const username = (body.username || '').trim();
        const password = body.password || '';

        if (!username || !password) {
            return jsonResponse({ error: 'بيانات ناقصة' }, 400);
        }

        // Check if locked
        const lockCheck = await checkAndIncrementFailedLogin(env, username);
        if (lockCheck.locked && !await isPasswordCorrect(env, username, password)) {
            return jsonResponse({
                error: 'تم قفل الحساب مؤقتاً بسبب كثرة المحاولات الخاطئة. جرّب بعد 15 دقيقة.'
            }, 429);
        }

        const user = await env.DB.prepare(
            'SELECT id, username, password_hash, password_salt, role, is_active, full_name FROM users WHERE username = ?'
        ).bind(username).first();

        if (!user || !user.is_active) {
            return jsonResponse({ error: 'بيانات الدخول غير صحيحة' }, 401);
        }

        const valid = await verifyPassword(password, user.password_hash, user.password_salt);
        if (!valid) {
            return jsonResponse({ error: 'بيانات الدخول غير صحيحة' }, 401);
        }

        await resetFailedLogin(env, user.id);

        // Update last_login_at
        await env.DB.prepare('UPDATE users SET last_login_at = ? WHERE id = ?')
            .bind(new Date().toISOString(), user.id).run();

        const sessionId = await createSession(env, user.id, request);
        await logAudit(env, user.id, 'login', 'session', null, null, request);

        const redirect = user.role === 'admin' ? '/admin/' : '/staff/';

        return jsonResponse(
            {
                ok: true,
                // Token for native (iOS) clients that can't use cross-origin cookies.
                // Web/Android keep using the Set-Cookie session below.
                token: sessionId,
                user: {
                    id: user.id,
                    username: user.username,
                    full_name: user.full_name,
                    role: user.role
                },
                redirect
            },
            200,
            { 'Set-Cookie': sessionCookieHeader(sessionId) }
        );
    } catch (e) {
        return jsonResponse({ error: 'خطأ في الخادم: ' + e.message }, 500);
    }
}

async function isPasswordCorrect(env, username, password) {
    const user = await env.DB.prepare(
        'SELECT password_hash, password_salt FROM users WHERE username = ?'
    ).bind(username).first();
    if (!user) return false;
    return verifyPassword(password, user.password_hash, user.password_salt);
}
