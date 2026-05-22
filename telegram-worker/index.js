// Safwa death-announcement sync from the public "القطيف اليوم" Telegram preview.
// Runs on a cron (every 20 min). No bot/API token needed — reads the t.me/s/ web preview.
// Filters: message starts with "صفوى" + contains "ذمة الله". Extracts ONLY the name and
// stores it in our own wording (we never copy the channel's text). Dedupes by post id.

const CHANNEL = 'ALQHAT0558511232';
const PREVIEW = `https://t.me/s/${CHANNEL}`;

export default {
    async scheduled(event, env, ctx) {
        ctx.waitUntil(sync(env));
    },
    // Manual trigger for testing/QA (idempotent — dedupe prevents duplicates).
    async fetch(request, env) {
        const out = await sync(env);
        return new Response(JSON.stringify(out, null, 2), {
            headers: { 'Content-Type': 'application/json; charset=utf-8' }
        });
    }
};

function decodeEntities(s) {
    return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
}
function clean(html) {
    return decodeEntities(html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')).trim();
}

async function sync(env) {
    let html;
    try {
        const r = await fetch(PREVIEW, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SafwaCemetery/1.0)' } });
        if (!r.ok) return { error: 'fetch_failed', status: r.status };
        html = await r.text();
    } catch (e) {
        return { error: 'fetch_error' };
    }

    const re = /data-post="([^"]+)"[\s\S]*?<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/g;
    const stmts = [];
    let scanned = 0, candidates = 0, m;
    while ((m = re.exec(html))) {
        scanned++;
        const postId = m[1];
        const text = clean(m[2]);
        if (!text) continue;
        if (text.slice(0, 15).indexOf('صفوى') === -1) continue;       // Safwa only
        const death = text.indexOf('ذمة الله');
        if (death === -1) continue;                                    // death announcement only
        const colon = text.indexOf(':');
        if (colon === -1 || death < colon) continue;
        let name = text.substring(colon + 1, death).replace(/\s*في\s*$/, '').replace(/\s+/g, ' ').trim();
        if (!name || name.length < 3 || name.length > 120) continue;
        candidates++;
        const ref = 'tg:' + postId;
        stmts.push(env.DB.prepare(
            `INSERT INTO announcements (deceased_name, source, source_ref, is_active)
             SELECT ?, 'telegram', ?, 1
             WHERE NOT EXISTS (SELECT 1 FROM announcements WHERE source_ref = ?)`
        ).bind(name, ref, ref));
    }

    let imported = 0;
    if (stmts.length) {
        try {
            const res = await env.DB.batch(stmts);
            imported = res.reduce((a, r) => a + ((r.meta && r.meta.changes) || 0), 0);
        } catch (e) {
            return { error: 'db_error', scanned, candidates };
        }
    }
    return { ok: true, scanned, candidates, imported };
}
