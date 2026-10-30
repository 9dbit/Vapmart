-- Vapmart legacy WordPress MySQL metadata inventory (read-only).
-- Run in the intended WordPress database in Hostinger phpMyAdmin.
-- Exports table structure/metadata ONLY, not users, orders or settings values.
SELECT DATABASE() AS selected_database, VERSION() AS mysql_version, NOW() AS snapshot_time;

-- InnoDB TABLE_ROWS is approximate. Exact counts require separate authorized queries.
SELECT TABLE_NAME, ENGINE, TABLE_ROWS AS approx_rows,
       DATA_LENGTH AS data_bytes, INDEX_LENGTH AS index_bytes,
       CREATE_TIME, UPDATE_TIME
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'
ORDER BY TABLE_NAME;

-- Includes WooCommerce HPOS, legacy postmeta, plugin-specific tables.
SELECT TABLE_NAME, ORDINAL_POSITION, COLUMN_NAME, COLUMN_TYPE,
       IS_NULLABLE, COLUMN_KEY, EXTRA
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
ORDER BY TABLE_NAME, ORDINAL_POSITION;
