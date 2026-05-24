// Safwa death-announcement sync from the "القطيف اليوم / صحيفة الخط" website.
// Runs on a cron (every 10 min). The site is server-rendered (no client-side JS data
// loading), so we fetch the homepage HTML and read the "وفيات" cards directly — no
// Telegram needed (owner chose the website as the source instead of Telegram).
//
// Each obituary card looks like:
//   <a class="cardNews ..." href="https://dreamcp.alqhat.com/home/518611/صفوى:-...">
//     <img ...>
//     <p class="title ...">صفوى: الشاب عادل علي حسين المغلق في ذمة الله</p>
//     <p class="newsDate">24 مايو , 2026 08:12 ص</p>
//   </a>
//
// Filter: town (before the colon) == "صفوى" AND the title contains "ذمة الله".
// We store ONLY the name, in our own wording (we never copy the site's article).
// Dedupe by the site's numeric article id  ->  source_ref = "alqhat:{id}".

const SOURCE = 'https://dreamcp.alqhat.com/';

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
    return decodeEntities(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
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

    // Match each <a ...cardNews...> ... </a>. Attribute order is not assumed:
    // the id comes from the /home/{id}/ href, the text from the inner <p class="title">.
    const cardRe = /<a\b([^>]*cardNews[^>]*)>([\s\S]*?)<\/a>/g;
    const idRe = /\/home\/(\d+)\//;
    const titleRe = /<p[^>]*class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/p>/;

    const stmts = [];
    let scanned = 0, candidates = 0, m;
    while ((m = cardRe.exec(html))) {
        const attrs = m[1], inner = m[2];
        const idM = idRe.exec(attrs);
        if (!idM) continue;
        scanned++;
        const id = idM[1];
        const tm = titleRe.exec(inner);
        if (!tm) continue;
        const text = clean(tm[1]);
        if (!text) continue;

        const colon = text.indexOf(':');
        if (colon === -1) continue;
        const town = text.slice(0, colon).trim();
        if (!(town === 'صفوى' || town.startsWith('صفوى'))) continue;   // Safwa only

        const death = text.indexOf('ذمة الله');
        if (death === -1 || death < colon) continue;                    // death announcement only

        let name = text.substring(colon + 1, death)
            .replace(/\s*في\s*$/, '')      // drop the trailing "في" of "في ذمة الله"
            .replace(/\s+/g, ' ').trim();
        if (!name || name.length < 3 || name.length > 120) continue;

        candidates++;
        const ref = 'alqhat:' + id;
        stmts.push(env.DB.prepare(
            `INSERT INTO announcements (deceased_name, source, source_ref, is_active)
             SELECT ?, 'alqhat', ?, 1
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
