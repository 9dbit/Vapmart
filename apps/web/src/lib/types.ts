export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: 'home' | 'lifestyle' | 'decor' | 'accessories' | 'electronics' | 'other';
  price_idr: number;
  stock_qty: number;
  image_url: string | null;
  is_active: boolean;
}

export type CartItem = {product: Product; quantity:number};
export const categories = [
  {value:'all',label:'Semua produk'},
  {value:'home',label:'Home'},
  {value:'lifestyle',label:'Lifestyle'},
  {value:'decor',label:'Decor'},
  {value:'accessories',label:'Accessories'},
  {value:'electronics',label:'Electronics'},
  {value:'other',label:'Lainnya'},
] as const;

export function formatIDR(value:number):string {
  return new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(value);
}
