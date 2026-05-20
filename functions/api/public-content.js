import { jsonResponse } from '../_lib/auth.js';

// Public: read site content settings (banner, duaa, notice, etc.)
export async function onRequestGet(context) {
    const { env } = context;
    try {
        const keys = [
            'top_banner_items',
            'duaa_title', 'duaa_text', 'duaa_source',
            'notice_text', 'notice_type', 'notice_enabled',
            'footer_note',
            'site_name'
        ];
        const placeholders = keys.map(() => '?').join(',');
        const result = await env.DB.prepare(
            `SELECT key, value FROM settings WHERE key IN (${placeholders})`
        ).bind(...keys).all();

        const out = {};
        for (const row of result.results) {
            out[row.key] = row.value;
        }
        return jsonResponse(out, 200, {
            'Cache-Control': 'public, max-age=60'
        });
    } catch (e) {
        return jsonResponse({ error: e.message }, 500);
    }
}
