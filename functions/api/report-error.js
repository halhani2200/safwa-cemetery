import { jsonResponse } from '../_lib/auth.js';

// Submit an error report (public, no auth needed)
export async function onRequestPost(context) {
    const { request, env } = context;
    try {
        const body = await request.json();
        const graveId = parseInt(body.grave_id);
        const description = (body.description || '').trim().substring(0, 1000);
        const reporterName = (body.reporter_name || '').trim().substring(0, 100);
        const reporterPhone = (body.reporter_phone || '').trim().substring(0, 30);

        if (!graveId || !description) {
            return jsonResponse({ error: 'بيانات ناقصة' }, 400);
        }

        await env.DB.prepare(`
            INSERT INTO error_reports (grave_id, description, reporter_name, reporter_phone)
            VALUES (?, ?, ?, ?)
        `).bind(graveId, description, reporterName || null, reporterPhone || null).run();

        return jsonResponse({ ok: true, message: 'تم استلام البلاغ، شكراً لكم' });
    } catch (e) {
        console.error(e); return jsonResponse({ error: 'حدث خطأ في الخادم' }, 500);
    }
}
