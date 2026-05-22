import { jsonResponse, requireAuth, logAudit, normalizeArabic } from '../../_lib/auth.js';

// Get a single grave - field visibility depends on role
export async function onRequestGet(context) {
    const { request, env, params } = context;
    const id = parseInt(params.id);
    if (!id) return jsonResponse({ error: 'invalid id' }, 400);

    const auth = await import('../../_lib/auth.js');
    const user = await auth.getUserFromSession(env, request);

    let query;
    if (user && user.role === 'admin') {
        // Admin sees everything including receiver info
        query = await env.DB.prepare(`SELECT * FROM graves WHERE id = ?`).bind(id).first();
    } else if (user && (user.role === 'staff' || user.role === 'volunteer')) {
        // Staff/volunteer: operational fields but NO receiver info
        query = await env.DB.prepare(`
            SELECT id, serial_number, name, gender, age,
                   death_day, death_date_hijri, death_date_gregorian,
                   section, row_number, grave_number, grave_reference,
                   latitude, longitude, photo_url, notes,
                   created_at, updated_at, created_by, updated_by
            FROM graves WHERE id = ?
        `).bind(id).first();
    } else {
        // Public: only safe display fields (no age)
        query = await env.DB.prepare(`
            SELECT id, name, gender, death_day, death_date_hijri, death_date_gregorian,
                   section, row_number, grave_number, grave_reference,
                   latitude, longitude, photo_url
            FROM graves WHERE id = ?
        `).bind(id).first();
    }

    if (!query) return jsonResponse({ error: 'not found' }, 404);
    return jsonResponse(query);
}

// Update grave (admin updates everything; staff/volunteer cannot touch receiver fields)
export async function onRequestPut(context) {
    const { request, env, params } = context;
    const authResult = await requireAuth(env, request, ['admin', 'staff', 'volunteer']);
    if (!authResult.authorized) return authResult.response;

    const id = parseInt(params.id);
    if (!id) return jsonResponse({ error: 'invalid id' }, 400);

    try {
        // Volunteers may only edit graves they created themselves
        if (authResult.user.role === 'volunteer') {
            const owned = await env.DB.prepare('SELECT created_by FROM graves WHERE id = ?').bind(id).first();
            if (!owned) return jsonResponse({ error: 'not found' }, 404);
            if (owned.created_by !== authResult.user.id) {
                return jsonResponse({ error: 'لا تملك صلاحية تعديل هذا القبر' }, 403);
            }
        }
        const body = await request.json();
        const normalized = normalizeArabic(body.name || '');
        const isAdmin = authResult.user.role === 'admin';

        const isStaff = authResult.user.role === 'staff';
        const canEditPhoto = isAdmin || isStaff;

        if (isAdmin) {
            await env.DB.prepare(`
                UPDATE graves SET
                    name = ?, normalized_name = ?, gender = ?, age = ?,
                    death_day = ?, death_date_hijri = ?, death_date_gregorian = ?,
                    section = ?, row_number = ?, grave_number = ?, grave_reference = ?,
                    latitude = ?, longitude = ?, notes = ?, photo_url = ?,
                    receiver_name = ?, receiver_relationship = ?, receiver_phone = ?,
                    updated_at = ?, updated_by = ?
                WHERE id = ?
            `).bind(
                body.name ?? null, normalized, body.gender ?? null, body.age ?? null,
                body.death_day ?? null, body.death_date_hijri ?? null, body.death_date_gregorian ?? null,
                body.section ?? null, body.row_number ?? null, body.grave_number ?? null, body.grave_reference ?? null,
                body.latitude ?? null, body.longitude ?? null, body.notes ?? null, body.photo_url ?? null,
                body.receiver_name ?? null, body.receiver_relationship ?? null, body.receiver_phone ?? null,
                new Date().toISOString(), authResult.user.id, id
            ).run();
        } else if (canEditPhoto) {
            // Staff: cannot modify receiver fields but CAN edit photo
            await env.DB.prepare(`
                UPDATE graves SET
                    name = ?, normalized_name = ?, gender = ?, age = ?,
                    death_day = ?, death_date_hijri = ?, death_date_gregorian = ?,
                    section = ?, row_number = ?, grave_number = ?, grave_reference = ?,
                    latitude = ?, longitude = ?, notes = ?, photo_url = ?,
                    updated_at = ?, updated_by = ?
                WHERE id = ?
            `).bind(
                body.name ?? null, normalized, body.gender ?? null, body.age ?? null,
                body.death_day ?? null, body.death_date_hijri ?? null, body.death_date_gregorian ?? null,
                body.section ?? null, body.row_number ?? null, body.grave_number ?? null, body.grave_reference ?? null,
                body.latitude ?? null, body.longitude ?? null, body.notes ?? null, body.photo_url ?? null,
                new Date().toISOString(), authResult.user.id, id
            ).run();
        } else {
            // Volunteer: cannot modify receiver fields or photo_url
            await env.DB.prepare(`
                UPDATE graves SET
                    name = ?, normalized_name = ?, gender = ?, age = ?,
                    death_day = ?, death_date_hijri = ?, death_date_gregorian = ?,
                    section = ?, row_number = ?, grave_number = ?, grave_reference = ?,
                    latitude = ?, longitude = ?, notes = ?,
                    updated_at = ?, updated_by = ?
                WHERE id = ?
            `).bind(
                body.name ?? null, normalized, body.gender ?? null, body.age ?? null,
                body.death_day ?? null, body.death_date_hijri ?? null, body.death_date_gregorian ?? null,
                body.section ?? null, body.row_number ?? null, body.grave_number ?? null, body.grave_reference ?? null,
                body.latitude ?? null, body.longitude ?? null, body.notes ?? null,
                new Date().toISOString(), authResult.user.id, id
            ).run();
        }

        await logAudit(env, authResult.user.id, 'update', 'grave', id, { name: body.name }, request);

        return jsonResponse({ ok: true });
    } catch (e) {
        console.error(e); return jsonResponse({ error: 'حدث خطأ في الخادم' }, 500);
    }
}

// Delete grave (admin + staff only, NOT volunteers)
export async function onRequestDelete(context) {
    const { request, env, params } = context;
    const authResult = await requireAuth(env, request, ['admin', 'staff']);
    if (!authResult.authorized) return authResult.response;

    const id = parseInt(params.id);
    if (!id) return jsonResponse({ error: 'invalid id' }, 400);

    try {
        await env.DB.prepare('DELETE FROM graves WHERE id = ?').bind(id).run();
        await logAudit(env, authResult.user.id, 'delete', 'grave', id, null, request);
        return jsonResponse({ ok: true });
    } catch (e) {
        console.error(e); return jsonResponse({ error: 'حدث خطأ في الخادم' }, 500);
    }
}
