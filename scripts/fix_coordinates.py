"""Recalculate coordinates for all section A graves using cumulative numbering"""
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

OUTPUT_SQL = r"C:\Users\Hussain\Downloads\safwa-cemetery-site\scripts\fix_coords.sql"

# Section A calibration corners
NW_LAT, NW_LNG = 26.649576, 49.958884   # Row 1, Col 1
NE_LAT, NE_LNG = 26.649639, 49.959215   # Row 1, Col 17
SW_LAT, SW_LNG = 26.649334, 49.958942   # Row 11, Col 1
SE_LAT, SE_LNG = 26.649388, 49.959267   # Row 11, Col 17

ROWS = 11
COLS = 17

def calc(row, col):
    if row < 1 or row > ROWS or col < 1 or col > COLS:
        return None, None
    u = (col - 1) / (COLS - 1)
    v = (row - 1) / (ROWS - 1)
    lat = (1-u)*(1-v)*NW_LAT + u*(1-v)*NE_LAT + (1-u)*v*SW_LAT + u*v*SE_LAT
    lng = (1-u)*(1-v)*NW_LNG + u*(1-v)*NE_LNG + (1-u)*v*SW_LNG + u*v*SE_LNG
    return round(lat, 6), round(lng, 6)


# Generate SQL UPDATEs for all 187 possible positions
lines = ["-- Fix coordinates for Section A graves using cumulative numbering"]
lines.append("-- column_in_row = ((grave_number - 1) MOD 17) + 1")
lines.append("-- row = ((grave_number - 1) DIV 17) + 1")
lines.append("")

for grave_num in range(1, ROWS * COLS + 1):  # 1 to 187
    row = ((grave_num - 1) // COLS) + 1
    col = ((grave_num - 1) % COLS) + 1
    lat, lng = calc(row, col)
    # Update by grave_number AND section to be safe
    lines.append(f"UPDATE graves SET latitude = {lat}, longitude = {lng}, row_number = {row}, grave_reference = 'أ-{row}-{grave_num}' WHERE section = 'أ' AND grave_number = {grave_num};")

with open(OUTPUT_SQL, "w", encoding="utf-8") as f:
    f.write("\n".join(lines))

print(f"Generated {ROWS * COLS} UPDATE statements")
print(f"Written to: {OUTPUT_SQL}")
