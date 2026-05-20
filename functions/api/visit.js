/**
 * عداد الزوار الدقيق
 * يستخدم Cloudflare KV لحفظ الزوار الفريدين
 * يحسب زائر واحد لكل IP في اليوم (لتجنب التضخيم)
 */

export async function onRequest(context) {
    const { request, env } = context;

    // CORS headers
    const headers = {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Access-Control-Allow-Origin': '*'
    };

    try {
        const ip = request.headers.get('CF-Connecting-IP') ||
                   request.headers.get('X-Forwarded-For') ||
                   'unknown';
        const country = request.headers.get('CF-IPCountry') || 'unknown';
        const today = new Date().toISOString().split('T')[0];

        // hash للـ IP حفاظاً على الخصوصية
        const ipHash = await sha256(ip + '|' + today + '|safwa-salt');
        const visitorKey = 'v:' + ipHash;

        // التحقق إذا الزائر دخل اليوم
        const visitedToday = await env.VISITORS.get(visitorKey);

        // قراءة العداد الإجمالي
        let totalStr = await env.VISITORS.get('total_visitors');
        let total = parseInt(totalStr || '0');

        // قراءة عداد اليوم
        const todayKey = 'day:' + today;
        let todayStr = await env.VISITORS.get(todayKey);
        let todayCount = parseInt(todayStr || '0');

        if (!visitedToday) {
            // زائر جديد اليوم
            await env.VISITORS.put(visitorKey, '1', { expirationTtl: 86400 * 2 });
            total++;
            todayCount++;
            await env.VISITORS.put('total_visitors', total.toString());
            await env.VISITORS.put(todayKey, todayCount.toString(), { expirationTtl: 86400 * 7 });
        }

        return new Response(JSON.stringify({
            count: total,
            today: todayCount,
            isNew: !visitedToday,
            country: country
        }), { headers });

    } catch (e) {
        return new Response(JSON.stringify({
            count: 0,
            error: e.message
        }), { headers, status: 500 });
    }
}

async function sha256(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}
