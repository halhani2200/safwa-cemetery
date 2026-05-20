import { getUserFromSession } from './_lib/auth.js';

// Server-side guard for /admin/* and /staff/* HTML pages
// JS-only redirects can be bypassed by reading the HTML before scripts run.
export async function onRequest(context) {
    const { request, env, next } = context;
    const url = new URL(request.url);
    const path = url.pathname;

    // Don't gate API routes — each endpoint enforces its own auth and returns JSON 401.
    if (path.startsWith('/api/')) return next();

    const needsAdmin = path.startsWith('/admin/') || path === '/admin';
    const needsStaff = path.startsWith('/staff/') || path === '/staff';
    const needsMap = path === '/map.html' || path === '/map';

    if (!needsAdmin && !needsStaff && !needsMap) return next();

    const user = await getUserFromSession(env, request);
    if (!user) {
        return Response.redirect(`${url.origin}/login.html`, 302);
    }

    if (needsAdmin && user.role !== 'admin') {
        return Response.redirect(`${url.origin}/login.html`, 302);
    }

    if ((needsStaff || needsMap) && !['admin', 'staff', 'volunteer'].includes(user.role)) {
        return Response.redirect(`${url.origin}/login.html`, 302);
    }

    return next();
}
