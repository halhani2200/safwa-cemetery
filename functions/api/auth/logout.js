import { deleteSession, clearSessionCookieHeader, jsonResponse } from '../../_lib/auth.js';

export async function onRequestPost(context) {
    const { request, env } = context;
    await deleteSession(env, request);
    return jsonResponse(
        { ok: true },
        200,
        { 'Set-Cookie': clearSessionCookieHeader() }
    );
}
