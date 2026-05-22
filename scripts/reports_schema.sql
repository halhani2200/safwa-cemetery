-- Death reports (إبلاغ الوفاة) + private documents + condolence venues (الحسينيات)
-- Documents themselves live in the PRIVATE R2 bucket (DOCS); only keys are stored here.

CREATE TABLE IF NOT EXISTS death_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ref TEXT,
  reporter_name TEXT NOT NULL,
  reporter_relation TEXT,
  reporter_phone TEXT NOT NULL,
  reporter_nid TEXT,
  deceased_name TEXT NOT NULL,
  deceased_gender TEXT,
  deceased_age INTEGER,
  deceased_nid TEXT,
  aza_men INTEGER,
  aza_women INTEGER,
  status TEXT NOT NULL DEFAULT 'received',   -- received / staff_review / confirmed / published / rejected
  edit_token TEXT,                            -- per-report token (family upload + tracking, no login)
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT,
  reviewed_by INTEGER
);
CREATE INDEX IF NOT EXISTS idx_reports_phone ON death_reports(reporter_phone);
CREATE INDEX IF NOT EXISTS idx_reports_status ON death_reports(status);

CREATE TABLE IF NOT EXISTS report_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id INTEGER NOT NULL,
  kind TEXT,                                  -- تصريح الدفن / هوية المتوفّى ...
  r2_key TEXT NOT NULL,                        -- key in PRIVATE DOCS bucket
  filename TEXT,
  size INTEGER,
  content_type TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_docs_report ON report_documents(report_id);

CREATE TABLE IF NOT EXISTS hosseiniyas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  area TEXT,
  capacity TEXT,
  for_gender TEXT DEFAULT 'both',             -- both / m / f
  incharge TEXT,
  phone TEXT,
  is_active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0
);

-- Starter venue list (names only — REAL responsible contacts to be filled by admin before launch).
INSERT INTO hosseiniyas (name, area, capacity, for_gender, incharge, phone, sort_order) VALUES
 ('حسينية آل العالي', 'صفوى الجارودية', NULL, 'both', NULL, NULL, 1),
 ('حسينية الإمام الحسين', 'صفوى البلد', NULL, 'm', NULL, NULL, 2),
 ('حسينية الزهراء (ع)', 'صفوى البلد', NULL, 'f', NULL, NULL, 3),
 ('حسينية آل سيهات', 'صفوى الجارودية', NULL, 'both', NULL, NULL, 4),
 ('حسينية الرسول (ص)', 'صفوى الكورة', NULL, 'm', NULL, NULL, 5);
