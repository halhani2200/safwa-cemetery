// Safwa death-announcement sync from the Al Qatif Today / Al Khat website.
// Runs every 10 minutes, stores new Safwa obituary names, then asks the main
// Pages API to send push notifications. Notifications are sent only for newly
// inserted rows, so repeated cron runs do not duplicate alerts.

const SOURCE = 'https://dreamcp.alqhat.com/';
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

async function sync(env) {
    let html;
    try {
        const r = await fetch(SOURCE, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SafwaCemetery/1.0)' },
            cf: { cacheTtl: 0 }
        });
        if (!r.ok) return { error: 'fetch_failed', status: r.status };
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
                `INSERT INTO announcements (deceased_name, source, source_ref, is_active)
                 SELECT ?, 'alqhat', ?, 1
                 WHERE NOT EXISTS (SELECT 1 FROM announcements WHERE source_ref = ?)`
            ).bind(item.name, item.source_ref, item.source_ref).run();

            const changes = (res.meta && res.meta.changes) || 0;
            if (changes > 0) {
                imported += 1;
                notifications.push({
                    source_ref: item.source_ref,
                    ...(await notifyNewAnnouncement(env, item))
                });
            }
        } catch (e) {
            return { error: 'db_error', scanned, candidates: items.length, imported };
        }
    }

    return {
        ok: true,
        scanned,
        candidates: items.length,
        imported,
        notifications
    };
}
