import { jsonResponse } from '../../_lib/auth.js';

export async function onRequestPost(context) {
    const { request, env } = context;
    try {
        const body = await request.json();
        const { endpoint } = body;
        if (!endpoint) return jsonResponse({ error: 'endpoint required' }, 400);
        await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(endpoint).run();
        return jsonResponse({ ok: true });
    } catch (e) {
        return jsonResponse({ error: e.message }, 500);
    }
}
