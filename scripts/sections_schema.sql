-- Sections table for managing cemetery sections with calibration corners
CREATE TABLE IF NOT EXISTS sections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    nw_lat REAL, nw_lng REAL,
    ne_lat REAL, ne_lng REAL,
    sw_lat REAL, sw_lng REAL,
    se_lat REAL, se_lng REAL,
    rows_count INTEGER DEFAULT 11,
    cols_count INTEGER DEFAULT 17,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Seed Section A with current calibration
INSERT OR IGNORE INTO sections (code, name, nw_lat, nw_lng, ne_lat, ne_lng, sw_lat, sw_lng, se_lat, se_lng, rows_count, cols_count, notes)
VALUES ('أ', 'المنطقة أ', 26.649576, 49.958884, 26.649639, 49.959215, 26.649334, 49.958942, 26.649388, 49.959267, 11, 17, 'المنطقة الجديدة المنظمة');
