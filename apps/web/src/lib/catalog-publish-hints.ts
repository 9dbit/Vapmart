export type PublicationHint={text:string;anchor:string};
const rules:{match:RegExp;anchor:string;text:string}[]=[
 {match:/\bsku\b/i,anchor:'#catalog-info',text:'Isi SKU unik pada produk atau setiap varian aktif.'},
 {match:/\b(description|deskripsi)\b/i,anchor:'#catalog-info',text:'Lengkapi deskripsi produk.'},
 {match:/\b(name|nama)\b/i,anchor:'#catalog-info',text:'Periksa nama produk.'},
 {match:/\b(image_url|gallery|3 foto|foto produk)\b/i,anchor:'#catalog-images',text:'Unggah minimal tiga gambar produk yang berbeda.'},
 {match:/\b(price_idr|harga|price)\b/i,anchor:'#catalog-pricing',text:'Masukkan harga jual lebih dari Rp0 untuk produk atau varian.'},
 {match:/\b(weight_grams|length_cm|width_cm|height_cm|dimensi|berat)\b/i,anchor:'#catalog-dimensions',text:'Isi berat, panjang, lebar, dan tinggi lebih dari 0.'},
 {match:/\b(active_category|kategori)\b/i,anchor:'#catalog-categories',text:'Pilih kategori aktif beserta induknya yang aktif.'},
 {match:/\b(verified_warehouse|gudang|stok)\b/i,anchor:'#catalog-stock',text:'Catat stok pada gudang fisik aktif dan dapat mengirim, termasuk stok 0 bila itu hasil hitung fisik.'},
 {match:/\b(active_brand|brand)\b/i,anchor:'#catalog-info',text:'Pilih brand aktif atau kosongkan brand jika tidak diperlukan.'},
 {match:/\b(active_owner|pengelola)\b/i,anchor:'#catalog-info',text:'Pilih pengelola barang yang aktif.'},
 {match:/\b(varian aktif|variasi)\b/i,anchor:'#catalog-stock',text:'Pastikan setidaknya satu varian aktif dengan data lengkap.'}
];
export function publicationHints(message:string):PublicationHint[]{
 const seen=new Set<string>();const result:PublicationHint[]=[];
 for(const rule of rules){if(rule.match.test(message)&&!seen.has(rule.text)){result.push({text:rule.text,anchor:rule.anchor});seen.add(rule.text);}}
 return result.length?result:[{text:message||'Periksa kembali seluruh persyaratan publikasi.',anchor:'#catalog-info'}];
}
