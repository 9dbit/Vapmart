import {ConflictException} from '@nestjs/common';

type Reader={query:(sql:string,values?:any[])=>Promise<{rows:any[]}>};

/** Called while saveFamily holds the inventory lock and the root product row lock. */
export async function assertProductTypeChange(q:Reader,before:Record<string,any>|null,nextType:string){
 if(!before||before.product_type===nextType)return;
 if(before.is_active)throw new ConflictException('Nonaktifkan produk terlebih dahulu sebelum mengubah jenis produk.');
 const state=(await q.query(`SELECT
  EXISTS(SELECT 1 FROM product.warehouse_stock WHERE product_id=$1 AND (on_hand>0 OR reserved>0)) AS has_stock,
  EXISTS(SELECT 1 FROM product.products WHERE parent_product_id=$1) AS has_variants,
  EXISTS(SELECT 1 FROM product.order_items WHERE product_id=$1) AS has_orders`,[before.id])).rows[0];
 if(!state)throw new ConflictException('Status produk belum bisa diperiksa. Muat ulang produk sebelum mengubah jenisnya.');
 if(state.has_variants)throw new ConflictException('Produk sudah memiliki SKU varian tersimpan. Gunakan produk simple baru agar SKU, stok, dan riwayat varian tetap utuh.');
 if(state.has_stock||Number(before.stock_qty)>0)throw new ConflictException('Produk masih memiliki stok atau reservasi. Gunakan produk baru untuk jenis berbeda, atau selesaikan rekonsiliasi stok terlebih dahulu.');
 if(state.has_orders)throw new ConflictException('Produk sudah memiliki riwayat pesanan. Gunakan produk baru untuk jenis berbeda agar SKU dan riwayat pesanan tetap utuh.');
}
