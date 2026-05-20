import { jsonResponse } from '../../_lib/auth.js';

// Strip BOM and whitespace from secrets
function clean(s) {
    if (!s) return s;
    return String(s).replace(/^﻿/, '').trim();
}

export async function onRequestGet(context) {
    const { env } = context;
    const pub = clean(env.VAPID_PUBLIC_KEY);
    const priv = clean(env.VAPID_PRIVATE_KEY);
    return jsonResponse({
        publicKey: pub || null,
        enabled: !!(pub && priv)
    }, 200, { 'Cache-Control': 'public, max-age=60' });
}
