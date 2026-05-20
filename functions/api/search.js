import { jsonResponse, normalizeArabic } from '../_lib/auth.js';

export async function onRequestGet(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const query = (url.searchParams.get('q') || '').trim();

    try {
        let results;

        if (!query) {
            results = await env.DB.prepare(`
                SELECT id, name, gender, death_day, death_date_hijri, death_date_gregorian,
                       section, row_number, grave_number, grave_reference,
                       latitude, longitude, photo_url
                FROM graves
                ORDER BY id DESC
                LIMIT 200
            `).all();
        } else {
            const normalized = normalizeArabic(query);
            const words = normalized.split(/\s+/).filter(w => w.length > 0);

            if (words.length === 0) {
                results = { results: [] };
            } else {
                // Build LIKE clauses - each word must appear in normalized_name
                const whereClauses = words.map(() => 'normalized_name LIKE ?').join(' AND ');
                const params = words.map(w => `%${w}%`);

                results = await env.DB.prepare(`
                    SELECT id, name, gender, death_day, death_date_hijri, death_date_gregorian,
                           section, row_number, grave_number, grave_reference,
                           latitude, longitude, photo_url
                    FROM graves
                    WHERE ${whereClauses}
                    ORDER BY name
                    LIMIT 100
                `).bind(...params).all();
            }
        }

        return jsonResponse({
            count: results.results.length,
            results: results.results
        });
    } catch (e) {
        return jsonResponse({ error: e.message }, 500);
    }
}
