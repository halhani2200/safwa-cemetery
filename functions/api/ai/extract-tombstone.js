import { jsonResponse, requireAuth } from '../../_lib/auth.js';

// AI-powered tombstone reading using Claude Vision
// Requires CLAUDE_API_KEY secret to be set
export async function onRequestPost(context) {
    const { request, env } = context;
    const authResult = await requireAuth(env, request);
    if (!authResult.authorized) return authResult.response;

    if (!env.CLAUDE_API_KEY) {
        return jsonResponse({
            error: 'Claude API غير مُعدّ. أضف المفتاح من لوحة الإعدادات.'
        }, 503);
    }

    try {
        const body = await request.json();
        const imageData = body.image;
        if (!imageData) return jsonResponse({ error: 'لا توجد صورة' }, 400);

        // Extract base64 from data URL
        const match = imageData.match(/^data:(image\/[^;]+);base64,(.+)$/);
        if (!match) return jsonResponse({ error: 'صيغة الصورة غير صحيحة' }, 400);
        const mediaType = match[1];
        const base64 = match[2];

        const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': env.CLAUDE_API_KEY,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-haiku-4-5-20251001',
                max_tokens: 1024,
                messages: [{
                    role: 'user',
                    content: [
                        {
                            type: 'image',
                            source: { type: 'base64', media_type: mediaType, data: base64 }
                        },
                        {
                            type: 'text',
                            text: `هذي صورة شاهد قبر من مقبرة شيعية في صفوى، السعودية. استخرج البيانات التالية:

1. الاسم الكامل للمتوفى (بدون كلمات مثل "المرحوم" أو "الحاج")
2. الجنس (ذكر أو انثى) - استنتجها من الاسم أو الصورة
3. العمر (إذا كان مذكوراً)
4. يوم الوفاة (السبت، الأحد، الاثنين، إلخ)
5. التاريخ الميلادي بصيغة d/m/yyyy
6. التاريخ الهجري بصيغة d/m/yyyy

أرجع النتيجة JSON فقط بدون أي شرح، بهذا الشكل:
{"name":"...","gender":"ذكر|انثى","age":number_or_null,"death_day":"...","death_date_gregorian":"...","death_date_hijri":"..."}

إذا حقل غير واضح، اجعل قيمته null.`
                        }
                    ]
                }]
            })
        });

        if (!claudeResponse.ok) {
            const errText = await claudeResponse.text();
            return jsonResponse({ error: 'فشل الذكاء الاصطناعي: ' + errText.substring(0, 200) }, 500);
        }

        const data = await claudeResponse.json();
        const text = data.content?.[0]?.text || '';

        // Extract JSON from response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            return jsonResponse({ error: 'لم يستطع AI استخراج البيانات', raw: text }, 422);
        }

        const extracted = JSON.parse(jsonMatch[0]);
        return jsonResponse({ ok: true, extracted });

    } catch (e) {
        console.error(e); return jsonResponse({ error: 'حدث خطأ في الخادم' }, 500);
    }
}
