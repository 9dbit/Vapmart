import sys
import tempfile
import unittest
from pathlib import Path
from zipfile import ZipFile

sys.path.insert(0,str(Path(__file__).resolve().parent))
from catalog_migration import CatalogError,audit_wordpress,prepare_replacement

HEAD="sku,slug,name,description,category,price_idr,stock_qty,image_url,is_active\n"
ROW="HOME-001,bamboo-tray,Bamboo Desk Tray,Desk accessory,home,149000,10,,false\n"

class CatalogMigrationTests(unittest.TestCase):
    def test_draft_only(self):
        items=prepare_replacement((HEAD+ROW).encode())
        self.assertEqual(items[0]["sku"],"HOME-001")
        self.assertFalse(items[0]["is_active"])

    def test_restricted_products_blocked(self):
        for name in ["Vape Kit","Nicotine Liquid","IQOS device","Pod system"]:
            with self.subTest(name=name):
                with self.assertRaisesRegex(CatalogError,"restricted"):
                    prepare_replacement((HEAD+ROW.replace("Bamboo Desk Tray",name)).encode())

    def test_duplicate_sku_blocked(self):
        with self.assertRaisesRegex(CatalogError,"duplicate"):
            prepare_replacement((HEAD+ROW+ROW.replace("bamboo-tray","other-tray")).encode())

    def test_duplicate_slug_blocked(self):
        with self.assertRaisesRegex(CatalogError,"duplicate"):
            prepare_replacement((HEAD+ROW+ROW.replace("HOME-001","HOME-002")).encode())

    def test_legacy_image_reuse_blocked(self):
        with self.assertRaisesRegex(CatalogError,"historical"):
            prepare_replacement((HEAD+ROW.replace(",,false",",https://vapmart.co.id/wp-content/uploads/2025/06/mission.png,false")).encode())

    def test_publishing_blocked(self):
        with self.assertRaisesRegex(CatalogError,"publication"):
            prepare_replacement((HEAD+ROW.replace("false","true")).encode())

    def test_bad_category_blocked(self):
        with self.assertRaisesRegex(CatalogError,"category"):
            prepare_replacement((HEAD+ROW.replace(",home,",",pod,")).encode())

    def test_multiline_csv_fields(self):
        x='HOME-002,bamboo-tray,Bamboo Tray,"Natural bamboo\nLarge tray, practical",home,50000,4,,\n'
        self.assertIn("Large tray, practical",prepare_replacement((HEAD+x).encode())[0]["description"])

    def test_readonly_legacy_audit(self):
        with tempfile.TemporaryDirectory() as td:
            f=Path(td)/"source.zip"
            feed=("id,title,item_group_id,product_type,price,image_link,availability,brand\n"
                  "1,Archived Item,A,Pod,50000IDR,https://vapmart.co.id/wp-content/uploads/2025/01/a.png,in stock,Brand\n")
            with ZipFile(f,"w") as z:
                z.writestr("wp-content/uploads/facebook_for_woocommerce/product_catalog_123.csv",feed)
                z.writestr("wp-content/uploads/2025/01/a.png",b"file")
            report=audit_wordpress(f)
            self.assertEqual(report["rows"],1)
            self.assertEqual(report["matched_archive_images"],1)
            self.assertFalse(report["eligible_for_active_import"])

if __name__=="__main__":
    unittest.main()
