import { getUserFromSession } from './_lib/auth.js';

// Allowed cross-origin callers. The native iOS/Android app (Capacitor) loads its
// bundled UI from a local scheme and calls the live API cross-origin, so we must
// echo an explicit origin (never "*" — credentials are used). The website itself
// is same-origin and does not need CORS, but its origin is allow-listed for safety.
const CORS_ORIGINS = new Set([
    'capacitor://localhost',
    'ionic://localhost',
    'http://localhost',
    'https://localhost',
    'https://safwa-cemetery.com',
]);

function corsHeaders(origin) {
    return {
        'Access-Control-Allow-Origin': origin,
        'Vary': 'Origin',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400',
    };
}

export async function onRequest(context) {
    const { request, env, next } = context;
    const url = new URL(request.url);
    const path = url.pathname;

    // ----- API: enforce CORS for native (Capacitor) cross-origin requests -----
    // Each endpoint still enforces its own auth and returns JSON 401/403.
    if (path.startsWith('/api/')) {
        const origin = request.headers.get('Origin');
        const allowed = origin && CORS_ORIGINS.has(origin);

        // Preflight
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: allowed ? corsHeaders(origin) : { 'Vary': 'Origin' },
            });
        }

        const res = await next();
        if (!allowed) return res;
        const newRes = new Response(res.body, res);
        const ch = corsHeaders(origin);
        for (const k in ch) newRes.headers.set(k, ch[k]);
        return newRes;
    }

    // ----- Server-side guard for /admin/* and /staff/* HTML pages -----
    // JS-only redirects can be bypassed by reading the HTML before scripts run.
    const needsAdmin = path.startsWith('/admin/') || path === '/admin';
    const needsStaff = path.startsWith('/staff/') || path === '/staff';

    if (!needsAdmin && !needsStaff) return next();

    const user = await getUserFromSession(env, request);
    if (!user) {
        return Response.redirect(`${url.origin}/login.html`, 302);
    }
    if (needsAdmin && user.role !== 'admin') {
        return Response.redirect(`${url.origin}/login.html`, 302);
    }
    if (needsStaff && !['admin', 'staff', 'volunteer'].includes(user.role)) {
        return Response.redirect(`${url.origin}/login.html`, 302);
    }

    return next();
}
