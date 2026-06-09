-- FCM (native push) device tokens — registered when a user opts in to notifications
-- in the native app via the "تفعيل الإشعارات" button (native-bridge.js → /api/push/subscribe-fcm).
-- Anonymous: stores only the Firebase token + platform + app version. No identity, no PII.
CREATE TABLE IF NOT EXISTS fcm_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT NOT NULL UNIQUE,
    platform TEXT,                       -- 'android' | 'ios'
    app_version TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TEXT DEFAULT CURRENT_TIMESTAMP,
    failure_count INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_fcm_tokens_token ON fcm_tokens(token);
