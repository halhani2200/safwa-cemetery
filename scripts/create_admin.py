"""Generate SQL to create the admin user with PBKDF2 hashed password"""
import os
import hashlib
import binascii
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# Initial admin password (user will change after first login)
PASSWORD = "Admin@Safwa2026"
USERNAME = "admin"
FULL_NAME = "حسين"

# Generate random salt
salt = os.urandom(16)
salt_hex = binascii.hexlify(salt).decode()

# PBKDF2 with SHA-256, 100000 iterations (compatible with Web Crypto)
hash_bytes = hashlib.pbkdf2_hmac('sha256', PASSWORD.encode('utf-8'), salt, 100000)
hash_hex = binascii.hexlify(hash_bytes).decode()

print(f"Username: {USERNAME}")
print(f"Password: {PASSWORD}")
print(f"Salt: {salt_hex}")
print(f"Hash:  {hash_hex}")

# Write SQL
sql = f"""-- Create admin user
INSERT INTO users (username, password_hash, password_salt, full_name, role, is_active)
VALUES ('{USERNAME}', '{hash_hex}', '{salt_hex}', '{FULL_NAME}', 'admin', 1);

-- Insert default settings
INSERT OR REPLACE INTO settings (key, value) VALUES ('site_name', 'مقبرة صفوى');
INSERT OR REPLACE INTO settings (key, value) VALUES ('telegram_channel', '');
INSERT OR REPLACE INTO settings (key, value) VALUES ('cemetery_lat', '26.649576');
INSERT OR REPLACE INTO settings (key, value) VALUES ('cemetery_lng', '49.958884');
"""

output_path = r"C:\Users\Hussain\Downloads\safwa-cemetery-site\scripts\setup_admin.sql"
with open(output_path, "w", encoding="utf-8") as f:
    f.write(sql)

print(f"\nSQL written to: {output_path}")
