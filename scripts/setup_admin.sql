-- Create admin user
INSERT INTO users (username, password_hash, password_salt, full_name, role, is_active)
VALUES ('admin', '2453c0d5501f9aa78a5ae8d7815abcccd1df18a3429af31f7b19bb820b92c8d3', '4c0480d16517bdd76e1fdcc00e42d940', 'حسين', 'admin', 1);

-- Insert default settings
INSERT OR REPLACE INTO settings (key, value) VALUES ('site_name', 'مقبرة صفوى');
INSERT OR REPLACE INTO settings (key, value) VALUES ('telegram_channel', '');
INSERT OR REPLACE INTO settings (key, value) VALUES ('cemetery_lat', '26.649576');
INSERT OR REPLACE INTO settings (key, value) VALUES ('cemetery_lng', '49.958884');
