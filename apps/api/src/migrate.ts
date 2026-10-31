import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {Pool, type PoolClient} from 'pg';

const filenames=['001_initial.sql','002_catalog_sku.sql','003_membership_wallet.sql','004_promotions_gamification.sql','005_admin_checkout.sql'] as const;

async function seedDemoCatalog(client: PoolClient): Promise<number> {
  if (process.env.SEED_DEMO_CATALOG !== 'true') return 0;
  if (process.env.RAILWAY_ENVIRONMENT_NAME !== 'staging') {
    throw new Error('Demo catalog can only be seeded in the Railway staging environment');
  }
  const res = await client.query<{count:number}>('SELECT COUNT(*)::int AS count FROM product.products');
  if (res.rows[0].count !== 0) return 0;
  const entries = [
    ['demo-modular-desk-organizer','DEMO · Modular Desk Organizer','Produk ilustrasi untuk pengujian staging saja. Bukan penawaran komersial.','home',149000,12],
    ['demo-ceramic-accent-vase','DEMO · Ceramic Accent Vase','Produk ilustrasi untuk pengujian staging saja. Bukan penawaran komersial.','decor',219000,6],
    ['demo-canvas-utility-pouch','DEMO · Canvas Utility Pouch','Produk ilustrasi untuk pengujian staging saja. Bukan penawaran komersial.','accessories',99000,18],
    ['demo-portable-desk-light','DEMO · Portable Desk Light','Produk ilustrasi untuk pengujian staging saja. Bukan penawaran komersial.','electronics',349000,4],
  ] as const;
  let count=0;
  for(const row of entries) {
    const result=await client.query(
      "INSERT INTO product.products (slug,name,description,category,price_idr,stock_qty,is_active) VALUES ($1,$2,$3,$4,$5,$6,true) ON CONFLICT (slug) DO NOTHING",
      [...row]
    );
    count+=result.rowCount ?? 0;
  }
  return count;
}

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
    const seeded=await seedDemoCatalog(client);
    await client.query('COMMIT');
    console.log('VAPMART_DATABASE_READY',JSON.stringify({migrations:filenames,applied,seeded_demo_products:seeded}));
  } catch(error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}
main().catch(e=>{console.error('VAPMART_DATABASE_MIGRATION_FAILED',e instanceof Error?e.message:String(e));process.exitCode=1;});
