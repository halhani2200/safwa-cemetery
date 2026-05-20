// Dynamic sitemap generator — lists all graves so Google indexes each one
// Uses Cloudflare's edge cache for performance

export async function onRequestGet(context) {
    const { env, request } = context;
    const url = new URL(request.url);
    const origin = url.origin;

    let graves = [];
    try {
        const result = await env.DB.prepare(
            'SELECT id, updated_at, created_at FROM graves ORDER BY id'
        ).all();
        graves = result.results || [];
    } catch (e) {
        graves = [];
    }

    const today = new Date().toISOString().split('T')[0];

    const staticUrls = [
        { loc: `${origin}/`, priority: '1.0', changefreq: 'daily' },
        { loc: `${origin}/map.html`, priority: '0.8', changefreq: 'weekly' },
        { loc: `${origin}/privacy.html`, priority: '0.3', changefreq: 'yearly' }
    ];

    const graveUrls = graves.map(g => {
        const lastmod = (g.updated_at || g.created_at || '').split('T')[0] || today;
        return `  <url>
    <loc>${origin}/grave/${g.id}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`;
    }).join('\n');

    const staticXml = staticUrls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticXml}
${graveUrls}
</urlset>`;

    return new Response(xml, {
        status: 200,
        headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': 'public, max-age=3600, s-maxage=86400'
        }
    });
}
