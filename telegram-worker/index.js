// Safwa death-announcement sync from the Al Qatif Today / Al Khat website.
// Runs every 10 minutes, stores new Safwa obituary names, then asks the main
// Pages API to send push notifications. Successfully delivered notifications
// are marked in D1; transient failures are retried on the next cron run.

const SOURCE = 'https://alqhat.com/';
const NOTIFY_ENDPOINT = 'https://safwa-cemetery.com/api/push/internal-announcement';

export default {
    async scheduled(event, env, ctx) {
        ctx.waitUntil(sync(env));
    },
    async fetch(request, env) {
        const out = await sync(env);
        return new Response(JSON.stringify(out, null, 2), {
            headers: { 'Content-Type': 'application/json; charset=utf-8' }
        });
    }
};

function decodeEntities(s) {
    return s.replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
}

function clean(html) {
    return decodeEntities(html.replace(/<[^>]+>/g, ' '))
        .replace(/\s+/g, ' ')
        .trim();
}

function extractSafwaObituaries(html) {
    const cardRe = /<a\b([^>]*cardNews[^>]*)>([\s\S]*?)<\/a>/g;
    const idRe = /\/home\/(\d+)\//;
    const titleRe = /<p[^>]*class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/p>/;
    const items = [];
    let scanned = 0;
    let m;

    while ((m = cardRe.exec(html))) {
        const attrs = m[1];
        const inner = m[2];
        const idM = idRe.exec(attrs);
        if (!idM) continue;
        scanned += 1;

        const titleMatch = titleRe.exec(inner);
        if (!titleMatch) continue;

        const text = clean(titleMatch[1]);
        const colon = text.indexOf(':');
        if (colon === -1) continue;

        const town = text.slice(0, colon).trim();
        if (!(town === 'صفوى' || town.startsWith('صفوى'))) continue;

        const deathIndex = text.indexOf('ذمة الله');
        if (deathIndex === -1 || deathIndex < colon) continue;

        const name = text.substring(colon + 1, deathIndex)
            .replace(/\s*في\s*$/, '')
            .replace(/\s+/g, ' ')
            .trim();

        if (!name || name.length < 3 || name.length > 120) continue;

        items.push({
            name,
            source_ref: `alqhat:${idM[1]}`
        });
    }

    return { scanned, items };
}

async function notifyNewAnnouncement(env, item) {
    const secret = String(env.PUSH_SYNC_SECRET || '').trim();
    if (!secret) {
        return { skipped: true, reason: 'PUSH_SYNC_SECRET not configured' };
    }

    try {
        const resp = await fetch(NOTIFY_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${secret}`
            },
            body: JSON.stringify({
                deceased_name: item.name,
                source_ref: item.source_ref
            })
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) {
            return { error: data.error || `http_${resp.status}` };
        }
        return data;
    } catch (e) {
        return { error: e.message };
    }
}

function notificationDelivered(result) {
    return Boolean(result && result.ok && Number(result.total_sent || 0) > 0);
}

async function sync(env) {
    let html;
    try {
        const r = await fetch(SOURCE, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SafwaCemetery/1.0)' },
            cf: { cacheTtl: 0 }
        });
        if (!r.ok) {
            const preview = (await r.text()).replace(/\s+/g, ' ').slice(0, 240);
            return {
                error: 'fetch_failed',
                status: r.status,
                source: SOURCE,
                final_url: r.url,
                content_type: r.headers.get('content-type') || '',
                preview
            };
        }
        html = await r.text();
    } catch (e) {
        return { error: 'fetch_error' };
    }

    const { scanned, items } = extractSafwaObituaries(html);
    let imported = 0;
    const notifications = [];

    for (const item of items) {
        try {
            const res = await env.DB.prepare(
                `INSERT OR IGNORE INTO announcements
                    (deceased_name, source, source_ref, is_active, notification_sent)
                 VALUES (?, 'alqhat', ?, 1, 0)`
            ).bind(item.name, item.source_ref).run();

            const changes = (res.meta && res.meta.changes) || 0;
            if (changes > 0) {
                imported += 1;
            }
        } catch (e) {
            return { error: 'db_error', scanned, candidates: items.length, imported };
        }
    }

    // Retry pending notifications after imports. This avoids losing an alert
    // when the Pages API or a push provider is temporarily unavailable.
    let pendingRows;
    try {
        pendingRows = await env.DB.prepare(
            `SELECT id, deceased_name, source_ref
             FROM announcements
             WHERE source = 'alqhat' AND notification_sent = 0
             ORDER BY id ASC
             LIMIT 20`
        ).all();
    } catch (e) {
        return { error: 'pending_query_error', scanned, candidates: items.length, imported };
    }

    for (const row of pendingRows.results || []) {
        const result = await notifyNewAnnouncement(env, {
            name: row.deceased_name,
            source_ref: row.source_ref
        });
        const delivered = notificationDelivered(result);

        if (delivered) {
            await env.DB.prepare(
                'UPDATE announcements SET notification_sent = 1 WHERE id = ?'
            ).bind(row.id).run();
        }

        notifications.push({
            source_ref: row.source_ref,
            delivered,
            ...result
        });
    }

    return {
        ok: true,
        scanned,
        candidates: items.length,
        imported,
        notifications
    };
}
