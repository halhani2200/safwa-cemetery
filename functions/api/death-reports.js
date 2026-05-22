import { jsonResponse, requireAuth } from '../_lib/auth.js';

function genToken() {
    const a = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(a).map(b => b.toString(16).padStart(2, '0')).join('');
}
function normGender(g) {
    if (g === 'm' || g === 'ذكر') return 'ذكر';
    if (g === 'f' || g === 'انثى') return 'انثى';
    return null;
}

// PUBLIC: family submits a death report. Returns id + ref + edit_token (for upload/tracking, no login).
export async function onRequestPost(context) {
    const { request, env } = context;
    try {
        const b = await request.json();
        const reporterName = (b.reporter_name || '').toString().trim();
        const reporterPhone = (b.reporter_phone || '').toString().trim();
        const deceasedName = (b.deceased_name || '').toString().trim();
        if (!reporterName || !reporterPhone || !deceasedName) {
            return jsonResponse({ error: 'الاسم ورقم الجوال واسم المتوفّى حقول مطلوبة' }, 400);
        }
        const token = genToken();
        const res = await env.DB.prepare(
            `INSERT INTO death_reports
              (reporter_name, reporter_relation, reporter_phone, reporter_nid,
               deceased_name, deceased_gender, deceased_age, deceased_nid,
               aza_men, aza_women, status, edit_token)
             VALUES (?,?,?,?,?,?,?,?,?,?, 'received', ?)`
        ).bind(
            reporterName, b.reporter_relation ?? null, reporterPhone, b.reporter_nid ?? null,
            deceasedName, normGender(b.deceased_gender), b.deceased_age ?? null, b.deceased_nid ?? null,
            b.aza_men ?? null, b.aza_women ?? null, token
        ).run();
        const id = res.meta.last_row_id;
        const ref = `R-${new Date().getFullYear()}-${String(id).padStart(3, '0')}`;
        await env.DB.prepare(`UPDATE death_reports SET ref = ? WHERE id = ?`).bind(ref, id).run();
        return jsonResponse({ ok: true, id, ref, edit_token: token });
    } catch (e) {
        return jsonResponse({ error: 'server_error' }, 500);
    }
}

// STAFF: list reports (no national IDs in the list view).
export async function onRequestGet(context) {
    const { request, env } = context;
    const auth = await requireAuth(env, request, ['admin', 'staff']);
    if (!auth.authorized) return auth.response;
    try {
        const r = await env.DB.prepare(
            `SELECT id, ref, reporter_name, reporter_phone, deceased_name, deceased_gender,
                    status, created_at FROM death_reports ORDER BY id DESC LIMIT 200`
        ).all();
        return jsonResponse({ results: r.results || [] });
    } catch (e) {
        return jsonResponse({ error: 'server_error' }, 500);
    }
}
