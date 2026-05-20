// SEO-friendly HTML page for individual grave at /grave/[id]
// Returns full HTML with schema.org Person markup + Open Graph tags
// Allows Google to index each grave separately and show rich results

function escapeHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function formatDate(s) {
    if (!s) return '';
    const parts = String(s).trim().split(/[\/\-\\.]/);
    if (parts.length !== 3) return s;
    const [d, m, y] = parts.map(p => p.trim());
    if (!/^\d+$/.test(d) || !/^\d+$/.test(m) || !/^\d+$/.test(y)) return s;
    return `${d.padStart(2,'0')} / ${m.padStart(2,'0')} / ${y}`;
}

function notFound() {
    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>القبر غير موجود - مقبرة صفوى</title>
<meta name="robots" content="noindex">
<style>body{font-family:Tajawal,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#FAF6EE;color:#1F2937;text-align:center;padding:20px}h1{color:#0E4D3F}</style>
</head>
<body>
<div>
<h1>القبر غير موجود</h1>
<p>عذراً، لم نجد القبر المطلوب. <a href="/" style="color:#B8860B">العودة للبحث</a></p>
</div>
</body>
</html>`;
    return new Response(html, { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

export async function onRequestGet(context) {
    const { env, params, request } = context;
    const id = parseInt(params.id);
    if (!id || id < 1) return notFound();

    let grave;
    try {
        grave = await env.DB.prepare(`
            SELECT id, name, gender, death_day, death_date_hijri, death_date_gregorian,
                   section, row_number, grave_number, grave_reference,
                   latitude, longitude, photo_url, notes
            FROM graves WHERE id = ?
        `).bind(id).first();
    } catch (e) {
        return new Response('Database error', { status: 500 });
    }

    if (!grave) return notFound();

    const isFemale = grave.gender === 'انثى';
    const honorific = isFemale ? 'المرحومة' : 'المرحوم';
    const fullName = `${honorific} ${grave.name}`;
    const url = new URL(request.url);
    const canonical = `${url.origin}/grave/${grave.id}`;

    const description = [
        `${fullName}`,
        grave.death_date_gregorian ? `تاريخ الوفاة: ${formatDate(grave.death_date_gregorian)}` : null,
        grave.section ? `الموقع: المنطقة ${grave.section}، الصف ${grave.row_number || '-'}، القبر ${grave.grave_number || '-'}` : null,
        'مقبرة صفوى - دليل خدمي للبحث عن قبور المتوفين.'
    ].filter(Boolean).join(' • ');

    const ogImage = grave.photo_url || `${url.origin}/icon.svg`;
    const mapsUrl = (grave.latitude && grave.longitude)
        ? `https://www.google.com/maps/dir/?api=1&destination=${grave.latitude},${grave.longitude}`
        : null;

    // schema.org Person + Place
    const schema = {
        '@context': 'https://schema.org',
        '@type': 'Person',
        name: grave.name,
        gender: isFemale ? 'Female' : 'Male',
        deathDate: grave.death_date_gregorian ? formatGregorian(grave.death_date_gregorian) : undefined,
        deathPlace: {
            '@type': 'Place',
            name: `مقبرة صفوى - المنطقة ${grave.section || ''}`,
            address: {
                '@type': 'PostalAddress',
                addressLocality: 'صفوى',
                addressRegion: 'المنطقة الشرقية',
                addressCountry: 'SA'
            },
            geo: (grave.latitude && grave.longitude) ? {
                '@type': 'GeoCoordinates',
                latitude: grave.latitude,
                longitude: grave.longitude
            } : undefined
        },
        image: grave.photo_url || undefined,
        url: canonical
    };
    // Strip undefined fields
    const schemaJson = JSON.stringify(schema, (k, v) => v === undefined ? undefined : v, 2);

    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(fullName)} - مقبرة صفوى</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${canonical}">
<meta name="theme-color" content="#0E4D3F">
<link rel="icon" type="image/svg+xml" href="/icon.svg">
<link rel="apple-touch-icon" href="/icon.svg">
<link rel="manifest" href="/manifest.json">

<!-- Open Graph -->
<meta property="og:type" content="profile">
<meta property="og:title" content="${escapeHtml(fullName)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${escapeHtml(ogImage)}">
<meta property="og:site_name" content="مقبرة صفوى">
<meta property="og:locale" content="ar_SA">

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(fullName)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${escapeHtml(ogImage)}">

<!-- Schema.org JSON-LD -->
<script type="application/ld+json">
${schemaJson}
</script>

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;900&family=Amiri:wght@400;700&family=Reem+Kufi:wght@500;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--primary:#0E4D3F;--primary-dark:#08362C;--gold:#B8860B;--gold-light:#D4A93A;--cream:#FAF6EE;--cream-dark:#F0E9D8;--text-dark:#1F2937;--text-medium:#4B5563;--white:#FFFFFF}
body{font-family:'Tajawal',sans-serif;background:var(--cream);color:var(--text-dark);line-height:1.7;min-height:100vh}
.top-strip{background:linear-gradient(135deg,var(--primary),var(--primary-dark));color:white;padding:14px 20px;text-align:center}
.top-strip a{color:var(--gold-light);text-decoration:none;font-weight:700}
.container{max-width:1000px;margin:0 auto;padding:24px 20px}
.card{background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 18px rgba(0,0,0,0.08);margin-bottom:20px}
.hero{display:grid;grid-template-columns:300px 1fr;gap:0}
.photo-area{background:linear-gradient(135deg,var(--primary),var(--primary-dark));min-height:340px;display:flex;align-items:center;justify-content:center;position:relative}
.photo-area.female{background:linear-gradient(135deg,#7C3AED,#5B21B6)}
.photo-area img{max-width:100%;max-height:340px;width:100%;height:100%;object-fit:cover}
.photo-placeholder{font-size:5rem;color:rgba(255,255,255,0.65)}
.info{padding:30px}
.honor{color:var(--gold);font-family:'Amiri',serif;font-size:1.2rem;font-weight:700;margin-bottom:6px}
.name{font-family:'Reem Kufi',sans-serif;font-size:2rem;color:var(--primary);font-weight:700;margin-bottom:14px;line-height:1.3}
.badge{display:inline-block;background:var(--cream);color:var(--primary-dark);padding:5px 14px;border-radius:14px;font-size:0.85rem;font-weight:700;margin-bottom:18px}
.badge.female{background:#F3E8FF;color:#6B21A8}
.row{display:flex;gap:14px;align-items:flex-start;padding:11px 0;border-bottom:1px solid var(--cream-dark);font-size:0.95rem}
.row:last-child{border-bottom:none}
.label{color:var(--text-medium);font-weight:600;min-width:130px;font-size:0.88rem}
.value{color:var(--text-dark);font-weight:500;flex:1}
.actions{padding:22px 30px;background:var(--cream);display:flex;flex-wrap:wrap;gap:10px;justify-content:center}
.btn{background:var(--primary);color:white;border:none;padding:12px 24px;border-radius:10px;font-family:inherit;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:8px;text-decoration:none;font-size:0.95rem}
.btn:hover{background:var(--primary-dark)}
.btn-gold{background:var(--gold)}
.btn-gold:hover{background:#8B5A0A}
.btn-outline{background:transparent;color:var(--primary);border:2px solid var(--primary)}
.duaa{background:linear-gradient(135deg,#FFF8E1,#FFF3D6);padding:24px;border-radius:14px;text-align:center;margin-top:20px;border:2px solid var(--gold-light)}
.duaa-title{font-family:'Reem Kufi';color:var(--primary);font-weight:700;margin-bottom:10px;font-size:1.05rem}
.duaa-text{font-family:'Amiri',serif;font-size:1.2rem;color:var(--text-dark);line-height:1.9}
footer{text-align:center;padding:24px 20px;color:var(--text-medium);font-size:0.88rem}
@media (max-width:768px){.hero{grid-template-columns:1fr}.name{font-size:1.5rem}.info{padding:22px}.actions{padding:18px 20px}.label{min-width:auto}}
</style>
</head>
<body>

<div class="top-strip">
    🕌 مقبرة صفوى — <a href="/">العودة للبحث الرئيسي</a>
</div>

<div class="container">
    <article class="card">
        <div class="hero">
            <div class="photo-area ${isFemale ? 'female' : ''}">
                ${grave.photo_url
                    ? `<img src="${escapeHtml(grave.photo_url)}" alt="${escapeHtml(fullName)}" loading="lazy">`
                    : `<div class="photo-placeholder">👤</div>`}
            </div>
            <div class="info">
                <div class="honor">${honorific}</div>
                <h1 class="name">${escapeHtml(grave.name)}</h1>
                <div class="badge ${isFemale ? 'female' : ''}">${isFemale ? 'أنثى' : 'ذكر'}</div>

                ${grave.death_day ? `<div class="row"><span class="label">📅 يوم الوفاة</span><span class="value">${escapeHtml(grave.death_day)}</span></div>` : ''}
                ${grave.death_date_hijri ? `<div class="row"><span class="label">🌙 التاريخ الهجري</span><span class="value">${escapeHtml(formatDate(grave.death_date_hijri))} هـ</span></div>` : ''}
                ${grave.death_date_gregorian ? `<div class="row"><span class="label">☀️ التاريخ الميلادي</span><span class="value">${escapeHtml(formatDate(grave.death_date_gregorian))} م</span></div>` : ''}
                <div class="row">
                    <span class="label">📍 موقع القبر</span>
                    <span class="value">المنطقة ${escapeHtml(grave.section || '-')}${grave.row_number && grave.grave_number ? ` — الصف ${grave.row_number}، القبر ${grave.grave_number}` : ''}</span>
                </div>
                ${grave.latitude && grave.longitude ? `<div class="row"><span class="label">📌 الإحداثيات</span><span class="value" style="font-family:monospace;font-size:0.85rem">${grave.latitude}, ${grave.longitude}</span></div>` : ''}
            </div>
        </div>

        <div class="actions">
            ${mapsUrl ? `<a href="${mapsUrl}" target="_blank" rel="noopener" class="btn"><span>🧭</span><span>توجّه إلى القبر</span></a>` : ''}
            <a href="/?q=${encodeURIComponent(grave.name)}" class="btn btn-outline">🔍 بحث في الموقع</a>
            <a href="/map.html" class="btn btn-gold">🗺️ خريطة المقبرة</a>
        </div>
    </article>

    <div class="duaa">
        <div class="duaa-title">دعاء أهل القبور</div>
        <div class="duaa-text">السلامُ عليكم يا أهل الديار من المؤمنين والمسلمين، أنتم لنا فَرَط ونحن إن شاء الله بكم لاحقون.<br>اللهم اغفر لـ${isFemale ? 'ها' : 'ه'} وارحم${isFemale ? 'ها' : 'ه'} وأسكن${isFemale ? 'ها' : 'ه'} فسيح جناتك.</div>
    </div>
</div>

<footer>
    <p>© مقبرة صفوى — خدمة مجتمعية غير ربحية</p>
    <p><a href="/privacy.html" style="color:var(--gold)">سياسة الخصوصية</a></p>
</footer>

<script>
// Register service worker for PWA / offline support
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
}
</script>
</body>
</html>`;

    return new Response(html, {
        status: 200,
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'public, max-age=300, s-maxage=3600'
        }
    });
}

function formatGregorian(s) {
    // Try to convert d/m/yyyy to yyyy-mm-dd for schema.org
    if (!s) return undefined;
    const parts = String(s).trim().split(/[\/\-\\.]/);
    if (parts.length !== 3) return undefined;
    let [d, m, y] = parts.map(p => p.trim());
    if (!/^\d+$/.test(d) || !/^\d+$/.test(m) || !/^\d+$/.test(y)) return undefined;
    if (y.length === 2) y = '20' + y;
    return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
}
