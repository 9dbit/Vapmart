import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {Pool, type PoolClient} from 'pg';
import {seedMediaLibrary} from './media-library-seed';

const filenames=['001_initial.sql','002_catalog_sku.sql','003_membership_wallet.sql','004_promotions_gamification.sql','005_admin_checkout.sql','006_unified_catalog.sql','007_decommission_demo.sql','008_brand_shipping_foundation.sql','009_inventory_ledger.sql','010_brand_invitations.sql','011_shipping_quote_snapshots.sql','012_warehouse_fulfillment.sql','013_courier_orchestration.sql','014_private_media_library.sql','015_cp37a_integrity.sql','016_hero_banners.sql','017_product_engine.sql','018_private_draft_publication.sql','019_checkout_conversion.sql','020_voucher_admin.sql','021_promo_campaigns.sql'] as const;

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for migration');
  const applied:string[]=[];
  const pool=new Pool({connectionString:process.env.DATABASE_URL,max:1,connectionTimeoutMillis:10000});
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(2026102901)');
    await client.query("CREATE SCHEMA IF NOT EXISTS vapmart_meta");
    await client.query("CREATE TABLE IF NOT EXISTS vapmart_meta.migrations (name text PRIMARY KEY, sha256 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())");
    for(const filename of filenames) {
      const raw=await readFile(join(__dirname,filename),'utf8');
      const sql=raw.split('\n').filter(line=>!/^\s*(BEGIN|COMMIT)\s*;\s*$/i.test(line)).join('\n');
      const checksum=createHash('sha256').update(raw).digest('hex');
      const existing=await client.query<{sha256:string}>("SELECT sha256 FROM vapmart_meta.migrations WHERE name=$1",[filename]);
      if(existing.rows.length && existing.rows[0].sha256 !== checksum)
        throw new Error('Migration checksum drift: refuse to overwrite prior migration');
      if(existing.rows.length===0){
        await client.query(sql);
        await client.query("INSERT INTO vapmart_meta.migrations (name,sha256) VALUES ($1,$2)",[filename,checksum]);
        applied.push(filename);
      }
    }
    const check=await client.query<{has_products:boolean,has_roles:boolean}>(
      "SELECT to_regclass('product.products') IS NOT NULL AS has_products, to_regclass('public.staff_roles') IS NOT NULL AS has_roles"
    );
    if(!check.rows[0]?.has_products || !check.rows[0]?.has_roles) throw new Error('Migration validation failed');
    const mediaLibrary=await seedMediaLibrary(client,join(__dirname,'resources'));
    const seeded=0; // CP33: no synthetic product seeding in any environment.
    await client.query('COMMIT');
    console.log('VAPMART_DATABASE_READY',JSON.stringify({migrations:filenames,applied,seeded_demo_products:seeded,mediaLibrary}));
  } catch(error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}
main().catch(e=>{console.error('VAPMART_DATABASE_MIGRATION_FAILED',e instanceof Error?e.message:String(e));process.exitCode=1;});
