-- CP32: unified PostgreSQL catalog with separate read-only historical namespace.
-- No archival item is inserted into sellable product.products.
BEGIN;
CREATE TABLE IF NOT EXISTS product.legacy_archive (
 slug text PRIMARY KEY,
 name text NOT NULL,
 brand text NOT NULL,
 category text NOT NULL,
 image_path text NOT NULL,
 historical_price text NOT NULL,
 historical_original_price text,
 source_snapshot text NOT NULL,
 is_sellable boolean NOT NULL DEFAULT false CHECK (is_sellable = false),
 imported_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO product.legacy_archive(slug,name,brand,category,image_path,historical_price,historical_original_price,source_snapshot)
VALUES
('into-mission-replacement-pods','Into Mission Cartridge','Into','cartridge','/legacy/products/archived-00.png','Rp 50.000','Rp 85.000','homepage-20260316'),
('into-mercury-mission-1100mah-pod-system-kit','Into Mercury Mission 1100mAh Disewakan hanya Device 1 tahun','Into','pod','/legacy/products/archived-01.png','Rp 400.000',NULL,'homepage-20260316'),
('into-neptune-mission-1100mah-pod-system-kit','Into Neptune Mission 1100mAh Disewakan hanya Device 1 tahun','Into','pod','/legacy/products/archived-02.png','Rp 400.000',NULL,'homepage-20260316'),
('into-moon-mission-1100mah-pod-system-kit','Into Jupiter Mission 1100mAh Disewakan hanya Device 1 tahun','Into','pod','/legacy/products/archived-03.png','Rp 400.000',NULL,'homepage-20260316'),
('sp2s-uranus-pod-kit-30w-1000mah-2','SP2S URANUS POD KIT 30W Free Liquid 15ml','SP2S','pod','/legacy/products/archived-04.jpg','Rp 280.000','Rp 364.000','homepage-20260316'),
('into-earth-mission-1100mah-pod-system-kit','Into Earth Mission 1100mAh Disewakan hanya Device 1 tahun','Into','pod','/legacy/products/archived-05.png','Rp 400.000',NULL,'homepage-20260316'),
('into-venus-mission-1100mah-pod-system-kit','Into Venus Mission 1100mAh Disewakan hanya Device 1 tahun','Into','pod','/legacy/products/archived-06.png','Rp 400.000',NULL,'homepage-20260316'),
('sp2s-venus-pod-kit-30w-1500mah-screen-display-bigger-capacity-2-5ml-airflow-adjustable-type-c-fast-charging-black-gray-green-pink-white-gratis-liquid-15ml','SP2S VENUS POD KIT 30W 1500mAh – Screen Display','SP2S','pod','/legacy/products/archived-07.jpg','Rp 180.000',NULL,'homepage-20260316'),
('sp2s-cartridge-uranus-pod-2-5ml-per-pcs','SP2S CARTRIDGE URANUS POD 2.5ML PER PCS','SP2S','cartridge','/legacy/products/archived-09.jpg','Rp 40.000','Rp 52.000','homepage-20260316'),
('mystery-box-liquid-15ml-dan-30ml','MYSTERY BOX LIQUID 15ML dan 30ML','SP2S','e-juice','/legacy/products/archived-08.png','Rp 40.000 – Rp 80.000',NULL,'homepage-20260316'),
('oxva-xlim-go-kit-bundling-ox-passion-black','OXVA XLIM GO KIT BUNDLING OX PASSION — BLACK','OXVA','pod','/legacy/products/archived-10.webp','Rp 215.000','Rp 250.000','homepage-20260316'),
('rolv-rock-master-pod','ROLV ROCK MASTER POD','ROLV','pod','/legacy/products/archived-11.png','Rp 150.000','Rp 200.000','homepage-20260316'),
('once-disposable-1200-puff','SP2S Once Disposable 1200 Puff','SP2S','pod','/legacy/categories/pod-06.jpeg','Rp 60.000','Rp 116.000','pod-category-20260414'),
('gem-disposable-3500-puff-6ml','GEM Disposable 3500 Puff 6ml FREE ONCE','SP2S','pod','/legacy/categories/pod-07.jpeg','Rp 200.000','Rp 260.000','pod-category-20260414'),
('sp2s-sii-pro-device','SP2S SII PRO Device Only','SP2S','pod','/legacy/categories/pod-08.jpg','Rp 150.000','Rp 245.000','pod-category-20260414'),
('emkay-pod-free-liquid-15ml-black-majesty','EMKAY Pod Free Liquid 15ml – Black Majesty','Liquid Cult','pod','/legacy/categories/pod-09.png','Rp 160.000',NULL,'pod-category-20260414'),
('emkay-pod-free-liquid-15ml-rose-gold','EMKAY Pod Free Liquid 15ml – Rose Gold','Liquid Cult','pod','/legacy/categories/pod-10.png','Rp 160.000',NULL,'pod-category-20260414'),
('emkay-pod-free-liquid-15ml-blue-ocean','EMKAY Pod Free Liquid 15ml – Blue Ocean','Liquid Cult','pod','/legacy/categories/pod-11.png','Rp 160.000',NULL,'pod-category-20260414'),
('emkay-pod-free-liquid-15ml-maple-shine','EMKAY Pod Free Liquid 15ml – Maple Shine','Liquid Cult','pod','/legacy/categories/pod-12.png','Rp 160.000',NULL,'pod-category-20260414')
ON CONFLICT (slug) DO NOTHING;
CREATE OR REPLACE VIEW product.catalog_overview AS
 SELECT 'active'::text AS source, p.id::text AS identifier,p.slug,p.name,coalesce(b.name,'') AS brand,p.category,p.image_url AS image_url,p.price_idr::text AS display_price,p.is_active AS is_sellable
 FROM product.products p LEFT JOIN product.brands b ON b.id=p.brand_id
 UNION ALL
 SELECT 'archive'::text, null::text AS identifier,a.slug,a.name,a.brand,a.category,a.image_path,a.historical_price,false
 FROM product.legacy_archive a;
REVOKE ALL ON product.legacy_archive FROM PUBLIC;
REVOKE ALL ON product.catalog_overview FROM PUBLIC;
COMMIT;
