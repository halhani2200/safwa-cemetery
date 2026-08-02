-- Death announcements table
CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    deceased_name TEXT NOT NULL,
    kunya TEXT,
    family TEXT,
    message TEXT,
    funeral_info TEXT,
    burial_info TEXT,
    condolence_men TEXT,
    condolence_women TEXT,
    grave_id INTEGER,
    source TEXT,
    source_ref TEXT,
    is_active INTEGER DEFAULT 1,
    expires_at TEXT,
    notification_sent INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    FOREIGN KEY (grave_id) REFERENCES graves(id)
);

CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(is_active, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_announcements_source_ref ON announcements(source_ref);

-- Web Push subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    last_used_at TEXT,
    failure_count INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_push_subs_endpoint ON push_subscriptions(endpoint);
