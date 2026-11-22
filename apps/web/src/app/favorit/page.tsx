import {FavoritesDashboard} from '@/components/favorites-dashboard';
import {getBrandsResult,getProductsResult} from '@/lib/api';
export const metadata={title:'Favorit Saya | Vapmart',robots:{index:false,follow:false}};
export const dynamic='force-dynamic';
export default async function FavoritesPage(){
 const [products,brands]=await Promise.all([getProductsResult(),getBrandsResult()]);
 return <FavoritesDashboard
  products={products.items.filter(p=>p.is_active&&!p.slug.startsWith('demo-'))}
  brands={brands.items.filter(b=>b.is_active)}
  productsError={!products.ok}
  brandsError={!brands.ok}/>;
}
