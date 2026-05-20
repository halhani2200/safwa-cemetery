import { jsonResponse, requireAuth, logAudit } from '../../_lib/auth.js';

const R2_PUBLIC_BASE = 'https://pub-58eb0c777b284713a3f5a6cb5afbfc40.r2.dev';
const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export async function onRequestPost(context) {
    const { request, env } = context;
    const authResult = await requireAuth(env, request, ['admin', 'staff']);
    if (!authResult.authorized) return authResult.response;

    try {
        const contentType = request.headers.get('Content-Type') || '';
        if (!contentType.includes('multipart/form-data')) {
            return jsonResponse({ error: 'يجب إرسال الصورة كـ multipart/form-data' }, 400);
        }

        const form = await request.formData();
        const file = form.get('photo');
        if (!file || typeof file === 'string') {
            return jsonResponse({ error: 'لم يتم إرسال صورة' }, 400);
        }

        if (!ALLOWED_TYPES.includes(file.type)) {
            return jsonResponse({ error: 'صيغة الصورة غير مدعومة (المسموح: JPEG, PNG, WebP)' }, 400);
        }

        if (file.size > MAX_BYTES) {
            return jsonResponse({ error: 'حجم الصورة يجب أن يكون أقل من 5 ميجابايت' }, 400);
        }

        const ext = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/png' ? 'png' : 'webp';
        const ts = Date.now();
        const rand = crypto.getRandomValues(new Uint8Array(6));
        const randHex = Array.from(rand).map(b => b.toString(16).padStart(2, '0')).join('');
        const key = `graves/${ts}-${randHex}.${ext}`;

        const buffer = await file.arrayBuffer();
        await env.PHOTOS.put(key, buffer, {
            httpMetadata: { contentType: file.type },
            customMetadata: { uploadedBy: String(authResult.user.id), uploadedAt: new Date().toISOString() }
        });

        const url = `${R2_PUBLIC_BASE}/${key}`;
        await logAudit(env, authResult.user.id, 'upload', 'photo', null, { key, size: file.size }, request);

        return jsonResponse({ ok: true, url, key });
    } catch (e) {
        return jsonResponse({ error: e.message }, 500);
    }
}

export async function onRequestDelete(context) {
    const { request, env } = context;
    const authResult = await requireAuth(env, request, ['admin', 'staff']);
    if (!authResult.authorized) return authResult.response;

    try {
        const body = await request.json();
        const url = body.url;
        if (!url || !url.startsWith(R2_PUBLIC_BASE + '/')) {
            return jsonResponse({ error: 'رابط غير صحيح' }, 400);
        }
        const key = url.substring(R2_PUBLIC_BASE.length + 1);
        await env.PHOTOS.delete(key);
        await logAudit(env, authResult.user.id, 'delete', 'photo', null, { key }, request);
        return jsonResponse({ ok: true });
    } catch (e) {
        return jsonResponse({ error: e.message }, 500);
    }
}
