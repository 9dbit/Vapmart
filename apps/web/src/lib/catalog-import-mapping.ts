export const importHeaderAliases:Record<string,readonly string[]>={
 id:['id produk','product id','id barang'],
 type:['tipe','tipe produk','jenis produk','product type'],
 sku:['kode barang','kode produk','kode sku','product sku'],
 name:['nama produk','nama barang','product name','nama','judul produk'],
 slug:['url slug','slug produk'],
 description:['deskripsi produk','deskripsi','keterangan produk','keterangan','detail produk'],
 shortDescription:['deskripsi singkat','ringkasan'],
 regularPrice:['harga jual','harga normal','harga','price','regular price','harga produk'],
 salePrice:['harga promo','harga diskon','sale price'],
 stock:['stok','stock','jumlah stok','quantity','qty'],
 categories:['kategori','kategori produk','category'],
 images:['foto produk','gambar','gambar produk','url gambar','image links','link gambar','image url'],
 parent:['induk produk','sku induk','parent sku','parent'],
 brand:['merek','brand','nama brand'],
 weight:['berat gram','berat g','berat','weight gram'],
 length:['panjang cm','panjang','length cm'],
 width:['lebar cm','lebar','width cm'],
 height:['tinggi cm','tinggi','height cm'],
 attribute1:['atribut 1','nama atribut 1'],values1:['nilai atribut 1','varian 1'],
 attribute2:['atribut 2','nama atribut 2'],values2:['nilai atribut 2','varian 2'],
 attribute3:['atribut 3','nama atribut 3'],values3:['nilai atribut 3','varian 3']
};
export const normalizeImportHeader=(s:string)=>s.toLocaleLowerCase('id-ID')
 .normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[()/_-]+/g,' ')
 .replace(/\s+/g,' ').trim();
export function suggestImportMapping(headers:string[],fields:Record<string,string>):Record<string,string>{
 const mapped:Record<string,string>={},assigned=new Set<string>();
 for(const [key,official] of Object.entries(fields)){
  const names=[official,...(importHeaderAliases[key]||[])].map(normalizeImportHeader);
  const found=headers.find(h=>!assigned.has(h)&&names.includes(normalizeImportHeader(h)));
  mapped[key]=found||'';
  if(found)assigned.add(found);
 }
 return mapped;
}
