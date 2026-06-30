-- Convert any comma-joined colors (e.g. "W,U") to JSON array format (e.g. '["W","U"]')
-- Only touches rows where colors looks like comma-separated letters, not already valid JSON
UPDATE shop_inventory
SET colors = (
  SELECT json_agg(trim(part))::text
  FROM unnest(string_to_array(colors, ',')) AS part
)
WHERE colors IS NOT NULL
  AND colors NOT LIKE '[%'
  AND colors <> '';
