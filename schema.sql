-- ============================================
-- Safwa Cemetery Database Schema
-- ============================================

-- جدول المستخدمين (المالك، الموظفون، المتطوعون)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    full_name TEXT,
    role TEXT NOT NULL CHECK(role IN ('admin', 'staff', 'volunteer')),
    is_active INTEGER NOT NULL DEFAULT 1,
    twofa_secret TEXT,
    twofa_enabled INTEGER NOT NULL DEFAULT 0,
    last_login_at TEXT,
    failed_login_count INTEGER NOT NULL DEFAULT 0,
    locked_until TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- جدول الجلسات
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip_address TEXT,
    user_agent TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- جدول القبور (الجدول الرئيسي)
CREATE TABLE IF NOT EXISTS graves (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    serial_number INTEGER,
    name TEXT NOT NULL,
    normalized_name TEXT,
    gender TEXT CHECK(gender IN ('ذكر', 'انثى')),
    age INTEGER,
    death_day TEXT,
    death_date_hijri TEXT,
    death_date_gregorian TEXT,
    section TEXT NOT NULL,
    row_number INTEGER,
    grave_number INTEGER,
    grave_reference TEXT,
    latitude REAL,
    longitude REAL,
    photo_url TEXT,
    notes TEXT,
    receiver_name TEXT,
    receiver_relationship TEXT,
    receiver_phone TEXT,
    report_number TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    updated_at TEXT,
    updated_by INTEGER,
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (updated_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_graves_name ON graves(normalized_name);
CREATE INDEX IF NOT EXISTS idx_graves_section ON graves(section);
CREATE INDEX IF NOT EXISTS idx_graves_reference ON graves(grave_reference);
CREATE INDEX IF NOT EXISTS idx_graves_year ON graves(death_date_gregorian);

-- جدول إعلانات الوفاة (من تلجرام أو يدوياً)
CREATE TABLE IF NOT EXISTS death_announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    kunya TEXT,
    death_date TEXT NOT NULL,
    grave_id INTEGER,
    source TEXT CHECK(source IN ('telegram', 'manual')),
    source_message_id TEXT,
    raw_message TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    FOREIGN KEY (grave_id) REFERENCES graves(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_announcements_active ON death_announcements(is_active);
CREATE INDEX IF NOT EXISTS idx_announcements_date ON death_announcements(death_date);

-- جدول سجل التتبع (Audit Log)
CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id INTEGER,
    details TEXT,
    ip_address TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_date ON audit_log(created_at);

-- جدول الإعدادات
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by INTEGER,
    FOREIGN KEY (updated_by) REFERENCES users(id)
);

-- البلاغات عن الأخطاء
CREATE TABLE IF NOT EXISTS error_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    grave_id INTEGER NOT NULL,
    reporter_name TEXT,
    reporter_phone TEXT,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'reviewed', 'resolved')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TEXT,
    reviewed_by INTEGER,
    FOREIGN KEY (grave_id) REFERENCES graves(id),
    FOREIGN KEY (reviewed_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_error_reports_status ON error_reports(status);
CREATE INDEX IF NOT EXISTS idx_error_reports_grave ON error_reports(grave_id);

-- Current public/admin death announcements table used by functions/api/announcements.js.
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

CREATE INDEX IF NOT EXISTS idx_announcements_active_current ON announcements(is_active, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_announcements_source_ref ON announcements(source_ref);

-- Web Push subscriptions.
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

-- Native app device tokens. Android stores FCM tokens; iOS stores APNs tokens.
CREATE TABLE IF NOT EXISTS fcm_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT NOT NULL UNIQUE,
    platform TEXT,
    app_version TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TEXT DEFAULT CURRENT_TIMESTAMP,
    failure_count INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_fcm_tokens_token ON fcm_tokens(token);
