-- Trim whitespace from section column
UPDATE graves SET section = TRIM(section);

-- Delete the summary row that isn't an actual grave
DELETE FROM graves WHERE name = 'رجال 62               نساء 56';

-- Re-run coordinates for record 19 (and any others fixed by trim)
UPDATE graves
SET latitude = 26.649580, longitude = 49.958905, row_number = 2, grave_reference = 'أ-2-19'
WHERE section = 'أ' AND grave_number = 19 AND latitude IS NULL;
