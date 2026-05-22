import { jsonResponse } from '../_lib/auth.js';

// Public: list condolence venues (الحسينيات) for the report venue picker.
export async function onRequestGet(context) {
    const { env } = context;
    try {
        const r = await env.DB.prepare(
            `SELECT id, name, area, capacity, for_gender, incharge, phone
             FROM hosseiniyas WHERE is_active = 1 ORDER BY sort_order, id`
        ).all();
        return jsonResponse({ results: r.results || [] }, 200, { 'Cache-Control': 'public, max-age=300' });
    } catch (e) {
        return jsonResponse({ results: [], error: 'server_error' }, 200);
    }
}
