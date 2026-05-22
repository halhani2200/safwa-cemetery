import { jsonResponse } from '../_lib/auth.js';

// Public: "في مثل هذا اليوم" — graves whose HIJRI death day+month match today (Umm al-Qura).
// Returns only public-safe fields (no notes / receiver info).
const HIJRI_MONTHS = ['محرّم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة',
    'رجب', 'شعبان', 'رمضان', 'شوّال', 'ذو القعدة', 'ذو الحجة'];

function parseHijri(s) {
    const p = String(s).trim().split(/[\/\-\\.]/).map(x => parseInt(String(x).trim(), 10));
    if (p.length < 3 || !p[0] || !p[1] || !p[2]) return null;
    let y = p[2];
    if (y > 9999) y = parseInt(String(y).slice(0, 4), 10); // tolerate typos like 14444
    if (p[0] < 1 || p[0] > 30 || p[1] < 1 || p[1] > 12) return null;
    return { d: p[0], m: p[1], y };
}

export async function onRequestGet(context) {
    const { env, request } = context;
    try {
        // Today's Hijri date (Umm al-Qura, Saudi official)
        let hd, hm, hy;
        try {
            const parts = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura',
                { day: 'numeric', month: 'numeric', year: 'numeric' }).formatToParts(new Date());
            for (const p of parts) {
                if (p.type === 'day') hd = parseInt(p.value, 10);
                else if (p.type === 'month') hm = parseInt(p.value, 10);
                else if (p.type === 'year') hy = parseInt(p.value, 10);
            }
        } catch (e) { /* Intl islamic calendar unavailable */ }

        // Optional override (QA / browsing a specific day): ?day=DD&month=MM
        const u = new URL(request.url);
        const qd = parseInt(u.searchParams.get('day'), 10);
        const qm = parseInt(u.searchParams.get('month'), 10);
        if (qd >= 1 && qd <= 30 && qm >= 1 && qm <= 12) { hd = qd; hm = qm; }

        if (!hd || !hm) return jsonResponse({ today: null, count: 0, results: [] });

        const rows = await env.DB.prepare(
            `SELECT id, name, gender, death_date_hijri, death_date_gregorian,
                    section, row_number, grave_number, photo_url
             FROM graves
             WHERE death_date_hijri IS NOT NULL AND death_date_hijri != ''`
        ).all();

        const matches = [];
        for (const g of (rows.results || [])) {
            const dh = parseHijri(g.death_date_hijri);
            if (!dh) continue;
            if (dh.d === hd && dh.m === hm) {
                matches.push({
                    id: g.id, name: g.name, gender: g.gender,
                    death_date_hijri: g.death_date_hijri,
                    death_date_gregorian: g.death_date_gregorian,
                    section: g.section, row_number: g.row_number, grave_number: g.grave_number,
                    photo_url: g.photo_url,
                    years_ago: (dh.y && hy && hy >= dh.y) ? (hy - dh.y) : null
                });
            }
        }
        matches.sort((a, b) => (b.years_ago || 0) - (a.years_ago || 0));

        return jsonResponse({
            today: { day: hd, month: hm, year: hy, label: `${hd} ${HIJRI_MONTHS[hm - 1] || ''} ${hy}هـ` },
            count: matches.length,
            results: matches
        }, 200, { 'Cache-Control': 'public, max-age=3600' });
    } catch (e) {
        return jsonResponse({ today: null, count: 0, results: [], error: 'server_error' }, 200);
    }
}
