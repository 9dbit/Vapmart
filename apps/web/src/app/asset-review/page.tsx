import Link from 'next/link';
export const metadata={title:'Review Aset WordPress | Vapmart',robots:{index:false,follow:false}};
const images=[
  '/legacy/products/archived-01.png','/legacy/products/archived-02.png',
  '/legacy/products/archived-03.png','/legacy/products/archived-04.jpg',
  '/legacy/products/archived-05.png','/legacy/products/archived-06.png',
  '/legacy/products/archived-07.jpg','/legacy/products/archived-08.png'
];
const banners=[1,2,3].map(n=>'/legacy/banners/desktop-'+String(n).padStart(2,'0')+'.png');
export default function AssetReview(){
  return <main className="vm-asset-review">
    <Link href="/" className="back-link">← Kembali ke storefront</Link>
    <h1>Vapmart / Original Asset Review</h1>
    <p>Referensi visual dari backup WordPress untuk verifikasi migrasi. Ini bukan listing produk aktif, dan tidak ada pembelian dari halaman ini.</p>
    <h2>Banner original</h2>
    <div className="vm-asset-grid vm-asset-wide">
      {banners.map((src,i)=><figure className="vm-asset-figure" key={src}>
        <img src={src} alt={'Banner WordPress '+(i+1)} width={1024} height={320}/>
        <figcaption>Banner desktop {i+1}</figcaption></figure>)}
    </div>
    <h2>Foto produk dari arsip</h2>
    <p>Gambar tidak dihubungkan ke harga, SKU, atau cart sebelum data produk diverifikasi.</p>
    <div className="vm-asset-grid">
      {images.map((src,i)=><figure className="vm-asset-figure" key={src}>
        <img src={src} alt={'Foto produk arsip '+(i+1)} width={300} height={300} loading="lazy"/>
        <figcaption>Foto arsip {String(i+1).padStart(2,'0')}</figcaption>
      </figure>)}
    </div>
  </main>;
}
