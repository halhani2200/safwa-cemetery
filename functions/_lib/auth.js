// Shared authentication library

const PBKDF2_ITERATIONS = 100000;
const SESSION_DURATION_DAYS = 30;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

// ----- Hashing -----
export async function hashPassword(password, salt) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
        {
            name: 'PBKDF2',
            salt: hexToBytes(salt),
            iterations: PBKDF2_ITERATIONS,
            hash: 'SHA-256'
        },
        keyMaterial,
        256
    );
    return bytesToHex(new Uint8Array(bits));
}

export async function verifyPassword(password, hash, salt) {
    const computed = await hashPassword(password, salt);
    return constantTimeEqual(computed, hash);
}

export async function generateSalt() {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return bytesToHex(bytes);
}

export async function generateSessionId() {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    return bytesToHex(bytes);
}

function bytesToHex(bytes) {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
}

function constantTimeEqual(a, b) {
    if (a.length !== b.length) return false;
    let result = 0;
    for (let i = 0; i < a.length; i++) {
        result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
}

// ----- Sessions -----
export async function createSession(env, userId, request) {
    const sessionId = await generateSessionId();
    const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 86400 * 1000).toISOString();
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const ua = request.headers.get('User-Agent') || 'unknown';

    await env.DB.prepare(
        'INSERT INTO sessions (id, user_id, expires_at, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)'
    ).bind(sessionId, userId, expiresAt, ip, ua.substring(0, 500)).run();

    return sessionId;
}

export async function getUserFromSession(env, request) {
    const cookie = request.headers.get('Cookie') || '';
    const match = cookie.match(/session=([a-f0-9]+)/);
    if (!match) return null;

    const sessionId = match[1];
    const result = await env.DB.prepare(`
        SELECT users.id, users.username, users.full_name, users.role, users.is_active,
               sessions.expires_at
        FROM sessions
        JOIN users ON users.id = sessions.user_id
        WHERE sessions.id = ?
    `).bind(sessionId).first();

    if (!result) return null;
    if (new Date(result.expires_at) < new Date()) {
        await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
        return null;
    }
    if (!result.is_active) return null;

    return {
        id: result.id,
        username: result.username,
        full_name: result.full_name,
        role: result.role
    };
}

export async function deleteSession(env, request) {
    const cookie = request.headers.get('Cookie') || '';
    const match = cookie.match(/session=([a-f0-9]+)/);
    if (!match) return;
    await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(match[1]).run();
}

export function sessionCookieHeader(sessionId) {
    const maxAge = SESSION_DURATION_DAYS * 86400;
    return `session=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

export function clearSessionCookieHeader() {
    return 'session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0';
}

// ----- Auth middleware -----
export async function requireAuth(env, request, allowedRoles = null) {
    // CSRF defense: for state-changing requests, require Origin to match Host.
    // SameSite=Strict cookies provide primary protection; this is defense-in-depth.
    if (request.method !== 'GET' && request.method !== 'HEAD') {
        const origin = request.headers.get('Origin');
        if (origin) {
            try {
                const originHost = new URL(origin).host;
                const requestHost = new URL(request.url).host;
                if (originHost !== requestHost) {
                    return { authorized: false, response: jsonResponse({ error: 'origin mismatch' }, 403) };
                }
            } catch (e) {
                return { authorized: false, response: jsonResponse({ error: 'invalid origin' }, 403) };
            }
        }
    }

    const user = await getUserFromSession(env, request);
    if (!user) {
        return { authorized: false, response: jsonResponse({ error: 'unauthorized' }, 401) };
    }
    if (allowedRoles && !allowedRoles.includes(user.role)) {
        return { authorized: false, response: jsonResponse({ error: 'forbidden' }, 403) };
    }
    return { authorized: true, user };
}

// ----- Rate limiting -----
export async function checkAndIncrementFailedLogin(env, username) {
    const user = await env.DB.prepare(
        'SELECT id, failed_login_count, locked_until FROM users WHERE username = ?'
    ).bind(username).first();
    if (!user) return { locked: false };

    if (user.locked_until && new Date(user.locked_until) > new Date()) {
        return { locked: true, until: user.locked_until };
    }

    const newCount = (user.failed_login_count || 0) + 1;
    let lockedUntil = null;
    if (newCount >= MAX_FAILED_ATTEMPTS) {
        lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString();
    }
    await env.DB.prepare(
        'UPDATE users SET failed_login_count = ?, locked_until = ? WHERE id = ?'
    ).bind(newCount, lockedUntil, user.id).run();

    return { locked: !!lockedUntil, until: lockedUntil };
}

export async function resetFailedLogin(env, userId) {
    await env.DB.prepare(
        'UPDATE users SET failed_login_count = 0, locked_until = NULL, last_login_at = ? WHERE id = ?'
    ).bind(new Date().toISOString(), userId).run();
}

// ----- Audit log -----
export async function logAudit(env, userId, action, entityType, entityId, details, request) {
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    await env.DB.prepare(
        'INSERT INTO audit_log (user_id, action, entity_type, entity_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(userId, action, entityType, entityId, details ? JSON.stringify(details) : null, ip).run();
}

// ----- Response helpers -----
export function jsonResponse(data, status = 200, extraHeaders = {}) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            ...extraHeaders
        }
    });
}

// ----- Arabic normalization (matches Python import logic) -----
export function normalizeArabic(text) {
    if (!text) return '';
    let s = String(text).toLowerCase();
    // Diacritics: tashkeel + tatweel + dagger alif + waslah
    s = s.replace(/[ً-ْٰٱـ]/g, '');
    // Normalize alif variants
    s = s.replace(/[إأآا]/g, 'ا');
    // Yaa / Alif maksura
    s = s.replace(/ى/g, 'ي');
    // Taa marbuta
    s = s.replace(/ة/g, 'ه');
    // Hamza on waw/yaa
    s = s.replace(/ؤ/g, 'و');
    s = s.replace(/ئ/g, 'ي');
    // Remove "آل" prefix (at start or after whitespace)
    s = s.replace(/(^|\s)آل\s*/g, '$1');
    // Remove "ال" prefix (at start or after whitespace)
    s = s.replace(/(^|\s)ال/g, '$1');
    // Collapse multiple spaces
    s = s.replace(/\s+/g, ' ');
    return s.trim();
}
