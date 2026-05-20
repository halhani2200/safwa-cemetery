import { jsonResponse, requireAuth, logAudit } from '../_lib/auth.js';

// Get all settings (admin only)
export async function onRequestGet(context) {
    const { request, env } = context;
    const authResult = await requireAuth(env, request, ['admin']);
    if (!authResult.authorized) return authResult.response;

    try {
        const result = await env.DB.prepare('SELECT key, value, updated_at FROM settings ORDER BY key').all();
        const settings = {};
        for (const row of result.results) {
            settings[row.key] = { value: row.value, updated_at: row.updated_at };
        }

        // Check if Claude API key is configured (via env variable / secret)
        settings.claude_api_configured = !!env.CLAUDE_API_KEY;
        // Check if Telegram is configured
        settings.telegram_configured = !!env.TELEGRAM_BOT_TOKEN;

        return jsonResponse(settings);
    } catch (e) {
        return jsonResponse({ error: e.message }, 500);
    }
}

// Update settings (admin only)
export async function onRequestPost(context) {
    const { request, env } = context;
    const authResult = await requireAuth(env, request, ['admin']);
    if (!authResult.authorized) return authResult.response;

    try {
        const body = await request.json();
        for (const [key, value] of Object.entries(body)) {
            await env.DB.prepare(`
                INSERT INTO settings (key, value, updated_at, updated_by)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by
            `).bind(key, String(value ?? ''), new Date().toISOString(), authResult.user.id).run();
        }
        await logAudit(env, authResult.user.id, 'update', 'settings', null, Object.keys(body), request);
        return jsonResponse({ ok: true });
    } catch (e) {
        return jsonResponse({ error: e.message }, 500);
    }
}
