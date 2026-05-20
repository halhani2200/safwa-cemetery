-- Track last login timestamp for users
ALTER TABLE users ADD COLUMN last_login_at TEXT;
CREATE INDEX IF NOT EXISTS idx_audit_user_action ON audit_log(user_id, created_at);
