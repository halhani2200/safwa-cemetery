import { jsonResponse, requireAuth, logAudit, normalizeArabic, getUserFromSession } from '../_lib/auth.js';

// List all graves (admin sees everything, staff/volunteer see operational fields, public sees safe fields only)
export async function onRequestGet(context) {
    const { request, env } = context;
    const user = await getUserFromSession(env, request);

    try {
        if (user && user.role === 'admin') {
            // Admin gets everything including receiver info
            const result = await env.DB.prepare(`
                SELECT g.*, u1.username as created_by_user, u2.username as updated_by_user
                FROM graves g
                LEFT JOIN users u1 ON u1.id = g.created_by
                LEFT JOIN users u2 ON u2.id = g.updated_by
                ORDER BY g.id DESC
                LIMIT 500
            `).all();
            return jsonResponse({ count: result.results.length, results: result.results });
        }

        if (user && (user.role === 'staff' || user.role === 'volunteer')) {
            // Staff/volunteer get operational fields but NO receiver info
            const result = await env.DB.prepare(`
                SELECT g.id, g.serial_number, g.name, g.gender, g.age,
                       g.death_day, g.death_date_hijri, g.death_date_gregorian,
                       g.section, g.row_number, g.grave_number, g.grave_reference,
                       g.latitude, g.longitude, g.photo_url, g.notes,
                       g.created_at, g.updated_at, g.created_by, g.updated_by
                FROM graves g
                ORDER BY g.id DESC
                LIMIT 500
            `).all();
            return jsonResponse({ count: result.results.length, results: result.results });
        }

        // Public view - safe fields only (no age)
        const result = await env.DB.prepare(`
            SELECT id, name, gender, death_day, death_date_hijri, death_date_gregorian,
                   section, row_number, grave_number, grave_reference,
                   latitude, longitude, photo_url
            FROM graves
            ORDER BY id DESC
            LIMIT 500
        `).all();
        return jsonResponse({ count: result.results.length, results: result.results });
    } catch (e) {
        return jsonResponse({ error: e.message }, 500);
    }
}

// Add new grave (admin/staff/volunteer)
export async function onRequestPost(context) {
    const { request, env } = context;
    const authResult = await requireAuth(env, request, ['admin', 'staff', 'volunteer']);
    if (!authResult.authorized) return authResult.response;

    try {
        const body = await request.json();

        if (!body.name || !body.name.trim()) {
            return jsonResponse({ error: 'الاسم مطلوب' }, 400);
        }

        const name = body.name.trim();
        const normalized = normalizeArabic(name);

        // Calculate coordinates if section + row + grave_number provided
        let latitude = body.latitude || null;
        let longitude = body.longitude || null;
        const section = body.section || 'أ';
        const rowNum = body.row_number ? parseInt(body.row_number) : null;
        const graveNum = body.grave_number ? parseInt(body.grave_number) : null;

        if (!latitude && section === 'أ' && rowNum && graveNum) {
            const coords = calculateCoordsA(rowNum, graveNum);
            if (coords) {
                latitude = coords.lat;
                longitude = coords.lng;
            }
        }

        const graveRef = body.grave_reference || (rowNum && graveNum ? `${section}-${rowNum}-${graveNum}` : null);

        const isAdmin = authResult.user.role === 'admin';
        const canSetPhoto = isAdmin || authResult.user.role === 'staff';
        const result = await env.DB.prepare(`
            INSERT INTO graves (
                name, normalized_name, gender, age,
                death_day, death_date_hijri, death_date_gregorian,
                section, row_number, grave_number, grave_reference,
                latitude, longitude, notes, photo_url,
                receiver_name, receiver_relationship, receiver_phone,
                created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            name, normalized, body.gender || null, body.age || null,
            body.death_day || null, body.death_date_hijri || null, body.death_date_gregorian || null,
            section, rowNum, graveNum, graveRef,
            latitude, longitude, body.notes || null, canSetPhoto ? (body.photo_url || null) : null,
            isAdmin ? (body.receiver_name || null) : null,
            isAdmin ? (body.receiver_relationship || null) : null,
            isAdmin ? (body.receiver_phone || null) : null,
            authResult.user.id
        ).run();

        const newId = result.meta.last_row_id;
        await logAudit(env, authResult.user.id, 'create', 'grave', newId, { name }, request);

        return jsonResponse({ ok: true, id: newId }, 201);
    } catch (e) {
        return jsonResponse({ error: e.message }, 500);
    }
}

const SECTION_A_CORNERS = {
    nw: { lat: 26.649576, lng: 49.958884 },
    ne: { lat: 26.649639, lng: 49.959215 },
    sw: { lat: 26.649334, lng: 49.958942 },
    se: { lat: 26.649388, lng: 49.959267 }
};

function calculateCoordsA(row, grave) {
    if (row < 1 || row > 11 || grave < 1 || grave > 17) return null;
    const u = (grave - 1) / 16;
    const v = (row - 1) / 10;
    const { nw, ne, sw, se } = SECTION_A_CORNERS;
    return {
        lat: Math.round(((1 - u) * (1 - v) * nw.lat + u * (1 - v) * ne.lat + (1 - u) * v * sw.lat + u * v * se.lat) * 1000000) / 1000000,
        lng: Math.round(((1 - u) * (1 - v) * nw.lng + u * (1 - v) * ne.lng + (1 - u) * v * sw.lng + u * v * se.lng) * 1000000) / 1000000
    };
}
