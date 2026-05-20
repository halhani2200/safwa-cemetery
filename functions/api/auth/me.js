import { getUserFromSession, jsonResponse } from '../../_lib/auth.js';

export async function onRequestGet(context) {
    const { request, env } = context;
    const user = await getUserFromSession(env, request);
    if (!user) {
        return jsonResponse({ authenticated: false }, 401);
    }
    return jsonResponse({ authenticated: true, user });
}
